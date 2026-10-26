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

test('dias independentes, sem dia e pendentes anteriores sem mover automaticamente', () => {
 const { separarAgendaYasmin } = require('./fila-yasmin')
 const tarefas=[t('a'),t('b'),t('c'),t('d')]
 const agenda={a:'2026-10-26',b:'2026-10-27',d:'2026-10-25'}
 const r=separarAgendaYasmin(tarefas,agenda,'2026-10-26','2026-10-26')
 expect(r.doDia.map(x=>x.id)).toEqual(['a'])
 expect(r.semDia.map(x=>x.id)).toEqual(['c'])
 expect(r.anteriores.map(x=>x.id)).toEqual(['d'])
 expect(agenda.d).toBe('2026-10-25')
})
test('reordenar um dia preserva a sequência de todos os outros dias', () => {
 const { moverNoDia } = require('./fila-yasmin')
 expect(moverNoDia(['a','b','c','d'],['a','c'],'c','a')).toEqual(['c','b','a','d'])
 expect(moverNoDia(['a','b','c'],['a','c'],'a','b')).toEqual(['a','b','c'])
})

test('ordena na Lista/Hoje sem deslocar cartões de outras pessoas', () => {
 const { ordenarYasminNaLista } = require('./fila-yasmin')
 const a=t('a'), b=t('b'), outra=t('outra','a_fazer','anne')
 expect(ordenarYasminNaLista([a,outra,b],[b,a]).map(x=>x.id)).toEqual(['b','outra','a'])
 expect(ordenarYasminNaLista([a],[b,a]).map(x=>x.id)).toEqual(['a'])
 expect(ordenarYasminNaLista([t('fim','concluida')],[])[0].id).toBe('fim')
})
