// Carrega também as editoras que ficam além do limite de uma resposta da API.
export async function carregarCatalogoAdmin(client) {
  const livros = [];
  const tamanhoPagina = 500;
  for (let inicio = 0; ; inicio += tamanhoPagina) {
    const { data, error } = await client.from('vitrine_livros').select('*')
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(inicio, inicio + tamanhoPagina - 1);
    if (error) throw error;
    livros.push(...(data || []));
    if ((data || []).length < tamanhoPagina) return livros;
  }
}

export const normalizarEan = valor => String(valor ?? '').replace(/\D/g, '');

export function lerEstoquePlanilha(rows) {
  const normalizarColuna = valor => String(valor).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const coluna = (row, nomes) => {
    const chave = Object.keys(row).find(k => nomes.includes(normalizarColuna(k)));
    return chave === undefined ? undefined : row[chave];
  };
  const estoque = new Map();
  for (const [indice, row] of rows.entries()) {
    const ean = normalizarEan(coluna(row, ['ean', 'isbn', 'isbn/ean', 'ean/isbn']));
    const valor = coluna(row, ['quantidade', 'qtd', 'estoque', 'quantidade disponivel', 'saldo']);
    if (!ean || valor === undefined || String(valor).trim() === '') continue;
    const texto = String(valor).trim();
    const quantidade = /^sem estoque$/i.test(texto) ? 0 : Number(texto.replace(',', '.'));
    if (!Number.isInteger(quantidade) || quantidade < 0) {
      throw new Error(`Quantidade inválida na linha ${indice + 2} (EAN ${ean}).`);
    }
    if (estoque.has(ean) && estoque.get(ean) !== quantidade) {
      throw new Error(`O EAN ${ean} aparece com quantidades diferentes na planilha.`);
    }
    estoque.set(ean, quantidade);
  }
  if (!estoque.size) throw new Error('A planilha precisa ter uma coluna EAN/ISBN e uma coluna Quantidade/Estoque.');
  return estoque;
}

// Ausência em uma planilha parcial não significa estoque zero.
export function planejarAtualizacaoEstoque(livros, estoque) {
  const encontrados = new Set();
  const atualizacoes = [];
  for (const livro of livros) {
    const ean = normalizarEan(livro.ean);
    if (!estoque.has(ean)) continue;
    encontrados.add(ean);
    atualizacoes.push({ id: livro.id, quantidade: estoque.get(ean) });
  }
  return {
    atualizacoes,
    preservados: livros.length - atualizacoes.length,
    naoEncontrados: [...estoque.keys()].filter(ean => !encontrados.has(ean)).length,
  };
}
