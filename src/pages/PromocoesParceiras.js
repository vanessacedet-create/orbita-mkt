import { useState, useEffect } from 'react'
import {
  getPromocoes, createPromocao, updatePromocao, desativarPromocao,
  getParticipacoesPromocao, upsertParticipacao, contarStatusPromocao,
} from '../lib/promocoes-parceiras'
import { getLivrariasParceirasAtivas } from '../lib/crm-editoras-parceiras'
import { Megaphone, Plus, X, ChevronLeft, Pencil, Trash2, Search } from 'lucide-react'

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  return [toast, show]
}

const STATUS_PARTICIPACAO = [
  { value: 'convidado',   label: 'Convidada',    cor: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  { value: 'confirmou',   label: 'Confirmou',    cor: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  { value: 'recusou',     label: 'Recusou',      cor: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  { value: 'sem_retorno', label: 'Sem retorno',  cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
]
function statusInfo(v) { return STATUS_PARTICIPACAO.find(s => s.value === v) || STATUS_PARTICIPACAO[0] }

function fmtData(d) {
  if (!d) return null
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

// ── MODAL CRIAR/EDITAR PROMOÇÃO ─────────────────────────────
function ModalPromocao({ promocao, onSave, onClose }) {
  const [form, setForm] = useState({
    titulo: promocao?.titulo || '',
    descricao: promocao?.descricao || '',
    data_inicio: promocao?.data_inicio || '',
    data_fim: promocao?.data_fim || '',
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
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">{promocao ? 'Editar promoção' : 'Nova promoção'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-group">
          <label className="form-label">Título *</label>
          <input className="form-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Black Friday, Semana do Livro..." autoFocus />
        </div>
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
        <div className="form-group">
          <label className="form-label">Descrição (opcional)</label>
          <textarea className="form-textarea" rows={2} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving || !form.titulo.trim()}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ── DETALHE DA PROMOÇÃO — PARTICIPAÇÃO POR LIVRARIA ────────
function DetalhePromocao({ promocao, onBack, showToast }) {
  const [livrarias, setLivrarias] = useState([])
  const [participacoes, setParticipacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([getLivrariasParceirasAtivas(), getParticipacoesPromocao(promocao.id)])
      .then(([livs, parts]) => { setLivrarias(livs); setParticipacoes(parts) })
      .catch(() => showToast('Erro ao carregar dados.', 'error'))
      .finally(() => setLoading(false))
  }, [promocao.id])

  function participacaoDe(livraria_id) {
    return participacoes.find(p => p.livraria_id === livraria_id)
  }

  async function alterarStatus(livraria_id, status) {
    try {
      const atual = participacaoDe(livraria_id)
      const upd = await upsertParticipacao(promocao.id, livraria_id, { status, observacao: atual?.observacao })
      setParticipacoes(prev => {
        const idx = prev.findIndex(p => p.livraria_id === livraria_id)
        if (idx >= 0) { const n = [...prev]; n[idx] = upd; return n }
        return [...prev, upd]
      })
    } catch (e) { console.error(e); showToast('Erro ao salvar', 'error') }
  }

  const livrariasFiltradas = livrarias.filter(l => !search || l.nome.toLowerCase().includes(search.toLowerCase()))
  const contagem = contarStatusPromocao(participacoes)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-icon" onClick={onBack}><ChevronLeft size={18} /></button>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{promocao.titulo}</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {promocao.data_inicio ? fmtData(promocao.data_inicio) : '—'}{promocao.data_fim ? ` até ${fmtData(promocao.data_fim)}` : ''}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUS_PARTICIPACAO.map(s => (
          <div key={s.value} style={{ background: s.bg, border: `1px solid ${s.cor}40`, borderRadius: 10, padding: '10px 16px', minWidth: 110 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.cor }}>{contagem[s.value] || 0}</div>
            <div style={{ fontSize: 11, color: s.cor, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: 14, maxWidth: 320 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="search-input" style={{ paddingLeft: 32, width: '100%' }} placeholder="Buscar livraria..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div className="table-card">
          <table>
            <thead><tr><th>Livraria</th><th style={{ minWidth: 320 }}>Status</th></tr></thead>
            <tbody>
              {livrariasFiltradas.length === 0
                ? <tr><td colSpan={2} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>Nenhuma livraria encontrada.</td></tr>
                : livrariasFiltradas.map(l => {
                    const part = participacaoDe(l.id)
                    const statusAtual = part?.status || null
                    return (
                      <tr key={l.id}>
                        <td className="td-strong">{l.nome}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {STATUS_PARTICIPACAO.map(s => (
                              <button key={s.value} onClick={() => alterarStatus(l.id, s.value)}
                                style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `2px solid ${s.cor}`, background: statusAtual === s.value ? s.cor : 'transparent', color: statusAtual === s.value ? '#fff' : s.cor, transition: 'all 0.15s' }}>
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── LISTA DE PROMOÇÕES ──────────────────────────────────────
function CardPromocao({ promocao, onClick, onEditar, onExcluir }) {
  const [contagem, setContagem] = useState(null)

  useEffect(() => {
    getParticipacoesPromocao(promocao.id).then(parts => setContagem(contarStatusPromocao(parts))).catch(() => setContagem({}))
  }, [promocao.id])

  return (
    <div className="table-card" style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{promocao.titulo}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {promocao.data_inicio ? fmtData(promocao.data_inicio) : 'Sem data'}{promocao.data_fim ? ` até ${fmtData(promocao.data_fim)}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); onEditar() }}><Pencil size={12} /></button>
          <button className="btn btn-danger btn-icon btn-sm" onClick={e => { e.stopPropagation(); onExcluir() }}><Trash2 size={12} /></button>
        </div>
      </div>
      {promocao.descricao && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>{promocao.descricao}</p>}
      {contagem && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_PARTICIPACAO.map(s => contagem[s.value] > 0 && (
            <span key={s.value} style={{ fontSize: 11, fontWeight: 700, color: s.cor, background: s.bg, padding: '2px 8px', borderRadius: 20 }}>
              {contagem[s.value]} {s.label.toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PromocoesParceiras() {
  const [promocoes, setPromocoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | promocao
  const [detalhe, setDetalhe] = useState(null)
  const [toast, showToast] = useToast()

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    try { setPromocoes(await getPromocoes()) }
    catch { showToast('Erro ao carregar promoções.', 'error') }
    finally { setLoading(false) }
  }

  async function salvar(form) {
    try {
      if (modal === 'new') { await createPromocao(form); showToast('Promoção criada!') }
      else { await updatePromocao(modal.id, form); showToast('Promoção atualizada!') }
      await carregar()
    } catch { showToast('Erro ao salvar promoção.', 'error') }
  }

  async function excluir(p) {
    if (!window.confirm(`Remover a promoção "${p.titulo}"?`)) return
    try { await desativarPromocao(p.id); setPromocoes(prev => prev.filter(x => x.id !== p.id)); showToast('Promoção removida.') }
    catch { showToast('Erro ao remover.', 'error') }
  }

  if (detalhe) {
    return <DetalhePromocao promocao={detalhe} onBack={() => setDetalhe(null)} showToast={showToast} />
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Megaphone size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Promoções</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{promocoes.length} promoção{promocoes.length !== 1 ? 'ões' : ''} cadastrada{promocoes.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('new')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Nova promoção
        </button>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div>
      : promocoes.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <p>Nenhuma promoção cadastrada ainda.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {promocoes.map(p => (
            <CardPromocao key={p.id} promocao={p} onClick={() => setDetalhe(p)} onEditar={() => setModal(p)} onExcluir={() => excluir(p)} />
          ))}
        </div>
      )}

      {modal && <ModalPromocao promocao={modal === 'new' ? null : modal} onSave={salvar} onClose={() => setModal(null)} />}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
