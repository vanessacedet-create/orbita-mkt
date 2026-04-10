import { useState, useEffect, useMemo } from 'react'
import {
  BookOpen, Search, Plus, X, ChevronDown, Check,
  Users, Filter, LayoutGrid, List, Tag, Inbox,
  ArrowRight, Trash2, CheckSquare, Square, BookMarked,
  Calendar, TrendingUp, AlertCircle
} from 'lucide-react'

// ── CONSTANTES ────────────────────────────────────────────────────────────────

const STATUS_PIPELINE = [
  { value: 'encontrado',     label: 'Encontrado',      cor: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   dot: '#06b6d4' },
  { value: 'prospectado',    label: 'Prospectado',     cor: '#6b7280', bg: 'rgba(107,114,128,0.12)', dot: '#6b7280' },
  { value: 'negociando',     label: 'Negociando',      cor: '#f5a623', bg: 'rgba(245,166,35,0.12)',  dot: '#f5a623' },
  { value: 'acordo_fechado', label: 'Acordo fechado',  cor: '#f97316', bg: 'rgba(249,115,22,0.12)',  dot: '#f97316' },
  { value: 'ativo',          label: 'Ativo',           cor: '#3ecf8e', bg: 'rgba(62,207,142,0.12)',  dot: '#3ecf8e' },
  { value: 'sem_retorno',    label: 'Sem retorno',     cor: '#94a3b8', bg: 'rgba(148,163,184,0.12)', dot: '#94a3b8' },
  { value: 'sem_interesse',  label: 'Sem interesse',   cor: '#f56565', bg: 'rgba(245,101,101,0.12)', dot: '#f56565' },
  { value: 'finalizado',     label: 'Finalizado',      cor: '#a78bfa', bg: 'rgba(167,139,250,0.12)', dot: '#a78bfa' },
]

const NICHOS = ['Romance', 'Romance Dark', 'Fantasia', 'Ficção Científica', 'Terror', 'Suspense', 'Infantil', 'Religioso', 'Autoajuda', 'Filosofia', 'Clássicos', 'Historia']

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// ── MOCK DATA ─────────────────────────────────────────────────────────────────

const MOCK_LIVROS = [
  { id: '1', titulo: 'Saci e o Lobisomem', autor: 'Bruno Garcia', genero: 'Infantil', mes: 'Abril', editora: 'Texugo' },
  { id: '2', titulo: 'Leão XIV', autor: 'Vários Autores', genero: 'Religioso', mes: 'Abril', editora: 'Ecclesiae' },
  { id: '3', titulo: 'Faça Hoje', autor: 'Darius Foroux', genero: 'Autoajuda', mes: 'Maio', editora: 'Auster' },
  { id: '4', titulo: 'O Padrão Bitcoin', autor: 'Saifedean Ammous', genero: 'Filosofia', mes: 'Maio', editora: 'Axia' },
  { id: '5', titulo: 'A Metamorfose', autor: 'Franz Kafka', genero: 'Clássicos', mes: 'Maio', editora: 'Sétimo Selo' },
  { id: '6', titulo: 'Frankenstein', autor: 'Mary Shelley', genero: 'Terror', mes: 'Junho', editora: 'Papillon' },
  { id: '7', titulo: 'Casa Velha', autor: 'Machado de Assis', genero: 'Clássicos', mes: 'Junho', editora: 'Papillon' },
  { id: '8', titulo: 'O Mínimo sobre Estoicismo', autor: 'Editora O Mínimo', genero: 'Filosofia', mes: 'Junho', editora: 'O Mínimo' },
]

const MOCK_CONTATOS = [
  { id: 'c1', nome: 'Amanda Buttchevits', handle: '@amandabuttchevits', nicho: 'Romance', audiencia: 45000, historico: 'Parceira ativa há 6 meses' },
  { id: 'c2', nome: 'Larissa Menegatti', handle: '@livraria.larissa', nicho: 'Clássicos', audiencia: 22000, historico: 'Primeira parceria' },
  { id: 'c3', nome: 'Alexandre Costa', handle: '@alecosta.on', nicho: 'Filosofia', audiencia: 88000, historico: 'Parceiro Bitcoin/Libertarismo' },
  { id: 'c4', nome: 'Ana Clara Cangussu', handle: '@anaclaracangussu', nicho: 'Romance Dark', audiencia: 31000, historico: '' },
  { id: 'c5', nome: 'Adriana Maria', handle: '@adrianamaria', nicho: 'Religioso', audiencia: 15000, historico: 'Foco em conteúdo católico' },
  { id: 'c6', nome: 'Alan Schramm', handle: '@Alan_Schramm', nicho: 'Autoajuda', audiencia: 9800, historico: '' },
  { id: 'c7', nome: 'Alisson Schvambachi', handle: '@alissonbooks', nicho: 'Fantasia', audiencia: 27000, historico: '' },
  { id: 'c8', nome: 'Priscila Antunes', handle: '@priscilaantunes', nicho: 'Autoajuda', audiencia: 52000, historico: 'Alta taxa de conversão' },
  { id: 'c9', nome: 'Eduardo Faria', handle: '@eduardofaria', nicho: 'Suspense', audiencia: 18000, historico: '' },
  { id: 'c10', nome: 'Silvio Grimaldo', handle: '@silviogrimaldo', nicho: 'Historia', audiencia: 41000, historico: '' },
]

const MOCK_CAMPANHAS_INIT = {
  '1': [
    { id: 'cp1', contato_id: 'c1', status: 'ativo', nota: 'Enviou stories excelentes' },
    { id: 'cp2', contato_id: 'c4', status: 'acordo_fechado', nota: '' },
    { id: 'cp3', contato_id: 'c7', status: 'prospectado', nota: '' },
  ],
  '2': [
    { id: 'cp4', contato_id: 'c5', status: 'ativo', nota: '' },
    { id: 'cp5', contato_id: 'c2', status: 'negociando', nota: 'Aguardando retorno sobre cachê' },
  ],
  '3': [
    { id: 'cp6', contato_id: 'c6', status: 'encontrado', nota: '' },
    { id: 'cp7', contato_id: 'c8', status: 'finalizado', nota: 'Publicou 3 reels' },
  ],
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function statusInfo(value) {
  return STATUS_PIPELINE.find(s => s.value === value) || STATUS_PIPELINE[0]
}

function fmtAudiencia(n) {
  if (!n) return '—'
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n/1000).toFixed(0)}K`
  return n
}

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }
  return [toast, show]
}

// ── BADGE STATUS ──────────────────────────────────────────────────────────────

function StatusBadge({ value, small }) {
  const s = statusInfo(value)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, border: `1px solid ${s.cor}40`,
      borderRadius: 20, padding: small ? '2px 8px' : '3px 10px',
      fontSize: small ? 10 : 11, fontWeight: 700, color: s.cor,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.cor, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

// ── SELECT DE STATUS ──────────────────────────────────────────────────────────

function StatusSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const s = statusInfo(value)
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: s.bg, border: `1px solid ${s.cor}50`,
          borderRadius: 20, padding: '3px 10px', fontSize: 11,
          fontWeight: 700, color: s.cor, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.cor }} />
        {s.label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 4, zIndex: 50, minWidth: 170,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {STATUS_PIPELINE.map(st => (
              <button key={st.value} onClick={e => { e.stopPropagation(); onChange(st.value); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: value === st.value ? st.bg : 'transparent',
                  color: value === st.value ? st.cor : 'var(--text-soft)',
                  fontSize: 12, fontWeight: value === st.value ? 700 : 400,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (value !== st.value) e.currentTarget.style.background = 'var(--surface-3)' }}
                onMouseLeave={e => { if (value !== st.value) e.currentTarget.style.background = 'transparent' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.cor, flexShrink: 0 }} />
                {st.label}
                {value === st.value && <Check size={11} style={{ marginLeft: 'auto' }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── MODAL ADICIONAR CONTATOS ──────────────────────────────────────────────────

function ModalAdicionarContatos({ livro, contatosJaAdicionados, todosContatos, onSave, onClose }) {
  const [search, setSearch] = useState('')
  const [filtroNicho, setFiltroNicho] = useState('')
  const [selecionados, setSelecionados] = useState([])

  const disponiveis = todosContatos.filter(c => {
    if (contatosJaAdicionados.includes(c.id)) return false
    if (filtroNicho && c.nicho !== filtroNicho) return false
    const q = search.toLowerCase()
    if (q && !c.nome.toLowerCase().includes(q) && !c.handle.toLowerCase().includes(q)) return false
    return true
  })

  function toggle(id) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleAll() {
    if (selecionados.length === disponiveis.length) setSelecionados([])
    else setSelecionados(disponiveis.map(c => c.id))
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10, borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="modal-title">Adicionar contatos</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {livro.titulo} — {selecionados.length > 0 ? `${selecionados.length} selecionados` : 'Base geral'}
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="search-input" style={{ paddingLeft: 30, width: '100%' }}
              placeholder="Buscar por nome ou @handle..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 'auto', fontSize: 12 }}
            value={filtroNicho} onChange={e => setFiltroNicho(e.target.value)}>
            <option value="">Todos os nichos</option>
            {NICHOS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
          {disponiveis.length === 0
            ? <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Nenhum contato disponível
              </div>
            : <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', marginBottom: 4 }}>
                  <button onClick={toggleAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    {selecionados.length === disponiveis.length
                      ? <CheckSquare size={14} color="var(--accent)" />
                      : <Square size={14} />}
                    Selecionar todos ({disponiveis.length})
                  </button>
                </div>
                {disponiveis.map(c => {
                  const sel = selecionados.includes(c.id)
                  return (
                    <div key={c.id} onClick={() => toggle(c.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        background: sel ? 'var(--accent-glow)' : 'transparent',
                        border: `1px solid ${sel ? 'var(--accent)40' : 'transparent'}`,
                        marginBottom: 4, transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--surface-2)' }}
                      onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}>
                      <div style={{ flexShrink: 0 }}>
                        {sel
                          ? <CheckSquare size={16} color="var(--accent)" />
                          : <Square size={16} color="var(--text-muted)" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{c.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.handle} · {c.nicho} · {fmtAudiencia(c.audiencia)} seguidores</div>
                      </div>
                    </div>
                  )
                })}
              </>
          }
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={selecionados.length === 0}
            onClick={() => { onSave(selecionados); onClose() }}>
            <Plus size={14} /> Adicionar {selecionados.length > 0 ? selecionados.length : ''} contato{selecionados.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL DETALHE CONTATO ─────────────────────────────────────────────────────

function ModalDetalhe({ entrada, contato, onStatusChange, onRemover, onClose }) {
  const [nota, setNota] = useState(entrada.nota || '')
  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{contato.nome}</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{contato.handle}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', color: 'var(--text-soft)' }}>
              <Tag size={10} style={{ marginRight: 4 }} />{contato.nicho}
            </span>
            <span style={{ fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', color: 'var(--text-soft)' }}>
              <Users size={10} style={{ marginRight: 4 }} />{fmtAudiencia(contato.audiencia)} seguidores
            </span>
          </div>

          {contato.historico && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px', borderLeft: '3px solid var(--accent)' }}>
              {contato.historico}
            </div>
          )}

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Status na campanha</label>
            <StatusSelect value={entrada.status} onChange={v => onStatusChange(entrada.id, v)} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Nota interna</label>
            <textarea className="form-textarea" rows={3} value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Observações sobre esta parceria..." />
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn btn-danger btn-sm" onClick={() => { onRemover(entrada.id); onClose() }}>
            <Trash2 size={13} /> Remover da campanha
          </button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────

export default function CRMLiterario() {
  const [livros] = useState(MOCK_LIVROS)
  const [contatos] = useState(MOCK_CONTATOS)
  const [campanhas, setCampanhas] = useState(MOCK_CAMPANHAS_INIT)
  const [livroSelecionado, setLivroSelecionado] = useState(MOCK_LIVROS[0])
  const [mesAtivo, setMesAtivo] = useState('Abril')
  const [viewMode, setViewMode] = useState('kanban') // 'kanban' | 'lista'
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroNicho, setFiltroNicho] = useState('')
  const [selecionados, setSelecionados] = useState([])
  const [bulkStatus, setBulkStatus] = useState('')
  const [modalAdicionar, setModalAdicionar] = useState(false)
  const [modalDetalhe, setModalDetalhe] = useState(null)
  const [toast, showToast] = useToast()

  // Entradas da campanha do livro atual
  const entradasLivro = useMemo(() => campanhas[livroSelecionado?.id] || [], [campanhas, livroSelecionado])

  // Contatos com dados enriquecidos
  const contatosLivro = useMemo(() => {
    return entradasLivro
      .map(e => ({ ...e, contato: contatos.find(c => c.id === e.contato_id) }))
      .filter(e => {
        if (!e.contato) return false
        if (filtroStatus && e.status !== filtroStatus) return false
        if (filtroNicho && e.contato.nicho !== filtroNicho) return false
        const q = search.toLowerCase()
        if (q && !e.contato.nome.toLowerCase().includes(q) && !e.contato.handle.toLowerCase().includes(q)) return false
        return true
      })
  }, [entradasLivro, contatos, filtroStatus, filtroNicho, search])

  const livrosFiltradosMes = useMemo(() => livros.filter(l => l.mes === mesAtivo), [livros, mesAtivo])
  const mesesComLivros = useMemo(() => [...new Set(livros.map(l => l.mes))], [livros])

  // Stats do livro atual
  const stats = useMemo(() => {
    const total = entradasLivro.length
    const ativos = entradasLivro.filter(e => e.status === 'ativo').length
    const finalizados = entradasLivro.filter(e => e.status === 'finalizado').length
    const pendentes = entradasLivro.filter(e => ['encontrado', 'prospectado', 'negociando', 'acordo_fechado'].includes(e.status)).length
    return { total, ativos, finalizados, pendentes }
  }, [entradasLivro])

  // Kanban agrupado
  const porStatus = useMemo(() => {
    const grupos = {}
    for (const st of STATUS_PIPELINE) {
      grupos[st.value] = contatosLivro.filter(e => e.status === st.value)
    }
    return grupos
  }, [contatosLivro])

  function handleAdicionarContatos(ids) {
    const novas = ids.map(cid => ({
      id: `cp_${Date.now()}_${cid}`,
      contato_id: cid,
      status: 'encontrado',
      nota: '',
    }))
    setCampanhas(prev => ({
      ...prev,
      [livroSelecionado.id]: [...(prev[livroSelecionado.id] || []), ...novas],
    }))
    showToast(`${ids.length} contato${ids.length > 1 ? 's' : ''} adicionado${ids.length > 1 ? 's' : ''} à campanha!`)
  }

  function handleStatusChange(entradaId, novoStatus) {
    setCampanhas(prev => ({
      ...prev,
      [livroSelecionado.id]: prev[livroSelecionado.id].map(e =>
        e.id === entradaId ? { ...e, status: novoStatus } : e
      ),
    }))
    showToast(`Status atualizado para ${statusInfo(novoStatus).label}`)
  }

  function handleRemover(entradaId) {
    setCampanhas(prev => ({
      ...prev,
      [livroSelecionado.id]: prev[livroSelecionado.id].filter(e => e.id !== entradaId),
    }))
    showToast('Contato removido da campanha')
  }

  function handleBulkStatus() {
    if (!bulkStatus || selecionados.length === 0) return
    setCampanhas(prev => ({
      ...prev,
      [livroSelecionado.id]: prev[livroSelecionado.id].map(e =>
        selecionados.includes(e.id) ? { ...e, status: bulkStatus } : e
      ),
    }))
    showToast(`${selecionados.length} contato${selecionados.length > 1 ? 's' : ''} atualizados para "${statusInfo(bulkStatus).label}"`)
    setSelecionados([])
    setBulkStatus('')
  }

  function toggleSelecionar(id) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleTodos() {
    if (selecionados.length === contatosLivro.length) setSelecionados([])
    else setSelecionados(contatosLivro.map(e => e.id))
  }

  const contatosJaAdicionados = entradasLivro.map(e => e.contato_id)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── SIDEBAR DE LIVROS ── */}
      <aside style={{
        width: 260, flexShrink: 0,
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BookMarked size={16} color="var(--accent)" />
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Lançamentos</span>
          </div>
          {/* Seletor de mês */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {mesesComLivros.map(mes => (
              <button key={mes} onClick={() => setMesAtivo(mes)}
                style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', border: '1px solid',
                  borderColor: mesAtivo === mes ? 'var(--accent)' : 'var(--border)',
                  background: mesAtivo === mes ? 'var(--accent-glow)' : 'transparent',
                  color: mesAtivo === mes ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}>
                {mes}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
          {livrosFiltradosMes.length === 0
            ? <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                Nenhum livro neste mês
              </div>
            : livrosFiltradosMes.map(livro => {
              const entradas = campanhas[livro.id] || []
              const ativo = livroSelecionado?.id === livro.id
              return (
                <button key={livro.id} onClick={() => { setLivroSelecionado(livro); setSelecionados([]) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${ativo ? 'var(--accent)40' : 'transparent'}`,
                    background: ativo ? 'var(--accent-glow)' : 'transparent',
                    marginBottom: 3, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!ativo) e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { if (!ativo) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: ativo ? 'var(--accent)' : 'var(--text)', marginBottom: 2, lineHeight: 1.3 }}>
                    {livro.titulo}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{livro.autor}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
                    <span style={{ fontSize: 10, background: 'var(--surface-3)', borderRadius: 4, padding: '1px 6px', color: 'var(--text-muted)' }}>
                      {livro.editora}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {entradas.length} contato{entradas.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              )
            })
          }
        </div>
      </aside>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                {livroSelecionado?.titulo}
              </h1>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                {livroSelecionado?.autor} · {livroSelecionado?.editora} · {livroSelecionado?.mes}
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setModalAdicionar(true)} style={{ flexShrink: 0 }}>
              <Plus size={14} /> Adicionar contatos
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Total', value: stats.total, cor: 'var(--text-soft)', icon: Users },
              { label: 'Ativos', value: stats.ativos, cor: '#3ecf8e', icon: TrendingUp },
              { label: 'Finalizados', value: stats.finalizados, cor: '#a78bfa', icon: Check },
              { label: 'Em andamento', value: stats.pendentes, cor: '#f5a623', icon: AlertCircle },
            ].map(({ label, value, cor, icon: Icon }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '7px 12px',
              }}>
                <Icon size={13} color={cor} />
                <span style={{ fontSize: 13, fontWeight: 700, color: cor }}>{value}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="search-input" style={{ paddingLeft: 30, width: 200 }}
                placeholder="Buscar contato..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
              value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {STATUS_PIPELINE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
              value={filtroNicho} onChange={e => setFiltroNicho(e.target.value)}>
              <option value="">Todos os nichos</option>
              {NICHOS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            {(filtroStatus || filtroNicho || search) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setFiltroStatus(''); setFiltroNicho(''); setSearch('') }}>
                <X size={12} /> Limpar
              </button>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('kanban')} title="Kanban">
                <LayoutGrid size={14} />
              </button>
              <button className={`btn btn-sm ${viewMode === 'lista' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('lista')} title="Lista">
                <List size={14} />
              </button>
            </div>
          </div>

          {/* Bulk actions */}
          {selecionados.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginTop: 10,
              background: 'var(--accent-glow)', border: '1px solid var(--accent)40',
              borderRadius: 8, padding: '8px 14px',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                {selecionados.length} selecionado{selecionados.length > 1 ? 's' : ''}
              </span>
              <ArrowRight size={12} color="var(--text-muted)" />
              <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
                value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}>
                <option value="">Mover para...</option>
                {STATUS_PIPELINE.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" disabled={!bulkStatus} onClick={handleBulkStatus}>
                Aplicar
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelecionados([])}>
                <X size={12} /> Cancelar
              </button>
            </div>
          )}
        </div>

        {/* ── KANBAN ── */}
        {viewMode === 'kanban' && (
          <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '16px 24px' }}>
            <div style={{ display: 'flex', gap: 12, height: '100%', minWidth: 'max-content' }}>
              {STATUS_PIPELINE.map(st => {
                const items = porStatus[st.value] || []
                return (
                  <div key={st.value} style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                      padding: '6px 10px', background: st.bg,
                      border: `1px solid ${st.cor}30`, borderRadius: 8,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.cor }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: st.cor, flex: 1 }}>{st.label}</span>
                      <span style={{ fontSize: 11, color: st.cor, background: 'var(--surface)', border: `1px solid ${st.cor}30`, borderRadius: 20, padding: '1px 7px' }}>
                        {items.length}
                      </span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
                      {items.length === 0
                        ? <div style={{ padding: '16px 10px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>Vazio</div>
                        : items.map(entrada => {
                          const c = entrada.contato
                          const sel = selecionados.includes(entrada.id)
                          return (
                            <div key={entrada.id}
                              style={{
                                background: sel ? 'var(--accent-glow)' : 'var(--surface)',
                                border: `1px solid ${sel ? 'var(--accent)40' : 'var(--border)'}`,
                                borderRadius: 8, padding: '10px 12px', marginBottom: 7,
                                cursor: 'pointer', transition: 'border-color 0.15s',
                              }}
                              onClick={() => setModalDetalhe({ entrada, contato: c })}
                              onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--accent)' }}
                              onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                                <button onClick={ev => { ev.stopPropagation(); toggleSelecionar(entrada.id) }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 1, flexShrink: 0 }}>
                                  {sel ? <CheckSquare size={13} color="var(--accent)" /> : <Square size={13} color="var(--text-muted)" />}
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c?.nome}
                                  </div>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c?.handle}</div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                <span style={{ fontSize: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', color: 'var(--text-muted)' }}>
                                  {c?.nicho}
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>
                                  {fmtAudiencia(c?.audiencia)}
                                </span>
                              </div>
                              {entrada.nota && (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {entrada.nota}
                                </div>
                              )}
                            </div>
                          )
                        })
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── LISTA ── */}
        {viewMode === 'lista' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            {contatosLivro.length === 0
              ? <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Inbox size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
                  <div style={{ fontSize: 14 }}>Nenhum contato nesta campanha</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Clique em "Adicionar contatos" para começar</div>
                </div>
              : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: 32 }}>
                        <button onClick={toggleTodos} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                          {selecionados.length === contatosLivro.length && contatosLivro.length > 0
                            ? <CheckSquare size={14} color="var(--accent)" />
                            : <Square size={14} />}
                        </button>
                      </th>
                      {['Contato', 'Handle', 'Nicho', 'Audiência', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contatosLivro.map(entrada => {
                      const c = entrada.contato
                      const sel = selecionados.includes(entrada.id)
                      return (
                        <tr key={entrada.id}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: sel ? 'var(--accent-glow)' : 'transparent',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--surface-2)' }}
                          onMouseLeave={e => { if (!sel) e.currentTarget.style.background = sel ? 'var(--accent-glow)' : 'transparent' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <button onClick={() => toggleSelecionar(entrada.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                              {sel ? <CheckSquare size={14} color="var(--accent)" /> : <Square size={14} color="var(--text-muted)" />}
                            </button>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}
                            onClick={() => setModalDetalhe({ entrada, contato: c })}>
                            {c?.nome}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{c?.handle}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-soft)' }}>{c?.nicho}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-soft)', fontWeight: 700 }}>{fmtAudiencia(c?.audiencia)}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <StatusSelect value={entrada.status} onChange={v => handleStatusChange(entrada.id, v)} />
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <button className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => setModalDetalhe({ entrada, contato: c })}>
                              <BookOpen size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
            }
          </div>
        )}
      </div>

      {/* ── MODAIS ── */}
      {modalAdicionar && (
        <ModalAdicionarContatos
          livro={livroSelecionado}
          contatosJaAdicionados={contatosJaAdicionados}
          todosContatos={contatos}
          onSave={handleAdicionarContatos}
          onClose={() => setModalAdicionar(false)}
        />
      )}

      {modalDetalhe && (
        <ModalDetalhe
          entrada={modalDetalhe.entrada}
          contato={modalDetalhe.contato}
          onStatusChange={handleStatusChange}
          onRemover={handleRemover}
          onClose={() => setModalDetalhe(null)}
        />
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className={`toast ${toast.type}`} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
