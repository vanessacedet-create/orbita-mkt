// A fila só apresenta tarefas já atribuídas à Yasmin; não altera tarefas/histórico.
export function ordenarFilaYasmin(tarefas, responsavelId, ordem = [], comparar = () => 0) {
  const pos = new Map(ordem.map((id, i) => [id, i]))
  return tarefas.filter(t => !['concluida', 'cancelada'].includes(t.status) &&
    (t.responsavel_id === responsavelId || t.responsavel?.id === responsavelId ||
     (t.responsaveis || []).some(r => (r.usuario_id || r.usuario?.id) === responsavelId)))
    .sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity) || comparar(a, b))
}
export function moverNaFila(ids, origem, destino) {
  const resultado = [...ids], de = resultado.indexOf(origem), para = resultado.indexOf(destino)
  if (de < 0 || para < 0 || de === para) return resultado
  resultado.splice(para, 0, resultado.splice(de, 1)[0])
  return resultado
}
