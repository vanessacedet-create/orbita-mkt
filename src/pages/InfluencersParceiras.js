import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Plus, Search, Edit2, X, Save, RefreshCw, AlertCircle, AtSign } from 'lucide-react'

/* ============================================
   INFLUENCERS — Editoras Parceiras
   Cadastro próprio da área (tabela vp_influencers).
   Usado pela Vitrine Editoras Parceiras e pelas Cortesias Parceiras.
   ============================================ */

const FORM_VAZIO = {
  nome: '', email: '', contato: '', instagram: '',
  limite_mensal: 1, ativo: true, observacoes: '',
}

export default function InfluencersParceiras() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState('ativos') // 'ativos' | 'inativos' | 'todos'
  const [modal, setModal] = useState(null) // null | 'novo' | objeto do influencer
  const [toast, setToast] = useState(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('vp_influencers')
      .select('*')
      .order('nome', { ascending: true })
    if (error) mostrarToast('Erro ao carregar influencers: ' + error.message, 'erro')
    setLista(data || [])
    setLoading(false)
  }

  function mostrarToast(msg, tipo = 'ok') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return lista.filter(i => {
      if (filtroAtivo === 'ativos' && !i.ativo) return false
      if (filtroAtivo === 'inativos' && i.ativo) return false
      if (!t) return true
      return (i.nome || '').toLowerCase().includes(t) ||
        (i.email || '').toLowerCase().includes(t) ||
        (i.instagram || '').toLowerCase().includes(t)
    })
  }, [lista, busca, filtroAtivo])

  async function salvar(dados, id) {
    if (id) {
      const { data, error } = await supabase.from('vp_influencers').update(dados).eq('id', id).select().single()
      if (error) throw error
      setLista(prev => prev.map(i => i.id === id ? data : i))
      mostrarToast('Influencer atualizado!')
    } else {
      const { data, error } = await supabase.from('vp_influencers').insert(dados).select().single()
      if (error) throw error
      setLista(prev => [...prev, data].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')))
      mostrarToast('Influencer cadastrado!')
    }
  }

  async function toggleAtivo(inf) {
    const { error } = await supabase.from('vp_influencers').update({ ativo: !inf.ativo }).eq('id', inf.id)
    if (error) { mostrarToast('Erro: ' + error.message, 'erro'); return }
    setLista(prev => prev.map(i => i.id === inf.id ? { ...i, ativo: !i.ativo } : i))
  }

  async function liberarNovoCiclo(inf) {
    const ok = window.confirm(
      `Liberar um novo ciclo para ${inf.nome}?\n\nA contagem do limite mensal recomeça agora. Os pedidos anteriores continuam no histórico.`
    )
    if (!ok) return
    const agora = new Date().toISOString()
    const { error } = await supabase.from('vp_influencers').update({ ciclo_inicio: agora }).eq('id', inf.id)
    if (error) { mostrarToast('Erro: ' + error.message, 'erro'); return }
    setLista(prev => prev.map(i => i.id === inf.id ? { ...i, ciclo_inicio: agora } : i))
    mostrarToast(`Novo ciclo liberado para ${inf.nome}.`)
  }

  const totalAtivos = lista.filter(i => i.ativo).length

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Users size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Influencers</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Cadastro dos influencers da área de Editoras Parceiras · {totalAtivos} ativo{totalAtivos !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('novo')}>
          <Plus size={15} /> Novo influencer
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail ou Instagram..." style={{ paddingLeft: 32, width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 4, borderRadius: 8 }}>
          {[{ k: 'ativos', l: 'Ativos' }, { k: 'inativos', l: 'Inativos' }, { k: 'todos', l: 'Todos' }].map(f => (
            <button key={f.k} onClick={() => setFiltroAtivo(f.k)} style={{
              background: filtroAtivo === f.k ? 'var(--accent)' : 'transparent',
              color: filtroAtivo === f.k ? 'white' : 'var(--text)',
              border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{f.l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : filtrados.length === 0 ? (
        <div className="table-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <Users size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
          <p style={{ margin: 0, fontSize: 14 }}>
            {lista.length === 0 ? 'Nenhum influencer cadastrado ainda. Clique em "Novo influencer" para começar.' : 'Nenhum influencer encontrado com esses filtros.'}
          </p>
        </div>
      ) : (
        <div className="table-card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={th}>Nome</th>
                <th style={th}>E-mail</th>
                <th style={th}>Contato</th>
                <th style={th}>Instagram</th>
                <th style={{ ...th, textAlign: 'center' }}>Limite/mês</th>
                <th style={{ ...th, textAlign: 'center' }}>Situação</th>
                <th style={{ ...th, textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(inf => (
                <tr key={inf.id} style={{ borderBottom: '1px solid var(--border)', opacity: inf.ativo ? 1 : 0.55 }}>
                  <td style={{ ...td, fontWeight: 700, color: 'var(--text)' }}>
                    {inf.nome}
                    {inf.observacoes && <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>{inf.observacoes}</div>}
                  </td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{inf.email}</td>
                  <td style={td}>{inf.contato || '—'}</td>
                  <td style={td}>
                    {inf.instagram ? (
                      <a href={linkInstagram(inf.instagram)} target="_blank" rel="noreferrer"
                        style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AtSign size={12} /> {inf.instagram}
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>
                    {inf.limite_mensal}
                    {inf.ciclo_inicio && (
                      <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>
                        ciclo desde {new Date(inf.ciclo_inicio).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button onClick={() => toggleAtivo(inf)} style={{
                      border: 'none', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      background: inf.ativo ? 'rgba(34,197,94,0.15)' : 'var(--surface-2)',
                      color: inf.ativo ? 'var(--green)' : 'var(--text-muted)',
                    }}>{inf.ativo ? 'Ativo' : 'Inativo'}</button>
                  </td>
                  <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" title="Liberar novo ciclo" onClick={() => liberarNovoCiclo(inf)}>
                      <RefreshCw size={13} />
                    </button>
                    <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => setModal(inf)}>
                      <Edit2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ModalInfluencer
          influencer={modal === 'novo' ? null : modal}
          onSalvar={salvar}
          onFechar={() => setModal(null)}
        />
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

function linkInstagram(valor) {
  const v = (valor || '').trim()
  if (v.startsWith('http')) return v
  return `https://instagram.com/${v.replace(/^@/, '')}`
}

// ── MODAL DE CADASTRO / EDIÇÃO ────────────────────────────────
function ModalInfluencer({ influencer, onSalvar, onFechar }) {
  const [form, setForm] = useState(influencer ? {
    nome: influencer.nome || '',
    email: influencer.email || '',
    contato: influencer.contato || '',
    instagram: influencer.instagram || '',
    limite_mensal: influencer.limite_mensal ?? 1,
    ativo: influencer.ativo ?? true,
    observacoes: influencer.observacoes || '',
  } : FORM_VAZIO)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function handleSalvar() {
    const email = form.email.trim().toLowerCase()
    if (!form.nome.trim()) { setErro('O nome é obrigatório.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErro('Informe um e-mail válido. É com ele que o influencer entra na vitrine.'); return }
    const limite = Number(form.limite_mensal)
    if (!Number.isInteger(limite) || limite < 0) { setErro('O limite mensal precisa ser um número inteiro (0 ou mais).'); return }

    setErro('')
    setSalvando(true)
    try {
      await onSalvar({
        nome: form.nome.trim(),
        email,
        contato: form.contato.trim() || null,
        instagram: form.instagram.trim() || null,
        limite_mensal: limite,
        ativo: form.ativo,
        observacoes: form.observacoes.trim() || null,
      }, influencer?.id)
      onFechar()
    } catch (e) {
      const msg = (e?.message || '').toLowerCase()
      setErro(msg.includes('duplicate') || msg.includes('unique')
        ? 'Já existe um influencer cadastrado com este e-mail.'
        : 'Erro ao salvar: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal" style={{ maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{influencer ? 'Editar influencer' : 'Novo influencer'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar}><X size={16} /></button>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail * (usado para entrar na vitrine)</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Telefone / WhatsApp</label>
              <input className="form-input" value={form.contato} onChange={e => setForm({ ...form, contato: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
            <div className="form-group">
              <label className="form-label">Instagram</label>
              <input className="form-input" value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} placeholder="@perfil" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Limite de livros por mês</label>
              <input className="form-input" type="number" min="0" value={form.limite_mensal} onChange={e => setForm({ ...form, limite_mensal: e.target.value })} />
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 24 }}>
                <input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} />
                Ativo (consegue entrar na vitrine)
              </label>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-textarea" rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
          </div>

          {erro && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--red)' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} /> {erro}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSalvar} disabled={salvando}>
            <Save size={14} /> {salvando ? 'Salvando...' : influencer ? 'Salvar' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.4 }
const td = { padding: '10px 12px', color: 'var(--text-muted)', verticalAlign: 'middle' }
