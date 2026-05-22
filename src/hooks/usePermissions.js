import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { MODULOS_PERMISSOES } from '../context/AuthContext'
import { useViewAs } from '../context/ViewAsContext'

// Hook centralizado de permissões.
//
// Sem argumento: usa o "perfil ativo" (real ou viewAs) — o que reflete
// o que o usuário está vendo na tela. É o comportamento padrão correto
// para o menu, RequireAuth e qualquer checagem de UI.
//
// Com argumento { useRealUser: true }: força o perfil real do usuário
// logado, ignorando o "Ver como". Útil para checagens de segurança
// que NÃO devem ser afetadas pela visualização (ex: só admin pode trocar
// perfis de outros usuários, mesmo durante "Ver como").
export function usePermissions(options = {}) {
  const { useRealUser = false } = options
  const { usuario: usuarioReal } = useAuth()
  const { usuarioAtivo } = useViewAs()
  const usuario = useRealUser ? usuarioReal : (usuarioAtivo || usuarioReal)

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

  return { can, modulosPermitidos, perfil, usuario }
}
