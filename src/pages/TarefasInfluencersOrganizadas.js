import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, AlertTriangle, CalendarDays, Users, Database, ListTodo, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getUsuarios } from '../lib/supabase'
import { getAtribuicoes, updateAtribuicao } from '../lib/banco-tarefas'
import TarefasInfluencersLegado from './TarefasInfluencers'

const STATUS = {
  a_fazer: { label: 'A fazer', color: '#6b7280' },
  em_andamento: { label: 'Em andamento', color: '#f59e0b' },
  pausada: { label: 'Pausada', color: '#8b5cf6' },
  concluida: { label: 'Concluída', color: '#10b981' },
  cancelada: { label: 'Cancelada', color: '#ef4444' },
}

const ADMIN_PERFIS = ['administrador', 'gerente', 'supervisor_influencers']
const INFLUENCER_PERFIS = ['supervisor_influencers', 'analista_influencers', 'estagiario_influencers']

function dataLocal(valor) {
  if (!valor) return null
  const d = new Date(`${valor}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function isHoje(valor) {
  const d = dataLocal(valor)
  if (!d) return false
  const h = new Date()
  return d.toDateString() === h.toDateString()
}

function isAtrasada(tarefa) {
  const d = dataLocal(tarefa.data_prazo)
  if (!d || ['concluida', 'cancelada'].includes(tarefa.status)) return false
  const h = new Date(); h.setHours(0,0,0,0)
  return d < h
}

function isSemanaAtual(valor) {
  const d = dataLocal(valor)
  if (!d) return false
  const h = new Date(); h.setHours(0,0,0,0)
  const inicio = new Date(h)
  const dia = inicio.getDay() || 7
  inicio.setDate(inicio.getDate() - dia + 1)
  const fim = new Date(inicio); fim.setDate(inicio.getDate() + 6); fim.setHours(23,59,59,999)
  return d >= inicio && d <= fim
}

function responsaveisDa(tarefa) {
  if (Array.isArray(tarefa.responsaveis) && tarefa.responsaveis.length) {
    return tarefa.responsaveis.map(r => r.usuario).filter(Boolean)
  }
  if (tarefa.responsavel) return [tarefa.responsavel]
  return []
}

function parceiroDa(tarefa) {
  if (tarefa.parceiro?.nome) return tarefa.parceiro.nome
  if (Array.isArray(tarefa.parceiros) && tarefa.parceiros.length) return tarefa.parceiros.map(p => p.nome).join(', ')
  return 'Sem parceiro vinculado'
}

function ResumoCard({ icon: Icon, label, value, tone }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ width:38, height:38, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:`${tone}18`, color:tone }}><Icon size={19}/></div>
      <div><div style={{ fontSize:11, color:'var(--text-muted)' }}>{label}</div><div style={{ fontSize:22, fontWeight:800, color:'var(--text)' }}>{value}</div></div>
    </div>
  )
}

function TaskCard({ tarefa, onStatus }) {
  const status = STATUS[tarefa.status] || STATUS.a_fazer
  const responsaveis = responsaveisDa(tarefa)
  const checklist = tarefa.checklist || []
  const feitos = checklist.filter(x => x.concluido).length
  const prazo = tarefa.data_prazo ? new Date(`${tarefa.data_prazo}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'
  return (
    <div style={{ background:'var(--surface)', border:`1px solid ${isAtrasada(tarefa) ? 'rgba(239,68,68,.55)' : 'var(--border)'}`, borderRadius:12, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:4 }}>{tarefa.banco_tarefa?.nome || tarefa.titulo || 'Tarefa'}</div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>{parceiroDa(tarefa)}</div>
        </div>
        <span style={{ flexShrink:0, fontSize:10, fontWeight:700, color:status.color, background:`${status.color}18`, border:`1px solid ${status.color}45`, borderRadius:99, padding:'3px 8px' }}>{status.label}</span>
      </div>
      {tarefa.especificidade && <div style={{ fontSize:12, color:'var(--text-soft)', marginTop:10, lineHeight:1.45 }}>{tarefa.especificidade}</div>}
      <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginTop:12, fontSize:11, color:'var(--text-muted)' }}>
        <span>Prazo: <strong style={{ color:isAtrasada(tarefa) ? '#ef4444' : 'var(--text-soft)' }}>{prazo}</strong></span>
        <span>Responsável: <strong style={{ color:'var(--text-soft)' }}>{responsaveis.map(r => r.nome?.split(' ')[0]).join(', ') || 'Não definido'}</strong></span>
        {checklist.length > 0 && <span>Checklist: <strong style={{ color:'var(--text-soft)' }}>{feitos}/{checklist.length}</strong></span>}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
        {tarefa.status === 'a_fazer' && <button className="btn btn-primary btn-sm" onClick={() => onStatus(tarefa, 'em_andamento')}>Iniciar</button>}
        {tarefa.status === 'em_andamento' && <button className="btn btn-primary btn-sm" onClick={() => onStatus(tarefa, 'concluida')}>Concluir</button>}
        {tarefa.status === 'pausada' && <button className="btn btn-primary btn-sm" onClick={() => onStatus(tarefa, 'em_andamento')}>Retomar</button>}
      </div>
    </div>
  )
}

export default function TarefasInfluencersOrganizadas() {
  const { usuario } = useAuth()
  const isAdmin = ADMIN_PERFIS.includes(usuario?.perfil)
  const [aba, setAba] = useState('minhas')
  const [tarefas, setTarefas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')
  const [responsavelFiltro, setResponsavelFiltro] = useState('')

  async function carregar() {
    setLoading(true)
    try {
      const [a, u] = await Promise.all([getAtribuicoes({ grupo:'influencers' }), getUsuarios()])
      setTarefas(a || [])
      setUsuarios((u || []).filter(x => INFLUENCER_PERFIS.includes(x.perfil)))
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  const minhas = useMemo(() => tarefas.filter(t => responsaveisDa(t).some(r => r.id === usuario?.id)), [tarefas, usuario?.id])
  const base = aba === 'equipe' ? tarefas : minhas
  const filtradas = useMemo(() => base.filter(t => {
    if (responsavelFiltro && !responsaveisDa(t).some(r => r.id === responsavelFiltro)) return false
    if (filtro === 'hoje') return isHoje(t.data_prazo) && !['concluida','cancelada'].includes(t.status)
    if (filtro === 'atrasadas') return isAtrasada(t)
    if (filtro === 'semana') return isSemanaAtual(t.data_prazo)
    if (filtro === 'concluidas') return t.status === 'concluida'
    return t.status !== 'cancelada'
  }), [base, filtro, responsavelFiltro])

  const resumo = {
    atrasadas: base.filter(isAtrasada).length,
    hoje: base.filter(t => isHoje(t.data_prazo) && !['concluida','cancelada'].includes(t.status)).length,
    andamento: base.filter(t => t.status === 'em_andamento').length,
    concluidas: base.filter(t => t.status === 'concluida' && isSemanaAtual(t.updated_at?.slice?.(0,10) || t.data_prazo)).length,
  }

  async function mudarStatus(tarefa, status) {
    const atualizada = await updateAtribuicao(tarefa.id, { status })
    setTarefas(prev => prev.map(x => x.id === tarefa.id ? { ...x, ...atualizada } : x))
  }

  const abas = [
    { id:'minhas', label:'Minhas tarefas', icon:ListTodo },
    ...(isAdmin ? [{ id:'equipe', label:'Tarefas da equipe', icon:Users }] : []),
    ...(isAdmin ? [{ id:'banco', label:'Banco de tarefas', icon:Database }] : []),
  ]

  return (
    <div style={{ padding:'24px 28px 40px', maxWidth:1500, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:20 }}>
        <div><h1 className="page-title" style={{ margin:0 }}>Tarefas Influencers</h1><p style={{ margin:'5px 0 0', color:'var(--text-muted)', fontSize:12 }}>Acompanhe prioridades, prazos e atividades da equipe.</p></div>
        <button className="btn btn-ghost" onClick={carregar}><RefreshCw size={14}/> Atualizar</button>
      </div>

      <div style={{ display:'flex', gap:8, borderBottom:'1px solid var(--border)', marginBottom:20, overflowX:'auto' }}>
        {abas.map(item => { const Icon = item.icon; const ativo = aba === item.id; return <button key={item.id} onClick={() => setAba(item.id)} style={{ border:'none', borderBottom:`2px solid ${ativo ? 'var(--accent)' : 'transparent'}`, background:'transparent', color:ativo ? 'var(--accent)' : 'var(--text-muted)', padding:'10px 14px', cursor:'pointer', fontWeight:ativo ? 700 : 500, display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap' }}><Icon size={15}/>{item.label}</button> })}
      </div>

      {aba === 'banco' ? <TarefasInfluencersLegado /> : <>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:18 }}>
          <ResumoCard icon={AlertTriangle} label="Atrasadas" value={resumo.atrasadas} tone="#ef4444"/>
          <ResumoCard icon={CalendarDays} label="Para hoje" value={resumo.hoje} tone="#f59e0b"/>
          <ResumoCard icon={Clock} label="Em andamento" value={resumo.andamento} tone="#6366f1"/>
          <ResumoCard icon={CheckCircle2} label="Concluídas na semana" value={resumo.concluidas} tone="#10b981"/>
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:16 }}>
          {['todas','hoje','atrasadas','semana','concluidas'].map(v => <button key={v} className={filtro === v ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setFiltro(v)}>{({todas:'Todas',hoje:'Hoje',atrasadas:'Atrasadas',semana:'Esta semana',concluidas:'Concluídas'})[v]}</button>)}
          {aba === 'equipe' && <select className="form-select" style={{ width:'auto', marginLeft:'auto' }} value={responsavelFiltro} onChange={e => setResponsavelFiltro(e.target.value)}><option value="">Toda a equipe</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>}
        </div>

        {loading ? <div className="loading"><div className="spinner"/></div> : filtradas.length === 0 ? <div className="empty-state"><p>Nenhuma tarefa encontrada neste filtro.</p></div> : <div style={{ display:'grid', gap:10 }}>{filtradas.map(t => <TaskCard key={t.id} tarefa={t} onStatus={mudarStatus}/>)}</div>}
      </>}
    </div>
  )
}
