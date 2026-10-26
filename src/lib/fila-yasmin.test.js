import { ordenarFilaYasmin, moverNaFila } from './fila-yasmin'
const t = (id, status = 'a_fazer', responsavel_id = 'yasmin') => ({ id, status, responsavel_id })
test('ordem manual supera prioridade, preserva novas e exclui histórico/outros responsáveis', () => {
 const tarefas = [t('nova'), t('primeira'), t('segunda'), t('fim', 'concluida'), t('outro', 'a_fazer', 'anne')]
 expect(ordenarFilaYasmin(tarefas, 'yasmin', ['segunda','primeira']).map(x => x.id)).toEqual(['segunda','primeira','nova'])
 expect(tarefas).toHaveLength(5)
})
test('suporta tarefa legada e múltiplos responsáveis', () => {
 expect(ordenarFilaYasmin([{id:'antiga-1',responsaveis:[{usuario:{id:'yasmin'}}]}], 'yasmin')).toHaveLength(1)
})
test('mover para cima/baixo não altera dados ou lista original', () => {
 const ids=['a','b','c']; expect(moverNaFila(ids,'a','c')).toEqual(['b','c','a'])
 expect(moverNaFila(ids,'c','a')).toEqual(['c','a','b']); expect(ids).toEqual(['a','b','c'])
 expect(moverNaFila(ids,'inexistente','a')).toEqual(ids)
})
