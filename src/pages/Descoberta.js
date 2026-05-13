import { useState, useCallback } from 'react'
import { searchChannels, classificarTamanho, formatarInscritos } from '../lib/youtube'
import { buscarGoogle, FILTROS_DATA, QUERIES_SUGERIDAS } from '../lib/googleSearch'
import { createParceiro } from '../lib/parceiros'
import {
  Search, Youtube, Plus, Check, ExternalLink, SlidersHorizontal,
  Users, Video, Eye, X, Key, ChevronDown, ChevronUp, AlertCircle,
  Globe, Instagram, ChevronLeft, ChevronRight, Loader,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────
const TAMANHOS = [
  { key: 'nano',   label: 'Nano',   range: '1–10K',    min: 0,       max: 9_999    },
  { key: 'micro',  label: 'Micro',  range: '10–100K',  min: 10_000,  max: 99_999   },
  { key: 'medio',  label: 'Médio',  range: '100–500K', min: 100_000, max: 499_999  },
  { key: 'grande', label: 'Grande', range: '500K+',    min: 500_000, max: Infinity },
]

const SUGESTOES_YT = [
  'booktuber livros', 'resenha literária', 'leitura recomendação',
  'booktok livros', 'clube do livro', 'literatura brasileira',
  'leitura fantasia', 'romance literário', 'autoajuda leitura',
]

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }
  return [toast, show]
}

function corPlataforma(plataforma) {
  if (plataforma === 'Instagram') return '#E1306C'
  if (plataforma === 'TikTok')    return '#69C9D0'
  if (plataforma === 'YouTube')   return '#FF0000'
  return 'var(--text-muted)'
}

// ── Config Box de API Key ──────────────────────────────────
function ConfigKey({ storageKey, label, placeholder, descricao, onSalvo }) {
  const [val, setVal]       = useState(localStorage.getItem(storageKey) || '')
  const [input, setInput]   = useState(localStorage.getItem(storageKey) || '')
  const [aberto, setAberto] = useState(!localStorage.getItem(storageKey))

  function salvar() {
    localStorage.setItem(storageKey, input)
    setVal(input)
    setAberto(false)
    onSalvo?.()
  }
  function remover() {
    localStorage.removeItem(storageKey)
    setVal('')
    setInput('')
    setAberto(true)
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Key size={13} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 13 }}>{label}</span>
          {val && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>● Configurada</span>}
        </div>
        {val && (
          <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setAberto(v => !v)}>
            {aberto ? 'Fechar' : 'Editar'}
          </button>
        )}
      </div>
      {aberto && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}
             dangerouslySetInnerHTML={{ __html: descricao }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" style={{ flex: 1, fontSize: 13 }} type="password" placeholder={placeholder} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && salvar()} />
            <button className="btn btn-primary" onClick={salvar} disabled={!input.trim()}>Salvar</button>
            {val && <button className="btn btn-ghost" onClick={() => setAberto(false)}>Cancelar</button>}
          </div>
          {val && <button onClick={remover} style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 11 }}>Remover chave</button>}
        </div>
      )}
    </div>
  )
}

// ── Aba YouTube ────────────────────────────────────────────
function BadgeTamanho({ inscritos }) {
  if (!inscritos) return null
  const t = classificarTamanho(inscritos)
  return <span style={{ background: t.bg, border: `1px solid ${t.cor}40`, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: t.cor }}>{t.label}</span>
}

function CanalCard({ canal, onAdd, adicionado, adicionando }) {
  const [expandido, setExpandido] = useState(false)
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${adicionado ? 'var(--green)' : 'var(--border)'}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {canal.thumbnail
          ? <img src={canal.thumbnail} alt={canal.nome} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Youtube size={22} color="var(--text-muted)" /></div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{canal.nome}</span>
            <BadgeTamanho inscritos={canal.inscritos} />
          </div>
          {canal.handle && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{canal.handle}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {[
          { icon: Users, label: 'Inscritos', value: canal.inscritosOcultos ? 'Oculto' : formatarInscritos(canal.inscritos) },
          { icon: Video, label: 'Vídeos',    value: canal.videos?.toLocaleString('pt-BR') || '—' },
          { icon: Eye,   label: 'Views',     value: formatarInscritos(canal.visualizacoes) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
            <Icon size={13} color="var(--text-muted)" style={{ marginBottom: 3 }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
      {canal.descricao && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: expandido ? 'unset' : 2, WebkitBoxOrient: 'vertical' }}>
            {canal.descricao}
          </p>
          {canal.descricao.length > 100 && (
            <button onClick={() => setExpandido(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 3 }}>
              {expandido ? <><ChevronUp size={12}/> Ver menos</> : <><ChevronDown size={12}/> Ver mais</>}
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <a href={canal.url} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-soft)', textDecoration: 'none' }}>
          <ExternalLink size={13} /> Ver canal
        </a>
        <button onClick={() => onAdd(canal)} disabled={adicionado || adicionando} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: adicionado ? 'var(--green-light)' : 'var(--accent-glow)', border: `1px solid ${adicionado ? 'var(--green)' : 'var(--accent)'}`, color: adicionado ? 'var(--green)' : 'var(--accent)', cursor: adicionado || adicionando ? 'default' : 'pointer' }}>
          {adicionado ? <><Check size={13} /> Adicionado</> : adicionando ? 'Salvando...' : <><Plus size={13} /> Adicionar</>}
        </button>
      </div>
    </div>
  )
}

function AbaYoutube({ showToast }) {
  const [apiKey, setApiKey]         = useState(localStorage.getItem('yt_api_key') || '')
  const [query, setQuery]           = useState('')
  const [canais, setCanais]         = useState([])
  const [loading, setLoading]       = useState(false)
  const [erro, setErro]             = useState(null)
  const [adicionados, setAdicionados] = useState(new Set())
  const [adicionando, setAdicionando] = useState(null)
  const [tamanhosFiltro, setTamanhosFiltro] = useState(['nano', 'micro'])

  function toggleTamanho(key) { setTamanhosFiltro(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]) }

  const buscar = useCallback(async (q = query) => {
    if (!q.trim() || !apiKey) return
    setLoading(true); setErro(null)
    try {
      const res = await searchChannels({ query: q.trim(), maxResults: 20, apiKey })
      setCanais(res)
      if (!res.length) setErro('Nenhum canal encontrado. Tente outras palavras-chave.')
    } catch (e) { setErro(e.message); setCanais([]) }
    finally { setLoading(false) }
  }, [query, apiKey])

  async function adicionarParceiro(canal) {
    setAdicionando(canal.id)
    try {
      await createParceiro({ nome: canal.nome, username: canal.handle || canal.id, platforms: 'YouTube', followers_count: canal.inscritos, profile_url: canal.url, notes: canal.descricao?.slice(0, 200) || '' })
      setAdicionados(prev => new Set([...prev, canal.id]))
      showToast(`${canal.nome} adicionado!`)
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
    finally { setAdicionando(null) }
  }

  const canaisFiltrados = canais.filter(c => {
    if (!tamanhosFiltro.length) return true
    return tamanhosFiltro.some(key => { const t = TAMANHOS.find(t => t.key === key); return t && c.inscritos >= t.min && c.inscritos <= t.max })
  })

  return (
    <div>
      <ConfigKey storageKey="yt_api_key" label="YouTube Data API Key" placeholder="AIzaSy..." onSalvo={() => setApiKey(localStorage.getItem('yt_api_key') || '')}
        descricao='Crie gratuitamente em <a href="https://console.cloud.google.com" target="_blank" style="color:var(--accent)">console.cloud.google.com</a> → Ative a <strong>YouTube Data API v3</strong> → Credenciais → Criar chave de API.'
      />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input className="search-input" style={{ flex: 1 }} placeholder='"booktuber livros", "resenha literária"...' value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} />
          <button className="btn btn-primary" onClick={() => buscar()} disabled={loading || !query.trim() || !apiKey} style={{ minWidth: 100 }}>
            {loading ? 'Buscando...' : <><Search size={14} /> Buscar</>}
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
          {SUGESTOES_YT.map(s => (
            <button key={s} onClick={() => { setQuery(s); buscar(s) }} style={{ background: query === s ? 'var(--accent-glow)' : 'var(--surface-2)', border: `1px solid ${query === s ? 'var(--accent)' : 'var(--border)'}`, color: query === s ? 'var(--accent)' : 'var(--text-muted)', borderRadius: 20, padding: '3px 9px', fontSize: 12, cursor: 'pointer' }}>{s}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <SlidersHorizontal size={12} color="var(--text-muted)" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Tamanho</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {TAMANHOS.map(t => {
            const ativo = tamanhosFiltro.includes(t.key)
            const tam = classificarTamanho(t.min || 1)
            return (
              <button key={t.key} onClick={() => toggleTamanho(t.key)} style={{ background: ativo ? tam.bg : 'var(--surface-2)', border: `1px solid ${ativo ? tam.cor : 'var(--border)'}`, color: ativo ? tam.cor : 'var(--text-muted)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span>{t.label}</span><span style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>{t.range}</span>
              </button>
            )
          })}
          {tamanhosFiltro.length > 0 && tamanhosFiltro.length < TAMANHOS.length && (
            <button onClick={() => setTamanhosFiltro([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><X size={11} /> Limpar</button>
          )}
        </div>
      </div>

      {erro && <div style={{ background: 'var(--red-light)', border: '1px solid rgba(245,101,101,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--red)' }}><AlertCircle size={14} /> {erro}</div>}

      {canaisFiltrados.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{canaisFiltrados.length} canal{canaisFiltrados.length !== 1 ? 'is' : ''}{canais.length !== canaisFiltrados.length && ` (de ${canais.length})`}</span>
            {adicionados.size > 0 && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={13} /> {adicionados.size} adicionado{adicionados.size !== 1 ? 's' : ''}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {canaisFiltrados.map(canal => <CanalCard key={canal.id} canal={canal} onAdd={adicionarParceiro} adicionado={adicionados.has(canal.id)} adicionando={adicionando === canal.id} />)}
          </div>
        </div>
      )}

      {!loading && !canais.length && !erro && (
        <div className="empty-state" style={{ padding: '50px 20px' }}>
          <Youtube size={34} strokeWidth={1.2} color="var(--text-muted)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Busque por palavra-chave para encontrar BookTubers</p>
        </div>
      )}
    </div>
  )
}

// ── Aba Google ─────────────────────────────────────────────
function ResultadoCard({ r, onAdd, adicionado, adicionando }) {
  const cor = corPlataforma(r.plataforma)
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${adicionado ? 'var(--green)' : 'var(--border)'}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, lineHeight: 1.3 }}>{r.nome || r.titulo}</div>
          {r.handle && <div style={{ fontSize: 12, color: cor, fontWeight: 600 }}>{r.handle}</div>}
        </div>
        <span style={{ background: `${cor}18`, border: `1px solid ${cor}40`, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: cor, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {r.plataforma}
        </span>
      </div>
      {r.snippet && <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{r.snippet}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <a href={r.url} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-soft)', textDecoration: 'none' }}>
          <ExternalLink size={12} /> Ver perfil
        </a>
        <button onClick={() => onAdd(r)} disabled={adicionado || adicionando} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: adicionado ? 'var(--green-light)' : 'var(--accent-glow)', border: `1px solid ${adicionado ? 'var(--green)' : 'var(--accent)'}`, color: adicionado ? 'var(--green)' : 'var(--accent)', cursor: adicionado || adicionando ? 'default' : 'pointer' }}>
          {adicionado ? <><Check size={12}/> Adicionado</> : adicionando ? 'Salvando...' : <><Plus size={12}/> Adicionar</>}
        </button>
      </div>
    </div>
  )
}

function AbaGoogle({ showToast }) {
  const [apiKey, setApiKey]   = useState(localStorage.getItem('google_cse_key') || '')
  const [cx, setCx]           = useState(localStorage.getItem('google_cse_cx') || '')
  const [query, setQuery]     = useState('')
  const [dateFiltro, setDateFiltro] = useState('')
  const [resultados, setResultados] = useState([])
  const [total, setTotal]     = useState(0)
  const [pagina, setPagina]   = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState(null)
  const [adicionados, setAdicionados] = useState(new Set())
  const [adicionando, setAdicionando] = useState(null)

  const POR_PAGINA = 10

  async function buscar(q = query, p = 1) {
    const key = localStorage.getItem('google_cse_key') || ''
    const cxVal = localStorage.getItem('google_cse_cx') || ''
    if (!q.trim() || !key || !cxVal) { setErro('Configure a API Key e o Search Engine ID antes de buscar.'); return }
    setLoading(true); setErro(null)
    try {
      const start = (p - 1) * POR_PAGINA + 1
      const { resultados: res, totalEstimado } = await buscarGoogle({ query: q.trim(), apiKey: key, cx: cxVal, dateRestrict: dateFiltro, start })
      setResultados(res)
      setTotal(totalEstimado)
      setPagina(p)
      if (!res.length) setErro('Nenhum resultado encontrado. Tente outra query ou data.')
    } catch (e) { setErro(e.message); setResultados([]) }
    finally { setLoading(false) }
  }

  async function adicionarParceiro(r) {
    setAdicionando(r.id)
    try {
      await createParceiro({ nome: r.nome || r.titulo, username: r.handle?.replace('@', '') || '', platforms: r.plataforma, profile_url: r.url, notes: r.snippet?.slice(0, 300) || '' })
      setAdicionados(prev => new Set([...prev, r.id]))
      showToast(`${r.nome || r.titulo} adicionado como parceiro!`)
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
    finally { setAdicionando(null) }
  }

  const totalPaginas = Math.min(Math.ceil(total / POR_PAGINA), 10) // Google CSE limita a 100 resultados

  return (
    <div>
      {/* Config API Key */}
      <ConfigKey storageKey="google_cse_key" label="Google Custom Search API Key" placeholder="AIzaSy..." onSalvo={() => setApiKey(localStorage.getItem('google_cse_key') || '')}
        descricao='Crie em <a href="https://console.cloud.google.com" target="_blank" style="color:var(--accent)">console.cloud.google.com</a> → Ative a <strong>Custom Search API</strong> → Credenciais → Criar chave de API. Gratuita: 100 buscas/dia.'
      />
      <ConfigKey storageKey="google_cse_cx" label="Search Engine ID (cx)" placeholder="a1b2c3d4e5f6g7h8i" onSalvo={() => setCx(localStorage.getItem('google_cse_cx') || '')}
        descricao='Crie em <a href="https://programmablesearchengine.google.com" target="_blank" style="color:var(--accent)">programmablesearchengine.google.com</a> → Novo buscador → deixe "Sites" em branco → ative <strong>Pesquisar na web inteira</strong> → copie o ID.'
      />

      {/* Busca */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        {/* Campo de query */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            className="search-input" style={{ flex: 1 }}
            placeholder='Ex: site:instagram.com "true crime" "livros"'
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()}
          />
          <button className="btn btn-primary" onClick={() => buscar()} disabled={loading || !query.trim()} style={{ minWidth: 100 }}>
            {loading ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Buscando...</> : <><Search size={14} /> Buscar</>}
          </button>
        </div>

        {/* Filtro de data */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Filtrar por data</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {FILTROS_DATA.map(f => (
              <button key={f.value} onClick={() => setDateFiltro(f.value)} style={{ background: dateFiltro === f.value ? 'var(--accent-glow)' : 'var(--surface-2)', border: `1px solid ${dateFiltro === f.value ? 'var(--accent)' : 'var(--border)'}`, color: dateFiltro === f.value ? 'var(--accent)' : 'var(--text-muted)', borderRadius: 20, padding: '3px 9px', fontSize: 11, cursor: 'pointer', fontWeight: dateFiltro === f.value ? 700 : 400 }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Queries sugeridas */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Sugestões para livros</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {QUERIES_SUGERIDAS.map(s => (
              <button key={s.label} onClick={() => { setQuery(s.query); buscar(s.query) }} style={{ background: query === s.query ? 'var(--accent-glow)' : 'var(--surface-2)', border: `1px solid ${query === s.query ? 'var(--accent)' : 'var(--border)'}`, color: query === s.query ? 'var(--accent)' : 'var(--text-muted)', borderRadius: 20, padding: '3px 9px', fontSize: 11, cursor: 'pointer' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {erro && <div style={{ background: 'var(--red-light)', border: '1px solid rgba(245,101,101,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--red)' }}><AlertCircle size={14} /> {erro}</div>}

      {resultados.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {resultados.length} resultados {total > 10 && `(~${total.toLocaleString('pt-BR')} no total)`}
              {dateFiltro && ` · ${FILTROS_DATA.find(f => f.value === dateFiltro)?.label}`}
            </span>
            {adicionados.size > 0 && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={13} /> {adicionados.size} adicionado{adicionados.size !== 1 ? 's' : ''}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 20 }}>
            {resultados.map(r => <ResultadoCard key={r.id} r={r} onAdd={adicionarParceiro} adicionado={adicionados.has(r.id)} adicionando={adicionando === r.id} />)}
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={pagina === 1 || loading} onClick={() => buscar(query, pagina - 1)}>
                <ChevronLeft size={13} /> Anterior
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Página {pagina} de {totalPaginas}</span>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={pagina >= totalPaginas || loading} onClick={() => buscar(query, pagina + 1)}>
                Próxima <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && !resultados.length && !erro && (
        <div className="empty-state" style={{ padding: '50px 20px' }}>
          <Globe size={34} strokeWidth={1.2} color="var(--text-muted)" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Busque perfis públicos indexados pelo Google</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Experimente: <code style={{ background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 4 }}>site:instagram.com "true crime" "livros"</code></p>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────
export default function Descoberta() {
  const [aba, setAba]     = useState('google')
  const [toast, showToast] = useToast()

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <Search size={22} color="var(--accent)" />
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Descoberta de Criadores</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Encontre parceiros no Google, Instagram, TikTok e YouTube</p>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { id: 'google',  label: 'Google',  icon: Globe,    desc: 'Instagram & TikTok' },
          { id: 'youtube', label: 'YouTube', icon: Youtube,  desc: 'BookTubers'          },
        ].map(tab => {
          const Icon = tab.icon
          const ativo = aba === tab.id
          return (
            <button key={tab.id} onClick={() => setAba(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${ativo ? 'var(--accent)' : 'transparent'}`, color: ativo ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: ativo ? 700 : 500, marginBottom: -1, transition: 'all 0.15s' }}>
              <Icon size={14} /> {tab.label}
              <span style={{ fontSize: 11, opacity: 0.7 }}>· {tab.desc}</span>
            </button>
          )
        })}
      </div>

      {aba === 'google'  && <AbaGoogle  showToast={showToast} />}
      {aba === 'youtube' && <AbaYoutube showToast={showToast} />}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
