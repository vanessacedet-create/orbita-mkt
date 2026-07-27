import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2, Clock, AlertTriangle, CalendarDays, Users, ListTodo,
  RefreshCw, Plus, Settings, X, BookOpen, Building2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getUsuarios, getParceiros, getLivros } from '../lib/supabase'
import {
  getAtribuicoes, getBancoTarefas, atribuirTarefa, updateAtribuicao,
} from '../lib/banco-tarefas'
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
  return d.toDateString() === new Date().toDateString()
}

function isAtrasada(tarefa) {
  const d = dataLocal(tarefa.data_prazo)
  if (!d || ['concluida', 'cancelada'].includes(tarefa.status)) return false
  const h = new Date(); h.setHours(0, 0, 0, 0)
  return d < h
}

function isSemanaAtual(valor) {
  const d = dataLocal(valor)
  if (!d) return false
  const h = new Date(); h.setHours(0, 0, 0, 0)
  const inicio = new Date(h)
  const dia = inicio.getDay() || 7
  inicio.setDate(inicio.getDate() - dia + 1)
  const fim = new Date(inicio); fim.setDate(inicio.getDate() + 6); fim.setHours(23, 59, 59, 999)
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
  return 'Sem parceiro vinculado'
}

function separarDetalhes(especificidade) {
  const texto = especificidade || ''
  const linhas = texto.split('\n')
  const livro = linhas.find(l => l.startsWith('Livro: '))?.replace('Livro: ', '') || ''
  const observacao = linhas.filter(l => !l.startsWith('Livro: ')).join('\n').trim()
  return { livro, observacao }
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
  const { livro, observacao } = separarDetalhes(tarefa.especificidade)

  return (
    <div style={{ background:'var(--surface)', border:`1px solid ${isAtrasada(tarefa) ? 'rgba(239,68,68,.55)' : 'var(--border)'}`, borderRadius:12, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:5 }}>{tarefa.banco_tarefa?.nome || tarefa.titulo || 'Tarefa'}</div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:12, color:'var(--text-muted)' }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><Building2 size={12}/>{parceiroDa(tarefa)}</span>
            {livro && <span style={{ display:'inline-flex', alignItems:'center', gap:5, color:'var(--accent)' }}><BookOpen size={12}/>{livro}</span>}
          </div>
        </div>
        <span style={{ flexShrink:0, fontSize:10, fontWeight:700, color:status.color, background:`${status.color}18`, border:`1px solid ${status.color}45`, borderRadius:99, padding:'3px 8px' }}>{status.label}</span>
      </div>
      {observacao && <div style={{ fontSize:12, color:'var(--text-soft)', marginTop:10, lineHeight:1.45, whiteSpace:'pre-wrap' }}>{observacao}</div>}
      <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginTop:12, fontSize:11, color:'var(--text-muted)' }}>
        <span>Prazo: <strong style={{ color:isAtrasada(tarefa) ? '#ef4444' : 'var(--text-soft)' }}>{prazo}</strong></span>
        <span>Responsável: <strong style={{ color:'var(--text-soft)' }}>{responsaveis.map(r => r.nome?.split(' ')[0]).join(', ') || 'Não definido'}</strong></span>
        {checklist.length > 0 && <span>Progresso: <strong style={{ color:'var(--text-soft)' }}>{feitos}/{checklist.length} etapas</strong></span>}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
        {tarefa.status === 'a_fazer' && <button className="btn btn-primary btn-sm" onClick={() => onStatus(tarefa, 'em_andamento')}>Iniciar</button>}
        {tarefa.status === 'em_andamento' && <button className="btn btn-primary btn-sm" onClick={() => onStatus(tarefa, 'concluida')}>Concluir</button>}
        {tarefa.status === 'pausada' && <button className="btn btn-primary btn-sm" onClick={() => onStatus(tarefa, 'em_andamento')}>Retomar</button>}
      </div>
    </div>
  )
}

function ModalNovaTarefa({ modelos, parceiros, livros, usuarios, usuario, onClose, onCreated }) {
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ modelo_id:'', parceiro_id:'', livro_id:'', responsavel_ids:[], data_prazo:'', observacao:'' })

  const modelo = modelos.find(m => m.id === form.modelo_id)
  const livro = livros.find(l => l.id === form.livro_id)

  useEffect(() => {
    if (!modelo) return
    const padrao = (modelo.responsaveis_padrao || []).map(r => r.usuario_id).filter(Boolean)
    const legado = modelo.responsavel?.id ? [modelo.responsavel.id] : []
    setForm(f => ({ ...f, responsavel_ids: padrao.length ? padrao : legado }))
  }, [form.modelo_id]) // eslint-disable-line

  function toggleResponsavel(id) {
    setForm(f => ({ ...f, responsavel_ids: f.responsavel_ids.includes(id) ? f.responsavel_ids.filter(x => x !== id) : [...f.responsavel_ids, id] }))
  }

  async function salvar() {
    if (!modelo) return alert('Selecione um modelo de tarefa.')
    if (!form.parceiro_id) return alert('Selecione o parceiro ou livraria.')
    if (!form.livro_id) return alert('Selecione o livro relacionado.')
    if (!form.responsavel_ids.length) return alert('Selecione ao menos um responsável.')

    setSalvando(true)
    try {
      const checklist = (modelo.checklist_padrao || []).sort((a,b)=>(a.ordem||0)-(b.ordem||0)).map(c => c.texto)
      const identificacaoLivro = `${livro.titulo}${livro.autor ? ` — ${livro.autor}` : ''}${livro.isbn ? ` · ISBN ${livro.isbn}` : ''}`
      const especificidade = [`Livro: ${identificacaoLivro}`, form.observacao.trim()].filter(Boolean).join('\n')
      const nova = await atribuirTarefa({
        grupo:'influencers', bancoTarefaId:modelo.id, responsavelIds:form.responsavel_ids,
        dataPrazo:form.data_prazo || null, especificidade, atribuidaPor:usuario.id,
        checklist, parceiroId:form.parceiro_id, quantidade:1,
      })
      onCreated(nova)
      onClose()
    } catch (e) {
      alert('Erro ao criar tarefa: ' + (e.message || 'erro desconhecido'))
    } finally { setSalvando(false) }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth:620, maxHeight:'92vh', overflowY:'auto' }}>
        <div className="modal-header" style={{ position:'sticky', top:0, background:'var(--surface)', zIndex:5 }}>
          <div><h2 className="modal-title">Nova tarefa</h2><p style={{ margin:'3px 0 0', fontSize:11, color:'var(--text-muted)' }}>Modelo + parceiro + livro + responsável + prazo</p></div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">1. Modelo de tarefa *</label>
            <select className="form-select" value={form.modelo_id} onChange={e => setForm(f => ({ ...f, modelo_id:e.target.value }))}>
              <option value="">Selecione o tipo de atividade</option>
              {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            {modelo?.descricao && <div style={{ marginTop:6, padding:'8px 10px', borderRadius:8, background:'var(--surface-2)', color:'var(--text-muted)', fontSize:11 }}>{modelo.descricao}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">2. Parceiro ou livraria *</label>
              <select className="form-select" value={form.parceiro_id} onChange={e => setForm(f => ({ ...f, parceiro_id:e.target.value }))}>
                <option value="">Selecione</option>
                {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">3. Livro relacionado *</label>
              <select className="form-select" value={form.livro_id} onChange={e => setForm(f => ({ ...f, livro_id:e.target.value }))}>
                <option value="">Selecione</option>
                {livros.map(l => <option key={l.id} value={l.id}>{l.titulo}{l.autor ? ` — ${l.autor}` : ''}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">4. Responsável *</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {usuarios.map(u => {
                const ativo = form.responsavel_ids.includes(u.id)
                return <button key={u.id} type="button" onClick={() => toggleResponsavel(u.id)} style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`, background:ativo ? 'var(--accent-glow)' : 'transparent', color:ativo ? 'var(--accent)' : 'var(--text-muted)', cursor:'pointer', fontSize:12, fontWeight:600 }}>{u.nome.split(' ')[0]}</button>
              })}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group"><label className="form-label">5. Prazo</label><input className="form-input" type="date" value={form.data_prazo} onChange={e => setForm(f => ({ ...f, data_prazo:e.target.value }))}/></div>
            <div className="form-group"><label className="form-label">Etapas puxadas do modelo</label><div style={{ minHeight:38, display:'flex', alignItems:'center', padding:'0 11px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, color:'var(--text-muted)' }}>{modelo ? `${modelo.checklist_padrao?.length || 0} etapa(s)` : 'Selecione um modelo'}</div></div>
          </div>

          <div className="form-group"><label className="form-label">Observação específica</label><textarea className="form-textarea" rows={3} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao:e.target.value }))} placeholder="Ex.: destacar o lançamento, mencionar o cupom, enviar até 15h..."/></div>
        </div>

        <div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Criando...' : 'Criar tarefa'}</button></div>
      </div>
    </div>
  )
}

export default function TarefasInfluencersOrganizadas() {
  const { usuario } = useAuth()
  const isAdmin = ADMIN_PERFIS.includes(usuario?.perfil)
  const [aba, setAba] = useState('minhas')
  const [modelosAberto, setModelosAberto] = useState(false)
  const [modalNova, setModalNova] = useState(false)
  const [tarefas, setTarefas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [modelos, setModelos] = useState([])
  const [parceiros, setParceiros] = useState([])
  const [livros, setLivros] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')
  const [responsavelFiltro, setResponsavelFiltro] = useState('')

  async function carregar() {
    setLoading(true)
    try {
      const [a, u, m, p, livrosRes] = await Promise.all([
        getAtribuicoes({ grupo:'influencers' }), getUsuarios(), getBancoTarefas('influencers'),
        getParceiros(), getLivros({ page:0, pageSize:500 }),
      ])
      setTarefas(a || [])
      setUsuarios((u || []).filter(x => INFLUENCER_PERFIS.includes(x.perfil)))
      setModelos(m || [])
      setParceiros((p || []).filter(x => (x.grupo || '') === 'influencers'))
      setLivros(livrosRes?.data || livrosRes || [])
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
    concluidas: base.filter(t => t.status === 'concluida' && isSemanaAtual(t.concluida_em?.slice?.(0,10) || t.data_prazo)).length,
  }

  async function mudarStatus(tarefa, status) {
    const atualizada = await updateAtribuicao(tarefa.id, { status, _statusAnterior:tarefa.status })
    setTarefas(prev => prev.map(x => x.id === tarefa.id ? { ...x, ...atualizada } : x))
  }

  if (modelosAberto) {
    return (
      <div style={{ padding:'24px 28px 40px', maxWidth:1600, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16 }}>
          <div><h1 className="page-title" style={{ margin:0 }}>Modelos de tarefa</h1><p style={{ margin:'5px 0 0', fontSize:12, color:'var(--text-muted)' }}>Cadastre os tipos de atividade, instruções e checklists reutilizáveis.</p></div>
          <button className="btn btn-ghost" onClick={() => { setModelosAberto(false); carregar() }}>Voltar às tarefas</button>
        </div>
        <TarefasInfluencersLegado />
      </div>
    )
  }

  return (
    <div style={{ padding:'24px 28px 40px', maxWidth:1500, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:20, flexWrap:'wrap' }}>
        <div><h1 className="page-title" style={{ margin:0 }}>Tarefas Influencers</h1><p style={{ margin:'5px 0 0', color:'var(--text-muted)', fontSize:12 }}>Modelo + parceiro ou livraria + livro + responsável + prazo.</p></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-ghost" onClick={carregar}><RefreshCw size={14}/> Atualizar</button>
          {isAdmin && <button className="btn btn-ghost" onClick={() => setModelosAberto(true)}><Settings size={14}/> Configurar modelos</button>}
          {isAdmin && <button className="btn btn-primary" onClick={() => setModalNova(true)}><Plus size={14}/> Nova tarefa</button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:8, borderBottom:'1px solid var(--border)', marginBottom:20, overflowX:'auto' }}>
        {[{ id:'minhas', label:'Minhas tarefas', icon:ListTodo }, ...(isAdmin ? [{ id:'equipe', label:'Tarefas da equipe', icon:Users }] : [])].map(item => {
          const Icon = item.icon; const ativo = aba === item.id
          return <button key={item.id} onClick={() => setAba(item.id)} style={{ border:'none', borderBottom:`2px solid ${ativo ? 'var(--accent)' : 'transparent'}`, background:'transparent', color:ativo ? 'var(--accent)' : 'var(--text-muted)', padding:'10px 14px', cursor:'pointer', fontWeight:ativo ? 700 : 500, display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap' }}><Icon size={15}/>{item.label}</button>
        })}
      </div>

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

      {modalNova && <ModalNovaTarefa modelos={modelos} parceiros={parceiros} livros={livros} usuarios={usuarios} usuario={usuario} onClose={() => setModalNova(false)} onCreated={nova => setTarefas(prev => [nova, ...prev])}/>} 
    </div>
  )
}
