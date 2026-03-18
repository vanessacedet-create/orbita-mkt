import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth, canAccess } from './context/AuthContext'
import { signOut } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Cortesias from './pages/Cortesias'
import Usuarios from './pages/Usuarios'
import Campanhas from './pages/Campanhas'
import Lancamentos from './pages/Lancamentos'
import Tarefas from './pages/Tarefas'
import Parceiros from './pages/Parceiros'
import Monitoramento from './pages/Monitoramento'
import './App.css'
import {
  LayoutDashboard, BookOpen, Users, LogOut,
  Orbit, ShieldAlert, Megaphone, CalendarDays, CheckSquare, UserRound, Eye
} from 'lucide-react'

const MENU = [
  { path: '/',           label: 'Dashboard',  icon: LayoutDashboard, modulo: 'dashboard' },
  { path: '/parceiros',  label: 'Parceiros',  icon: UserRound,       modulo: 'parceiros' },
  { path: '/cortesias',  label: 'Cortesias',  icon: BookOpen,        modulo: 'cortesias' },
  { path: '/campanhas',  label: 'Campanhas',  icon: Megaphone,       modulo: 'campanhas' },
  { path: '/monitoramento', label: 'Monitoramento', icon: Eye,           modulo: 'monitoramento' },
  { path: '/lancamentos', label: 'Lançamentos', icon: CalendarDays,   modulo: 'lancamentos' },
  { path: '/tarefas',     label: 'Tarefas',     icon: CheckSquare,    modulo: 'tarefas'     },
  { path: '/usuarios',   label: 'Usuários',   icon: Users,           modulo: 'usuarios'  },
]

const PERFIL_LABEL = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  analista: 'Analista',
  assistente: 'Assistente',
}

const PERFIL_COLOR = {
  administrador: 'var(--accent)',
  gerente: 'var(--indigo)',
  analista: 'var(--green)',
  assistente: 'var(--text-muted)',
}

function RequireAuth({ children, modulo }) {
  const { session, usuario, loading } = useAuth()
  if (loading) return <div className="loading"><div className="spinner" /></div>
  if (!session) return <Navigate to="/login" replace />
  if (modulo && !canAccess(usuario?.perfil, modulo)) return <SemAcesso />
  return children
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

function Shell() {
  const { usuario } = useAuth()

  async function handleLogout() {
    await signOut()
  }

  const menuVisivel = MENU.filter(m => canAccess(usuario?.perfil, m.modulo))

  return (
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
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
            >
              <Icon size={17} strokeWidth={1.5} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          {usuario && (
            <>
              <div className="user-avatar">{(usuario.nome || 'U')[0].toUpperCase()}</div>
              <div className="user-info">
                <div className="user-name">{usuario.nome}</div>
                <div className="user-perfil" style={{ color: PERFIL_COLOR[usuario.perfil] }}>
                  {PERFIL_LABEL[usuario.perfil] || usuario.perfil}
                </div>
              </div>
            </>
          )}
          <button className="btn-logout" onClick={handleLogout} title="Sair">
            <LogOut size={15} strokeWidth={1.5} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<RequireAuth modulo="dashboard"><Dashboard /></RequireAuth>} />
          <Route path="/cortesias" element={<RequireAuth modulo="cortesias"><Cortesias /></RequireAuth>} />
          <Route path="/parceiros" element={<RequireAuth modulo="parceiros"><Parceiros /></RequireAuth>} />
          <Route path="/usuarios" element={<RequireAuth modulo="usuarios"><Usuarios /></RequireAuth>} />
          <Route path="/campanhas" element={<RequireAuth modulo="campanhas"><Campanhas /></RequireAuth>} />
          <Route path="/monitoramento" element={<RequireAuth modulo="monitoramento"><Monitoramento /></RequireAuth>} />
          <Route path="/lancamentos" element={<RequireAuth modulo="lancamentos"><Lancamentos /></RequireAuth>} />
          <Route path="/tarefas" element={<RequireAuth modulo="tarefas"><Tarefas /></RequireAuth>} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/*" element={<RequireAuth><Shell /></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function PublicRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="loading"><div className="spinner" /></div>
  if (session) return <Navigate to="/" replace />
  return children
}
