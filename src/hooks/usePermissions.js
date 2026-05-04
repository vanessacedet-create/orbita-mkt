import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { MODULOS_PERMISSOES } from '../context/AuthContext'

// Hook centralizado de permissões.
// Substitui o uso espalhado de canAccess() e a duplicação entre
// App.js (menuVisivel) e RequireAuth (canAccess por rota).
//
// Uso:
//   const { can, menuVisivel, perfil } = usePermissions()
//   can('campanhas')      → true/false
//   can('rh')             → true/false
//   menuVisivel           → array de módulos que o usuário pode ver
export function usePermissions() {
  const { usuario } = useAuth()
  const perfil = usuario?.perfil || null

  const can = useMemo(() => {
    return (modulo) => {
      if (!perfil || !modulo) return false
      return (MODULOS_PERMISSOES[modulo] || []).includes(perfil)
    }
  }, [perfil])

  const modulosPermitidos = useMemo(() => {
    if (!perfil) return []
    return Object.keys(MODULOS_PERMISSOES).filter(m =>
      MODULOS_PERMISSOES[m].includes(perfil)
    )
  }, [perfil])

  return { can, modulosPermitidos, perfil }
}
