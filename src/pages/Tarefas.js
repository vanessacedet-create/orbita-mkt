import { useEffect, useState, useRef } from 'react'
import {
  getTarefas, createTarefa, updateTarefa, deleteTarefa,
  addChecklistItem, updateChecklistItem, deleteChecklistItem,
  addComentario, getUsuarios,
  addLivroTarefa, removeLivroTarefa, getLivros,
  importarTarefasLote, buscarLivroPorISBN,
  gerarProximaOcorrencia, calcularProximoPrazo as calcularProximoPrazoFn,
  getParceirosAtivos,
} from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PERFIL_GRUPO } from '../context/AuthContext'
import { useViewAs } from '../context/ViewAsContext'
import {
  Plus, X, Pencil, Trash2, CheckSquare, Square, MessageSquare,
  Calendar, Flag, User, ChevronDown, List, Columns, Clock,
  AlertCircle, ArrowUp, Minus, CheckCircle2, Circle, LayoutList,
  CalendarDays, ChevronLeft, ChevronRight, Book, Search,
  Upload, Download, FileSpreadsheet, ChevronUp, Users, Layers
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

const TIPOS_TAREFA = [
  'Campanha de promoção',
  'Newsletter',
  'Conteúdo para redes sociais',
  'Reels / Vídeo',
  'Stories',
  'Carrossel',
  'E-mail marketing',
  'Lançamento de livro',
  'Envio de exemplares',
  'Briefing',
  'Relatório',
  'Reunião / Alinhamento',
  'Outro',
]

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }
  return [toast, show]
}

// Persiste estado de UI no sessionStorage para sobreviver à navegação
function usePersistedState(key, defaultValue) {
  const storageKey = `orbita_tarefas_${key}`
  const [state, setState] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      return saved !== null ? JSON.parse(saved) : defaultValue
    } catch { return defaultValue }
  })
  function setPersistedState(value) {
    setState(prev => {
      const next = typeof value === 'function' ? value(prev) : value
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return next
    })
  }
  return [state, setPersistedState]
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

// ── SELETOR DE LIVROS DA CAMPANHA (funciona antes de salvar) ──────────────
const TIPOS_COM_LIVRO_CAMPANHA = ['E-mail marketing', 'Newsletter']

function SeletorLivrosCampanha({ livros, onChange }) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const buscaTimeout = useRef(null)

  const idsVinculados = livros.map(l => l.id)

  useEffect(() => {
    if (buscaTimeout.current) clearTimeout(buscaTimeout.current)
    if (!busca.trim() || busca.trim().length < 2) { setResultados([]); return }
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

  function adicionar(livro) {
    if (idsVinculados.includes(livro.id)) return
    onChange([...livros, { id: livro.id, titulo: livro.titulo, autor: livro.autor, isbn: livro.isbn }])
    setBusca(''); setResultados([]); setShowResults(false)
  }

  function remover(id) { onChange(livros.filter(l => l.id !== id)) }

  const filtrados = resultados.filter(r => !idsVinculados.includes(r.id))

  return (
    <div style={{ marginTop: 2 }}>
      {livros.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
          {livros.map(l => (
            <div key={l.id} style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'4px 10px', borderRadius:99,
              background:'rgba(236,72,153,0.1)', border:'1px solid rgba(236,72,153,0.3)',
              fontSize:11, color:'#ec4899', fontWeight:600
            }}>
              <Book size={11}/>
              <span style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {l.titulo}
              </span>
              <button onClick={() => remover(l.id)} style={{
                background:'none', border:'none', cursor:'pointer', padding:0,
                display:'flex', alignItems:'center', color:'#ec4899', opacity:0.7
              }}><X size={11}/></button>
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
            onChange={e => { setBusca(e.target.value); setShowResults(true) }}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder="Buscar livro por título, autor ou ISBN..."
            style={{ paddingLeft:32, fontSize:12 }}
          />
        </div>
        {showResults && busca.trim().length >= 2 && (
          <div style={{
            position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
            background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8,
            boxShadow:'0 4px 16px rgba(0,0,0,0.15)', zIndex:20, maxHeight:240, overflowY:'auto'
          }}>
            {buscando && <div style={{ padding:'12px 14px', fontSize:12, color:'var(--text-muted)' }}>Buscando...</div>}
            {!buscando && filtrados.length === 0 && (
              <div style={{ padding:'12px 14px', fontSize:12, color:'var(--text-muted)' }}>
                {resultados.length > 0 ? 'Todos os livros encontrados já foram adicionados.' : 'Nenhum livro encontrado.'}
              </div>
            )}
            {!buscando && filtrados.map(livro => (
              <button key={livro.id} onClick={() => adicionar(livro)} style={{
                width:'100%', padding:'8px 12px', textAlign:'left',
                background:'transparent', border:'none', cursor:'pointer',
                display:'flex', flexDirection:'column', gap:2,
                borderBottom:'1px solid var(--border)'
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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

// ── SELETOR DE PARCEIRO ────────────────────────────────────
function SeletorParceiro({ value, onChange }) {
  const [parceiros, setParceiros] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const ref = useRef()

  useEffect(() => {
    getParceirosAtivos()
      .then(data => setParceiros(data || []))
      .catch(console.error)
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false)
    }
    if (aberto) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [aberto])

  const parceiroSelecionado = parceiros.find(p => p.id === value)

  const filtrados = busca.trim().length === 0
    ? parceiros
    : parceiros.filter(p =>
        (p.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
        (p.tipo_parceria || '').toLowerCase().includes(busca.toLowerCase()) ||
        (p.livraria || '').toLowerCase().includes(busca.toLowerCase())
      )

  function tipoBadgeStyle(tipo) {
    if (!tipo) return null
    const t = tipo.toLowerCase()
    if (t.includes('livraria')) return { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', border: 'rgba(99,102,241,0.25)' }
    if (t.includes('booktime')) return { bg: 'rgba(236,72,153,0.12)', color: '#ec4899', border: 'rgba(236,72,153,0.25)' }
    return { bg: 'var(--surface-3)', color: 'var(--text-muted)', border: 'var(--border)' }
  }

  if (carregando) return <div style={{ fontSize:12, color:'var(--text-muted)', padding:'8px 0' }}>Carregando parceiros...</div>

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)',
          background:'var(--surface)', cursor:'pointer', textAlign:'left',
          transition:'border 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
        onMouseLeave={e => { if (!aberto) e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        {parceiroSelecionado ? (
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {parceiroSelecionado.nome}
            </span>
            {parceiroSelecionado.tipo_parceria && (() => {
              const s = tipoBadgeStyle(parceiroSelecionado.tipo_parceria)
              return (
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:99, background:s.bg, color:s.color, border:`1px solid ${s.border}`, whiteSpace:'nowrap', flexShrink:0 }}>
                  {parceiroSelecionado.tipo_parceria}
                </span>
              )
            })()}
            {parceiroSelecionado.livraria && (
              <span style={{ fontSize:10, color:'var(--text-muted)', whiteSpace:'nowrap', flexShrink:0 }}>
                📚 {parceiroSelecionado.livraria}
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>Selecionar parceiro...</span>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, marginLeft:8 }}>
          {value && (
            <span
              onClick={e => { e.stopPropagation(); onChange(null); setBusca('') }}
              style={{ display:'flex', alignItems:'center', cursor:'pointer', color:'var(--text-muted)', opacity:0.6 }}
            ><X size={12}/></span>
          )}
          <ChevronDown size={14} style={{ color:'var(--text-muted)', transform: aberto ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}/>
        </div>
      </button>

      {aberto && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:30,
          background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10,
          boxShadow:'0 8px 24px rgba(0,0,0,0.18)', maxHeight:300, display:'flex', flexDirection:'column',
        }}>
          <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ position:'relative' }}>
              <Search size={13} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
              <input
                autoFocus
                className="form-input"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar parceiro..."
                style={{ paddingLeft:28, fontSize:12, padding:'6px 10px 6px 28px' }}
              />
            </div>
          </div>
          <div style={{ overflowY:'auto', maxHeight:230 }}>
            {filtrados.length === 0 ? (
              <div style={{ padding:'14px', fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>Nenhum parceiro encontrado.</div>
            ) : filtrados.map(p => {
              const s = tipoBadgeStyle(p.tipo_parceria)
              const selecionado = p.id === value
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onChange(p); setAberto(false); setBusca('') }}
                  style={{
                    width:'100%', padding:'9px 14px', textAlign:'left', border:'none', cursor:'pointer',
                    background: selecionado ? 'var(--accent-glow)' : 'transparent',
                    borderBottom:'1px solid var(--border)',
                    display:'flex', flexDirection:'column', gap:3, transition:'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!selecionado) e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { if (!selecionado) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:13, fontWeight:600, color: selecionado ? 'var(--accent)' : 'var(--text)' }}>{p.nome}</span>
                    {p.tipo_parceria && s && (
                      <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:99, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
                        {p.tipo_parceria}
                      </span>
                    )}
                  </div>
                  {p.livraria && (
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>📚 {p.livraria}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── MODAL TAREFA ───────────────────────────────────────────

// ── PAINEL DE RECORRÊNCIA ───────────────────────────────────────────────────
const TIPOS_RECORRENCIA = [
  { value: 'diaria',        label: 'Diária' },
  { value: 'semanal',       label: 'Semanal' },
  { value: 'quinzenal',     label: 'Quinzenal' },
  { value: 'mensal',        label: 'Mensal' },
  { value: 'anual',         label: 'Anual' },
  { value: 'personalizada', label: 'Personalizada' },
]

const DIAS_SEMANA_RECORRENCIA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

function RecorrenciaPanel({ form, setForm }) {
  const [testando, setTestando] = useState(false)
  const [previewData, setPreviewData] = useState(null)

  function toggle() {
    setForm(f => ({ ...f,
      recorrencia_ativa: !f.recorrencia_ativa,
      recorrencia_tipo: !f.recorrencia_ativa ? 'mensal' : '',
      recorrencia_config: {},
    }))
    setPreviewData(null)
  }

  function setTipo(tipo) {
    setForm(f => ({ ...f, recorrencia_tipo: tipo, recorrencia_config: {} }))
    setPreviewData(null)
  }

  function setConfig(updates) {
    setForm(f => ({ ...f, recorrencia_config: { ...(f.recorrencia_config||{}), ...updates } }))
    setPreviewData(null)
  }

  async function testarPersonalizada() {
    setTestando(true)
    setPreviewData(null)
    try {
      const ref = form.data_prazo || new Date().toISOString().slice(0,10)
      const prox = await calcularProximoPrazoFn(ref, 'personalizada', form.recorrencia_config || {})
      setPreviewData(prox)
    } catch(e) { setPreviewData('erro') }
    finally { setTestando(false) }
  }

  const { recorrencia_ativa: ativa, recorrencia_tipo: tipo, recorrencia_config: cfg = {} } = form

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: ativa ? 12 : 0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button type="button" onClick={toggle} style={{
            width:36, height:20, borderRadius:10, border:'none', cursor:'pointer', padding:0,
            background: ativa ? 'var(--accent)' : 'var(--surface-3)', transition:'background 0.2s', position:'relative', flexShrink:0
          }}>
            <span style={{
              position:'absolute', top:2, left: ativa ? 18 : 2,
              width:16, height:16, borderRadius:'50%', background:'#fff',
              transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)'
            }}/>
          </button>
          <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Recorrência</span>
        </div>
        {ativa && tipo && (
          <span style={{ fontSize:11, color:'var(--accent)', fontWeight:600, background:'var(--accent-glow)', padding:'2px 8px', borderRadius:99 }}>
            {TIPOS_RECORRENCIA.find(t=>t.value===tipo)?.label}
          </span>
        )}
      </div>

      {ativa && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* tipo */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {TIPOS_RECORRENCIA.map(t => (
              <button key={t.value} type="button" onClick={()=>setTipo(t.value)} style={{
                padding:'4px 12px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer', border:'none',
                background: tipo===t.value ? 'var(--accent)' : 'var(--surface-3)',
                color: tipo===t.value ? '#fff' : 'var(--text-muted)',
                transition:'all 0.15s'
              }}>{t.label}</button>
            ))}
          </div>

          {/* config por tipo */}
          {tipo === 'semanal' && (
            <div>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Dia da semana</label>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {DIAS_SEMANA_RECORRENCIA.map((d,i) => (
                  <button key={i} type="button" onClick={()=>setConfig({ dia_semana: i })} style={{
                    padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:'none',
                    background: cfg.dia_semana===i ? 'var(--accent)' : 'var(--surface-3)',
                    color: cfg.dia_semana===i ? '#fff' : 'var(--text-muted)',
                  }}>{d.slice(0,3)}</button>
                ))}
              </div>
            </div>
          )}

          {tipo === 'quinzenal' && (
            <div>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Dia da semana de referência</label>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {DIAS_SEMANA_RECORRENCIA.map((d,i) => (
                  <button key={i} type="button" onClick={()=>setConfig({ dia_semana: i })} style={{
                    padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:'none',
                    background: cfg.dia_semana===i ? 'var(--accent)' : 'var(--surface-3)',
                    color: cfg.dia_semana===i ? '#fff' : 'var(--text-muted)',
                  }}>{d.slice(0,3)}</button>
                ))}
              </div>
            </div>
          )}

          {tipo === 'mensal' && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" onClick={()=>setConfig({ ultimo_dia_util: false })} style={{
                  flex:1, padding:'6px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer',
                  border: '1px solid', transition:'all 0.15s',
                  borderColor: !cfg.ultimo_dia_util ? 'var(--accent)' : 'var(--border)',
                  background: !cfg.ultimo_dia_util ? 'var(--accent-glow)' : 'transparent',
                  color: !cfg.ultimo_dia_util ? 'var(--accent)' : 'var(--text-muted)',
                }}>Dia fixo do mês</button>
                <button type="button" onClick={()=>setConfig({ ultimo_dia_util: true })} style={{
                  flex:1, padding:'6px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer',
                  border: '1px solid', transition:'all 0.15s',
                  borderColor: cfg.ultimo_dia_util ? 'var(--accent)' : 'var(--border)',
                  background: cfg.ultimo_dia_util ? 'var(--accent-glow)' : 'transparent',
                  color: cfg.ultimo_dia_util ? 'var(--accent)' : 'var(--text-muted)',
                }}>Último dia útil</button>
              </div>
              {!cfg.ultimo_dia_util && (
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Dia do mês</label>
                  <input type="number" min={1} max={28} className="form-input"
                    value={cfg.dia_mes || ''} onChange={e=>setConfig({ dia_mes: parseInt(e.target.value)||1 })}
                    placeholder="Ex: 15" style={{ width:90 }}/>
                </div>
              )}
            </div>
          )}

          {tipo === 'personalizada' && (
            <div>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>
                Descreva a regra em linguagem natural
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <input className="form-input" style={{ flex:1 }}
                  value={cfg.descricao || ''}
                  onChange={e=>setConfig({ descricao: e.target.value })}
                  placeholder="Ex: toda última quarta-feira do mês, todo dia 20, todo primeiro dia útil..."/>
                <button type="button" className="btn btn-primary btn-sm" onClick={testarPersonalizada}
                  disabled={testando || !cfg.descricao?.trim()} style={{ whiteSpace:'nowrap' }}>
                  {testando ? '…' : 'Testar'}
                </button>
              </div>
              {previewData && previewData !== 'erro' && (
                <div style={{ marginTop:6, fontSize:12, color:'var(--green)', fontWeight:600 }}>
                  ✓ Próxima ocorrência calculada: {previewData}
                </div>
              )}
              {previewData === 'erro' && (
                <div style={{ marginTop:6, fontSize:12, color:'var(--red)' }}>
                  Não foi possível calcular. Tente reformular a regra.
                </div>
              )}
              <div style={{ marginTop:6, fontSize:11, color:'var(--text-muted)', lineHeight:1.5 }}>
                Exemplos: "toda última quarta-feira do mês", "todo último dia útil do mês",
                "todo dia 20", "todo primeiro dia útil após o dia 15"
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ModalTarefa({ tarefa, usuarios, onSave, onClose, onDelete }) {
  const { usuario } = useAuth()
  const storageKey = `orbita_modal_form_${tarefa?.id || 'new'}`
  const EMPTY = { titulo:'', descricao:'', status:'a_fazer', prioridade:'media', responsavel_id:'', responsavel_id_2:'', data_prazo: tarefa?._dataPrazo || '',
    tempo_estimado_min: '',
    recorrencia_ativa: false, recorrencia_tipo: '', recorrencia_config: {},
    parceiro_id: '', tipo_tarefa: '' }
  const formInicial = tarefa && !tarefa._dataPrazo ? {
    titulo:               tarefa.titulo,
    descricao:            tarefa.descricao || '',
    status:               tarefa.status,
    prioridade:           tarefa.prioridade,
    responsavel_id:       tarefa.responsavel_id || '',
    responsavel_id_2:     '', // sempre vazio ao editar — segundo responsável só na criação
    tempo_estimado_min:   tarefa.tempo_estimado_min ?? '',
    data_prazo:           tarefa.data_prazo || '',
    recorrencia_ativa:    tarefa.recorrencia_ativa || false,
    recorrencia_tipo:     tarefa.recorrencia_tipo || '',
    recorrencia_config:   tarefa.recorrencia_config || {},
    parceiro_id:          tarefa.parceiro_id || '',
    tipo_tarefa:          tarefa.tipo_tarefa || '',
  } : EMPTY

  // ── estado persistido ──────────────────────────────────────────────────────
  const [form, setFormRaw] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(storageKey)
      if (salvo) return JSON.parse(salvo)
    } catch {}
    return formInicial
  })

  function setForm(updater) {
    setFormRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return next
    })
  }

  // checklist local (inclui itens ainda não salvos no banco para tarefas novas)
  const checklistKey = storageKey + '_checklist'
  const tabKey       = storageKey + '_tab'

  const [checklist, setChecklistRaw] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(checklistKey)
      if (salvo) return JSON.parse(salvo)
    } catch {}
    return tarefa?.tarefa_checklist || []
  })

  function setChecklist(updater) {
    setChecklistRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try { sessionStorage.setItem(checklistKey, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const [tab, setTabRaw] = useState(() => {
    try { return sessionStorage.getItem(tabKey) || 'detalhes' } catch { return 'detalhes' }
  })
  function setTab(v) { setTabRaw(v); try { sessionStorage.setItem(tabKey, v) } catch {} }

  function limparRascunho() {
    try {
      sessionStorage.removeItem(storageKey)
      sessionStorage.removeItem(checklistKey)
      sessionStorage.removeItem(tabKey)
    } catch {}
  }
  // ── fim estado persistido ───────────────────────────────────────────────────

  const [comentarios, setComentarios] = useState(tarefa?.tarefa_comentarios || [])
  const [livrosVinculados, setLivrosVinculados] = useState(tarefa?.tarefa_livros || [])
  const [livrosCampanha, setLivrosCampanha] = useState(() => {
    // ao editar, recarrega os livros da campanha que já estavam salvos
    return (tarefa?.tarefa_livros || [])
      .filter(tl => tl._campanha)
      .map(tl => ({ id: tl.livros?.id, titulo: tl.livros?.titulo, autor: tl.livros?.autor, isbn: tl.livros?.isbn }))
      .filter(l => l.id)
  })
  const [novoItem, setNovoItem]       = useState('')
  const [novoComent, setNovoComent]   = useState('')
  const [saving, setSaving]           = useState(false)
  const [editandoItem, setEditandoItem] = useState(null) // { id, texto }
  const checkInputRef = useRef()

  async function salvar() {
    if (!form.titulo.trim()) return
    setSaving(true)
    try {
      const itensPendentes = checklist.filter(x => x._local)
      await onSave({
        ...form,
        responsavel_id: form.responsavel_id || null,
        data_prazo:     form.data_prazo || null,
        tempo_estimado_min: form.tempo_estimado_min ? Number(form.tempo_estimado_min) : null,
        created_by:     tarefa ? undefined : usuario?.id,
        _checklistPendente: itensPendentes.map(x => x.texto),
        _livrosCampanhaPendentes: TIPOS_COM_LIVRO_CAMPANHA.includes(form.tipo_tarefa) ? livrosCampanha.map(l => l.id) : [],
        _segundoResponsavel: !tarefa && form.responsavel_id_2 ? form.responsavel_id_2 : null,
      }, tarefa?.id)
      limparRascunho()
      onClose()
    } catch(e) { console.error(e) } finally { setSaving(false) }
  }

  function addItemLocal() {
    if (!novoItem.trim()) return
    const item = { id: `_local_${Date.now()}`, texto: novoItem.trim(), concluido: false, ordem: checklist.length, _local: true }
    setChecklist(prev => [...prev, item])
    setNovoItem('')
    checkInputRef.current?.focus()
  }

  async function addItem() {
    if (!novoItem.trim()) return
    if (!tarefa) { addItemLocal(); return }
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
    const item = checklist.find(x => x.id === id)
    if (item?._local) { setChecklist(prev => prev.filter(x => x.id !== id)); return }
    await deleteChecklistItem(id)
    setChecklist(prev => prev.filter(x => x.id !== id))
  }

  async function salvarEdicaoItem() {
    if (!editandoItem) return
    const { id, texto } = editandoItem
    const textoFinal = texto.trim()
    if (!textoFinal) { setEditandoItem(null); return }
    const item = checklist.find(x => x.id === id)
    if (!item) { setEditandoItem(null); return }
    if (item._local) {
      setChecklist(prev => prev.map(x => x.id === id ? { ...x, texto: textoFinal } : x))
    } else {
      const upd = await updateChecklistItem(id, { texto: textoFinal })
      setChecklist(prev => prev.map(x => x.id === upd.id ? upd : x))
    }
    setEditandoItem(null)
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
          <h2 className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
            {tarefa ? 'Editar tarefa' : 'Nova tarefa'}
            {form.recorrencia_ativa && (
              <span style={{ fontSize:10, fontWeight:700, background:'var(--accent)', color:'#fff', padding:'2px 7px', borderRadius:99 }}>
                RECORRENTE
              </span>
            )}
          </h2>
          <div style={{ display:'flex', gap:8 }}>
            {tarefa && <button className="btn btn-danger btn-sm" onClick={()=>{ limparRascunho(); onDelete(tarefa.id); onClose() }}><Trash2 size={13}/></button>}
            <button className="btn btn-ghost btn-icon" onClick={()=>{ limparRascunho(); onClose() }}><X size={16}/></button>
          </div>
        </div>

        <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border)', marginBottom:16 }}>
          {[
            { id:'detalhes',    label:'Detalhes' },
            { id:'checklist',   label:`Checklist${checkTotal > 0 ? ` (${checkDone}/${checkTotal})` : ''}` },
            ...(tarefa ? [{ id:'comentarios', label:`Comentários (${comentarios.length})` }] : []),
          ].map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:'8px 16px', fontSize:12, fontWeight:700, border:'none', cursor:'pointer',
              background:'transparent', borderBottom: tab===t.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab===t.id ? 'var(--accent)' : 'var(--text-muted)', transition:'all 0.15s'
            }}>{t.label}</button>
          ))}
        </div>

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
            {!tarefa && form.responsavel_id && (
              <div className="form-group">
                <label className="form-label" style={{ display:'flex', alignItems:'center', gap:6 }}>
                  Segundo responsável (opcional)
                  <span style={{ fontSize:10, fontWeight:500, color:'var(--text-muted)' }}>· cria uma cópia da tarefa</span>
                </label>
                <select className="form-select"
                  value={form.responsavel_id_2}
                  onChange={e=>setForm(f=>({...f,responsavel_id_2:e.target.value}))}>
                  <option value="">Sem segundo responsável</option>
                  {usuarios.filter(u => u.id !== form.responsavel_id).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Tempo estimado (opcional)</label>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input className="form-input" type="number" min="0" step="1"
                  style={{ width: 80 }}
                  value={Math.floor((Number(form.tempo_estimado_min) || 0) / 60) || ''}
                  onChange={e => {
                    const h = parseInt(e.target.value) || 0
                    const min = (Number(form.tempo_estimado_min) || 0) % 60
                    setForm(f => ({ ...f, tempo_estimado_min: h * 60 + min || '' }))
                  }}
                  placeholder="0"/>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>h</span>
                <input className="form-input" type="number" min="0" max="59" step="1"
                  style={{ width: 80 }}
                  value={(Number(form.tempo_estimado_min) || 0) % 60 || ''}
                  onChange={e => {
                    const min = parseInt(e.target.value) || 0
                    const h = Math.floor((Number(form.tempo_estimado_min) || 0) / 60)
                    setForm(f => ({ ...f, tempo_estimado_min: h * 60 + min || '' }))
                  }}
                  placeholder="0"/>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>min</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Livros relacionados (opcional)</label>
              <SeletorLivros
                tarefaId={tarefa?.id}
                livrosVinculados={livrosVinculados}
                onChange={setLivrosVinculados}
              />
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Parceiro (opcional)</label>
                <SeletorParceiro
                  value={form.parceiro_id}
                  onChange={p => {
                    if (!p) {
                      setForm(f => ({ ...f, parceiro_id: '' }))
                    } else {
                      setForm(f => ({
                        ...f,
                        parceiro_id: p.id,
                        // preenche responsável automaticamente se o parceiro tiver um responsável interno
                        // e o campo ainda estiver vazio (não sobrescreve escolha manual)
                        responsavel_id: f.responsavel_id ? f.responsavel_id : (p.responsavel_interno_id || f.responsavel_id),
                      }))
                    }
                  }}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Tipo de tarefa (opcional)</label>
                <select
                  className="form-select"
                  value={form.tipo_tarefa}
                  onChange={e => setForm(f => ({ ...f, tipo_tarefa: e.target.value }))}
                >
                  <option value="">Selecionar tipo...</option>
                  {TIPOS_TAREFA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {TIPOS_COM_LIVRO_CAMPANHA.includes(form.tipo_tarefa) && (
              <div className="form-group" style={{
                background:'rgba(236,72,153,0.06)',
                border:'1px solid rgba(236,72,153,0.2)',
                borderRadius:10, padding:'12px 14px',
              }}>
                <label className="form-label" style={{ display:'flex', alignItems:'center', gap:6, color:'#ec4899' }}>
                  <Book size={13}/> Livros desta {form.tipo_tarefa} (opcional)
                </label>
                <SeletorLivrosCampanha
                  livros={livrosCampanha}
                  onChange={setLivrosCampanha}
                />
              </div>
            )}
            <RecorrenciaPanel form={form} setForm={setForm}/>
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
                  {editandoItem?.id === item.id
                    ? <input
                        autoFocus
                        value={editandoItem.texto}
                        onChange={e => setEditandoItem(prev => ({ ...prev, texto: e.target.value }))}
                        onBlur={salvarEdicaoItem}
                        onKeyDown={e => { if (e.key === 'Enter') salvarEdicaoItem(); if (e.key === 'Escape') setEditandoItem(null) }}
                        style={{ flex:1, fontSize:13, background:'transparent', border:'none', borderBottom:'1px solid var(--accent)', outline:'none', color:'var(--text)', padding:'1px 0' }}
                      />
                    : <span
                        onClick={() => setEditandoItem({ id: item.id, texto: item.texto })}
                        title="Clique para editar"
                        style={{ flex:1, fontSize:13, color: item.concluido ? 'var(--text-muted)' : 'var(--text)', textDecoration: item.concluido ? 'line-through' : 'none', cursor:'text' }}
                      >{item.texto}</span>
                  }
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
          <button className="btn btn-ghost" onClick={()=>{ limparRascunho(); onClose() }}>Cancelar</button>
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
  const { perfilAtivo } = useViewAs()
  const [etapa, setEtapa] = useState('upload')
  const [arquivo, setArquivo] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const fileInputRef = useRef()

  function baixarTemplate() {
    const wb = XLSX.utils.book_new()
    const headers = ['Título', 'Descrição', 'Responsável', 'Livros (ISBN, separados por vírgula)', 'Prazo (DD/MM/AAAA)', 'Prioridade', 'Status']
    const exemplos = [
      ['Produzir 4 roteiros de Reels - semana 19', 'Foco em hooks de abertura. Entregar até quinta.', 'Sarah', '9788580330000, 9788580330001', '09/05/2026', 'Alta', 'A fazer'],
      ['Atualizar ficha técnica de 3 títulos', 'Corrigir peso e dimensões no Mercado Livre.', 'Fernanda', '9788580330002', '12/05/2026', 'Média', 'A fazer'],
      ['Briefing de carrossel - campanha Quaresma', 'Tom litúrgico, 7 slides.', 'Vanessa', '9788580330003, 9788580330004', '15/05/2026', 'Baixa', 'A fazer'],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet([headers, ...exemplos])
    ws1['!cols'] = [{ wch: 38 }, { wch: 45 }, { wch: 18 }, { wch: 32 }, { wch: 20 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Tarefas')

    const instr = [
      ['Como usar este template'], [''],
      ['1. Apague as 3 linhas de exemplo da aba Tarefas antes de preencher com suas tarefas reais.'],
      ['2. Preencha uma linha por tarefa. Não deixe linhas em branco no meio.'],
      ['3. Salve em formato .xlsx (não .csv ou .xls).'],
      ['4. Volte para o Orbita e faça o upload.'], [''],
      ['Regras de cada campo:'],
      ['Título: obrigatório, máximo 200 caracteres.'],
      ['Descrição: opcional, briefing detalhado.'],
      ['Responsável: obrigatório. Use exatamente um dos nomes da aba Referências.'],
      ['Livros: opcional. ISBN com 13 dígitos. Para múltiplos livros, separe por vírgula.'],
      ['Prazo: obrigatório. Formato DD/MM/AAAA.'],
      ['Prioridade: obrigatório. Aceita: Urgente, Alta, Média, Baixa.'],
      ['Status: opcional. Padrão A fazer. Aceita: A fazer, Em andamento, Concluído.'], [''],
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
    if (!file.name.toLowerCase().endsWith('.xlsx')) { alert('Apenas arquivos .xlsx são aceitos.'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Arquivo maior que 5 MB.'); return }
    setArquivo(file)
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets['Tarefas'] || wb.Sheets[wb.SheetNames[0]]
      if (!ws) { alert('Aba "Tarefas" não encontrada na planilha.'); return }
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
          } else { responsavel_id = u.id }
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
          } else { erros.push(`Prazo deve estar em DD/MM/AAAA, recebido: "${prazoStr}"`) }
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

        return { linha, titulo, descricao, responsavelNome, responsavel_id, data_prazo, prioridade, status, livro_ids, isbns_originais: isbnsRaw, erros, valida: erros.length === 0 }
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
      const perfilEfetivo = perfilAtivo || usuario?.perfil
      const grupoFallback = PERFIL_GRUPO[perfilEfetivo] || null
      const validas = linhas.filter(l => l.valida).map(l => {
        const resp = (usuarios || []).find(u => u.id === l.responsavel_id)
        const grupoResp = resp ? PERFIL_GRUPO[resp.perfil] : null
        return {
          titulo: l.titulo, descricao: l.descricao || null, status: l.status,
          prioridade: l.prioridade, responsavel_id: l.responsavel_id,
          data_prazo: l.data_prazo, livro_ids: l.livro_ids,
          grupo: grupoResp || grupoFallback,
        }
      })
      const ignoradas = linhas.filter(l => !l.valida).map(l => ({ linha: l.linha, titulo: l.titulo, responsavel: l.responsavelNome, erros: l.erros }))
      const r = await importarTarefasLote({ tarefas: validas, ignoradas, filename: arquivo.name, userId: usuario?.id })
      setResultado(r)
      setEtapa('sucesso')
    } catch (e) {
      console.error(e)
      alert('Erro ao importar: ' + (e?.message || 'desconhecido'))
    } finally { setImportando(false) }
  }

  function baixarRelatorioErros() {
    const ignoradas = linhas.filter(l => !l.valida)
    if (ignoradas.length === 0) return
    const wb = XLSX.utils.book_new()
    const headers = ['Linha', 'Título', 'Responsável', 'Motivo do erro']
    const dados = ignoradas.map(l => [l.linha, l.titulo || '', l.responsavelNome || '', l.erros.join(' · ')])
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
            <p style={{ fontSize:13, color:'var(--text-soft)', marginBottom:16 }}>Baixe o template, preencha com suas tarefas e faça o upload abaixo.</p>
            <button onClick={baixarTemplate} className="btn btn-ghost" style={{ width:'100%', marginBottom:16, padding:'12px', justifyContent:'center', gap:8 }}>
              <Download size={14}/> Baixar template .xlsx
            </button>
            <div
              onClick={()=>fileInputRef.current?.click()}
              onDragOver={e=>{ e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)' }}
              onDragLeave={e=>{ e.currentTarget.style.borderColor = 'var(--border)' }}
              onDrop={e=>{ e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; const file = e.dataTransfer.files?.[0]; if (file) processarArquivo(file) }}
              style={{ border:'2px dashed var(--border)', borderRadius:12, padding:'40px 20px', textAlign:'center', cursor:'pointer', transition:'border 0.15s', background:'var(--surface-2)' }}
            >
              <Upload size={32} style={{ color:'var(--text-muted)', marginBottom:8 }}/>
              <div style={{ fontSize:13, color:'var(--text-soft)', marginBottom:4 }}>Clique ou arraste o arquivo aqui</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>Apenas .xlsx · máximo 5 MB</div>
              <input ref={fileInputRef} type="file" accept=".xlsx" style={{ display:'none' }} onChange={e=>{ const file = e.target.files?.[0]; if (file) processarArquivo(file); e.target.value = '' }}/>
            </div>
          </div>
        )}

        {etapa === 'revisao' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
              <div style={{ background:'var(--surface-2)', borderRadius:8, padding:'12px' }}><div style={{ fontSize:11, color:'var(--text-muted)' }}>Linhas detectadas</div><div style={{ fontSize:22, fontWeight:700 }}>{linhas.length}</div></div>
              <div style={{ background:'rgba(34,197,94,0.1)', borderRadius:8, padding:'12px' }}><div style={{ fontSize:11, color:'var(--green)' }}>Válidas</div><div style={{ fontSize:22, fontWeight:700, color:'var(--green)' }}>{validas}</div></div>
              <div style={{ background:'rgba(239,68,68,0.1)', borderRadius:8, padding:'12px' }}><div style={{ fontSize:11, color:'var(--red)' }}>Com erro</div><div style={{ fontSize:22, fontWeight:700, color:'var(--red)' }}>{comErro}</div></div>
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
                      <td style={{ padding:'8px 10px', color: l.valida ? 'var(--text)' : 'var(--red)' }}>{l.titulo || <span style={{ fontStyle:'italic', opacity:0.6 }}>(sem título)</span>}</td>
                      <td style={{ padding:'8px 10px', color: l.valida ? 'var(--green)' : 'var(--red)' }}>{l.valida ? '✓ Pronta' : l.erros.join(' · ')}</td>
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
              <button className="btn btn-ghost" onClick={()=>{ setEtapa('upload'); setLinhas([]); setArquivo(null) }}>Voltar</button>
              <button className="btn btn-primary" onClick={confirmarImportacao} disabled={importando || validas === 0}>
                {importando ? 'Importando...' : `Importar ${validas} válida${validas!==1?'s':''}${comErro > 0 ? ` · ${comErro} ignorada${comErro!==1?'s':''}` : ''}`}
              </button>
            </div>
          </div>
        )}

        {etapa === 'sucesso' && resultado && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <CheckCircle2 size={48} color="var(--green)" style={{ marginBottom:12 }}/>
            <h3 style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Importação concluída!</h3>
            <p style={{ fontSize:13, color:'var(--text-soft)', marginBottom:6 }}>{resultado.criadas} tarefa{resultado.criadas!==1?'s':''} criada{resultado.criadas!==1?'s':''} com sucesso.</p>
            {resultado.livrosVinculados > 0 && <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>{resultado.livrosVinculados} vínculo{resultado.livrosVinculados!==1?'s':''} de livro criado{resultado.livrosVinculados!==1?'s':''}.</p>}
            {resultado.ignoradas > 0 && <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>{resultado.ignoradas} linha{resultado.ignoradas!==1?'s':''} com erro foi/foram ignorada{resultado.ignoradas!==1?'s':''}.</p>}
            <button className="btn btn-primary" onClick={()=>{ onImported(); onClose() }} style={{ marginTop:8 }}>Ver tarefas</button>
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
      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:8, lineHeight:1.4, display:'flex', alignItems:'center', gap:6 }}>
        {tarefa.titulo}
        {tarefa.recorrencia_ativa && <span title="Tarefa recorrente" style={{ fontSize:10, color:'var(--accent)', flexShrink:0 }}>🔁</span>}
      </div>
      {tarefa.descricao && (
        <div style={{ fontSize:11.5, color:'var(--text-muted)', marginBottom:8, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{tarefa.descricao}</div>
      )}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <PrioridadeBadge value={tarefa.prioridade}/>
          {checkTotal > 0 && <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}><CheckSquare size={11}/> {checkDone}/{checkTotal}</span>}
          {(tarefa.tarefa_comentarios?.length||0) > 0 && <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}><MessageSquare size={11}/> {tarefa.tarefa_comentarios.length}</span>}
          {livrosCount > 0 && <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }}><Book size={11}/> {livrosCount}</span>}
          {tarefa.tempo_estimado_min > 0 && (
            <span style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:3 }} title="Tempo estimado">
              <Clock size={11}/>
              {Math.floor(tarefa.tempo_estimado_min / 60) > 0 && `${Math.floor(tarefa.tempo_estimado_min / 60)}h`}
              {tarefa.tempo_estimado_min % 60 > 0 && `${tarefa.tempo_estimado_min % 60}min`}
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <PrazoBadge data_prazo={tarefa.data_prazo} status={tarefa.status}/>
        </div>
      </div>
      {tarefa.responsavel?.nome && (
        <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:18, height:18, borderRadius:'50%', background:'var(--accent-glow)', border:'1px solid var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'var(--accent)', flexShrink:0 }}>
            {tarefa.responsavel.nome[0].toUpperCase()}
          </div>
          <span style={{ fontSize:11, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tarefa.responsavel.nome}</span>
        </div>
      )}
    </div>
  )
}

function menuItemStyle() {
  return { width:'100%', padding:'8px 12px', textAlign:'left', background:'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--text)', borderRadius:6, transition:'background 0.1s' }
}

// ── MODAL CRIAR EM LOTE ────────────────────────────────────
const CLASSES_PARCEIRO_LOTE = {
  A: { label: 'Classe A', cor: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)' },
  B: { label: 'Classe B', cor: '#14b8a6', bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.3)' },
  C: { label: 'Classe C', cor: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  D: { label: 'Classe D', cor: '#9ca3af', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)' },
}

function ModalCriarLote({ usuarios, grupoPrincipal, onClose, onCreate }) {
  const [passo, setPasso] = useState(1) // 1=configurar, 2=revisar, 3=sucesso
  const [classesSelecionadas, setClassesSelecionadas] = useState([])
  const [tipoTarefa, setTipoTarefa] = useState('')
  const [prioridade, setPrioridade] = useState('media')
  const [dataPrazo, setDataPrazo] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [parceiros, setParceiros] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [criando, setCriando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [parceirosExcluidos, setParceirosExcluidos] = useState(new Set())

  function toggleClasse(c) {
    setClassesSelecionadas(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    )
  }

  async function buscarParceiros() {
    if (!classesSelecionadas.length || !tipoTarefa) return
    setCarregando(true)
    try {
      const data = await getParceirosAtivos()
      const filtrados = data.filter(p => classesSelecionadas.includes(p.classe))
      setParceiros(filtrados)
      setPasso(2)
    } catch (e) { console.error(e) }
    finally { setCarregando(false) }
  }

  function toggleExcluir(id) {
    setParceirosExcluidos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const parceirosAtivos = parceiros.filter(p => !parceirosExcluidos.has(p.id))

  async function criarTarefas() {
    if (!parceirosAtivos.length) return
    setCriando(true)
    setProgresso(0)
    let criadas = 0
    for (const parceiro of parceirosAtivos) {
      try {
        await createTarefa({
          titulo: `${tipoTarefa} — ${parceiro.livraria || parceiro.nome}`,
          status: 'a_fazer',
          prioridade,
          data_prazo: dataPrazo || null,
          responsavel_id: parceiro.responsavel_interno_id || responsavelId || null,
          parceiro_id: parceiro.id,
          tipo_tarefa: tipoTarefa,
          grupo: grupoPrincipal,
        })
        criadas++
        setProgresso(Math.round((criadas / parceirosAtivos.length) * 100))
      } catch (e) { console.error(e) }
    }
    setPasso(3)
    setCriando(false)
    onCreate(criadas)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header" style={{ position:'sticky', top:0, background:'var(--surface)', zIndex:10 }}>
          <h2 className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Layers size={16} color="var(--accent)"/>
            Criar tarefas em lote
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        {/* Indicador de passo */}
        <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'1px solid var(--border)' }}>
          {['Configurar', 'Revisar parceiros', 'Concluído'].map((l, i) => (
            <div key={i} style={{ flex:1, padding:'8px 0', textAlign:'center', fontSize:12, fontWeight: passo === i+1 ? 700 : 400,
              color: passo === i+1 ? 'var(--accent)' : passo > i+1 ? 'var(--green)' : 'var(--text-muted)',
              borderBottom: passo === i+1 ? '2px solid var(--accent)' : '2px solid transparent' }}>
              {passo > i+1 ? '✓ ' : ''}{l}
            </div>
          ))}
        </div>

        {/* PASSO 1 — Configurar */}
        {passo === 1 && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Classe dos parceiros *</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {Object.entries(CLASSES_PARCEIRO_LOTE).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => toggleClasse(k)} style={{
                    padding:'6px 16px', borderRadius:99, fontSize:12, fontWeight:700, cursor:'pointer',
                    border: `1px solid ${classesSelecionadas.includes(k) ? v.cor : 'var(--border)'}`,
                    background: classesSelecionadas.includes(k) ? v.bg : 'transparent',
                    color: classesSelecionadas.includes(k) ? v.cor : 'var(--text-muted)',
                    transition:'all 0.15s',
                  }}>{v.label}</button>
                ))}
              </div>
              {classesSelecionadas.length > 0 && (
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                  {classesSelecionadas.length} classe{classesSelecionadas.length > 1 ? 's' : ''} selecionada{classesSelecionadas.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de tarefa *</label>
              <select className="form-select" value={tipoTarefa} onChange={e => setTipoTarefa(e.target.value)}>
                <option value="">Selecionar tipo...</option>
                {TIPOS_TAREFA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {tipoTarefa && classesSelecionadas.length > 0 && (
              <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'var(--text-muted)' }}>
                Título gerado: <strong style={{ color:'var(--text)' }}>{tipoTarefa} — [nome do parceiro]</strong>
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Prioridade</label>
                <select className="form-select" value={prioridade} onChange={e => setPrioridade(e.target.value)}>
                  {PRIORIDADE.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Prazo</label>
                <input className="form-input" type="date" value={dataPrazo} onChange={e => setDataPrazo(e.target.value)}/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Responsável padrão
                <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:400, marginLeft:6 }}>
                  (usado quando o parceiro não tem responsável definido)
                </span>
              </label>
              <select className="form-select" value={responsavelId} onChange={e => setResponsavelId(e.target.value)}>
                <option value="">Sem responsável padrão</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={buscarParceiros}
                disabled={!classesSelecionadas.length || !tipoTarefa || carregando}>
                {carregando ? 'Buscando...' : 'Ver parceiros →'}
              </button>
            </div>
          </div>
        )}

        {/* PASSO 2 — Revisar parceiros */}
        {passo === 2 && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <p style={{ fontSize:13, color:'var(--text-muted)', margin:0 }}>
                <strong style={{ color:'var(--text)' }}>{parceirosAtivos.length}</strong> tarefa{parceirosAtivos.length !== 1 ? 's' : ''} serão criadas.
                {parceirosExcluidos.size > 0 && <span style={{ color:'var(--text-muted)' }}> ({parceirosExcluidos.size} excluído{parceirosExcluidos.size > 1 ? 's' : ''})</span>}
              </p>
              <button className="btn btn-ghost btn-sm" onClick={() => setParceirosExcluidos(new Set())} style={{ fontSize:11 }}>
                Incluir todos
              </button>
            </div>
            <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', maxHeight:320, overflowY:'auto', marginBottom:16 }}>
              {parceiros.length === 0
                ? <div style={{ padding:'20px', textAlign:'center', fontSize:13, color:'var(--text-muted)' }}>
                    Nenhum parceiro ativo encontrado nas classes selecionadas.
                  </div>
                : parceiros.map(p => {
                    const excluido = parceirosExcluidos.has(p.id)
                    const cl = CLASSES_PARCEIRO_LOTE[p.classe]
                    return (
                      <div key={p.id} style={{
                        display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                        borderBottom:'1px solid var(--border)',
                        background: excluido ? 'var(--surface-2)' : 'transparent',
                        opacity: excluido ? 0.5 : 1, transition:'all 0.15s',
                      }}>
                        <input type="checkbox" checked={!excluido} onChange={() => toggleExcluir(p.id)}
                          style={{ width:15, height:15, cursor:'pointer', accentColor:'var(--accent)' }}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {tipoTarefa} — {p.livraria || p.nome}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:6 }}>
                            <span>{p.nome}</span>
                            {(p.responsavel_interno_id || responsavelId) && (
                              <>
                                <span>·</span>
                                <span style={{ color: p.responsavel_interno_id ? 'var(--accent)' : 'var(--text-muted)' }}>
                                  {p.responsavel_interno_id
                                    ? (usuarios.find(u => u.id === p.responsavel_interno_id)?.nome || '—')
                                    : (usuarios.find(u => u.id === responsavelId)?.nome || '—')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {cl && (
                          <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
                            background:cl.bg, color:cl.cor, border:`1px solid ${cl.border}`, flexShrink:0 }}>
                            {p.classe}
                          </span>
                        )}
                      </div>
                    )
                  })
              }
            </div>
            {criando && (
              <div style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>
                  <span>Criando tarefas...</span><span>{progresso}%</span>
                </div>
                <div style={{ height:4, borderRadius:99, background:'var(--surface-3)' }}>
                  <div style={{ height:'100%', width:`${progresso}%`, background:'var(--accent)', borderRadius:99, transition:'width 0.2s' }}/>
                </div>
              </div>
            )}
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setPasso(1)} disabled={criando}>← Voltar</button>
              <button className="btn btn-primary" onClick={criarTarefas}
                disabled={criando || parceirosAtivos.length === 0}>
                {criando ? 'Criando...' : `Criar ${parceirosAtivos.length} tarefa${parceirosAtivos.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* PASSO 3 — Sucesso */}
        {passo === 3 && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <CheckCircle2 size={48} color="var(--green)" style={{ marginBottom:12 }}/>
            <h3 style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Tarefas criadas!</h3>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>
              {parceirosAtivos.length} tarefa{parceirosAtivos.length !== 1 ? 's' : ''} de <strong>{tipoTarefa}</strong> foram criadas com sucesso.
            </p>
            <button className="btn btn-primary" onClick={onClose}>Ver tarefas</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MODAL EDITAR EM LOTE ───────────────────────────────────
function ModalEditarLote({ tarefasSelecionadas, usuarios, onSave, onClose }) {
  const [campos, setCampos] = useState({
    responsavel_id: '', data_prazo: '', prioridade: '', status: '', tipo_tarefa: '',
  })
  const [ativados, setAtivados] = useState({
    responsavel_id: false, data_prazo: false, prioridade: false, status: false, tipo_tarefa: false,
  })
  const [salvando, setSalvando] = useState(false)
  const [progresso, setProgresso] = useState(0)

  function toggleAtivado(campo) {
    setAtivados(prev => ({ ...prev, [campo]: !prev[campo] }))
  }

  const camposAtivados = Object.keys(ativados).filter(k => ativados[k])
  const payload = {}
  camposAtivados.forEach(k => { payload[k] = campos[k] || null })

  async function salvar() {
    if (!camposAtivados.length) return
    setSalvando(true)
    setProgresso(0)
    let done = 0
    for (const t of tarefasSelecionadas) {
      try {
        await updateTarefa(t.id, payload)
        done++
        setProgresso(Math.round((done / tarefasSelecionadas.length) * 100))
      } catch (e) { console.error(e) }
    }
    setSalvando(false)
    onSave()
  }

  function CampoToggle({ campo, label, children }) {
    return (
      <div style={{ borderRadius:8, border:`1px solid ${ativados[campo] ? 'var(--accent)' : 'var(--border)'}`,
        padding:'10px 14px', transition:'border 0.15s', background: ativados[campo] ? 'var(--accent-glow)' : 'transparent' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: ativados[campo] ? 10 : 0 }}>
          <label style={{ fontSize:13, fontWeight:600, color: ativados[campo] ? 'var(--accent)' : 'var(--text)', cursor:'pointer' }}
            onClick={() => toggleAtivado(campo)}>{label}</label>
          <button type="button" onClick={() => toggleAtivado(campo)} style={{
            width:34, height:18, borderRadius:10, border:'none', cursor:'pointer', padding:0,
            background: ativados[campo] ? 'var(--accent)' : 'var(--surface-3)', position:'relative', flexShrink:0,
          }}>
            <span style={{ position:'absolute', top:2, left: ativados[campo] ? 17 : 2, width:14, height:14,
              borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
          </button>
        </div>
        {ativados[campo] && children}
      </div>
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Layers size={16} color="var(--accent)"/>
            Editar {tarefasSelecionadas.length} tarefa{tarefasSelecionadas.length !== 1 ? 's' : ''} em lote
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>
          Ative os campos que quer alterar. Apenas os campos ativados serão atualizados.
        </p>

        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
          <CampoToggle campo="responsavel_id" label="Responsável">
            <select className="form-select" value={campos.responsavel_id} onChange={e => setCampos(f => ({ ...f, responsavel_id: e.target.value }))}>
              <option value="">Sem responsável</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </CampoToggle>

          <CampoToggle campo="data_prazo" label="Prazo">
            <input className="form-input" type="date" value={campos.data_prazo}
              onChange={e => setCampos(f => ({ ...f, data_prazo: e.target.value }))}/>
          </CampoToggle>

          <CampoToggle campo="prioridade" label="Prioridade">
            <select className="form-select" value={campos.prioridade} onChange={e => setCampos(f => ({ ...f, prioridade: e.target.value }))}>
              <option value="">Selecionar...</option>
              {PRIORIDADE.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </CampoToggle>

          <CampoToggle campo="status" label="Status">
            <select className="form-select" value={campos.status} onChange={e => setCampos(f => ({ ...f, status: e.target.value }))}>
              <option value="">Selecionar...</option>
              {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </CampoToggle>

          <CampoToggle campo="tipo_tarefa" label="Tipo de tarefa">
            <select className="form-select" value={campos.tipo_tarefa} onChange={e => setCampos(f => ({ ...f, tipo_tarefa: e.target.value }))}>
              <option value="">Selecionar...</option>
              {TIPOS_TAREFA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </CampoToggle>
        </div>

        {salvando && (
          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>
              <span>Atualizando tarefas...</span><span>{progresso}%</span>
            </div>
            <div style={{ height:4, borderRadius:99, background:'var(--surface-3)' }}>
              <div style={{ height:'100%', width:`${progresso}%`, background:'var(--accent)', borderRadius:99, transition:'width 0.2s' }}/>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar}
            disabled={salvando || !camposAtivados.length}>
            {salvando ? 'Salvando...' : `Aplicar a ${tarefasSelecionadas.length} tarefa${tarefasSelecionadas.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function Tarefas() {
  const { usuario } = useAuth()
  const { perfilAtivo, usuarioAtivo } = useViewAs()  // perfil real ou viewAs

  // Quando estiver em modo "Ver como", usa o perfil/usuário visualizado.
  // Isso impede que um administrador visualizando a equipe de Parceiras veja tarefas de outros grupos.
  const perfilEfetivo = perfilAtivo || usuario?.perfil
  const usuarioEfetivo = usuarioAtivo || usuario
  const ehAdminVisual = ['administrador', 'gerente'].includes(perfilEfetivo)
  const grupoPrincipal = PERFIL_GRUPO[perfilEfetivo] || null
  const gruposExtras = usuarioEfetivo?.grupos_extras || []
  const gruposPermitidos = new Set([grupoPrincipal, ...gruposExtras].filter(Boolean))
  const usuarioFiltroId = usuarioEfetivo?.id || usuario?.id

  const [tarefas, setTarefas]       = useState([])
  const [usuarios, setUsuarios]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(null)
  const [showImportar, setShowImportar] = useState(false)
  const [showCriarLote, setShowCriarLote] = useState(false)
  const [showEditarLote, setShowEditarLote] = useState(false)
  const [selecionadas, setSelecionadas] = useState(new Set())
  const [showMenuNova, setShowMenuNova] = useState(false)
  const [view, setView]             = usePersistedState('view', 'kanban')
  const [filtroStatus, setFiltroStatus]         = usePersistedState('filtroStatus', 'todos')
  const [filtroPrioridade, setFiltroPrioridade] = usePersistedState('filtroPrioridade', 'todas')
  const [filtroResponsavel, setFiltroResponsavel] = usePersistedState('filtroResponsavel', 'todos')
  const [toast, showToast]          = useToast()
  const [dragId, setDragId]         = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [sortCol, setSortCol]       = usePersistedState('sortCol', 'data_prazo')
  const [sortDir, setSortDir]       = usePersistedState('sortDir', 'asc')
  const [abaView, setAbaView]       = usePersistedState('abaView', 'ativas')
  const [modalIdPendente, setModalIdPendente] = usePersistedState('modalId', null)
  const menuRef = useRef()

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function abrirModal(tarefa) {
    setModal(tarefa)
    if (tarefa && tarefa !== 'new' && tarefa.id) setModalIdPendente(tarefa.id)
    else setModalIdPendente(null)
  }

  function fecharModal() {
    setModal(null)
    setModalIdPendente(null)
    carregar()
  }

  async function carregar() {
    setLoading(true)
    try {
      const [t, us] = await Promise.all([getTarefas(), getUsuarios()])

      // Filtra tarefas pelo grupo principal + grupos_extras do perfil efetivo.
      // Admin e gerente visualizados veem tudo. Demais perfis veem apenas seus grupos permitidos.
      if (ehAdminVisual) {
        setTarefas(t)
      } else {
        setTarefas(t.filter(tarefa => tarefa.grupo && gruposPermitidos.has(tarefa.grupo)))
      }

      setUsuarios(us || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const ultimoPerfil = useRef(null)
  useEffect(() => {
    const chave = `${perfilEfetivo}|${JSON.stringify(gruposExtras)}`
    if (chave === ultimoPerfil.current) return // mesmo perfil, não recarrega
    ultimoPerfil.current = chave
    carregar()
  }, [perfilEfetivo, JSON.stringify(gruposExtras)]) // eslint-disable-line

  // Reabre o modal da tarefa que estava aberta antes de sair da tela
  useEffect(() => {
    if (!loading && modalIdPendente && tarefas.length > 0) {
      const tarefa = tarefas.find(t => t.id === modalIdPendente)
      if (tarefa) setModal(tarefa)
      else setModalIdPendente(null) // tarefa não existe mais, limpa
    }
  }, [loading]) // eslint-disable-line

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenuNova(false)
    }
    if (showMenuNova) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenuNova])

  // Helper: define o grupo da tarefa pelo responsável.
  // Se não houver responsável, usa o grupo do perfil efetivo.
  function grupoDaTarefa(form) {
    const responsavel = (usuarios || []).find(u => u.id === form.responsavel_id)
    const grupoResp = responsavel ? PERFIL_GRUPO[responsavel.perfil] : null
    return grupoResp || grupoPrincipal || null
  }

  async function handleSave(form, id) {
    if (id) {
      const { _checklistPendente: _cp, _livrosCampanhaPendentes: _lcp, _segundoResponsavel: _sr, responsavel_id_2: _r2, ...formLimpo } = form
      // sanitiza campos opcionais: string vazia → null (evita erro de UUID inválido no Supabase)
      const payload = {
        ...formLimpo,
        responsavel_id:     formLimpo.responsavel_id   || null,
        parceiro_id:        formLimpo.parceiro_id       || null,
        data_prazo:         formLimpo.data_prazo        || null,
        tipo_tarefa:        formLimpo.tipo_tarefa       || null,
        recorrencia_tipo:   formLimpo.recorrencia_tipo  || null,
        tempo_estimado_min: formLimpo.tempo_estimado_min ?? null,
        grupo:              grupoDaTarefa(formLimpo),
      }
      const tarefaAntes = tarefas.find(t => t.id === id)
      const upd = await updateTarefa(id, payload)
      // salva livros da campanha ao editar (adiciona os que não existem ainda)
      if (_lcp?.length) {
        const idsJaVinculados = (upd.tarefa_livros || []).map(tl => tl.livros?.id).filter(Boolean)
        await Promise.all(_lcp.filter(lid => !idsJaVinculados.includes(lid)).map(lid => addLivroTarefa(id, lid)))
      }
      setTarefas(prev => prev.map(t => t.id === upd.id ? upd : t))

      // Se concluiu uma tarefa recorrente, gera a próxima ocorrência
      if (upd.status === 'concluido' && tarefaAntes?.status !== 'concluido' && upd.recorrencia_ativa) {
        try {
          const proxima = await gerarProximaOcorrencia(upd)
          if (proxima) {
            setTarefas(prev => [proxima, ...prev])
            showToast('Tarefa concluída! Próxima ocorrência criada 🔁')
          } else {
            showToast('Tarefa concluída! 🎉')
          }
        } catch(e) {
          console.error('Erro ao gerar próxima ocorrência:', e)
          showToast('Tarefa concluída! 🎉')
        }
      } else if (upd.status === 'concluido' && abaView === 'ativas') {
        showToast('Tarefa concluída! 🎉')
      } else if (upd.status !== 'concluido' && abaView === 'concluidas') {
        showToast('Tarefa reativada!')
      } else {
        showToast('Tarefa atualizada!')
      }
    } else {
      const { _checklistPendente, _livrosCampanhaPendentes, _segundoResponsavel, responsavel_id_2, ...formLimpo } = form
      const basePayload = {
        ...formLimpo,
        parceiro_id:        formLimpo.parceiro_id       || null,
        data_prazo:         formLimpo.data_prazo        || null,
        tipo_tarefa:        formLimpo.tipo_tarefa       || null,
        recorrencia_tipo:   formLimpo.recorrencia_tipo  || null,
        tempo_estimado_min: formLimpo.tempo_estimado_min ?? null,
        grupo:              grupoDaTarefa(formLimpo),
      }

      // cria a tarefa para o responsável principal
      const nova = await createTarefa({
        ...basePayload,
        responsavel_id: formLimpo.responsavel_id || null,
      })
      if (_checklistPendente?.length) {
        await Promise.all(_checklistPendente.map(texto => addChecklistItem(nova.id, texto)))
      }
      if (_livrosCampanhaPendentes?.length) {
        await Promise.all(_livrosCampanhaPendentes.map(lid => addLivroTarefa(nova.id, lid)))
      }
      setTarefas(prev => [nova, ...prev])

      // se tem um segundo responsável, cria cópia idêntica para ele
      if (_segundoResponsavel) {
        const copia = await createTarefa({
          ...basePayload,
          responsavel_id: _segundoResponsavel,
        })
        if (_checklistPendente?.length) {
          await Promise.all(_checklistPendente.map(texto => addChecklistItem(copia.id, texto)))
        }
        if (_livrosCampanhaPendentes?.length) {
          await Promise.all(_livrosCampanhaPendentes.map(lid => addLivroTarefa(copia.id, lid)))
        }
        setTarefas(prev => [copia, ...prev])
        showToast('2 tarefas criadas (uma para cada responsável)!')
      } else {
        showToast('Tarefa criada!')
      }
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

  async function handleDragDrop(novoStatus) {
    if (!dragId || !novoStatus) { setDragId(null); setDragOverCol(null); return }
    const tarefa = tarefas.find(t => t.id === dragId)
    if (!tarefa || tarefa.status === novoStatus) { setDragId(null); setDragOverCol(null); return }
    setDragId(null); setDragOverCol(null)
    setTarefas(prev => prev.map(t => t.id === dragId ? { ...t, status: novoStatus } : t))
    try {
      await updateTarefa(dragId, { status: novoStatus })
    } catch(e) {
      setTarefas(prev => prev.map(t => t.id === dragId ? { ...t, status: tarefa.status } : t))
      showToast('Erro ao mover tarefa', 'error')
    }
  }

  const tarefasAtivas     = tarefas.filter(t => t.status !== 'concluido')
  const tarefasConcluidas = tarefas.filter(t => t.status === 'concluido')
  const listaBase = abaView === 'ativas' ? tarefasAtivas : tarefasConcluidas

  const tarefasFiltradas = listaBase.filter(t => {
    if (filtroStatus !== 'todos' && t.status !== filtroStatus) return false
    if (filtroPrioridade !== 'todas' && t.prioridade !== filtroPrioridade) return false
    if (filtroResponsavel !== 'todos') {
      if (filtroResponsavel === 'minha' && t.responsavel_id !== usuarioFiltroId) return false
      if (filtroResponsavel !== 'minha' && t.responsavel_id !== filtroResponsavel) return false
    }
    return true
  })

  const PRIORIDADE_ORDER = { urgente: 0, alta: 1, media: 2, baixa: 3 }
  const STATUS_ORDER     = { a_fazer: 0, em_andamento: 1, concluido: 2 }
  const tarefasOrdenadas = [...tarefasFiltradas].sort((a, b) => {
    let va, vb
    if (sortCol === 'titulo') { va = (a.titulo || '').toLowerCase(); vb = (b.titulo || '').toLowerCase() }
    else if (sortCol === 'status') { va = STATUS_ORDER[a.status] ?? 99; vb = STATUS_ORDER[b.status] ?? 99 }
    else if (sortCol === 'prioridade') { va = PRIORIDADE_ORDER[a.prioridade] ?? 99; vb = PRIORIDADE_ORDER[b.prioridade] ?? 99 }
    else if (sortCol === 'responsavel') { va = (a.responsavel?.nome || '').toLowerCase(); vb = (b.responsavel?.nome || '').toLowerCase() }
    else if (sortCol === 'data_prazo') { va = a.data_prazo || '9999'; vb = b.data_prazo || '9999' }
    else { va = ''; vb = '' }
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

  const usuariosVisiveis = ehAdminVisual
    ? usuarios
    : usuarios.filter(u => {
        const grupoUsuario = PERFIL_GRUPO[u.perfil] || u.grupo || null
        return u.id === usuarioFiltroId || (grupoUsuario && gruposPermitidos.has(grupoUsuario))
      })

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
            {[
              { k:'kanban',    label:'Kanban',    icon: Columns },
              { k:'lista',     label:'Lista',     icon: List },
              { k:'calendario',label:'Calendário',icon: CalendarDays },
              { k:'equipe',    label:'Equipe',    icon: Users },
            ].map(({ k, label, icon: Icon }) => (
              <button key={k} onClick={()=>setView(k)} style={{ padding:'7px 12px', border:'none', cursor:'pointer', background: view===k ? 'var(--accent)' : 'transparent', color: view===k ? '#fff' : 'var(--text-muted)', transition:'all 0.15s', display:'flex', alignItems:'center', gap:5, fontSize:12 }}>
                <Icon size={13}/> {label}
              </button>
            ))}
          </div>

          <div ref={menuRef} style={{ position:'relative', display:'flex' }}>
            <button className="btn btn-primary" onClick={()=>abrirModal('new')} style={{ borderTopRightRadius:0, borderBottomRightRadius:0, borderRight:'1px solid rgba(255,255,255,0.2)' }}>
              <Plus size={14}/> Nova tarefa
            </button>
            <button className="btn btn-primary" onClick={()=>setShowMenuNova(s=>!s)} style={{ borderTopLeftRadius:0, borderBottomLeftRadius:0, padding:'0 8px' }} aria-label="Mais opções">
              {showMenuNova ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
            {showMenuNova && (
              <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.2)', zIndex:20, minWidth:220, padding:6 }}>
                <button onClick={()=>{ setShowMenuNova(false); abrirModal('new') }} style={menuItemStyle()} onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <Plus size={13}/> Criar manualmente
                </button>
                <button onClick={()=>{ setShowMenuNova(false); setShowCriarLote(true) }} style={menuItemStyle()} onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <Layers size={13}/> Criar em lote por classe
                </button>
                <button onClick={()=>{ setShowMenuNova(false); setShowImportar(true) }} style={menuItemStyle()} onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
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
            style={{ padding:'9px 18px', fontSize:13, fontWeight: abaView===k ? 700 : 400, cursor:'pointer', background:'none', border:'none', borderBottom: abaView===k ? '2px solid var(--accent)' : '2px solid transparent', color: abaView===k ? 'var(--accent)' : 'var(--text-muted)' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }} value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          {(abaView === 'ativas' ? STATUS.filter(s => s.value !== 'concluido') : STATUS.filter(s => s.value === 'concluido')).map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }} value={filtroPrioridade} onChange={e=>setFiltroPrioridade(e.target.value)}>
          <option value="todas">Todas as prioridades</option>
          {PRIORIDADE.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select className="form-select" style={{ width:'auto', fontSize:12, padding:'6px 10px' }} value={filtroResponsavel} onChange={e=>setFiltroResponsavel(e.target.value)}>
          <option value="todos">Todos os responsáveis</option>
          <option value="minha">Minhas tarefas</option>
          {usuariosVisiveis.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
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
            const isOver = dragOverCol === s.value
            const corCol = s.value==='concluido'?'var(--green)':s.value==='em_andamento'?'var(--amber)':'var(--indigo)'
            return (
              <div key={s.value}
                onDragOver={e=>{ e.preventDefault(); setDragOverCol(s.value) }}
                onDragLeave={e=>{ if(!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null) }}
                onDrop={e=>{ e.preventDefault(); handleDragDrop(s.value) }}
                style={{ background: isOver ? 'var(--surface-3)' : 'var(--surface-2)', borderRadius:12, overflow:'hidden', border: isOver ? `2px solid ${corCol}` : '1px solid var(--border)', transition:'border 0.15s, background 0.15s' }}>
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
                        <CardKanban key={t.id} tarefa={t} onClick={()=>abrirModal(t)} onDragStart={()=>setDragId(t.id)} onDragEnd={()=>{ setDragId(null); setDragOverCol(null) }} isDragging={dragId===t.id}/>
                      ))
                  }
                  {isOver && lista.length > 0 && <div style={{ height:4, borderRadius:99, background:corCol, opacity:0.4, margin:'4px 0' }}/>} 
                  <button onClick={()=>abrirModal('new')} style={{ width:'100%', padding:'8px', border:'1px dashed var(--border)', borderRadius:8, background:'transparent', cursor:'pointer', fontSize:12, color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginTop:4, transition:'all 0.15s' }}
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
          {selecionadas.size > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px',
              background:'var(--accent-glow)', borderBottom:'1px solid var(--accent)', borderRadius:'8px 8px 0 0' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--accent)' }}>
                {selecionadas.size} selecionada{selecionadas.size !== 1 ? 's' : ''}
              </span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowEditarLote(true)}
                style={{ display:'flex', alignItems:'center', gap:6 }}>
                <Layers size={13}/> Editar em lote
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelecionadas(new Set())}>
                <X size={12}/> Limpar seleção
              </button>
            </div>
          )}
          {tarefasFiltradas.length === 0
            ? <div className="empty-state"><p>Nenhuma tarefa {abaView === 'concluidas' ? 'concluída ' : ''}encontrada.</p></div>
            : <table>
                <thead>
                  <tr>
                    <th style={{ width:36 }}>
                      <input type="checkbox"
                        style={{ cursor:'pointer', accentColor:'var(--accent)' }}
                        checked={selecionadas.size === tarefasOrdenadas.length && tarefasOrdenadas.length > 0}
                        onChange={e => {
                          if (e.target.checked) setSelecionadas(new Set(tarefasOrdenadas.map(t => t.id)))
                          else setSelecionadas(new Set())
                        }}
                      />
                    </th>
                    {[
                      { col:'titulo',      label:'Tarefa' },
                      { col:'status',      label:'Status' },
                      { col:'prioridade',  label:'Prioridade' },
                      { col:'responsavel', label:'Responsável' },
                      { col:'data_prazo',  label:'Prazo' },
                    ].map(({col, label}) => (
                      <th key={col} onClick={()=>toggleSort(col)}
                        style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap', color: sortCol === col ? 'var(--accent)' : 'var(--text-muted)', fontWeight: sortCol === col ? 700 : 600, transition:'color 0.15s' }}
                        onMouseEnter={e=>e.currentTarget.style.color='var(--accent)'}
                        onMouseLeave={e=>e.currentTarget.style.color=sortCol===col?'var(--accent)':'var(--text-muted)'}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                          {label}
                          {sortCol === col ? sortDir === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/> : <ChevronUp size={12} style={{ opacity:0.2 }}/>}
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
                    const isSel = selecionadas.has(t.id)
                    return (
                      <tr key={t.id} style={{ cursor:'pointer', background: isSel ? 'var(--accent-glow)' : undefined }}
                        title={t.recorrencia_ativa ? 'Tarefa recorrente' : ''}>
                        <td onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSel}
                            style={{ cursor:'pointer', accentColor:'var(--accent)' }}
                            onChange={() => {
                              setSelecionadas(prev => {
                                const next = new Set(prev)
                                next.has(t.id) ? next.delete(t.id) : next.add(t.id)
                                return next
                              })
                            }}
                          />
                        </td>
                        <td onClick={()=>abrirModal(t)}>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{t.titulo}</div>
                          {t.descricao && <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', maxWidth:280 }}>{t.descricao}</div>}
                        </td>
                        <td onClick={()=>abrirModal(t)}><StatusBadge value={t.status}/></td>
                        <td onClick={()=>abrirModal(t)}><PrioridadeBadge value={t.prioridade}/></td>
                        <td onClick={()=>abrirModal(t)} style={{ fontSize:12, color:'var(--text-muted)' }}>{t.responsavel?.nome || '—'}</td>
                        <td onClick={()=>abrirModal(t)}><PrazoBadge data_prazo={t.data_prazo} status={t.status}/></td>
                        {algumaTemLivros && (
                          <td onClick={()=>abrirModal(t)} style={{ fontSize:12, color:'var(--text-muted)' }}>
                            {livrosCount > 0 ? <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><Book size={11}/> {livrosCount}</span> : '—'}
                          </td>
                        )}
                        <td onClick={()=>abrirModal(t)} style={{ minWidth:80 }}>
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
                            <select className="form-select" style={{ padding:'4px 8px', fontSize:11, width:'auto' }} value={t.status} onChange={e=>handleStatusChange(t, e.target.value)}>
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
        <ViewCalendario tarefas={tarefasFiltradas} onClickTarefa={t=>abrirModal(t)} onNovaTarefa={(data)=>abrirModal({ _dataPrazo: data })}/>
      )}

      {/* EQUIPE */}
      {view === 'equipe' && (
        <ViewEquipe
          tarefas={tarefas}
          usuarios={usuariosVisiveis}
          usuario={usuario}
          usuarioEfetivo={usuarioEfetivo}
          perfilEfetivo={perfilEfetivo}
          gruposPermitidos={gruposPermitidos}
          ehAdminVisual={ehAdminVisual}
          onOpen={t => abrirModal(t)}
        />
      )}

      {modal && (
        <ModalTarefa tarefa={modal === 'new' ? null : modal} usuarios={usuariosVisiveis} onSave={handleSave} onDelete={handleDelete} onClose={fecharModal}/>
      )}

      {showImportar && (
        <ModalImportar usuarios={usuariosVisiveis} onClose={()=>setShowImportar(false)} onImported={()=>{ carregar(); showToast('Tarefas importadas!') }}/>
      )}

      {showCriarLote && (
        <ModalCriarLote
          usuarios={usuariosVisiveis}
          grupoPrincipal={grupoPrincipal}
          onClose={() => setShowCriarLote(false)}
          onCreate={(n) => { carregar(); showToast(`${n} tarefa${n !== 1 ? 's' : ''} criada${n !== 1 ? 's' : ''}! 🎉`) }}
        />
      )}

      {showEditarLote && (
        <ModalEditarLote
          tarefasSelecionadas={tarefasOrdenadas.filter(t => selecionadas.has(t.id))}
          usuarios={usuariosVisiveis}
          onClose={() => setShowEditarLote(false)}
          onSave={() => { setShowEditarLote(false); setSelecionadas(new Set()); carregar(); showToast('Tarefas atualizadas!') }}
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
        <button onClick={()=>setMesRef(new Date(ano, mes-1, 1))} style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', cursor:'pointer', display:'flex', alignItems:'center', color:'var(--text-soft)' }}><ChevronLeft size={16}/></button>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <h2 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:17, color:'var(--text)', margin:0, textTransform:'capitalize' }}>{nomeMes}</h2>
          <button onClick={()=>setMesRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1))} style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:'var(--surface-2)', border:'1px solid var(--border)', cursor:'pointer', color:'var(--text-muted)', fontWeight:700 }}>Hoje</button>
        </div>
        <button onClick={()=>setMesRef(new Date(ano, mes+1, 1))} style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', cursor:'pointer', display:'flex', alignItems:'center', color:'var(--text-soft)' }}><ChevronRight size={16}/></button>
      </div>

      <div style={{ border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'var(--surface-2)', borderBottom:'1px solid var(--border)' }}>
          {diasSemana.map(d=><div key={d} style={{ padding:'10px 0', textAlign:'center', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{d}</div>)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
          {Array.from({length: primeiroDia}).map((_,i)=><div key={`v${i}`} style={{ minHeight:110, background:'var(--surface)', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', opacity:0.4 }}/>) }
          {Array.from({length: diasNoMes}).map((_,i)=>{
            const dia = i + 1
            const dataKey = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
            const tarefasDia = tarefasPorDia[dataKey] || []
            const isHoje = hoje.getDate()===dia && hoje.getMonth()===mes && hoje.getFullYear()===ano
            const col = (primeiroDia + i) % 7
            const isFimSemana = col === 0 || col === 6
            return (
              <div key={dia} onClick={()=>onNovaTarefa(dataKey)}
                style={{ minHeight:110, padding:'6px', cursor:'pointer', background: isFimSemana ? 'var(--surface-2)' : 'var(--surface)', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', transition:'background 0.1s' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--surface-3)'}
                onMouseLeave={e=>e.currentTarget.style.background=isFimSemana?'var(--surface-2)':'var(--surface)'}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', fontSize:12, fontWeight: isHoje ? 700 : 400, background: isHoje ? 'var(--accent)' : 'transparent', color: isHoje ? '#fff' : isFimSemana ? 'var(--text-muted)' : 'var(--text-soft)' }}>{dia}</span>
                  {tarefasDia.length > 0 && <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700 }}>{tarefasDia.length}</span>}
                </div>
                {tarefasDia.slice(0,3).map(t=>{
                  const c = corStatus(t.status)
                  const atrasada = t.status !== 'concluido' && isPast(new Date(dataKey+'T12:00:00')) && !isHoje
                  return (
                    <div key={t.id} onClick={e=>{e.stopPropagation();onClickTarefa(t)}}
                      style={{ padding:'2px 6px', borderRadius:4, marginBottom:2, cursor:'pointer', background: atrasada ? 'rgba(239,68,68,0.12)' : c.bg, border:`1px solid ${atrasada ? 'rgba(239,68,68,0.3)' : c.border}`, fontSize:10, fontWeight:600, color: atrasada ? '#f87171' : c.cor, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.4 }}>
                      {t.titulo}
                    </div>
                  )
                })}
                {tarefasDia.length > 3 && <div style={{ fontSize:9, color:'var(--text-muted)', fontWeight:700, paddingLeft:2 }}>+{tarefasDia.length - 3} mais</div>}
              </div>
            )
          })}
          {Array.from({length: (7 - (primeiroDia + diasNoMes) % 7) % 7}).map((_,i)=><div key={`f${i}`} style={{ minHeight:110, background:'var(--surface)', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', opacity:0.4 }}/>) }
        </div>
      </div>

      {semData.length > 0 && (
        <div style={{ marginTop:20 }}>
          <h3 style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Sem data definida ({semData.length})</h3>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {semData.map(t=>{
              const c = corStatus(t.status)
              return <div key={t.id} onClick={()=>onClickTarefa(t)} style={{ padding:'5px 12px', borderRadius:20, cursor:'pointer', background:c.bg, border:`1px solid ${c.border}`, fontSize:12, fontWeight:600, color:c.cor, transition:'opacity 0.1s' }} onMouseEnter={e=>e.currentTarget.style.opacity='0.7'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>{t.titulo}</div>
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── VIEW EQUIPE ─────────────────────────────────────────────
function ViewEquipe({ tarefas, usuarios, usuario, usuarioEfetivo, perfilEfetivo, gruposPermitidos, ehAdminVisual, onOpen }) {
  const hoje = new Date()
  hoje.setHours(0,0,0,0)

  const usuariosVisiveis = ehAdminVisual
    ? usuarios
    : usuarios.filter(u => {
        const grupoUsuario = PERFIL_GRUPO[u.perfil] || u.grupo || null
        return u.id === usuarioEfetivo?.id || (grupoUsuario && gruposPermitidos.has(grupoUsuario))
      })

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
          const atrasadas = ativas.filter(t => { if (!t.data_prazo) return false; return new Date(t.data_prazo + 'T12:00:00') < hoje })
          const pct = minhas.length > 0 ? Math.round((concluidas.length / minhas.length) * 100) : 0
          const porStatus = [
            { value:'a_fazer',      label:'A FAZER',      cor:'#6366f1' },
            { value:'em_andamento', label:'EM ANDAMENTO', cor:'#f59e0b' },
          ].map(s => ({ ...s, tarefas: ativas.filter(t => t.status === s.value) })).filter(s => s.tarefas.length > 0)

          const R = 22, CIRC = 2 * Math.PI * R
          const dash = (pct / 100) * CIRC
          const corPct = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#6366f1'

          return (
            <div key={u.id} style={{ width:280, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', flexShrink:0 }}>
              <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:38, height:38, borderRadius:'50%', background:corAvatar(u.nome), display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>{iniciais(u.nome)}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{u.nome}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'capitalize' }}>{u.grupo || u.perfil}</div>
                    </div>
                  </div>
                  <div style={{ position:'relative', width:54, height:54, flexShrink:0 }}>
                    <svg width="54" height="54" style={{ transform:'rotate(-90deg)' }}>
                      <circle cx="27" cy="27" r={R} fill="none" stroke="var(--border)" strokeWidth="4"/>
                      <circle cx="27" cy="27" r={R} fill="none" stroke={corPct} strokeWidth="4" strokeDasharray={`${dash} ${CIRC}`} strokeLinecap="round" style={{ transition:'stroke-dasharray 0.5s ease' }}/>
                    </svg>
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'var(--text)' }}>{pct}%</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <div style={{ flex:1, textAlign:'center', background:'var(--surface-2)', borderRadius:8, padding:'6px 4px' }}><div style={{ fontSize:18, fontWeight:700, color:'var(--text)' }}>{ativas.length}</div><div style={{ fontSize:10, color:'var(--text-muted)' }}>Ativas</div></div>
                  <div style={{ flex:1, textAlign:'center', background:'var(--surface-2)', borderRadius:8, padding:'6px 4px' }}><div style={{ fontSize:18, fontWeight:700, color:'#22c55e' }}>{concluidas.length}</div><div style={{ fontSize:10, color:'var(--text-muted)' }}>Feitas</div></div>
                  {atrasadas.length > 0 && (
                    <div style={{ flex:1, textAlign:'center', background:'rgba(239,68,68,0.1)', borderRadius:8, padding:'6px 4px', border:'1px solid rgba(239,68,68,0.2)' }}><div style={{ fontSize:18, fontWeight:700, color:'#ef4444' }}>{atrasadas.length}</div><div style={{ fontSize:10, color:'#ef4444' }}>Atrasadas</div></div>
                  )}
                </div>
              </div>
              <div style={{ padding:'10px 12px', maxHeight:400, overflowY:'auto' }}>
                {ativas.length === 0
                  ? <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:'24px 0', opacity:0.5 }}>Nenhuma tarefa ativa</div>
                  : porStatus.map(s => (
                      <div key={s.value} style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                          <div style={{ width:8, height:8, borderRadius:2, background:s.cor }}/>
                          <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em' }}>{s.label} ({s.tarefas.length})</span>
                        </div>
                        {s.tarefas.map(t => {
                          const atr = t.data_prazo && new Date(t.data_prazo + 'T12:00:00') < hoje
                          return (
                            <div key={t.id} onClick={() => onOpen(t)}
                              style={{ padding:'7px 10px', marginBottom:4, cursor:'pointer', background: atr ? 'rgba(239,68,68,0.06)' : 'var(--surface-2)', border: atr ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent', borderRadius:8, transition:'all 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.borderColor = atr ? '#ef4444' : 'var(--accent)'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = atr ? 'rgba(239,68,68,0.2)' : 'transparent'}>
                              <div style={{ fontSize:12, color:'var(--text)', fontWeight:500, marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1.4 }}>{t.titulo}</div>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                {t.prioridade && <PrioridadeBadge value={t.prioridade}/>} 
                                {t.data_prazo && (
                                  <span style={{ fontSize:10, display:'flex', alignItems:'center', gap:3, color: atr ? '#ef4444' : 'var(--text-muted)', fontWeight: atr ? 700 : 400 }}>
                                    <Calendar size={10}/>
                                    {atr ? `Atrasada ${Math.abs(differenceInDays(new Date(t.data_prazo + 'T12:00:00'), hoje))}d` : format(new Date(t.data_prazo + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
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
