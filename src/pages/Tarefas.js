import { useEffect, useState, useRef } from 'react'
import {
  getTarefas, createTarefa, updateTarefa, deleteTarefa,
  addChecklistItem, updateChecklistItem, deleteChecklistItem,
  addComentario, getParceiros
} from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Plus, X, Pencil, Trash2, CheckSquare, Square, MessageSquare,
  Calendar, Flag, User, ChevronDown, List, Columns, Clock,
  AlertCircle, ArrowUp, Minus, CheckCircle2, Circle, LayoutList
} from 'lucide-react'
import { format, isPast, isToday, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── CONSTANTES ─────────────────────────────────────────────
const STATUS = [
  { value: 'a_fazer',      label: 'A fazer',       cls: 'badge-indigo', icon: Circle },
  { value: 'em_andamento', label: 'Em andamento',  cls: 'badge-amber',  icon: Clock },
  { value: 'concluido',    label: 'Concluído',     cls: 'badge-green',  icon: CheckCircle2 },
]

const PRIORIDADE = [
  { value: 'urgente', label: 'Urgente', color: '#ef4444', icon: AlertCircle },
  { value: 'alta',    label: 'Alta',    color: '#f97316', icon: ArrowUp },
  { value: 'media',   label: 'Média',   color: '#eab308', icon: Minus },
  { value: 'baixa',   label: 'Baixa',   color: '#6b7280', icon: ChevronDown },
]

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }
  return [toast, show]
}

function PrioridadeBadge({ value }) {
  const p = PRIORIDADE.find(x => x.value === value) || PRIORIDADE[2]
  const Icon = p.icon
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, color: p.color }}>
      <Icon size={11}/>{p.label}
    </span>
  )
}

function StatusBadge({ value }) {
  const s = STATUS.find(x => x.value === value) || STATUS[0]
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

function PrazoBadge({ data_prazo, status }) {
  if (!data_prazo || status === 'concluido') return null
  const d = new Date(data_prazo + 'T12:00:00')
  const hoje = isToday(d)
  const atrasada = isPast(d) && !hoje
  const dias = differenceInDays(d, new Date())
  const cor = atrasada ? 'var(--red)' : hoje ? 'var(--amber)' : dias <= 2 ? 'var(--amber)' : 'var(--text-muted)'
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color: cor, fontWeight: atrasada||hoje ? 700 : 400 }}>
      <Calendar size={11}/>
      {atrasada ? `Atrasada ${Math.abs(dias)}d` : hoje ? 'Hoje' : format(d, 'dd/MM', { locale: ptBR })}
    </span>
  )
}

// ── MODAL TAREFA ───────────────────────────────────────────
function ModalTarefa({ tarefa, usuarios, onSave, onClose, onDelete }) {
  const { usuario } = useAuth()
  const EMPTY = { titulo:'', descricao:'', status:'a_fazer', prioridade:'media', responsavel_id:'', data_prazo:'' }
  const [form, setForm] = useState(tarefa ? {
    titulo:          tarefa.titulo,
    descricao:       tarefa.descricao || '',
    status:          tarefa.status,
    prioridade:      tarefa.prioridade,
    responsavel_id:  tarefa.responsavel_id || '',
    data_prazo:      tarefa.data_prazo || '',
  } : EMPTY)
  const [checklist, setChecklist]   = useState(tarefa?.tarefa_checklist || [])
  const [comentarios, setComentarios] = useState(tarefa?.tarefa_comentarios || [])
  const [novoItem, setNovoItem]     = useState('')
  const [novoComent, setNovoComent] = useState('')
  const [saving, setSaving]         = useState(false)
  const [tab, setTab]               = useState('detalhes') // detalhes | checklist | comentarios
  const checkInputRef = useRef()

  async function salvar() {
    if (!form.titulo.trim()) return
    setSaving(true)
    try {
      await onSave({
        ...form,
        responsavel_id: form.responsavel_id || null,
        data_prazo:     form.data_prazo || null,
        created_by:     tarefa ? undefined : usuario?.id,
      }, tarefa?.id)
      onClose()
    } catch(e) { console.error(e) } finally { setSaving(false) }
  }

  async function addItem() {
    if (!novoItem.trim() || !tarefa) return
    const item = await addChecklistItem(tarefa.id, novoItem.trim())
    setChecklist(prev => [...prev, item])
    setNovoItem('')
    checkInputRef.current?.focus()
  }

  async function toggleItem(item) {
    const upd = await updateChecklistItem(item.id, { concluido: !item.concluido })
    setChecklist(prev => prev.map(x => x.id === upd.id ? upd : x))
  }

  async function removeItem(id) {
    await deleteChecklistItem(id)
    setChecklist(prev => prev.filter(x => x.id !== id))
  }

  async function enviarComentario() {
    if (!novoComent.trim() || !tarefa) return
    const c = await addComentario(tarefa.id, usuario?.id, novoComent.trim())
    setComentarios(prev => [...prev, c])
    setNovoComent('')
  }

  const checkDone = checklist.filter(x => x.concluido).length
  const checkTotal = checklist.length
  const checkPct = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0

  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ position:'sticky', top:0, background:'var(--surface)', zIndex:10 }}>
          <h2 className="modal-title">{tarefa ? 'Editar tarefa' : 'Nova tarefa'}</h2>
          <div style={{ display:'flex', gap:8 }}>
            {tarefa && <button className="btn btn-danger btn-sm" onClick={()=>{ onDelete(tarefa.id); onClose() }}><Trash2 size={13}/></button>}
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
          </div>
        </div>

        {/* Tabs — só mostrar se editando tarefa existente */}
        {tarefa && (
          <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border)', marginBottom:16 }}>
            {[
              { id:'detalhes',   label:'Detalhes' },
              { id:'checklist',  label:`Checklist ${checkTotal > 0 ? `(${checkDone}/${checkTotal})` : ''}` },
              { id:'comentarios', label:`Comentários (${comentarios.length})` },
            ].map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                padding:'8px 16px', fontSize:12, fontWeight:700, border:'none', cursor:'pointer',
                background:'transparent', borderBottom: tab===t.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab===t.id ? 'var(--accent)' : 'var(--text-muted)', transition:'all 0.15s'
              }}>{t.label}</button>
            ))}
          </div>
        )}

        {/* TAB DETALHES */}
        {tab === 'detalhes' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Título *</label>
              <input className="form-input" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} placeholder="O que precisa ser feito?"/>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <textarea className="form-textarea" rows={3} value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Detalhes, contexto, links..."/>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  {STATUS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Prioridade</label>
                <select className="form-select" value={form.prioridade} onChange={e=>setForm(f=>({...f,prioridade:e.target.value}))}>
                  {PRIORIDADE.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Responsável</label>
                <select className="form-select" value={form.responsavel_id} onChange={e=>setForm(f=>({...f,responsavel_id:e.target.value}))}>
                  <option value="">Sem responsável</option>
                  {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Prazo</label>
                <input className="form-input" type="date" value={form.data_prazo} onChange={e=>setForm(f=>({...f,data_prazo:e.target.value}))}/>
              </div>
            </div>
          </div>
        )}

        {/* TAB CHECKLIST */}
        {tab === 'checklist' && (
          <div>
            {checkTotal > 0 && (
              <div style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>
                  <span>{checkDone} de {checkTotal} concluídos</span>
                  <span>{checkPct}%</span>
                </div>
                <div style={{ height:4, borderRadius:99, background:'var(--surface-3)' }}>
                  <div style={{ height:'100%', width:`${checkPct}%`, background:'var(--green)', borderRadius:99, transition:'width 0.3s' }}/>
                </div>
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
              {checklist.sort((a,b)=>a.ordem-b.ordem).map(item => (
                <div key={item.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:'var(--surface-2)', borderRadius:8 }}>
                  <button onClick={()=>toggleItem(item)} style={{ background:'none', border:'none', cursor:'pointer', color: item.concluido ? 'var(--green)' : 'var(--text-muted)', padding:0, display:'flex', flexShrink:0 }}>
                    {item.concluido ? <CheckSquare size={16}/> : <Square size={16}/>}
                  </button>
                  <span style={{ flex:1, fontSize:13, color: item.concluido ? 'var(--text-muted)' : 'var(--text)', textDecoration: item.concluido ? 'line-through' : 'none' }}>{item.texto}</span>
                  <button onClick={()=>removeItem(item.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex', opacity:0.5 }}><X size={12}/></button>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input ref={checkInputRef} className="form-input" value={novoItem} onChange={e=>setNovoItem(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&addItem()} placeholder="Adicionar item..." style={{ flex:1 }}/>
              <button className="btn btn-primary btn-sm" onClick={addItem} disabled={!novoItem.trim()}><Plus size={14}/></button>
            </div>
          </div>
        )}

        {/* TAB COMENTÁRIOS */}
        {tab === 'comentarios' && (
          <div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
              {comentarios.length === 0
                ? <p style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', padding:'20px 0' }}>Nenhum comentário ainda.</p>
                : comentarios.map(c => (
                  <div key={c.id} style={{ background:'var(--surface-2)', borderRadius:8, padding:'10px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--accent-glow)', border:'1px solid var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'var(--accent)', flexShrink:0 }}>
                        {(c.usuario?.nome||'?')[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{c.usuario?.nome||'Usuário'}</span>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>{format(new Date(c.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                    <p style={{ fontSize:13, color:'var(--text)', margin:0, whiteSpace:'pre-wrap' }}>{c.texto}</p>
                  </div>
                ))
              }
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <textarea className="form-textarea" rows={2} value={novoComent} onChange={e=>setNovoComent(e.target.value)}
                placeholder="Escreva um comentário..." style={{ flex:1, resize:'none' }}/>
              <button className="btn btn-primary btn-sm" onClick={enviarComentario} disabled={!novoComent.trim()} style={{ alignSelf:'flex-end' }}>
                <MessageSquare size={14}/>
              </button>
            </div>
          </div>
        )}

        <div className="form-actions" style={{ marginTop:16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving||!form.titulo.trim()}>
            {saving ? 'Salvando...' : tarefa ? 'Salvar' : 'Criar tarefa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CARD KANBAN ────────────────────────────────────────────
function CardKanban({ tarefa, onClick }) {
  const checkTotal = tarefa.tarefa_checklist?.length || 0
  const checkDone  = tarefa.tarefa_checklist?.filter(x=>x.concluido).length || 0
  const p = PRIORIDADE.find(x => x.value === tarefa.prioridade)

  return (
    <div onClick={onClick} style={{
      background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10,
      padding:'12px 14px', cursor:'pointer', transition:'all 0.15s',
      borderLeft: `3px solid ${p?.color||'var(--border)'}`,
    }}
    onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-1px)' }}
    onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'; e.currentTarget.style.borderLeftColor=p?.color||'var(--border)' }}>
      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:8, lineHeight:1.4 }}>{tarefa.titulo}</div>
      {tarefa.descricao && (
        <div style={{ fontSize:11.5, color:'var(--text-muted)', marginBottom:8, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{tarefa.descricao}</div>
      )}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <PrioridadeBadge value={tarefa.prioridade}/>
          {checkTotal > 0 && (
            <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}>
              <CheckSquare size={11}/> {checkDone}/{checkTotal}
            </span>
          )}
          {(tarefa.tarefa_comentarios?.length||0) > 0 && (
            <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}>
              <MessageSquare size={11}/> {tarefa.tarefa_comentarios.length}
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <PrazoBadge data_prazo={tarefa.data_prazo} status={tarefa.status}/>
          {tarefa.responsavel?.nome && (
            <div title={tarefa.responsavel.nome} style={{ width:22, height:22, borderRadius:'50%', background:'var(--accent-glow)', border:'1px solid var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'var(--accent)' }}>
              {tarefa.responsavel.nome[0].toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function Tarefas() {
  const { usuario } = useAuth()
  const [tarefas, setTarefas]       = useState([])
  const [usuarios, setUsuarios]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(null) // null | 'new' | tarefa obj
  const [view, setView]             = useState('kanban') // kanban | lista
  const [filtroStatus, setFiltroStatus]       = useState('todos')
  const [filtroPrioridade, setFiltroPrioridade] = useState('todas')
  const [filtroResponsavel, setFiltroResponsavel] = useState('todos')
  const [toast, showToast]          = useToast()

  async function carregar() {
    setLoading(true)
    try {
      const [t, u] = await Promise.all([getTarefas(), getParceiros()])
      setTarefas(t)
      // Busca usuarios do supabase
      const { data: us } = await import('../lib/supabase').then(m => m.supabase.from('usuarios').select('id, nome').order('nome'))
      setUsuarios(us || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  async function handleSave(form, id) {
    if (id) {
      const upd = await updateTarefa(id, form)
      setTarefas(prev => prev.map(t => t.id === upd.id ? upd : t))
      showToast('Tarefa atualizada!')
    } else {
      const nova = await createTarefa(form)
      setTarefas(prev => [nova, ...prev])
      showToast('Tarefa criada!')
    }
  }

  async function handleDelete(id) {
    await deleteTarefa(id)
    setTarefas(prev => prev.filter(t => t.id !== id))
    showToast('Tarefa excluída!')
  }

  async function handleStatusChange(tarefa, novoStatus) {
    const upd = await updateTarefa(tarefa.id, { status: novoStatus })
    setTarefas(prev => prev.map(t => t.id === upd.id ? upd : t))
  }

  // Filtros
  const tarefasFiltradas = tarefas.filter(t => {
    if (filtroStatus !== 'todos' && t.status !== filtroStatus) return false
    if (filtroPrioridade !== 'todas' && t.prioridade !== filtroPrioridade) return false
    if (filtroResponsavel !== 'todos') {
      if (filtroResponsavel === 'minha' && t.responsavel_id !== usuario?.id) return false
      if (filtroResponsavel !== 'minha' && t.responsavel_id !== filtroResponsavel) return false
    }
    return true
  })

  const porStatus = STATUS.reduce((acc, s) => {
    acc[s.value] = tarefasFiltradas.filter(t => t.status === s.value)
    return acc
  }, {})

  const totalAtrasadas = tarefas.filter(t => t.data_prazo && t.status !== 'concluido' && isPast(new Date(t.data_prazo + 'T12:00:00')) && !isToday(new Date(t.data_prazo + 'T12:00:00'))).length

  if (loading) return <div className="loading"><div className="spinner"/></div>

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <LayoutList size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{ margin:0 }}>Tarefas</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>
              {tarefas.filter(t=>t.status!=='concluido').length} pendentes
              {totalAtrasadas > 0 && <span style={{ color:'var(--red)', marginLeft:8 }}>· {totalAtrasadas} atrasada{totalAtrasadas!==1?'s':''}</span>}
            </p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {/* Toggle view */}
          <div style={{ display:'flex', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
            <button onClick={()=>setView('kanban')} style={{ padding:'7px 12px', border:'none', cursor:'pointer', background: view==='kanban' ? 'var(--accent)' : 'transparent', color: view==='kanban' ? '#fff' : 'var(--text-muted)', transition:'all 0.15s', display:'flex', alignItems:'center', gap:5, fontSize:12 }}>
              <Columns size={13}/> Kanban
            </button>
            <button onClick={()=>setView('lista')} style={{ padding:'7px 12px', border:'none', cursor:'pointer', background: view==='lista' ? 'var(--accent)' : 'transparent', color: view==='lista' ? '#fff' : 'var(--text-muted)', transition:'all 0.15s', display:'flex', alignItems:'center', gap:5, fontSize:12 }}>
              <List size={13}/> Lista
            </button>
          </div>
          <button className="btn btn-primary" onClick={()=>setModal('new')}><Plus size={14}/> Nova tarefa</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }}
          value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          {STATUS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }}
          value={filtroPrioridade} onChange={e=>setFiltroPrioridade(e.target.value)}>
          <option value="todas">Todas as prioridades</option>
          {PRIORIDADE.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }}
          value={filtroResponsavel} onChange={e=>setFiltroResponsavel(e.target.value)}>
          <option value="todos">Todos os responsáveis</option>
          <option value="minha">Minhas tarefas</option>
          {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        {(filtroStatus!=='todos'||filtroPrioridade!=='todas'||filtroResponsavel!=='todos') && (
          <button className="btn btn-ghost btn-sm" onClick={()=>{ setFiltroStatus('todos'); setFiltroPrioridade('todas'); setFiltroResponsavel('todos') }}>
            <X size={12}/> Limpar filtros
          </button>
        )}
      </div>

      {/* KANBAN */}
      {view === 'kanban' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, alignItems:'start' }}>
          {STATUS.map(s => {
            const Icon = s.icon
            const lista = porStatus[s.value] || []
            return (
              <div key={s.value} style={{ background:'var(--surface-2)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>
                {/* Header coluna */}
                <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Icon size={14} color={s.value==='concluido'?'var(--green)':s.value==='em_andamento'?'var(--amber)':'var(--indigo)'}/>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', background:'var(--surface-3)', borderRadius:20, padding:'2px 8px' }}>{lista.length}</span>
                </div>
                {/* Cards */}
                <div style={{ padding:'10px', display:'flex', flexDirection:'column', gap:8, minHeight:100 }}>
                  {lista.length === 0
                    ? <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:'20px 0', opacity:0.5 }}>Nenhuma tarefa</div>
                    : lista.map(t => <CardKanban key={t.id} tarefa={t} onClick={()=>setModal(t)}/>)
                  }
                  <button onClick={()=>setModal('new')} style={{
                    width:'100%', padding:'8px', border:'1px dashed var(--border)', borderRadius:8,
                    background:'transparent', cursor:'pointer', fontSize:12, color:'var(--text-muted)',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginTop:4,
                    transition:'all 0.15s'
                  }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--accent)' }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-muted)' }}>
                    <Plus size={12}/> Adicionar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* LISTA */}
      {view === 'lista' && (
        <div className="table-card">
          {tarefasFiltradas.length === 0
            ? <div className="empty-state"><p>Nenhuma tarefa encontrada.</p></div>
            : <table>
                <thead>
                  <tr>
                    <th>Tarefa</th>
                    <th>Status</th>
                    <th>Prioridade</th>
                    <th>Responsável</th>
                    <th>Prazo</th>
                    <th>Progresso</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tarefasFiltradas.map(t => {
                    const checkTotal = t.tarefa_checklist?.length || 0
                    const checkDone  = t.tarefa_checklist?.filter(x=>x.concluido).length || 0
                    return (
                      <tr key={t.id} style={{ cursor:'pointer' }} onClick={()=>setModal(t)}>
                        <td>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{t.titulo}</div>
                          {t.descricao && <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', maxWidth:280 }}>{t.descricao}</div>}
                        </td>
                        <td><StatusBadge value={t.status}/></td>
                        <td><PrioridadeBadge value={t.prioridade}/></td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{t.responsavel?.nome || '—'}</td>
                        <td><PrazoBadge data_prazo={t.data_prazo} status={t.status}/></td>
                        <td style={{ minWidth:80 }}>
                          {checkTotal > 0 ? (
                            <div>
                              <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>{checkDone}/{checkTotal}</div>
                              <div style={{ height:3, borderRadius:99, background:'var(--surface-3)' }}>
                                <div style={{ height:'100%', width:`${Math.round(checkDone/checkTotal*100)}%`, background:'var(--green)', borderRadius:99 }}/>
                              </div>
                            </div>
                          ) : '—'}
                        </td>
                        <td onClick={e=>e.stopPropagation()}>
                          <div className="actions-cell">
                            <select className="form-select" style={{ padding:'4px 8px', fontSize:11, width:'auto' }}
                              value={t.status}
                              onChange={e=>handleStatusChange(t, e.target.value)}>
                              {STATUS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                            <button className="btn btn-danger btn-icon btn-sm" onClick={()=>handleDelete(t.id)}><Trash2 size={12}/></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
          }
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ModalTarefa
          tarefa={modal === 'new' ? null : modal}
          usuarios={usuarios}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={()=>setModal(null)}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
