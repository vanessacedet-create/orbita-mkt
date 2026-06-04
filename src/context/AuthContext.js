import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getUsuarioPerfil } from '../lib/supabase'

const AuthContext = createContext(null)

// ==================== PERMISSÕES POR MÓDULO ====================
export const MODULOS_PERMISSOES = {
  dashboard: ['administrador', 'gerente', 'analista_influencers', 'estagiario_influencers', 'estagiario_proprias', 'analista_proprias', 'supervisor_proprias', 'estagiario_marketplaces', 'analista_marketplaces'],
  inbox_influencers: ['administrador', 'gerente', 'analista_influencers', 'estagiario_influencers'],
  parceiros: ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers'],
  crm_influencers: ['administrador', 'analista_influencers', 'estagiario_influencers'],
  crm_parceiras: ['administrador', 'supervisor_parceiras', 'analista_parceiras', 'estagiario_parceiras'],
  calculadora: ['administrador', 'gerente', 'estagiario_proprias', 'analista_proprias', 'supervisor_proprias', 'estagiario_influencers', 'analista_influencers'],
  cortesias: ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers'],
  campanhas: [   'administrador',   'gerente',    'estagiario_influencers',   'analista_influencers',   'supervisor_influencers',    'estagiario_parceiras',   'analista_parceiras',   'supervisor_parceiras',    'estagiario_marketplaces',   'analista_marketplaces',    'estagiario_proprias',   'analista_proprias',   'supervisor_proprias', ],
  monitoramento: ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers'],
  lancamentos: ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers'],
  tarefas: ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers', 'analista_marketplaces', 'estagiario_marketplaces', 'supervisor_parceiras', 'analista_parceiras', 'estagiario_parceiras'],
  eventos: ['administrador', 'gerente', 'estagiario_marketplaces', 'analista_marketplaces'],
  rh: ['administrador'],
  pda: ['administrador'],
  cac_ltv: ['administrador', 'gerente', 'supervisor_proprias'],
  treinamentos: ['administrador', 'gerente', 'supervisor_proprias'],
  usuarios: ['administrador'],
  guia_parcerias: ['administrador', 'gerente', 'estagiario_influencers', 'analista_influencers'],
  pedidos_crm: [  'administrador'],
  crm_inteligencia: ['administrador',],
}

// ==================== MAPEAMENTO DE GRUPO ====================
export const PERFIL_GRUPO = {
  estagiario_influencers: 'influencers',
  analista_influencers: 'influencers',
  supervisor_influencers: 'influencers',     // ← adicionei (caso exista)
  
  estagiario_parceiras: 'parceiras',
  analista_parceiras: 'parceiras',
  supervisor_parceiras: 'parceiras',
  
  estagiario_marketplaces: 'marketplaces',
  analista_marketplaces: 'marketplaces',
  
  estagiario_proprias: 'proprias',
  analista_proprias: 'proprias',
  supervisor_proprias: 'proprias',
  
  // admin e gerente veem tudo
  administrador: 'admin',
  gerente: 'admin',
};

// ==================== FUNÇÕES DE PERMISSÃO ====================
export function canAccess(perfil, modulo) {
  if (!perfil || !modulo) return false
  return (MODULOS_PERMISSOES[modulo] || []).includes(perfil)
}

export function getUserGroup(perfil) {
  if (!perfil) return null;
  return PERFIL_GRUPO[perfil] || null;
}

export function canAccessGroup(userPerfil, targetGroup) {
  if (!userPerfil) return false;
  
  // Admin e Gerente veem tudo
  if (['administrador', 'gerente'].includes(userPerfil)) {
    return true;
  }

  const userGroup = getUserGroup(userPerfil);
  return userGroup === targetGroup;
}

// ==================== PROVIDER ====================
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadPerfil(data.session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadPerfil(session.user.id)
      else { 
        setUsuario(null); 
        setLoading(false) 
      }
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
    <AuthContext.Provider value={{ 
      session, 
      usuario, 
      loading, 
      setUsuario, 
      abasExtras: usuario?.abas_extras || [] 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
