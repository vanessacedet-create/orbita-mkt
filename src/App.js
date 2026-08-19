import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useState, useEffect } from 'react'
import { AuthProvider, useAuth, MODULOS_PERMISSOES } from './context/AuthContext'
import { ViewAsContext } from './context/ViewAsContext'
import { usePermissions } from './hooks/usePermissions'
import { signOut, supabase, getUsuarios } from './lib/supabase'
import {
  LayoutDashboard,
  BookOpen,
  Users,
  LogOut,
  Orbit,
  ShieldAlert,
  Megaphone,
  CalendarDays,
  CheckSquare,
  UserRound,
  Eye,
  Network,
  Calculator,
  HeartHandshake,
  CalendarCheck,
  GraduationCap,
  Store,
  FileText,
  SwitchCamera,
  X,
  Search,
  ChevronDown,
  Target,
  TrendingUp,
  Activity,
  CalendarRange,
  Settings,
  BookMarked,
  Building2,
  Clock,
} from 'lucide-react'
import './App.css'

import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'

const Dashboard              = lazy(() => import('./pages/Dashboard'))
const TarefasParceiras       = lazy(() => import('./pages/TarefasParceiras'))
const TarefasInfluencers2    = lazy(() => import('./pages/TarefasInfluencersOrganizadas'))
const TarefasMarketplaces    = lazy(() => import('./pages/TarefasMarketplaces'))
const DashboardParceiras     = lazy(() => import('./pages/DashboardParceiras'))
const BemVindo               = lazy(() => import('./pages/BemVindo'))
const AcessosEquipe          = lazy(() => import('./pages/AcessosEquipe'))
const Cortesias              = lazy(() => import('./pages/Cortesias'))
const Usuarios               = lazy(() => import('./pages/Usuarios'))
const Campanhas              = lazy(() => import('./pages/Campanhas'))
const Lancamentos            = lazy(() => import('./pages/Lancamentos'))
const Tarefas                = lazy(() => import('./pages/Tarefas'))
const BaseComando            = lazy(() => import('./pages/BaseComando'))
const Parceiros              = lazy(() => import('./pages/Parceiros'))
const Monitoramento          = lazy(() => import('./pages/Monitoramento'))
const MonitoramentoParceiras = lazy(() => import('./pages/MonitoramentoParceiras'))
const CRM                    = lazy(() => import('./pages/CRM'))
const CRMEditorasParceiras   = lazy(() => import('./pages/CRMEditorasParceiras'))
const EditorasLivrarias      = lazy(() => import('./pages/EditorasLivrarias'))
const PromocoesParceiras     = lazy(() => import('./pages/PromocoesParceiras'))
const Calculadora            = lazy(() => import('./pages/Calculadora'))
const CalculadoraInfluenciadores = lazy(() => import('./pages/CalculadoraInfluenciadores'))
const RH                     = lazy(() => import('./pages/RH'))
const RHParceiras            = lazy(() => import('./pages/RHParceiras'))
const Eventos                = lazy(() => import('./pages/Eventos'))
const Treinamentos           = lazy(() => import('./pages/Treinamentos'))
const TreinamentosParceiras  = lazy(() => import('./pages/TreinamentosParceiras'))
const JornadaParceiras       = lazy(() => import('./pages/JornadaParceiras'))
const PDA                    = lazy(() => import('./pages/PDA'))
const PDAParceiras           = lazy(() => import('./pages/PDAParceiras'))
const VitrinePublica         = lazy(() => import('./pages/VitrinePublica'))
const VitrineAdmin           = lazy(() => import('./pages/VitrineAdmin'))
const GuiaParcerias          = lazy(() => import('./pages/GuiaParcerias'))
const CacLtv                 = lazy(() => import('./pages/CacLtv'))
const PedidosCRM             = lazy(() => import('./pages/PedidosCRM'))
const CRMInteligencia        = lazy(() => import('./pages/CRMInteligencia'))
const Agenda                 = lazy(() => import('./pages/Agenda'))
const Configuracoes          = lazy(() => import('./pages/Configuracoes'))
const BlocoNotas             = lazy(() => import('./pages/BlocoNotas'))

const PERFIS_PARCEIRAS = ['supervisor_parceiras', 'analista_parceiras', 'estagiario_parceiras']

// ⚠️ TROQUE pelo SEU e-mail de login (o MESMO que está em BaseComando.js).
// Só esse e-mail vê o item "Base de Comando" no menu.
const DONO_EMAIL = 'vanessa@cedet.com.br'

const MENU = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, modulo: 'dashboard', ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/dashboard-parceiras', label: 'Dashboard', icon: LayoutDashboard, modulo: 'tarefas_parceiras' },
  { path: '/notas', label: 'Bloco de Notas', icon: BookMarked, modulo: 'tarefas_parceiras', sempreVisivel: true },
  { path: '/base-comando', label: 'Base de Comando', icon: Activity, modulo: 'base_comando', sempreVisivel: true, soEmail: true },
  { path: '/crm-influencers', label: 'CRM Influencers', icon: Network, modulo: 'crm_influencers', ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/calculadora-influenciadores', label: 'Calculadora Influencers', icon: Calculator, modulo: 'calculadora_influenciadores', ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/crm-parceiras', label: 'CRM Parceiras', icon: Network, modulo: 'crm_parceiras', ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/cortesias', label: 'Cortesias', icon: BookOpen, modulo: 'cortesias', ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/promocoes-parceiras', label: 'Promoções', icon: Megaphone, modulo: 'tarefas_parceiras' },
  { path: '/campanhas', label: 'Campanhas', icon: Megaphone, modulo: 'campanhas', ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/monitoramento', label: 'Monitoramento', icon: Eye, modulo: 'monitoramento', ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/lancamentos', label: 'Lançamentos', icon: CalendarDays, modulo: 'lancamentos' },
  { path: '/tarefas-influencers', label: 'Tarefas Influencers', icon: CheckSquare, modulo: 'tarefas_influencers', ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/tarefas-marketplaces', label: 'Tarefas Marketplaces', icon: CheckSquare, modulo: 'tarefas_marketplaces', ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/agenda', label: 'Agenda', icon: CalendarRange, modulo: 'tarefas_parceiras' },
  { path: '/tarefas-parceiras', label: 'Tarefas Parceiras', icon: CheckSquare, modulo: 'tarefas_parceiras' },
  { path: '/monitoramento-parceiras', label: 'Monitoramento', icon: Eye, modulo: 'tarefas_parceiras', ocultarPerfis: [] },
  { path: '/editoras-livrarias', label: 'Editoras & Livrarias', icon: Building2, modulo: 'tarefas_parceiras' },
  { path: '/crm-editoras-parceiras', label: 'CRM Editoras', icon: TrendingUp, modulo: 'tarefas_parceiras' },
  { path: '/rh-parceiras', label: 'RH', icon: HeartHandshake, modulo: 'rh_parceiras' },
  { path: '/pda-parceiras', label: 'PDA', icon: Target, modulo: 'pda_parceiras' },
  { path: '/treinamentos-parceiras', label: 'Treinamentos', icon: GraduationCap, modulo: 'treinamentos_parceiras' },
  { path: '/jornada-parceiras', label: 'Controle de Jornada', icon: Clock, modulo: 'jornada_parceiras' },
  { path: '/configuracoes', label: 'Configurações', icon: Settings, modulo: 'dashboard', sempreVisivel: true },
  { path: '/rh', label: 'RH', icon: HeartHandshake, modulo: 'rh' },
  { path: '/pda', label: 'PDA', icon: Target, modulo: 'pda' },
  { path: '/treinamentos', label: 'Treinamentos', icon: GraduationCap, modulo: 'treinamentos' },
  { path: '/eventos', label: 'Eventos', icon: CalendarCheck, modulo: 'eventos' },
  { path: '/vitrine-admin', label: 'Vitrine', icon: Store, modulo: 'parceiros' },
  { path: '/acessos-equipe', label: 'Acessos da Equipe', icon: Users, modulo: 'acessos_equipe' },
  { path: '/usuarios', label: 'Usuários', icon: Users, modulo: 'usuarios' },
]

const ADMIN_MENU_GRUPOS = [
  {
    key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard,
    items: [
      { path: '/dashboard', label: 'Visão geral' },
      { path: '/dashboard-parceiras', label: 'Editoras Parceiras' },
    ],
  },
  {
    key: 'crm', label: 'CRM', icon: Network,
    items: [
      { path: '/crm-influencers', label: 'Influencers' },
      { path: '/crm-editoras-parceiras', label: 'Editoras Parceiras' },
    ],
  },
  {
    key: 'campanhas', label: 'Campanhas', icon: Megaphone,
    items: [
      { path: '/campanhas', label: 'Influencers' },
      { path: '/promocoes-parceiras', label: 'Editoras Parceiras / Promoções' },
    ],
  },
  {
    key: 'monitoramento', label: 'Monitoramento', icon: Eye,
    items: [
      { path: '/monitoramento', label: 'Influencers' },
      { path: '/monitoramento-parceiras', label: 'Editoras Parceiras' },
    ],
  },
  {
    key: 'tarefas', label: 'Tarefas', icon: CheckSquare,
    items: [
      { path: '/tarefas-influencers', label: 'Influencers' },
      { path: '/tarefas-marketplaces', label: 'Marketplaces' },
      { path: '/tarefas-parceiras', label: 'Editoras Parceiras' },
    ],
  },
  {
    key: 'rh', label: 'RH', icon: HeartHandshake,
    items: [
      { path: '/rh', label: 'Equipe Geral' },
      { path: '/rh-parceiras', label: 'Editoras Parceiras' },
    ],
  },
  {
    key: 'pda', label: 'PDA', icon: Target,
    items: [
      { path: '/pda', label: 'Equipe Geral' },
      { path: '/pda-parceiras', label: 'Editoras Parceiras' },
    ],
  },
  {
    key: 'treinamentos', label: 'Treinamentos', icon: GraduationCap,
    items: [
      { path: '/treinamentos', label: 'Equipe Geral' },
      { path: '/treinamentos-parceiras', label: 'Editoras Parceiras' },
    ],
  },
]

const ADMIN_MENU_OCULTOS = new Set([
  '/crm-parceiras',
  '/notas',
  '/agenda',
  '/editoras-livrarias',
  '/jornada-parceiras',
])

const PERFIL_LABEL = {
  administrador: 'Administrador', gerente: 'Gerente', estagiario_proprias: 'Estagiário Próprias', analista_proprias: 'Analista Próprias', supervisor_proprias: 'Supervisor Próprias', estagiario_influencers: 'Estagiário Influencers', analista_influencers: 'Analista Influencers', estagiario_marketplaces: 'Estagiário Mkt & Eventos', analista_marketplaces: 'Analista Mkt & Eventos', estagiario_parceiras: 'Estagiário Parceiras', analista_parceiras: 'Analista Parceiras', supervisor_parceiras: 'Supervisor Parceiras',
}
const PERFIL_COLOR = {
  administrador: 'var(--accent)', gerente: 'var(--indigo)', estagiario_proprias: '#06b6d4', analista_proprias: '#06b6d4', supervisor_proprias: '#8b5cf6', estagiario_influencers: '#22c55e', analista_influencers: '#22c55e', estagiario_marketplaces: '#f97316', analista_marketplaces: '#f97316', estagiario_parceiras: '#f43f5e', analista_parceiras: '#f43f5e', supervisor_parceiras: '#e11d48',
}
const PODE_VER_COMO = ['administrador', 'gerente']
function canPerfil(perfil, modulo) { if (!perfil || !modulo) return false; return (MODULOS_PERMISSOES[modulo] || []).includes(perfil) }
function RequireAuth({ children, modulo }) { const { session, loading } = useAuth(); const { can } = usePermissions(); if (loading) return <div className="loading"><div className="spinner" /></div>; if (!session) return <Navigate to="/login" replace />; if (modulo && !can(modulo)) return <SemAcesso />; return children }
function SemAcesso() { return <div className="sem-acesso"><ShieldAlert size={40} strokeWidth={1.2} /><h2>Acesso não permitido</h2><p>Você não tem permissão para acessar este módulo.</p></div> }
function ModalVerComo({ todosUsuarios, usuarioAtual, onSelecionar, onFechar }) {
  const [busca, setBusca] = useState('')
  const filtrados = todosUsuarios.filter(u => u.id !== usuarioAtual?.id).filter(u => !busca || u.nome?.toLowerCase().includes(busca.toLowerCase()) || (PERFIL_LABEL[u.perfil] || u.perfil || '').toLowerCase().includes(busca.toLowerCase()))
  return <div onClick={onFechar} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><div onClick={e=>e.stopPropagation()} style={{background:'var(--sidebar-bg,#1a1a2e)',border:'1px solid var(--border,#2a2a3e)',borderRadius:14,width:'100%',maxWidth:420,maxHeight:'75vh',overflow:'auto',padding:14}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}><strong>Visualizar como</strong><button onClick={onFechar} className="btn btn-ghost btn-icon"><X size={16}/></button></div><div style={{position:'relative',marginBottom:8}}><Search size={14} style={{position:'absolute',left:10,top:10}}/><input autoFocus placeholder="Buscar por nome ou perfil..." value={busca} onChange={e=>setBusca(e.target.value)} style={{width:'100%',padding:'8px 10px 8px 30px',boxSizing:'border-box'}}/></div>{filtrados.map(u=><button key={u.id} onClick={()=>onSelecionar(u)} style={{width:'100%',padding:10,background:'none',border:'none',textAlign:'left',color:'inherit',cursor:'pointer'}}>{u.nome} · {PERFIL_LABEL[u.perfil] || u.perfil}</button>)}</div></div>
}
function BannerVerComo({ viewAs, onSair }) { return <div style={{background:'linear-gradient(90deg,#92400e,#b45309)',color:'#fef3c7',padding:'9px 20px',display:'flex',alignItems:'center',gap:10,fontSize:13}}><SwitchCamera size={15}/><span style={{flex:1}}>Modo visualização: <strong>{viewAs.nome}</strong></span><button onClick={onSair} className="btn btn-ghost btn-sm"><X size={13}/> Sair</button></div> }

function MenuAdminUnificado({ menuVisivel, pedidosNovos }) {
  const location = useLocation()
  const [abertos, setAbertos] = useState({})
  const menuAdmin = menuVisivel.filter(item => !ADMIN_MENU_OCULTOS.has(item.path))
  const porPath = new Map(menuAdmin.map(item => [item.path, item]))
  const pathsAgrupados = new Set(ADMIN_MENU_GRUPOS.flatMap(g => g.items.map(i => i.path)))
  const gruposRenderizados = new Set()
  const saida = []

  function linkNormal(item) {
    const Icon = item.icon
    return <NavLink key={item.path} to={item.path} className={({isActive})=>isActive?'nav-item active':'nav-item'}><Icon size={17}/><span>{item.label}</span>{item.path==='/vitrine-admin'&&pedidosNovos>0&&<span style={{marginLeft:'auto'}}>{pedidosNovos}</span>}</NavLink>
  }

  for (const item of menuAdmin) {
    if (!pathsAgrupados.has(item.path)) {
      saida.push(linkNormal(item))
      continue
    }

    const grupo = ADMIN_MENU_GRUPOS.find(g => g.items.some(i => i.path === item.path))
    if (!grupo || gruposRenderizados.has(grupo.key)) continue
    gruposRenderizados.add(grupo.key)

    const filhos = grupo.items.map(cfg => porPath.has(cfg.path) ? { ...porPath.get(cfg.path), labelAdmin: cfg.label } : null).filter(Boolean)
    if (!filhos.length) continue

    const ativo = filhos.some(f => location.pathname === f.path)
    const aberto = abertos[grupo.key] ?? ativo
    const Icon = grupo.icon

    saida.push(
      <div key={`grupo-${grupo.key}`}>
        <button type="button" className={`nav-item ${ativo ? 'active' : ''}`} onClick={()=>setAbertos(prev=>({...prev,[grupo.key]:!(prev[grupo.key] ?? ativo)}))} style={{width:'100%',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
          <Icon size={17}/><span>{grupo.label}</span><ChevronDown size={14} style={{marginLeft:'auto',transform:aberto?'rotate(180deg)':'none',transition:'transform .15s'}}/>
        </button>
        {aberto && <div style={{display:'flex',flexDirection:'column',gap:2,margin:'2px 0 6px'}}>{filhos.map(f=><NavLink key={f.path} to={f.path} className={({isActive})=>isActive?'nav-item active':'nav-item'} style={{paddingLeft:38,fontSize:12}}><span>{f.labelAdmin}</span></NavLink>)}</div>}
      </div>
    )
  }

  return <>{saida}</>
}

function Shell() {
  const { usuario, session } = useAuth()
  const [pedidosNovos, setPedidosNovos] = useState(0)
  const [tema, setTema] = useState(() => { try { return localStorage.getItem('orbita_tema') || 'dark' } catch { return 'dark' } })
  const [corDestaque, setCorDestaque] = useState(() => { try { return localStorage.getItem('orbita_cor') || '#e06030' } catch { return '#e06030' } })
  const [corHSL, setCorHSL] = useState(() => { try { return JSON.parse(localStorage.getItem('orbita_cor_hsl') || 'null') } catch { return null } })
  useEffect(() => { document.documentElement.setAttribute('data-theme', tema) }, [tema])
  useEffect(() => { if (corHSL) { document.documentElement.style.setProperty('--accent-h', String(corHSL.h)); document.documentElement.style.setProperty('--accent-s', corHSL.s); document.documentElement.style.setProperty('--accent-l', corHSL.l) } }, [corHSL])
  function handleTemaChange(novoTema) { setTema(novoTema); try { localStorage.setItem('orbita_tema', novoTema) } catch {} }
  function handleCorChange(cor) { setCorDestaque(cor.hex); setCorHSL({h:cor.h,s:cor.s,l:cor.l}); try { localStorage.setItem('orbita_cor',cor.hex); localStorage.setItem('orbita_cor_hsl',JSON.stringify({h:cor.h,s:cor.s,l:cor.l})) } catch {} }
  const [viewAs, setViewAs] = useState(null), [showModal, setShowModal] = useState(false), [todosUsuarios, setTodosUsuarios] = useState([])
  const podeUsarVerComo = PODE_VER_COMO.includes(usuario?.perfil)
  useEffect(() => { if (podeUsarVerComo && showModal) getUsuarios().then(data=>setTodosUsuarios(data||[])).catch(()=>{}) }, [podeUsarVerComo, showModal])
  const perfilAtivo = viewAs?.perfil || usuario?.perfil, abasExtrasAtivo = viewAs?.abas_extras || usuario?.abas_extras || []
  function canAtivo(modulo) { return canPerfil(perfilAtivo, modulo) || abasExtrasAtivo.includes(modulo) }
  useEffect(() => { async function f(){ const {count}=await supabase.from('vitrine_pedidos').select('*',{count:'exact',head:true}).eq('status','novo'); setPedidosNovos(count||0)} f(); const i=setInterval(f,30000); return()=>clearInterval(i)},[])
  async function handleLogout(){ setViewAs(null); await signOut() }
  const ehDono=(session?.user?.email||'').toLowerCase()===DONO_EMAIL.toLowerCase()
  const menuVisivel=MENU.filter(m=>{if(m.soEmail&&!ehDono)return false;if(m.ocultarPerfis&&m.ocultarPerfis.includes(perfilAtivo))return false;return m.sempreVisivel||canAtivo(m.modulo)}).filter((m,i,a)=>a.findIndex(x=>x.path===m.path)===i)
  const usuarioDisplay=viewAs||usuario
  return <ViewAsContext.Provider value={{perfilAtivo,usuarioAtivo:usuarioDisplay,estaEmModoVisual:!!viewAs}}><div className="app-shell"><aside className="sidebar"><div className="sidebar-brand"><Orbit size={20} strokeWidth={1.5} className="brand-icon"/><div><div className="brand-name">Orbita MKT</div><div className="brand-sub">CEDET</div></div></div><nav className="sidebar-nav">{perfilAtivo==='administrador'?<MenuAdminUnificado menuVisivel={menuVisivel} pedidosNovos={pedidosNovos}/>:menuVisivel.map(({path,label,icon:Icon})=><NavLink key={path} to={path} className={({isActive})=>isActive?'nav-item active':'nav-item'}><Icon size={17}/><span>{label}</span>{path==='/vitrine-admin'&&pedidosNovos>0&&<span style={{marginLeft:'auto'}}>{pedidosNovos}</span>}</NavLink>)}</nav>{podeUsarVerComo&&<button onClick={()=>setShowModal(true)} className="btn btn-ghost" style={{margin:10}}><SwitchCamera size={14}/> Visualizar como...</button>}<div className="sidebar-user">{usuarioDisplay&&<><div className="user-avatar">{(usuarioDisplay.nome||'U')[0].toUpperCase()}</div><div className="user-info"><div className="user-name">{usuarioDisplay.nome}</div><div className="user-perfil" style={{color:PERFIL_COLOR[usuarioDisplay.perfil]}}>{PERFIL_LABEL[usuarioDisplay.perfil]||usuarioDisplay.perfil}</div></div></>}<button className="btn-logout" onClick={handleLogout}><LogOut size={15}/></button></div></aside><main className="main-content" style={{display:'flex',flexDirection:'column'}}>{viewAs&&<BannerVerComo viewAs={viewAs} onSair={()=>setViewAs(null)}/>}<div style={{flex:1,overflow:'auto'}}><Suspense fallback={<div className="loading"><div className="spinner"/></div>}><Routes>
    <Route path="/" element={<RequireAuth><BemVindo menu={menuVisivel}/></RequireAuth>}/><Route path="/dashboard" element={<RequireAuth modulo="dashboard"><Dashboard/></RequireAuth>}/><Route path="/dashboard-parceiras" element={<RequireAuth modulo="tarefas_parceiras"><DashboardParceiras/></RequireAuth>}/><Route path="/base-comando" element={<RequireAuth><BaseComando/></RequireAuth>}/><Route path="/cortesias" element={<RequireAuth modulo="cortesias"><Cortesias/></RequireAuth>}/><Route path="/parceiros" element={<RequireAuth modulo="parceiros"><Parceiros/></RequireAuth>}/><Route path="/usuarios" element={<RequireAuth modulo="usuarios"><Usuarios/></RequireAuth>}/><Route path="/acessos-equipe" element={<RequireAuth modulo="acessos_equipe"><AcessosEquipe/></RequireAuth>}/><Route path="/campanhas" element={<RequireAuth modulo="campanhas"><Campanhas/></RequireAuth>}/><Route path="/monitoramento" element={<RequireAuth modulo="monitoramento"><Monitoramento/></RequireAuth>}/><Route path="/monitoramento-parceiras" element={<RequireAuth modulo="tarefas_parceiras"><MonitoramentoParceiras/></RequireAuth>}/><Route path="/crm-influencers" element={<RequireAuth modulo="crm_influencers"><CRM grupo="influencers" titulo="CRM Influencers"/></RequireAuth>}/><Route path="/calculadora-influenciadores" element={<RequireAuth modulo="calculadora_influenciadores"><CalculadoraInfluenciadores/></RequireAuth>}/><Route path="/crm-parceiras" element={<RequireAuth modulo="crm_parceiras"><CRM grupo="parceiras" titulo="CRM Parceiras"/></RequireAuth>}/><Route path="/crm-editoras-parceiras" element={<RequireAuth modulo="tarefas_parceiras"><CRMEditorasParceiras/></RequireAuth>}/><Route path="/editoras-livrarias" element={<RequireAuth modulo="tarefas_parceiras"><EditorasLivrarias/></RequireAuth>}/><Route path="/promocoes-parceiras" element={<RequireAuth modulo="tarefas_parceiras"><PromocoesParceiras/></RequireAuth>}/><Route path="/calculadora" element={<RequireAuth modulo="calculadora"><Calculadora/></RequireAuth>}/><Route path="/rh" element={<RequireAuth modulo="rh"><RH/></RequireAuth>}/><Route path="/rh-parceiras" element={<RequireAuth modulo="rh_parceiras"><RHParceiras/></RequireAuth>}/><Route path="/eventos" element={<RequireAuth modulo="eventos"><Eventos/></RequireAuth>}/><Route path="/lancamentos" element={<RequireAuth modulo="lancamentos"><Lancamentos/></RequireAuth>}/><Route path="/tarefas" element={<RequireAuth modulo="tarefas"><Tarefas/></RequireAuth>}/><Route path="/tarefas-parceiras" element={<RequireAuth modulo="tarefas_parceiras"><TarefasParceiras grupo="parceiras" titulo="Tarefas — Editoras Parceiras"/></RequireAuth>}/><Route path="/tarefas-influencers" element={<RequireAuth modulo="tarefas_influencers"><TarefasInfluencers2/></RequireAuth>}/><Route path="/tarefas-marketplaces" element={<RequireAuth modulo="tarefas_marketplaces"><TarefasMarketplaces/></RequireAuth>}/><Route path="/agenda" element={<RequireAuth modulo="tarefas_parceiras"><Agenda/></RequireAuth>}/><Route path="/treinamentos" element={<RequireAuth modulo="treinamentos"><Treinamentos/></RequireAuth>}/><Route path="/treinamentos-parceiras" element={<RequireAuth modulo="treinamentos_parceiras"><TreinamentosParceiras/></RequireAuth>}/><Route path="/jornada-parceiras" element={<RequireAuth modulo="jornada_parceiras"><JornadaParceiras/></RequireAuth>}/><Route path="/pda" element={<RequireAuth modulo="pda"><PDA/></RequireAuth>}/><Route path="/pda-parceiras" element={<RequireAuth modulo="pda_parceiras"><PDAParceiras/></RequireAuth>}/><Route path="/cac-ltv" element={<RequireAuth modulo="cac_ltv"><CacLtv/></RequireAuth>}/><Route path="/vitrine-admin" element={<RequireAuth modulo="parceiros"><VitrineAdmin/></RequireAuth>}/><Route path="/guia-parcerias" element={<RequireAuth modulo="guia_parcerias"><GuiaParcerias/></RequireAuth>}/><Route path="/pedidos-crm" element={<RequireAuth modulo="pedidos_crm"><PedidosCRM/></RequireAuth>}/><Route path="/crm-inteligencia" element={<RequireAuth modulo="crm_inteligencia"><CRMInteligencia/></RequireAuth>}/><Route path="/notas" element={<RequireAuth><BlocoNotas/></RequireAuth>}/><Route path="/configuracoes" element={<RequireAuth><Configuracoes tema={tema} corDestaque={corDestaque} onTemaChange={handleTemaChange} onCorChange={handleCorChange}/></RequireAuth>}/>
  </Routes></Suspense></div></main>{showModal&&<ModalVerComo todosUsuarios={todosUsuarios} usuarioAtual={usuario} onSelecionar={u=>{setViewAs(u);setShowModal(false)}} onFechar={()=>setShowModal(false)}/>}</div></ViewAsContext.Provider>
}

export default function App(){return <AuthProvider><BrowserRouter><Suspense fallback={<div className="loading"><div className="spinner"/></div>}><Routes><Route path="/login" element={<PublicRoute><Login/></PublicRoute>}/><Route path="/reset-password" element={<ResetPassword/>}/><Route path="/vitrine" element={<VitrinePublica/>}/><Route path="/*" element={<RequireAuth><Shell/></RequireAuth>}/></Routes></Suspense></BrowserRouter></AuthProvider>}
function PublicRoute({children}){const{session,loading}=useAuth();if(loading)return <div className="loading"><div className="spinner"/></div>;if(session)return <Navigate to="/" replace/>;return children}
