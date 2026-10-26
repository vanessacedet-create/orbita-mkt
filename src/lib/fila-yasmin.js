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

// Uma atividade tem um único dia de execução. Não modifica o prazo da tarefa.
export function separarAgendaYasmin(tarefas, agenda, dia, hoje) {
  return {
    doDia: tarefas.filter(t => agenda[t.id] === dia),
    semDia: tarefas.filter(t => !agenda[t.id]),
    anteriores: tarefas.filter(t => agenda[t.id] && agenda[t.id] < hoje),
  }
}
// Reordena apenas os lugares das atividades do dia, sem mudar a fila dos outros dias.
export function moverNoDia(ids, idsDoDia, origem, destino) {
  if (!idsDoDia.includes(origem) || !idsDoDia.includes(destino)) return [...ids]
  const movidos = moverNaFila(idsDoDia, origem, destino)
  let i = 0
  const conjunto = new Set(idsDoDia)
  return ids.map(id => conjunto.has(id) ? movidos[i++] : id)
}
