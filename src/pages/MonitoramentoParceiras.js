import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getEditorasParceiras, createEditoraParceira, updateEditoraParceira,
  desativarEditoraParceira, importarEditorasPlanilha,
  getCheckagemMes, upsertCheckagemDia, gerarChecklistDia,
  getObservacoesEditora, createObservacao, deleteObservacao,
} from '../lib/monitoramento-editoras'
import {
  Eye, Plus, X, Upload, ChevronLeft, ChevronRight,
  Pencil, Trash2, Check, Clock, AlertCircle, FileSpreadsheet,
  Instagram, MessageSquare, LayoutGrid, List,
} from 'lucide-react'
import * as XLSX from 'xlsx'

// ── CONSTANTES ─────────────────────────────────────────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const FORMATOS = [
  { value: 'stories', label: 'Stories',  diasSemana: [2, 5], cor: '#8b5cf6' }, // ter, sex
  { value: 'feed',    label: 'Feed',     diasSemana: [3],    cor: '#8b5cf6' }, // qua
  { value: 'reels',   label: 'Reels',    diasSemana: [1],    cor: '#8b5cf6', quinzenal: true }, // seg
  { value: 'email',   label: 'E-mail',   diasSemana: [1],    cor: '#8b5cf6' }, // seg
]

const STATUS = [
  { value: 'pendente',    label: 'Pendente',    cor: '#6b7280', bg: '#6b728018', icon: '🕐' },
  { value: 'postou',      label: 'Postou',      cor: '#22c55e', bg: '#22c55e18', icon: '✅' },
  { value: 'nao_postou',  label: 'Não postou',  cor: '#ef4444', bg: '#ef444418', icon: '❌' },
]

const CATEGORIAS_OBS = ['Comportamento', 'Resposta às mensagens', 'Vendas na livraria', 'Qualidade das postagens', 'Relacionamento', 'Outro']

function pad(n) { return String(n).padStart(2, '0') }
function toKey(a, m, d) { return `${a}-${pad(m)}-${pad(d)}` }
function hojeKey() { const d = new Date(); return toKey(d.getFullYear(), d.getMonth() + 1, d.getDate()) }

function diasDoMes(ano, mes) {
  const total = new Date(ano, mes, 0).getDate()
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(ano, mes - 1, i + 1)
    return { dia: i + 1, key: toKey(ano, mes, i + 1), diaSemana: d.getDay() }
  })
}

function isDiaEntrega(diaSemana, formato, semanaDoMes) {
  const f = FORMATOS.find(x => x.value === formato)
  if (!f) return false
  if (!f.diasSemana.includes(diaSemana)) return false
  if (f.quinzenal && semanaDoMes % 2 === 0) return false // quinzenal = semanas ímpares (1ª e 3ª)
  return true
}

function semanaDoMes(dia) {
  return Math.ceil(dia / 7)
}

function statusInfo(s) {
  return STATUS.find(x => x.value === s) || STATUS[0]
}

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  return [toast, show]
}

// ── MODAL EDITORA ──────────────────────────────────────────
function ModalEditora({ editora, onSave, onClose }) {
  const [form, setForm] = useState({ nome: editora?.nome || '', contato: editora?.contato || '', instagram: editora?.instagram || '' })
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!form.nome.trim()) return
    setSaving(true)
    try { await onSave(form); onClose() }
    catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">{editora ? 'Editar editora' : 'Nova editora'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome da editora" />
          </div>
          <div className="form-group">
            <label className="form-label">Contato</label>
            <input className="form-input" value={form.contato} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} placeholder="Nome do responsável" />
          </div>
          <div className="form-group">
            <label className="form-label">Instagram</label>
            <input className="form-input" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} placeholder="@usuario" />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving || !form.nome.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL IMPORTAR EDITORAS ────────────────────────────────
function ModalImportar({ onClose, onImported }) {
  const fileRef = useRef()
  const [linhas, setLinhas] = useState([])
  const [etapa, setEtapa] = useState('upload')
  const [importando, setImportando] = useState(false)

  function baixarTemplate() {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nome', 'Instagram'],
      ['Editora Exemplo', '@editoraexemplo'],
    ])
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Editoras')
    XLSX.writeFile(wb, 'template_editoras_parceiras.xlsx')
  }

  function processar(file) {
    const reader = new FileReader()
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const dados = rows.slice(1).filter(r => r[0]?.toString().trim())
      setLinhas(dados.map(r => ({ nome: r[0]?.toString().trim(), instagram: r[1]?.toString().trim() || '' })))
      setEtapa('revisao')
    }
    reader.readAsArrayBuffer(file)
  }

  async function confirmar() {
    setImportando(true)
    try {
      await importarEditorasPlanilha(linhas)
      onImported()
      onClose()
    } catch (e) { console.error(e) }
    finally { setImportando(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">Importar editoras via planilha</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {etapa === 'upload' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Baixe o template, preencha com as editoras e faça o upload.
            </p>
            <button onClick={baixarTemplate} className="btn btn-ghost" style={{ width: '100%', marginBottom: 12, justifyContent: 'center' }}>
              <FileSpreadsheet size={14} /> Baixar template .xlsx
            </button>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) processar(f) }}
              style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)' }}
            >
              <Upload size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Clique ou arraste o arquivo .xlsx</div>
              <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) processar(f); e.target.value = '' }} />
            </div>
          </div>
        )}

        {etapa === 'revisao' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              {linhas.length} editora{linhas.length !== 1 ? 's' : ''} encontrada{linhas.length !== 1 ? 's' : ''}:
            </p>
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
              {linhas.map((l, i) => (
                <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', gap: 12 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)', flex: 1 }}>{l.nome}</span>
                  {l.instagram && <span style={{ color: 'var(--text-muted)' }}>{l.instagram}</span>}
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setEtapa('upload')}>Voltar</button>
              <button className="btn btn-primary" onClick={confirmar} disabled={importando}>
                {importando ? 'Importando...' : `Importar ${linhas.length}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PAINEL LATERAL DE EDITORA ──────────────────────────────
function PainelEditora({ editora, checkagemMes, ano, mes, usuario, onClose }) {
  const [obs, setObs] = useState([])
  const [loadingObs, setLoadingObs] = useState(true)
  const [novaObs, setNovaObs] = useState({ categoria: 'Comportamento', texto: '' })
  const [salvandoObs, setSalvandoObs] = useState(false)

  useEffect(() => {
    setLoadingObs(true)
    getObservacoesEditora(editora.id)
      .then(setObs)
      .finally(() => setLoadingObs(false))
  }, [editora.id])

  // Resumo de postagens da editora no mês
  const registros = checkagemMes.filter(r => r.editora_id === editora.id)
  const postou = registros.filter(r => r.status === 'postou').length
  const naoPostou = registros.filter(r => r.status === 'nao_postou').length
  const pendente = registros.filter(r => r.status === 'pendente').length
  const total = registros.length
  const pct = total > 0 ? Math.round((postou / total) * 100) : 0

  async function salvarObs() {
    if (!novaObs.texto.trim()) return
    setSalvandoObs(true)
    try {
      const nova = await createObservacao({ ...novaObs, editora_id: editora.id, criado_por: usuario?.id })
      setObs(prev => [nova, ...prev])
      setNovaObs(f => ({ ...f, texto: '' }))
    } catch (e) { console.error(e) }
    finally { setSalvandoObs(false) }
  }

  async function excluirObs(id) {
    if (!window.confirm('Excluir observação?')) return
    await deleteObservacao(id)
    setObs(prev => prev.filter(o => o.id !== id))
  }

  const corSaude = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: 'var(--surface)', borderLeft: '1px solid var(--border)', zIndex: 100, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.2)' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{editora.nome}</div>
          {editora.contato && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>👤 {editora.contato}</div>}
          {editora.instagram && (
            <a href={`https://instagram.com/${editora.instagram.replace('@', '')}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Instagram size={11} /> {editora.instagram}
            </a>
          )}
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* Saúde do mês */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            {MESES[mes - 1]} {ano}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            {[
              { n: postou, l: 'Postou', c: '#22c55e' },
              { n: naoPostou, l: 'Não postou', c: '#ef4444' },
              { n: pendente, l: 'Pendente', c: '#6b7280' },
            ].map(({ n, l, c }) => (
              <div key={l} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-2)', borderRadius: 8, padding: '8px 4px' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{n}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l}</div>
              </div>
            ))}
          </div>
          {total > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                <span>Taxa de postagem</span><span style={{ color: corSaude, fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-3)' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: corSaude, borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Histórico por formato */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Postagens por formato</div>
          {FORMATOS.map(fmt => {
            const regsFormato = registros.filter(r => r.formato === fmt.value)
            const p = regsFormato.filter(r => r.status === 'postou').length
            const np = regsFormato.filter(r => r.status === 'nao_postou').length
            if (regsFormato.length === 0) return null
            return (
              <div key={fmt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: fmt.cor, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{fmt.label}</span>
                <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>✅ {p}</span>
                <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>❌ {np}</span>
              </div>
            )
          })}
        </div>

        {/* Observações */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Observações</div>

          {/* Nova observação */}
          <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <select className="form-select" value={novaObs.categoria} onChange={e => setNovaObs(f => ({ ...f, categoria: e.target.value }))} style={{ marginBottom: 8, fontSize: 12 }}>
              {CATEGORIAS_OBS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea className="form-textarea" rows={2} value={novaObs.texto} onChange={e => setNovaObs(f => ({ ...f, texto: e.target.value }))} placeholder="Escreva uma observação..." style={{ marginBottom: 8, fontSize: 12 }} />
            <button className="btn btn-primary btn-sm" onClick={salvarObs} disabled={salvandoObs || !novaObs.texto.trim()}>
              <MessageSquare size={12} /> Registrar
            </button>
          </div>

          {/* Lista de observações */}
          {loadingObs ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Carregando...</div>
          ) : obs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Nenhuma observação registrada.</div>
          ) : obs.map(o => (
            <div key={o.id} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px', marginBottom: 8, borderLeft: '3px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{o.categoria}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(o.criado_em).toLocaleDateString('pt-BR')}</span>
                  <button onClick={() => excluirObs(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, opacity: 0.5, display: 'flex' }}><Trash2 size={11} /></button>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text)', margin: 0 }}>{o.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── CHECKLIST DE CHECAGEM (aba principal) ──────────────────
function ViewChecklist({ editoras, checkagemMes, formato, dataKey, onMarcar, onGerarDia }) {
  const registrosDoDia = checkagemMes.filter(r => r.formato === formato && r.data_esperada === dataKey)
  const mapa = {}
  for (const r of registrosDoDia) mapa[r.editora_id] = r

  // Editoras que ainda não têm registro nesse dia/formato
  const semRegistro = editoras.filter(e => !mapa[e.id])

  const [gerando, setGerando] = useState(false)

  async function gerar() {
    setGerando(true)
    try { await onGerarDia() }
    finally { setGerando(false) }
  }

  if (editoras.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0', fontSize: 13 }}>Nenhuma editora cadastrada ainda.</div>
  }

  return (
    <div>
      {semRegistro.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{semRegistro.length} editora{semRegistro.length !== 1 ? 's' : ''} sem checagem neste dia.</span>
          <button className="btn btn-primary btn-sm" onClick={gerar} disabled={gerando}>
            {gerando ? 'Gerando...' : 'Gerar checklist para todas'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {editoras.map(editora => {
          const reg = mapa[editora.id]
          const status = reg?.status || null

          return (
            <div key={editora.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, transition: 'border-color 0.15s' }}>
              {/* Nome */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editora.nome}</div>
                {editora.contato && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>👤 {editora.contato}</div>}
              {editora.instagram && (
                  <a href={`https://instagram.com/${editora.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Instagram size={10} /> {editora.instagram}
                  </a>
                )}
              </div>

              {/* Botões de status */}
              <div style={{ display: 'flex', gap: 6 }}>
                {STATUS.map(s => (
                  <button key={s.value} onClick={() => onMarcar({ editora, formato, dataKey, status: s.value })}
                    style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${s.cor}`, background: status === s.value ? s.cor : 'transparent', color: status === s.value ? '#fff' : s.cor, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── DASHBOARD GERAL ────────────────────────────────────────
function ViewDashboard({ editoras, checkagemMes, mes, ano, onAbrirEditora }) {
  const hj = hojeKey()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
      {editoras.map(editora => {
        const regs = checkagemMes.filter(r => r.editora_id === editora.id)
        const postou = regs.filter(r => r.status === 'postou').length
        const naoPostou = regs.filter(r => r.status === 'nao_postou').length
        const pendente = regs.filter(r => r.status === 'pendente').length
        const total = regs.length
        const pct = total > 0 ? Math.round((postou / total) * 100) : null
        const corSaude = pct === null ? '#6b7280' : pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'
        const labelSaude = pct === null ? 'Sem dados' : pct >= 70 ? 'Boa' : pct >= 40 ? 'Regular' : 'Crítica'

        return (
          <div key={editora.id} onClick={() => onAbrirEditora(editora)}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s', borderTop: `3px solid ${corSaude}` }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.borderTopColor = corSaude }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{editora.nome}</div>
                {editora.contato && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>👤 {editora.contato}</div>}
                {editora.instagram && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{editora.instagram}</div>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: corSaude, background: corSaude + '18', padding: '2px 8px', borderRadius: 20 }}>{labelSaude}</span>
            </div>

            {total > 0 ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>✅ {postou}</span>
                  <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>❌ {naoPostou}</span>
                  {pendente > 0 && <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>🕐 {pendente}</span>}
                </div>
                <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-3)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: corSaude, borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>{pct}% de postagem</div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem checagens neste mês.</div>
            )}

            {/* Por formato */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {FORMATOS.map(fmt => {
                const rf = regs.filter(r => r.formato === fmt.value)
                if (rf.length === 0) return null
                const p = rf.filter(r => r.status === 'postou').length
                const np = rf.filter(r => r.status === 'nao_postou').length
                return (
                  <span key={fmt.value} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: fmt.cor + '18', color: fmt.cor, fontWeight: 600 }}>
                    {fmt.label} {p}/{rf.length}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function MonitoramentoParceiras() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.perfil === 'administrador' || usuario?.perfil === 'gerente' || usuario?.perfil === 'supervisor_parceiras'

  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [editoras, setEditoras] = useState([])
  const [checkagemMes, setCheckagemMes] = useState([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('checklist') // 'checklist' | 'dashboard'
  const [formatoSel, setFormatoSel] = useState('stories')
  const [dataSel, setDataSel] = useState(hojeKey())
  const [painelEditora, setPainelEditora] = useState(null)
  const [modalEditora, setModalEditora] = useState(null) // null | 'new' | editora
  const [showImportar, setShowImportar] = useState(false)
  const [toast, showToast] = useToast()

  useEffect(() => { carregarEditoras() }, [])
  useEffect(() => { carregarCheckagemMes() }, [ano, mes])

  async function carregarEditoras() {
    try { setEditoras(await getEditorasParceiras()) }
    catch (e) { console.error(e) }
  }

  async function carregarCheckagemMes() {
    setLoading(true)
    try { setCheckagemMes(await getCheckagemMes({ ano, mes })) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function navMes(d) {
    let nm = mes + d, na = ano
    if (nm > 12) { nm = 1; na++ }
    if (nm < 1) { nm = 12; na-- }
    setMes(nm); setAno(na)
  }

  // Dias do mês com indicação de entrega por formato
  const dias = diasDoMes(ano, mes)
  const diasEntrega = dias.filter(d => isDiaEntrega(d.diaSemana, formatoSel, semanaDoMes(d.dia)))

  async function handleMarcar({ editora, formato, dataKey, status }) {
    try {
      const reg = await upsertCheckagemDia({ editora_id: editora.id, formato, data_esperada: dataKey, status })
      setCheckagemMes(prev => {
        const idx = prev.findIndex(r => r.editora_id === editora.id && r.formato === formato && r.data_esperada === dataKey)
        if (idx >= 0) { const n = [...prev]; n[idx] = reg; return n }
        return [...prev, reg]
      })
    } catch (e) { console.error(e); showToast('Erro ao salvar', 'error') }
  }

  async function handleGerarDia() {
    try {
      const novos = await gerarChecklistDia({ editoras, formato: formatoSel, data_esperada: dataSel })
      setCheckagemMes(prev => {
        const mapa = {}
        for (const r of prev) mapa[`${r.editora_id}-${r.formato}-${r.data_esperada}`] = r
        for (const r of novos) mapa[`${r.editora_id}-${r.formato}-${r.data_esperada}`] = r
        return Object.values(mapa)
      })
      showToast('Checklist gerado!')
    } catch (e) { console.error(e); showToast('Erro ao gerar', 'error') }
  }

  async function handleSalvarEditora(form) {
    if (modalEditora && modalEditora !== 'new') {
      const upd = await updateEditoraParceira(modalEditora.id, form)
      setEditoras(prev => prev.map(e => e.id === upd.id ? upd : e))
      showToast('Editora atualizada!')
    } else {
      const nova = await createEditoraParceira(form)
      setEditoras(prev => [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome)))
      showToast('Editora cadastrada!')
    }
  }

  async function handleDesativar(editora) {
    if (!window.confirm(`Remover ${editora.nome}?`)) return
    await desativarEditoraParceira(editora.id)
    setEditoras(prev => prev.filter(e => e.id !== editora.id))
    showToast('Editora removida!')
  }

  // Resumo do mês
  const totalPostou = checkagemMes.filter(r => r.status === 'postou').length
  const totalNao = checkagemMes.filter(r => r.status === 'nao_postou').length
  const totalPend = checkagemMes.filter(r => r.status === 'pendente').length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Eye size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Monitoramento Parceiras</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {editoras.length} editoras · {MESES[mes - 1]} {ano}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Resumo */}
          <div style={{ display: 'flex', gap: 14 }}>
            {[{ n: totalPostou, l: 'Postaram', c: '#22c55e' }, { n: totalNao, l: 'Não postaram', c: '#ef4444' }, { n: totalPend, l: 'Pendentes', c: '#6b7280' }].map(({ n, l, c }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: c, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Ações admin */}
          {isAdmin && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowImportar(true)}><Upload size={13} /> Importar editoras</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalEditora('new')}><Plus size={13} /> Nova editora</button>
            </>
          )}

          {/* Toggle aba */}
          <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setAba('checklist')} style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: aba === 'checklist' ? 'var(--accent)' : 'transparent', color: aba === 'checklist' ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <List size={13} /> Checklist
            </button>
            <button onClick={() => setAba('dashboard')} style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: aba === 'dashboard' ? 'var(--accent)' : 'transparent', color: aba === 'dashboard' ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <LayoutGrid size={13} /> Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Navegação de mês */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 20px' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navMes(-1)}><ChevronLeft size={18} /></button>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', minWidth: 180, textAlign: 'center' }}>{MESES[mes - 1]} {ano}</span>
        <button className="btn btn-ghost btn-icon" onClick={() => navMes(1)}><ChevronRight size={18} /></button>
      </div>

      {/* ── ABA CHECKLIST ── */}
      {aba === 'checklist' && (
        <div>
          {/* Seletor de formato */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {FORMATOS.map(fmt => (
              <button key={fmt.value} onClick={() => setFormatoSel(fmt.value)}
                style={{ padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `2px solid ${fmt.cor}`, background: formatoSel === fmt.value ? fmt.cor : 'transparent', color: formatoSel === fmt.value ? '#fff' : fmt.cor, transition: 'all 0.15s' }}>
                {fmt.label}
                {fmt.quinzenal && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>quinzenal</span>}
              </button>
            ))}
          </div>

          {/* Seletor de dia — mostra só dias de entrega do formato */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              Dias de entrega de {FORMATOS.find(f => f.value === formatoSel)?.label}:
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {diasEntrega.map(d => {
                const regsNoDia = checkagemMes.filter(r => r.formato === formatoSel && r.data_esperada === d.key)
                const postou = regsNoDia.filter(r => r.status === 'postou').length
                const nao = regsNoDia.filter(r => r.status === 'nao_postou').length
                const ehHoje = d.key === hojeKey()
                const selecionado = dataSel === d.key
                const corBorda = selecionado ? 'var(--accent)' : ehHoje ? 'var(--accent)' : 'var(--border)'

                return (
                  <button key={d.key} onClick={() => setDataSel(d.key)}
                    style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: selecionado ? 700 : 500, cursor: 'pointer', border: `2px solid ${corBorda}`, background: selecionado ? 'var(--accent-glow)' : 'var(--surface)', color: selecionado ? 'var(--accent)' : 'var(--text)', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 58 }}>
                    <span>{d.dia}/{mes}</span>
                    {regsNoDia.length > 0 && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {postou > 0 && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>✅{postou}</span>}
                        {nao > 0 && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>❌{nao}</span>}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Lista de checagem */}
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : (
            <ViewChecklist
              editoras={editoras}
              checkagemMes={checkagemMes}
              formato={formatoSel}
              dataKey={dataSel}
              onMarcar={handleMarcar}
              onGerarDia={handleGerarDia}
            />
          )}
        </div>
      )}

      {/* ── ABA DASHBOARD ── */}
      {aba === 'dashboard' && (
        loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : (
          <>
            {/* Gerenciar editoras (admin) */}
            {isAdmin && editoras.length > 0 && (
              <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {editoras.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12 }}>
                    <span style={{ color: 'var(--text)' }}>{e.nome}</span>
                    <button onClick={() => setModalEditora(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex' }}><Pencil size={11} /></button>
                    <button onClick={() => handleDesativar(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex', opacity: 0.5 }}><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>
            )}

            <ViewDashboard
              editoras={editoras}
              checkagemMes={checkagemMes}
              mes={mes}
              ano={ano}
              onAbrirEditora={setPainelEditora}
            />
          </>
        )
      )}

      {/* Painel lateral de editora */}
      {painelEditora && (
        <>
          <div onClick={() => setPainelEditora(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 99 }} />
          <PainelEditora
            editora={painelEditora}
            checkagemMes={checkagemMes}
            ano={ano}
            mes={mes}
            usuario={usuario}
            onClose={() => setPainelEditora(null)}
          />
        </>
      )}

      {/* Modal editora */}
      {modalEditora && (
        <ModalEditora
          editora={modalEditora === 'new' ? null : modalEditora}
          onSave={handleSalvarEditora}
          onClose={() => setModalEditora(null)}
        />
      )}

      {/* Modal importar */}
      {showImportar && (
        <ModalImportar
          onClose={() => setShowImportar(false)}
          onImported={() => { carregarEditoras(); showToast('Editoras importadas!') }}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
