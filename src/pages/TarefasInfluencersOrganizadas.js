import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2, Clock, AlertTriangle, CalendarDays, Users, ListTodo,
  RefreshCw, Plus, Settings, X, BookOpen, Building2, Archive,
  Pencil, Trash2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getUsuarios, getParceiros, getLivros, getTarefas,
  updateTarefa, deleteTarefa,
} from '../lib/supabase'
import {
  getAtribuicoes, getBancoTarefas, atribuirTarefa,
  updateAtribuicao, deleteAtribuicao,
} from '../lib/banco-tarefas'
import ModelosTarefasInfluencers from './TarefasInfluencers'

const STATUS = {
  a_fazer: { label:'A fazer', color:'#6b7280' },
  em_andamento: { label:'Em andamento', color:'#f59e0b' },
  pausada: { label:'Pausada', color:'#8b5cf6' },
  concluida: { label:'Concluída', color:'#10b981' },
  cancelada: { label:'Cancelada', color:'#ef4444' },
}
const ADMIN_PERFIS = ['administrador', 'gerente', 'supervisor_influencers']
const INFLUENCER_PERFIS = ['supervisor_influencers', 'analista_influencers', 'estagiario_influencers']
const PREFIXO = /^\[\[D-(\d+)\]\]\s*/

function dataLocal(valor) {
  if (!valor) return null
  const d = new Date(`${valor}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}
function isHoje(valor) {
  const d = dataLocal(valor)
  return !!d && d.toDateString() === new Date().toDateString()
}
function isAtrasada(tarefa) {
  const d = dataLocal(tarefa.data_prazo)
  if (!d || ['concluida', 'cancelada'].includes(tarefa.status)) return false
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return d < hoje
}
function isSemanaAtual(valor) {
  const d = dataLocal(valor)
  if (!d) return false
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const inicio = new Date(hoje)
  const dia = inicio.getDay() || 7
  inicio.setDate(inicio.getDate() - dia + 1)
  const fim = new Date(inicio)
  fim.setDate(inicio.getDate() + 6)
  fim.setHours(23, 59, 59, 999)
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
  return tarefa._origem === 'antiga' ? 'Tarefa anterior à migração' : 'Sem parceiro vinculado'
}
function separarDetalhes(especificidade) {
  const linhas = (especificidade || '').split('\n')
  return {
    livro: linhas.find(l => l.startsWith('Livro: '))?.replace('Livro: ', '') || '',
    observacao: linhas.filter(l => !l.startsWith('Livro: ')).join('\n').trim(),
  }
}
function decodificarEtapa(texto) {
  const match = String(texto || '').match(PREFIXO)
  return { texto:String(texto || '').replace(PREFIXO, ''), dias_antes:match ? Number(match[1]) : 0 }
}
function calcularData(prazo, dias) {
  if (!prazo) return null
  const d = new Date(`${prazo}T12:00:00`)
  d.setDate(d.getDate() - Math.max(0, Number(dias) || 0))
  return d
}
function formatarData(d) { return d ? d.toLocaleDateString('pt-BR') : '' }
function textoEtapaComData(item, prazo) {
  const etapa = decodificarEtapa(item.texto ?? item)
  const data = calcularData(prazo, etapa.dias_antes)
  return `${etapa.texto}${data ? ` · prazo ${formatarData(data)}` : ''}`
}
function normalizarTarefaAntiga(tarefa) {
  const responsaveis = (tarefa.tarefa_responsaveis || []).map(r => ({ id:r.id, usuario_id:r.usuario_id, usuario:r.usuario }))
  return {
    ...tarefa,
    _origem:'antiga',
    _idOriginal:tarefa.id,
    id:`antiga-${tarefa.id}`,
    status:tarefa.status === 'concluido' ? 'concluida' : tarefa.status,
    responsaveis,
    checklist:tarefa.tarefa_checklist || [],
    titulo:tarefa.titulo,
    especificidade:tarefa.descricao || '',
    _livrosAntigos:(tarefa.tarefa_livros || []).map(x => x.livros).filter(Boolean),
  }
}

function ResumoCard({ icon:Icon, label, value, tone }) {
  return <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}><div style={{ width:38, height:38, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:`${tone}18`, color:tone }}><Icon size={19}/></div><div><div style={{ fontSize:11, color:'var(--text-muted)' }}>{label}</div><div style={{ fontSize:22, fontWeight:800 }}>{value}</div></div></div>
}

function TaskCard({ tarefa, onStatus, onEdit, onDelete, podeGerenciar }) {
  const status = STATUS[tarefa.status] || STATUS.a_fazer
  const responsaveis = responsaveisDa(tarefa)
  const checklist = tarefa.checklist || []
  const feitos = checklist.filter(x => x.concluido).length
  const prazo = tarefa.data_prazo ? new Date(`${tarefa.data_prazo}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'
  const { livro, observacao } = separarDetalhes(tarefa.especificidade)
  const livrosAntigos = tarefa._livrosAntigos || []
  return (
    <div style={{ background:'var(--surface)', border:`1px solid ${isAtrasada(tarefa) ? 'rgba(239,68,68,.55)' : 'var(--border)'}`, borderRadius:12, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
        <div style={{ minWidth:0 }}>
          <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}><div style={{ fontSize:14, fontWeight:700 }}>{tarefa.banco_tarefa?.nome || tarefa.titulo || 'Tarefa'}</div>{tarefa._origem === 'antiga' && <span style={{ fontSize:9, color:'var(--text-muted)', border:'1px solid var(--border)', borderRadius:99, padding:'2px 7px', display:'inline-flex', alignItems:'center', gap:3 }}><Archive size={10}/> Antiga</span>}</div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:12, color:'var(--text-muted)', marginTop:5 }}><span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><Building2 size={12}/> {parceiroDa(tarefa)}</span>{livro && <span style={{ color:'var(--accent)', display:'inline-flex', alignItems:'center', gap:4 }}><BookOpen size={12}/> {livro}</span>}{livrosAntigos.map(l => <span key={l.id} style={{ color:'var(--accent)', display:'inline-flex', alignItems:'center', gap:4 }}><BookOpen size={12}/> {l.titulo}</span>)}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ fontSize:10, fontWeight:700, color:status.color, background:`${status.color}18`, border:`1px solid ${status.color}45`, borderRadius:99, padding:'3px 8px' }}>{status.label}</span>{podeGerenciar && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onEdit(tarefa)} title="Editar tarefa"><Pencil size={13}/></button>}{podeGerenciar && <button className="btn btn-danger btn-icon btn-sm" onClick={() => onDelete(tarefa)} title="Excluir tarefa"><Trash2 size={13}/></button>}</div>
      </div>
      {observacao && <div style={{ fontSize:12, color:'var(--text-soft)', marginTop:10, whiteSpace:'pre-wrap' }}>{observacao}</div>}
      <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginTop:12, fontSize:11, color:'var(--text-muted)' }}><span>Prazo: <strong style={{ color:isAtrasada(tarefa) ? '#ef4444' : 'var(--text-soft)' }}>{prazo}</strong></span><span>Responsável: <strong>{responsaveis.map(r => r.nome?.split(' ')[0]).join(', ') || 'Não definido'}</strong></span>{checklist.length > 0 && <span>Progresso: <strong>{feitos}/{checklist.length} etapas</strong></span>}</div>
      {checklist.length > 0 && <div style={{ marginTop:10, padding:'9px 11px', background:'var(--surface-2)', borderRadius:8, display:'grid', gap:5 }}>{checklist.slice(0,4).map((c,i) => <div key={c.id || i} style={{ fontSize:11, color:c.concluido ? '#10b981' : 'var(--text-muted)' }}>{c.concluido ? '✓' : '○'} {c.texto}</div>)}{checklist.length > 4 && <div style={{ fontSize:10, color:'var(--text-muted)' }}>+ {checklist.length - 4} etapa(s)</div>}</div>}
      <div style={{ display:'flex', gap:8, marginTop:14 }}>{tarefa.status === 'a_fazer' && <button className="btn btn-primary btn-sm" onClick={() => onStatus(tarefa, 'em_andamento')}>Iniciar</button>}{tarefa.status === 'em_andamento' && <button className="btn btn-primary btn-sm" onClick={() => onStatus(tarefa, 'concluida')}>Concluir</button>}{tarefa.status === 'pausada' && <button className="btn btn-primary btn-sm" onClick={() => onStatus(tarefa, 'em_andamento')}>Retomar</button>}</div>
    </div>
  )
}

function ModalNovaTarefa({ modelos, parceiros, livros, usuarios, usuario, onClose, onCreated }) {
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ modelo_id:'', parceiro_id:'', livro_id:'', responsavel_ids:[], data_prazo:'', observacao:'' })
  const modelo = modelos.find(m => m.id === form.modelo_id)
  const livro = livros.find(l => l.id === form.livro_id)
  const etapas = (modelo?.checklist_padrao || []).sort((a,b)=>(a.ordem||0)-(b.ordem||0)).map(c => decodificarEtapa(c.texto))
  useEffect(() => {
    if (!modelo) return
    const padrao = (modelo.responsaveis_padrao || []).map(r => r.usuario_id).filter(Boolean)
    const legado = modelo.responsavel?.id ? [modelo.responsavel.id] : []
    setForm(f => ({ ...f, responsavel_ids:padrao.length ? padrao : legado }))
  }, [form.modelo_id]) // eslint-disable-line
  function toggle(id) { setForm(f => ({ ...f, responsavel_ids:f.responsavel_ids.includes(id) ? f.responsavel_ids.filter(x => x !== id) : [...f.responsavel_ids, id] })) }
  async function salvar() {
    if (!modelo) return alert('Selecione um modelo de tarefa.')
    if (!form.livro_id) return alert('Selecione o livro relacionado.')
    if (!form.responsavel_ids.length) return alert('Selecione ao menos um responsável.')
    if (etapas.some(e => e.dias_antes > 0) && !form.data_prazo) return alert('Informe o prazo final para calcular as datas das etapas.')
    setSalvando(true)
    try {
      const identificacao = `${livro.titulo}${livro.autor ? ` — ${livro.autor}` : ''}${livro.isbn ? ` · ISBN ${livro.isbn}` : ''}`
      const checklist = (modelo.checklist_padrao || []).sort((a,b)=>(a.ordem||0)-(b.ordem||0)).map(c => textoEtapaComData(c, form.data_prazo))
      const nova = await atribuirTarefa({
        grupo:'influencers', bancoTarefaId:modelo.id, responsavelIds:form.responsavel_ids,
        dataPrazo:form.data_prazo || null,
        especificidade:[`Livro: ${identificacao}`, form.observacao.trim()].filter(Boolean).join('\n'),
        atribuidaPor:usuario.id, checklist, parceiroId:form.parceiro_id || null, quantidade:1,
      })
      onCreated({ ...nova, _origem:'nova' })
      onClose()
    } catch (e) { alert('Erro ao criar tarefa: ' + (e.message || 'erro desconhecido')) }
    finally { setSalvando(false) }
  }
  return <div className="modal-backdrop"><div className="modal" style={{ maxWidth:680, maxHeight:'92vh', overflowY:'auto' }}><div className="modal-header"><div><h2 className="modal-title">Nova tarefa</h2><p style={{ margin:'3px 0 0', fontSize:11, color:'var(--text-muted)' }}>O parceiro ou livraria é opcional.</p></div><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button></div><div className="form-grid"><div className="form-group"><label className="form-label">1. Modelo de tarefa *</label><select className="form-select" value={form.modelo_id} onChange={e => setForm(f => ({ ...f, modelo_id:e.target.value }))}><option value="">Selecione</option>{modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></div><div className="form-row"><div className="form-group"><label className="form-label">2. Parceiro ou livraria (opcional)</label><select className="form-select" value={form.parceiro_id} onChange={e => setForm(f => ({ ...f, parceiro_id:e.target.value }))}><option value="">Sem parceiro ou livraria</option>{parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div><div className="form-group"><label className="form-label">3. Livro relacionado *</label><select className="form-select" value={form.livro_id} onChange={e => setForm(f => ({ ...f, livro_id:e.target.value }))}><option value="">Selecione</option>{livros.map(l => <option key={l.id} value={l.id}>{l.titulo}{l.autor ? ` — ${l.autor}` : ''}</option>)}</select></div></div><div className="form-group"><label className="form-label">4. Responsável *</label><div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>{usuarios.map(u => { const ativo=form.responsavel_ids.includes(u.id); return <button key={u.id} type="button" onClick={() => toggle(u.id)} style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`, background:ativo ? 'var(--accent-glow)' : 'transparent', color:ativo ? 'var(--accent)' : 'var(--text-muted)', cursor:'pointer' }}>{u.nome.split(' ')[0]}</button> })}</div></div><div className="form-group"><label className="form-label">5. Prazo final</label><input className="form-input" type="date" value={form.data_prazo} onChange={e => setForm(f => ({ ...f, data_prazo:e.target.value }))}/></div>{modelo && <div className="form-group"><label className="form-label">Prévia do cronograma</label><div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:9, padding:10, display:'grid', gap:7 }}>{etapas.length === 0 ? <span style={{ fontSize:11, color:'var(--text-muted)' }}>Este modelo não tem etapas.</span> : etapas.map((e,i) => <div key={i} style={{ display:'flex', justifyContent:'space-between', gap:10, fontSize:12 }}><span>{i+1}. {e.texto}</span><strong style={{ color:form.data_prazo ? 'var(--accent)' : 'var(--text-muted)' }}>{form.data_prazo ? formatarData(calcularData(form.data_prazo, e.dias_antes)) : (e.dias_antes ? `${e.dias_antes} dias antes` : 'no prazo final')}</strong></div>)}</div></div>}<div className="form-group"><label className="form-label">Observação específica</label><textarea className="form-textarea" rows={3} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao:e.target.value }))}/></div></div><div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Criando...' : 'Criar tarefa'}</button></div></div></div>
}

function ModalEditarTarefa({ tarefa, parceiros, livros, usuarios, onClose, onSaved }) {
  const detalhes = separarDetalhes(tarefa.especificidade)
  const livroAtual = livros.find(l => detalhes.livro.startsWith(l.titulo))
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ titulo:tarefa.banco_tarefa?.nome || tarefa.titulo || '', parceiro_id:tarefa.parceiro?.id || '', livro_id:livroAtual?.id || '', responsavel_ids:responsaveisDa(tarefa).map(r => r.id), data_prazo:tarefa.data_prazo || '', status:tarefa.status || 'a_fazer', observacao:detalhes.observacao || '' })
  function toggle(id) { setForm(f => ({ ...f, responsavel_ids:f.responsavel_ids.includes(id) ? f.responsavel_ids.filter(x => x !== id) : [...f.responsavel_ids, id] })) }
  async function salvar() {
    if (!form.responsavel_ids.length) return alert('Selecione ao menos um responsável.')
    setSalvando(true)
    try {
      if (tarefa._origem === 'antiga') {
        const atualizada = await updateTarefa(tarefa._idOriginal, { titulo:form.titulo.trim() || tarefa.titulo, descricao:form.observacao.trim() || null, data_prazo:form.data_prazo || null, status:form.status === 'concluida' ? 'concluido' : form.status })
        onSaved(normalizarTarefaAntiga(atualizada))
      } else {
        const livro = livros.find(l => l.id === form.livro_id)
        const identificacao = livro ? `${livro.titulo}${livro.autor ? ` — ${livro.autor}` : ''}${livro.isbn ? ` · ISBN ${livro.isbn}` : ''}` : detalhes.livro
        const atualizada = await updateAtribuicao(tarefa.id, { parceiro_id:form.parceiro_id || null, parceiros_ids:form.parceiro_id ? [form.parceiro_id] : [], data_prazo:form.data_prazo || null, status:form.status, _statusAnterior:tarefa.status, especificidade:[identificacao ? `Livro: ${identificacao}` : '', form.observacao.trim()].filter(Boolean).join('\n'), _responsaveisIds:form.responsavel_ids })
        onSaved({ ...atualizada, _origem:'nova' })
      }
      onClose()
    } catch (e) { alert('Erro ao editar tarefa: ' + (e.message || 'erro desconhecido')) }
    finally { setSalvando(false) }
  }
  return <div className="modal-backdrop"><div className="modal" style={{ maxWidth:620, maxHeight:'92vh', overflowY:'auto' }}><div className="modal-header"><h2 className="modal-title">Editar tarefa</h2><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button></div><div className="form-grid">{tarefa._origem === 'antiga' && <div className="form-group"><label className="form-label">Título</label><input className="form-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo:e.target.value }))}/></div>}{tarefa._origem !== 'antiga' && <div className="form-row"><div className="form-group"><label className="form-label">Parceiro ou livraria (opcional)</label><select className="form-select" value={form.parceiro_id} onChange={e => setForm(f => ({ ...f, parceiro_id:e.target.value }))}><option value="">Sem parceiro ou livraria</option>{parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div><div className="form-group"><label className="form-label">Livro relacionado</label><select className="form-select" value={form.livro_id} onChange={e => setForm(f => ({ ...f, livro_id:e.target.value }))}><option value="">Manter livro atual</option>{livros.map(l => <option key={l.id} value={l.id}>{l.titulo}{l.autor ? ` — ${l.autor}` : ''}</option>)}</select></div></div>}<div className="form-group"><label className="form-label">Responsáveis</label><div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>{usuarios.map(u => { const ativo=form.responsavel_ids.includes(u.id); return <button key={u.id} type="button" onClick={() => toggle(u.id)} style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`, background:ativo ? 'var(--accent-glow)' : 'transparent', color:ativo ? 'var(--accent)' : 'var(--text-muted)', cursor:'pointer' }}>{u.nome.split(' ')[0]}</button> })}</div></div><div className="form-row"><div className="form-group"><label className="form-label">Prazo</label><input className="form-input" type="date" value={form.data_prazo} onChange={e => setForm(f => ({ ...f, data_prazo:e.target.value }))}/></div><div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status:e.target.value }))}>{Object.entries(STATUS).map(([v,s]) => <option key={v} value={v}>{s.label}</option>)}</select></div></div><div className="form-group"><label className="form-label">Observação</label><textarea className="form-textarea" rows={4} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao:e.target.value }))}/></div></div><div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar alterações'}</button></div></div></div>
}

export default function TarefasInfluencersOrganizadas() {
  const { usuario } = useAuth()
  const isAdmin = ADMIN_PERFIS.includes(usuario?.perfil)
  const podeCriar = isAdmin || usuario?.perfil === 'estagiario_influencers'
  const [aba, setAba] = useState('minhas')
  const [modelosAberto, setModelosAberto] = useState(false)
  const [modalNova, setModalNova] = useState(false)
  const [tarefaEditando, setTarefaEditando] = useState(null)
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
      const [novas, antigas, todosUsuarios, modelosData, parceirosData, livrosRes] = await Promise.all([getAtribuicoes({ grupo:'influencers' }), getTarefas(), getUsuarios(), getBancoTarefas('influencers'), getParceiros(), getLivros({ page:0, pageSize:500 })])
      const equipe = (todosUsuarios || []).filter(x => INFLUENCER_PERFIS.includes(x.perfil))
      const idsEquipe = new Set(equipe.map(x => x.id))
      const antigasDoGrupo = (antigas || []).filter(t => [...(t.tarefa_responsaveis || []).map(r => r.usuario_id), t.responsavel?.id, t.responsavel_id].filter(Boolean).some(id => idsEquipe.has(id))).map(normalizarTarefaAntiga)
      setTarefas([...(novas || []).map(t => ({ ...t, _origem:'nova' })), ...antigasDoGrupo])
      setUsuarios(equipe); setModelos(modelosData || []); setParceiros((parceirosData || []).filter(x => (x.grupo || '') === 'influencers')); setLivros(livrosRes?.data || livrosRes || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { carregar() }, [])
  const minhas = useMemo(() => tarefas.filter(t => responsaveisDa(t).some(r => r.id === usuario?.id)), [tarefas, usuario?.id])
  const base = aba === 'equipe' ? tarefas : minhas
  const filtradas = useMemo(() => base.filter(t => {
    if (responsavelFiltro && !responsaveisDa(t).some(r => r.id === responsavelFiltro)) return false
    if (filtro === 'hoje') return isHoje(t.data_prazo) && !['concluida','cancelada'].includes(t.status)
    if (filtro === 'atrasadas') return isAtrasada(t)
    if (filtro === 'semana') return isSemanaAtual(t.data_prazo) && !['concluida','cancelada'].includes(t.status)
    if (filtro === 'concluidas') return t.status === 'concluida'
    return !['concluida','cancelada'].includes(t.status)
  }), [base, filtro, responsavelFiltro])
  const resumo = { atrasadas:base.filter(isAtrasada).length, hoje:base.filter(t => isHoje(t.data_prazo) && !['concluida','cancelada'].includes(t.status)).length, andamento:base.filter(t => t.status === 'em_andamento').length, concluidas:base.filter(t => t.status === 'concluida' && isSemanaAtual((t.concluida_em || t.updated_at || '').slice(0,10) || t.data_prazo)).length }
  async function mudarStatus(tarefa, status) {
    if (tarefa._origem === 'antiga') { const atualizada=await updateTarefa(tarefa._idOriginal,{ status:status === 'concluida' ? 'concluido' : status }); setTarefas(prev => prev.map(x => x.id === tarefa.id ? normalizarTarefaAntiga(atualizada) : x)); return }
    const atualizada=await updateAtribuicao(tarefa.id,{ status, _statusAnterior:tarefa.status }); setTarefas(prev => prev.map(x => x.id === tarefa.id ? { ...atualizada, _origem:'nova' } : x))
  }
  async function excluir(tarefa) {
    const nome=tarefa.banco_tarefa?.nome || tarefa.titulo || 'esta tarefa'
    if (!window.confirm(`Excluir definitivamente "${nome}"? Esta ação não pode ser desfeita.`)) return
    try { if (tarefa._origem === 'antiga') await deleteTarefa(tarefa._idOriginal); else await deleteAtribuicao(tarefa.id); setTarefas(prev => prev.filter(x => x.id !== tarefa.id)) } catch (e) { alert('Erro ao excluir tarefa: ' + (e.message || 'erro desconhecido')) }
  }
  if (modelosAberto) return <div style={{ padding:'24px 28px 40px', maxWidth:1600, margin:'0 auto' }}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}><div><h1 className="page-title" style={{ margin:0 }}>Modelos de tarefa</h1><p style={{ margin:'5px 0 0', fontSize:12, color:'var(--text-muted)' }}>Cadastre tipos de atividade, instruções e checklists reutilizáveis.</p></div><button className="btn btn-ghost" onClick={() => { setModelosAberto(false); carregar() }}>Voltar às tarefas</button></div><ModelosTarefasInfluencers /></div>
  return <div style={{ padding:'24px 28px 40px', maxWidth:1500, margin:'0 auto' }}><div style={{ display:'flex', justifyContent:'space-between', gap:16, marginBottom:20, flexWrap:'wrap' }}><div><h1 className="page-title" style={{ margin:0 }}>Tarefas Influencers</h1><p style={{ margin:'5px 0 0', color:'var(--text-muted)', fontSize:12 }}>Tarefas antigas e novas reunidas em uma única visão.</p></div><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}><button className="btn btn-ghost" onClick={carregar}><RefreshCw size={14}/> Atualizar</button>{isAdmin && <button className="btn btn-ghost" onClick={() => setModelosAberto(true)}><Settings size={14}/> Configurar modelos</button>}{podeCriar && <button className="btn btn-primary" onClick={() => setModalNova(true)}><Plus size={14}/> Nova tarefa</button>}</div></div><div style={{ display:'flex', gap:8, borderBottom:'1px solid var(--border)', marginBottom:20 }}>{[{ id:'minhas', label:'Minhas tarefas', icon:ListTodo }, ...(isAdmin ? [{ id:'equipe', label:'Tarefas da equipe', icon:Users }] : [])].map(item => { const Icon=item.icon; const ativo=aba===item.id; return <button key={item.id} onClick={() => setAba(item.id)} style={{ border:'none', borderBottom:`2px solid ${ativo ? 'var(--accent)' : 'transparent'}`, background:'transparent', color:ativo ? 'var(--accent)' : 'var(--text-muted)', padding:'10px 14px', cursor:'pointer', fontWeight:ativo ? 700 : 500, display:'flex', alignItems:'center', gap:7 }}><Icon size={15}/>{item.label}</button> })}</div><div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:18 }}><ResumoCard icon={AlertTriangle} label="Atrasadas" value={resumo.atrasadas} tone="#ef4444"/><ResumoCard icon={CalendarDays} label="Para hoje" value={resumo.hoje} tone="#f59e0b"/><ResumoCard icon={Clock} label="Em andamento" value={resumo.andamento} tone="#6366f1"/><ResumoCard icon={CheckCircle2} label="Concluídas na semana" value={resumo.concluidas} tone="#10b981"/></div><div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:16 }}>{['todas','hoje','atrasadas','semana','concluidas'].map(v => <button key={v} className={filtro === v ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setFiltro(v)}>{({ todas:'Todas', hoje:'Hoje', atrasadas:'Atrasadas', semana:'Esta semana', concluidas:'Concluídos' })[v]}</button>)}{aba === 'equipe' && <select className="form-select" style={{ width:'auto', marginLeft:'auto' }} value={responsavelFiltro} onChange={e => setResponsavelFiltro(e.target.value)}><option value="">Toda a equipe</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>}</div>{loading ? <div className="loading"><div className="spinner"/></div> : filtradas.length === 0 ? <div className="empty-state"><p>Nenhuma tarefa encontrada neste filtro.</p></div> : <div style={{ display:'grid', gap:10 }}>{filtradas.map(t => <TaskCard key={t.id} tarefa={t} onStatus={mudarStatus} onEdit={setTarefaEditando} onDelete={excluir} podeGerenciar={isAdmin}/>)}</div>}{modalNova && <ModalNovaTarefa modelos={modelos} parceiros={parceiros} livros={livros} usuarios={usuarios} usuario={usuario} onClose={() => setModalNova(false)} onCreated={nova => setTarefas(prev => [nova, ...prev])}/>} {tarefaEditando && <ModalEditarTarefa tarefa={tarefaEditando} parceiros={parceiros} livros={livros} usuarios={usuarios} onClose={() => setTarefaEditando(null)} onSaved={salva => setTarefas(prev => prev.map(x => x.id === tarefaEditando.id ? salva : x))}/>}</div>
}
