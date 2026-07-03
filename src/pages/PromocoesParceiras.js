import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getPromocoes, getPromocao, createPromocao, updatePromocao, desativarPromocao,
  getCampanhasPromocao, createCampanhaPromocao, updateCampanhaPromocao, desativarCampanhaPromocao,
  getTodasCampanhasPromocao,
  getParticipantesCampanha, upsertParticipante, removerParticipante,
  selecionarTodosParticipantes, removerTodosParticipantes, setEscopoParticipante,
  getLivrosParticipante, importarLivrosParticipante, removerLivroParticipante,
  TIPOS_PROMOCAO, CANAIS_PROMOCAO, STATUS_PROMOCAO, STATUS_PARTICIPACAO,
  tipoInfo, statusPromocaoInfo, statusParticipacaoInfo, promocaoNoPeriodo,
} from '../lib/promocoes-parceiras'
import { getEditorasParceirasAtivas, getLivrariasParceirasAtivas } from '../lib/crm-editoras-parceiras'
import { getUsuarios } from '../lib/supabase'
import * as XLSX from 'xlsx'
import {
  Megaphone, Plus, X, ChevronLeft, Pencil, Trash2, Search, Upload,
  Building2, Library, Printer, LayoutList, GanttChartSquare,
} from 'lucide-react'

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  return [toast, show]
}

function fmtData(d) {
  if (!d) return null
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// ── MODAL PROMOÇÃO ──────────────────────────────────────────
function ModalPromocao({ promocao, onSave, onClose }) {
  const [form, setForm] = useState({
    titulo: promocao?.titulo || '',
    tipo: promocao?.tipo || 'promocao',
    canal: promocao?.canal || 'livraria',
    data_inicio: promocao?.data_inicio || '',
    data_fim: promocao?.data_fim || '',
    status: promocao?.status || 'planejada',
    observacao: promocao?.observacao || '',
  })
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!form.titulo.trim()) return
    setSaving(true)
    try { await onSave(form); onClose() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">{promocao ? 'Editar promoção' : 'Nova promoção'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-group">
          <label className="form-label">Título *</label>
          <input className="form-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Promoção de Junho" autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
              {TIPOS_PROMOCAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Canal</label>
            <select className="form-select" value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))}>
              {CANAIS_PROMOCAO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Início</label>
            <input className="form-input" type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Fim</label>
            <input className="form-input" type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
          </div>
        </div>
        {promocao && (
          <div className="form-group">
            <label className="form-label">Status</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_PROMOCAO.map(s => (
                <button key={s.value} type="button" onClick={() => setForm(f => ({ ...f, status: s.value }))}
                  style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${s.cor}`, background: form.status === s.value ? s.cor : 'transparent', color: form.status === s.value ? '#fff' : s.cor }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Observação (opcional)</label>
          <textarea className="form-textarea" rows={2} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving || !form.titulo.trim()}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL CAMPANHA ───────────────────────────────────────────
function ModalCampanha({ campanha, onSave, onClose }) {
  const [form, setForm] = useState({
    titulo: campanha?.titulo || '',
    tipo_participante: campanha?.tipo_participante || 'livraria',
    data_inicio: campanha?.data_inicio || '',
    data_fim: campanha?.data_fim || '',
    status: campanha?.status || 'planejada',
    observacao: campanha?.observacao || '',
  })
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!form.titulo.trim()) return
    setSaving(true)
    try { await onSave(form); onClose() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">{campanha ? 'Editar campanha' : 'Nova campanha'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-group">
          <label className="form-label">Título *</label>
          <input className="form-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Dia dos Namorados" autoFocus />
        </div>
        {!campanha && (
          <div className="form-group">
            <label className="form-label">Participantes desta campanha</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setForm(f => ({ ...f, tipo_participante: 'livraria' }))}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '2px solid var(--accent)', background: form.tipo_participante === 'livraria' ? 'var(--accent)' : 'transparent', color: form.tipo_participante === 'livraria' ? '#fff' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Library size={14} /> Livrarias
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, tipo_participante: 'editora' }))}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '2px solid var(--accent)', background: form.tipo_participante === 'editora' ? 'var(--accent)' : 'transparent', color: form.tipo_participante === 'editora' ? '#fff' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Building2 size={14} /> Editoras
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Não dá para mudar depois de criada.</div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Início</label>
            <input className="form-input" type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Fim</label>
            <input className="form-input" type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
          </div>
        </div>
        {campanha && (
          <div className="form-group">
            <label className="form-label">Status</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_PROMOCAO.map(s => (
                <button key={s.value} type="button" onClick={() => setForm(f => ({ ...f, status: s.value }))}
                  style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${s.cor}`, background: form.status === s.value ? s.cor : 'transparent', color: form.status === s.value ? '#fff' : s.cor }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Observação (opcional)</label>
          <textarea className="form-textarea" rows={2} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving || !form.titulo.trim()}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL IMPORTAR LIVROS PONTUAIS ──────────────────────────
function ModalImportarLivros({ participante, onImport, onClose }) {
  const fileRef = useRef()
  const [titulos, setTitulos] = useState([])
  const [importando, setImportando] = useState(false)

  function processarArquivo(file) {
    const reader = new FileReader()
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const inicio = String(rows[0]?.[0] ?? '').trim().toLowerCase()
      const comeco = ['titulo', 'título', 'livro', 'nome'].includes(inicio) ? 1 : 0
      const lista = rows.slice(comeco).map(r => String(r[0] ?? '').trim()).filter(Boolean)
      setTitulos(lista)
    }
    reader.readAsArrayBuffer(file)
  }

  async function confirmar() {
    setImportando(true)
    try { await onImport(titulos); onClose() }
    catch (e) { console.error(e) } finally { setImportando(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">Importar títulos — {participante}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Planilha .xlsx com uma coluna de títulos (com ou sem cabeçalho).</p>
        <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '24px 20px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)', marginBottom: 14 }}>
          <Upload size={22} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Clique para selecionar o arquivo .xlsx</div>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) processarArquivo(f); e.target.value = '' }} />
        </div>
        {titulos.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{titulos.length} título{titulos.length !== 1 ? 's' : ''} encontrado{titulos.length !== 1 ? 's' : ''}:</div>
            <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
              {titulos.map((t, i) => <div key={i} style={{ padding: '2px 0' }}>{t}</div>)}
            </div>
          </div>
        )}
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          {titulos.length > 0 && <button className="btn btn-primary" onClick={confirmar} disabled={importando}>{importando ? 'Importando...' : `Adicionar ${titulos.length}`}</button>}
        </div>
      </div>
    </div>
  )
}

// ── DETALHE CAMPANHA — PARTICIPANTES ────────────────────────
function DetalheCampanha({ campanha, onBack, showToast, onCampanhaAtualizada }) {
  const [participantes, setParticipantes] = useState([])
  const [candidatos, setCandidatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalEdicao, setModalEdicao] = useState(false)
  const [modalLivros, setModalLivros] = useState(null) // participante obj
  const [livrosPorParticipante, setLivrosPorParticipante] = useState({})

  const isEditora = campanha.tipo_participante === 'editora'

  useEffect(() => { carregar() }, [campanha.id])

  async function carregar() {
    setLoading(true)
    try {
      const [parts, cands] = await Promise.all([
        getParticipantesCampanha(campanha.id),
        isEditora ? getEditorasParceirasAtivas() : getLivrariasParceirasAtivas(),
      ])
      setParticipantes(parts)
      setCandidatos(cands)
    } catch (e) { console.error(e); showToast('Erro ao carregar participantes.', 'error') }
    finally { setLoading(false) }
  }

  function participacaoDe(id) {
    return participantes.find(p => (isEditora ? p.editora_id : p.livraria_id) === id)
  }

  async function alterarStatus(id, status) {
    try {
      const upd = await upsertParticipante(campanha.id, { [isEditora ? 'editora_id' : 'livraria_id']: id, status })
      setParticipantes(prev => {
        const idx = prev.findIndex(p => p.id === upd.id)
        if (idx >= 0) { const n = [...prev]; n[idx] = upd; return n }
        return [...prev, upd]
      })
    } catch (e) { console.error(e); showToast('Erro ao salvar', 'error') }
  }

  async function marcarNaoSeAplica(participacao) {
    if (!participacao) return
    try { await removerParticipante(participacao.id); setParticipantes(prev => prev.filter(p => p.id !== participacao.id)) }
    catch (e) { console.error(e); showToast('Erro ao remover', 'error') }
  }

  async function selecionarTodas() {
    try {
      const ids = candidatos.map(c => c.id)
      const novos = await selecionarTodosParticipantes(campanha.id, isEditora ? 'editora' : 'livraria', ids)
      setParticipantes(novos)
      showToast('Todas selecionadas!')
    } catch (e) { console.error(e); showToast('Erro ao selecionar todas', 'error') }
  }

  async function removerTodas() {
    if (!window.confirm('Remover todas as participações desta campanha?')) return
    try { await removerTodosParticipantes(campanha.id); setParticipantes([]); showToast('Removidas.') }
    catch (e) { console.error(e); showToast('Erro ao remover', 'error') }
  }

  async function alternarEscopo(participacao) {
    const novoEscopo = participacao.escopo === 'livros_pontuais' ? 'todos_produtos' : 'livros_pontuais'
    try {
      const upd = await setEscopoParticipante(participacao.id, novoEscopo)
      setParticipantes(prev => prev.map(p => p.id === upd.id ? upd : p))
      if (novoEscopo === 'livros_pontuais') carregarLivros(participacao.id)
    } catch (e) { console.error(e); showToast('Erro ao alterar', 'error') }
  }

  async function carregarLivros(participante_id) {
    try { const livros = await getLivrosParticipante(participante_id); setLivrosPorParticipante(prev => ({ ...prev, [participante_id]: livros })) }
    catch (e) { console.error(e) }
  }

  async function handleImportarLivros(participante_id, titulos) {
    await importarLivrosParticipante(participante_id, titulos)
    await carregarLivros(participante_id)
    showToast('Títulos importados!')
  }

  async function excluirLivro(participante_id, livro_id) {
    await removerLivroParticipante(livro_id)
    await carregarLivros(participante_id)
  }

  const candidatosFiltrados = candidatos.filter(c => !search || c.nome.toLowerCase().includes(search.toLowerCase()))
  const sInfo = statusPromocaoInfo(campanha.status)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn btn-ghost btn-icon" onClick={onBack}><ChevronLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title" style={{ margin: 0 }}>{campanha.titulo}</h1>
            <span style={{ fontSize: 11, fontWeight: 700, color: sInfo.cor, background: sInfo.bg, padding: '2px 10px', borderRadius: 20 }}>{sInfo.label}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {isEditora ? 'Editoras' : 'Livrarias'} · {campanha.data_inicio ? fmtData(campanha.data_inicio) : '—'}{campanha.data_fim ? ` até ${fmtData(campanha.data_fim)}` : ''}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => setModalEdicao(true)}><Pencil size={14} /> Editar</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="search-input" style={{ paddingLeft: 32, width: '100%' }} placeholder={`Buscar ${isEditora ? 'editora' : 'livraria'}...`} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={selecionarTodas}>Selecionar todas</button>
        <button className="btn btn-ghost btn-sm" onClick={removerTodas}>Remover todas</button>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div className="table-card">
          <table>
            <thead><tr><th>{isEditora ? 'Editora' : 'Livraria'}</th><th style={{ minWidth: 300 }}>Status</th><th>Produtos</th></tr></thead>
            <tbody>
              {candidatosFiltrados.length === 0
                ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>Nenhuma encontrada.</td></tr>
                : candidatosFiltrados.map(c => {
                    const part = participacaoDe(c.id)
                    const statusAtual = part?.status || null
                    return (
                      <tr key={c.id}>
                        <td className="td-strong">{c.nome}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => marcarNaoSeAplica(part)}
                              style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '2px solid var(--border)', background: !statusAtual ? 'var(--border)' : 'transparent', color: !statusAtual ? 'var(--text)' : 'var(--text-muted)' }}>
                              Não se aplica
                            </button>
                            {STATUS_PARTICIPACAO.map(s => (
                              <button key={s.value} onClick={() => alterarStatus(c.id, s.value)}
                                style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${s.cor}`, background: statusAtual === s.value ? s.cor : 'transparent', color: statusAtual === s.value ? '#fff' : s.cor }}>
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          {part && (
                            <div>
                              <button className="btn btn-ghost btn-sm" onClick={() => alternarEscopo(part)} style={{ fontSize: 11 }}>
                                {part.escopo === 'livros_pontuais' ? 'Livros pontuais' : 'Toda a livraria'}
                              </button>
                              {part.escopo === 'livros_pontuais' && (
                                <div style={{ marginTop: 6 }}>
                                  <button className="btn btn-ghost btn-sm" onClick={() => { setModalLivros(part); carregarLivros(part.id) }} style={{ fontSize: 11 }}>
                                    <Upload size={11} /> Planilha ({(livrosPorParticipante[part.id] || []).length})
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      )}

      {modalEdicao && (
        <ModalCampanha campanha={campanha} onSave={async form => { const upd = await updateCampanhaPromocao(campanha.id, form); onCampanhaAtualizada(upd); showToast('Campanha atualizada!') }} onClose={() => setModalEdicao(false)} />
      )}
      {modalLivros && (
        <ModalImportarLivros participante={modalLivros.editoras_parceiras?.nome || modalLivros.livrarias?.nome || ''}
          onImport={titulos => handleImportarLivros(modalLivros.id, titulos)} onClose={() => setModalLivros(null)} />
      )}
      {modalLivros && (livrosPorParticipante[modalLivros.id] || []).length > 0 && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, maxWidth: 260, zIndex: 50 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Títulos importados</div>
          {(livrosPorParticipante[modalLivros.id] || []).map(l => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '3px 0' }}>
              <span>{l.titulo}</span>
              <button onClick={() => excluirLivro(modalLivros.id, l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={11} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── DETALHE PROMOÇÃO — CAMPANHAS ────────────────────────────
function DetalhePromocao({ promocao, onBack, showToast, usuarios }) {
  const { usuario } = useAuth()
  const [campanhas, setCampanhas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalCampanha, setModalCampanha] = useState(null)
  const [modalEdicao, setModalEdicao] = useState(false)
  const [detalheCampanha, setDetalheCampanha] = useState(null)
  const [promocaoAtual, setPromocaoAtual] = useState(promocao)

  useEffect(() => { carregar() }, [promocao.id])

  async function carregar() {
    setLoading(true)
    try { setCampanhas(await getCampanhasPromocao(promocao.id)) }
    catch { showToast('Erro ao carregar campanhas.', 'error') }
    finally { setLoading(false) }
  }

  async function salvarCampanha(form) {
    try {
      if (modalCampanha === 'new') { await createCampanhaPromocao(promocao.id, { ...form, criado_por: usuario?.id }); showToast('Campanha criada!') }
      else { await updateCampanhaPromocao(modalCampanha.id, form); showToast('Campanha atualizada!') }
      await carregar()
    } catch { showToast('Erro ao salvar campanha.', 'error') }
  }

  async function excluirCampanha(c) {
    if (!window.confirm(`Remover a campanha "${c.titulo}"?`)) return
    try { await desativarCampanhaPromocao(c.id); setCampanhas(prev => prev.filter(x => x.id !== c.id)); showToast('Campanha removida.') }
    catch { showToast('Erro ao remover.', 'error') }
  }

  async function salvarPromocao(form) {
    try { const upd = await updatePromocao(promocao.id, form); setPromocaoAtual(upd); showToast('Promoção atualizada!') }
    catch { showToast('Erro ao salvar promoção.', 'error') }
  }

  if (detalheCampanha) {
    return <DetalheCampanha campanha={detalheCampanha} onBack={() => setDetalheCampanha(null)} showToast={showToast}
      onCampanhaAtualizada={upd => { setCampanhas(prev => prev.map(c => c.id === upd.id ? upd : c)); setDetalheCampanha(upd) }} />
  }

  const tInfo = tipoInfo(promocaoAtual.tipo)
  const sInfo = statusPromocaoInfo(promocaoAtual.status)
  const canalInfo = CANAIS_PROMOCAO.find(c => c.value === promocaoAtual.canal)
  const criador = usuarios.find(u => u.id === promocaoAtual.criado_por)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-icon" onClick={onBack}><ChevronLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>{promocaoAtual.titulo}</h1>
            <span style={{ fontSize: 11, fontWeight: 700, color: tInfo.cor, background: tInfo.bg, padding: '2px 10px', borderRadius: 20 }}>{tInfo.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: sInfo.cor, background: sInfo.bg, padding: '2px 10px', borderRadius: 20 }}>{sInfo.label}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {promocaoAtual.data_inicio ? fmtData(promocaoAtual.data_inicio) : '—'}{promocaoAtual.data_fim ? ` até ${fmtData(promocaoAtual.data_fim)}` : ''}
            {' · '}{canalInfo?.label}
            {criador ? ` · Criada por ${criador.nome}` : ''}
          </p>
          {promocaoAtual.observacao && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>{promocaoAtual.observacao}</p>}
        </div>
        <button className="btn btn-ghost" onClick={() => setModalEdicao(true)}><Pencil size={14} /> Editar</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Campanhas ({campanhas.length})</span>
        <button className="btn btn-primary btn-sm" onClick={() => setModalCampanha('new')}><Plus size={13} /> Nova campanha</button>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div>
      : campanhas.length === 0 ? (
        <div className="empty-state"><p>Nenhuma campanha cadastrada ainda nesta promoção.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
          {campanhas.map(c => {
            const cs = statusPromocaoInfo(c.status)
            return (
              <div key={c.id} className="table-card" style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setDetalheCampanha(c)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{c.titulo}</div>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={e => { e.stopPropagation(); excluirCampanha(c) }}><Trash2 size={12} /></button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: cs.cor, background: cs.bg, padding: '2px 8px', borderRadius: 20 }}>{cs.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {c.tipo_participante === 'editora' ? <Building2 size={11} /> : <Library size={11} />}
                    {c.tipo_participante === 'editora' ? 'Editoras' : 'Livrarias'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {c.data_inicio ? fmtData(c.data_inicio) : '—'}{c.data_fim ? ` até ${fmtData(c.data_fim)}` : ''}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalCampanha && <ModalCampanha campanha={modalCampanha === 'new' ? null : modalCampanha} onSave={salvarCampanha} onClose={() => setModalCampanha(null)} />}
      {modalEdicao && <ModalPromocao promocao={promocaoAtual} onSave={salvarPromocao} onClose={() => setModalEdicao(false)} />}
    </div>
  )
}

// ── LINHA DO TEMPO ───────────────────────────────────────────
function diasDesde1970(dataStr) { return Math.floor(new Date(dataStr + 'T00:00:00').getTime() / 86400000) }

function calcularBarra(dataInicio, dataFim, rangeInicio, rangeFim) {
  const totalDias = diasDesde1970(rangeFim) - diasDesde1970(rangeInicio) + 1
  const ini = Math.max(diasDesde1970(dataInicio || rangeInicio), diasDesde1970(rangeInicio))
  const fim = Math.min(diasDesde1970(dataFim || dataInicio || rangeFim), diasDesde1970(rangeFim))
  if (fim < ini) return null
  const leftPct = ((ini - diasDesde1970(rangeInicio)) / totalDias) * 100
  const widthPct = Math.max(((fim - ini + 1) / totalDias) * 100, 0.6)
  return { leftPct, widthPct }
}

function ViewLinhaTempo({ promocoes, campanhasPorPromocao, ano, semestre }) {
  const rangeInicio = semestre === 0 ? `${ano}-01-01` : semestre === 1 ? `${ano}-01-01` : `${ano}-07-01`
  const rangeFim = semestre === 0 ? `${ano}-12-31` : semestre === 1 ? `${ano}-06-30` : `${ano}-12-31`
  const mesInicial = semestre === 2 ? 6 : 0
  const totalMeses = semestre === 0 ? 12 : 6
  const meses = Array.from({ length: totalMeses }, (_, i) => MESES_ABREV[mesInicial + i])

  return (
    <div>
      <div style={{ display: 'flex', paddingLeft: 200, marginBottom: 6 }}>
        {meses.map(m => (
          <div key={m} style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', borderLeft: '1px solid var(--border)', padding: '4px 0' }}>{m}</div>
        ))}
      </div>
      {promocoes.length === 0 ? (
        <div className="empty-state"><p>Nenhuma promoção neste período.</p></div>
      ) : promocoes.map(p => {
        const barraPromo = calcularBarra(p.data_inicio, p.data_fim, rangeInicio, rangeFim)
        const tInfo = tipoInfo(p.tipo)
        const campanhas = campanhasPorPromocao[p.id] || []
        return (
          <div key={p.id} style={{ display: 'flex', marginBottom: 10 }}>
            <div style={{ width: 200, flexShrink: 0, paddingRight: 10, fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.titulo}>{p.titulo}</div>
            <div style={{ flex: 1, position: 'relative', minHeight: 46, background: 'var(--surface-2)', borderRadius: 6 }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                {meses.map((m, i) => <div key={i} style={{ flex: 1, borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }} />)}
              </div>
              {barraPromo && (
                <div title={p.titulo} style={{ position: 'absolute', top: 4, left: `${barraPromo.leftPct}%`, width: `${barraPromo.widthPct}%`, height: 16, background: tInfo.cor, borderRadius: 4, opacity: 0.85 }} />
              )}
              {campanhas.map((c, i) => {
                const barraCamp = calcularBarra(c.data_inicio, c.data_fim, rangeInicio, rangeFim)
                if (!barraCamp) return null
                return <div key={c.id} title={c.titulo} style={{ position: 'absolute', top: 24 + (i % 2) * 10, left: `${barraCamp.leftPct}%`, width: `${barraCamp.widthPct}%`, height: 8, background: 'var(--accent)', borderRadius: 3, opacity: 0.75 }} />
              })}
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
        {TIPOS_PROMOCAO.map(t => (
          <span key={t.value} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: t.cor, display: 'inline-block' }} />{t.label}
          </span>
        ))}
        <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
          <span style={{ width: 10, height: 6, borderRadius: 3, background: 'var(--accent)', display: 'inline-block' }} />Campanha
        </span>
      </div>
    </div>
  )
}

// ── VISÃO DE IMPRESSÃO / EXPORTAÇÃO ─────────────────────────
function ViewImpressao({ promocoes, campanhasPorPromocao, labelPeriodo, onVoltar }) {
  useEffect(() => { const t = setTimeout(() => window.print(), 300); return () => clearTimeout(t) }, [])
  return (
    <div>
      <style>{'@media print { .no-print { display: none !important; } .sidebar { display: none !important; } .main-content { overflow: visible !important; } }'}</style>
      <div className="no-print" style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost" onClick={onVoltar}><ChevronLeft size={14} /> Voltar</button>
      </div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Calendário de promoções — {labelPeriodo}</h1>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 24 }}>Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
      {promocoes.length === 0 ? <p style={{ fontSize: 13, color: '#666' }}>Nenhuma promoção neste período.</p>
      : promocoes.map(p => {
        const tInfo = tipoInfo(p.tipo)
        const campanhas = campanhasPorPromocao[p.id] || []
        return (
          <div key={p.id} style={{ marginBottom: 22, breakInside: 'avoid' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{p.titulo} <span style={{ fontSize: 11, fontWeight: 400, color: tInfo.cor }}>({tInfo.label})</span></div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              {p.data_inicio ? fmtData(p.data_inicio) : '—'}{p.data_fim ? ` até ${fmtData(p.data_fim)}` : ''}
            </div>
            {campanhas.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {campanhas.map(c => (
                  <li key={c.id} style={{ fontSize: 13, marginBottom: 4 }}>
                    <strong>{c.titulo}</strong> — {c.data_inicio ? fmtData(c.data_inicio) : '—'}{c.data_fim ? ` até ${fmtData(c.data_fim)}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── CARD PROMOÇÃO (lista) ───────────────────────────────────
function CardPromocao({ promocao, qtdCampanhas, onClick, onEditar, onExcluir }) {
  const tInfo = tipoInfo(promocao.tipo)
  const sInfo = statusPromocaoInfo(promocao.status)
  const canalInfo = CANAIS_PROMOCAO.find(c => c.value === promocao.canal)

  return (
    <div className="table-card" style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>{promocao.titulo}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: tInfo.cor, background: tInfo.bg, padding: '2px 8px', borderRadius: 20 }}>{tInfo.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: sInfo.cor, background: sInfo.bg, padding: '2px 8px', borderRadius: 20 }}>{sInfo.label}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); onEditar() }}><Pencil size={12} /></button>
          <button className="btn btn-danger btn-icon btn-sm" onClick={e => { e.stopPropagation(); onExcluir() }}><Trash2 size={12} /></button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
        {promocao.data_inicio ? fmtData(promocao.data_inicio) : 'Sem data'}{promocao.data_fim ? ` até ${fmtData(promocao.data_fim)}` : ''}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {canalInfo?.label} · {qtdCampanhas} campanha{qtdCampanhas !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ─────────────────────────────────────────
export default function PromocoesParceiras() {
  const { usuario } = useAuth()
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [semestre, setSemestre] = useState(agora.getMonth() < 6 ? 1 : 2) // 0 = ano inteiro, 1 = jan-jun, 2 = jul-dez
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [visao, setVisao] = useState('lista') // 'lista' | 'linha_tempo'
  const [imprimindo, setImprimindo] = useState(false)

  const [promocoes, setPromocoes] = useState([])
  const [todasCampanhas, setTodasCampanhas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [toast, showToast] = useToast()

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    try {
      const [proms, camps, us] = await Promise.all([getPromocoes(), getTodasCampanhasPromocao(), getUsuarios()])
      setPromocoes(proms); setTodasCampanhas(camps); setUsuarios(us || [])
    } catch { showToast('Erro ao carregar promoções.', 'error') }
    finally { setLoading(false) }
  }

  async function salvar(form) {
    try {
      if (modal === 'new') { await createPromocao({ ...form, criado_por: usuario?.id }); showToast('Promoção criada!') }
      else { await updatePromocao(modal.id, form); showToast('Promoção atualizada!') }
      await carregar()
    } catch { showToast('Erro ao salvar promoção.', 'error') }
  }

  async function excluir(p) {
    if (!window.confirm(`Remover a promoção "${p.titulo}"?`)) return
    try { await desativarPromocao(p.id); setPromocoes(prev => prev.filter(x => x.id !== p.id)); showToast('Promoção removida.') }
    catch { showToast('Erro ao remover.', 'error') }
  }

  const campanhasPorPromocao = {}
  for (const c of todasCampanhas) { (campanhasPorPromocao[c.promocao_id] ||= []).push(c) }

  const promocoesFiltradas = promocoes
    .filter(p => promocaoNoPeriodo(p, ano, semestre))
    .filter(p => filtroStatus === 'todos' || p.status === filtroStatus)

  const labelPeriodo = semestre === 0 ? `Ano ${ano}` : semestre === 1 ? `1º semestre ${ano} (Jan–Jun)` : `2º semestre ${ano} (Jul–Dez)`

  if (imprimindo) {
    return <ViewImpressao promocoes={promocoesFiltradas} campanhasPorPromocao={campanhasPorPromocao} labelPeriodo={labelPeriodo} onVoltar={() => setImprimindo(false)} />
  }

  if (detalhe) {
    return <DetalhePromocao promocao={detalhe} onBack={() => { setDetalhe(null); carregar() }} showToast={showToast} usuarios={usuarios} />
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Megaphone size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Promoções</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{promocoesFiltradas.length} promoção{promocoesFiltradas.length !== 1 ? 'ões' : ''} · {labelPeriodo}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setImprimindo(true)}><Printer size={14} /> Exportar</button>
          <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={15} /> Nova promoção</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }} value={ano} onChange={e => setAno(Number(e.target.value))}>
          {[agora.getFullYear() - 1, agora.getFullYear(), agora.getFullYear() + 1].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {[{ v: 1, l: 'Jan–Jun' }, { v: 2, l: 'Jul–Dez' }, { v: 0, l: 'Ano inteiro' }].map(({ v, l }) => (
            <button key={v} onClick={() => setSemestre(v)} style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 12, background: semestre === v ? 'var(--accent)' : 'transparent', color: semestre === v ? '#fff' : 'var(--text-muted)', fontWeight: 600 }}>{l}</button>
          ))}
        </div>
        <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          {STATUS_PROMOCAO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginLeft: 'auto' }}>
          <button onClick={() => setVisao('lista')} style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', background: visao === 'lista' ? 'var(--accent)' : 'transparent', color: visao === 'lista' ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><LayoutList size={13} /> Lista</button>
          <button onClick={() => setVisao('linha_tempo')} style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', background: visao === 'linha_tempo' ? 'var(--accent)' : 'transparent', color: visao === 'linha_tempo' ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><GanttChartSquare size={13} /> Linha do tempo</button>
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div>
      : visao === 'lista' ? (
        promocoesFiltradas.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 40 }}><p>Nenhuma promoção neste período.</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
            {promocoesFiltradas.map(p => (
              <CardPromocao key={p.id} promocao={p} qtdCampanhas={(campanhasPorPromocao[p.id] || []).length}
                onClick={() => setDetalhe(p)} onEditar={() => setModal(p)} onExcluir={() => excluir(p)} />
            ))}
          </div>
        )
      ) : (
        <ViewLinhaTempo promocoes={promocoesFiltradas} campanhasPorPromocao={campanhasPorPromocao} ano={ano} semestre={semestre} />
      )}

      {modal && <ModalPromocao promocao={modal === 'new' ? null : modal} onSave={salvar} onClose={() => setModal(null)} />}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
