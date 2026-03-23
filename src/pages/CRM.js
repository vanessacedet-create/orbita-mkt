import { useEffect, useState } from 'react'
import {
  getParceiros,
  getCRMParceiros, updateParceiroCRM, getStatusHistory, addStatusHistory,
} from '../lib/supabase'
import {
  Users, Plus, X, ChevronRight, Clock, ExternalLink,
  Instagram, Youtube, Search, ArrowRight
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── PIPELINE ───────────────────────────────────────────────
const PIPELINE = [
  { value: 'prospected',  label: 'Prospectado',   cor: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  { value: 'qualified',   label: 'Qualificado',   cor: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  { value: 'negotiating', label: 'Negociando',    cor: '#eab308', bg: 'rgba(234,179,8,0.12)'   },
  { value: 'agreed',      label: 'Acordo fechado',cor: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  { value: 'active',      label: 'Ativo',         cor: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  { value: 'paused',      label: 'Pausado',       cor: '#eab308', bg: 'rgba(234,179,8,0.12)'   },
  { value: 'closed',      label: 'Encerrado',     cor: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
]

const PLATAFORMAS = ['Instagram','TikTok','YouTube','Blog','Twitter/X','Pinterest','Kwai']
const ORIGENS = [
  { value: 'active_search', label: 'Busca ativa' },
  { value: 'referral',      label: 'Indicação'   },
  { value: 'inbound',       label: 'Inbound'     },
]
const MODELOS = [
  { value: '1', label: '1 — Livraria Personalizada' },
  { value: '2', label: '2 — Book Time (cupom)'      },
  { value: '3', label: '3 — Institucional'           },
]

function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type='success') { setT({msg,type}); setTimeout(()=>setT(null),4000) }
  return [t, show]
}

function pipelineInfo(v) { return PIPELINE.find(p=>p.value===v) || PIPELINE[0] }

// ── MODAL DETALHE PARCEIRO CRM ─────────────────────────────
function ModalParceiroCRM({ parceiro: inicial, todos, onSave, onClose }) {
  const [parceiro, setParceiro] = useState(inicial)
  const [history, setHistory]   = useState([])
  const [aba, setAba]           = useState('perfil') // perfil | pipeline | historico
  const [form, setForm]         = useState({
    username:     inicial.username||'',
    platforms:    inicial.platforms||[],
    followers:    inicial.followers_count ? JSON.stringify(inicial.followers_count) : '',
    engagement_rate: inicial.engagement_rate||'',
    profile_url:  inicial.profile_url||'',
    contact_value: inicial.contact_value||'',
    source:       inicial.source||'',
    referred_by:  inicial.referred_by||'',
    library_url:  inicial.library_url||'',
    coupon_code:  inicial.coupon_code||'',
    model:        inicial.model||'',
    notes:        inicial.notes||'',
  })
  const [novoStatus, setNovoStatus] = useState('')
  const [motivo, setMotivo]         = useState('')
  const [saving, setSaving]         = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [toast, showToast]          = useToast()

  useEffect(() => {
    getStatusHistory(parceiro.id).then(setHistory).catch(console.error)
  }, [parceiro.id])

  async function salvarPerfil() {
    setSaving(true)
    try {
      let followers_count = null
      if (form.followers.trim()) {
        try { followers_count = JSON.parse(form.followers) } catch {}
      }
      const payload = {
        username:        form.username||null,
        platforms:       form.platforms,
        followers_count: followers_count,
        engagement_rate: form.engagement_rate ? Number(form.engagement_rate) : null,
        profile_url:     form.profile_url||null,
        contact_value:   form.contact_value||null,
        source:          form.source||null,
        referred_by:     form.referred_by||null,
        library_url:     form.library_url||null,
        coupon_code:     form.coupon_code||null,
        model:           form.model ? Number(form.model) : null,
        notes:           form.notes||null,
      }
      const upd = await updateParceiroCRM(parceiro.id, payload)
      setParceiro(upd)
      onSave(upd)
      showToast('Perfil atualizado!')
    } catch(e) { showToast('Erro ao salvar','error') } finally { setSaving(false) }
  }

  async function avancarStatus() {
    if (!novoStatus) return
    setSavingStatus(true)
    try {
      await addStatusHistory(parceiro.id, novoStatus, motivo)
      const hist = await getStatusHistory(parceiro.id)
      setHistory(hist)
      const upd = await updateParceiroCRM(parceiro.id, { current_status: novoStatus })
      setParceiro(upd)
      onSave(upd)
      setNovoStatus(''); setMotivo('')
      showToast('Status atualizado!')
    } catch(e) { showToast('Erro','error') } finally { setSavingStatus(false) }
  }

  const statusAtual = parceiro.current_status || 'prospected'
  const stInfo = pipelineInfo(statusAtual)

  function togglePlataforma(p) {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x=>x!==p) : [...f.platforms, p]
    }))
  }

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:580,maxHeight:'90vh',overflowY:'auto'}}>
        <div className="modal-header" style={{position:'sticky',top:0,background:'var(--surface)',zIndex:10,borderBottom:'1px solid var(--border)'}}>
          <div>
            <h2 className="modal-title" style={{marginBottom:4}}>{parceiro.nome}</h2>
            <span style={{display:'inline-flex',alignItems:'center',gap:5,background:stInfo.bg,border:`1px solid ${stInfo.cor}40`,borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700,color:stInfo.cor}}>
              {stInfo.label}
            </span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        {/* Abas */}
        <div style={{display:'flex',gap:4,padding:'12px 0 0',borderBottom:'1px solid var(--border)',marginBottom:16}}>
          {[{v:'perfil',l:'Perfil CRM'},{v:'pipeline',l:'Pipeline'},{v:'historico',l:`Histórico (${history.length})`}].map(({v,l})=>(
            <button key={v} onClick={()=>setAba(v)}
              className={`btn btn-sm ${aba===v?'btn-primary':'btn-ghost'}`}
              style={{borderRadius:'6px 6px 0 0'}}>
              {l}
            </button>
          ))}
        </div>

        {/* ── ABA PERFIL ── */}
        {aba==='perfil' && (
          <div className="form-grid">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Username / @</label>
                <input className="form-input" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} placeholder="@usuario"/>
              </div>
              <div className="form-group">
                <label className="form-label">Link do perfil</label>
                <input className="form-input" value={form.profile_url} onChange={e=>setForm(f=>({...f,profile_url:e.target.value}))} placeholder="https://instagram.com/..."/>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Plataformas</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {PLATAFORMAS.map(p=>(
                  <button key={p} type="button" onClick={()=>togglePlataforma(p)}
                    style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',border:'2px solid',
                      borderColor:form.platforms.includes(p)?'var(--accent)':'var(--border)',
                      background:form.platforms.includes(p)?'var(--accent-glow)':'transparent',
                      color:form.platforms.includes(p)?'var(--accent)':'var(--text-muted)',transition:'all 0.15s'}}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Seguidores por plataforma</label>
              <input className="form-input" value={form.followers}
                onChange={e=>setForm(f=>({...f,followers:e.target.value}))}
                placeholder='{"Instagram": 10000, "TikTok": 5000}'/>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>Formato JSON: {`{"Instagram": 10000}`}</div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Taxa de engajamento (%)</label>
                <input className="form-input" type="number" step="0.01" value={form.engagement_rate}
                  onChange={e=>setForm(f=>({...f,engagement_rate:e.target.value}))} placeholder="3.75"/>
              </div>
              <div className="form-group">
                <label className="form-label">Modelo de parceria</label>
                <select className="form-select" value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))}>
                  <option value="">Selecionar...</option>
                  {MODELOS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contato (WhatsApp/Email)</label>
                <input className="form-input" value={form.contact_value}
                  onChange={e=>setForm(f=>({...f,contact_value:e.target.value}))} placeholder="+55 11 99999-9999"/>
              </div>
              <div className="form-group">
                <label className="form-label">Origem</label>
                <select className="form-select" value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))}>
                  <option value="">Selecionar...</option>
                  {ORIGENS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {form.source==='referral' && (
              <div className="form-group">
                <label className="form-label">Indicado por</label>
                <select className="form-select" value={form.referred_by} onChange={e=>setForm(f=>({...f,referred_by:e.target.value}))}>
                  <option value="">Selecionar parceiro...</option>
                  {todos.filter(p=>p.id!==parceiro.id).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
            )}

            {(form.model==='1'||!form.model) && (
              <div className="form-group">
                <label className="form-label">URL da Livraria Personalizada</label>
                <input className="form-input" value={form.library_url}
                  onChange={e=>setForm(f=>({...f,library_url:e.target.value}))} placeholder="https://..."/>
              </div>
            )}

            {form.model==='2' && (
              <div className="form-group">
                <label className="form-label">Código do Cupom (Book Time)</label>
                <input className="form-input" value={form.coupon_code}
                  onChange={e=>setForm(f=>({...f,coupon_code:e.target.value}))} placeholder="BOOKTIME123"/>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Observações CRM</label>
              <textarea className="form-textarea" rows={3} value={form.notes}
                onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Anotações sobre este parceiro..."/>
            </div>

            <div style={{display:'flex',justifyContent:'flex-end'}}>
              <button className="btn btn-primary" onClick={salvarPerfil} disabled={saving}>
                {saving?'Salvando...':'Salvar perfil'}
              </button>
            </div>
          </div>
        )}

        {/* ── ABA PIPELINE ── */}
        {aba==='pipeline' && (
          <div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Status atual</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {PIPELINE.map((s,i)=>(
                  <div key={s.value} style={{display:'flex',alignItems:'center',gap:4}}>
                    <div style={{
                      padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:700,
                      background: statusAtual===s.value ? s.cor : s.bg,
                      color: statusAtual===s.value ? '#fff' : s.cor,
                      border:`2px solid ${s.cor}`,
                    }}>{s.label}</div>
                    {i < PIPELINE.length-1 && <ChevronRight size={14} color="var(--border)"/>}
                  </div>
                ))}
              </div>
            </div>

            <div style={{borderTop:'1px solid var(--border)',paddingTop:16}}>
              <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Mover para</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Novo status</label>
                  <select className="form-select" value={novoStatus} onChange={e=>setNovoStatus(e.target.value)}>
                    <option value="">Selecionar...</option>
                    {PIPELINE.filter(s=>s.value!==statusAtual).map(s=>(
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {novoStatus && (
                <div className="form-group">
                  <label className="form-label">
                    Motivo {(novoStatus==='paused'||novoStatus==='closed') ? '*' : '(opcional)'}
                  </label>
                  <textarea className="form-textarea" rows={2} value={motivo}
                    onChange={e=>setMotivo(e.target.value)} placeholder="Descreva o motivo da mudança..."/>
                </div>
              )}
              <button className="btn btn-primary" onClick={avancarStatus}
                disabled={savingStatus||!novoStatus||(( novoStatus==='paused'||novoStatus==='closed')&&!motivo.trim())}>
                {savingStatus?'Salvando...':'Confirmar mudança de status'}
              </button>
            </div>
          </div>
        )}

        {/* ── ABA HISTÓRICO ── */}
        {aba==='historico' && (
          <div>
            {history.length===0
              ? <p style={{fontSize:13,color:'var(--text-muted)'}}>Nenhuma mudança de status registrada.</p>
              : history.map((h,i)=>{
                  const st = pipelineInfo(h.status)
                  return (
                    <div key={h.id} style={{display:'flex',gap:12,marginBottom:16}}>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:0}}>
                        <div style={{width:12,height:12,borderRadius:'50%',background:st.cor,flexShrink:0,marginTop:3}}/>
                        {i<history.length-1&&<div style={{width:2,flex:1,background:'var(--border)',marginTop:4}}/>}
                      </div>
                      <div style={{flex:1,paddingBottom:12}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                          <span style={{fontSize:13,fontWeight:700,color:st.cor}}>{st.label}</span>
                          <span style={{fontSize:11,color:'var(--text-muted)'}}>
                            {format(new Date(h.changed_at),'dd/MM/yyyy HH:mm',{locale:ptBR})}
                          </span>
                        </div>
                        {h.reason&&<div style={{fontSize:12,color:'var(--text-muted)',background:'var(--surface-2)',borderRadius:6,padding:'6px 10px',marginTop:4}}>{h.reason}</div>}
                      </div>
                    </div>
                  )
                })
            }
          </div>
        )}

        {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>
    </div>
  )
}

// ── CARD DO PARCEIRO NO KANBAN ─────────────────────────────
function KanbanCard({ parceiro, onClick }) {
  const plats = parceiro.platforms || []
  const eng = parceiro.engagement_rate
  return (
    <div onClick={onClick} style={{
      background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,
      padding:'10px 12px',cursor:'pointer',transition:'border-color 0.15s',marginBottom:8
    }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
      <div style={{fontWeight:700,fontSize:13,color:'var(--text)',marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
        {parceiro.nome}
      </div>
      {parceiro.username && (
        <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>@{parceiro.username}</div>
      )}
      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
        {plats.slice(0,3).map(p=>(
          <span key={p} style={{fontSize:10,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:4,padding:'1px 6px',color:'var(--text-muted)'}}>{p}</span>
        ))}
        {eng && <span style={{fontSize:10,color:'#22c55e',fontWeight:700,marginLeft:'auto'}}>{eng}%</span>}
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────
export default function CRM() {
  const [parceiros, setParceiros]     = useState([])
  const [todos, setTodos]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [modalParceiro, setModalParceiro] = useState(null)
  const [toast, showToast]            = useToast()

  async function carregar() {
    setLoading(true)
    try {
      const [crm, base] = await Promise.all([
        getCRMParceiros(),
        getParceiros(),
      ])
      setParceiros(crm)
      setTodos(base)
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  function handleSave(upd) {
    setParceiros(prev => prev.map(p => p.id===upd.id ? { ...p, ...upd } : p))
  }

  const filtrados = parceiros.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    (p.username||'').toLowerCase().includes(search.toLowerCase()) ||
    (p.platforms||[]).some(pl=>pl.toLowerCase().includes(search.toLowerCase()))
  )

  // Agrupa por status
  const porStatus = {}
  for (const st of PIPELINE) {
    porStatus[st.value] = filtrados.filter(p => (p.current_status||'prospected') === st.value)
  }

  // Parceiros sem status no CRM (ainda não entraram no pipeline)
  const semStatus = filtrados.filter(p => !p.current_status)

  const total = filtrados.length
  const ativos = filtrados.filter(p=>p.current_status==='active').length

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <Users size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{margin:0}}>CRM de Influencers</h1>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>
              {total} parceiro{total!==1?'s':''} · {ativos} ativo{ativos!==1?'s':''}
            </p>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{position:'relative'}}>
            <Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
            <input className="search-input" style={{paddingLeft:32}} placeholder="Buscar parceiro..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        </div>
      </div>

      {loading
        ? <div className="loading"><div className="spinner"/></div>
        : (
          <div style={{overflowX:'auto',paddingBottom:16}}>
            <div style={{display:'flex',gap:14,minWidth:'max-content'}}>
              {/* Coluna sem status */}
              {semStatus.length > 0 && (
                <div style={{width:220,flexShrink:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10,padding:'6px 10px',background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8}}>
                    <div style={{width:10,height:10,borderRadius:'50%',background:'var(--border)'}}/>
                    <span style={{fontSize:12,fontWeight:700,color:'var(--text-muted)',flex:1}}>Sem status</span>
                    <span style={{fontSize:11,color:'var(--text-muted)',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:20,padding:'1px 7px'}}>{semStatus.length}</span>
                  </div>
                  {semStatus.map(p=>(
                    <KanbanCard key={p.id} parceiro={p} onClick={()=>setModalParceiro(p)}/>
                  ))}
                </div>
              )}

              {/* Colunas do pipeline */}
              {PIPELINE.map(st=>{
                const items = porStatus[st.value] || []
                return (
                  <div key={st.value} style={{width:220,flexShrink:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10,padding:'6px 10px',background:st.bg,border:`1px solid ${st.cor}30`,borderRadius:8}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:st.cor}}/>
                      <span style={{fontSize:12,fontWeight:700,color:st.cor,flex:1}}>{st.label}</span>
                      <span style={{fontSize:11,color:st.cor,background:'var(--surface)',border:`1px solid ${st.cor}30`,borderRadius:20,padding:'1px 7px'}}>{items.length}</span>
                    </div>
                    {items.length===0
                      ? <div style={{padding:'16px 10px',textAlign:'center',fontSize:12,color:'var(--text-muted)',border:'1px dashed var(--border)',borderRadius:8}}>Vazio</div>
                      : items.map(p=>(
                          <KanbanCard key={p.id} parceiro={p} onClick={()=>setModalParceiro(p)}/>
                        ))
                    }
                  </div>
                )
              })}
            </div>
          </div>
        )
      }

      {modalParceiro && (
        <ModalParceiroCRM
          parceiro={modalParceiro}
          todos={todos}
          onSave={handleSave}
          onClose={()=>setModalParceiro(null)}
        />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
