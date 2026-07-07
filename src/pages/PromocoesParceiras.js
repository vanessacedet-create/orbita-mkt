import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getPromocoes, createPromocao, updatePromocao, desativarPromocao,
  getParticipantesPromocao, upsertParticipante, removerParticipante,
  selecionarTodosParticipantes, removerTodosParticipantes, setEscopoParticipante,
  getLivrosParticipante, importarLivrosParticipante, removerLivroParticipante,
  getCoresTiposPromocao, setCoresTiposPromocao,
  TIPOS_PROMOCAO, PALETA_CORES, CANAIS_PROMOCAO, STATUS_PROMOCAO, STATUS_PARTICIPACAO,
  tipoInfo, statusPromocaoInfo, promocaoNoPeriodo, promocaoNoDia,
} from '../lib/promocoes-parceiras'
import { getEditorasParceirasAtivas, getLivrariasParceirasAtivas } from '../lib/crm-editoras-parceiras'
import { GRUPOS } from '../lib/editoras-livrarias'
import * as XLSX from 'xlsx'
import {
  Megaphone, Plus, X, ChevronLeft, ChevronRight, Pencil, Trash2, Search, Upload,
  Building2, Library, Printer, LayoutList, CalendarDays, Palette,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  return [toast, show]
}

function fmtData(d) {
  if (!d) return null
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function toKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

// Dimensões de classificação da editora usadas para adicionar em massa
const DIMENSOES_CLASSIFICACAO = [
  { value: 'grupo_id',  label: 'Grupo' },
  { value: 'macro',     label: 'Macro' },
  { value: 'nicho',     label: 'Nicho' },
  { value: 'sub_nicho', label: 'Sub-nicho' },
]

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

// ── MODAL CORES DOS TIPOS ────────────────────────────────────
function ModalCores({ coresAtuais, onSave, onClose }) {
  const [cores, setCores] = useState({ ...coresAtuais })
  const [saving, setSaving] = useState(false)

  async function salvar() {
    setSaving(true)
    try { await onSave(cores); onClose() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Cores dos tipos de promoção</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {TIPOS_PROMOCAO.map(t => {
          const corAtual = cores[t.value] || t.cor
          return (
            <div key={t.value} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: corAtual, display: 'inline-block' }} />
                {t.label}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PALETA_CORES.map(cor => (
                  <button key={cor} type="button" onClick={() => setCores(c => ({ ...c, [t.value]: cor }))}
                    style={{ width: 26, height: 26, borderRadius: '50%', background: cor, border: corAtual === cor ? '3px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
          )
        })}
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar cores'}</button>
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

// ── PAINEL DE PARTICIPANTES (livrarias OU editoras) ─────────
function PainelParticipantes({ promocao, tipo, showToast }) {
  const [candidatos, setCandidatos] = useState([])
  const [participantes, setParticipantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dimensao, setDimensao] = useState('')
  const [valorDimensao, setValorDimensao] = useState('')
  const [modalLivros, setModalLivros] = useState(null)
  const [livrosPorParticipante, setLivrosPorParticipante] = useState({})

  const isEditora = tipo === 'editora'

  useEffect(() => { carregar() }, [promocao.id, tipo]) // eslint-disable-line

  async function carregar() {
    setLoading(true)
    try {
      const [cands, parts] = await Promise.all([
        isEditora ? getEditorasParceirasAtivas() : getLivrariasParceirasAtivas(),
        getParticipantesPromocao(promocao.id),
      ])
      setCandidatos(cands)
      setParticipantes(parts.filter(p => isEditora ? p.editora_id : p.livraria_id))
    } catch (e) { console.error(e); showToast('Erro ao carregar participantes.', 'error') }
    finally { setLoading(false) }
  }

  function participacaoDe(id) {
    return participantes.find(p => (isEditora ? p.editora_id : p.livraria_id) === id)
  }

  // Valor de classificação de um candidato para uma dada dimensão —
  // livraria usa a classificação da editora vinculada; editora usa a dela mesma
  function valorClassificacao(candidato, dim) {
    const alvo = isEditora ? candidato : candidato.editoras_parceiras
    if (!alvo) return null
    if (dim === 'grupo_id') { const g = GRUPOS.find(x => x.id === alvo.grupo_id); return g ? `${g.romano} · ${g.label}` : null }
    return alvo[dim] || null
  }

  const opcoesValorDimensao = dimensao
    ? [...new Set(candidatos.map(c => valorClassificacao(c, dimensao)).filter(Boolean))].sort()
    : []

  async function alterarStatus(id, status) {
    try {
      const upd = await upsertParticipante(promocao.id, { [isEditora ? 'editora_id' : 'livraria_id']: id, status })
      setParticipantes(prev => { const idx = prev.findIndex(p => p.id === upd.id); if (idx >= 0) { const n = [...prev]; n[idx] = upd; return n } return [...prev, upd] })
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
      const novos = await selecionarTodosParticipantes(promocao.id, tipo, ids)
      setParticipantes(novos)
      showToast(`Todas as ${isEditora ? 'editoras' : 'livrarias'} selecionadas!`)
    } catch (e) { console.error(e); showToast('Erro ao selecionar todas', 'error') }
  }

  async function removerTodas() {
    if (!window.confirm(`Remover todas as ${isEditora ? 'editoras' : 'livrarias'} desta promoção?`)) return
    try { await removerTodosParticipantes(promocao.id, tipo); setParticipantes([]); showToast('Removidas.') }
    catch (e) { console.error(e); showToast('Erro ao remover', 'error') }
  }

  async function selecionarPorCategoria() {
    if (!dimensao || !valorDimensao) return
    const idsAlvo = candidatos.filter(c => valorClassificacao(c, dimensao) === valorDimensao).map(c => c.id)
    if (!idsAlvo.length) { showToast('Nenhuma correspondência encontrada.', 'error'); return }
    try {
      const novos = await selecionarTodosParticipantes(promocao.id, tipo, idsAlvo)
      setParticipantes(prev => {
        const mapa = {}; for (const p of prev) mapa[p.id] = p; for (const p of novos) mapa[p.id] = p
        return Object.values(mapa)
      })
      showToast(`${idsAlvo.length} adicionada(s) por ${DIMENSOES_CLASSIFICACAO.find(d => d.value === dimensao)?.label.toLowerCase()}.`)
    } catch (e) { console.error(e); showToast('Erro ao adicionar por categoria', 'error') }
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

  if (loading) return <div className="loading"><div className="spinner" /></div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="search-input" style={{ paddingLeft: 32, width: '100%' }} placeholder={`Buscar ${isEditora ? 'editora' : 'livraria'}...`} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={selecionarTodas}>Selecionar todas</button>
        <button className="btn btn-ghost btn-sm" onClick={removerTodas}>Remover todas</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Adicionar por:</span>
        <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '5px 8px' }} value={dimensao} onChange={e => { setDimensao(e.target.value); setValorDimensao('') }}>
          <option value="">Selecionar dimensão...</option>
          {DIMENSOES_CLASSIFICACAO.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        {dimensao && (
          <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '5px 8px' }} value={valorDimensao} onChange={e => setValorDimensao(e.target.value)}>
            <option value="">Selecionar valor...</option>
            {opcoesValorDimensao.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        )}
        {dimensao && valorDimensao && (
          <button className="btn btn-primary btn-sm" onClick={selecionarPorCategoria}>Adicionar estas</button>
        )}
      </div>

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
                              {part.escopo === 'livros_pontuais' ? 'Livros pontuais' : 'Todos os produtos'}
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

// ── DETALHE PROMOÇÃO — PARTICIPANTES (livrarias / editoras) ─
function DetalhePromocao({ promocao, onBack, showToast }) {
  const [abaTipo, setAbaTipo] = useState(promocao.canal === 'marketplace' ? 'editora' : 'livraria')
  const [modalEdicao, setModalEdicao] = useState(false)
  const [promocaoAtual, setPromocaoAtual] = useState(promocao)

  async function salvarPromocao(form) {
    try { const upd = await updatePromocao(promocao.id, form); setPromocaoAtual(upd); showToast('Promoção atualizada!') }
    catch { showToast('Erro ao salvar promoção.', 'error') }
  }

  const tInfo = tipoInfo(promocaoAtual.tipo)
  const sInfo = statusPromocaoInfo(promocaoAtual.status)
  const canalInfo = CANAIS_PROMOCAO.find(c => c.value === promocaoAtual.canal)

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
          </p>
          {promocaoAtual.observacao && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>{promocaoAtual.observacao}</p>}
        </div>
        <button className="btn btn-ghost" onClick={() => setModalEdicao(true)}><Pencil size={14} /> Editar</button>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        <button onClick={() => setAbaTipo('livraria')} style={{ padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', borderBottom: abaTipo === 'livraria' ? '2px solid var(--accent)' : '2px solid transparent', color: abaTipo === 'livraria' ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Library size={14} /> Livrarias
        </button>
        <button onClick={() => setAbaTipo('editora')} style={{ padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', borderBottom: abaTipo === 'editora' ? '2px solid var(--accent)' : '2px solid transparent', color: abaTipo === 'editora' ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={14} /> Editoras
        </button>
      </div>

      <PainelParticipantes promocao={promocaoAtual} tipo={abaTipo} showToast={showToast} />

      {modalEdicao && <ModalPromocao promocao={promocaoAtual} onSave={salvarPromocao} onClose={() => setModalEdicao(false)} />}
    </div>
  )
}

// ── LINHA DO TEMPO — CALENDÁRIO DE VERDADE (dia a dia) ──────
function ViewCalendarioPromocoes({ promocoes, coresCustom, onClickPromocao }) {
  const hoje = new Date()
  const [mesRef, setMesRef] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const ano = mesRef.getFullYear(), mes = mesRef.getMonth()
  const nomeMes = format(mesRef, 'MMMM yyyy', { locale: ptBR })
  const primeiroDia = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={() => setMesRef(new Date(ano, mes - 1, 1))} className="btn btn-ghost btn-icon"><ChevronLeft size={16} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontWeight: 700, fontSize: 16, margin: 0, textTransform: 'capitalize', color: 'var(--text)' }}>{nomeMes}</h2>
          <button onClick={() => setMesRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1))} className="btn btn-ghost btn-sm">Hoje</button>
        </div>
        <button onClick={() => setMesRef(new Date(ano, mes + 1, 1))} className="btn btn-ghost btn-icon"><ChevronRight size={16} /></button>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          {diasSemana.map(d => <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {Array.from({ length: primeiroDia }).map((_, i) => <div key={`v${i}`} style={{ minHeight: 100, background: 'var(--surface)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', opacity: 0.4 }} />)}
          {Array.from({ length: diasNoMes }).map((_, i) => {
            const dia = i + 1
            const dataKey = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
            const promosNoDia = promocoes.filter(p => promocaoNoDia(p, dataKey))
            const isHoje = hoje.getDate() === dia && hoje.getMonth() === mes && hoje.getFullYear() === ano
            const col = (primeiroDia + i) % 7
            const isFimSemana = col === 0 || col === 6
            return (
              <div key={dia} style={{ minHeight: 100, padding: 6, background: isFimSemana ? 'var(--surface-2)' : 'var(--surface)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 11, fontWeight: isHoje ? 700 : 400, background: isHoje ? 'var(--accent)' : 'transparent', color: isHoje ? '#fff' : 'var(--text-soft)' }}>{dia}</span>
                </div>
                {promosNoDia.slice(0, 4).map(p => {
                  const tInfo = tipoInfo(p.tipo, coresCustom)
                  return (
                    <div key={p.id} onClick={() => onClickPromocao(p)} title={p.titulo}
                      style={{ padding: '2px 6px', borderRadius: 4, marginBottom: 2, cursor: 'pointer', background: `${tInfo.cor}22`, border: `1px solid ${tInfo.cor}55`, fontSize: 10, fontWeight: 600, color: tInfo.cor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.titulo}
                    </div>
                  )
                })}
                {promosNoDia.length > 4 && <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, paddingLeft: 2 }}>+{promosNoDia.length - 4} mais</div>}
              </div>
            )
          })}
          {Array.from({ length: (7 - (primeiroDia + diasNoMes) % 7) % 7 }).map((_, i) => <div key={`f${i}`} style={{ minHeight: 100, background: 'var(--surface)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', opacity: 0.4 }} />)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
        {TIPOS_PROMOCAO.map(t => {
          const tInfo = tipoInfo(t.value, coresCustom)
          return <span key={t.value} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: tInfo.cor, display: 'inline-block' }} />{t.label}</span>
        })}
      </div>
    </div>
  )
}

// ── VISÃO DE IMPRESSÃO / EXPORTAÇÃO ─────────────────────────
function ViewImpressao({ promocoes, coresCustom, labelPeriodo, onVoltar }) {
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
        const tInfo = tipoInfo(p.tipo, coresCustom)
        const canalInfo = CANAIS_PROMOCAO.find(c => c.value === p.canal)
        return (
          <div key={p.id} style={{ marginBottom: 14, breakInside: 'avoid', paddingLeft: 12, borderLeft: `3px solid ${tInfo.cor}` }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{p.titulo} <span style={{ fontSize: 11, fontWeight: 400, color: tInfo.cor }}>({tInfo.label})</span></div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {p.data_inicio ? fmtData(p.data_inicio) : '—'}{p.data_fim ? ` até ${fmtData(p.data_fim)}` : ''} · {canalInfo?.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── CARD PROMOÇÃO (lista) ───────────────────────────────────
function CardPromocao({ promocao, coresCustom, onClick, onEditar, onExcluir }) {
  const tInfo = tipoInfo(promocao.tipo, coresCustom)
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
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{canalInfo?.label}</div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ─────────────────────────────────────────
export default function PromocoesParceiras() {
  const { usuario } = useAuth()
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [semestre, setSemestre] = useState(agora.getMonth() < 6 ? 1 : 2)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [visao, setVisao] = useState('linha_tempo') // 'linha_tempo' | 'lista' — linha do tempo é a padrão
  const [imprimindo, setImprimindo] = useState(false)

  const [promocoes, setPromocoes] = useState([])
  const [coresCustom, setCoresCustom] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [modalCores, setModalCores] = useState(false)
  const [detalhe, setDetalhe] = useState(null)
  const [toast, showToast] = useToast()

  useEffect(() => { carregar() }, []) // eslint-disable-line

  async function carregar() {
    setLoading(true)
    try {
      const [proms, cores] = await Promise.all([getPromocoes(), getCoresTiposPromocao()])
      setPromocoes(proms); setCoresCustom(cores)
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

  async function salvarCores(cores) {
    try { await setCoresTiposPromocao(cores); setCoresCustom(cores); showToast('Cores atualizadas!') }
    catch { showToast('Erro ao salvar cores.', 'error') }
  }

  const promocoesFiltradas = promocoes
    .filter(p => promocaoNoPeriodo(p, ano, semestre))
    .filter(p => filtroStatus === 'todos' || p.status === filtroStatus)

  const labelPeriodo = semestre === 0 ? `Ano ${ano}` : semestre === 1 ? `1º semestre ${ano} (Jan–Jun)` : `2º semestre ${ano} (Jul–Dez)`

  if (imprimindo) {
    return <ViewImpressao promocoes={promocoesFiltradas} coresCustom={coresCustom} labelPeriodo={labelPeriodo} onVoltar={() => setImprimindo(false)} />
  }

  if (detalhe) {
    return <DetalhePromocao promocao={detalhe} onBack={() => { setDetalhe(null); carregar() }} showToast={showToast} />
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Megaphone size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Promoções</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{promocoes.length} promoção{promocoes.length !== 1 ? 'ões' : ''} cadastrada{promocoes.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setModalCores(true)}><Palette size={14} /> Cores</button>
          <button className="btn btn-ghost" onClick={() => setImprimindo(true)}><Printer size={14} /> Exportar</button>
          <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={15} /> Nova promoção</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => setVisao('linha_tempo')} style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', background: visao === 'linha_tempo' ? 'var(--accent)' : 'transparent', color: visao === 'linha_tempo' ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><CalendarDays size={13} /> Linha do tempo</button>
          <button onClick={() => setVisao('lista')} style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', background: visao === 'lista' ? 'var(--accent)' : 'transparent', color: visao === 'lista' ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><LayoutList size={13} /> Lista</button>
        </div>
        {visao === 'lista' && (
          <>
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
          </>
        )}
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div>
      : visao === 'linha_tempo' ? (
        <ViewCalendarioPromocoes promocoes={promocoes} coresCustom={coresCustom} onClickPromocao={p => setDetalhe(p)} />
      ) : (
        promocoesFiltradas.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 40 }}><p>Nenhuma promoção neste período.</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
            {promocoesFiltradas.map(p => (
              <CardPromocao key={p.id} promocao={p} coresCustom={coresCustom}
                onClick={() => setDetalhe(p)} onEditar={() => setModal(p)} onExcluir={() => excluir(p)} />
            ))}
          </div>
        )
      )}

      {modal && <ModalPromocao promocao={modal === 'new' ? null : modal} onSave={salvar} onClose={() => setModal(null)} />}
      {modalCores && <ModalCores coresAtuais={coresCustom} onSave={salvarCores} onClose={() => setModalCores(false)} />}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
