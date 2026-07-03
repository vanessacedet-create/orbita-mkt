import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
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
} from 'lucide-react'
import './App.css'

import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'

const Dashboard              = lazy(() => import('./pages/Dashboard'))
const TarefasParceiras       = lazy(() => import('./pages/TarefasParceiras'))
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
const RH                     = lazy(() => import('./pages/RH'))
const Eventos                = lazy(() => import('./pages/Eventos'))
const Treinamentos           = lazy(() => import('./pages/Treinamentos'))
const PDA                    = lazy(() => import('./pages/PDA'))
const VitrinePublica         = lazy(() => import('./pages/VitrinePublica'))
const VitrineAdmin           = lazy(() => import('./pages/VitrineAdmin'))
const GuiaParcerias          = lazy(() => import('./pages/GuiaParcerias'))
const CacLtv                 = lazy(() => import('./pages/CacLtv'))
const PedidosCRM             = lazy(() => import('./pages/PedidosCRM'))
const CRMInteligencia        = lazy(() => import('./pages/CRMInteligencia'))
const Agenda                 = lazy(() => import('./pages/Agenda'))
const Configuracoes          = lazy(() => import('./pages/Configuracoes'))
const BlocoNotas             = lazy(() => import('./pages/BlocoNotas'))
const TarefasInfluencers     = lazy(() => import('./pages/TarefasInfluencers'))

const PERFIS_PARCEIRAS = ['supervisor_parceiras', 'analista_parceiras', 'estagiario_parceiras']

// ⚠️ TROQUE pelo SEU e-mail de login (o MESMO que está em BaseComando.js).
// Só esse e-mail vê o item "Base de Comando" no menu.
const DONO_EMAIL = 'vanessa@cedet.com.br'

const MENU = [
  // Dashboard — cada perfil vê o seu
  { path: '/dashboard',              label: 'Dashboard',          icon: LayoutDashboard, modulo: 'dashboard',         ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/dashboard-parceiras',   label: 'Dashboard',          icon: LayoutDashboard, modulo: 'tarefas_parceiras' },
  { path: '/notas',                 label: 'Bloco de Notas',     icon: BookMarked,      modulo: 'tarefas_parceiras', sempreVisivel: true },
  { path: '/tarefas-influencers', label: 'Tarefas Diárias', icon: CheckSquare, modulo: 'tarefas_diarias_influencers', ocultarPerfis: PERFIS_PARCEIRAS },

  // Área pessoal — visível somente para o DONO_EMAIL
  { path: '/base-comando',          label: 'Base de Comando',    icon: Activity,        modulo: 'base_comando',      sempreVisivel: true, soEmail: true },

  // Módulos gerais (ocultos para parceiras)
  { path: '/crm-influencers',       label: 'CRM Influencers',    icon: Network,         modulo: 'crm_influencers',   ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/crm-parceiras',         label: 'CRM Parceiras',      icon: Network,         modulo: 'crm_parceiras',     ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/cortesias',             label: 'Cortesias',          icon: BookOpen,        modulo: 'cortesias',         ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/promocoes-parceiras',   label: 'Promoções',          icon: Megaphone,       modulo: 'tarefas_parceiras' },
  { path: '/campanhas',             label: 'Campanhas',          icon: Megaphone,       modulo: 'campanhas',         ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/monitoramento',         label: 'Monitoramento',      icon: Eye,             modulo: 'monitoramento',     ocultarPerfis: PERFIS_PARCEIRAS },
  { path: '/lancamentos',           label: 'Lançamentos',        icon: CalendarDays,    modulo: 'lancamentos' },
  { path: '/tarefas',              label: 'Tarefas',             icon: CheckSquare,     modulo: 'tarefas',           ocultarPerfis: PERFIS_PARCEIRAS },

  // Módulos exclusivos parceiras
  { path: '/agenda',                label: 'Agenda',             icon: CalendarRange,   modulo: 'tarefas_parceiras' },
  { path: '/tarefas-parceiras',     label: 'Tarefas Parceiras',  icon: CheckSquare,     modulo: 'tarefas_parceiras' },
  { path: '/monitoramento-parceiras', label: 'Monitoramento',    icon: Eye,             modulo: 'tarefas_parceiras', ocultarPerfis: [] },
  { path: '/editoras-livrarias',    label: 'Editoras & Livrarias', icon: Building2,     modulo: 'tarefas_parceiras' },
  { path: '/crm-editoras-parceiras', label: 'CRM Editoras',      icon: TrendingUp,      modulo: 'tarefas_parceiras' },

  // Módulos compartilhados
  { path: '/configuracoes',         label: 'Configurações',      icon: Settings,        modulo: 'dashboard',         sempreVisivel: true },
  { path: '/rh',                    label: 'RH',                 icon: HeartHandshake,  modulo: 'rh' },
  { path: '/pda',                   label: 'PDA',                icon: Target,          modulo: 'pda' },
  { path: '/treinamentos',          label: 'Treinamentos',       icon: GraduationCap,   modulo: 'treinamentos' },
  { path: '/eventos',               label: 'Eventos',            icon: CalendarCheck,   modulo: 'eventos' },
  { path: '/vitrine-admin',         label: 'Vitrine',            icon: Store,           modulo: 'parceiros' },
  { path: '/acessos-equipe',        label: 'Acessos da Equipe',  icon: Users,           modulo: 'acessos_equipe' },
  { path: '/usuarios',              label: 'Usuários',           icon: Users,           modulo: 'usuarios' },
]

const PERFIL_LABEL = {
  administrador:           'Administrador',
  gerente:                 'Gerente',
  estagiario_proprias:     'Estagiário Próprias',
  analista_proprias:       'Analista Próprias',
  supervisor_proprias:     'Supervisor Próprias',
  estagiario_influencers:  'Estagiário Influencers',
  analista_influencers:    'Analista Influencers',
  estagiario_marketplaces: 'Estagiário Mkt & Eventos',
  analista_marketplaces:   'Analista Mkt & Eventos',
  estagiario_parceiras:    'Estagiário Parceiras',
  analista_parceiras:      'Analista Parceiras',
  supervisor_parceiras:    'Supervisor Parceiras',
}

const PERFIL_COLOR = {
  administrador:           'var(--accent)',
  gerente:                 'var(--indigo)',
  estagiario_proprias:     '#06b6d4',
  analista_proprias:       '#06b6d4',
  supervisor_proprias:     '#8b5cf6',
  estagiario_influencers:  '#22c55e',
  analista_influencers:    '#22c55e',
  estagiario_marketplaces: '#f97316',
  analista_marketplaces:   '#f97316',
  estagiario_parceiras:    '#f43f5e',
  analista_parceiras:      '#f43f5e',
  supervisor_parceiras:    '#e11d48',
}

const PODE_VER_COMO = ['administrador', 'gerente']

function canPerfil(perfil, modulo) {
  if (!perfil || !modulo) return false
  return (MODULOS_PERMISSOES[modulo] || []).includes(perfil)
}

function RequireAuth({ children, modulo }) {
  const { session, loading } = useAuth()
  const { can } = usePermissions()
  if (loading) return <div className="loading"><div className="spinner" /></div>
  if (!session) return <Navigate to="/login" replace />
  if (modulo && !can(modulo)) return <SemAcesso />
  return children
}

function HomeRedirect() {
  const { session, loading } = useAuth()
  const { can } = usePermissions()
  if (loading) return <div className="loading"><div className="spinner" /></div>
  if (!session) return <Navigate to="/login" replace />
  if (can('dashboard')) return <Dashboard />
  const firstRoute = MENU.find((m) => m.path !== '/' && can(m.modulo))
  if (firstRoute) return <Navigate to={firstRoute.path} replace />
  return <SemAcesso />
}

function SemAcesso() {
  return (
    <div className="sem-acesso">
      <ShieldAlert size={40} strokeWidth={1.2} />
      <h2>Acesso não permitido</h2>
      <p>Você não tem permissão para acessar este módulo.</p>
    </div>
  )
}

function ModalVerComo({ todosUsuarios, usuarioAtual, onSelecionar, onFechar }) {
  const [busca, setBusca] = useState('')
  const filtrados = todosUsuarios.filter((u) => u.id !== usuarioAtual?.id).filter((u) => {
    if (!busca) return true
    const t = busca.toLowerCase()
    return u.nome?.toLowerCase().includes(t) || (PERFIL_LABEL[u.perfil] || u.perfil || '').toLowerCase().includes(t)
  })
  const grupos = filtrados.reduce((acc, u) => {
    const label = PERFIL_LABEL[u.perfil] || u.perfil || 'Sem perfil'
    if (!acc[label]) acc[label] = []
    acc[label].push(u)
    return acc
  }, {})

  return (
    <div onClick={onFechar} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background:'var(--sidebar-bg, #1a1a2e)', border:'1px solid var(--border, #2a2a3e)', borderRadius:14, width:'100%', maxWidth:420, maxHeight:'75vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 60px rgba(0,0,0,0.5)', overflow:'hidden' }}>
        <div style={{ padding:'16px 18px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <SwitchCamera size={16} style={{ color:'var(--accent, #f59e0b)', flexShrink:0 }} />
            <span style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.9)' }}>Visualizar como</span>
          </div>
          <button onClick={onFechar} style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:'rgba(255,255,255,0.4)', display:'flex', alignItems:'center' }}><X size={16} /></button>
        </div>
        <div style={{ padding:'10px 14px', flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)' }} />
            <input autoFocus type="text" placeholder="Buscar por nome ou perfil..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width:'100%', padding:'8px 10px 8px 30px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:13, color:'rgba(255,255,255,0.85)', outline:'none', boxSizing:'border-box' }} />
          </div>
        </div>
        <div style={{ overflowY:'auto', flex:1, padding:'8px 0' }}>
          {filtrados.length === 0 ? (
            <p style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:13, padding:'24px 0' }}>Nenhum usuário encontrado</p>
          ) : (
            Object.entries(grupos).map(([grupoPerfil, users]) => (
              <div key={grupoPerfil}>
                <div style={{ padding:'6px 16px 4px', fontSize:10, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase', color:'rgba(255,255,255,0.25)' }}>{grupoPerfil}</div>
                {users.map((u) => (
                  <button key={u.id} onClick={() => onSelecionar(u)} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 16px', background:'none', border:'none', cursor:'pointer', transition:'background 0.12s', textAlign:'left' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, background:`${PERFIL_COLOR[u.perfil] || '#888'}22`, border:`1.5px solid ${PERFIL_COLOR[u.perfil] || '#888'}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:PERFIL_COLOR[u.perfil] || '#888' }}>{(u.nome || 'U')[0].toUpperCase()}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:'rgba(255,255,255,0.85)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.nome}</div>
                      <div style={{ fontSize:11, color:PERFIL_COLOR[u.perfil] || 'rgba(255,255,255,0.35)', marginTop:1 }}>{PERFIL_LABEL[u.perfil] || u.perfil}</div>
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function BannerVerComo({ viewAs, onSair }) {
  return (
    <div style={{ background:'linear-gradient(90deg, #92400e, #b45309)', color:'#fef3c7', padding:'9px 20px', display:'flex', alignItems:'center', gap:10, fontSize:13, fontWeight:500, flexShrink:0, borderBottom:'1px solid rgba(0,0,0,0.15)' }}>
      <SwitchCamera size={15} style={{ flexShrink:0, opacity:0.8 }} />
      <span style={{ flex:1 }}>
        Modo visualização: <strong style={{ fontWeight:700 }}>{viewAs.nome}</strong>
        <span style={{ opacity:0.7, marginLeft:6 }}>({PERFIL_LABEL[viewAs.perfil] || viewAs.perfil})</span>
        <span style={{ opacity:0.6, marginLeft:8, fontSize:12 }}>Dados exibidos são os seus; apenas a interface reflete o perfil selecionado</span>
      </span>
      <button onClick={onSair} style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:6, padding:'4px 12px', cursor:'pointer', color:'#fef3c7', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
        <X size={13} />Sair do modo visualização
      </button>
    </div>
  )
}

function Shell() {
  const { usuario, session } = useAuth()
  const [pedidosNovos, setPedidosNovos] = useState(0)

  const [tema, setTema] = useState(() => {
    try { return localStorage.getItem('orbita_tema') || 'dark' } catch { return 'dark' }
  })
  const [corDestaque, setCorDestaque] = useState(() => {
    try { return localStorage.getItem('orbita_cor') || '#e06030' } catch { return '#e06030' }
  })
  const [corHSL, setCorHSL] = useState(() => {
    try { return JSON.parse(localStorage.getItem('orbita_cor_hsl') || 'null') } catch { return null }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema)
  }, [tema])

  useEffect(() => {
    if (corHSL) {
      document.documentElement.style.setProperty('--accent-h', String(corHSL.h))
      document.documentElement.style.setProperty('--accent-s', corHSL.s)
      document.documentElement.style.setProperty('--accent-l', corHSL.l)
    }
  }, [corHSL])

  function handleTemaChange(novoTema) {
    setTema(novoTema)
    try { localStorage.setItem('orbita_tema', novoTema) } catch {}
  }

  function handleCorChange(cor) {
    setCorDestaque(cor.hex)
    setCorHSL({ h: cor.h, s: cor.s, l: cor.l })
    try {
      localStorage.setItem('orbita_cor', cor.hex)
      localStorage.setItem('orbita_cor_hsl', JSON.stringify({ h: cor.h, s: cor.s, l: cor.l }))
    } catch {}
  }

  const [viewAs, setViewAs] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [todosUsuarios, setTodosUsuarios] = useState([])
  const podeUsarVerComo = PODE_VER_COMO.includes(usuario?.perfil)

  useEffect(() => {
    if (podeUsarVerComo && showModal) {
      getUsuarios().then((data) => setTodosUsuarios(data || [])).catch(() => {})
    }
  }, [podeUsarVerComo, showModal])

  useEffect(() => {
    if (!viewAs?.id) return
    getUsuarios().then((data) => {
      const atualizado = (data || []).find((u) => u.id === viewAs.id)
      if (atualizado && (JSON.stringify(atualizado.abas_extras) !== JSON.stringify(viewAs.abas_extras) || JSON.stringify(atualizado.grupos_extras) !== JSON.stringify(viewAs.grupos_extras))) {
        setViewAs(atualizado)
      }
    }).catch(() => {})
  }, [viewAs?.id]) // eslint-disable-line

  const perfilAtivo = viewAs?.perfil || usuario?.perfil
  const abasExtrasAtivo = viewAs?.abas_extras || usuario?.abas_extras || []

  function canAtivo(modulo) {
    return canPerfil(perfilAtivo, modulo) || abasExtrasAtivo.includes(modulo)
  }

  useEffect(() => {
    async function fetchPedidosNovos() {
      const { count } = await supabase.from('vitrine_pedidos').select('*', { count:'exact', head:true }).eq('status', 'novo')
      setPedidosNovos(count || 0)
    }
    fetchPedidosNovos()
    const interval = setInterval(fetchPedidosNovos, 30000)
    return () => clearInterval(interval)
  }, [])

  async function handleLogout() {
    setViewAs(null)
    await signOut()
  }

  const ehDono = (session?.user?.email || '').toLowerCase() === DONO_EMAIL.toLowerCase()

  const menuVisivel = MENU.filter((m) => {
    if (m.soEmail && !ehDono) return false
    if (m.ocultarPerfis && m.ocultarPerfis.includes(perfilAtivo)) return false
    return m.sempreVisivel || canAtivo(m.modulo)
  }).filter((m, idx, arr) => arr.findIndex(x => x.path === m.path) === idx)

  const usuarioDisplay = viewAs || usuario

  const viewAsValue = {
    perfilAtivo: viewAs?.perfil || usuario?.perfil,
    usuarioAtivo: viewAs || usuario,
    estaEmModoVisual: !!viewAs,
  }

  return (
    <ViewAsContext.Provider value={viewAsValue}>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <Orbit size={20} strokeWidth={1.5} className="brand-icon" />
            <div>
              <div className="brand-name">Orbita MKT</div>
              <div className="brand-sub">CEDET</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {menuVisivel.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                <Icon size={17} strokeWidth={1.5} />
                <span>{label}</span>
                {path === '/vitrine-admin' && pedidosNovos > 0 && (
                  <span style={{ marginLeft:'auto', background:'#dc2626', color:'white', borderRadius:'50%', minWidth:20, height:20, fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px' }}>{pedidosNovos}</span>
                )}
              </NavLink>
            ))}
          </nav>

          {podeUsarVerComo && (
            <button onClick={() => setShowModal(true)} style={{ margin:'0 10px 8px', padding:'8px 12px', background: viewAs ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', border:`1px solid ${viewAs ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', gap:8, width:'calc(100% - 20px)', color: viewAs ? '#fbbf24' : 'rgba(255,255,255,0.45)', fontSize:12, fontWeight:500, transition:'all 0.15s' }} onMouseEnter={(e) => { if (!viewAs) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }} onMouseLeave={(e) => { if (!viewAs) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}>
              <SwitchCamera size={14} style={{ flexShrink:0 }} />
              <span style={{ flex:1, textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{viewAs ? `Vendo como: ${viewAs.nome.split(' ')[0]}` : 'Visualizar como...'}</span>
              <ChevronDown size={12} style={{ flexShrink:0, opacity:0.5 }} />
            </button>
          )}

          <div className="sidebar-user">
            {usuarioDisplay && (
              <>
                <div className="user-avatar" style={viewAs ? { outline:'2px solid #f59e0b', outlineOffset:2 } : {}}>
                  {(usuarioDisplay.nome || 'U')[0].toUpperCase()}
                </div>
                <div className="user-info">
                  <div className="user-name">
                    {usuarioDisplay.nome}
                    {viewAs && <span style={{ marginLeft:6, fontSize:9, fontWeight:700, background:'#f59e0b', color:'#1c1917', padding:'1px 5px', borderRadius:4, verticalAlign:'middle', letterSpacing:'.04em' }}>PREVIEW</span>}
                  </div>
                  <div className="user-perfil" style={{ color:PERFIL_COLOR[usuarioDisplay.perfil] }}>
                    {PERFIL_LABEL[usuarioDisplay.perfil] || usuarioDisplay.perfil}
                  </div>
                </div>
              </>
            )}
            <button className="btn-logout" onClick={handleLogout} title="Sair"><LogOut size={15} strokeWidth={1.5} /></button>
          </div>
        </aside>

        <main className="main-content" style={{ display:'flex', flexDirection:'column' }}>
          {viewAs && <BannerVerComo viewAs={viewAs} onSair={() => setViewAs(null)} />}
          <div style={{ flex:1, overflow:'auto' }}>
            <Suspense fallback={<div className="loading"><div className="spinner" /></div>}>
              <Routes>
                <Route path="/" element={<RequireAuth><BemVindo menu={menuVisivel} /></RequireAuth>} />
                <Route path="/dashboard" element={<RequireAuth modulo="dashboard"><Dashboard /></RequireAuth>} />
                <Route path="/dashboard-parceiras" element={<RequireAuth modulo="tarefas_parceiras"><DashboardParceiras /></RequireAuth>} />
                <Route path="/base-comando" element={<RequireAuth><BaseComando /></RequireAuth>} />
                <Route path="/cortesias" element={<RequireAuth modulo="cortesias"><Cortesias /></RequireAuth>} />
                <Route path="/parceiros" element={<RequireAuth modulo="parceiros"><Parceiros /></RequireAuth>} />
                <Route path="/usuarios" element={<RequireAuth modulo="usuarios"><Usuarios /></RequireAuth>} />
                <Route path="/acessos-equipe" element={<RequireAuth modulo="acessos_equipe"><AcessosEquipe /></RequireAuth>} />
                <Route path="/campanhas" element={<RequireAuth modulo="campanhas"><Campanhas /></RequireAuth>} />
                <Route path="/monitoramento" element={<RequireAuth modulo="monitoramento"><Monitoramento /></RequireAuth>} />
                <Route path="/monitoramento-parceiras" element={<RequireAuth modulo="tarefas_parceiras"><MonitoramentoParceiras /></RequireAuth>} />
                <Route path="/crm-influencers" element={<RequireAuth modulo="crm_influencers"><CRM grupo="influencers" titulo="CRM Influencers" /></RequireAuth>} />
                <Route path="/crm-parceiras" element={<RequireAuth modulo="crm_parceiras"><CRM grupo="parceiras" titulo="CRM Parceiras" /></RequireAuth>} />
                <Route path="/crm-editoras-parceiras" element={<RequireAuth modulo="tarefas_parceiras"><CRMEditorasParceiras /></RequireAuth>} />
                <Route path="/editoras-livrarias" element={<RequireAuth modulo="tarefas_parceiras"><EditorasLivrarias /></RequireAuth>} />
                <Route path="/promocoes-parceiras" element={<RequireAuth modulo="tarefas_parceiras"><PromocoesParceiras /></RequireAuth>} />
                <Route path="/calculadora" element={<RequireAuth modulo="calculadora"><Calculadora /></RequireAuth>} />
                <Route path="/rh" element={<RequireAuth modulo="rh"><RH /></RequireAuth>} />
                <Route path="/eventos" element={<RequireAuth modulo="eventos"><Eventos /></RequireAuth>} />
                <Route path="/lancamentos" element={<RequireAuth modulo="lancamentos"><Lancamentos /></RequireAuth>} />
                <Route path="/tarefas" element={<RequireAuth modulo="tarefas"><Tarefas /></RequireAuth>} />
                <Route path="/tarefas-parceiras" element={<RequireAuth modulo="tarefas_parceiras"><TarefasParceiras grupo="parceiras" titulo="Tarefas — Editoras Parceiras" /></RequireAuth>} />
                <Route path="/agenda" element={<RequireAuth modulo="tarefas_parceiras"><Agenda /></RequireAuth>} />
                <Route path="/treinamentos" element={<RequireAuth modulo="treinamentos"><Treinamentos /></RequireAuth>} />
                <Route path="/pda" element={<RequireAuth modulo="pda"><PDA /></RequireAuth>} />
                <Route path="/cac-ltv" element={<RequireAuth modulo="cac_ltv"><CacLtv /></RequireAuth>} />
                <Route path="/vitrine-admin" element={<RequireAuth modulo="parceiros"><VitrineAdmin /></RequireAuth>} />
                <Route path="/guia-parcerias" element={<RequireAuth modulo="guia_parcerias"><GuiaParcerias /></RequireAuth>} />
                <Route path="/pedidos-crm" element={<RequireAuth modulo="pedidos_crm"><PedidosCRM /></RequireAuth>} />
                <Route path="/crm-inteligencia" element={<RequireAuth modulo="crm_inteligencia"><CRMInteligencia /></RequireAuth>} />
                <Route path="/notas" element={<RequireAuth><BlocoNotas /></RequireAuth>} />
                <Route path="/configuracoes" element={<RequireAuth><Configuracoes tema={tema} corDestaque={corDestaque} onTemaChange={handleTemaChange} onCorChange={handleCorChange} /></RequireAuth>} />
              </Routes>
            </Suspense>
          </div>
        </main>

        {showModal && (
          <ModalVerComo todosUsuarios={todosUsuarios} usuarioAtual={usuario} onSelecionar={(u) => { setViewAs(u); setShowModal(false) }} onFechar={() => setShowModal(false)} />
        )}
      </div>
    </ViewAsContext.Provider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="loading"><div className="spinner" /></div>}>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/vitrine" element={<VitrinePublica />} />
            <Route path="/*" element={<RequireAuth><Shell /></RequireAuth>} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

function PublicRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="loading"><div className="spinner" /></div>
  if (session) return <Navigate to="/login" replace />
  return children
}
