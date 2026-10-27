import { carregarCatalogoAdmin, lerEstoquePlanilha, planejarAtualizacaoEstoque } from './vitrineEstoque';

test('planilha parcial mantém livros de outras editoras e aceita zero explícito', () => {
  const estoque = lerEstoquePlanilha([
    { ISBN: '978-85-8491-607-8', Quantidade: 12 },
    { ISBN: '9788584916559', Quantidade: 0 },
  ]);
  expect(planejarAtualizacaoEstoque([
    { id: 1, ean: '9788584916078', estoque_disponivel: 5 },
    { id: 2, ean: '9788584916559', estoque_disponivel: 8 },
    { id: 3, ean: '9788595076495', estoque_disponivel: 847 },
  ], estoque)).toEqual({
    atualizacoes: [{ id: 1, quantidade: 12 }, { id: 2, quantidade: 0 }],
    preservados: 1, naoEncontrados: 0,
  });
});

test('quantidade ilegível ou ISBN com quantidades conflitantes interrompe antes de gravar', () => {
  expect(() => lerEstoquePlanilha([{ EAN: '123', Estoque: 'indefinido' }])).toThrow('Quantidade inválida');
  expect(() => lerEstoquePlanilha([{ EAN: '123', Estoque: -1 }])).toThrow('Quantidade inválida');
  expect(() => lerEstoquePlanilha([{ EAN: '123', Estoque: 1 }, { EAN: '123', Estoque: 2 }])).toThrow('quantidades diferentes');
  expect(lerEstoquePlanilha([{ EAN: '123', Estoque: ' Sem estoque ' }]).get('123')).toBe(0);
});

test('ISBN duplicado no catálogo atualiza ambos os registros sem distorcer os não encontrados', () => {
  expect(planejarAtualizacaoEstoque([{ id: 1, ean: '123' }, { id: 2, ean: '123' }],
    new Map([['123', 10], ['456', 20]]))).toEqual({
    atualizacoes: [{ id: 1, quantidade: 10 }, { id: 2, quantidade: 10 }], preservados: 0, naoEncontrados: 1,
  });
});

test('carrega mais de 1.000 livros e propaga falhas de páginas intermediárias', async () => {
  const registros = Array.from({ length: 1538 }, (_, id) => ({ id }));
  const range = jest.fn(async (inicio, fim) => ({ data: registros.slice(inicio, fim + 1) }));
  const query = { select: () => query, order: () => query, range };
  const client = { from: () => query };
  expect(await carregarCatalogoAdmin(client)).toHaveLength(1538);
  expect(range.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499], [1500, 1999]]);
  range.mockImplementation(async inicio => inicio === 500 ? { error: new Error('Falha na página') } : { data: registros.slice(0, 500) });
  await expect(carregarCatalogoAdmin(client)).rejects.toThrow('Falha na página');
});
