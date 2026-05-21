// src/context/ViewAsContext.js
//
// Fornece o "perfil ativo" para toda a aplicação.
// Quando o admin usa "Ver como", perfilAtivo reflete
// o perfil do usuário visualizado — não o real.
// Páginas que filtram dados por perfil usam este contexto.

import { createContext, useContext } from 'react'

export const ViewAsContext = createContext({
  perfilAtivo: null,   // perfil efetivo (viewAs?.perfil || usuario?.perfil)
  usuarioAtivo: null,  // objeto completo do usuário ativo
  estaEmModoVisual: false,
})

export function useViewAs() {
  return useContext(ViewAsContext)
}
