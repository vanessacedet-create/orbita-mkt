// ── GOOGLE CUSTOM SEARCH API ───────────────────────────────
// Documentação: https://developers.google.com/custom-search/v1
// Gratuito: 100 buscas/dia. Depois: $5/1000 buscas.
//
// Configuração necessária:
// 1. API Key: console.cloud.google.com → Custom Search API → Credenciais
// 2. Search Engine ID (cx): programmablesearchengine.google.com → Criar buscador
//    No buscador criado, em "Sites para pesquisar", deixe em branco e ative
//    "Pesquisar na web inteira" para funcionar com site:instagram.com etc.

const BASE = 'https://www.googleapis.com/customsearch/v1'

// Filtros de data compatíveis com a API
export const FILTROS_DATA = [
  { label: 'Qualquer data',  value: ''    },
  { label: 'Último mês',     value: 'm1'  },
  { label: 'Últimos 3 meses',value: 'm3'  },
  { label: 'Últimos 6 meses',value: 'm6'  },
  { label: 'Último ano',     value: 'y1'  },
]

// Sugestões de busca para o nicho de livros
export const QUERIES_SUGERIDAS = [
  { label: 'Bookstagram Brasil',  query: 'site:instagram.com "bookstagram" "livros" brasil'           },
  { label: 'True Crime + Livros', query: 'site:instagram.com "true crime" "livros"'                   },
  { label: 'Resenha Literária',   query: 'site:instagram.com "resenha literária" livros'              },
  { label: 'BookTok Brasil',      query: 'site:tiktok.com "livros" "resenha" brasil'                  },
  { label: 'Clube do Livro',      query: 'site:instagram.com "clube do livro" indicação'              },
  { label: 'Fantasia/Ficção',     query: 'site:instagram.com "fantasia" OR "ficção científica" livros'},
  { label: 'Autoajuda',           query: 'site:instagram.com "autoajuda" "livros" resenha'            },
  { label: 'True Crime TikTok',   query: 'site:tiktok.com "true crime" "livros"'                     },
]

/**
 * Executa uma busca no Google Custom Search
 * @param {object} opts
 * @param {string} opts.query        - Query completa (ex: site:instagram.com "true crime" livros)
 * @param {string} opts.apiKey       - Chave da Google API
 * @param {string} opts.cx           - Search Engine ID
 * @param {string} opts.dateRestrict - Ex: 'm3', 'y1' (opcional)
 * @param {number} opts.start        - Paginação (1, 11, 21...) - máx 100
 * @returns {Promise<{resultados: ResultadoBusca[], totalEstimado: number}>}
 */
export async function buscarGoogle({ query, apiKey, cx, dateRestrict = '', start = 1 }) {
  if (!apiKey) throw new Error('API Key do Google não configurada.')
  if (!cx)     throw new Error('Search Engine ID (cx) não configurado.')

  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q:   query,
    num: 10,
    start,
    ...(dateRestrict ? { dateRestrict } : {}),
  })

  const res  = await fetch(`${BASE}?${params}`)
  const data = await res.json()

  if (data.error) throw new Error(data.error.message || 'Erro na Google Custom Search API')

  const total     = parseInt(data.searchInformation?.totalResults || '0')
  const resultados = (data.items || []).map(item => extrairPerfil(item))

  return { resultados, totalEstimado: total }
}

/**
 * Extrai informações do perfil a partir de um resultado da busca
 */
function extrairPerfil(item) {
  const url      = item.link || ''
  const titulo   = item.title || ''
  const snippet  = item.snippet || ''

  // Detecta plataforma
  const plataforma = url.includes('tiktok.com') ? 'TikTok'
    : url.includes('instagram.com') ? 'Instagram'
    : url.includes('youtube.com')   ? 'YouTube'
    : url.includes('twitter.com') || url.includes('x.com') ? 'Twitter/X'
    : 'Outro'

  // Extrai handle do URL
  const handle = extrairHandle(url, plataforma)

  // Tenta extrair nome limpo do título (remove sufixos como "• Instagram photos and videos")
  const nome = limparNome(titulo)

  return {
    id:          url, // URL como chave única
    nome,
    handle,
    plataforma,
    url,
    snippet,
    titulo:      titulo,
  }
}

function extrairHandle(url, plataforma) {
  try {
    const u = new URL(url)
    const partes = u.pathname.split('/').filter(Boolean)
    if (plataforma === 'Instagram' && partes.length >= 1) return `@${partes[0]}`
    if (plataforma === 'TikTok'    && partes.length >= 1) return `@${partes[0].replace('@', '')}`
    if (plataforma === 'YouTube'   && partes.includes('channel')) {
      const i = partes.indexOf('channel')
      return partes[i + 1] || ''
    }
    return partes[0] ? `@${partes[0]}` : ''
  } catch { return '' }
}

function limparNome(titulo) {
  return titulo
    .replace(/\s*[•·|]\s*.*(Instagram|TikTok|YouTube|photos|videos|profile).*/i, '')
    .replace(/@[\w.]+/, '')
    .replace(/\(\d+\)/, '')
    .trim()
    || titulo
}
