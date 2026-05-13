// ── YOUTUBE DATA API v3 ────────────────────────────────────
// Chave configurada em src/lib/youtube.js ou via variável de ambiente
// Para usar: defina REACT_APP_YOUTUBE_API_KEY no seu .env

const BASE = 'https://www.googleapis.com/youtube/v3'

export async function searchChannels({ query, maxResults = 20, apiKey }) {
  if (!apiKey) throw new Error('API key do YouTube não configurada.')

  // 1. Busca canais pela palavra-chave
  const searchRes = await fetch(
    `${BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=${maxResults}&relevanceLanguage=pt&key=${apiKey}`
  )
  const searchData = await searchRes.json()

  if (searchData.error) {
    throw new Error(searchData.error.message || 'Erro na YouTube API')
  }

  const channelIds = (searchData.items || []).map(i => i.snippet.channelId).join(',')
  if (!channelIds) return []

  // 2. Busca estatísticas dos canais encontrados
  const statsRes = await fetch(
    `${BASE}/channels?part=snippet,statistics,brandingSettings&id=${channelIds}&key=${apiKey}`
  )
  const statsData = await statsRes.json()

  if (statsData.error) {
    throw new Error(statsData.error.message || 'Erro ao buscar estatísticas')
  }

  return (statsData.items || []).map(ch => ({
    id:           ch.id,
    nome:         ch.snippet.title,
    descricao:    ch.snippet.description,
    thumbnail:    ch.snippet.thumbnails?.medium?.url || ch.snippet.thumbnails?.default?.url,
    pais:         ch.snippet.country || null,
    url:          `https://www.youtube.com/channel/${ch.id}`,
    handle:       ch.snippet.customUrl || null,
    inscritos:    parseInt(ch.statistics?.subscriberCount || 0),
    videos:       parseInt(ch.statistics?.videoCount || 0),
    visualizacoes:parseInt(ch.statistics?.viewCount || 0),
    inscritosOcultos: ch.statistics?.hiddenSubscriberCount || false,
    plataforma:   'YouTube',
  }))
}

export function classificarTamanho(inscritos) {
  if (inscritos < 10_000)  return { label: 'Nano',  cor: '#6c72f5', bg: 'rgba(108,114,245,0.12)' }
  if (inscritos < 100_000) return { label: 'Micro', cor: '#3ecf8e', bg: 'rgba(62,207,142,0.12)'  }
  if (inscritos < 500_000) return { label: 'Médio', cor: '#f5a623', bg: 'rgba(245,166,35,0.12)'  }
  return                          { label: 'Grande', cor: '#e06030', bg: 'rgba(224,96,48,0.15)'   }
}

export function formatarInscritos(n) {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}
