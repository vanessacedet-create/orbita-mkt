import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Gift, Plus, Search, X, Save, Truck, Megaphone, Package, BookOpen, ExternalLink, AlertCircle, Trash2 } from 'lucide-react'

/* ============================================
   CORTESIAS — Editoras Parceiras
   Controle dos livros enviados aos influencers da área.
   - Pedido concluído na Vitrine Editoras Parceiras → cortesia criada
     automaticamente pelo banco (origem "vitrine").
   - A equipe também pode lançar cortesias manuais (origem "manual").
   Tabelas: vp_cortesias, vp_cortesia_livros
   ============================================ */

const STATUS = {
  preparando: { label: 'Preparando envio', cor: '#f59e0b', icon: Package },
  enviado:    { label: 'Enviado',          cor: '#3b82f6', icon: Truck },
  divulgado:  { label: 'Divulgado',        cor: '#22c55e', icon: Megaphone },
  cancelado:  { label: 'Cancelado',        cor: '#6b7280', icon: X },
}

function fmtData(d) {
  if (!d) return '—'
  const [a, m, dia] = String(d).slice(0, 10).split('-')
  return `${dia}/${m}/${a}`
}

export default function CortesiasParceiras() {
  const [cortesias, setCortesias] = useState([])
  const [influencers, setInfluencers] = useState([])
  const [livros, setLivros] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('preparando')
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null)
  const [novaAberta, setNovaAberta] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [c, i, l] = await Promise.all([
      supabase.from('vp_cortesias')
        .select('*, influencer:influencer_id(id, nome, email, instagram, contato), vp_cortesia_livros(*)')
        .order('created_at', { ascending: false }),
      supabase.from('vp_influencers').select('id, nome, email, ativo').order('nome'),
      supabase.from('vp_livros').select('id, titulo, autor, editora, ean').order('titulo'),
    ])
    if (c.error) mostrarToast('Erro ao carregar cortesias: ' + c.error.message, 'erro')
    setCortesias(c.data || [])
    setInfluencers(i.data || [])
    setLivros(l.data || [])
    setLoading(false)
  }

  function mostrarToast(msg, tipo = 'ok') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const contagem = useMemo(() => {
    const c = { todos: cortesias.length }
    Object.keys(STATUS).forEach(s => { c[s] = cortesias.filter(x => x.status === s).length })
    return c
  }, [cortesias])

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return cortesias.filter(c => {
      if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false
      if (!t) return true
      const livrosTxt = (c.vp_cortesia_livros || []).map(l => l.titulo_livro || '').join(' ').toLowerCase()
      return (c.influencer?.nome || '').toLowerCase().includes(t) || livrosTxt.includes(t)
    })
  }, [cortesias, filtroStatus, busca])

  async function salvarEdicao(id, dados) {
    const { data, error } = await supabase.from('vp_cortesias').update(dados).eq('id', id)
      .select('*, influencer:influencer_id(id, nome, email, instagram, contato), vp_cortesia_livros(*)').single()
    if (error) throw error
    setCortesias(prev => prev.map(c => c.id === id ? data : c))
    mostrarToast('Cortesia atualizada!')
  }

  async function criarManual({ influencer_id, data_divulgacao_prevista, observacoes, itens }) {
    const { data: nova, error } = await supabase.from('vp_cortesias').insert({
      influencer_id, origem: 'manual', status: 'preparando',
      data_divulgacao_prevista: data_divulgacao_prevista || null,
      observacoes: observacoes || null,
    }).select().single()
    if (error) throw error
    if (itens.length > 0) {
      const { error: errItens } = await supabase.from('vp_cortesia_livros').insert(
        itens.map(it => ({ cortesia_id: nova.id, livro_id: it.livro_id || null, titulo_livro: it.titulo_livro, ean_livro: it.ean_livro || null, quantidade: it.quantidade || 1 }))
      )
      if (errItens) throw errItens
    }
    await carregar()
    mostrarToast('Cortesia criada!')
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Gift size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Cortesias</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Livros enviados aos influencers da área de Editoras Parceiras
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setNovaAberta(true)}>
          <Plus size={15} /> Nova cortesia manual
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[...Object.entries(STATUS).map(([k, v]) => ({ k, l: v.label, cor: v.cor })), { k: 'todos', l: 'Todas', cor: 'var(--text-muted)' }].map(f => (
          <button key={f.k} onClick={() => setFiltroStatus(f.k)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${filtroStatus === f.k ? f.cor : 'var(--border)'}`,
            background: filtroStatus === f.k ? 'var(--surface-2)' : 'transparent',
            color: filtroStatus === f.k ? f.cor : 'var(--text-muted)',
          }}>{f.l} ({contagem[f.k] || 0})</button>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 420 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="form-input" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por influencer ou livro..." style={{ paddingLeft: 32, width: '100%' }} />
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : filtradas.length === 0 ? (
        <div className="table-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <Gift size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Nenhuma cortesia nesta lista.</p>
          <p style={{ margin: '6px 0 0', fontSize: 12 }}>Pedidos concluídos na Vitrine aparecem aqui automaticamente.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtradas.map(c => {
            const st = STATUS[c.status] || STATUS.preparando
            const Icone = st.icon
            const itens = c.vp_cortesia_livros || []
            return (
              <div key={c.id} className="table-card" style={{ padding: '14px 18px', borderLeft: `3px solid ${st.cor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 15, color: 'var(--text)' }}>{c.influencer?.nome || 'Influencer removido'}</strong>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: st.cor, border: `1px solid ${st.cor}`, borderRadius: 4, padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icone size={10} /> {st.label}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {c.origem === 'vitrine' ? `Vitrine · pedido #${c.pedido_id ?? '—'}` : 'Manual'} · criada em {fmtData(c.created_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {itens.length === 0
                        ? <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem livros registrados</span>
                        : itens.map(it => (
                          <span key={it.id} style={{ fontSize: 12, background: 'var(--surface-2)', borderRadius: 6, padding: '3px 8px', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <BookOpen size={11} /> {it.titulo_livro}{it.quantidade > 1 ? ` ×${it.quantidade}` : ''}
                          </span>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>Divulgação prevista: <strong style={{ color: 'var(--text)' }}>{fmtData(c.data_divulgacao_prevista)}</strong></span>
                      {c.data_envio && <span>Enviado em: <strong style={{ color: 'var(--text)' }}>{fmtData(c.data_envio)}</strong></span>}
                      {c.codigo_rastreio && <span>Rastreio: <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{c.codigo_rastreio}</strong></span>}
                      {c.data_divulgacao && <span>Divulgado em: <strong style={{ color: 'var(--text)' }}>{fmtData(c.data_divulgacao)}</strong></span>}
                      {c.link_divulgacao && (
                        <a href={c.link_divulgacao} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <ExternalLink size={11} /> ver divulgação
                        </a>
                      )}
                    </div>
                    {c.observacoes && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 6 }}>{c.observacoes}</div>}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditando(c)}>Atualizar</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editando && (
        <ModalAtualizar cortesia={editando} onSalvar={salvarEdicao} onFechar={() => setEditando(null)} />
      )}

      {novaAberta && (
        <ModalNova influencers={influencers.filter(i => i.ativo)} livros={livros} onCriar={criarManual} onFechar={() => setNovaAberta(false)} />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.tipo === 'erro' ? 'var(--red)' : 'var(--green)',
          color: 'white', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

// ── MODAL: ATUALIZAR ENVIO / DIVULGAÇÃO ────────────────────────
function ModalAtualizar({ cortesia, onSalvar, onFechar }) {
  const [form, setForm] = useState({
    status: cortesia.status,
    data_envio: cortesia.data_envio || '',
    codigo_rastreio: cortesia.codigo_rastreio || '',
    data_divulgacao: cortesia.data_divulgacao || '',
    link_divulgacao: cortesia.link_divulgacao || '',
    data_divulgacao_prevista: cortesia.data_divulgacao_prevista || '',
    observacoes: cortesia.observacoes || '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSalvar() {
    if (form.status === 'enviado' && !form.data_envio) { setErro('Informe a data de envio.'); return }
    if (form.status === 'divulgado' && !form.link_divulgacao.trim()) { setErro('Cole o link da divulgação.'); return }
    setErro('')
    setSalvando(true)
    try {
      await onSalvar(cortesia.id, {
        status: form.status,
        data_envio: form.data_envio || null,
        codigo_rastreio: form.codigo_rastreio.trim() || null,
        data_divulgacao: form.data_divulgacao || null,
        link_divulgacao: form.link_divulgacao.trim() || null,
        data_divulgacao_prevista: form.data_divulgacao_prevista || null,
        observacoes: form.observacoes.trim() || null,
      })
      onFechar()
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Cortesia — {cortesia.influencer?.nome || 'Influencer'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar}><X size={16} /></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data de envio</label>
              <input className="form-input" type="date" value={form.data_envio} onChange={e => setForm({ ...form, data_envio: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Código de rastreio</label>
              <input className="form-input" value={form.codigo_rastreio} onChange={e => setForm({ ...form, codigo_rastreio: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Divulgação prevista</label>
              <input className="form-input" type="date" value={form.data_divulgacao_prevista} onChange={e => setForm({ ...form, data_divulgacao_prevista: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Divulgado em</label>
              <input className="form-input" type="date" value={form.data_divulgacao} onChange={e => setForm({ ...form, data_divulgacao: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Link da divulgação</label>
            <input className="form-input" value={form.link_divulgacao} onChange={e => setForm({ ...form, link_divulgacao: e.target.value })} placeholder="https://instagram.com/p/..." />
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-textarea" rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          {erro && <Aviso texto={erro} />}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSalvar} disabled={salvando}>
            <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL: NOVA CORTESIA MANUAL ────────────────────────────────
function ModalNova({ influencers, livros, onCriar, onFechar }) {
  const [influencerId, setInfluencerId] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState([])
  const [buscaLivro, setBuscaLivro] = useState('')
  const [tituloLivre, setTituloLivre] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const sugestoes = useMemo(() => {
    const t = buscaLivro.trim().toLowerCase()
    if (t.length < 2) return []
    return livros.filter(l =>
      (l.titulo || '').toLowerCase().includes(t) || (l.ean || '').includes(t) || (l.editora || '').toLowerCase().includes(t)
    ).slice(0, 8)
  }, [livros, buscaLivro])

  function adicionarDaVitrine(l) {
    if (itens.some(i => i.livro_id === l.id)) return
    setItens(prev => [...prev, { livro_id: l.id, titulo_livro: l.titulo, ean_livro: l.ean, quantidade: 1 }])
    setBuscaLivro('')
  }

  function adicionarLivre() {
    const t = tituloLivre.trim()
    if (!t) return
    setItens(prev => [...prev, { livro_id: null, titulo_livro: t, ean_livro: null, quantidade: 1 }])
    setTituloLivre('')
  }

  async function handleCriar() {
    if (!influencerId) { setErro('Selecione o influencer.'); return }
    if (itens.length === 0) { setErro('Adicione pelo menos um livro.'); return }
    setErro('')
    setSalvando(true)
    try {
      await onCriar({ influencer_id: Number(influencerId), data_divulgacao_prevista: dataPrevista, observacoes: observacoes.trim(), itens })
      onFechar()
    } catch (e) {
      setErro('Erro ao criar: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Nova cortesia manual</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar}><X size={16} /></button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Influencer *</label>
            <select className="form-select" value={influencerId} onChange={e => setInfluencerId(e.target.value)}>
              <option value="">Selecione...</option>
              {influencers.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
            {influencers.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Cadastre os influencers no menu "Influencers".</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Livros *</label>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
              <input className="form-input" value={buscaLivro} onChange={e => setBuscaLivro(e.target.value)}
                placeholder="Buscar livro da vitrine por título, ISBN ou editora..." style={{ paddingLeft: 30, width: '100%' }} />
              {sugestoes.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                  {sugestoes.map(l => (
                    <button key={l.id} type="button" onClick={() => adicionarDaVitrine(l)} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{l.titulo}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{[l.autor, l.editora, l.ean].filter(Boolean).join(' · ')}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input className="form-input" value={tituloLivre} onChange={e => setTituloLivre(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') adicionarLivre() }}
                placeholder="Ou digite o título de um livro fora da vitrine" style={{ flex: 1 }} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={adicionarLivre}><Plus size={13} /> Adicionar</button>
            </div>
            {itens.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {itens.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
                    <BookOpen size={12} />
                    <span style={{ flex: 1, color: 'var(--text)' }}>{it.titulo_livro}</span>
                    <input type="number" min="1" value={it.quantidade} className="form-input"
                      onChange={e => setItens(prev => prev.map((x, i) => i === idx ? { ...x, quantidade: Math.max(1, Number(e.target.value) || 1) } : x))}
                      style={{ width: 56, padding: '3px 6px', fontSize: 12 }} />
                    <button type="button" onClick={() => setItens(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', display: 'flex' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Divulgação prevista</label>
            <input className="form-input" type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-textarea" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>
          {erro && <Aviso texto={erro} />}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleCriar} disabled={salvando}>
            <Save size={14} /> {salvando ? 'Criando...' : 'Criar cortesia'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Aviso({ texto }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--red)' }}>
      <AlertCircle size={15} style={{ flexShrink: 0 }} /> {texto}
    </div>
  )
}
