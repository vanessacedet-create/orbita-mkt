import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getEditorasParceiras, createEditoraParceira, updateEditoraParceira,
  desativarEditoraParceira, importarEditorasPlanilha,
  getCheckagemMes, upsertCheckagemDia, gerarChecklistDia,
  getObservacoesEditora, createObservacao, deleteObservacao,
} from '../lib/monitoramento-editoras'
import {
  getCheckagemCriativoMes, upsertCheckagemCriativoDia,
} from '../lib/monitoramento-criativo'
import { getLivrarias } from '../lib/editoras-livrarias'
import {
  Eye, Plus, X, Upload, ChevronLeft, ChevronRight,
  Pencil, Trash2, MessageSquare, LayoutGrid, List,
  Instagram, FileSpreadsheet, Users, BookOpen,
} from 'lucide-react'
import * as XLSX from 'xlsx'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const FERIADOS_FIXOS = ['01-01','04-21','05-01','09-07','10-12','11-02','11-15','12-25']
const FERIADOS_MOVEIS = {
  2026: ['2026-02-16','2026-02-17','2026-04-03','2026-06-04'],
  2025: ['2025-03-03','2025-03-04','2025-04-18','2025-06-19'],
  2027: ['2027-02-08','2027-02-09','2027-03-26','2027-05-27'],
}

function isFeriado(ano, mes, dia) {
  const mmdd = `${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
  if (FERIADOS_FIXOS.includes(mmdd)) return true
  const key = `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
  return (FERIADOS_MOVEIS[ano] || []).includes(key)
}

function isDiaNaoUtil(ano, mes, dia) {
  const d = new Date(ano, mes - 1, dia)
  const ds = d.getDay()
  if (ds === 0 || ds === 6) return true
  if (isFeriado(ano, mes, dia)) return true
  return false
}

const FORMATOS_PARCEIRAS = [
  { value: 'story', label: 'Story' },
  { value: 'feed',  label: 'Feed' },
  { value: 'reels', label: 'Reels' },
]

const FORMATOS_CRIATIVO = [
  { value: 'story',         label: 'Story' },
  { value: 'feed',          label: 'Feed' },
  { value: 'reels_roteiro', label: 'Reels (Roteiro/Gravação)' },
  { value: 'reels_edicao',  label: 'Reels (Edição)' },
  { value: 'email_mkt',     label: 'E-mail Marketing' },
  { value: 'email_revenda', label: 'E-mail Revendas' },
]

const STATUS_PARCEIRAS = [
  { value: 'pendente',   label: 'Pendente',   cor: '#6b7280' },
  { value: 'postou',     label: 'Postou',     cor: '#22c55e' },
  { value: 'nao_postou', label: 'Não postou', cor: '#ef4444' },
]

const STATUS_CRIATIVO = [
  { value: 'pendente',   label: 'Pendente',   cor: '#6b7280' },
  { value: 'iniciado',   label: 'Iniciado',   cor: '#f59e0b' },
  { value: 'finalizado', label: 'Finalizado', cor: '#22c55e' },
]

const EQUIPE = ['Viviane', 'Sarah', 'Vanessa', 'Gabriela']
const CATEGORIAS_OBS = ['Comportamento', 'Resposta às mensagens', 'Vendas na livraria', 'Qualidade das postagens', 'Relacionamento', 'Outro']

function pad(n) { return String(n).padStart(2, '0') }
function toKey(a, m, d) { return `${a}-${pad(m)}-${pad(d)}` }
function hojeKey() { const d = new Date(); return toKey(d.getFullYear(), d.getMonth() + 1, d.getDate()) }

function diasDoMes(ano, mes) {
  const total = new Date(ano, mes, 0).getDate()
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(ano, mes - 1, i + 1)
    return { dia: i + 1, key: toKey(ano, mes, i + 1), diaSemana: d.getDay(), naoUtil: isDiaNaoUtil(ano, mes, i + 1) }
  })
}

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  return [toast, show]
}

// ── BOTÃO DE FORMATO ───────────────────────────────────────
// Usa var(--accent) para seguir a cor das configurações
function BotaoFormato({ label, ativo, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        border: '2px solid var(--accent)',
        background: ativo ? 'var(--accent)' : 'transparent',
        color: ativo ? '#fff' : 'var(--accent)',
        transition: 'all 0.15s',
      }}>
      {label}
    </button>
  )
}

// ── MODAL EDITORA ──────────────────────────────────────────
function ModalEditora({ editora, onSave, onClose }) {
  const [form, setForm] = useState({ nome: editora?.nome || '', contato: editora?.contato || '', instagram: editora?.instagram || '' })
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!form.nome.trim()) return
    setSaving(true)
    try { await onSave(form); onClose() }
    catch (e) { console.error(e) } finally { setSaving(false) }
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
          <button className="btn btn-primary" onClick={salvar} disabled={saving || !form.nome.trim()}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL IMPORTAR ─────────────────────────────────────────
function ModalImportar({ onClose, onImported }) {
  const fileRef = useRef()
  const [linhas, setLinhas] = useState([])
  const [etapa, setEtapa] = useState('upload')
  const [importando, setImportando] = useState(false)

  function baixarTemplate() {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([['Nome', 'Instagram'], ['Editora Exemplo', '@editoraexemplo']])
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
    try { await importarEditorasPlanilha(linhas); onImported(); onClose() }
    catch (e) { console.error(e) } finally { setImportando(false) }
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
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Baixe o template, preencha com as editoras e faça o upload.</p>
            <button onClick={baixarTemplate} className="btn btn-ghost" style={{ width: '100%', marginBottom: 12, justifyContent: 'center' }}>
              <FileSpreadsheet size={14} /> Baixar template .xlsx
            </button>
            <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) processar(f) }}
              style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)' }}>
              <Upload size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Clique ou arraste o arquivo .xlsx</div>
              <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) processar(f); e.target.value = '' }} />
            </div>
          </div>
        )}
        {etapa === 'revisao' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{linhas.length} editora{linhas.length !== 1 ? 's' : ''} encontrada{linhas.length !== 1 ? 's' : ''}:</p>
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
              <button className="btn btn-primary" onClick={confirmar} disabled={importando}>{importando ? 'Importando...' : `Importar ${linhas.length}`}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PAINEL LATERAL ─────────────────────────────────────────
function PainelEditora({ editora, checkagemMes, ano, mes, usuario, onClose }) {
  const [obs, setObs] = useState([])
  const [loadingObs, setLoadingObs] = useState(true)
  const [novaObs, setNovaObs] = useState({ categoria: 'Comportamento', texto: '' })
  const [salvandoObs, setSalvandoObs] = useState(false)

  useEffect(() => {
    setLoadingObs(true)
    getObservacoesEditora(editora.id).then(setObs).finally(() => setLoadingObs(false))
  }, [editora.id])

  const registros = checkagemMes.filter(r => r.editora_id === editora.id)
  const postou = registros.filter(r => r.status === 'postou').length
  const naoPostou = registros.filter(r => r.status === 'nao_postou').length
  const pendente = registros.filter(r => r.status === 'pendente').length
  const total = registros.length
  const pct = total > 0 ? Math.round((postou / total) * 100) : 0
  const corSaude = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'

  async function salvarObs() {
    if (!novaObs.texto.trim()) return
    setSalvandoObs(true)
    try {
      const nova = await createObservacao({ ...novaObs, editora_id: editora.id, criado_por: usuario?.id })
      setObs(prev => [nova, ...prev])
      setNovaObs(f => ({ ...f, texto: '' }))
    } catch (e) { console.error(e) } finally { setSalvandoObs(false) }
  }

  async function excluirObs(id) {
    if (!window.confirm('Excluir observação?')) return
    await deleteObservacao(id)
    setObs(prev => prev.filter(o => o.id !== id))
  }

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: 'var(--surface)', borderLeft: '1px solid var(--border)', zIndex: 100, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.2)' }}>
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
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{MESES[mes - 1]} {ano}</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            {[{ n: postou, l: 'Postou', c: '#22c55e' }, { n: naoPostou, l: 'Não postou', c: '#ef4444' }, { n: pendente, l: 'Pendente', c: '#6b7280' }].map(({ n, l, c }) => (
              <div key={l} style={{ flex: 1, textAlign: 'center', background: 'var(--surface-2)', borderRadius: 8, padding: '8px 4px' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{n}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l}</div>
              </div>
            ))}
          </div>
          {total > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                <span>Taxa de postagem</span>
                <span style={{ color: corSaude, fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-3)' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: corSaude, borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Observações</div>
          <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <select className="form-select" value={novaObs.categoria} onChange={e => setNovaObs(f => ({ ...f, categoria: e.target.value }))} style={{ marginBottom: 8, fontSize: 12 }}>
              {CATEGORIAS_OBS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea className="form-textarea" rows={2} value={novaObs.texto} onChange={e => setNovaObs(f => ({ ...f, texto: e.target.value }))} placeholder="Escreva uma observação..." style={{ marginBottom: 8, fontSize: 12 }} />
            <button className="btn btn-primary btn-sm" onClick={salvarObs} disabled={salvandoObs || !novaObs.texto.trim()}>
              <MessageSquare size={12} /> Registrar
            </button>
          </div>
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

// ── SELETOR DE DIAS ────────────────────────────────────────
function SeletorDias({ dias, mes, dataSel, onSelect, indicadores }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {dias.map(d => {
          const selecionado = dataSel === d.key
          const ehHoje = d.key === hojeKey()
          const ind = indicadores?.[d.key] || {}
          return (
            <button key={d.key} onClick={() => !d.naoUtil && onSelect(d.key)} disabled={d.naoUtil}
              style={{
                padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: selecionado ? 700 : 500,
                cursor: d.naoUtil ? 'not-allowed' : 'pointer',
                border: `2px solid ${selecionado ? 'var(--accent)' : ehHoje && !d.naoUtil ? 'var(--accent)' : 'var(--border)'}`,
                background: d.naoUtil ? 'var(--surface-2)' : selecionado ? 'var(--accent-glow)' : 'var(--surface)',
                color: d.naoUtil ? 'var(--text-muted)' : selecionado ? 'var(--accent)' : 'var(--text)',
                opacity: d.naoUtil ? 0.45 : 1, transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 52,
              }}>
              <span>{d.dia}/{mes}</span>
              {ind.total > 0 && (
                <div style={{ display: 'flex', gap: 3 }}>
                  {ind.ok > 0 && <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 700 }}>●{ind.ok}</span>}
                  {ind.nok > 0 && <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>●{ind.nok}</span>}
                  {ind.ini > 0 && <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>●{ind.ini}</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── CHECKLIST LIVRARIAS DE ED. PARCEIRAS ───────────────────
function ViewChecklistParceiras({ livrarias, checkagemMes, formato, dataKey, onMarcar, onGerarDia }) {
  const registrosDoDia = checkagemMes.filter(r => r.formato === formato && r.data_esperada === dataKey)
  const mapa = {}
  for (const r of registrosDoDia) mapa[r.editora_id] = r
  // Usa editora_id da livraria como chave de identificação no monitoramento
  const semRegistro = livrarias.filter(l => !mapa[l.editora_id])
  const [gerando, setGerando] = useState(false)

  async function gerar() {
    setGerando(true)
    try { await onGerarDia() } finally { setGerando(false) }
  }

  if (livrarias.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0', fontSize: 13 }}>Nenhuma livraria cadastrada ainda.</div>
  }

  return (
    <div>
      {semRegistro.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{semRegistro.length} livraria{semRegistro.length !== 1 ? 's' : ''} sem checagem neste dia.</span>
          <button className="btn btn-primary btn-sm" onClick={gerar} disabled={gerando}>{gerando ? 'Gerando...' : 'Gerar checklist para todas'}</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {livrarias.map(livraria => {
          const reg = mapa[livraria.editora_id]
          const status = reg?.status || null
          return (
            <div key={livraria.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{livraria.nome}</div>
                {livraria.instagram && (
                  <a href={`https://instagram.com/${livraria.instagram.replace('@', '')}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Instagram size={10} /> {livraria.instagram}
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {STATUS_PARCEIRAS.map(s => (
                  <button key={s.value} onClick={() => onMarcar({ editora: { id: livraria.editora_id }, formato, dataKey, status: s.value })}
                    style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${s.cor}`, background: status === s.value ? s.cor : 'transparent', color: status === s.value ? '#fff' : s.cor, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                    {s.label}
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

// ── CHECKLIST EQUIPE CEDET ─────────────────────────────────
function ViewChecklistCriativo({ livrarias, checkagemCriativo, formato, dataKey, onMarcar }) {
  const registrosDoDia = checkagemCriativo.filter(r => r.formato === formato && r.data_esperada === dataKey)
  const mapa = {}
  for (const r of registrosDoDia) mapa[r.editora_id] = r

  if (livrarias.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0', fontSize: 13 }}>Nenhuma livraria cadastrada ainda.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {livrarias.map(livraria => {
        const reg = mapa[livraria.editora_id]
        const status = reg?.status || 'pendente'
        const responsavel = reg?.responsavel || ''

        return (
          <div key={livraria.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{livraria.nome}</div>
              {livraria.instagram && (
                <a href={`https://instagram.com/${livraria.instagram.replace('@', '')}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Instagram size={10} /> {livraria.instagram}
                </a>
              )}
            </div>
            <div style={{ minWidth: 140 }}>
              <select value={responsavel}
                onChange={e => onMarcar({ editora: { id: livraria.editora_id }, formato, dataKey, status, responsavel: e.target.value })}
                style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)', background: responsavel ? 'var(--accent-glow)' : 'var(--surface-2)', color: responsavel ? 'var(--accent)' : 'var(--text-muted)', fontWeight: responsavel ? 700 : 400, cursor: 'pointer', width: '100%' }}>
                <option value="">Responsável...</option>
                {EQUIPE.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {STATUS_CRIATIVO.map(s => (
                <button key={s.value} onClick={() => onMarcar({ editora: { id: livraria.editora_id }, formato, dataKey, status: s.value, responsavel })}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${s.cor}`, background: status === s.value ? s.cor : 'transparent', color: status === s.value ? '#fff' : s.cor, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── DASHBOARD ──────────────────────────────────────────────
function ViewDashboard({ livrarias, checkagemMes, mes, ano, onAbrirEditora }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
      {livrarias.map(livraria => {
        const regs = checkagemMes.filter(r => r.editora_id === livraria.editora_id)
        const postou = regs.filter(r => r.status === 'postou').length
        const naoPostou = regs.filter(r => r.status === 'nao_postou').length
        const pendente = regs.filter(r => r.status === 'pendente').length
        const total = regs.length
        const pct = total > 0 ? Math.round((postou / total) * 100) : null
        const corSaude = pct === null ? '#6b7280' : pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'
        const labelSaude = pct === null ? 'Sem dados' : pct >= 70 ? 'Boa' : pct >= 40 ? 'Regular' : 'Crítica'

        return (
          <div key={livraria.id}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s', borderTop: `3px solid ${corSaude}` }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.borderTopColor = corSaude }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{livraria.nome}</div>
                {livraria.instagram && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Instagram size={10} /> {livraria.instagram}
                  </div>
                )}
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
  const [abaMonitor, setAbaMonitor] = useState('parceiras')
  const [abaView, setAbaView] = useState('checklist')

  const [editoras, setEditoras] = useState([])
  const [livrarias, setLivrarias] = useState([])

  const [checkagemMes, setCheckagemMes] = useState([])
  const [formatoSel, setFormatoSel] = useState('story')
  const [dataSel, setDataSel] = useState(hojeKey())

  const [checkagemCriativo, setCheckagemCriativo] = useState([])
  const [formatoCriativoSel, setFormatoCriativoSel] = useState('story')
  const [dataCriativoSel, setDataCriativoSel] = useState(hojeKey())

  const [loading, setLoading] = useState(true)
  const [painelEditora, setPainelEditora] = useState(null)
  const [modalEditora, setModalEditora] = useState(null)
  const [showImportar, setShowImportar] = useState(false)
  const [toast, showToast] = useToast()

  const dias = diasDoMes(ano, mes)

  useEffect(() => { carregarDados() }, [])
  useEffect(() => { carregarCheckagemMes() }, [ano, mes])
  useEffect(() => { carregarCheckagemCriativo() }, [ano, mes])

  async function carregarDados() {
    try {
      const [eds, livs] = await Promise.all([getEditorasParceiras(), getLivrarias()])
      setEditoras(eds)
      // Apenas livrarias que têm editora vinculada
      setLivrarias(livs.filter(l => l.editora_id))
    } catch (e) { console.error(e) }
  }

  async function carregarCheckagemMes() {
    setLoading(true)
    try { setCheckagemMes(await getCheckagemMes({ ano, mes })) }
    catch (e) { console.error(e) } finally { setLoading(false) }
  }

  async function carregarCheckagemCriativo() {
    try { setCheckagemCriativo(await getCheckagemCriativoMes({ ano, mes })) }
    catch (e) { console.error(e) }
  }

  function navMes(d) {
    let nm = mes + d, na = ano
    if (nm > 12) { nm = 1; na++ }
    if (nm < 1) { nm = 12; na-- }
    setMes(nm); setAno(na)
  }

  function indicadoresParceiras(formato) {
    const ind = {}
    for (const d of dias) {
      const regs = checkagemMes.filter(r => r.formato === formato && r.data_esperada === d.key)
      if (regs.length > 0) ind[d.key] = { total: regs.length, ok: regs.filter(r => r.status === 'postou').length, nok: regs.filter(r => r.status === 'nao_postou').length, ini: 0 }
    }
    return ind
  }

  function indicadoresCriativo(formato) {
    const ind = {}
    for (const d of dias) {
      const regs = checkagemCriativo.filter(r => r.formato === formato && r.data_esperada === d.key)
      if (regs.length > 0) ind[d.key] = { total: regs.length, ok: regs.filter(r => r.status === 'finalizado').length, nok: 0, ini: regs.filter(r => r.status === 'iniciado').length }
    }
    return ind
  }

  async function handleMarcarParceira({ editora, formato, dataKey, status }) {
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
      // Gera checklist para todas as editoras vinculadas às livrarias
      const editorasParaGerar = livrarias.map(l => ({ id: l.editora_id }))
      const novos = await gerarChecklistDia({ editoras: editorasParaGerar, formato: formatoSel, data_esperada: dataSel })
      setCheckagemMes(prev => {
        const mapa = {}
        for (const r of prev) mapa[`${r.editora_id}-${r.formato}-${r.data_esperada}`] = r
        for (const r of novos) mapa[`${r.editora_id}-${r.formato}-${r.data_esperada}`] = r
        return Object.values(mapa)
      })
      showToast('Checklist gerado!')
    } catch (e) { console.error(e); showToast('Erro ao gerar', 'error') }
  }

  async function handleMarcarCriativo({ editora, formato, dataKey, status, responsavel }) {
    try {
      const reg = await upsertCheckagemCriativoDia({ editora_id: editora.id, formato, data_esperada: dataKey, status, responsavel })
      setCheckagemCriativo(prev => {
        const idx = prev.findIndex(r => r.editora_id === editora.id && r.formato === formato && r.data_esperada === dataKey)
        if (idx >= 0) { const n = [...prev]; n[idx] = reg; return n }
        return [...prev, reg]
      })
    } catch (e) { console.error(e); showToast('Erro ao salvar', 'error') }
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

  const totalPostou = checkagemMes.filter(r => r.status === 'postou').length
  const totalNao    = checkagemMes.filter(r => r.status === 'nao_postou').length
  const totalPend   = checkagemMes.filter(r => r.status === 'pendente').length
  const totalFinalizado = checkagemCriativo.filter(r => r.status === 'finalizado').length
  const totalIniciado   = checkagemCriativo.filter(r => r.status === 'iniciado').length
  const totalPendCriat  = checkagemCriativo.filter(r => r.status === 'pendente').length

  function tabStyle(ativa) {
    return { padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', borderBottom: ativa ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', color: ativa ? 'var(--accent)' : 'var(--text-muted)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Eye size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Monitoramento</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {livrarias.length} livrarias · {MESES[mes - 1]} {ano}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {abaMonitor === 'parceiras' ? (
            <div style={{ display: 'flex', gap: 14 }}>
              {[{ n: totalPostou, l: 'Postaram', c: '#22c55e' }, { n: totalNao, l: 'Não postaram', c: '#ef4444' }, { n: totalPend, l: 'Pendentes', c: '#6b7280' }].map(({ n, l, c }) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: c, lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 14 }}>
              {[{ n: totalFinalizado, l: 'Finalizados', c: '#22c55e' }, { n: totalIniciado, l: 'Iniciados', c: '#f59e0b' }, { n: totalPendCriat, l: 'Pendentes', c: '#6b7280' }].map(({ n, l, c }) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: c, lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          )}

          {isAdmin && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowImportar(true)}><Upload size={13} /> Importar editoras</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalEditora('new')}><Plus size={13} /> Nova editora</button>
            </>
          )}

          {abaMonitor === 'parceiras' && (
            <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => setAbaView('checklist')} style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: abaView === 'checklist' ? 'var(--accent)' : 'transparent', color: abaView === 'checklist' ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <List size={13} /> Checklist
              </button>
              <button onClick={() => setAbaView('dashboard')} style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: abaView === 'dashboard' ? 'var(--accent)' : 'transparent', color: abaView === 'dashboard' ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <LayoutGrid size={13} /> Dashboard
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <button style={tabStyle(abaMonitor === 'parceiras')} onClick={() => setAbaMonitor('parceiras')}>
          <BookOpen size={14} /> Livrarias de ed. parceiras
        </button>
        <button style={tabStyle(abaMonitor === 'criativo')} onClick={() => setAbaMonitor('criativo')}>
          <Users size={14} /> Equipe Cedet
        </button>
      </div>

      {/* Navegação de mês */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 20px' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navMes(-1)}><ChevronLeft size={18} /></button>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', minWidth: 180, textAlign: 'center' }}>{MESES[mes - 1]} {ano}</span>
        <button className="btn btn-ghost btn-icon" onClick={() => navMes(1)}><ChevronRight size={18} /></button>
      </div>

      {/* ABA: LIVRARIAS DE ED. PARCEIRAS */}
      {abaMonitor === 'parceiras' && (
        <>
          {abaView === 'checklist' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {FORMATOS_PARCEIRAS.map(fmt => (
                  <BotaoFormato key={fmt.value} label={fmt.label} ativo={formatoSel === fmt.value} onClick={() => setFormatoSel(fmt.value)} />
                ))}
              </div>
              <SeletorDias dias={dias} mes={mes} dataSel={dataSel} onSelect={setDataSel} indicadores={indicadoresParceiras(formatoSel)} />
              {loading ? <div className="loading"><div className="spinner" /></div> : (
                <ViewChecklistParceiras livrarias={livrarias} checkagemMes={checkagemMes} formato={formatoSel} dataKey={dataSel} onMarcar={handleMarcarParceira} onGerarDia={handleGerarDia} />
              )}
            </div>
          )}
          {abaView === 'dashboard' && (
            loading ? <div className="loading"><div className="spinner" /></div> : (
              <ViewDashboard livrarias={livrarias} checkagemMes={checkagemMes} mes={mes} ano={ano} onAbrirEditora={setPainelEditora} />
            )
          )}
        </>
      )}

      {/* ABA: EQUIPE CEDET */}
      {abaMonitor === 'criativo' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {FORMATOS_CRIATIVO.map(fmt => (
              <BotaoFormato key={fmt.value} label={fmt.label} ativo={formatoCriativoSel === fmt.value} onClick={() => setFormatoCriativoSel(fmt.value)} />
            ))}
          </div>
          <SeletorDias dias={dias} mes={mes} dataSel={dataCriativoSel} onSelect={setDataCriativoSel} indicadores={indicadoresCriativo(formatoCriativoSel)} />
          <ViewChecklistCriativo livrarias={livrarias} checkagemCriativo={checkagemCriativo} formato={formatoCriativoSel} dataKey={dataCriativoSel} onMarcar={handleMarcarCriativo} />
        </div>
      )}

      {painelEditora && (
        <>
          <div onClick={() => setPainelEditora(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 99 }} />
          <PainelEditora editora={painelEditora} checkagemMes={checkagemMes} ano={ano} mes={mes} usuario={usuario} onClose={() => setPainelEditora(null)} />
        </>
      )}

      {modalEditora && (
        <ModalEditora editora={modalEditora === 'new' ? null : modalEditora} onSave={handleSalvarEditora} onClose={() => setModalEditora(null)} />
      )}

      {showImportar && (
        <ModalImportar onClose={() => setShowImportar(false)} onImported={() => { carregarDados(); showToast('Editoras importadas!') }} />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
