// Integração de disponibilidade da Vitrine com o Estoque CDL.
// A fonte de verdade é a tabela "estoque" do projeto Estoque CDL.
// O mapa SKU/ISBN vem do catálogo público versionado no próprio repositório.

const RAW_BASE = 'https://raw.githubusercontent.com/vanessacedet-create/estoque-cdl/main';
const CACHE_KEY = 'orbita_estoque_cdl_v1';
const CACHE_TTL = 6 * 60 * 60 * 1000;

function isbn(v) {
  return String(v || '').replace(/\D/g, '');
}

function lerCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c?.atualizadoEm && c?.quantidades && Date.now() - c.atualizadoEm < CACHE_TTL) return c.quantidades;
  } catch {}
  return null;
}

function salvarCache(quantidades) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ atualizadoEm: Date.now(), quantidades })); } catch {}
}

async function carregarAoVivo() {
  const [catalogResp, htmlResp] = await Promise.all([
    fetch(RAW_BASE + '/catalogo-publico.json', { cache: 'no-store' }),
    fetch(RAW_BASE + '/index.html', { cache: 'no-store' }),
  ]);
  if (!catalogResp.ok || !htmlResp.ok) throw new Error('Fonte do Estoque CDL indisponível.');

  const catalogo = await catalogResp.json();
  const html = await htmlResp.text();
  const url = html.match(/let SB_URL = '([^']+)'/)?.[1];
  const key = html.match(/let SB_KEY = '([^']+)'/)?.[1];
  if (!url || !key) throw new Error('Configuração pública do Estoque CDL não encontrada.');

  const headers = { apikey: key, Authorization: 'Bearer ' + key };
  const [estoqueResp, extrasResp] = await Promise.all([
    fetch(url + '/rest/v1/estoque?select=sku,quantidade', { headers, cache: 'no-store' }),
    fetch(url + '/rest/v1/produtos_extra?select=sku,isbn', { headers, cache: 'no-store' }),
  ]);
  if (!estoqueResp.ok) throw new Error('Não foi possível consultar as quantidades do Estoque CDL.');

  const estoque = await estoqueResp.json();
  const extras = extrasResp.ok ? await extrasResp.json() : [];
  const isbnPorSku = new Map((catalogo.livros || []).map(x => [String(x.sku), isbn(x.isbn)]));
  for (const x of extras) if (x.sku && x.isbn) isbnPorSku.set(String(x.sku), isbn(x.isbn));

  const quantidades = {};
  for (const x of estoque) {
    const codigo = isbnPorSku.get(String(x.sku));
    if (codigo) quantidades[codigo] = Number(x.quantidade) || 0;
  }
  salvarCache(quantidades);
  return quantidades;
}

export async function carregarEstoqueCdl() {
  try {
    return await carregarAoVivo();
  } catch (err) {
    const cache = lerCache();
    if (cache) return cache;
    throw err;
  }
}

export async function filtrarLivrosComEstoque(livros) {
  const quantidades = await carregarEstoqueCdl();
  return (livros || [])
    .map(l => ({ ...l, estoque_cdl: quantidades[isbn(l.ean)] ?? 0 }))
    .filter(l => l.estoque_cdl > 0);
}
