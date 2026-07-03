// Detecta se a página atual chegou a este estado por um F5 (reload real do
// navegador) ou por uma navegação normal dentro do app (ex: clicar em outro
// item do menu lateral e depois voltar). Usado para decidir se o estado da
// tela deve ser mantido exatamente como estava (F5) ou resetado para o
// contexto do dia de hoje (navegação).
export function isPageReload() {
  try {
    const entries = performance.getEntriesByType('navigation')
    if (entries && entries.length > 0) return entries[0].type === 'reload'
  } catch {}
  try {
    // Fallback para navegadores mais antigos
    return performance.navigation && performance.navigation.type === 1
  } catch {}
  return false
}
