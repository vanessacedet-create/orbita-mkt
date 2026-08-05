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
  getAtribuicoesInf, getBancoTarefasInf, atribuirTarefaInf,
  updateAtribuicaoInf, deleteAtribuicaoInf,
} from '../lib/tarefas-influencers'
// Fio solto: funcao de limpeza pontual que ainda toca as tabelas legadas
// compartilhadas (tarefas / tarefa_responsaveis). Nao portada de proposito.
import { removerResponsavelAbertoPorNome } from '../lib/banco-tarefas'
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
function nomeParceiro(parceiro) {
  if (!parceiro) return ''
  const nome = String(parceiro.nome || '').trim()
  const livraria = String(parceiro.livraria || '').trim()
  if (livraria && nome && livraria.toLowerCase() !== nome.toLowerCase()) return `${livraria} — ${nome}`
  return livraria || nome
}
function parceiroDa(tarefa) {
  const nome = nomeParceiro(tarefa.parceiro)
  if (nome) return nome
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

function isoLocal(d) {
  if (!d) return null
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}
function textoEtapaComData(item, prazo) {
  const etapa = decodificarEtapa(item.texto ?? item)
  const data = calcularData(prazo, etapa.dias_antes)
  return `${etapa.texto}${data ? ` · prazo ${formatarData(data)}` : ''}`
}
function normalizarTarefaAntiga(tarefa, parceirosPorId = {}) {
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
    parceiro:tarefa.parceiro || parceirosPorId[tarefa.parceiro_id] || null,
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
  const [buscaLivro, setBuscaLivro] = useState('')
  const [resultadosLivro, setResultadosLivro] = useState([])
  const [livroSel, setLivroSel] = useState(null)
  const [buscandoLivro, setBuscandoLivro] = useState(false)
  const [form, setForm] = useState({ modelo_id:'', parceiro_id:'', livro_id:'', responsavel_ids:[], data_prazo:'', observacao:'' })
  const modelo = modelos.find(m => m.id === form.modelo_id)
  const livro = livroSel
  useEffect(() => {
    const termo = buscaLivro.trim()
    if (!termo || form.livro_id) { setResultadosLivro([]); return }
    let ativo = true
    const timer = setTimeout(async () => {
      setBuscandoLivro(true)
      try {
        const res = await getLivros({ page:0, pageSize:30, search:termo })
        if (ativo) setResultadosLivro(res?.data || [])
      } catch (e) {
        console.error('Erro ao buscar livros:', e)
        if (ativo) setResultadosLivro([])
      } finally { if (ativo) setBuscandoLivro(false) }
    }, 250)
    return () => { ativo = false; clearTimeout(timer) }
  }, [buscaLivro, form.livro_id])
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
    if (!form.responsavel_ids.length) return alert('Selecione ao menos um responsável.')
    if (etapas.some(e => e.dias_antes > 0) && !form.data_prazo) return alert('Informe o prazo final para calcular as datas das etapas.')
    setSalvando(true)
    try {
      const identificacao = livro ? `${livro.titulo}${livro.autor ? ` — ${livro.autor}` : ''}${livro.isbn ? ` · ISBN ${livro.isbn}` : ''}` : ''
      const checklist = (modelo.checklist_padrao || []).sort((a,b)=>(a.ordem||0)-(b.ordem||0)).map(c => {
        const etapa = decodificarEtapa(c.texto)
        const dias = Number(c.dias_antes ?? etapa.dias_antes) || 0
        return {
          texto: textoEtapaComData(c, form.data_prazo),
          data_prazo: form.data_prazo ? isoLocal(calcularData(form.data_prazo, dias)) : null,
        }
      })
      const nova = await atribuirTarefaInf({
        bancoTarefaId:modelo.id, responsavelIds:form.responsavel_ids,
        dataPrazo:form.data_prazo || null,
        especificidade:[identificacao ? `Livro: ${identificacao}` : '', form.observacao.trim()].filter(Boolean).join('\n'),
        atribuidaPor:usuario.id, checklist, parceiroId:form.parceiro_id || null, quantidade:1,
      })
      onCreated({ ...nova, _origem:'nova' })
      onClose()
    } catch (e) { alert('Erro ao criar tarefa: ' + (e.message || 'erro desconhecido')) }
    finally { setSalvando(false) }
  }
  return <div className="modal-backdrop"><div className="modal" style={{ maxWidth:680, maxHeight:'92vh', overflowY:'auto' }}><div className="modal-header"><div><h2 className="modal-title">Nova tarefa</h2><p style={{ margin:'3px 0 0', fontSize:11, color:'var(--text-muted)' }}>O parceiro ou livraria é opcional.</p></div><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button></div><div className="form-grid"><div className="form-group"><label className="form-label">1. Modelo de tarefa *</label><select className="form-select" value={form.modelo_id} onChange={e => setForm(f => ({ ...f, modelo_id:e.target.value }))}><option value="">Selecione</option>{modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></div><div className="form-row"><div className="form-group"><label className="form-label">2. Parceiro ou livraria (opcional)</label><select className="form-select" value={form.parceiro_id} onChange={e => setForm(f => ({ ...f, parceiro_id:e.target.value }))}><option value="">Sem parceiro ou livraria</option>{parceiros.map(p => <option key={p.id} value={p.id}>{nomeParceiro(p)}</option>)}</select></div><div className="form-group"><label className="form-label">3. Livro relacionado (opcional)</label><input className="form-input" placeholder="Buscar por título, autor ou ISBN..." value={buscaLivro} onChange={e => { setBuscaLivro(e.target.value); setLivroSel(null); setForm(f => ({ ...f, livro_id:'' })) }}/>{buscaLivro.trim() && !form.livro_id && <div style={{ marginTop:6, border:'1px solid var(--border)', borderRadius:8, maxHeight:220, overflowY:'auto', background:'var(--surface)' }}>{resultadosLivro.map(l => <button key={l.id} type="button" onClick={() => { setLivroSel(l); setForm(f => ({ ...f, livro_id:l.id })); setBuscaLivro(`${l.titulo}${l.autor ? ` — ${l.autor}` : ''}${l.isbn ? ` · ISBN ${l.isbn}` : ''}`) }} style={{ width:'100%', textAlign:'left', padding:'9px 11px', border:'none', borderBottom:'1px solid var(--border)', background:form.livro_id === l.id ? 'var(--accent-glow)' : 'transparent', color:'var(--text)', cursor:'pointer' }}><strong>{l.titulo}</strong>{l.autor ? <span> — {l.autor}</span> : null}{l.isbn ? <span style={{ color:'var(--text-muted)' }}> · ISBN {l.isbn}</span> : null}</button>)}{buscandoLivro && <div style={{ padding:10, fontSize:12, color:'var(--text-muted)' }}>Buscando livros...</div>}{!buscandoLivro && resultadosLivro.length === 0 && <div style={{ padding:10, fontSize:12, color:'var(--text-muted)' }}>Nenhum livro encontrado.</div>}</div>}{form.livro_id && <div style={{ marginTop:6, fontSize:11, color:'var(--accent)' }}>Livro selecionado.</div>}</div></div><div className="form-group"><label className="form-label">4. Responsável *</label><div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>{usuarios.map(u => { const ativo=form.responsavel_ids.includes(u.id); return <button key={u.id} type="button" onClick={() => toggle(u.id)} style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`, background:ativo ? 'var(--accent-glow)' : 'transparent', color:ativo ? 'var(--accent)' : 'var(--text-muted)', cursor:'pointer' }}>{u.nome.split(' ')[0]}</button> })}</div></div><div className="form-group"><label className="form-label">5. Prazo final</label><input className="form-input" type="date" value={form.data_prazo} onChange={e => setForm(f => ({ ...f, data_prazo:e.target.value }))}/>{form.data_prazo && <div style={{ marginTop:5, fontSize:11, color:'var(--accent)' }}>{dataLongaPt(form.data_prazo)}</div>}</div>{modelo && <div className="form-group"><label className="form-label">Prévia do cronograma</label><div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:9, padding:10, display:'grid', gap:7 }}>{etapas.length === 0 ? <span style={{ fontSize:11, color:'var(--text-muted)' }}>Este modelo não tem etapas.</span> : etapas.map((e,i) => <div key={i} style={{ display:'flex', justifyContent:'space-between', gap:10, fontSize:12 }}><span>{i+1}. {e.texto}</span><strong style={{ color:form.data_prazo ? 'var(--accent)' : 'var(--text-muted)' }}>{form.data_prazo ? formatarData(calcularData(form.data_prazo, e.dias_antes)) : (e.dias_antes ? `${e.dias_antes} dias antes` : 'no prazo final')}</strong></div>)}</div></div>}<div className="form-group"><label className="form-label">Observação específica</label><textarea className="form-textarea" rows={3} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao:e.target.value }))}/></div></div><div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Criando...' : 'Criar tarefa'}</button></div></div></div>
}

function ModalEditarTarefa({ tarefa, parceiros, livros, usuarios, onClose, onSaved }) {
  const detalhes = separarDetalhes(tarefa.especificidade)
  const livroAtual = livros.find(l => detalhes.livro.startsWith(l.titulo)) || null
  const [salvando, setSalvando] = useState(false)
  const [buscaLivro, setBuscaLivro] = useState('')
  const [resultadosLivro, setResultadosLivro] = useState([])
  const [livroSel, setLivroSel] = useState(null)
  const [buscandoLivro, setBuscandoLivro] = useState(false)
  const [form, setForm] = useState({ titulo:tarefa.banco_tarefa?.nome || tarefa.titulo || '', parceiro_id:tarefa.parceiro?.id || '', livro_id:livroAtual?.id || '', responsavel_ids:responsaveisDa(tarefa).map(r => r.id), data_prazo:tarefa.data_prazo || '', status:tarefa.status || 'a_fazer', observacao:detalhes.observacao || '' })
  useEffect(() => {
    const termo = buscaLivro.trim()
    if (!termo || form.livro_id) { setResultadosLivro([]); return }
    let ativo = true
    const timer = setTimeout(async () => {
      setBuscandoLivro(true)
      try {
        const res = await getLivros({ page:0, pageSize:30, search:termo })
        if (ativo) setResultadosLivro(res?.data || [])
      } catch (e) {
        console.error('Erro ao buscar livros:', e)
        if (ativo) setResultadosLivro([])
      } finally { if (ativo) setBuscandoLivro(false) }
    }, 250)
    return () => { ativo = false; clearTimeout(timer) }
  }, [buscaLivro, form.livro_id])
  function toggle(id) { setForm(f => ({ ...f, responsavel_ids:f.responsavel_ids.includes(id) ? f.responsavel_ids.filter(x => x !== id) : [...f.responsavel_ids, id] })) }
  async function salvar() {
    if (!form.responsavel_ids.length) return alert('Selecione ao menos um responsável.')
    setSalvando(true)
    try {
      if (tarefa._origem === 'antiga') {
        const atualizada = await updateTarefa(tarefa._idOriginal, { titulo:form.titulo.trim() || tarefa.titulo, descricao:form.observacao.trim() || null, data_prazo:form.data_prazo || null, status:form.status === 'concluida' ? 'concluido' : form.status })
        onSaved(normalizarTarefaAntiga(atualizada))
      } else {
        const livro = livroSel
        const identificacao = livro ? `${livro.titulo}${livro.autor ? ` — ${livro.autor}` : ''}${livro.isbn ? ` · ISBN ${livro.isbn}` : ''}` : ''
        const atualizada = await updateAtribuicaoInf(tarefa.id, { parceiro_id:form.parceiro_id || null, parceiros_ids:form.parceiro_id ? [form.parceiro_id] : [], data_prazo:form.data_prazo || null, status:form.status, _statusAnterior:tarefa.status, especificidade:[identificacao ? `Livro: ${identificacao}` : '', form.observacao.trim()].filter(Boolean).join('\n'), _responsaveisIds:form.responsavel_ids })
        onSaved({ ...atualizada, _origem:'nova' })
      }
      onClose()
    } catch (e) { alert('Erro ao editar tarefa: ' + (e.message || 'erro desconhecido')) }
    finally { setSalvando(false) }
  }
  return <div className="modal-backdrop"><div className="modal" style={{ maxWidth:620, maxHeight:'92vh', overflowY:'auto' }}><div className="modal-header"><h2 className="modal-title">Editar tarefa</h2><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button></div><div className="form-grid">{tarefa._origem === 'antiga' && <div className="form-group"><label className="form-label">Título</label><input className="form-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo:e.target.value }))}/></div>}{tarefa._origem !== 'antiga' && <div className="form-row"><div className="form-group"><label className="form-label">Parceiro ou livraria (opcional)</label><select className="form-select" value={form.parceiro_id} onChange={e => setForm(f => ({ ...f, parceiro_id:e.target.value }))}><option value="">Sem parceiro ou livraria</option>{parceiros.map(p => <option key={p.id} value={p.id}>{nomeParceiro(p)}</option>)}</select></div><div className="form-group"><label className="form-label">Livro relacionado (opcional)</label><input className="form-input" placeholder="Buscar por título, autor ou ISBN..." value={buscaLivro} onChange={e => { setBuscaLivro(e.target.value); setLivroSel(null); setForm(f => ({ ...f, livro_id:'' })) }}/>{buscaLivro.trim() && !form.livro_id && <div style={{ marginTop:6, border:'1px solid var(--border)', borderRadius:8, maxHeight:220, overflowY:'auto', background:'var(--surface)' }}>{resultadosLivro.map(l => <button key={l.id} type="button" onClick={() => { setLivroSel(l); setForm(f => ({ ...f, livro_id:l.id })); setBuscaLivro(`${l.titulo}${l.autor ? ` — ${l.autor}` : ''}${l.isbn ? ` · ISBN ${l.isbn}` : ''}`) }} style={{ width:'100%', textAlign:'left', padding:'9px 11px', border:'none', borderBottom:'1px solid var(--border)', background:form.livro_id === l.id ? 'var(--accent-glow)' : 'transparent', color:'var(--text)', cursor:'pointer' }}><strong>{l.titulo}</strong>{l.autor ? <span> — {l.autor}</span> : null}{l.isbn ? <span style={{ color:'var(--text-muted)' }}> · ISBN {l.isbn}</span> : null}</button>)}{buscandoLivro && <div style={{ padding:10, fontSize:12, color:'var(--text-muted)' }}>Buscando livros...</div>}{!buscandoLivro && resultadosLivro.length === 0 && <div style={{ padding:10, fontSize:12, color:'var(--text-muted)' }}>Nenhum livro encontrado.</div>}</div>}{form.livro_id && <div style={{ marginTop:6, fontSize:11, color:'var(--accent)' }}>Livro selecionado.</div>}</div></div>}<div className="form-group"><label className="form-label">Responsáveis</label><div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>{usuarios.map(u => { const ativo=form.responsavel_ids.includes(u.id); return <button key={u.id} type="button" onClick={() => toggle(u.id)} style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`, background:ativo ? 'var(--accent-glow)' : 'transparent', color:ativo ? 'var(--accent)' : 'var(--text-muted)', cursor:'pointer' }}>{u.nome.split(' ')[0]}</button> })}</div></div><div className="form-row"><div className="form-group"><label className="form-label">Prazo</label><input className="form-input" type="date" value={form.data_prazo} onChange={e => setForm(f => ({ ...f, data_prazo:e.target.value }))}/>{form.data_prazo && <div style={{ marginTop:5, fontSize:11, color:'var(--accent)' }}>{dataLongaPt(form.data_prazo)}</div>}</div><div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status:e.target.value }))}>{Object.entries(STATUS).map(([v,s]) => <option key={v} value={v}>{s.label}</option>)}</select></div></div><div className="form-group"><label className="form-label">Observação</label><textarea className="form-textarea" rows={4} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao:e.target.value }))}/></div></div><div className="form-actions"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar alterações'}</button></div></div></div>
}


// ── CALENDÁRIO ───────────────────────────────────────────────────────────────
// Toda a lógica de data usa comparação lexicográfica de string ISO (AAAA-MM-DD).
// Nunca comparamos objetos Date, para não repetir o off-by-one de UTC-3.

const DIAS_CABECALHO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function hojeISO() { return isoLocal(new Date()) }

function addDias(iso, n) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return isoLocal(d)
}

function inicioSemanaISO(iso) {
  const d = new Date(`${iso}T12:00:00`)
  const dia = d.getDay() || 7
  return addDias(iso, -(dia - 1))
}

function gradeMes(iso) {
  const d = new Date(`${iso}T12:00:00`)
  const primeiro = isoLocal(new Date(d.getFullYear(), d.getMonth(), 1))
  const inicio = inicioSemanaISO(primeiro)
  return Array.from({ length: 42 }, (_, i) => addDias(inicio, i))
}

function rotuloMes(iso) {
  const d = new Date(`${iso}T12:00:00`)
  return `${MESES_PT[d.getMonth()]} ${d.getFullYear()}`
}

function diaDoMes(iso) { return Number(iso.slice(8, 10)) }
function mesmoMes(a, b) { return a.slice(0, 7) === b.slice(0, 7) }
function dataCurtaPt(iso) { return `${iso.slice(8,10)}/${iso.slice(5,7)}` }

function dataLongaPt(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  const semana = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'][d.getDay()]
  return `${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)} · ${semana}`
}

// Remove o prefixo [[D-n]] e o sufixo "· prazo dd/mm/aaaa" do texto da etapa.
// A data agora vive na coluna data_prazo — exibi-la no texto seria duplicação.
function limparTextoEtapa(texto) {
  return String(texto || '')
    .replace(PREFIXO, '')
    .replace(/\s*·\s*prazo\s+\d{2}\/\d{2}\/\d{4}\s*$/, '')
    .trim()
}

// Achata tarefas + etapas numa lista única de eventos posicionáveis na grade.
function eventosCalendario(tarefas) {
  const eventos = []
  for (const t of tarefas) {
    const nome = t.banco_tarefa?.nome || t.titulo || 'Tarefa'
    const encerrada = ['concluida', 'cancelada'].includes(t.status)

    if (t.data_prazo) {
      eventos.push({
        id: `tarefa-${t.id}`, iso: String(t.data_prazo).slice(0, 10),
        tipo: 'tarefa', label: nome, concluido: encerrada,
        cor: (STATUS[t.status] || STATUS.a_fazer).color, tarefa: t,
      })
    }

    for (const c of (t.checklist || [])) {
      if (!c.data_prazo) continue
      eventos.push({
        id: `etapa-${c.id}`, iso: String(c.data_prazo).slice(0, 10),
        tipo: 'etapa', label: `${nome} › ${limparTextoEtapa(c.texto)}`,
        concluido: !!c.concluido || encerrada,
        cor: c.concluido ? '#10b981' : (STATUS[t.status] || STATUS.a_fazer).color,
        tarefa: t,
      })
    }
  }
  return eventos
}

function Chip({ evento, compacto }) {
  const atrasado = !evento.concluido && evento.iso < hojeISO()
  return (
    <div title={evento.label} style={{
      fontSize: compacto ? 9.5 : 11, lineHeight: 1.3, padding: compacto ? '2px 4px' : '4px 7px',
      borderRadius: 5, background: `${evento.cor}1c`,
      borderLeft: `2.5px solid ${atrasado ? '#ef4444' : evento.cor}`,
      color: evento.concluido ? 'var(--text-muted)' : 'var(--text-soft)',
      textDecoration: evento.concluido ? 'line-through' : 'none',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      display: 'flex', alignItems: 'center', gap: 3,
    }}>
      {evento.tipo === 'etapa' && <ListTodo size={compacto ? 8 : 10} style={{ flexShrink: 0, opacity: .75 }}/>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{evento.label}</span>
    </div>
  )
}

function CelulaDia({ iso, eventos, ancora, selecionado, onClick, limite }) {
  const hoje = iso === hojeISO()
  const foraDoMes = !mesmoMes(iso, ancora)
  const temAtrasado = eventos.some(e => !e.concluido && e.iso < hojeISO())
  const mostrar = eventos.slice(0, limite)

  return (
    <div onClick={() => onClick(iso)} style={{
      minHeight: 92, padding: 6, cursor: 'pointer', borderRadius: 9,
      background: selecionado ? 'var(--accent-glow)' : foraDoMes ? 'transparent' : 'var(--surface)',
      border: `1px solid ${selecionado ? 'var(--accent)' : temAtrasado ? 'rgba(239,68,68,.4)' : 'var(--border)'}`,
      opacity: foraDoMes ? .45 : 1, display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div style={{
        fontSize: 11, fontWeight: hoje ? 800 : 600, alignSelf: 'flex-start',
        color: hoje ? '#fff' : 'var(--text-muted)',
        background: hoje ? 'var(--accent)' : 'transparent',
        borderRadius: 99, minWidth: 19, textAlign: 'center', padding: hoje ? '1px 5px' : '1px 0',
      }}>{diaDoMes(iso)}</div>
      {mostrar.map(e => <Chip key={e.id} evento={e} compacto/>)}
      {eventos.length > limite && (
        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>+ {eventos.length - limite}</div>
      )}
    </div>
  )
}

function CalendarioTarefas({ eventos, escopo, setEscopo, ancora, setAncora, diaSel, setDiaSel }) {
  const porDia = useMemo(() => {
    const mapa = {}
    for (const e of eventos) (mapa[e.iso] = mapa[e.iso] || []).push(e)
    for (const k of Object.keys(mapa)) {
      mapa[k].sort((a, b) => (a.tipo === b.tipo ? a.label.localeCompare(b.label) : a.tipo === 'tarefa' ? -1 : 1))
    }
    return mapa
  }, [eventos])

  const passo = escopo === 'mes' ? 'mes' : escopo === 'semana' ? 7 : 1
  function navegar(dir) {
    if (passo === 'mes') {
      const d = new Date(`${ancora}T12:00:00`)
      d.setMonth(d.getMonth() + dir)
      setAncora(isoLocal(d))
    } else {
      setAncora(addDias(ancora, dir * passo))
    }
  }

  const dias = escopo === 'mes' ? gradeMes(ancora)
    : escopo === 'semana' ? Array.from({ length: 7 }, (_, i) => addDias(inicioSemanaISO(ancora), i))
    : [ancora]

  const titulo = escopo === 'mes' ? rotuloMes(ancora)
    : escopo === 'semana' ? `${dataCurtaPt(dias[0])} — ${dataCurtaPt(dias[6])}`
    : dataLongaPt(ancora)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navegar(-1)} title="Anterior">‹</button>
          <strong style={{ fontSize:14, minWidth:180, textAlign:'center' }}>{titulo}</strong>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navegar(1)} title="Próximo">›</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setAncora(hojeISO()); setDiaSel(hojeISO()) }}>Hoje</button>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {[['dia','Dia'],['semana','Semana'],['mes','Mês']].map(([v,l]) => (
            <button key={v} className={escopo === v ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setEscopo(v)}>{l}</button>
          ))}
        </div>
      </div>

      {escopo !== 'dia' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5, marginBottom:5 }}>
          {DIAS_CABECALHO.map(d => (
            <div key={d} style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textAlign:'center', textTransform:'uppercase' }}>{d}</div>
          ))}
        </div>
      )}

      {escopo === 'dia' ? (
        <div style={{ display:'grid', gap:7 }}>
          {(porDia[ancora] || []).length === 0
            ? <div className="empty-state"><p>Nada previsto para este dia.</p></div>
            : (porDia[ancora] || []).map(e => <Chip key={e.id} evento={e}/>)}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5 }}>
          {dias.map(iso => (
            <CelulaDia key={iso} iso={iso} eventos={porDia[iso] || []} ancora={ancora}
              selecionado={iso === diaSel} onClick={setDiaSel}
              limite={escopo === 'semana' ? 6 : 3}/>
          ))}
        </div>
      )}

      {escopo !== 'dia' && diaSel && (
        <div style={{ marginTop:16, borderTop:'1px solid var(--border)', paddingTop:14 }}>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:9 }}>{dataLongaPt(diaSel)}</div>
          {(porDia[diaSel] || []).length === 0
            ? <div style={{ fontSize:12, color:'var(--text-muted)' }}>Nada previsto para este dia.</div>
            : <div style={{ display:'grid', gap:6 }}>{(porDia[diaSel] || []).map(e => <Chip key={e.id} evento={e}/>)}</div>}
        </div>
      )}
    </div>
  )
}

export default function TarefasInfluencersOrganizadas() {
  const { usuario } = useAuth()
  const isAdmin = ADMIN_PERFIS.includes(usuario?.perfil)
  const podeCriar = isAdmin || INFLUENCER_PERFIS.includes(usuario?.perfil)
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
  const [visao, setVisao] = useState('lista')
  const [escopo, setEscopo] = useState('mes')
  const [ancora, setAncora] = useState(() => isoLocal(new Date()))
  const [diaSel, setDiaSel] = useState(() => isoLocal(new Date()))
  async function carregar() {
    setLoading(true)
    try {
      if (isAdmin && !sessionStorage.getItem('orbita_cleanup_anny_v1')) {
        try {
          await removerResponsavelAbertoPorNome('Anny')
          sessionStorage.setItem('orbita_cleanup_anny_v1', '1')
        } catch (e) {
          console.error('Erro ao remover Anny das tarefas abertas:', e)
        }
      }
      const [novas, antigas, todosUsuarios, modelosData, parceirosData, livrosRes] = await Promise.all([getAtribuicoesInf(), getTarefas(), getUsuarios(), getBancoTarefasInf(), getParceiros(), getLivros({ page:0, pageSize:500 })])
      const equipe = (todosUsuarios || []).filter(x => INFLUENCER_PERFIS.includes(x.perfil))
      const idsEquipe = new Set(equipe.map(x => x.id))
      const parceirosPorId = Object.fromEntries((parceirosData || []).map(p => [p.id, p]))
      const antigasDoGrupo = (antigas || []).filter(t => [...(t.tarefa_responsaveis || []).map(r => r.usuario_id), t.responsavel?.id, t.responsavel_id].filter(Boolean).some(id => idsEquipe.has(id))).map(t => normalizarTarefaAntiga(t, parceirosPorId))
      setTarefas([...(novas || []).map(t => ({ ...t, _origem:'nova' })), ...antigasDoGrupo])
      setUsuarios(equipe); setModelos(modelosData || []); setParceiros((parceirosData || []).filter(x => (x.grupo || '') === 'influencers')); setLivros(livrosRes?.data || livrosRes || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { carregar() }, [])
  const base = tarefas
  const filtradas = useMemo(() => base.filter(t => {
    if (responsavelFiltro && !responsaveisDa(t).some(r => r.id === responsavelFiltro)) return false
    if (filtro === 'hoje') return isHoje(t.data_prazo) && !['concluida','cancelada'].includes(t.status)
    if (filtro === 'atrasadas') return isAtrasada(t)
    if (filtro === 'semana') return isSemanaAtual(t.data_prazo) && !['concluida','cancelada'].includes(t.status)
    if (filtro === 'concluidas') return t.status === 'concluida'
    return !['concluida','cancelada'].includes(t.status)
  }), [base, filtro, responsavelFiltro])
  const eventos = useMemo(() => eventosCalendario(
    base.filter(t => !responsavelFiltro || responsaveisDa(t).some(r => r.id === responsavelFiltro))
  ), [base, responsavelFiltro])

  const resumo = { atrasadas:base.filter(isAtrasada).length, hoje:base.filter(t => isHoje(t.data_prazo) && !['concluida','cancelada'].includes(t.status)).length, andamento:base.filter(t => t.status === 'em_andamento').length, concluidas:base.filter(t => t.status === 'concluida' && isSemanaAtual((t.concluida_em || t.updated_at || '').slice(0,10) || t.data_prazo)).length }
  async function mudarStatus(tarefa, status) {
    if (tarefa._origem === 'antiga') { const atualizada=await updateTarefa(tarefa._idOriginal,{ status:status === 'concluida' ? 'concluido' : status }); setTarefas(prev => prev.map(x => x.id === tarefa.id ? normalizarTarefaAntiga(atualizada) : x)); return }
    const atualizada=await updateAtribuicaoInf(tarefa.id,{ status, _statusAnterior:tarefa.status }); setTarefas(prev => prev.map(x => x.id === tarefa.id ? { ...atualizada, _origem:'nova' } : x))
  }
  async function excluir(tarefa) {
    const nome=tarefa.banco_tarefa?.nome || tarefa.titulo || 'esta tarefa'
    if (!window.confirm(`Excluir definitivamente "${nome}"? Esta ação não pode ser desfeita.`)) return
    try { if (tarefa._origem === 'antiga') await deleteTarefa(tarefa._idOriginal); else await deleteAtribuicaoInf(tarefa.id); setTarefas(prev => prev.filter(x => x.id !== tarefa.id)) } catch (e) { alert('Erro ao excluir tarefa: ' + (e.message || 'erro desconhecido')) }
  }
  if (modelosAberto) return <div style={{ padding:'24px 28px 40px', maxWidth:1600, margin:'0 auto' }}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}><div><h1 className="page-title" style={{ margin:0 }}>Modelos de tarefa</h1><p style={{ margin:'5px 0 0', fontSize:12, color:'var(--text-muted)' }}>Cadastre tipos de atividade, instruções e checklists reutilizáveis.</p></div><button className="btn btn-ghost" onClick={() => { setModelosAberto(false); carregar() }}>Voltar às tarefas</button></div><ModelosTarefasInfluencers /></div>
  return <div style={{ padding:'24px 28px 40px', maxWidth:1500, margin:'0 auto' }}><div style={{ display:'flex', justifyContent:'space-between', gap:16, marginBottom:20, flexWrap:'wrap' }}><div><h1 className="page-title" style={{ margin:0 }}>Tarefas Influencers</h1><p style={{ margin:'5px 0 0', color:'var(--text-muted)', fontSize:12 }}>Tarefas antigas e novas reunidas em uma única visão.</p></div><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}><button className="btn btn-ghost" onClick={carregar}><RefreshCw size={14}/> Atualizar</button>{isAdmin && <button className="btn btn-ghost" onClick={() => setModelosAberto(true)}><Settings size={14}/> Configurar modelos</button>}{podeCriar && <button className="btn btn-primary" onClick={() => setModalNova(true)}><Plus size={14}/> Nova tarefa</button>}</div></div><div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:18 }}><ResumoCard icon={AlertTriangle} label="Atrasadas" value={resumo.atrasadas} tone="#ef4444"/><ResumoCard icon={CalendarDays} label="Para hoje" value={resumo.hoje} tone="#f59e0b"/><ResumoCard icon={Clock} label="Em andamento" value={resumo.andamento} tone="#6366f1"/><ResumoCard icon={CheckCircle2} label="Concluídas na semana" value={resumo.concluidas} tone="#10b981"/></div><div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:16 }}>{['todas','hoje','atrasadas','semana','concluidas'].map(v => <button key={v} className={filtro === v ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setFiltro(v)}>{({ todas:'Todas', hoje:'Hoje', atrasadas:'Atrasadas', semana:'Esta semana', concluidas:'Concluídos' })[v]}</button>)}<div style={{ display:'flex', gap:6, marginLeft:'auto' }}>{[['lista','Lista'],['calendario','Calendário']].map(([v,l]) => <button key={v} className={visao === v ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setVisao(v)}>{v === 'calendario' ? <CalendarDays size={13}/> : <ListTodo size={13}/>} {l}</button>)}</div>{isAdmin && <select className="form-select" style={{ width:'auto' }} value={responsavelFiltro} onChange={e => setResponsavelFiltro(e.target.value)}><option value="">Toda a equipe</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>}</div>{loading ? <div className="loading"><div className="spinner"/></div> : visao === 'calendario' ? <CalendarioTarefas eventos={eventos} escopo={escopo} setEscopo={setEscopo} ancora={ancora} setAncora={setAncora} diaSel={diaSel} setDiaSel={setDiaSel}/> : filtradas.length === 0 ? <div className="empty-state"><p>Nenhuma tarefa encontrada neste filtro.</p></div> : <div style={{ display:'grid', gap:10 }}>{filtradas.map(t => <TaskCard key={t.id} tarefa={t} onStatus={mudarStatus} onEdit={setTarefaEditando} onDelete={excluir} podeGerenciar={isAdmin}/>)}</div>}{modalNova && <ModalNovaTarefa modelos={modelos} parceiros={parceiros} livros={livros} usuarios={usuarios} usuario={usuario} onClose={() => setModalNova(false)} onCreated={nova => setTarefas(prev => [nova, ...prev])}/>} {tarefaEditando && <ModalEditarTarefa tarefa={tarefaEditando} parceiros={parceiros} livros={livros} usuarios={usuarios} onClose={() => setTarefaEditando(null)} onSaved={salva => setTarefas(prev => prev.map(x => x.id === tarefaEditando.id ? salva : x))}/>}</div>
}

// deploy-forcado-livro-opcional-2026-08-05