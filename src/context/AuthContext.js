import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getUsuarioPerfil } from '../lib/supabase'

const AuthContext = createContext(null)

// Permissões por módulo e perfil
// Adicione novos módulos aqui conforme o sistema cresce
export const MODULOS_PERMISSOES = {
  dashboard:  ['administrador', 'gerente', 'analista', 'assistente'],
  parceiros:  ['administrador', 'gerente', 'analista'],
  cortesias:  ['administrador', 'gerente', 'analista'],
  campanhas:      ['administrador', 'gerente', 'analista'],
  monitoramento:  ['administrador', 'gerente', 'analista', 'assistente'],
  lancamentos:  ['administrador', 'gerente', 'analista', 'assistente'],
  tarefas:      ['administrador', 'gerente', 'analista', 'assistente'],
  usuarios:     ['administrador'],
}

export function canAccess(perfil, modulo) {
  if (!perfil || !modulo) return false
  return (MODULOS_PERMISSOES[modulo] || []).includes(perfil)
}

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [usuario, setUsuario]   = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadPerfil(data.session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadPerfil(session.user.id)
      else { setUsuario(null); setLoading(false) }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function loadPerfil(userId) {
    try {
      const perfil = await getUsuarioPerfil(userId)
      setUsuario(perfil)
    } catch {
      // Perfil ainda não criado (primeiro login)
      setUsuario(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ session, usuario, loading, setUsuario }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
