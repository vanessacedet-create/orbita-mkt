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
  const abasExtras = usuario?.abas_extras || []
  const abasExtrasKey = JSON.stringify(abasExtras)

  const can = useMemo(
    () => (modulo) => {
      if (!perfil || !modulo) return false
      return (MODULOS_PERMISSOES[modulo] || []).includes(perfil) ||
             abasExtras.includes(modulo)
    },
    [perfil, abasExtrasKey] // eslint-disable-line
  )

  const modulosPermitidos = useMemo(
    () => {
      if (!perfil) return []
      const porPerfil = Object.keys(MODULOS_PERMISSOES).filter(m =>
        MODULOS_PERMISSOES[m].includes(perfil)
      )
      const extras = abasExtras.filter(m => !porPerfil.includes(m))
      return [...porPerfil, ...extras]
    },
    [perfil, abasExtrasKey] // eslint-disable-line
  )

  return { can, modulosPermitidos, perfil }
}
