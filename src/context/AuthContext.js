import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getUsuarioPerfil } from '../lib/supabase'

const AuthContext = createContext(null)

// Permissões por módulo e perfil
// Perfis disponíveis:
// administrador, gerente
// estagiario_proprias, analista_proprias, supervisor_proprias
// estagiario_influencers, analista_influencers
// estagiario_marketplaces, analista_marketplaces
// estagiario_parceiras, analista_parceiras, supervisor_parceiras

export const MODULOS_PERMISSOES = {
  dashboard:      ['administrador', 'gerente', 'analista_influencers', 'estagiario_influencers', 'estagiario_proprias', 'analista_proprias', 'supervisor_proprias', 'estagiario_marketplaces', 'analista_marketplaces'],
  parceiros:      ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers'],
  crm:            ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers'],
  crm_literario:  ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers'],
  calculadora:    ['administrador', 'gerente',
                   'estagiario_proprias', 'analista_proprias', 'supervisor_proprias',
                   'estagiario_influencers', 'analista_influencers'],
  cortesias:      ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers'],
  campanhas:      ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers'],
  monitoramento:  ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers'],
  lancamentos:    ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers'],
  tarefas:        ['administrador', 'gerente',
                   'estagiario_influencers', 'analista_influencers',
                   'analista_marketplaces', 'estagiario_marketplaces',
                   'supervisor_parceiras', 'analista_parceiras', 'estagiario_parceiras'],
  eventos:        ['administrador', 'gerente', 'estagiario_marketplaces', 'analista_marketplaces'],
  rh:             ['administrador'],
  treinamentos:   ['administrador', 'gerente', 'supervisor_proprias'],
  usuarios:       ['administrador'],
  guia_parcerias: ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers'],
}

// Mapeamento de perfil para grupo (usado para isolamento de tarefas)
export const PERFIL_GRUPO = {
  estagiario_influencers:  'influencers',
  analista_influencers:    'influencers',
  estagiario_marketplaces: 'marketplaces',
  analista_marketplaces:   'marketplaces',
  estagiario_proprias:     'proprias',
  analista_proprias:       'proprias',
  supervisor_proprias:     'proprias',
  estagiario_parceiras:    'parceiras',
  analista_parceiras:      'parceiras',
  supervisor_parceiras:    'parceiras',
  // administrador e gerente ficam sem grupo (veem tudo)
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
