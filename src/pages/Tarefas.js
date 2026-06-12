import { useEffect, useState, useRef } from 'react'
import {
  getTarefas, createTarefa, updateTarefa, deleteTarefa,
  addChecklistItem, updateChecklistItem, deleteChecklistItem,
  addComentario, getUsuarios,
  addLivroTarefa, removeLivroTarefa, getLivros,
  importarTarefasLote, buscarLivroPorISBN,
  setResponsaveisTarefa, toggleParteResponsavel, concluirTodasAsPartes,
  gerarProximaOcorrencia
} from '../lib/supabase'
import { useAuth, PERFIL_GRUPO } from '../context/AuthContext'
import {
  Plus, X, Pencil, Trash2, CheckSquare, Square, MessageSquare,
  Calendar, Flag, User, ChevronDown, List, Columns, Clock,
  AlertCircle, ArrowUp, Minus, CheckCircle2, Circle, LayoutList,
  CalendarDays, ChevronLeft, ChevronRight, Book, Search,
  Upload, Download, FileSpreadsheet, ChevronUp, Users, Check
} from 'lucide-react'
import { format, isPast, isToday, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as XLSX from 'xlsx'

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

// Mapeamento de valores da planilha (case-insensitive) para valores do banco
const STATUS_MAP = {
  'a fazer': 'a_fazer', 'a_fazer': 'a_fazer',
  'em andamento': 'em_andamento', 'em_andamento': 'em_andamento',
  'concluído': 'concluido', 'concluido': 'concluido',
}

const PRIORIDADE_MAP = {
  'urgente': 'urgente',
  'alta': 'alta',
  'média': 'media', 'media': 'media',
  'baixa': 'baixa',
}

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

// ── SELETOR DE LIVROS ──────────────────────────────────────
function SeletorLivros({ tarefaId, livrosVinculados, onChange }) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const buscaTimeout = useRef(null)

  const idsVinculados = (livrosVinculados || []).map(tl => tl.livros?.id).filter(Boolean)

  useEffect(() => {
    if (buscaTimeout.current) clearTimeout(buscaTimeout.current)
    if (!busca.trim() || busca.trim().length < 2) {
      setResultados([])
      return
    }
    buscaTimeout.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const { data } = await getLivros({ page: 0, pageSize: 10, search: busca.trim() })
        setResultados(data || [])
      } catch (e) { console.error(e) }
      finally { setBuscando(false) }
    }, 300)
    return () => clearTimeout(buscaTimeout.current)
  }, [busca])

  async function adicionarLivro(livro) {
    if (idsVinculados.includes(livro.id)) return
    if (!tarefaId) return
    try {
      const novo = await addLivroTarefa(tarefaId, livro.id)
      onChange([...(livrosVinculados || []), novo])
      setBusca('')
      setResultados([])
      setShowResults(false)
    } catch (e) { console.error(e) }
  }

  async function removerLivro(tarefaLivroId) {
    try {
      await removeLivroTarefa(tarefaLivroId)
      onChange((livrosVinculados || []).filter(tl => tl.id !== tarefaLivroId))
    } catch (e) { console.error(e) }
  }

  const resultadosFiltrados = resultados.filter(r => !idsVinculados.includes(r.id))

  if (!tarefaId) {
    return (
      <div style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic', padding:'6px 0' }}>
        Salve a tarefa primeiro para vincular livros.
      </div>
    )
  }

  return (
    <div>
      {(livrosVinculados || []).length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
          {livrosVinculados.map(tl => (
            <div key={tl.id} style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'4px 10px', borderRadius:99,
              background:'var(--accent-glow)', border:'1px solid var(--accent)',
              fontSize:11, color:'var(--accent)', fontWeight:600
            }}>
              <Book size={11}/>
              <span style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {tl.livros?.titulo || 'Livro'}
              </span>
              <button onClick={()=>removerLivro(tl.id)} style={{
                background:'none', border:'none', cursor:'pointer', padding:0,
                display:'flex', alignItems:'center', color:'var(--accent)', opacity:0.7
              }}>
                <X size={11}/>
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ position:'relative' }}>
        <div style={{ position:'relative' }}>
          <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
          <input
            className="form-input"
            value={busca}
            onChange={e=>{ setBusca(e.target.value); setShowResults(true) }}
            onFocus={()=>setShowResults(true)}
            onBlur={()=>setTimeout(()=>setShowResults(false), 200)}
            placeholder="Buscar livro por título, autor ou ISBN..."
            style={{ paddingLeft:32, fontSize:12 }}
          />
        </div>

        {showResults && busca.trim().length >= 2 && (
          <div style={{
            position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
            background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8,
            boxShadow:'0 4px 16px rgba(0,0,0,0.15)', zIndex:10,
            maxHeight:240, overflowY:'auto'
          }}>
            {buscando && (
              <div style={{ padding:'12px 14px', fontSize:12, color:'var(--text-muted)' }}>Buscando...</div>
            )}
            {!buscando && resultadosFiltrados.length === 0 && (
              <div style={{ padding:'12px 14px', fontSize:12, color:'var(--text-muted)' }}>
                {resultados.length > 0 ? 'Todos os livros encontrados já foram vinculados.' : 'Nenhum livro encontrado.'}
              </div>
            )}
            {!buscando && resultadosFiltrados.map(livro => (
              <button
                key={livro.id}
                onClick={()=>adicionarLivro(livro)}
                style={{
                  width:'100%', padding:'8px 12px', textAlign:'left',
                  background:'transparent', border:'none', cursor:'pointer',
                  display:'flex', flexDirection:'column', gap:2,
                  borderBottom:'1px solid var(--border)'
                }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              >
                <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{livro.titulo}</span>
                <span style={{ fontSize:10, color:'var(--text-muted)' }}>
                  {livro.autor || 'Sem autor'} {livro.isbn ? `· ISBN ${livro.isbn}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── MODAL TAREFA ───────────────────────────────────────────
function ModalTarefa({ tarefa, usuarios, onSave, onClose, onDelete }) {
  const { usuario } = useAuth()
  const EMPTY = { titulo:'', descricao:'', status:'a_fazer', prioridade:'media', responsaveis: [], data_prazo: tarefa?._dataPrazo || '', recorrencia_tipo:'', recorrencia_dia_semana:'1', recorrencia_dia_mes:'1' }
  const [form, setForm] = useState(tarefa && !tarefa._dataPrazo ? {
    titulo:          tarefa.titulo,
    descricao:       tarefa.descricao || '',
    status:          tarefa.status,
    prioridade:      tarefa.prioridade,
    responsaveis:    (tarefa.tarefa_responsaveis || []).map(r => r.usuario_id),
    data_prazo:      tarefa.data_prazo || '',
    recorrencia_tipo:       tarefa.recorrencia_tipo || '',
    recorrencia_dia_semana: String(tarefa.recorrencia_config?.dia_semana ?? '1'),
    recorrencia_dia_mes:    String(tarefa.recorrencia_config?.dia_mes ?? '1'),
  } : EMPTY)
  const [checklist, setChecklist]   = useState(tarefa?.tarefa_checklist || [])
  const [comentarios, setComentarios] = useState(tarefa?.tarefa_comentarios || [])
  const [livrosVinculados, setLivrosVinculados] = useState(tarefa?.tarefa_livros || [])
  const [novoItem, setNovoItem]     = useState('')
  const [novoComent, setNovoComent] = useState('')
  const [saving, setSaving]         = useState(false)
  const [tab, setTab]               = useState('detalhes')
  const checkInputRef = useRef()

  async function salvar() {
    if (!form.titulo.trim()) return
    setSaving(true)
    try {
      const { responsaveis, recorrencia_tipo, recorrencia_dia_semana, recorrencia_dia_mes, ...resto } = form
      const recorrenciaConfig = recorrencia_tipo
        ? (recorrencia_tipo === 'mensal'
            ? { dia_mes: Number(recorrencia_dia_mes) || 1 }
            : (recorrencia_tipo === 'semanal' || recorrencia_tipo === 'quinzenal')
              ? { dia_semana: Number(recorrencia_dia_semana) }
              : {})
        : null
      await onSave({
        ...resto,
        responsavel_id:    responsaveis[0] || null,
        data_prazo:        form.data_prazo || null,
        created_by:        tarefa ? undefined : usuario?.id,
        recorrencia_ativa: !!recorrencia_tipo,
        recorrencia_tipo:  recorrencia_tipo || null,
        recorrencia_config: recorrenciaConfig,
      }, tarefa?.id, responsaveis, tarefa ? [] : checklist.filter(c => c._local))
      onClose()
    } catch(e) { console.error(e) } finally { setSaving(false) }
  }

  async function addItem() {
    if (!novoItem.trim()) return
    if (!tarefa) {
      // Modo cadastro: item local; será gravado junto ao salvar a tarefa
      setChecklist(prev => [...prev, { id: `local-${Date.now()}`, texto: novoItem.trim(), concluido: false, ordem: prev.length, _local: true }])
      setNovoItem('')
      checkInputRef.current?.focus()
      return
    }
    const item = await addChecklistItem(tarefa.id, novoItem.trim())
    setChecklist(prev => [...prev, item])
    setNovoItem('')
    checkInputRef.current?.focus()
  }

  async function toggleItem(item) {
    if (item._local) {
      setChecklist(prev => prev.map(x => x.id === item.id ? { ...x, concluido: !x.concluido } : x))
      return
    }
    const upd = await updateChecklistItem(item.id, { concluido: !item.concluido })
    setChecklist(prev => prev.map(x => x.id === upd.id ? upd : x))
  }

  async function removeItem(id) {
    if (String(id).startsWith('local-')) {
      setChecklist(prev => prev.filter(x => x.id !== id))
      return
    }
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

        {(
          <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border)', marginBottom:16 }}>
            {[
              { id:'detalhes',   label:'Detalhes' },
              { id:'checklist',  label:`Checklist ${checkTotal > 0 ? `(${checkDone}/${checkTotal})` : ''}` },
              ...(tarefa ? [{ id:'comentarios', label:`Comentários (${comentarios.length})` }] : []),
            ].map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                padding:'8px 16px', fontSize:12, fontWeight:700, border:'none', cursor:'pointer',
                background:'transparent', borderBottom: tab===t.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab===t.id ? 'var(--accent)' : 'var(--text-muted)', transition:'all 0.15s'
              }}>{t.label}</button>
            ))}
          </div>
        )}

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
                <label className="form-label">Prazo</label>
                <input className="form-input" type="date" value={form.data_prazo} onChange={e=>setForm(f=>({...f,data_prazo:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Recorrência</label>
                <select className="form-select" value={form.recorrencia_tipo} onChange={e=>setForm(f=>({...f,recorrencia_tipo:e.target.value}))}>
                  <option value="">Não se repete</option>
                  <option value="diaria">Diária</option>
                  <option value="semanal">Semanal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="mensal">Mensal</option>
                </select>
              </div>
            </div>
            {(form.recorrencia_tipo === 'semanal' || form.recorrencia_tipo === 'quinzenal') && (
              <div className="form-group">
                <label className="form-label">Dia da semana</label>
                <select className="form-select" value={form.recorrencia_dia_semana} onChange={e=>setForm(f=>({...f,recorrencia_dia_semana:e.target.value}))}>
                  {['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map((d,i)=>(
                    <option key={i} value={String(i)}>{d}</option>
                  ))}
                </select>
              </div>
            )}
            {form.recorrencia_tipo === 'mensal' && (
              <div className="form-group">
                <label className="form-label">Dia do mês</label>
                <select className="form-select" value={form.recorrencia_dia_mes} onChange={e=>setForm(f=>({...f,recorrencia_dia_mes:e.target.value}))}>
                  {Array.from({length:31},(_,i)=>i+1).map(d=>(
                    <option key={d} value={String(d)}>{d}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Responsáveis</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {usuarios.map(u=>{
                  const ativo = form.responsaveis.includes(u.id)
                  return (
                    <button key={u.id} type="button"
                      onClick={()=>setForm(f=>({...f,responsaveis: ativo ? f.responsaveis.filter(id=>id!==u.id) : [...f.responsaveis, u.id]}))}
                      style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',border:'2px solid',
                        borderColor: ativo ? 'var(--accent)' : 'var(--border)',
                        background: ativo ? 'var(--accent-glow)' : 'transparent',
                        color: ativo ? 'var(--accent)' : 'var(--text-muted)',transition:'all 0.15s'}}>
                      {u.nome}
                    </button>
                  )
                })}
              </div>
              {form.responsaveis.length > 1 && (
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                  Cada responsável conclui a sua parte; a tarefa fecha quando todos concluírem.
                </div>
              )}
            </div>
            {tarefa && (tarefa.tarefa_responsaveis || []).length > 0 && (
              <div className="form-group">
                <label className="form-label">Conclusão por responsável</label>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {(tarefa.tarefa_responsaveis || []).map(r => {
                    const ehMinha = r.usuario_id === usuario?.id
                    const podeMarcar = ehMinha || usuario?.perfil === 'administrador' || usuario?.perfil === 'gerente'
                    return (
                      <label key={r.id} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,
                        color: r.concluido ? '#22c55e' : 'var(--text)', cursor: podeMarcar ? 'pointer' : 'default', opacity: podeMarcar ? 1 : 0.7}}>
                        <input type="checkbox" checked={!!r.concluido} disabled={!podeMarcar}
                          onChange={async (e) => {
                            const novoValor = e.target.checked
                            try {
                              await toggleParteResponsavel(r.id, novoValor)
                              const atualizados = (tarefa.tarefa_responsaveis || []).map(x => x.id === r.id ? { ...x, concluido: novoValor } : x)
                              const todosConcluiram = atualizados.length > 0 && atualizados.every(x => x.concluido)
                              if (todosConcluiram && tarefa.status !== 'concluido') {
                                await onSave({ status: 'concluido' }, tarefa.id, atualizados.map(x => x.usuario_id))
                                onClose()
                              } else if (!todosConcluiram && tarefa.status === 'concluido') {
                                await onSave({ status: 'em_andamento' }, tarefa.id, atualizados.map(x => x.usuario_id))
                                onClose()
                              } else {
                                tarefa.tarefa_responsaveis = atualizados
                                setForm(f => ({ ...f }))
                              }
                            } catch(err) { console.error(err) }
                          }}/>
                        <span>{r.usuario?.nome}{ehMinha ? ' (você)' : ''}</span>
                        {r.concluido && <Check size={13} color="#22c55e"/>}
                      </label>
                    )
                  })}
                </div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                  A tarefa é concluída automaticamente quando todos marcarem a sua parte.
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Livros relacionados (opcional)</label>
              <SeletorLivros
                tarefaId={tarefa?.id}
                livrosVinculados={livrosVinculados}
                onChange={setLivrosVinculados}
              />
            </div>
          </div>
        )}

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

// ── MODAL DE IMPORTAÇÃO ────────────────────────────────────
function ModalImportar({ usuarios, onClose, onImported }) {
  const { usuario } = useAuth()
  const [etapa, setEtapa] = useState('upload')
  const [arquivo, setArquivo] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const fileInputRef = useRef()

  function baixarTemplate() {
    const wb = XLSX.utils.book_new()

    const headers = [
      'Título', 'Descrição', 'Responsável',
      'Livros (ISBN, separados por vírgula)',
      'Prazo (DD/MM/AAAA)', 'Prioridade', 'Status'
    ]
    const exemplos = [
      ['Produzir 4 roteiros de Reels - semana 19', 'Foco em hooks de abertura. Entregar até quinta.', 'Sarah', '9788580330000, 9788580330001', '09/05/2026', 'Alta', 'A fazer'],
      ['Atualizar ficha técnica de 3 títulos', 'Corrigir peso e dimensões no Mercado Livre.', 'Fernanda', '9788580330002', '12/05/2026', 'Média', 'A fazer'],
      ['Briefing de carrossel - campanha Quaresma', 'Tom litúrgico, 7 slides.', 'Vanessa', '9788580330003, 9788580330004', '15/05/2026', 'Baixa', 'A fazer'],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet([headers, ...exemplos])
    ws1['!cols'] = [{ wch: 38 }, { wch: 45 }, { wch: 18 }, { wch: 32 }, { wch: 20 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Tarefas')

    const instr = [
      ['Como usar este template'],
      [''],
      ['1. Apague as 3 linhas de exemplo da aba Tarefas antes de preencher com suas tarefas reais.'],
      ['2. Preencha uma linha por tarefa. Não deixe linhas em branco no meio.'],
      ['3. Salve em formato .xlsx (não .csv ou .xls).'],
      ['4. Volte para o Orbita e faça o upload.'],
      [''],
      ['Regras de cada campo:'],
      ['Título: obrigatório, máximo 200 caracteres.'],
      ['Descrição: opcional, briefing detalhado.'],
      ['Responsável: obrigatório. Use exatamente um dos nomes da aba Referências.'],
      ['Livros: opcional. ISBN com 13 dígitos. Para múltiplos livros, separe por vírgula.'],
      ['Prazo: obrigatório. Formato DD/MM/AAAA.'],
      ['Prioridade: obrigatório. Aceita: Urgente, Alta, Média, Baixa.'],
      ['Status: opcional. Padrão A fazer. Aceita: A fazer, Em andamento, Concluído.'],
      [''],
      ['Observações:'],
      ['- Linhas com erro são ignoradas. As válidas são importadas normalmente.'],
      ['- O sistema valida cada ISBN contra o catálogo antes de importar.'],
      ['- Cada tarefa criada registra quem importou e quando.'],
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(instr)
    ws2['!cols'] = [{ wch: 90 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Instruções')

    const refs = [['Responsáveis', 'Prioridades', 'Status']]
    const responsaveis = (usuarios || []).map(u => u.nome).sort()
    const prioridades = ['Urgente', 'Alta', 'Média', 'Baixa']
    const statuses = ['A fazer', 'Em andamento', 'Concluído']
    const maxLen = Math.max(responsaveis.length, prioridades.length, statuses.length)
    for (let i = 0; i < maxLen; i++) {
      refs.push([responsaveis[i] || '', prioridades[i] || '', statuses[i] || ''])
    }
    const ws3 = XLSX.utils.aoa_to_sheet(refs)
    ws3['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'Referências')

    XLSX.writeFile(wb, 'template_tarefas_orbita.xlsx')
  }

  async function processarArquivo(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      alert('Apenas arquivos .xlsx são aceitos.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo maior que 5 MB.')
      return
    }
    setArquivo(file)

    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets['Tarefas'] || wb.Sheets[wb.SheetNames[0]]
      if (!ws) {
        alert('Aba "Tarefas" não encontrada na planilha.')
        return
      }
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const dados = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ''))

      const linhasProcessadas = await Promise.all(dados.map(async (row, idx) => {
        const linha = idx + 2
        const [titulo, descricao, responsavelNome, isbnsStr, prazoStr, prioridadeStr, statusStr] = row.map(c => String(c).trim())
        const erros = []

        if (!titulo) erros.push('Título vazio')
        else if (titulo.length > 200) erros.push('Título com mais de 200 caracteres')

        let responsavel_id = null
        if (!responsavelNome) {
          erros.push('Responsável vazio')
        } else {
          const u = (usuarios || []).find(u => u.nome.toLowerCase() === responsavelNome.toLowerCase())
          if (!u) {
            const sugestao = (usuarios || []).find(u => u.nome.toLowerCase().startsWith(responsavelNome.toLowerCase().slice(0, 3)))
            erros.push(`Responsável "${responsavelNome}" não encontrado${sugestao ? ` — talvez "${sugestao.nome}"?` : ''}`)
          } else {
            responsavel_id = u.id
          }
        }

        let data_prazo = null
        if (!prazoStr) {
          erros.push('Prazo vazio')
        } else {
          const m = prazoStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
          if (m) {
            data_prazo = `${m[3]}-${m[2]}-${m[1]}`
            const d = new Date(data_prazo + 'T12:00:00')
            if (isNaN(d)) erros.push(`Prazo inválido: "${prazoStr}"`)
          } else {
            erros.push(`Prazo deve estar em DD/MM/AAAA, recebido: "${prazoStr}"`)
          }
        }

        let prioridade = 'media'
        if (!prioridadeStr) {
          erros.push('Prioridade vazia')
        } else {
          const p = PRIORIDADE_MAP[prioridadeStr.toLowerCase()]
          if (!p) erros.push(`Prioridade inválida: "${prioridadeStr}". Aceita: Urgente, Alta, Média, Baixa`)
          else prioridade = p
        }

        let status = 'a_fazer'
        if (statusStr) {
          const s = STATUS_MAP[statusStr.toLowerCase()]
          if (!s) erros.push(`Status inválido: "${statusStr}". Aceita: A fazer, Em andamento, Concluído`)
          else status = s
        }

        let livro_ids = []
        const isbnsRaw = isbnsStr ? isbnsStr.split(',').map(s => s.trim()).filter(Boolean) : []
        for (const isbn of isbnsRaw) {
          const livro = await buscarLivroPorISBN(isbn)
          if (livro) livro_ids.push(livro.id)
          else erros.push(`ISBN "${isbn}" não encontrado no catálogo`)
        }

        return {
          linha,
          titulo, descricao, responsavelNome,
          responsavel_id, data_prazo, prioridade, status,
          livro_ids,
          isbns_originais: isbnsRaw,
          erros,
          valida: erros.length === 0,
        }
      }))

      setLinhas(linhasProcessadas)
      setEtapa('revisao')
    } catch (e) {
      console.error(e)
      alert('Erro ao processar a planilha: ' + (e?.message || 'desconhecido'))
    }
  }

  async function confirmarImportacao() {
    setImportando(true)
    try {
      const validas = linhas.filter(l => l.valida).map(l => ({
        titulo: l.titulo,
        descricao: l.descricao || null,
        status: l.status,
        prioridade: l.prioridade,
        responsavel_id: l.responsavel_id,
        data_prazo: l.data_prazo,
        livro_ids: l.livro_ids,
      }))
      const ignoradas = linhas.filter(l => !l.valida).map(l => ({
        linha: l.linha,
        titulo: l.titulo,
        responsavel: l.responsavelNome,
        erros: l.erros,
      }))

      const r = await importarTarefasLote({
        tarefas: validas,
        ignoradas,
        filename: arquivo.name,
        userId: usuario?.id,
      })
      setResultado(r)
      setEtapa('sucesso')
    } catch (e) {
      console.error(e)
      alert('Erro ao importar: ' + (e?.message || 'desconhecido'))
    } finally {
      setImportando(false)
    }
  }

  function baixarRelatorioErros() {
    const ignoradas = linhas.filter(l => !l.valida)
    if (ignoradas.length === 0) return
    const wb = XLSX.utils.book_new()
    const headers = ['Linha', 'Título', 'Responsável', 'Motivo do erro']
    const dados = ignoradas.map(l => [
      l.linha, l.titulo || '', l.responsavelNome || '', l.erros.join(' · ')
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dados])
    ws['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 18 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Linhas com erro')
    XLSX.writeFile(wb, 'tarefas_ignoradas.xlsx')
  }

  const validas = linhas.filter(l => l.valida).length
  const comErro = linhas.filter(l => !l.valida).length

  return (
    <div className="modal-backdrop" onClick={()=>{}}>
      <div className="modal" style={{ maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ position:'sticky', top:0, background:'var(--surface)', zIndex:10 }}>
          <h2 className="modal-title">Importar tarefas via planilha</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        {etapa === 'upload' && (
          <div>
            <p style={{ fontSize:13, color:'var(--text-soft)', marginBottom:16 }}>
              Baixe o template, preencha com suas tarefas e faça o upload abaixo.
            </p>

            <button
              onClick={baixarTemplate}
              className="btn btn-ghost"
              style={{ width:'100%', marginBottom:16, padding:'12px', justifyContent:'center', gap:8 }}
            >
              <Download size={14}/> Baixar template .xlsx
            </button>

            <div
              onClick={()=>fileInputRef.current?.click()}
              onDragOver={e=>{ e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)' }}
              onDragLeave={e=>{ e.currentTarget.style.borderColor = 'var(--border)' }}
              onDrop={e=>{
                e.preventDefault()
                e.currentTarget.style.borderColor = 'var(--border)'
                const file = e.dataTransfer.files?.[0]
                if (file) processarArquivo(file)
              }}
              style={{
                border:'2px dashed var(--border)', borderRadius:12, padding:'40px 20px',
                textAlign:'center', cursor:'pointer', transition:'border 0.15s',
                background:'var(--surface-2)'
              }}
            >
              <Upload size={32} style={{ color:'var(--text-muted)', marginBottom:8 }}/>
              <div style={{ fontSize:13, color:'var(--text-soft)', marginBottom:4 }}>
                Clique ou arraste o arquivo aqui
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                Apenas .xlsx · máximo 5 MB
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                style={{ display:'none' }}
                onChange={e=>{
                  const file = e.target.files?.[0]
                  if (file) processarArquivo(file)
                  e.target.value = ''
                }}
              />
            </div>
          </div>
        )}

        {etapa === 'revisao' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
              <div style={{ background:'var(--surface-2)', borderRadius:8, padding:'12px' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>Linhas detectadas</div>
                <div style={{ fontSize:22, fontWeight:700 }}>{linhas.length}</div>
              </div>
              <div style={{ background:'rgba(34,197,94,0.1)', borderRadius:8, padding:'12px' }}>
                <div style={{ fontSize:11, color:'var(--green)' }}>Válidas</div>
                <div style={{ fontSize:22, fontWeight:700, color:'var(--green)' }}>{validas}</div>
              </div>
              <div style={{ background:'rgba(239,68,68,0.1)', borderRadius:8, padding:'12px' }}>
                <div style={{ fontSize:11, color:'var(--red)' }}>Com erro</div>
                <div style={{ fontSize:22, fontWeight:700, color:'var(--red)' }}>{comErro}</div>
              </div>
            </div>

            <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:16, maxHeight:300, overflowY:'auto' }}>
              <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
                <thead style={{ background:'var(--surface-2)', position:'sticky', top:0 }}>
                  <tr>
                    <th style={{ padding:'8px 10px', textAlign:'left', color:'var(--text-muted)' }}>#</th>
                    <th style={{ padding:'8px 10px', textAlign:'left', color:'var(--text-muted)' }}>Título</th>
                    <th style={{ padding:'8px 10px', textAlign:'left', color:'var(--text-muted)' }}>Status / Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => (
                    <tr key={l.linha} style={{ background: l.valida ? 'transparent' : 'rgba(239,68,68,0.06)', borderTop:'1px solid var(--border)' }}>
                      <td style={{ padding:'8px 10px', color:'var(--text-muted)' }}>{l.linha}</td>
                      <td style={{ padding:'8px 10px', color: l.valida ? 'var(--text)' : 'var(--red)' }}>
                        {l.titulo || <span style={{ fontStyle:'italic', opacity:0.6 }}>(sem título)</span>}
                      </td>
                      <td style={{ padding:'8px 10px', color: l.valida ? 'var(--green)' : 'var(--red)' }}>
                        {l.valida ? '✓ Pronta' : l.erros.join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {comErro > 0 && (
              <div style={{ background:'rgba(234,179,8,0.1)', border:'1px solid rgba(234,179,8,0.3)', borderRadius:8, padding:'10px 12px', marginBottom:12, fontSize:12, color:'var(--amber)' }}>
                {comErro} linha{comErro!==1?'s':''} com erro será{comErro!==1?'ão':''} ignorada{comErro!==1?'s':''}.
                Você pode <button onClick={baixarRelatorioErros} style={{ background:'none', border:'none', color:'var(--amber)', textDecoration:'underline', cursor:'pointer', padding:0, fontSize:12, fontWeight:700 }}>baixar o relatório de erros</button> para corrigir e re-importar depois.
              </div>
            )}

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={()=>{ setEtapa('upload'); setLinhas([]); setArquivo(null) }}>
                Voltar
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmarImportacao}
                disabled={importando || validas === 0}
              >
                {importando ? 'Importando...' : `Importar ${validas} válida${validas!==1?'s':''}${comErro > 0 ? ` · ${comErro} ignorada${comErro!==1?'s':''}` : ''}`}
              </button>
            </div>
          </div>
        )}

        {etapa === 'sucesso' && resultado && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <CheckCircle2 size={48} color="var(--green)" style={{ marginBottom:12 }}/>
            <h3 style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Importação concluída!</h3>
            <p style={{ fontSize:13, color:'var(--text-soft)', marginBottom:6 }}>
              {resultado.criadas} tarefa{resultado.criadas!==1?'s':''} criada{resultado.criadas!==1?'s':''} com sucesso.
            </p>
            {resultado.livrosVinculados > 0 && (
              <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>
                {resultado.livrosVinculados} vínculo{resultado.livrosVinculados!==1?'s':''} de livro criado{resultado.livrosVinculados!==1?'s':''}.
              </p>
            )}
            {resultado.ignoradas > 0 && (
              <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>
                {resultado.ignoradas} linha{resultado.ignoradas!==1?'s':''} com erro foi/foram ignorada{resultado.ignoradas!==1?'s':''}.
              </p>
            )}
            <button className="btn btn-primary" onClick={()=>{ onImported(); onClose() }} style={{ marginTop:8 }}>
              Ver tarefas
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── CARD KANBAN ────────────────────────────────────────────
function CardKanban({ tarefa, onClick, onDragStart, onDragEnd, isDragging }) {
  const checkTotal = tarefa.tarefa_checklist?.length || 0
  const checkDone  = tarefa.tarefa_checklist?.filter(x=>x.concluido).length || 0
  const livrosCount = tarefa.tarefa_livros?.length || 0
  const p = PRIORIDADE.find(x => x.value === tarefa.prioridade)

  return (
    <div
      draggable
      onDragStart={e=>{ e.dataTransfer.effectAllowed='move'; onDragStart && onDragStart() }}
      onDragEnd={()=>{ onDragEnd && onDragEnd() }}
      onClick={()=>!isDragging && onClick()}
      style={{
        background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10,
        padding:'12px 14px', cursor:'grab', transition:'all 0.15s',
        borderLeft: `3px solid ${p?.color||'var(--border)'}`,
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
      }}
      onMouseEnter={e=>{ if(!isDragging){ e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-1px)' }}}
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
          {livrosCount > 0 && (
            <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}>
              <Book size={11}/> {livrosCount}
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <PrazoBadge data_prazo={tarefa.data_prazo} status={tarefa.status}/>
        </div>
      </div>
      {(() => {
        const resps = (tarefa.tarefa_responsaveis && tarefa.tarefa_responsaveis.length > 0)
          ? tarefa.tarefa_responsaveis
          : (tarefa.responsavel?.nome ? [{ id:'_legado', usuario:{ nome: tarefa.responsavel.nome }, concluido: tarefa.status === 'concluido' }] : [])
        if (resps.length === 0 && !tarefa.recorrencia_ativa) return null
        return (
          <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            {resps.map(r => (
              <div key={r.id} title={r.concluido ? `${r.usuario?.nome} — parte concluída` : r.usuario?.nome}
                style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:18, height:18, borderRadius:'50%',
                  background: r.concluido ? 'rgba(34,197,94,0.18)' : 'var(--accent-glow)',
                  border: `1px solid ${r.concluido ? '#22c55e' : 'var(--accent)'}`,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700,
                  color: r.concluido ? '#22c55e' : 'var(--accent)', flexShrink:0 }}>
                  {(r.usuario?.nome || '?')[0].toUpperCase()}
                </div>
                <span style={{ fontSize:11, color: r.concluido ? '#22c55e' : 'var(--text-muted)', maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {r.usuario?.nome}
                </span>
              </div>
            ))}
            {tarefa.recorrencia_ativa && (
              <span title="Tarefa recorrente" style={{ marginLeft:'auto', fontSize:11 }}>🔁</span>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function menuItemStyle() {
  return {
    width:'100%', padding:'8px 12px', textAlign:'left',
    background:'transparent', border:'none', cursor:'pointer',
    display:'flex', alignItems:'center', gap:10, fontSize:13,
    color:'var(--text)', borderRadius:6, transition:'background 0.1s'
  }
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function Tarefas() {
  const { usuario } = useAuth()
  const [tarefas, setTarefas]       = useState([])
  const [usuarios, setUsuarios]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(null)
  const [showImportar, setShowImportar] = useState(false)
  const [showMenuNova, setShowMenuNova] = useState(false)
  const [view, setView]             = useState('kanban')
  const [filtroStatus, setFiltroStatus]       = useState('todos')
  const [filtroPrioridade, setFiltroPrioridade] = useState('todas')
  const [filtroResponsavel, setFiltroResponsavel] = useState('todos')
  const [filtroGrupo, setFiltroGrupo] = useState('todos')
  const ehAdmin = usuario?.perfil === 'administrador' || usuario?.perfil === 'gerente'
  const meuGrupo = PERFIL_GRUPO[usuario?.perfil] || null
  const usuariosDaEquipe = ehAdmin
    ? usuarios
    : usuarios.filter(u => (PERFIL_GRUPO[u.perfil] || null) === meuGrupo)
  const [toast, showToast]          = useToast()
  const [dragId, setDragId]           = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [sortCol, setSortCol]         = useState('data_prazo')
  const [sortDir, setSortDir]         = useState('asc')
  const [abaView, setAbaView]         = useState('ativas')
  const menuRef = useRef()

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  async function carregar() {
    setLoading(true)
    try {
      const [t, us] = await Promise.all([getTarefas(), getUsuarios()])
      setTarefas(t)
      setUsuarios(us || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenuNova(false)
      }
    }
    if (showMenuNova) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenuNova])

  async function handleSave(form, id, responsaveis = [], checklistLocal = []) {
    if (id) {
      let upd = await updateTarefa(id, form)
      await setResponsaveisTarefa(id, responsaveis)
      upd = await updateTarefa(id, {}) // recarrega com responsáveis atualizados
      setTarefas(prev => prev.map(t => t.id === upd.id ? upd : t))
      // Se concluída, muda para aba de concluídas automaticamente
      if (upd.status === 'concluido' && abaView === 'ativas') {
        showToast('Tarefa concluída! 🎉')
      } else if (upd.status !== 'concluido' && abaView === 'concluidas') {
        showToast('Tarefa reativada!')
      } else {
        showToast('Tarefa atualizada!')
      }
    } else {
      let nova = await createTarefa(form)
      if (responsaveis.length > 0) {
        await setResponsaveisTarefa(nova.id, responsaveis)
      }
      for (const item of checklistLocal) {
        await addChecklistItem(nova.id, item.texto)
      }
      if (responsaveis.length > 0 || checklistLocal.length > 0) {
        nova = await updateTarefa(nova.id, {})
      }
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
    if (novoStatus === 'concluido') await concluirTodasAsPartes(tarefa.id)
    const upd = await updateTarefa(tarefa.id, { status: novoStatus })
    setTarefas(prev => prev.map(t => t.id === upd.id ? upd : t))
    if (novoStatus === 'concluido' && upd.recorrencia_ativa) {
      try {
        const proxima = await gerarProximaOcorrencia(upd)
        if (proxima) {
          setTarefas(prev => [proxima, ...prev])
          showToast('Tarefa concluída! Próxima ocorrência criada 🔁')
        }
      } catch(e) { console.error(e); showToast('Concluída, mas falhou ao criar a próxima ocorrência', 'error') }
    }
  }

  async function handleDragDrop(novoStatus) {
    if (!dragId || !novoStatus) { setDragId(null); setDragOverCol(null); return }
    const tarefa = tarefas.find(t => t.id === dragId)
    if (!tarefa || tarefa.status === novoStatus) { setDragId(null); setDragOverCol(null); return }
    setDragId(null); setDragOverCol(null)
    setTarefas(prev => prev.map(t => t.id === dragId ? { ...t, status: novoStatus } : t))
    try {
      if (novoStatus === 'concluido') await concluirTodasAsPartes(dragId)
      const upd = await updateTarefa(dragId, { status: novoStatus })
      if (novoStatus === 'concluido' && upd.recorrencia_ativa) {
        const proxima = await gerarProximaOcorrencia(upd)
        if (proxima) {
          setTarefas(prev => [proxima, ...prev])
          showToast('Próxima ocorrência criada 🔁')
        }
      }
    } catch(e) {
      setTarefas(prev => prev.map(t => t.id === dragId ? { ...t, status: tarefa.status } : t))
      showToast('Erro ao mover tarefa', 'error')
    }
  }

  // Separa ativas (a_fazer + em_andamento) de concluídas
  const tarefasAtivas     = tarefas.filter(t => t.status !== 'concluido')
  const tarefasConcluidas = tarefas.filter(t => t.status === 'concluido')
  const listaBase = abaView === 'ativas' ? tarefasAtivas : tarefasConcluidas

  // Mapa userId -> grupo (o grupo da tarefa vem do responsável)
  const grupoPorUsuario = {}
  for (const u of usuarios) grupoPorUsuario[u.id] = u.grupo || null

  const tarefasFiltradas = listaBase.filter(t => {
    if (filtroStatus !== 'todos' && t.status !== filtroStatus) return false
    if (filtroPrioridade !== 'todas' && t.prioridade !== filtroPrioridade) return false
    const idsResp = (t.tarefa_responsaveis || []).map(r => r.usuario_id)
    if (t.responsavel_id && !idsResp.includes(t.responsavel_id)) idsResp.push(t.responsavel_id)
    if (filtroResponsavel !== 'todos') {
      if (filtroResponsavel === 'minha' && !idsResp.includes(usuario?.id)) return false
      if (filtroResponsavel !== 'minha' && !idsResp.includes(filtroResponsavel)) return false
    }
    if (filtroGrupo !== 'todos') {
      const gruposTarefa = idsResp.map(id => grupoPorUsuario[id]).filter(Boolean)
      if (gruposTarefa.length === 0 && grupoPorUsuario[t.created_by]) gruposTarefa.push(grupoPorUsuario[t.created_by])
      if (!gruposTarefa.includes(filtroGrupo)) return false
    }
    return true
  })

  // Ordenação da view Lista
  const PRIORIDADE_ORDER = { urgente: 0, alta: 1, media: 2, baixa: 3 }
  const STATUS_ORDER     = { a_fazer: 0, em_andamento: 1, concluido: 2 }
  const tarefasOrdenadas = [...tarefasFiltradas].sort((a, b) => {
    let va, vb
    if (sortCol === 'titulo') {
      va = (a.titulo || '').toLowerCase(); vb = (b.titulo || '').toLowerCase()
    } else if (sortCol === 'status') {
      va = STATUS_ORDER[a.status] ?? 99; vb = STATUS_ORDER[b.status] ?? 99
    } else if (sortCol === 'prioridade') {
      va = PRIORIDADE_ORDER[a.prioridade] ?? 99; vb = PRIORIDADE_ORDER[b.prioridade] ?? 99
    } else if (sortCol === 'responsavel') {
      va = (a.responsavel?.nome || '').toLowerCase(); vb = (b.responsavel?.nome || '').toLowerCase()
    } else if (sortCol === 'data_prazo') {
      va = a.data_prazo || '9999'; vb = b.data_prazo || '9999'
    } else {
      va = ''; vb = ''
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ?  1 : -1
    return 0
  })

  const porStatus = STATUS.reduce((acc, s) => {
    acc[s.value] = tarefasFiltradas.filter(t => t.status === s.value)
    return acc
  }, {})

  const totalAtrasadas = tarefasAtivas.filter(t => t.data_prazo && t.status !== 'concluido' && isPast(new Date(t.data_prazo + 'T12:00:00')) && !isToday(new Date(t.data_prazo + 'T12:00:00'))).length

  const algumaTemLivros = tarefasFiltradas.some(t => (t.tarefa_livros?.length || 0) > 0)

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
              {tarefasAtivas.length} pendentes
              {totalAtrasadas > 0 && <span style={{ color:'var(--red)', marginLeft:8 }}>· {totalAtrasadas} atrasada{totalAtrasadas!==1?'s':''}</span>}
            </p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ display:'flex', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
            <button onClick={()=>setView('kanban')} style={{ padding:'7px 12px', border:'none', cursor:'pointer', background: view==='kanban' ? 'var(--accent)' : 'transparent', color: view==='kanban' ? '#fff' : 'var(--text-muted)', transition:'all 0.15s', display:'flex', alignItems:'center', gap:5, fontSize:12 }}>
              <Columns size={13}/> Kanban
            </button>
            <button onClick={()=>setView('lista')} style={{ padding:'7px 12px', border:'none', cursor:'pointer', background: view==='lista' ? 'var(--accent)' : 'transparent', color: view==='lista' ? '#fff' : 'var(--text-muted)', transition:'all 0.15s', display:'flex', alignItems:'center', gap:5, fontSize:12 }}>
              <List size={13}/> Lista
            </button>
            <button onClick={()=>setView('calendario')} style={{ padding:'7px 12px', border:'none', cursor:'pointer', background: view==='calendario' ? 'var(--accent)' : 'transparent', color: view==='calendario' ? '#fff' : 'var(--text-muted)', transition:'all 0.15s', display:'flex', alignItems:'center', gap:5, fontSize:12 }}>
              <CalendarDays size={13}/> Calendário
            </button>
            <button onClick={()=>setView('equipe')} style={{ padding:'7px 12px', border:'none', cursor:'pointer', background: view==='equipe' ? 'var(--accent)' : 'transparent', color: view==='equipe' ? '#fff' : 'var(--text-muted)', transition:'all 0.15s', display:'flex', alignItems:'center', gap:5, fontSize:12 }}>
              <Users size={13}/> Equipe
            </button>
          </div>

          {/* Split button: Nova tarefa + dropdown */}
          <div ref={menuRef} style={{ position:'relative', display:'flex' }}>
            <button
              className="btn btn-primary"
              onClick={()=>setModal('new')}
              style={{ borderTopRightRadius:0, borderBottomRightRadius:0, borderRight:'1px solid rgba(255,255,255,0.2)' }}
            >
              <Plus size={14}/> Nova tarefa
            </button>
            <button
              className="btn btn-primary"
              onClick={()=>setShowMenuNova(s=>!s)}
              style={{ borderTopLeftRadius:0, borderBottomLeftRadius:0, padding:'0 8px' }}
              aria-label="Mais opções"
            >
              {showMenuNova ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>

            {showMenuNova && (
              <div style={{
                position:'absolute', top:'calc(100% + 4px)', right:0,
                background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8,
                boxShadow:'0 4px 16px rgba(0,0,0,0.2)', zIndex:20,
                minWidth:220, padding:6
              }}>
                <button
                  onClick={()=>{ setShowMenuNova(false); setModal('new') }}
                  style={menuItemStyle()}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                >
                  <Plus size={13}/> Criar manualmente
                </button>
                <button
                  onClick={()=>{ setShowMenuNova(false); setShowImportar(true) }}
                  style={menuItemStyle()}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                >
                  <FileSpreadsheet size={13}/> Importar planilha
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Abas Ativas / Concluídas */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:20 }}>
        {[
          { k:'ativas',     l:`Ativas (${tarefasAtivas.length})` },
          { k:'concluidas', l:`Concluídas (${tarefasConcluidas.length})` },
        ].map(({k,l}) => (
          <button key={k} onClick={()=>{ setAbaView(k); setFiltroStatus('todos'); setFiltroPrioridade('todas'); setFiltroResponsavel('todos') }}
            style={{
              padding:'9px 18px', fontSize:13, fontWeight: abaView===k ? 700 : 400,
              cursor:'pointer', background:'none', border:'none',
              borderBottom: abaView===k ? '2px solid var(--accent)' : '2px solid transparent',
              color: abaView===k ? 'var(--accent)' : 'var(--text-muted)',
            }}>
            {l}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }}
          value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          {(abaView === 'ativas'
            ? STATUS.filter(s => s.value !== 'concluido')
            : STATUS.filter(s => s.value === 'concluido')
          ).map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
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
          {usuariosDaEquipe.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        {ehAdmin && (
          <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }}
            value={filtroGrupo} onChange={e=>setFiltroGrupo(e.target.value)}>
            <option value="todos">Todos os grupos</option>
            <option value="influencers">Influencers</option>
            <option value="parceiras">Parceiras</option>
            <option value="proprias">Próprias</option>
            <option value="marketplaces">Marketplaces</option>
          </select>
        )}
        {(filtroStatus!=='todos'||filtroPrioridade!=='todas'||filtroResponsavel!=='todos'||filtroGrupo!=='todos') && (
          <button className="btn btn-ghost btn-sm" onClick={()=>{ setFiltroStatus('todos'); setFiltroPrioridade('todas'); setFiltroResponsavel('todos'); setFiltroGrupo('todos') }}>
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
            const isOver = dragOverCol === s.value
            const corCol = s.value==='concluido'?'var(--green)':s.value==='em_andamento'?'var(--amber)':'var(--indigo)'
            return (
              <div key={s.value}
                onDragOver={e=>{ e.preventDefault(); setDragOverCol(s.value) }}
                onDragLeave={e=>{ if(!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null) }}
                onDrop={e=>{ e.preventDefault(); handleDragDrop(s.value) }}
                style={{
                  background: isOver ? 'var(--surface-3)' : 'var(--surface-2)',
                  borderRadius:12, overflow:'hidden',
                  border: isOver ? `2px solid ${corCol}` : '1px solid var(--border)',
                  transition:'border 0.15s, background 0.15s',
                }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Icon size={14} color={corCol}/>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', background:'var(--surface-3)', borderRadius:20, padding:'2px 8px' }}>{lista.length}</span>
                </div>
                <div style={{ padding:'10px', display:'flex', flexDirection:'column', gap:8, minHeight:120 }}>
                  {lista.length === 0
                    ? <div style={{ fontSize:12, color: isOver ? corCol : 'var(--text-muted)', textAlign:'center', padding:'20px 0', opacity: isOver ? 1 : 0.5, fontWeight: isOver ? 600 : 400, transition:'all 0.15s' }}>
                        {isOver ? '↓ Soltar aqui' : 'Nenhuma tarefa'}
                      </div>
                    : lista.map(t => (
                        <CardKanban key={t.id} tarefa={t}
                          onClick={()=>setModal(t)}
                          onDragStart={()=>setDragId(t.id)}
                          onDragEnd={()=>{ setDragId(null); setDragOverCol(null) }}
                          isDragging={dragId===t.id}/>
                      ))
                  }
                  {isOver && lista.length > 0 && (
                    <div style={{ height:4, borderRadius:99, background:corCol, opacity:0.4, margin:'4px 0' }}/>
                  )}
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
            ? <div className="empty-state"><p>Nenhuma tarefa {abaView === 'concluidas' ? 'concluída ' : ''}encontrada.</p></div>
            : <table>
                <thead>
                  <tr>
                    {[
                      { col:'titulo',      label:'Tarefa' },
                      { col:'status',      label:'Status' },
                      { col:'prioridade',  label:'Prioridade' },
                      { col:'responsavel', label:'Responsável' },
                      { col:'data_prazo',  label:'Prazo' },
                    ].map(({col, label}) => (
                      <th key={col} onClick={()=>toggleSort(col)}
                        style={{
                          cursor:'pointer', userSelect:'none', whiteSpace:'nowrap',
                          color: sortCol === col ? 'var(--accent)' : 'var(--text-muted)',
                          fontWeight: sortCol === col ? 700 : 600,
                          transition:'color 0.15s',
                        }}
                        onMouseEnter={e=>e.currentTarget.style.color='var(--accent)'}
                        onMouseLeave={e=>e.currentTarget.style.color=sortCol===col?'var(--accent)':'var(--text-muted)'}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                          {label}
                          {sortCol === col
                            ? sortDir === 'asc'
                              ? <ChevronUp size={12}/>
                              : <ChevronDown size={12}/>
                            : <ChevronUp size={12} style={{ opacity:0.2 }}/>
                          }
                        </span>
                      </th>
                    ))}
                    {algumaTemLivros && <th>Livros</th>}
                    <th>Progresso</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tarefasOrdenadas.map(t => {
                    const checkTotal = t.tarefa_checklist?.length || 0
                    const checkDone  = t.tarefa_checklist?.filter(x=>x.concluido).length || 0
                    const livrosCount = t.tarefa_livros?.length || 0
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
                        {algumaTemLivros && (
                          <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                            {livrosCount > 0 ? (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                                <Book size={11}/> {livrosCount}
                              </span>
                            ) : '—'}
                          </td>
                        )}
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

      {/* CALENDÁRIO */}
      {view === 'calendario' && (
        <ViewCalendario
          tarefas={tarefasFiltradas}
          onClickTarefa={t=>setModal(t)}
          onNovaTarefa={(data)=>setModal({ _dataPrazo: data })}
        />
      )}

      {/* EQUIPE */}
      {view === 'equipe' && (
        <ViewEquipe
          tarefas={tarefas}
          usuarios={usuarios}
          usuario={usuario}
          onOpen={t => setModal(t)}
        />
      )}

      {/* Modal de tarefa */}
      {modal && (
        <ModalTarefa
          tarefa={modal === 'new' ? null : modal}
          usuarios={usuarios}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={()=>{ setModal(null); carregar() }}
        />
      )}

      {/* Modal de importação */}
      {showImportar && (
        <ModalImportar
          usuarios={usuarios}
          onClose={()=>setShowImportar(false)}
          onImported={()=>{ carregar(); showToast('Tarefas importadas!') }}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

// ── VIEW CALENDÁRIO ───────────────────────────────────────────
function ViewCalendario({ tarefas, onClickTarefa, onNovaTarefa }) {
  const hoje = new Date()
  const [mesRef, setMesRef] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))

  const ano = mesRef.getFullYear()
  const mes = mesRef.getMonth()
  const nomeMes = format(mesRef, 'MMMM yyyy', { locale: ptBR })
  const primeiroDia = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()

  const tarefasPorDia = {}
  tarefas.forEach(t => {
    if (!t.data_prazo) return
    const key = t.data_prazo.slice(0, 10)
    if (!tarefasPorDia[key]) tarefasPorDia[key] = []
    tarefasPorDia[key].push(t)
  })

  const semData = tarefas.filter(t => !t.data_prazo)

  function corStatus(status) {
    if (status === 'concluido') return { bg:'rgba(34,197,94,0.15)', cor:'#22c55e', border:'rgba(34,197,94,0.3)' }
    if (status === 'em_andamento') return { bg:'rgba(234,179,8,0.15)', cor:'#eab308', border:'rgba(234,179,8,0.3)' }
    return { bg:'rgba(99,102,241,0.15)', cor:'#818cf8', border:'rgba(99,102,241,0.3)' }
  }

  const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <button onClick={()=>setMesRef(new Date(ano, mes-1, 1))}
          style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', cursor:'pointer', display:'flex', alignItems:'center', color:'var(--text-soft)' }}>
          <ChevronLeft size={16}/>
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:17, color:'var(--text)', margin:0, textTransform:'capitalize' }}>
            {nomeMes}
          </h2>
          <button onClick={()=>setMesRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}
            style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:'var(--surface-2)', border:'1px solid var(--border)', cursor:'pointer', color:'var(--text-muted)', fontWeight:700 }}>
            Hoje
          </button>
        </div>
        <button onClick={()=>setMesRef(new Date(ano, mes+1, 1))}
          style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', cursor:'pointer', display:'flex', alignItems:'center', color:'var(--text-soft)' }}>
          <ChevronRight size={16}/>
        </button>
      </div>

      <div style={{ border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'var(--surface-2)', borderBottom:'1px solid var(--border)' }}>
          {diasSemana.map(d=>(
            <div key={d} style={{ padding:'10px 0', textAlign:'center', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{d}</div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
          {Array.from({length: primeiroDia}).map((_,i)=>(
            <div key={`v${i}`} style={{ minHeight:110, background:'var(--surface)', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', opacity:0.4 }}/>
          ))}

          {Array.from({length: diasNoMes}).map((_,i)=>{
            const dia = i + 1
            const dataKey = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
            const tarefasDia = tarefasPorDia[dataKey] || []
            const isHoje = hoje.getDate()===dia && hoje.getMonth()===mes && hoje.getFullYear()===ano
            const col = (primeiroDia + i) % 7
            const isFimSemana = col === 0 || col === 6

            return (
              <div key={dia}
                onClick={()=>onNovaTarefa(dataKey)}
                style={{
                  minHeight:110, padding:'6px', cursor:'pointer',
                  background: isFimSemana ? 'var(--surface-2)' : 'var(--surface)',
                  borderRight:'1px solid var(--border)',
                  borderBottom:'1px solid var(--border)',
                  transition:'background 0.1s',
                }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--surface-3)'}
                onMouseLeave={e=>e.currentTarget.style.background=isFimSemana?'var(--surface-2)':'var(--surface)'}>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{
                    width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center',
                    borderRadius:'50%', fontSize:12, fontWeight: isHoje ? 700 : 400,
                    background: isHoje ? 'var(--accent)' : 'transparent',
                    color: isHoje ? '#fff' : isFimSemana ? 'var(--text-muted)' : 'var(--text-soft)',
                  }}>{dia}</span>
                  {tarefasDia.length > 0 && (
                    <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700 }}>{tarefasDia.length}</span>
                  )}
                </div>

                {tarefasDia.slice(0,3).map(t=>{
                  const c = corStatus(t.status)
                  const atrasada = t.status !== 'concluido' && isPast(new Date(dataKey+'T12:00:00')) && !isHoje
                  return (
                    <div key={t.id}
                      onClick={e=>{e.stopPropagation();onClickTarefa(t)}}
                      style={{
                        padding:'2px 6px', borderRadius:4, marginBottom:2, cursor:'pointer',
                        background: atrasada ? 'rgba(239,68,68,0.12)' : c.bg,
                        border:`1px solid ${atrasada ? 'rgba(239,68,68,0.3)' : c.border}`,
                        fontSize:10, fontWeight:600,
                        color: atrasada ? '#f87171' : c.cor,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                        lineHeight:1.4,
                      }}>
                      {t.titulo}
                    </div>
                  )
                })}
                {tarefasDia.length > 3 && (
                  <div style={{ fontSize:9, color:'var(--text-muted)', fontWeight:700, paddingLeft:2 }}>
                    +{tarefasDia.length - 3} mais
                  </div>
                )}
              </div>
            )
          })}

          {Array.from({length: (7 - (primeiroDia + diasNoMes) % 7) % 7}).map((_,i)=>(
            <div key={`f${i}`} style={{ minHeight:110, background:'var(--surface)', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', opacity:0.4 }}/>
          ))}
        </div>
      </div>

      {semData.length > 0 && (
        <div style={{ marginTop:20 }}>
          <h3 style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
            Sem data definida ({semData.length})
          </h3>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {semData.map(t=>{
              const c = corStatus(t.status)
              return (
                <div key={t.id} onClick={()=>onClickTarefa(t)}
                  style={{ padding:'5px 12px', borderRadius:20, cursor:'pointer', background:c.bg, border:`1px solid ${c.border}`, fontSize:12, fontWeight:600, color:c.cor, transition:'opacity 0.1s' }}
                  onMouseEnter={e=>e.currentTarget.style.opacity='0.7'}
                  onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                  {t.titulo}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── VIEW EQUIPE ─────────────────────────────────────────────
function ViewEquipe({ tarefas, usuarios, usuario, onOpen }) {
  const hoje = new Date()
  hoje.setHours(0,0,0,0)

  const isAdmin = usuario?.perfil === 'administrador'

  const usuariosVisiveis = isAdmin
    ? usuarios
    : usuarios.filter(u =>
        u.id === usuario?.id ||
        (u.grupo && u.grupo === usuario?.grupo)
      )

  function iniciais(nome) {
    if (!nome) return '?'
    return nome.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()
  }

  const CORES = ['#6366f1','#8b5cf6','#ec4899','#f97316','#14b8a6','#0ea5e9','#84cc16']
  function corAvatar(nome) {
    if (!nome) return CORES[0]
    const i = nome.split('').reduce((a,c) => a + c.charCodeAt(0), 0) % CORES.length
    return CORES[i]
  }

  return (
    <div style={{ overflowX:'auto', paddingBottom:16 }}>
      <div style={{ display:'flex', gap:16, minWidth:'max-content', alignItems:'flex-start' }}>
        {usuariosVisiveis.map(u => {
          const minhas    = tarefas.filter(t => t.responsavel_id === u.id || t.created_by === u.id)
          const ativas    = minhas.filter(t => t.status !== 'concluido')
          const concluidas = minhas.filter(t => t.status === 'concluido')
          const atrasadas = ativas.filter(t => {
            if (!t.data_prazo) return false
            return new Date(t.data_prazo + 'T12:00:00') < hoje
          })
          const pct = minhas.length > 0 ? Math.round((concluidas.length / minhas.length) * 100) : 0

          const porStatus = [
            { value:'a_fazer',      label:'A FAZER',      cor:'#6366f1' },
            { value:'em_andamento', label:'EM ANDAMENTO', cor:'#f59e0b' },
          ].map(s => ({ ...s, tarefas: ativas.filter(t => t.status === s.value) }))
           .filter(s => s.tarefas.length > 0)

          const R = 22, CIRC = 2 * Math.PI * R
          const dash = (pct / 100) * CIRC
          const corPct = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#6366f1'

          return (
            <div key={u.id} style={{
              width:280, background:'var(--surface)',
              border:'1px solid var(--border)', borderRadius:12,
              overflow:'hidden', flexShrink:0,
            }}>
              {/* Header */}
              <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{
                      width:38, height:38, borderRadius:'50%',
                      background:corAvatar(u.nome),
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:13, fontWeight:700, color:'#fff', flexShrink:0,
                    }}>
                      {iniciais(u.nome)}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{u.nome}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'capitalize' }}>{u.grupo || u.perfil}</div>
                    </div>
                  </div>
                  {/* Gráfico circular */}
                  <div style={{ position:'relative', width:54, height:54, flexShrink:0 }}>
                    <svg width="54" height="54" style={{ transform:'rotate(-90deg)' }}>
                      <circle cx="27" cy="27" r={R} fill="none" stroke="var(--border)" strokeWidth="4"/>
                      <circle cx="27" cy="27" r={R} fill="none" stroke={corPct} strokeWidth="4"
                        strokeDasharray={`${dash} ${CIRC}`} strokeLinecap="round"
                        style={{ transition:'stroke-dasharray 0.5s ease' }}/>
                    </svg>
                    <div style={{
                      position:'absolute', inset:0,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11, fontWeight:700, color:'var(--text)',
                    }}>{pct}%</div>
                  </div>
                </div>

                {/* Contadores */}
                <div style={{ display:'flex', gap:6 }}>
                  <div style={{ flex:1, textAlign:'center', background:'var(--surface-2)', borderRadius:8, padding:'6px 4px' }}>
                    <div style={{ fontSize:18, fontWeight:700, color:'var(--text)' }}>{ativas.length}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)' }}>Ativas</div>
                  </div>
                  <div style={{ flex:1, textAlign:'center', background:'var(--surface-2)', borderRadius:8, padding:'6px 4px' }}>
                    <div style={{ fontSize:18, fontWeight:700, color:'#22c55e' }}>{concluidas.length}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)' }}>Feitas</div>
                  </div>
                  {atrasadas.length > 0 && (
                    <div style={{ flex:1, textAlign:'center', background:'rgba(239,68,68,0.1)', borderRadius:8, padding:'6px 4px', border:'1px solid rgba(239,68,68,0.2)' }}>
                      <div style={{ fontSize:18, fontWeight:700, color:'#ef4444' }}>{atrasadas.length}</div>
                      <div style={{ fontSize:10, color:'#ef4444' }}>Atrasadas</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tarefas por status */}
              <div style={{ padding:'10px 12px', maxHeight:400, overflowY:'auto' }}>
                {ativas.length === 0
                  ? <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:'24px 0', opacity:0.5 }}>
                      Nenhuma tarefa ativa
                    </div>
                  : porStatus.map(s => (
                      <div key={s.value} style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                          <div style={{ width:8, height:8, borderRadius:2, background:s.cor }}/>
                          <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em' }}>
                            {s.label} ({s.tarefas.length})
                          </span>
                        </div>
                        {s.tarefas.map(t => {
                          const atr = t.data_prazo && new Date(t.data_prazo + 'T12:00:00') < hoje
                          return (
                            <div key={t.id} onClick={() => onOpen(t)}
                              style={{
                                padding:'7px 10px', marginBottom:4, cursor:'pointer',
                                background: atr ? 'rgba(239,68,68,0.06)' : 'var(--surface-2)',
                                border: atr ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent',
                                borderRadius:8, transition:'all 0.15s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.borderColor = atr ? '#ef4444' : 'var(--accent)'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = atr ? 'rgba(239,68,68,0.2)' : 'transparent'}
                            >
                              <div style={{ fontSize:12, color:'var(--text)', fontWeight:500, marginBottom:3,
                                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1.4 }}>
                                {t.titulo}
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                {t.prioridade && <PrioridadeBadge value={t.prioridade}/>}
                                {t.data_prazo && (
                                  <span style={{ fontSize:10, display:'flex', alignItems:'center', gap:3,
                                    color: atr ? '#ef4444' : 'var(--text-muted)', fontWeight: atr ? 700 : 400 }}>
                                    <Calendar size={10}/>
                                    {atr
                                      ? `Atrasada ${Math.abs(differenceInDays(new Date(t.data_prazo + 'T12:00:00'), hoje))}d`
                                      : format(new Date(t.data_prazo + 'T12:00:00'), 'dd/MM', { locale: ptBR })
                                    }
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
