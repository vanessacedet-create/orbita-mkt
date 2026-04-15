import { useState, useEffect, useMemo } from 'react'
import {
  getLivrosLancamento, getCampanhas,
  getDivulgadores, createDivulgador, updateDivulgador,
  getDivulgacaoLivro, addDivulgadoresLivro,
  updateDivulgacaoStatus, bulkUpdateDivulgacao, removeDivulgacaoLivro,
  getLancamentoLivros, addLancamentoParceiro, vincularDivulgadorComoParceiro
} from '../lib/supabase'
import {
  BookMarked, Search, Plus, X, ChevronDown, Check,
  Users, LayoutGrid, List, ArrowRight, Trash2,
  CheckSquare, Square, Inbox, TrendingUp, AlertCircle,
  Tag, BookOpen, Zap, Instagram, Youtube, Globe
} from 'lucide-react'

// ── CONSTANTES ────────────────────────────────────────────────
const STATUS_PIPELINE = [
  { value: 'encontrado',     label: 'Encontrado',     cor: '#06b6d4', bg: 'rgba(6,182,212,0.12)'   },
  { value: 'prospectado',    label: 'Prospectado',    cor: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  { value: 'negociando',     label: 'Negociando',     cor: '#f5a623', bg: 'rgba(245,166,35,0.12)'  },
  { value: 'acordo_fechado', label: 'Acordo fechado', cor: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  { value: 'ativo',          label: 'Ativo',          cor: '#3ecf8e', bg: 'rgba(62,207,142,0.12)'  },
  { value: 'sem_retorno',    label: 'Sem retorno',    cor: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  { value: 'sem_interesse',  label: 'Sem interesse',  cor: '#f56565', bg: 'rgba(245,101,101,0.12)' },
  { value: 'finalizado',     label: 'Finalizado',     cor: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
]

const PLATAFORMAS = ['Instagram','TikTok','YouTube','Blog','Twitter/X','Pinterest','Kwai']
const MESES_ORDEM = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function statusInfo(v) { return STATUS_PIPELINE.find(s => s.value === v) || STATUS_PIPELINE[0] }

function extrairMes(dataStr) {
  if (!dataStr) return null
  const d = new Date(dataStr + 'T12:00:00')
  if (isNaN(d)) return null
  return MESES_ORDEM[d.getMonth()]
}

function extrairAno(dataStr) {
  if (!dataStr) return null
  return new Date(dataStr + 'T12:00:00').getFullYear()
}

function fmtAudiencia(n) {
  if (!n) return null
  if (typeof n === 'object') { n = Object.values(n).reduce((a,b)=>a+(Number(b)||0),0) }
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n/1000).toFixed(0)}K`
  return String(n)
}

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type='success') { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }
  return [toast, show]
}

// ── STATUS SELECT ─────────────────────────────────────────────
function StatusSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const s = statusInfo(value)
  return (
    <div style={{position:'relative'}}>
      <button onClick={e=>{e.stopPropagation();setOpen(o=>!o)}}
        style={{display:'inline-flex',alignItems:'center',gap:6,background:s.bg,border:`1px solid ${s.cor}50`,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700,color:s.cor,cursor:'pointer',whiteSpace:'nowrap'}}>
        <span style={{width:5,height:5,borderRadius:'50%',background:s.cor}}/>{s.label}<ChevronDown size={10}/>
      </button>
      {open&&(<>
        <div style={{position:'fixed',inset:0,zIndex:49}} onClick={()=>setOpen(false)}/>
        <div style={{position:'absolute',top:'100%',left:0,marginTop:4,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:10,padding:4,zIndex:50,minWidth:175,boxShadow:'0 8px 24px rgba(0,0,0,0.4)'}}>
          {STATUS_PIPELINE.map(st=>(
            <button key={st.value} onClick={e=>{e.stopPropagation();onChange(st.value);setOpen(false)}}
              style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'7px 10px',borderRadius:7,border:'none',cursor:'pointer',background:value===st.value?st.bg:'transparent',color:value===st.value?st.cor:'var(--text-soft)',fontSize:12,fontWeight:value===st.value?700:400}}
              onMouseEnter={e=>{if(value!==st.value)e.currentTarget.style.background='var(--surface-3)'}}
              onMouseLeave={e=>{if(value!==st.value)e.currentTarget.style.background='transparent'}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:st.cor,flexShrink:0}}/>{st.label}
              {value===st.value&&<Check size={11} style={{marginLeft:'auto'}}/>}
            </button>
          ))}
        </div>
      </>)}
    </div>
  )
}

// ── MODAL: CADASTRAR DIVULGADOR ───────────────────────────────
function ModalNovoDivulgador({ onSave, onClose }) {
  const [form, setForm] = useState({
    nome:'', username:'', platforms:[], followers_count:'',
    engagement_rate:'', profile_url:'', contact_value:'',
    tipo_parceria:'', notes:''
  })
  const [saving, setSaving] = useState(false)

  function togglePlat(p) {
    setForm(f=>({...f, platforms: f.platforms.includes(p)?f.platforms.filter(x=>x!==p):[...f.platforms,p]}))
  }

  async function salvar() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      let followers_count = null
      if (form.followers_count.trim()) {
        try { followers_count = JSON.parse(form.followers_count) } catch {}
      }
      const payload = {
        nome:            form.nome.trim(),
        username:        form.username||null,
        platforms:       form.platforms.length ? form.platforms : null,
        followers_count: followers_count,
        engagement_rate: form.engagement_rate ? Number(form.engagement_rate) : null,
        profile_url:     form.profile_url||null,
        contact_value:   form.contact_value||null,
        tipo_parceria:   form.tipo_parceria||null,
        notes:           form.notes||null,
      }
      const novo = await createDivulgador(payload)
      onSave(novo)
      onClose()
    } catch(e){ console.error(e) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{maxWidth:520,maxHeight:'90vh',overflowY:'auto'}}>
        <div className="modal-header" style={{position:'sticky',top:0,background:'var(--surface)',zIndex:10,borderBottom:'1px solid var(--border)'}}>
          <h2 className="modal-title">Novo divulgador</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid" style={{padding:'16px 20px'}}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nome *</label>
              <input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Nome completo"/>
            </div>
            <div className="form-group">
              <label className="form-label">Username / @</label>
              <input className="form-input" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} placeholder="@usuario"/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Plataformas</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {PLATAFORMAS.map(p=>(
                <button key={p} type="button" onClick={()=>togglePlat(p)}
                  style={{padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',border:'2px solid',borderColor:form.platforms.includes(p)?'var(--accent)':'var(--border)',background:form.platforms.includes(p)?'var(--accent-glow)':'transparent',color:form.platforms.includes(p)?'var(--accent)':'var(--text-muted)'}}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Seguidores (JSON)</label>
              <input className="form-input" value={form.followers_count} onChange={e=>setForm(f=>({...f,followers_count:e.target.value}))} placeholder='{"Instagram": 10000}'/>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>Ex: {`{"Instagram": 10000, "TikTok": 5000}`}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Engajamento (%)</label>
              <input className="form-input" type="number" step="0.01" value={form.engagement_rate} onChange={e=>setForm(f=>({...f,engagement_rate:e.target.value}))} placeholder="3.75"/>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Link do perfil</label>
              <input className="form-input" value={form.profile_url} onChange={e=>setForm(f=>({...f,profile_url:e.target.value}))} placeholder="https://instagram.com/..."/>
            </div>
            <div className="form-group">
              <label className="form-label">Contato (WhatsApp/Email)</label>
              <input className="form-input" value={form.contact_value} onChange={e=>setForm(f=>({...f,contact_value:e.target.value}))} placeholder="+55 11 99999-9999"/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Tipo de parceria</label>
            <input className="form-input" value={form.tipo_parceria} onChange={e=>setForm(f=>({...f,tipo_parceria:e.target.value}))} placeholder="Ex: Livraria de influencer, Booktime..."/>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-textarea" rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Anotações sobre este divulgador..."/>
          </div>
        </div>
        <div className="form-actions" style={{padding:'12px 20px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',gap:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving||!form.nome.trim()}>
            {saving?'Salvando...':'Criar divulgador'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL: ADICIONAR DIVULGADORES AO LIVRO ────────────────────
function ModalAdicionarDivulgadores({ jaAdicionados, jaNoMes, livrosMesNomes, onSave, onClose, onNovo }) {
  const [todos, setTodos] = useState([])
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [selecionados, setSelecionados] = useState([])
  const [mostrarOcultos, setMostrarOcultos] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    getDivulgadores().then(d=>{setTodos(d||[]);setLoading(false)}).catch(()=>setLoading(false))
  },[])

  const tipos = useMemo(()=>[...new Set(todos.map(p=>p.tipo_parceria).filter(Boolean))],[todos])

  // Disponíveis = não estão neste livro, passam nos filtros de busca/tipo
  const filtrados = useMemo(()=>todos.filter(p=>{
    if(jaAdicionados.includes(p.id)) return false
    if(filtroTipo&&p.tipo_parceria!==filtroTipo) return false
    const q=search.toLowerCase()
    if(q&&!p.nome.toLowerCase().includes(q)&&!(p.username||'').toLowerCase().includes(q)) return false
    return true
  }),[todos,jaAdicionados,filtroTipo,search])

  // Separa em: livres (não estão em nenhum livro do mês) e já no mês (estão em outro livro do mês)
  const livres = filtrados.filter(p=>!jaNoMes.includes(p.id))
  const jaNoMesFiltrados = filtrados.filter(p=>jaNoMes.includes(p.id))

  const disponiveis = mostrarOcultos ? filtrados : livres

  function toggle(id){ setSelecionados(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]) }
  function toggleAll(){ setSelecionados(selecionados.length===disponiveis.length?[]:disponiveis.map(p=>p.id)) }

  function renderCard(p, oculto=false) {
    const sel=selecionados.includes(p.id)
    const aud=fmtAudiencia(p.followers_count)
    const livrosDoP = oculto ? (livrosMesNomes[p.id] || []) : []
    return (
      <div key={p.id} onClick={()=>toggle(p.id)}
        style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:8,cursor:'pointer',
          background:sel?'var(--accent-glow)':oculto?'var(--surface-2)':'transparent',
          border:`1px solid ${sel?'var(--accent)40':oculto?'var(--border)':'transparent'}`,
          marginBottom:4,transition:'all 0.15s',opacity:oculto&&!sel?0.8:1}}
        onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=oculto?'var(--surface-3)':'var(--surface-2)'}}
        onMouseLeave={e=>{e.currentTarget.style.background=sel?'var(--accent-glow)':oculto?'var(--surface-2)':'transparent'}}>
        {sel?<CheckSquare size={16} color="var(--accent)"/>:<Square size={16} color={oculto?"var(--amber)":"var(--text-muted)"}/>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:13,color:'var(--text)',display:'flex',alignItems:'center',gap:6}}>
            {p.nome}
            {oculto&&<span style={{fontSize:9,background:'rgba(245,166,35,0.15)',border:'1px solid rgba(245,166,35,0.3)',borderRadius:4,padding:'1px 5px',color:'var(--amber)',fontWeight:700,flexShrink:0}}>Já no mês</span>}
          </div>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>
            {p.username&&`${p.username} · `}{p.tipo_parceria||'Sem tipo'}{aud?` · ${aud}`:''}
            {p.platforms?.length>0&&` · ${p.platforms.slice(0,2).join(', ')}`}
          </div>
          {oculto&&livrosDoP.length>0&&(
            <div style={{fontSize:10,color:'var(--amber)',marginTop:2}}>
              Em: {livrosDoP.join(', ')}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{maxWidth:560,maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
        <div className="modal-header" style={{position:'sticky',top:0,background:'var(--surface)',zIndex:10,borderBottom:'1px solid var(--border)'}}>
          <div>
            <h2 className="modal-title">Adicionar divulgadores</h2>
            <p style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
              {selecionados.length>0?`${selecionados.length} selecionado${selecionados.length>1?'s':''}`:'Base de divulgadores'}
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        <div style={{padding:'12px 20px',borderBottom:'1px solid var(--border)',display:'flex',gap:8,alignItems:'center'}}>
          <div style={{position:'relative',flex:1}}>
            <Search size={13} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
            <input className="search-input" style={{paddingLeft:30,width:'100%'}} placeholder="Buscar por nome ou @handle..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          {tipos.length>0&&(
            <select className="form-select" style={{width:'auto',fontSize:12}} value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
              <option value="">Todos os tipos</option>
              {tipos.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <button className="btn btn-ghost btn-sm" onClick={()=>{onClose();onNovo()}} style={{flexShrink:0,display:'flex',alignItems:'center',gap:5}}>
            <Plus size={12}/> Novo
          </button>
        </div>

        <div style={{overflowY:'auto',flex:1,padding:'8px 12px'}}>
          {loading
            ?<div style={{padding:'32px 0',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>Carregando...</div>
            :disponiveis.length===0&&jaNoMesFiltrados.length===0
              ?<div style={{padding:'32px 0',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>
                  Nenhum divulgador disponível.{' '}
                  <button onClick={()=>{onClose();onNovo()}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontWeight:700,fontSize:13}}>Cadastrar novo?</button>
                </div>
              :<>
                {disponiveis.length>0&&(
                  <>
                    <button onClick={toggleAll} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',marginBottom:4,background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:12}}>
                      {selecionados.filter(id=>disponiveis.some(p=>p.id===id)).length===disponiveis.length&&disponiveis.length>0
                        ?<CheckSquare size={14} color="var(--accent)"/>:<Square size={14}/>}
                      Selecionar todos ({disponiveis.length})
                    </button>
                    {disponiveis.map(p=>renderCard(p, false))}
                  </>
                )}

                {jaNoMesFiltrados.length>0&&(
                  <div style={{marginTop:8}}>
                    <button onClick={()=>setMostrarOcultos(o=>!o)}
                      style={{display:'flex',alignItems:'center',gap:6,padding:'6px 8px',background:'none',border:'none',cursor:'pointer',fontSize:12,fontWeight:700,color:'var(--amber)',width:'100%',marginBottom:4}}>
                      {mostrarOcultos?<CheckSquare size={13} color="var(--amber)"/>:<Square size={13} color="var(--amber)"/>}
                      {mostrarOcultos?'Ocultar':'Mostrar'} {jaNoMesFiltrados.length} divulgador{jaNoMesFiltrados.length>1?'es':''} já em outro livro deste mês
                    </button>
                    {mostrarOcultos&&jaNoMesFiltrados.map(p=>renderCard(p, true))}
                  </div>
                )}
              </>
          }
        </div>

        <div style={{padding:'12px 20px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',gap:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={selecionados.length===0} onClick={()=>{onSave(selecionados);onClose()}}>
            <Plus size={14}/> Adicionar {selecionados.length>0?selecionados.length:''} divulgador{selecionados.length!==1?'es':''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL: ENVIAR PARA CAMPANHA ───────────────────────────────
function ModalEnviarCampanha({ divulgador, campanhas, onConfirmar, onClose }) {
  const [campanhaSel, setCampanhaSel] = useState('')
  const [livroSel, setLivroSel] = useState('')
  const [livros, setLivros] = useState([])
  const [loadingLivros, setLoadingLivros] = useState(false)
  const [saving, setSaving] = useState(false)

  const campanhasLancamento = campanhas.filter(c=>c.tipo==='Lançamento'&&c.status!=='cancelada')

  async function handleCampanha(id) {
    setCampanhaSel(id); setLivroSel('')
    if (!id) { setLivros([]); return }
    setLoadingLivros(true)
    try { const data = await getLancamentoLivros(id); setLivros(data||[]) }
    catch(e){ console.error(e) } finally { setLoadingLivros(false) }
  }

  async function confirmar() {
    if (!campanhaSel||!livroSel) return
    setSaving(true)
    try {
      // 1. Busca ou cria parceiro na tabela parceiros
      const parceiro = await vincularDivulgadorComoParceiro(divulgador)
      // 2. Adiciona o parceiro na campanha de lançamento selecionada como "confirmado"
      await addLancamentoParceiro(livroSel, parceiro.id)
      onConfirmar()
      onClose()
    } catch(e){ console.error(e) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{maxWidth:440,zIndex:200}}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Enviar para Campanhas</h2>
            <p style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
              <strong>{divulgador?.nome}</strong> será adicionado como <strong style={{color:'#f5a623'}}>Confirmado</strong>
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div style={{padding:'20px',display:'flex',flexDirection:'column',gap:16}}>
          <div className="form-group">
            <label className="form-label">Campanha de Lançamento</label>
            <select className="form-select" value={campanhaSel} onChange={e=>handleCampanha(e.target.value)}>
              <option value="">Selecionar campanha...</option>
              {campanhasLancamento.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          {campanhaSel&&(
            <div className="form-group">
              <label className="form-label">Livro dentro da campanha</label>
              {loadingLivros
                ?<div style={{fontSize:12,color:'var(--text-muted)'}}>Carregando livros...</div>
                :livros.length===0
                  ?<div style={{fontSize:12,color:'var(--text-muted)',background:'var(--surface-2)',borderRadius:8,padding:'10px 12px'}}>Nenhum livro nesta campanha</div>
                  :<select className="form-select" value={livroSel} onChange={e=>setLivroSel(e.target.value)}>
                    <option value="">Selecionar livro...</option>
                    {livros.map(ll=><option key={ll.id} value={ll.id}>{ll.livros?.titulo||'Sem título'}</option>)}
                  </select>
              }
            </div>
          )}
          {livroSel&&(
            <div style={{background:'rgba(62,207,142,0.08)',border:'1px solid rgba(62,207,142,0.25)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#3ecf8e',display:'flex',alignItems:'center',gap:6}}>
              <Zap size={12}/><strong>{divulgador?.nome}</strong> entrará como <strong>Confirmado</strong> na campanha.
              {divulgador?.parceiro_id&&<span style={{marginLeft:4,opacity:0.7}}>(já existe como parceiro no Orbita)</span>}
            </div>
          )}
        </div>
        <div style={{padding:'12px 20px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',gap:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!campanhaSel||!livroSel||saving} onClick={confirmar}>
            {saving?'Enviando...':'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL: DETALHE DO DIVULGADOR ──────────────────────────────
function ModalDetalhe({ entrada, campanhas, onStatusChange, onRemover, onClose, showToast }) {
  const d = entrada.divulgador
  const [nota, setNota] = useState(entrada.nota||'')
  const [statusLocal, setStatusLocal] = useState(entrada.status)
  const [modalEnviar, setModalEnviar] = useState(false)

  async function salvarNota() {
    try { await updateDivulgacaoStatus(entrada.id, statusLocal, nota) } catch(e){ console.error(e) }
  }

  async function handleStatusChange(novoStatus) {
    setStatusLocal(novoStatus)
    await onStatusChange(entrada.id, novoStatus, nota)
    if (novoStatus==='ativo') setModalEnviar(true)
  }

  return (
    <>
      <div className="modal-backdrop">
        <div className="modal" style={{maxWidth:460}}>
          <div className="modal-header">
            <div>
              <h2 className="modal-title">{d?.nome}</h2>
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:3}}>
                {d?.username&&<span style={{fontSize:12,color:'var(--text-muted)'}}>{d.username}</span>}
                {d?.platforms?.length>0&&(
                  <div style={{display:'flex',gap:4}}>
                    {d.platforms.slice(0,3).map(p=>(
                      <span key={p} style={{fontSize:10,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:4,padding:'1px 6px',color:'var(--text-muted)'}}>{p}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
          </div>

          <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
            {/* Info do divulgador */}
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {d?.tipo_parceria&&(
                <span style={{fontSize:12,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:6,padding:'3px 10px',color:'var(--text-soft)',display:'inline-flex',alignItems:'center',gap:5}}>
                  <Tag size={10}/>{d.tipo_parceria}
                </span>
              )}
              {d?.followers_count&&(
                <span style={{fontSize:12,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:6,padding:'3px 10px',color:'var(--text-soft)',display:'inline-flex',alignItems:'center',gap:5}}>
                  <Users size={10}/>{fmtAudiencia(d.followers_count)} seguidores
                </span>
              )}
              {d?.engagement_rate&&(
                <span style={{fontSize:12,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:6,padding:'3px 10px',color:'#3ecf8e',display:'inline-flex',alignItems:'center',gap:5}}>
                  {d.engagement_rate}% engaj.
                </span>
              )}
              {d?.contact_value&&(
                <span style={{fontSize:12,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:6,padding:'3px 10px',color:'var(--text-soft)'}}>
                  {d.contact_value}
                </span>
              )}
            </div>

            {/* Status */}
            <div>
              <label style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:8}}>Status no funil</label>
              <StatusSelect value={statusLocal} onChange={handleStatusChange}/>
              {statusLocal==='ativo'&&(
                <button onClick={()=>setModalEnviar(true)}
                  style={{marginTop:8,display:'inline-flex',alignItems:'center',gap:6,background:'rgba(62,207,142,0.12)',border:'1px solid rgba(62,207,142,0.3)',color:'#3ecf8e',borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                  <Zap size={13}/> Enviar para Campanhas
                </button>
              )}
              {statusLocal!=='ativo'&&(
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:6}}>
                  Marque como <strong style={{color:'#3ecf8e'}}>Ativo</strong> para enviar à campanha de Lançamento.
                </div>
              )}
            </div>

            {/* Nota */}
            <div>
              <label style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:8}}>Nota interna</label>
              <textarea className="form-textarea" rows={3} value={nota} onChange={e=>setNota(e.target.value)} onBlur={salvarNota} placeholder="Observações sobre este divulgador..."/>
            </div>

            {/* Link perfil */}
            {d?.profile_url&&(
              <a href={d.profile_url} target="_blank" rel="noreferrer"
                style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,color:'var(--accent)',textDecoration:'none'}}>
                <Globe size={12}/> Ver perfil
              </a>
            )}
          </div>

          <div style={{padding:'12px 20px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between'}}>
            <button className="btn btn-danger btn-sm" onClick={()=>{onRemover(entrada.id);onClose()}}>
              <Trash2 size={13}/> Remover do livro
            </button>
            <button className="btn btn-primary btn-sm" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>

      {modalEnviar&&(
        <ModalEnviarCampanha
          divulgador={d}
          campanhas={campanhas}
          onConfirmar={()=>showToast(`${d?.nome} adicionado como Confirmado na campanha!`)}
          onClose={()=>setModalEnviar(false)}
        />
      )}
    </>
  )
}

// ── KANBAN CARD ───────────────────────────────────────────────
function KanbanCard({ entrada, selecionado, onToggle, onClick }) {
  const d = entrada.divulgador
  const aud = fmtAudiencia(d?.followers_count)
  return (
    <div onClick={onClick}
      style={{background:selecionado?'var(--accent-glow)':'var(--surface)',border:`1px solid ${selecionado?'var(--accent)40':'var(--border)'}`,borderRadius:8,padding:'10px 12px',marginBottom:7,cursor:'pointer',transition:'border-color 0.15s'}}
      onMouseEnter={e=>{if(!selecionado)e.currentTarget.style.borderColor='var(--accent)'}}
      onMouseLeave={e=>{if(!selecionado)e.currentTarget.style.borderColor='var(--border)'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:6,marginBottom:4}}>
        <button onClick={e=>{e.stopPropagation();onToggle()}} style={{background:'none',border:'none',cursor:'pointer',padding:0,marginTop:1,flexShrink:0}}>
          {selecionado?<CheckSquare size={13} color="var(--accent)"/>:<Square size={13} color="var(--text-muted)"/>}
        </button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:12,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d?.nome}</div>
          {d?.username&&<div style={{fontSize:10,color:'var(--text-muted)'}}>{d.username}</div>}
        </div>
        {entrada.status==='ativo'&&(
          <span style={{fontSize:8,background:'rgba(62,207,142,0.15)',border:'1px solid rgba(62,207,142,0.3)',borderRadius:4,padding:'1px 5px',color:'#3ecf8e',flexShrink:0,display:'flex',alignItems:'center',gap:2}}>
            <Zap size={7}/>Ativo
          </span>
        )}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
        {d?.tipo_parceria&&<span style={{fontSize:9,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:4,padding:'1px 6px',color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:100}}>{d.tipo_parceria}</span>}
        {aud&&<span style={{fontSize:9,color:'var(--text-muted)',fontWeight:700,marginLeft:'auto'}}>{aud}</span>}
      </div>
      {entrada.nota&&<div style={{fontSize:10,color:'var(--text-muted)',marginTop:5,fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{entrada.nota}</div>}
    </div>
  )
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────
export default function CRMLiterario() {
  const [livros, setLivros] = useState([])
  const [campanhas, setCampanhas] = useState([])
  const [entradas, setEntradas] = useState([])
  const [livroSel, setLivroSel] = useState(null)
  const [mesAtivo, setMesAtivo] = useState(null)
  const [anoAtivo, setAnoAtivo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingEntradas, setLoadingEntradas] = useState(false)
  const [entradasMes, setEntradasMes] = useState([]) // todas entradas dos livros do mês
  const [viewMode, setViewMode] = useState('kanban')
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [selecionados, setSelecionados] = useState([])
  const [bulkStatus, setBulkStatus] = useState('')
  const [modalAdicionar, setModalAdicionar] = useState(false)
  const [modalNovo, setModalNovo] = useState(false)
  const [modalDetalhe, setModalDetalhe] = useState(null)
  const [toast, showToast] = useToast()

  useEffect(()=>{
    Promise.all([
      getLivrosLancamento(),
      getCampanhas()
    ]).then(([livrosData, campanhasData])=>{
      setLivros(livrosData||[])
      setCampanhas(campanhasData||[])
      const hoje = new Date()
      const mesHoje = MESES_ORDEM[hoje.getMonth()]
      const anoHoje = hoje.getFullYear()
      const anosDisp = [...new Set((livrosData||[]).map(l=>extrairAno(l.data_lancamento)).filter(Boolean))].sort((a,b)=>b-a)
      const anoInicial = anosDisp.includes(anoHoje) ? anoHoje : anosDisp[0]
      const mesesDisp = [...new Set((livrosData||[]).filter(l=>extrairAno(l.data_lancamento)===anoInicial).map(l=>extrairMes(l.data_lancamento)).filter(Boolean))]
      const mesInicial = mesesDisp.includes(mesHoje) ? mesHoje : mesesDisp[0]
      setAnoAtivo(anoInicial)
      setMesAtivo(mesInicial)
      const primeiro = (livrosData||[]).find(l=>extrairMes(l.data_lancamento)===mesInicial&&extrairAno(l.data_lancamento)===anoInicial)
      if (primeiro) setLivroSel(primeiro)
    }).catch(console.error).finally(()=>setLoading(false))
  },[])

  useEffect(()=>{
    if (!livroSel) return
    setLoadingEntradas(true)
    setEntradas([])
    setSelecionados([])
    getDivulgacaoLivro(livroSel.id)
      .then(data=>setEntradas(data||[]))
      .catch(e=>{
        console.error('Erro ao buscar divulgações:', e)
        showToast('Erro ao carregar divulgadores. Verifique o console.','error')
      })
      .finally(()=>setLoadingEntradas(false))
  },[livroSel])

  // Carrega entradas de todos os livros do mês (para filtrar modal)
  useEffect(()=>{
    if(!livrosMes.length) return
    Promise.all(livrosMes.map(l=>getDivulgacaoLivro(l.id)))
      .then(resultados=>{
        const todas = resultados.flatMap((r,i)=>
          (r||[]).map(e=>({...e, _livroTitulo: livrosMes[i].titulo, _livroId: livrosMes[i].id}))
        )
        setEntradasMes(todas)
      })
      .catch(console.error)
  },[livrosMes])

  const anosDisponiveis = useMemo(()=>
    [...new Set(livros.map(l=>extrairAno(l.data_lancamento)).filter(Boolean))].sort((a,b)=>b-a),
  [livros])

  const mesesDisponiveis = useMemo(()=>
    MESES_ORDEM.filter(m=>livros.some(l=>extrairMes(l.data_lancamento)===m&&extrairAno(l.data_lancamento)===anoAtivo)),
  [livros,anoAtivo])

  const livrosMes = useMemo(()=>
    livros.filter(l=>extrairMes(l.data_lancamento)===mesAtivo&&extrairAno(l.data_lancamento)===anoAtivo),
  [livros,mesAtivo,anoAtivo])

  const entradasFiltradas = useMemo(()=>entradas.filter(e=>{
    if(filtroStatus&&e.status!==filtroStatus) return false
    const q=search.toLowerCase()
    if(q&&!e.divulgador?.nome?.toLowerCase().includes(q)&&!(e.divulgador?.username||'').toLowerCase().includes(q)) return false
    return true
  }),[entradas,filtroStatus,search])

  const porStatus = useMemo(()=>{
    const g={}
    for(const st of STATUS_PIPELINE) g[st.value]=entradasFiltradas.filter(e=>e.status===st.value)
    return g
  },[entradasFiltradas])

  const stats = useMemo(()=>({
    total:entradas.length,
    ativos:entradas.filter(e=>e.status==='ativo').length,
    finalizados:entradas.filter(e=>e.status==='finalizado').length,
    pendentes:entradas.filter(e=>['encontrado','prospectado','negociando','acordo_fechado'].includes(e.status)).length,
  }),[entradas])

  async function handleAdicionarDivulgadores(ids) {
    try {
      const novas = await addDivulgadoresLivro(livroSel.id, ids)
      setEntradas(prev=>[...prev,...(novas||[])])
      showToast(`${ids.length} divulgador${ids.length!==1?'es':''} adicionado${ids.length!==1?'s':''}!`)
    } catch(e){ showToast('Erro ao adicionar','error') }
  }

  function handleNovoDivulgador(novo) {
    showToast(`${novo.nome} cadastrado! Agora adicione-o ao livro.`)
    setModalAdicionar(true)
  }

  async function handleStatusChange(entradaId, novoStatus, nota) {
    try {
      await updateDivulgacaoStatus(entradaId, novoStatus, nota)
      setEntradas(prev=>prev.map(e=>e.id===entradaId?{...e,status:novoStatus}:e))
      showToast(`Status → ${statusInfo(novoStatus).label}`)
    } catch(e){ showToast('Erro ao atualizar','error') }
  }

  async function handleRemover(entradaId) {
    try {
      await removeDivulgacaoLivro(entradaId)
      setEntradas(prev=>prev.filter(e=>e.id!==entradaId))
      showToast('Divulgador removido do livro')
    } catch(e){ showToast('Erro ao remover','error') }
  }

  async function handleBulkStatus() {
    if(!bulkStatus||selecionados.length===0) return
    try {
      await bulkUpdateDivulgacao(selecionados,bulkStatus)
      setEntradas(prev=>prev.map(e=>selecionados.includes(e.id)?{...e,status:bulkStatus}:e))
      showToast(`${selecionados.length} divulgadores → ${statusInfo(bulkStatus).label}`)
      setSelecionados([]);setBulkStatus('')
    } catch(e){ showToast('Erro','error') }
  }

  function toggleSelecionar(id){ setSelecionados(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]) }
  function toggleTodos(){ setSelecionados(selecionados.length===entradasFiltradas.length?[]:entradasFiltradas.map(e=>e.id)) }

  const jaAdicionados = entradas.map(e=>e.divulgador_id).filter(Boolean)

  // Divulgadores já em outro livro do mesmo mês
  const { jaNoMes, livrosMesNomes } = useMemo(()=>{
    const ids = new Set()
    const nomes = {}
    entradasMes
      .filter(e=>e._livroId !== livroSel?.id)
      .forEach(e=>{
        if(!e.divulgador_id) return
        ids.add(e.divulgador_id)
        if(!nomes[e.divulgador_id]) nomes[e.divulgador_id]=[]
        if(!nomes[e.divulgador_id].includes(e._livroTitulo))
          nomes[e.divulgador_id].push(e._livroTitulo)
      })
    return { jaNoMes:[...ids], livrosMesNomes:nomes }
  },[entradasMes, livroSel])

  if(loading) return <div className="loading"><div className="spinner"/></div>

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>

      {/* ── SIDEBAR ── */}
      <aside style={{width:260,flexShrink:0,background:'var(--surface)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'16px 16px 12px',borderBottom:'1px solid var(--border)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <BookMarked size={16} color="var(--accent)"/>
            <span style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:13,color:'var(--text)'}}>Livros com lançamento</span>
          </div>
          {/* Seletor de ano */}
          <div style={{display:'flex',gap:4,marginBottom:8}}>
            {anosDisponiveis.map(ano=>(
              <button key={ano} onClick={()=>{
                setAnoAtivo(ano)
                const mesesDoAno=[...new Set(livros.filter(l=>extrairAno(l.data_lancamento)===ano).map(l=>extrairMes(l.data_lancamento)).filter(Boolean))]
                const hoje=new Date()
                const mesHoje=MESES_ORDEM[hoje.getMonth()]
                const novoMes=mesesDoAno.includes(mesHoje)?mesHoje:mesesDoAno[0]
                setMesAtivo(novoMes)
                const primeiro=livros.find(l=>extrairAno(l.data_lancamento)===ano&&extrairMes(l.data_lancamento)===novoMes)
                if(primeiro) setLivroSel(primeiro)
              }}
                style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,cursor:'pointer',border:'1px solid',borderColor:anoAtivo===ano?'var(--accent)':'var(--border)',background:anoAtivo===ano?'var(--accent-glow)':'transparent',color:anoAtivo===ano?'var(--accent)':'var(--text-muted)',transition:'all 0.15s'}}>
                {ano}
              </button>
            ))}
          </div>
          {/* Seletor de mês */}
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {mesesDisponiveis.map(mes=>(
              <button key={mes} onClick={()=>{
                setMesAtivo(mes)
                const primeiro=livros.find(l=>extrairMes(l.data_lancamento)===mes&&extrairAno(l.data_lancamento)===anoAtivo)
                if(primeiro) setLivroSel(primeiro)
              }}
                style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,cursor:'pointer',border:'1px solid',borderColor:mesAtivo===mes?'var(--accent)':'var(--border)',background:mesAtivo===mes?'var(--accent-glow)':'transparent',color:mesAtivo===mes?'var(--accent)':'var(--text-muted)',transition:'all 0.15s'}}>
                {mes}
              </button>
            ))}
          </div>
        </div>

        <div style={{overflowY:'auto',flex:1,padding:'8px'}}>
          {livrosMes.length===0
            ?<div style={{padding:'20px 10px',textAlign:'center',fontSize:12,color:'var(--text-muted)'}}>Nenhum livro neste mês</div>
            :livrosMes.map(l=>{
              const ativo=livroSel?.id===l.id
              const dataFmt=l.data_lancamento?new Date(l.data_lancamento+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}):''
              return (
                <button key={l.id} onClick={()=>setLivroSel(l)}
                  style={{display:'block',width:'100%',textAlign:'left',padding:'10px 12px',borderRadius:8,cursor:'pointer',border:`1px solid ${ativo?'var(--accent)40':'transparent'}`,background:ativo?'var(--accent-glow)':'transparent',marginBottom:3,transition:'all 0.15s'}}
                  onMouseEnter={e=>{if(!ativo)e.currentTarget.style.background='var(--surface-2)'}}
                  onMouseLeave={e=>{if(!ativo)e.currentTarget.style.background=ativo?'var(--accent-glow)':'transparent'}}>
                  <div style={{fontWeight:700,fontSize:13,color:ativo?'var(--accent)':'var(--text)',marginBottom:2,lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.titulo}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.autor}</div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    {l.editora&&<span style={{fontSize:10,background:'var(--surface-3)',borderRadius:4,padding:'1px 6px',color:'var(--text-muted)'}}>{l.editora}</span>}
                    {dataFmt&&<span style={{fontSize:10,color:'var(--text-muted)'}}>{dataFmt}</span>}
                  </div>
                  {ativo&&<div style={{fontSize:10,color:'var(--accent)',marginTop:4}}>{entradas.length} divulgador{entradas.length!==1?'es':''}</div>}
                </button>
              )
            })
          }
        </div>
      </aside>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Header */}
        <div style={{padding:'16px 24px',borderBottom:'1px solid var(--border)',background:'var(--surface)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14}}>
            <div>
              <h1 style={{fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:18,color:'var(--text)',margin:0,lineHeight:1.2}}>
                {livroSel?.titulo||'Selecione um livro'}
              </h1>
              {livroSel&&(
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:3}}>
                  {livroSel.autor&&`${livroSel.autor} · `}
                  {livroSel.editora&&`${livroSel.editora} · `}
                  {livroSel.data_lancamento&&`Lançamento: ${new Date(livroSel.data_lancamento+'T12:00:00').toLocaleDateString('pt-BR')}`}
                </div>
              )}
            </div>
            {livroSel&&(
              <div style={{display:'flex',gap:8,flexShrink:0}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>setModalNovo(true)} style={{display:'flex',alignItems:'center',gap:5}}>
                  <Plus size={13}/> Novo divulgador
                </button>
                <button className="btn btn-primary btn-sm" onClick={()=>setModalAdicionar(true)} style={{display:'flex',alignItems:'center',gap:5}}>
                  <Users size={13}/> Adicionar ao livro
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
            {[
              {label:'Total',value:stats.total,cor:'var(--text-soft)',icon:Users},
              {label:'Ativos',value:stats.ativos,cor:'#3ecf8e',icon:TrendingUp},
              {label:'Finalizados',value:stats.finalizados,cor:'#a78bfa',icon:Check},
              {label:'Em negociação',value:stats.pendentes,cor:'#f5a623',icon:AlertCircle},
            ].map(({label,value,cor,icon:Icon})=>(
              <div key={label} style={{display:'flex',alignItems:'center',gap:8,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 12px'}}>
                <Icon size={13} color={cor}/>
                <span style={{fontSize:13,fontWeight:700,color:cor}}>{value}</span>
                <span style={{fontSize:11,color:'var(--text-muted)'}}>{label}</span>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <div style={{position:'relative'}}>
              <Search size={13} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
              <input className="search-input" style={{paddingLeft:30,width:200}} placeholder="Buscar divulgador..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}} value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {STATUS_PIPELINE.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {(filtroStatus||search)&&(
              <button className="btn btn-ghost btn-sm" onClick={()=>{setFiltroStatus('');setSearch('')}}>
                <X size={12}/> Limpar
              </button>
            )}
            <div style={{marginLeft:'auto',display:'flex',gap:4}}>
              <button className={`btn btn-sm ${viewMode==='kanban'?'btn-primary':'btn-ghost'}`} onClick={()=>setViewMode('kanban')} title="Kanban"><LayoutGrid size={14}/></button>
              <button className={`btn btn-sm ${viewMode==='lista'?'btn-primary':'btn-ghost'}`} onClick={()=>setViewMode('lista')} title="Lista"><List size={14}/></button>
            </div>
          </div>

          {/* Bulk actions */}
          {selecionados.length>0&&(
            <div style={{display:'flex',alignItems:'center',gap:10,marginTop:10,background:'var(--accent-glow)',border:'1px solid var(--accent)40',borderRadius:8,padding:'8px 14px'}}>
              <span style={{fontSize:12,fontWeight:700,color:'var(--accent)'}}>{selecionados.length} selecionado{selecionados.length>1?'s':''}</span>
              <ArrowRight size={12} color="var(--text-muted)"/>
              <select className="form-select" style={{width:'auto',fontSize:12,padding:'4px 8px'}} value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)}>
                <option value="">Mover para...</option>
                {STATUS_PIPELINE.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" disabled={!bulkStatus} onClick={handleBulkStatus}>Aplicar</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>setSelecionados([])}><X size={12}/> Cancelar</button>
            </div>
          )}
        </div>

        {/* ── KANBAN ── */}
        {viewMode==='kanban'&&(
          <div style={{flex:1,overflowX:'auto',overflowY:'hidden',padding:'16px 24px'}}>
            {loadingEntradas
              ?<div className="loading"><div className="spinner"/></div>
              :<div style={{display:'flex',gap:12,height:'100%',minWidth:'max-content'}}>
                {STATUS_PIPELINE.map(st=>{
                  const items=porStatus[st.value]||[]
                  return (
                    <div key={st.value} style={{width:210,flexShrink:0,display:'flex',flexDirection:'column'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8,padding:'6px 10px',background:st.bg,border:`1px solid ${st.cor}30`,borderRadius:8}}>
                        <span style={{width:8,height:8,borderRadius:'50%',background:st.cor}}/>
                        <span style={{fontSize:11,fontWeight:700,color:st.cor,flex:1}}>{st.label}</span>
                        <span style={{fontSize:11,color:st.cor,background:'var(--surface)',border:`1px solid ${st.cor}30`,borderRadius:20,padding:'1px 7px'}}>{items.length}</span>
                      </div>
                      <div style={{flex:1,overflowY:'auto',paddingRight:2}}>
                        {items.length===0
                          ?<div style={{padding:'16px 10px',textAlign:'center',fontSize:11,color:'var(--text-muted)'}}>Vazio</div>
                          :items.map(entrada=>(
                            <KanbanCard key={entrada.id} entrada={entrada}
                              selecionado={selecionados.includes(entrada.id)}
                              onToggle={()=>toggleSelecionar(entrada.id)}
                              onClick={()=>setModalDetalhe(entrada)}/>
                          ))
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            }
          </div>
        )}

        {/* ── LISTA ── */}
        {viewMode==='lista'&&(
          <div style={{flex:1,overflowY:'auto',padding:'16px 24px'}}>
            {loadingEntradas
              ?<div className="loading"><div className="spinner"/></div>
              :entradasFiltradas.length===0
                ?<div style={{padding:'48px 0',textAlign:'center',color:'var(--text-muted)'}}>
                    <Inbox size={32} style={{marginBottom:10,opacity:0.4}}/>
                    <div style={{fontSize:14}}>Nenhum divulgador neste livro</div>
                    <div style={{fontSize:12,marginTop:4}}>Clique em "Adicionar ao livro" para começar</div>
                  </div>
                :<table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{borderBottom:'1px solid var(--border)'}}>
                      <th style={{padding:'8px 12px',width:32}}>
                        <button onClick={toggleTodos} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}>
                          {selecionados.length===entradasFiltradas.length&&entradasFiltradas.length>0?<CheckSquare size={14} color="var(--accent)"/>:<Square size={14}/>}
                        </button>
                      </th>
                      {['Divulgador','Handle','Tipo','Seguidores','Status',''].map(h=>(
                        <th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entradasFiltradas.map(entrada=>{
                      const d=entrada.divulgador
                      const sel=selecionados.includes(entrada.id)
                      const aud=fmtAudiencia(d?.followers_count)
                      return (
                        <tr key={entrada.id} style={{borderBottom:'1px solid var(--border)',background:sel?'var(--accent-glow)':'transparent',transition:'background 0.1s'}}
                          onMouseEnter={e=>{if(!sel)e.currentTarget.style.background='var(--surface-2)'}}
                          onMouseLeave={e=>{e.currentTarget.style.background=sel?'var(--accent-glow)':'transparent'}}>
                          <td style={{padding:'10px 12px'}}>
                            <button onClick={()=>toggleSelecionar(entrada.id)} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}>
                              {sel?<CheckSquare size={14} color="var(--accent)"/>:<Square size={14} color="var(--text-muted)"/>}
                            </button>
                          </td>
                          <td style={{padding:'10px 12px',fontWeight:700,fontSize:13,color:'var(--text)',cursor:'pointer'}} onClick={()=>setModalDetalhe(entrada)}>{d?.nome}</td>
                          <td style={{padding:'10px 12px',fontSize:12,color:'var(--text-muted)'}}>{d?.username||'—'}</td>
                          <td style={{padding:'10px 12px',fontSize:12,color:'var(--text-soft)'}}>{d?.tipo_parceria||'—'}</td>
                          <td style={{padding:'10px 12px',fontSize:12,color:'var(--text-soft)',fontWeight:700}}>{aud||'—'}</td>
                          <td style={{padding:'10px 12px'}}>
                            <StatusSelect value={entrada.status} onChange={v=>handleStatusChange(entrada.id,v)}/>
                          </td>
                          <td style={{padding:'10px 12px'}}>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>setModalDetalhe(entrada)}><BookOpen size={13}/></button>
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
      {modalNovo&&(
        <ModalNovoDivulgador
          onSave={handleNovoDivulgador}
          onClose={()=>setModalNovo(false)}
        />
      )}

      {modalAdicionar&&livroSel&&(
        <ModalAdicionarDivulgadores
          jaAdicionados={jaAdicionados}
          jaNoMes={jaNoMes}
          livrosMesNomes={livrosMesNomes}
          onSave={handleAdicionarDivulgadores}
          onClose={()=>setModalAdicionar(false)}
          onNovo={()=>setModalNovo(true)}
        />
      )}

      {modalDetalhe&&(
        <ModalDetalhe
          entrada={modalDetalhe}
          campanhas={campanhas}
          onStatusChange={handleStatusChange}
          onRemover={handleRemover}
          onClose={()=>setModalDetalhe(null)}
          showToast={showToast}
        />
      )}

      {toast&&<div className={`toast ${toast.type}`} style={{position:'fixed',bottom:24,right:24,zIndex:9999}}>{toast.msg}</div>}
    </div>
  )
}
