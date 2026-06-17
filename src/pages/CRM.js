import { useEffect, useState } from 'react'
import {
  getParceiros, getParceirosAtivos, getEditoras, getUsuarios,
  getCRMParceiros, updateParceiroCRM, getStatusHistory, addStatusHistory, createParceiroCRM, deleteParceiro,
  getCRMStatusConfig, saveCRMStatusConfig, corParaBg, getLivros,
  TIERS, TIER_ORDER, SITUACOES, MODELOS_COM_ESCADA,
  updateTier, updateSituacao, updatePerformance, getTierHistory, verificarPromocao,
  ativarParceiroBronze,
} from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Users, Plus, X, ChevronRight, Clock, ExternalLink,
  Instagram, Youtube, Search, ArrowRight, Trash2, Settings2, GripVertical,
  ArrowUp, ChevronUp
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import TabelaAtivos from '../components/crm/TabelaAtivos'
import BadgeTier, { BadgeSituacao, ProgressoTier } from '../components/crm/BadgeTier'
import DesempenhoMensal from '../components/crm/DesempenhoMensal'

// ── PIPELINE FALLBACK (usado se não houver config no banco) ──
const PIPELINE_FALLBACK = [
  { value: 'found',        label: 'Encontrado',        cor: '#06b6d4', bg: 'rgba(6,182,212,0.12)'   },
  { value: 'prospected',   label: 'Prospectado',       cor: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  { value: 'negotiating',  label: 'Negociando',        cor: '#eab308', bg: 'rgba(234,179,8,0.12)'   },
  { value: 'agreed',       label: 'Acordo fechado',    cor: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  { value: 'active',       label: 'Ativo',             cor: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  { value: 'paused',       label: 'Pausado',           cor: '#eab308', bg: 'rgba(234,179,8,0.12)'   },
  { value: 'closed',       label: 'Encerrado',         cor: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  { value: 'sem_retorno',  label: 'Sem retorno',       cor: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  { value: 'sem_interesse',label: 'Sem interesse',     cor: '#f43f5e', bg: 'rgba(244,63,94,0.12)'   },
]

const PLATAFORMAS = ['Instagram','TikTok','YouTube','Blog','Twitter/X','Pinterest','Kwai']
const ORIGENS = [
  { value: 'active_search', label: 'Busca ativa' },
  { value: 'referral',      label: 'Indicação'   },
  { value: 'inbound',       label: 'Inbound'     },
]
const MODELOS = [
  { value: '1', label: '1 — Livraria Personalizada', desc: 'Parceiro tem loja própria com URL personalizada' },
  { value: '2', label: '2 — Book Time (cupom)',      desc: 'Parceiro divulga com cupom de desconto e ganha comissão de 10%' },
  { value: '3', label: '3 — Institucional',           desc: 'Divulgação das editoras próprias do grupo' },
]

// ── Extrai o username do Instagram a partir da URL do perfil ──
function extrairUsername(profileUrl, usernameFallback) {
  let user = ''
  try {
    const url = profileUrl || ''
    if (url.includes('instagram')) {
      user = new URL(url.startsWith('http') ? url : 'https://' + url).pathname.replace(/\//g, '')
    }
  } catch {}
  if (!user) user = (usernameFallback || '').replace('@', '')
  return user
}

function useToast() {
  const [t, setT] = useState(null)
  function show(msg, type='success') { setT({msg,type}); setTimeout(()=>setT(null),4000) }
  return [t, show]
}

function pipelineInfo(v, pipeline = PIPELINE_FALLBACK) { return pipeline.find(p=>p.value===v) || pipeline[0] }

// ── MODAL DETALHE PARCEIRO CRM ─────────────────────────────
function ModalParceiroCRM({ parceiro: inicial, todos, onSave, onClose, pipeline }) {
  const { usuario } = useAuth()
  const [parceiro, setParceiro] = useState(inicial)
  const [history, setHistory]   = useState([])
  const [aba, setAba]           = useState('perfil') // perfil | pipeline | historico
  const [form, setForm]         = useState({
    nome:         inicial.nome||'',
    username:     inicial.username||'',
    platforms:    inicial.platforms||[],
    followers:    inicial.followers_count || {},
    engagement_rate: inicial.engagement_rate||'',
    profile_url:  inicial.profile_url||'',
    contact_value: inicial.contact_value||'',
    source:       inicial.source||'',
    referred_by:  inicial.referred_by||'',
    library_url:  inicial.library_url||'',
    coupon_code:  inicial.coupon_code||'',
    model:        inicial.model||'',
    responsavel_interno_id: inicial.responsavel_interno_id||'',

    editoras_sugeridas: inicial.editoras_sugeridas ? String(inicial.editoras_sugeridas).split(',').map(e=>e.trim()).filter(Boolean) : [],
  })
  const [novoStatus, setNovoStatus] = useState('')
  const [motivo, setMotivo]         = useState('')
  const [saving, setSaving]         = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [editoras, setEditoras]       = useState([])
  const [editoraSearch, setEditoraSearch] = useState('')
  const [usuarios, setUsuarios]       = useState([])
  const [livros, setLivros]           = useState([])
  const [livroSearch, setLivroSearch] = useState('')
  const [livrosConvidados, setLivrosConvidados] = useState(
    (inicial.livros_propostos||[]).map(lp=>({id:lp.livro_id, titulo:lp.livro, autor:''}))
  )
  const [toast, showToast]          = useToast()
  const [tierHistory, setTierHistory] = useState([])
  const [perfForm, setPerfForm]     = useState({
    vendas_total: inicial.vendas_total || 0,
    vendas_mes: inicial.vendas_mes || 0,
    conteudos_postados: inicial.conteudos_postados || 0,
    ultima_atividade: inicial.ultima_atividade || '',
  })
  const [savingPerf, setSavingPerf] = useState(false)
  const [savingTier, setSavingTier] = useState(false)
  const [ativando, setAtivando] = useState(false)
  const [tierManual, setTierManual] = useState('')
  const ehAdminModal = usuario?.perfil === 'administrador' || usuario?.perfil === 'gerente'

  useEffect(() => {
    getStatusHistory(parceiro.id).then(setHistory).catch(console.error)
    getEditoras().then(setEditoras).catch(console.error)
    getUsuarios().then(setUsuarios).catch(console.error)
    getTierHistory(parceiro.id).then(setTierHistory).catch(console.error)
    ;(async () => {
      try {
        const todos = []
        let pagina = 0
        const tamanho = 1000
        while (true) {
          const r = await getLivros({ page: pagina, pageSize: tamanho, grupos: null })
          const lote = r.data || []
          todos.push(...lote)
          if (lote.length < tamanho) break
          pagina++
          if (pagina > 20) break
        }
        setLivros(todos)
      } catch (e) { console.error('Erro ao carregar livros:', e) }
    })()
  }, [parceiro.id])

  async function salvarPerfil() {
    setSaving(true)
    try {
      // Constrói followers_count a partir dos campos por plataforma
      const followers_count = Object.keys(form.followers).length > 0
        ? Object.fromEntries(Object.entries(form.followers).filter(([,v]) => v && Number(v) > 0))
        : null
      const payload = {
        nome:            form.nome.trim()||inicial.nome,
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
        responsavel_interno_id: form.responsavel_interno_id||null,

        editoras_sugeridas: form.editoras_sugeridas.length ? form.editoras_sugeridas.join(',') : null,
        livros_propostos: livrosConvidados.length ? livrosConvidados.map(l => ({
          livro: l.titulo,
          livro_id: l.id,
          status: 'proposto',
          data: new Date().toLocaleDateString('pt-BR'),
        })) : (parceiro.livros_propostos||null),
      }
      const upd = await updateParceiroCRM(parceiro.id, payload)
      setParceiro({...upd, nome: payload.nome||upd.nome, livros_propostos: payload.livros_propostos||[]})
      onSave({...upd, nome: payload.nome||upd.nome, livros_propostos: payload.livros_propostos||[]})
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
      const parceiroAtualizado = { ...parceiro, current_status: novoStatus }
      setParceiro(parceiroAtualizado)
      onSave(parceiroAtualizado)
      setNovoStatus(''); setMotivo('')
      showToast('Status atualizado!')
    } catch(e) { showToast('Erro','error') } finally { setSavingStatus(false) }
  }

  async function ativarParceiro() {
    if (statusAtual === 'active') return
    setAtivando(true)
    try {
      // Mesma regra do kanban: modelos com escada entram como Bronze
      if (!parceiro.tier && MODELOS_COM_ESCADA.includes(parceiro.model)) {
        await ativarParceiroBronze(parceiro.id, usuario?.id)
      } else {
        await addStatusHistory(parceiro.id, 'active', 'Parceiro ativado')
      }
      const hist = await getStatusHistory(parceiro.id)
      setHistory(hist)
      const parceiroAtualizado = { ...parceiro, current_status: 'active' }
      setParceiro(parceiroAtualizado)
      onSave(parceiroAtualizado)
      showToast('Parceiro ativado! Agora aparece em Parceiros Ativos.')
    } catch(e) { showToast('Erro ao ativar parceiro', 'error') } finally { setAtivando(false) }
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
    <div className="modal-backdrop">
      <div className="modal" style={{maxWidth:780,maxHeight:'90vh',overflowY:'auto'}}>
        <div className="modal-header" style={{position:'sticky',top:0,background:'var(--surface)',zIndex:10,borderBottom:'1px solid var(--border)'}}>
          <div>
            <input
                className="form-input"
                value={form.nome}
                onChange={e=>setForm(f=>({...f,nome:e.target.value}))}
                style={{fontSize:16,fontWeight:700,background:'transparent',border:'none',borderBottom:'1px solid var(--border)',borderRadius:0,padding:'2px 0',color:'var(--text)',width:'100%',outline:'none'}}
                placeholder="Nome do parceiro"
              />
            <span style={{display:'inline-flex',alignItems:'center',gap:5,background:stInfo.bg,border:`1px solid ${stInfo.cor}40`,borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700,color:stInfo.cor}}>
              {stInfo.label}
            </span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        {/* Abas */}
        <div style={{display:'flex',gap:4,padding:'12px 0 0',borderBottom:'1px solid var(--border)',marginBottom:16}}>
          {[
            {v:'perfil',l:'Perfil CRM'},
            ...(parceiro.tier || statusAtual === 'active' ? [{v:'performance',l:'Performance'}] : []),
            {v:'pipeline',l:'Pipeline'},
            {v:'livros_propostos',l:`Livros propostos (${(parceiro.livros_propostos||[]).length})`},
            {v:'historico',l:`Histórico (${history.length})`},
          ].map(({v,l})=>(
            <button key={v} onClick={()=>setAba(v)}
              className={`btn btn-sm ${aba===v?'btn-primary':'btn-ghost'}`}
              style={{borderRadius:'6px 6px 0 0'}}>
              {l}
            </button>
          ))}
        </div>

        {/* Dica de próximo passo */}
        {statusAtual !== 'active' && !parceiro.tier && (
          <div style={{padding:'10px 14px',marginBottom:16,borderRadius:8,background:'var(--surface-2)',border:'1px solid var(--border)',fontSize:12,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:8}}>
            <Clock size={14} style={{flexShrink:0}}/>
            {statusAtual === 'found' && 'Próximo passo: avaliar o perfil e entrar em contato com o parceiro.'}
            {statusAtual === 'prospected' && 'Próximo passo: propor livros e negociar o modelo de parceria.'}
            {statusAtual === 'negotiating' && 'Próximo passo: definir modelo, cupom/livraria e fechar acordo.'}
            {statusAtual === 'agreed' && 'Próximo passo: ativar o parceiro para ele entrar na Escada de Crescimento.'}
            {!['found','prospected','negotiating','agreed'].includes(statusAtual) && 'Parceiro em prospecção — avance no pipeline para ativar.'}
          </div>
        )}

        {/* ── ABA PERFIL ── */}
        {aba==='perfil' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Link do perfil</label>
              <div style={{display:'flex',gap:6}}>
                <input className="form-input" style={{flex:1}} value={form.profile_url} onChange={e=>setForm(f=>({...f,profile_url:e.target.value}))} placeholder="https://instagram.com/..."/>
                {form.profile_url && (
                  <a href={form.profile_url} target="_blank" rel="noopener noreferrer"
                    className="btn btn-ghost btn-icon" title="Abrir perfil"
                    style={{flexShrink:0,display:'flex',alignItems:'center'}}>
                    <ExternalLink size={15}/>
                  </a>
                )}
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

            {form.platforms.length > 0 && (
              <div className="form-group">
                <label className="form-label">Seguidores por plataforma</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {form.platforms.map(p=>(
                    <div key={p} style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:12,color:'var(--text-muted)',minWidth:70}}>{p}</span>
                      <input className="form-input" type="number" min="0"
                        style={{flex:1}}
                        value={form.followers[p]||''}
                        onChange={e=>setForm(f=>({...f,followers:{...f.followers,[p]:e.target.value?parseInt(e.target.value):undefined}}))}
                        placeholder="0"/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Taxa de engajamento (%)</label>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <input className="form-input" type="number" step="0.01" style={{flex:1}} value={form.engagement_rate}
                    onChange={e=>setForm(f=>({...f,engagement_rate:e.target.value}))} placeholder="3.75"/>
                  <button type="button" className="btn btn-ghost btn-sm" title="Calcular engajamento no Social Cat"
                    onClick={()=>{
                      const user = extrairUsername(form.profile_url, form.username)
                      const dest = user
                        ? `https://thesocialcat.com/tools/instagram-engagement-rate-calculator?username=${encodeURIComponent(user)}`
                        : 'https://thesocialcat.com/tools/instagram-engagement-rate-calculator'
                      window.open(dest, '_blank')
                    }}
                    style={{whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:4,padding:'6px 10px',flexShrink:0}}>
                    <ExternalLink size={12}/>
                    Calcular
                  </button>
                </div>
                {!(form.profile_url || '').includes('instagram') && !form.engagement_rate && (
                  <div style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>
                    Preencha o link do Instagram acima para calcular automaticamente
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Modelo de parceria</label>
                <select className="form-select" value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))}>
                  <option value="">Selecionar...</option>
                  {MODELOS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                {form.model && MODELOS.find(m=>m.value===form.model) && (
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                    {MODELOS.find(m=>m.value===form.model).desc}
                  </div>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Responsável interno</label>
                <select className="form-select" value={form.responsavel_interno_id} onChange={e=>setForm(f=>({...f,responsavel_interno_id:e.target.value}))}>
                  <option value="">Sem responsável</option>
                  {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Contato (WhatsApp/Email)</label>
                <input className="form-input" value={form.contact_value}
                  onChange={e=>setForm(f=>({...f,contact_value:e.target.value}))} placeholder="+55 11 99999-9999"/>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Origem</label>
                <select className="form-select" value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))}>
                  <option value="">Selecionar...</option>
                  {ORIGENS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
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
            </div>



            <div className="form-row">
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
            </div>



            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'start'}}>
            <div className="form-group">
              <label className="form-label">Editoras a oferecer</label>
              {form.editoras_sugeridas.length > 0 && (
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
                  {form.editoras_sugeridas.map(e=>(
                    <span key={e} style={{display:'inline-flex',alignItems:'center',gap:4,background:'var(--accent-glow)',border:'1px solid var(--accent)',borderRadius:20,padding:'2px 10px',fontSize:12,color:'var(--accent)',fontWeight:600}}>
                      {e}
                      <button onClick={()=>setForm(f=>({...f,editoras_sugeridas:f.editoras_sugeridas.filter(x=>x!==e)}))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',padding:0,display:'flex',lineHeight:1}}><X size={11}/></button>
                    </span>
                  ))}
                </div>
              )}
              <input className="form-input" value={editoraSearch} onChange={e=>setEditoraSearch(e.target.value)} placeholder="Buscar editora..."/>
              {editoraSearch.trim() && (
                <div style={{border:'1px solid var(--border)',borderRadius:8,marginTop:4,maxHeight:140,overflowY:'auto',background:'var(--surface-2)'}}>
                  {editoras.filter(e=>e.toLowerCase().includes(editoraSearch.toLowerCase())&&!form.editoras_sugeridas.includes(e)).length===0
                    ? <div style={{padding:'10px 14px',fontSize:12,color:'var(--text-muted)'}}>Nenhuma editora encontrada</div>
                    : editoras.filter(e=>e.toLowerCase().includes(editoraSearch.toLowerCase())&&!form.editoras_sugeridas.includes(e)).map(e=>(
                        <div key={e} onClick={()=>{setForm(f=>({...f,editoras_sugeridas:[...f.editoras_sugeridas,e]}));setEditoraSearch('')}}
                          style={{padding:'8px 14px',fontSize:13,cursor:'pointer',borderBottom:'1px solid var(--border)'}}
                          onMouseEnter={ev=>ev.currentTarget.style.background='var(--surface-3)'}
                          onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
                          {e}
                        </div>
                      ))
                  }
                </div>
              )}
            </div>

            {/* ── Livro a propor ── */}
            <div className="form-group">
              <label className="form-label">Livro a propor na parceria</label>
              {livrosConvidados.length > 0 && (
                <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:8}}>
                  {livrosConvidados.map(l=>(
                    <div key={l.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--accent-glow)',border:'1px solid var(--accent)',borderRadius:8,padding:'6px 12px'}}>
                      <div style={{minWidth:0}}>
                        <span style={{fontSize:13,fontWeight:600,color:'var(--accent)',display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.titulo}</span>
                        {l.autor && <span style={{fontSize:11,color:'var(--text-muted)'}}>{l.autor}</span>}
                      </div>
                      <button onClick={()=>setLivrosConvidados(prev=>prev.filter(x=>x.id!==l.id))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',padding:'0 0 0 8px',display:'flex',flexShrink:0}}><X size={13}/></button>
                    </div>
                  ))}
                </div>
              )}
              <input className="form-input" value={livroSearch} onChange={e=>setLivroSearch(e.target.value)} placeholder="Buscar livro pelo título, autor, ISBN ou SKU..."/>
              {livroSearch.trim() && (
                <div style={{border:'1px solid var(--border)',borderRadius:8,marginTop:4,maxHeight:160,overflowY:'auto',background:'var(--surface-2)'}}>
                  {livros.filter(l=>
                    (l.titulo||'').toLowerCase().includes(livroSearch.toLowerCase()) ||
                    (l.autor||'').toLowerCase().includes(livroSearch.toLowerCase()) ||
                    (l.isbn||'').toLowerCase().includes(livroSearch.toLowerCase()) ||
                    (l.sku||'').toLowerCase().includes(livroSearch.toLowerCase())
                  ).filter(l=>!livrosConvidados.find(x=>x.id===l.id)).slice(0,20).length === 0
                    ? <div style={{padding:'10px 14px',fontSize:12,color:'var(--text-muted)'}}>Nenhum livro encontrado</div>
                    : livros.filter(l=>
                        (l.titulo||'').toLowerCase().includes(livroSearch.toLowerCase()) ||
                        (l.autor||'').toLowerCase().includes(livroSearch.toLowerCase()) ||
                        (l.isbn||'').toLowerCase().includes(livroSearch.toLowerCase()) ||
                        (l.sku||'').toLowerCase().includes(livroSearch.toLowerCase())
                      ).filter(l=>!livrosConvidados.find(x=>x.id===l.id)).slice(0,20).map(l=>(
                        <div key={l.id}
                          onClick={()=>{setLivrosConvidados(prev=>[...prev,l]);setLivroSearch('')}}
                          style={{padding:'8px 14px',cursor:'pointer',borderBottom:'1px solid var(--border)'}}
                          onMouseEnter={ev=>ev.currentTarget.style.background='var(--surface-3)'}
                          onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
                          <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{l.titulo}</div>
                          {l.autor && <div style={{fontSize:11,color:'var(--text-muted)'}}>{l.autor}{l.editora ? ` · ${l.editora}` : ''}</div>}
                        </div>
                      ))
                  }
                </div>
              )}
            </div>
            </div>

            <div style={{display:'flex',justifyContent:'flex-end',position:'sticky',bottom:0,paddingTop:12,paddingBottom:4,background:'var(--surface)',borderTop:'1px solid var(--border)',marginTop:8}}>
              <button className="btn btn-primary" onClick={salvarPerfil} disabled={saving}>
                {saving?'Salvando...':'Salvar perfil'}
              </button>
            </div>
          </div>
        )}

        {/* ── ABA PERFORMANCE (Escada de Crescimento) ── */}
        {aba==='performance' && (
          <div>
            {/* Tier atual + situação */}
            <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20,padding:'16px',background:'var(--surface-2)',borderRadius:8,border:'1px solid var(--border)'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Tier atual</div>
                {parceiro.tier ? (
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <BadgeTier tier={parceiro.tier} size="lg" prontoParaSubir={!!verificarPromocao({...parceiro,...perfForm})} />
                    <ProgressoTier parceiro={{...parceiro, ...perfForm}} />
                  </div>
                ) : (
                  <span style={{fontSize:13,color:'var(--text-muted)'}}>
                    {MODELOS_COM_ESCADA.includes(parceiro.model)
                      ? 'Parceiro ainda não entrou na Escada'
                      : 'Modelo de parceria sem Escada (Livraria)'}
                  </span>
                )}
              </div>
              <div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Situação</div>
                <BadgeSituacao situacao={parceiro.situacao || 'ativo'} />
              </div>
            </div>

            {/* Ajuste manual de tier (admin/gerente) */}
            {ehAdminModal && (
              <div style={{padding:'12px 16px',marginBottom:20,borderRadius:8,background:'var(--surface-2)',border:'1px solid var(--border)'}}>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Ajustar tier manualmente</div>
                <div style={{display:'flex',alignItems:'flex-end',gap:10,flexWrap:'wrap'}}>
                  <div className="form-group" style={{margin:0,minWidth:200}}>
                    <label className="form-label">Definir como</label>
                    <select className="form-select" value={tierManual} onChange={e=>setTierManual(e.target.value)}>
                      <option value="">Selecionar...</option>
                      <option value="livraria">Livraria (sem Escada)</option>
                      <option value="bronze">Bronze</option>
                      <option value="prata">Prata</option>
                      <option value="ouro">Ouro</option>
                    </select>
                  </div>
                  <button className="btn btn-primary" disabled={savingTier || !tierManual}
                    onClick={async () => {
                      if (!tierManual) return
                      setSavingTier(true)
                      try {
                        if (tierManual === 'livraria') {
                          await updateParceiroCRM(parceiro.id, { tier: null, model: 1 })
                          setParceiro(prev => ({...prev, tier: null, model: 1}))
                          onSave({...parceiro, tier: null, model: 1})
                          showToast('Parceiro definido como Livraria (sem Escada).')
                        } else {
                          await updateTier(parceiro.id, tierManual, 'Ajuste manual de tier', usuario?.id)
                          setParceiro(prev => ({...prev, tier: tierManual, tier_updated_at: new Date().toISOString()}))
                          onSave({...parceiro, tier: tierManual})
                          setTierHistory(await getTierHistory(parceiro.id))
                          showToast(`Tier ajustado para ${TIERS[tierManual].label}.`)
                        }
                        setTierManual('')
                      } catch { showToast('Erro ao ajustar tier','error') }
                      finally { setSavingTier(false) }
                    }}>
                    {savingTier ? 'Salvando...' : 'Aplicar'}
                  </button>
                </div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:8}}>
                  "Livraria" remove o parceiro da Escada de Crescimento (fica sem tier bronze/prata/ouro). Use para corrigir parceiros do modelo Livraria Personalizada.
                </div>
              </div>
            )}

            {/* Promoção disponível */}
            {parceiro.tier && verificarPromocao({...parceiro, ...perfForm}) && (
              <div style={{
                padding:'12px 16px',marginBottom:20,borderRadius:8,
                background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.25)',
                display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,
              }}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'#22c55e',marginBottom:2}}>Pronto para subir de tier</div>
                  <div style={{fontSize:12,color:'var(--text-muted)'}}>{verificarPromocao({...parceiro,...perfForm}).motivo}</div>
                </div>
                <button className="btn btn-primary btn-sm" disabled={savingTier}
                  style={{background:'#22c55e',borderColor:'#22c55e',whiteSpace:'nowrap'}}
                  onClick={async () => {
                    const promo = verificarPromocao({...parceiro,...perfForm})
                    if (!promo) return
                    setSavingTier(true)
                    try {
                      await updateTier(parceiro.id, promo.proximo, promo.motivo)
                      setParceiro(prev => ({...prev, tier: promo.proximo, tier_updated_at: new Date().toISOString()}))
                      onSave({...parceiro, tier: promo.proximo})
                      setTierHistory(await getTierHistory(parceiro.id))
                      showToast(`Promovido para ${TIERS[promo.proximo].label}!`)
                    } catch { showToast('Erro ao promover','error') }
                    finally { setSavingTier(false) }
                  }}>
                  <ChevronUp size={14}/> Promover para {TIERS[verificarPromocao({...parceiro,...perfForm}).proximo].label}
                </button>
              </div>
            )}

            {/* Campos de performance editáveis */}
            {MODELOS_COM_ESCADA.includes(parceiro.model) && (
              <div className="form-grid">
                <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:4,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Dados de performance</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Vendas total (acumulado)</label>
                    <input className="form-input" type="number" min="0" value={perfForm.vendas_total}
                      onChange={e => setPerfForm(f => ({...f, vendas_total: parseInt(e.target.value)||0}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vendas este mês</label>
                    <input className="form-input" type="number" min="0" value={perfForm.vendas_mes}
                      onChange={e => setPerfForm(f => ({...f, vendas_mes: parseInt(e.target.value)||0}))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Conteúdos postados</label>
                    <input className="form-input" type="number" min="0" value={perfForm.conteudos_postados}
                      onChange={e => setPerfForm(f => ({...f, conteudos_postados: parseInt(e.target.value)||0}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Última atividade</label>
                    <input className="form-input" type="date" value={perfForm.ultima_atividade || ''}
                      onChange={e => setPerfForm(f => ({...f, ultima_atividade: e.target.value}))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Situação do parceiro</label>
                  <div style={{display:'flex',gap:8}}>
                    {Object.entries(SITUACOES).map(([val, info]) => (
                      <button key={val} type="button"
                        onClick={async () => {
                          try {
                            await updateSituacao(parceiro.id, val)
                            setParceiro(prev => ({...prev, situacao: val}))
                            onSave({...parceiro, situacao: val})
                            showToast(`Situação: ${info.label}`)
                          } catch { showToast('Erro','error') }
                        }}
                        style={{padding:'5px 14px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',
                          border:`2px solid ${info.cor}`,
                          background: (parceiro.situacao||'ativo')===val ? info.cor : 'transparent',
                          color: (parceiro.situacao||'ativo')===val ? '#fff' : info.cor,
                          transition:'all 0.15s'}}>
                        {info.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:'flex',justifyContent:'flex-end'}}>
                  <button className="btn btn-primary" disabled={savingPerf}
                    onClick={async () => {
                      setSavingPerf(true)
                      try {
                        await updatePerformance(parceiro.id, perfForm)
                        setParceiro(prev => ({...prev, ...perfForm}))
                        onSave({...parceiro, ...perfForm})
                        showToast('Performance atualizada!')
                      } catch { showToast('Erro ao salvar','error') }
                      finally { setSavingPerf(false) }
                    }}>
                    {savingPerf ? 'Salvando...' : 'Salvar performance'}
                  </button>
                </div>
              </div>
            )}

            {/* Histórico de tier */}
            {tierHistory.length > 0 && (
              <div style={{marginTop:20}}>
                <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Histórico de tier</div>
                {tierHistory.map((h, i) => {
                  const tierInfo = TIERS[h.tier_novo] || {cor:'#6b7280',label:h.tier_novo}
                  return (
                    <div key={h.id} style={{display:'flex',gap:12,marginBottom:12}}>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                        <div style={{width:10,height:10,borderRadius:'50%',background:tierInfo.cor,flexShrink:0,marginTop:3}}/>
                        {i < tierHistory.length-1 && <div style={{width:2,flex:1,background:'var(--border)',marginTop:4}}/>}
                      </div>
                      <div style={{flex:1,paddingBottom:8}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                          {h.tier_anterior && (<><BadgeTier tier={h.tier_anterior} size="sm" /><ArrowRight size={12} color="var(--text-muted)" /></>)}
                          <BadgeTier tier={h.tier_novo} size="sm" />
                          <span style={{fontSize:11,color:'var(--text-muted)'}}>{format(new Date(h.changed_at),'dd/MM/yyyy HH:mm',{locale:ptBR})}</span>
                        </div>
                        {h.motivo && <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{h.motivo}</div>}
                        {h.changed_by_nome && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>por {h.changed_by_nome}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ABA PIPELINE ── */}
        {aba==='pipeline' && (
          <div>
            {(() => {
              const STATUS_LIFECYCLE_MODAL = ['active', 'paused', 'closed']
              const pipelineFiltrado = pipeline.filter(s => !STATUS_LIFECYCLE_MODAL.includes(s.value))
              return (<>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Status atual</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {pipelineFiltrado.map((s,i)=>(
                  <div key={s.value} style={{display:'flex',alignItems:'center',gap:4}}>
                    <div style={{
                      padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:700,
                      background: statusAtual===s.value ? s.cor : s.bg,
                      color: statusAtual===s.value ? '#fff' : s.cor,
                      border:`2px solid ${s.cor}`,
                    }}>{s.label}</div>
                    {i < pipelineFiltrado.length-1 && <ChevronRight size={14} color="var(--border)"/>}
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
                    {pipelineFiltrado.filter(s=>s.value!==statusAtual).map(s=>(
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

            {/* Ação de ciclo de vida: ativar parceiro */}
            {statusAtual !== 'active' && (
              <div style={{borderTop:'1px solid var(--border)',marginTop:16,paddingTop:16}}>
                <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Parceiros Ativos</div>
                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <button
                    onClick={ativarParceiro}
                    disabled={ativando}
                    style={{
                      display:'inline-flex',alignItems:'center',gap:8,
                      background:'#22c55e',color:'#fff',border:'none',borderRadius:8,
                      padding:'10px 18px',fontSize:14,fontWeight:700,cursor: ativando ? 'default' : 'pointer',
                      opacity: ativando ? 0.7 : 1,
                    }}>
                    <ArrowRight size={16}/>
                    {ativando ? 'Ativando...' : 'Tornar parceiro ativo'}
                  </button>
                  <span style={{fontSize:12,color:'var(--text-muted)'}}>
                    Move o parceiro para a aba <strong>Parceiros Ativos</strong> e o torna visível em todo o Orbita.
                    {MODELOS_COM_ESCADA.includes(parceiro.model) && !parceiro.tier && ' Ele entra na Escada de Crescimento como Bronze.'}
                  </span>
                </div>
              </div>
            )}
              </>)
            })()}
          </div>
        )}

        {/* ── ABA HISTÓRICO ── */}

        {/* ── ABA LIVROS PROPOSTOS ── */}
        {aba==='livros_propostos' && (
          <div>
            {(parceiro.livros_propostos||[]).length === 0 ? (
              <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text-muted)'}}>
                <p style={{fontSize:13}}>Nenhum livro proposto a este parceiro ainda.</p>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {(parceiro.livros_propostos||[]).map((lp, idx) => {
                  const info = pipelineInfo(lp.status)
                  return (
                    <div key={idx} style={{
                      padding:'12px 14px',
                      background:'var(--surface-2)',
                      borderRadius:8,
                      border:'1px solid var(--border)',
                    }}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom: lp.nota ? 6 : 0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0,flex:1}}>
                          <span style={{fontSize:13,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {lp.livro || 'Livro sem título'}
                          </span>
                        </div>
                        <span style={{
                          fontSize:11,fontWeight:700,
                          background: info.bg,
                          color: info.cor,
                          padding:'3px 10px',borderRadius:99,flexShrink:0
                        }}>{info.label}</span>
                      </div>
                      {lp.nota && (
                        <p style={{fontSize:12,color:'var(--text-muted)',margin:0,whiteSpace:'pre-wrap'}}>{lp.nota}</p>
                      )}
                      {lp.data && (
                        <div style={{fontSize:10,color:'var(--text-muted)',marginTop:6,opacity:0.7}}>
                          Proposto em {lp.data}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

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
function KanbanCard({ parceiro, onClick, onDragStart, onDragEnd, isDragging, onDelete, pipeline }) {
  const plats = parceiro.platforms || []
  const eng = parceiro.engagement_rate
  return (
    <div
      draggable
      onDragStart={e=>{ e.dataTransfer.effectAllowed='move'; onDragStart && onDragStart() }}
      onDragEnd={()=>{ onDragEnd && onDragEnd() }}
      onClick={()=>!isDragging && onClick()}
      style={{
        background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,
        padding:'10px 12px',cursor:'grab',transition:'border-color 0.15s, opacity 0.15s',
        marginBottom:8, opacity: isDragging ? 0.4 : 1,
        userSelect:'none', position:'relative',
      }}
      onMouseEnter={e=>{if(!isDragging)e.currentTarget.style.borderColor='var(--accent)'}}
      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:4,marginBottom:3}}>
        <div style={{fontWeight:700,fontSize:13,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>
          {parceiro.nome}
        </div>
        {onDelete && (
          <button onClick={e=>{e.stopPropagation();onDelete()}}
            style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:2,flexShrink:0,display:'flex',borderRadius:4,transition:'color 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>
            <Trash2 size={12}/>
          </button>
        )}
      </div>
      {parceiro.username && (
        <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>@{parceiro.username}</div>
      )}
      {/* Redes sociais */}
      {plats.length > 0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:4}}>
          {plats.slice(0,3).map(p=>(
            <span key={p} style={{fontSize:10,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:4,padding:'1px 6px',color:'var(--text-muted)'}}>{p}</span>
          ))}
          {eng && <span style={{fontSize:10,color:'#22c55e',fontWeight:700,marginLeft:'auto'}}>{eng}%</span>}
        </div>
      )}
      {/* Responsável interno */}
      {parceiro.responsavel_interno_nome && (
        <div style={{display:'flex',alignItems:'center',gap:5,marginTop:4}}>
          <div style={{width:14,height:14,borderRadius:'50%',background:'var(--surface-2)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'var(--text-muted)',flexShrink:0}}>
            {parceiro.responsavel_interno_nome[0].toUpperCase()}
          </div>
          <span style={{fontSize:10,color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{parceiro.responsavel_interno_nome}</span>
        </div>
      )}
      {/* Editoras sugeridas */}
      {parceiro.editoras_sugeridas && (
        <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:2}}>
          {String(parceiro.editoras_sugeridas).split(',').filter(Boolean).map(e=>(
            <span key={e} style={{fontSize:9,background:'var(--accent-glow)',border:'1px solid var(--accent)',borderRadius:3,padding:'1px 5px',color:'var(--accent)',fontWeight:600}}>{e.trim()}</span>
          ))}
        </div>
      )}
    </div>
  )
}


// ── MODAL NOVO PARCEIRO ────────────────────────────────────
function ModalNovoParceiro({ onSave, onClose, pipeline, grupo }) {
  const TIPOS_PARCERIA = ['Livraria de influencer', 'Booktime', 'Divulgação editoras próprias']
  const [form, setForm] = useState({
    nome: '', tipo_parceria: '', cpf: '', livraria: '',
    canal_comunicacao: '', temas: '', editoras_divulga: '',
    username: '', platforms: [], profile_url: '', contact_value: '',
    source: '', model: '',
    engagement_rate: '', library_url: '', coupon_code: '',
    responsavel_interno_id: '',
    editoras_sugeridas: [],
  })
  const [statusInicial, setStatusInicial] = useState('prospected')
  const [saving, setSaving]   = useState(false)
  const [editoras, setEditoras] = useState([])
  const [editoraSearch, setEditoraSearch] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [livros, setLivros] = useState([])
  const [livroSearch, setLivroSearch] = useState('')
  const [livrosConvidados, setLivrosConvidados] = useState([])

  useEffect(() => {
    getEditoras().then(setEditoras).catch(console.error)
    getUsuarios().then(setUsuarios).catch(console.error)
    // Busca todos os livros paginando (Supabase limita a 1000 por chamada)
    ;(async () => {
      try {
        const todos = []
        let pagina = 0
        const tamanho = 1000
        while (true) {
          const r = await getLivros({ page: pagina, pageSize: tamanho, grupos: null })
          const lote = r.data || []
          todos.push(...lote)
          if (lote.length < tamanho) break
          pagina++
          if (pagina > 20) break // segurança contra loop infinito
        }
        setLivros(todos)
      } catch (e) {
        console.error('Erro ao carregar livros:', e)
      }
    })()
  }, [])

  function togglePlat(p) {
    setForm(f=>({...f, platforms: f.platforms.includes(p)?f.platforms.filter(x=>x!==p):[...f.platforms,p]}))
  }

  async function salvar() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      // Username derivado do link do perfil (campo removido da UI,
      // valor preservado no banco como fallback p/ calculadora)
      const usernameDerivado = extrairUsername(form.profile_url, form.username)
      const payload = {
        nome: form.nome.trim(),
        tipo_parceria: form.tipo_parceria||null,
        cpf: form.cpf||null,
        livraria: form.livraria||null,
        canal_comunicacao: form.canal_comunicacao||null,
        temas: form.temas||null,
        editoras_divulga: form.editoras_divulga||null,
        username: usernameDerivado||null,
        platforms: form.platforms,
        engagement_rate: form.engagement_rate ? Number(form.engagement_rate) : null,
        profile_url: form.profile_url||null,
        contact_value: form.contact_value||null,
        source: form.source||null,
        library_url: form.library_url||null,
        coupon_code: form.coupon_code||null,
        model: form.model ? Number(form.model) : null,
        responsavel_interno_id: form.responsavel_interno_id||null,
        editoras_sugeridas: form.editoras_sugeridas.length ? form.editoras_sugeridas.join(',') : null,
        livros_propostos: livrosConvidados.length ? livrosConvidados.map(l => ({
          livro: l.titulo,
          livro_id: l.id,
          status: 'proposto',
          data: new Date().toLocaleDateString('pt-BR'),
        })) : null,
      }
      const novo = await createParceiroCRM({ ...payload, grupo }, statusInicial)
      onSave({ ...novo, current_status: statusInicial, livros_propostos: payload.livros_propostos || [] })
      onClose()
    } catch(e) { console.error(e) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{maxWidth:780,maxHeight:'90vh',overflowY:'auto'}}>
        <div className="modal-header" style={{position:'sticky',top:0,background:'var(--surface)',zIndex:10,borderBottom:'1px solid var(--border)'}}>
          <h2 className="modal-title">Novo parceiro</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="form-grid">
          {/* Dados básicos */}
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-input" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Nome completo"/>
          </div>

          {/* Link do perfil (clicável) */}
          <div className="form-group">
            <label className="form-label">Link do perfil</label>
            <div style={{display:'flex',gap:6}}>
              <input className="form-input" style={{flex:1}} value={form.profile_url} onChange={e=>setForm(f=>({...f,profile_url:e.target.value}))} placeholder="https://instagram.com/..."/>
              {form.profile_url && (
                <a href={form.profile_url} target="_blank" rel="noopener noreferrer"
                  className="btn btn-ghost btn-icon" title="Abrir perfil"
                  style={{flexShrink:0,display:'flex',alignItems:'center'}}>
                  <ExternalLink size={15}/>
                </a>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo de parceria</label>
              <select className="form-select" value={form.tipo_parceria} onChange={e=>setForm(f=>({...f,tipo_parceria:e.target.value}))}>
                <option value="">Selecionar...</option>
                {TIPOS_PARCERIA.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Modelo</label>
              <select className="form-select" value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))}>
                <option value="">Selecionar...</option>
                {MODELOS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              {form.model && MODELOS.find(m=>m.value===form.model) && (
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                  {MODELOS.find(m=>m.value===form.model).desc}
                </div>
              )}
            </div>
          </div>

          {/* Plataformas */}
          <div className="form-group">
            <label className="form-label">Plataformas</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {PLATAFORMAS.map(p=>(
                <button key={p} type="button" onClick={()=>togglePlat(p)}
                  style={{padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',border:'2px solid',
                    borderColor:form.platforms.includes(p)?'var(--accent)':'var(--border)',
                    background:form.platforms.includes(p)?'var(--accent-glow)':'transparent',
                    color:form.platforms.includes(p)?'var(--accent)':'var(--text-muted)'}}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Engajamento + Responsável */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Taxa de engajamento (%)</label>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <input className="form-input" type="number" step="0.01" style={{flex:1}} value={form.engagement_rate}
                  onChange={e=>setForm(f=>({...f,engagement_rate:e.target.value}))} placeholder="3.75"/>
                <button type="button" className="btn btn-ghost btn-sm" title="Calcular engajamento no Social Cat"
                  onClick={()=>{
                    const user = extrairUsername(form.profile_url, form.username)
                    const dest = user
                      ? `https://thesocialcat.com/tools/instagram-engagement-rate-calculator?username=${encodeURIComponent(user)}`
                      : 'https://thesocialcat.com/tools/instagram-engagement-rate-calculator'
                    window.open(dest, '_blank')
                  }}
                  style={{whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:4,padding:'6px 10px',flexShrink:0}}>
                  <ExternalLink size={12}/>
                  Calcular
                </button>
              </div>
              {!(form.profile_url || '').includes('instagram') && !form.engagement_rate && (
                <div style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>
                  Preencha o link do Instagram acima para calcular automaticamente
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Responsável interno</label>
              <select className="form-select" value={form.responsavel_interno_id} onChange={e=>setForm(f=>({...f,responsavel_interno_id:e.target.value}))}>
                <option value="">Sem responsável</option>
                {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contato (WhatsApp/Email)</label>
              <input className="form-input" value={form.contact_value} onChange={e=>setForm(f=>({...f,contact_value:e.target.value}))} placeholder="+55 11 99999-9999"/>
            </div>
            <div className="form-group">
              <label className="form-label">Origem</label>
              <select className="form-select" value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))}>
                <option value="">Selecionar...</option>
                {ORIGENS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* URL da livraria / Cupom conforme o modelo */}
          <div className="form-row">
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
          </div>

          {/* Editoras sugeridas + Livro convidado (lado a lado) */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'start'}}>
          <div className="form-group">
            <label className="form-label">Editoras a oferecer</label>
            {form.editoras_sugeridas.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
                {form.editoras_sugeridas.map(e=>(
                  <span key={e} style={{display:'inline-flex',alignItems:'center',gap:4,background:'var(--accent-glow)',border:'1px solid var(--accent)',borderRadius:20,padding:'2px 10px',fontSize:12,color:'var(--accent)',fontWeight:600}}>
                    {e}
                    <button onClick={()=>setForm(f=>({...f,editoras_sugeridas:f.editoras_sugeridas.filter(x=>x!==e)}))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',padding:0,display:'flex',lineHeight:1}}><X size={11}/></button>
                  </span>
                ))}
              </div>
            )}
            <input className="form-input" value={editoraSearch} onChange={e=>setEditoraSearch(e.target.value)} placeholder="Buscar editora..."/>
            {editoraSearch.trim() && (
              <div style={{border:'1px solid var(--border)',borderRadius:8,marginTop:4,maxHeight:140,overflowY:'auto',background:'var(--surface-2)'}}>
                {editoras.filter(e=>e.toLowerCase().includes(editoraSearch.toLowerCase())&&!form.editoras_sugeridas.includes(e)).length===0
                  ? <div style={{padding:'10px 14px',fontSize:12,color:'var(--text-muted)'}}>Nenhuma editora encontrada</div>
                  : editoras.filter(e=>e.toLowerCase().includes(editoraSearch.toLowerCase())&&!form.editoras_sugeridas.includes(e)).map(e=>(
                      <div key={e} onClick={()=>{setForm(f=>({...f,editoras_sugeridas:[...f.editoras_sugeridas,e]}));setEditoraSearch('')}}
                        style={{padding:'8px 14px',fontSize:13,cursor:'pointer',borderBottom:'1px solid var(--border)'}}
                        onMouseEnter={ev=>ev.currentTarget.style.background='var(--surface-3)'}
                        onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
                        {e}
                      </div>
                    ))
                }
              </div>
            )}
          </div>

          {/* Livro convidado */}
          <div className="form-group">
            <label className="form-label">Livro convidado para divulgar</label>
            {livrosConvidados.length > 0 && (
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:8}}>
                {livrosConvidados.map(l=>(
                  <div key={l.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--accent-glow)',border:'1px solid var(--accent)',borderRadius:8,padding:'6px 12px'}}>
                    <div style={{minWidth:0}}>
                      <span style={{fontSize:13,fontWeight:600,color:'var(--accent)',display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.titulo}</span>
                      {l.autor && <span style={{fontSize:11,color:'var(--text-muted)'}}>{l.autor}</span>}
                    </div>
                    <button onClick={()=>setLivrosConvidados(prev=>prev.filter(x=>x.id!==l.id))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',padding:'0 0 0 8px',display:'flex',flexShrink:0}}><X size={13}/></button>
                  </div>
                ))}
              </div>
            )}
            <input className="form-input" value={livroSearch} onChange={e=>setLivroSearch(e.target.value)} placeholder="Buscar livro pelo título, autor, ISBN ou SKU..."/>
            {livroSearch.trim() && (
              <div style={{border:'1px solid var(--border)',borderRadius:8,marginTop:4,maxHeight:160,overflowY:'auto',background:'var(--surface-2)'}}>
                {livros.filter(l=>
                  (l.titulo||'').toLowerCase().includes(livroSearch.toLowerCase()) ||
                  (l.autor||'').toLowerCase().includes(livroSearch.toLowerCase()) ||
                  (l.isbn||'').toLowerCase().includes(livroSearch.toLowerCase()) ||
                  (l.sku||'').toLowerCase().includes(livroSearch.toLowerCase())
                ).filter(l=>!livrosConvidados.find(x=>x.id===l.id)).slice(0,20).length === 0
                  ? <div style={{padding:'10px 14px',fontSize:12,color:'var(--text-muted)'}}>Nenhum livro encontrado</div>
                  : livros.filter(l=>
                      (l.titulo||'').toLowerCase().includes(livroSearch.toLowerCase()) ||
                      (l.autor||'').toLowerCase().includes(livroSearch.toLowerCase()) ||
                      (l.isbn||'').toLowerCase().includes(livroSearch.toLowerCase()) ||
                      (l.sku||'').toLowerCase().includes(livroSearch.toLowerCase())
                    ).filter(l=>!livrosConvidados.find(x=>x.id===l.id)).slice(0,20).map(l=>(
                      <div key={l.id}
                        onClick={()=>{setLivrosConvidados(prev=>[...prev,l]);setLivroSearch('')}}
                        style={{padding:'8px 14px',cursor:'pointer',borderBottom:'1px solid var(--border)'}}
                        onMouseEnter={ev=>ev.currentTarget.style.background='var(--surface-3)'}
                        onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
                        <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{l.titulo}</div>
                        {l.autor && <div style={{fontSize:11,color:'var(--text-muted)'}}>{l.autor}{l.editora ? ` · ${l.editora}` : ''}</div>}
                      </div>
                    ))
                }
              </div>
            )}
          </div>
          </div>

          {/* Status inicial */}
          <div className="form-group">
            <label className="form-label">Status inicial no pipeline</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {pipeline.map(s=>(
                <button key={s.value} type="button" onClick={()=>setStatusInicial(s.value)}
                  style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',border:`2px solid ${s.cor}`,
                    background:statusInicial===s.value?s.cor:'transparent',
                    color:statusInicial===s.value?'#fff':s.cor,transition:'all 0.15s'}}>
                  {s.label}
                </button>
              ))}
            </div>
            {statusInicial === 'active' && (
              <div style={{marginTop:6,fontSize:11,background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.3)',borderRadius:6,padding:'5px 10px',color:'#22c55e'}}>
                ✓ Este parceiro ficará visível em todo o Orbita imediatamente.
              </div>
            )}
            {statusInicial !== 'active' && (
              <div style={{marginTop:6,fontSize:11,color:'var(--text-muted)'}}>
                O parceiro só aparecerá em outras telas do Orbita quando o status for alterado para <strong>Ativo</strong>.
              </div>
            )}
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving||!form.nome.trim()}>
            {saving?'Salvando...':'Criar parceiro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────

// ── MODAL: CONFIGURAR STATUS DO CRM POR GRUPO ─────────────────
function ModalConfigStatus({ grupo, pipeline, onSave, onClose }) {
  const [items, setItems] = useState(() => (pipeline || []).map(p => ({ ...p })))
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  function addStatus() {
    setItems(prev => [...prev, {
      value: `status_${prev.length}`,
      label: 'Novo status',
      cor: '#6b7280',
      bg: 'rgba(107,114,128,0.12)',
    }])
  }

  function removeStatus(i) {
    if (items.length <= 1) { setErro('É necessário pelo menos um status.'); return }
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  function moveUp(i) {
    if (i === 0) return
    setItems(prev => {
      const arr = [...prev]
      const tmp = arr[i - 1]; arr[i - 1] = arr[i]; arr[i] = tmp
      return arr
    })
  }

  function moveDown(i) {
    if (i === items.length - 1) return
    setItems(prev => {
      const arr = [...prev]
      const tmp = arr[i + 1]; arr[i + 1] = arr[i]; arr[i] = tmp
      return arr
    })
  }

  function updateField(i, field, value) {
    setItems(prev => prev.map((s, idx) => {
      if (idx !== i) return s
      const next = { ...s, [field]: value }
      if (field === 'cor') next.bg = corParaBg(value)
      return next
    }))
  }

  async function salvar() {
    const labels = items.map(s => (s.label || '').trim().toLowerCase())
    if (labels.some(l => !l)) { setErro('Todos os status precisam de um nome.'); return }
    const dup = labels.find((l, i) => labels.indexOf(l) !== i)
    if (dup) { setErro('Há nomes de status duplicados: ' + dup); return }

    setSaving(true); setErro('')
    try {
      const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'status'
      const normalizado = items.map((s, i) => ({
        value: s.value && /^[a-z0-9_]+$/.test(s.value) ? s.value : slugify(s.label) + '_' + i,
        label: s.label.trim(),
        cor:   s.cor || '#6b7280',
        bg:    s.bg || corParaBg(s.cor),
      }))
      await onSave(normalizado)
    } catch (e) { setErro(e?.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{maxWidth:560,maxHeight:'88vh',overflowY:'auto'}}>
        <div className="modal-header">
          <h2 className="modal-title">Configurar status — {grupo || 'CRM'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16}/></button>
        </div>

        <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:14}}>
          Defina os status do pipeline do CRM para este grupo.
          A ordem aqui é a mesma que aparece no kanban.
        </p>

        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
          {items.map((s, i) => (
            <div key={i} style={{
              display:'flex',alignItems:'center',gap:8,
              padding:'8px 10px',background:'var(--surface-2)',
              borderRadius:8,border:'1px solid var(--border)'
            }}>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                <button type="button" onClick={()=>moveUp(i)} disabled={i===0}
                  style={{background:'none',border:'none',cursor:i===0?'default':'pointer',color:i===0?'var(--text-muted)':'var(--text)',padding:0,opacity:i===0?0.3:1}}>▲</button>
                <button type="button" onClick={()=>moveDown(i)} disabled={i===items.length-1}
                  style={{background:'none',border:'none',cursor:i===items.length-1?'default':'pointer',color:i===items.length-1?'var(--text-muted)':'var(--text)',padding:0,opacity:i===items.length-1?0.3:1}}>▼</button>
              </div>
              <input
                type="color"
                value={s.cor || '#6b7280'}
                onChange={e=>updateField(i,'cor',e.target.value)}
                style={{width:32,height:32,border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',background:'transparent',padding:2,flexShrink:0}}
                title="Cor do status"
              />
              <input
                className="form-input"
                value={s.label}
                onChange={e=>updateField(i,'label',e.target.value)}
                placeholder="Nome do status"
                style={{flex:1,fontSize:13}}
              />
              <button type="button"
                className="btn btn-ghost btn-icon btn-sm"
                onClick={()=>removeStatus(i)}
                title="Remover"
                style={{opacity:0.5}}
              ><Trash2 size={13}/></button>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-ghost" onClick={addStatus} style={{width:'100%',marginBottom:14}}>
          <Plus size={14}/> Adicionar status
        </button>

        {erro && (
          <div style={{
            background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',
            color:'#ef4444',padding:'8px 12px',borderRadius:8,
            fontSize:12,marginBottom:14
          }}>{erro}</div>
        )}

        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CRM({ grupo, titulo }) {
  const { usuario } = useAuth()
  const ehAdmin = usuario?.perfil === 'administrador'
  // Grupo recebido como prop (cada rota passa o seu)
  const grupoAtivo = grupo
  const PIPELINE_KEY = grupo  // pipeline é configurado por grupo

  const [parceiros, setParceiros]     = useState([])
  const [todos, setTodos]             = useState([])
  const [pipeline, setPipeline]       = useState(PIPELINE_FALLBACK)
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [modalParceiro, setModalParceiro] = useState(null)
  const [modalNovo, setModalNovo]       = useState(false)
  const [modalConfig, setModalConfig]   = useState(false)
  const [dragId, setDragId]             = useState(null)
  const [dragOverCol, setDragOverCol]   = useState(null)
  const [filtroStatus, setFiltroStatus]   = useState('')
  const [filtroPlat, setFiltroPlat]       = useState('')
  const [filtroResp, setFiltroResp]       = useState('')
  const [filtroOrigem, setFiltroOrigem]   = useState('')
  const [toast, showToast]            = useToast()
  const [visao, setVisao]             = useState('prospeccao') // 'prospeccao' | 'ativos'

  async function carregar() {
    setLoading(true)
    try {
      const [crm, base, pipe] = await Promise.all([
        getCRMParceiros({ grupo: grupoAtivo }),
        getParceiros(),
        getCRMStatusConfig(PIPELINE_KEY),
      ])
      setParceiros(crm)
      setTodos(base)
      setPipeline(pipe)
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [grupoAtivo]) // eslint-disable-line

  async function handleSave(upd) {
    // Recarrega do banco para garantir que current_status e todos os campos estão atualizados
    try {
      const atualizado = await getCRMParceiros({ grupo: grupoAtivo })
      setParceiros(atualizado)
    } catch {
      // Fallback: atualiza só o parceiro editado
      setParceiros(prev => prev.map(p => p.id===upd.id ? { ...p, ...upd } : p))
    }
  }

  function handleNovoParceiro(novo) {
    // Recarrega lista completa para incluir o novo com status correto
    carregar()
    showToast(`${novo.nome} adicionado ao CRM!`)
  }

  async function handleSalvarConfigStatus(novosStatuses) {
    try {
      await saveCRMStatusConfig(PIPELINE_KEY, novosStatuses, usuario?.id)
      setPipeline(await getCRMStatusConfig(PIPELINE_KEY))
      setModalConfig(false)
      showToast('Configuração de status salva!')
    } catch (e) { showToast('Erro ao salvar configuração', 'error') }
  }

  async function handleDeleteParceiro(id, nome) {
    if (!window.confirm(`Excluir "${nome}" do CRM? Esta ação não pode ser desfeita.`)) return
    try {
      await deleteParceiro(id)
      setParceiros(prev => prev.filter(p => p.id !== id))
      showToast(`${nome} excluído.`)
    } catch(e) { showToast('Erro ao excluir', 'error') }
  }

  async function handleDrop(novoStatus) {
    if (!dragId || !novoStatus) { setDragId(null); setDragOverCol(null); return }
    const parceiro = parceiros.find(p => p.id === dragId)
    if (!parceiro || parceiro.current_status === novoStatus) { setDragId(null); setDragOverCol(null); return }
    setDragId(null); setDragOverCol(null)
    // Atualiza estado local imediatamente
    setParceiros(prev => prev.map(p => p.id === dragId ? { ...p, current_status: novoStatus } : p))
    try {
      // Se moveu para 'active', ativar como Bronze automaticamente (modelos 2 e 3)
      if (novoStatus === 'active' && !parceiro.tier && MODELOS_COM_ESCADA.includes(parceiro.model)) {
        await ativarParceiroBronze(dragId, usuario?.id)
        showToast(`${parceiro.nome} → Ativo · Bronze na Escada`)
      } else {
        await addStatusHistory(dragId, novoStatus, 'Status alterado via kanban')
        showToast(`${parceiro.nome} → ${pipelineInfo(novoStatus, pipeline).label}`)
      }
    } catch(e) {
      // Reverte se falhar
      setParceiros(prev => prev.map(p => p.id === dragId ? { ...p, current_status: parceiro.current_status } : p))
      showToast('Erro ao atualizar status', 'error')
    }
  }

  const filtrados = parceiros.filter(p => {
    const q = search.toLowerCase()
    if (q && !(
      p.nome.toLowerCase().includes(q) ||
      (p.username||'').toLowerCase().includes(q) ||
      (p.platforms||[]).some(pl=>pl.toLowerCase().includes(q))
    )) return false
    if (filtroStatus && p.current_status !== filtroStatus) return false
    if (filtroPlat   && !(p.platforms||[]).includes(filtroPlat)) return false
    if (filtroResp   && p.responsavel_interno_id !== filtroResp) return false
    if (filtroOrigem && p.source !== filtroOrigem) return false
    return true
  })
  const temFiltro = filtroStatus || filtroPlat || filtroResp || filtroOrigem

  // Agrupa por status
  const porStatus = {}
  for (const st of pipeline) {
    porStatus[st.value] = filtrados.filter(p => p.current_status === st.value)
  }

  // Status de ciclo de vida — geridos na aba Parceiros Ativos, não no kanban
  const STATUS_LIFECYCLE = ['active', 'paused', 'closed']
  const pipelineProspeccao = pipeline.filter(s => !STATUS_LIFECYCLE.includes(s.value))

  const total = filtrados.length
  const ativos = filtrados.filter(p=>p.current_status==='active').length

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <Users size={22} color="var(--accent)"/>
          <div>
            <h1 className="page-title" style={{margin:0}}>{titulo}</h1>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>
              {total} parceiro{total!==1?'s':''} · {ativos} ativo{ativos!==1?'s':''}
            </p>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="btn btn-primary" onClick={()=>setModalNovo(true)} style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
            <Plus size={15}/> Novo Parceiro
          </button>
          {visao==='prospeccao' && (
            <button className="btn btn-ghost btn-sm" onClick={()=>setModalConfig(true)} title="Configurar status do CRM" style={{marginLeft:6}}>
              <Settings2 size={14}/> Configurar status
            </button>
          )}
        </div>
      </div>

      {/* Abas: Prospecção vs Parceiros ativos */}
      <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'1px solid var(--border)'}}>
        {[
          {v:'prospeccao', l:'Prospecção'},
          {v:'ativos', l:'Parceiros ativos (Escada)'},
          {v:'desempenho', l:'Desempenho'},
        ].map(({v,l})=>(
          <button key={v} onClick={()=>setVisao(v)}
            style={{padding:'10px 20px',background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:700,
              color:visao===v?'var(--accent)':'var(--text-muted)',
              borderBottom:`2px solid ${visao===v?'var(--accent)':'transparent'}`,
              marginBottom:-1,transition:'all 0.15s'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── ABA: PARCEIROS ATIVOS (Escada de Crescimento) ── */}
      {visao==='ativos' && (
        <TabelaAtivos onOpenParceiro={p => setModalParceiro(p)} />
      )}

      {/* ── ABA: DESEMPENHO (Score de engajamento mensal) ── */}
      {visao==='desempenho' && (
        <DesempenhoMensal />
      )}

      {/* ── ABA: PROSPECÇÃO (Kanban original) ── */}
      {visao==='prospeccao' && (<>

      {/* Filtros da prospecção */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{position:'relative'}}>
          <Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
          <input className="search-input" style={{paddingLeft:32}} placeholder="Buscar parceiro..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}} value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {pipelineProspeccao.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}} value={filtroPlat} onChange={e=>setFiltroPlat(e.target.value)}>
          <option value="">Todas as plataformas</option>
          {PLATAFORMAS.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}} value={filtroResp} onChange={e=>setFiltroResp(e.target.value)}>
          <option value="">Todos os responsáveis</option>
          {[...new Map(parceiros.filter(p=>p.responsavel_interno_id&&p.responsavel_interno_nome).map(p=>[p.responsavel_interno_id,p])).values()].map(p=>(
            <option key={p.responsavel_interno_id} value={p.responsavel_interno_id}>{p.responsavel_interno_nome}</option>
          ))}
        </select>
        <select className="form-select" style={{width:'auto',fontSize:12,padding:'6px 10px'}} value={filtroOrigem} onChange={e=>setFiltroOrigem(e.target.value)}>
          <option value="">Todas as origens</option>
          {ORIGENS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {temFiltro && (
          <button className="btn btn-ghost btn-sm" onClick={()=>{setFiltroStatus('');setFiltroPlat('');setFiltroResp('');setFiltroOrigem('')}}>
            <X size={12}/> Limpar
          </button>
        )}
      </div>

      {loading
        ? <div className="loading"><div className="spinner"/></div>
        : (
          <div style={{overflowX:'auto',paddingBottom:16}}>
            <div style={{display:'flex',gap:14,minWidth:'max-content'}}>
              {/* Colunas do pipeline (só prospecção) */}
              {pipelineProspeccao.map(st=>{
                const items = porStatus[st.value] || []
                return (
                  <div key={st.value} style={{width:220,flexShrink:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10,padding:'6px 10px',background:st.bg,border:`1px solid ${st.cor}30`,borderRadius:8}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:st.cor}}/>
                      <span style={{fontSize:12,fontWeight:700,color:st.cor,flex:1}}>{st.label}</span>
                      <span style={{fontSize:11,color:st.cor,background:'var(--surface)',border:`1px solid ${st.cor}30`,borderRadius:20,padding:'1px 7px'}}>{items.length}</span>
                    </div>
                    <div
                      onDragOver={e=>{ e.preventDefault(); setDragOverCol(st.value) }}
                      onDragLeave={()=>setDragOverCol(null)}
                      onDrop={e=>{ e.preventDefault(); handleDrop(st.value) }}
                      style={{minHeight:60,borderRadius:8,transition:'background 0.15s',
                        background: dragOverCol===st.value ? `${st.cor}18` : 'transparent',
                        border: dragOverCol===st.value ? `2px dashed ${st.cor}` : '2px solid transparent',
                        padding:2}}>
                      {items.length===0
                        ? <div style={{padding:'16px 10px',textAlign:'center',fontSize:12,color:'var(--text-muted)'}}>
                            {dragOverCol===st.value ? `Soltar aqui` : 'Vazio'}
                          </div>
                        : items.map(p=>(
                            <KanbanCard key={p.id} parceiro={p}
                              onClick={()=>setModalParceiro(p)}
                              onDragStart={()=>setDragId(p.id)}
                              onDragEnd={()=>{ setDragId(null); setDragOverCol(null) }}
                              isDragging={dragId===p.id}
                              onDelete={()=>handleDeleteParceiro(p.id, p.nome)}/>
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

      </>)}

      {modalConfig && (
        <ModalConfigStatus
          grupo={PIPELINE_KEY}
          pipeline={pipeline}
          userId={usuario?.id}
          onSave={handleSalvarConfigStatus}
          onClose={()=>setModalConfig(false)}/>
      )}

      {modalNovo && (
        <ModalNovoParceiro
          onSave={handleNovoParceiro}
          onClose={()=>setModalNovo(false)}
          pipeline={pipeline}
          grupo={grupoAtivo}/>
      )}
      {modalParceiro && (
        <ModalParceiroCRM
          parceiro={modalParceiro}
          todos={todos}
          onSave={handleSave}
          onClose={()=>setModalParceiro(null)}
         pipeline={pipeline}/>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
