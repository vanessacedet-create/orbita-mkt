import { useState, useCallback } from 'react'
import { searchChannels, classificarTamanho, formatarInscritos } from '../lib/youtube'
import { createParceiro } from '../lib/parceiros'
import {
  Search, Youtube, Plus, Check, ExternalLink, SlidersHorizontal,
  Users, Video, Eye, X, Key, ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react'

// ── Filtros de tamanho ─────────────────────────────────────
const TAMANHOS = [
  { key: 'nano',   label: 'Nano',   range: '1–10K',    min: 0,       max: 9_999    },
  { key: 'micro',  label: 'Micro',  range: '10–100K',  min: 10_000,  max: 99_999   },
  { key: 'medio',  label: 'Médio',  range: '100–500K', min: 100_000, max: 499_999  },
  { key: 'grande', label: 'Grande', range: '500K+',    min: 500_000, max: Infinity },
]

const SUGESTOES = [
  'booktuber livros', 'resenha literária', 'leitura recomendação',
  'booktok livros', 'clube do livro', 'literatura brasileira',
  'leitura fantasia', 'romance literário', 'autoajuda leitura',
  'filosofia livros', 'teologia livros', 'história livros',
]

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }
  return [toast, show]
}

// ── Badge de tamanho ───────────────────────────────────────
function BadgeTamanho({ inscritos }) {
  if (!inscritos) return null
  const t = classificarTamanho(inscritos)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: t.bg, border: `1px solid ${t.cor}40`,
      borderRadius: 20, padding: '2px 8px',
      fontSize: 11, fontWeight: 700, color: t.cor,
    }}>
      {t.label}
    </span>
  )
}

// ── Card de canal ──────────────────────────────────────────
function CanalCard({ canal, onAdd, adicionado, adicionando }) {
  const [expandido, setExpandido] = useState(false)

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${adicionado ? 'var(--green)' : 'var(--border)'}`,
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      transition: 'border-color 0.2s',
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {canal.thumbnail ? (
          <img
            src={canal.thumbnail}
            alt={canal.nome}
            style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Youtube size={22} color="var(--text-muted)" />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{canal.nome}</span>
            <BadgeTamanho inscritos={canal.inscritos} />
          </div>
          {canal.handle && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {canal.handle}
            </div>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { icon: Users, label: 'Inscritos', value: canal.inscritosOcultos ? 'Oculto' : formatarInscritos(canal.inscritos) },
          { icon: Video, label: 'Vídeos',    value: canal.videos ? canal.videos.toLocaleString('pt-BR') : '—' },
          { icon: Eye,   label: 'Views',     value: formatarInscritos(canal.visualizacoes) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} style={{
            flex: 1, background: 'var(--surface-2)',
            borderRadius: 8, padding: '8px 10px', textAlign: 'center',
          }}>
            <Icon size={13} color="var(--text-muted)" style={{ marginBottom: 3 }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Descrição */}
      {canal.descricao && (
        <div>
          <p style={{
            fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: expandido ? 'unset' : 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {canal.descricao}
          </p>
          {canal.descricao.length > 100 && (
            <button
              onClick={() => setExpandido(e => !e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              {expandido ? <><ChevronUp size={12}/> Ver menos</> : <><ChevronDown size={12}/> Ver mais</>}
            </button>
          )}
        </div>
      )}

      {/* Ações */}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <a
          href={canal.url} target="_blank" rel="noreferrer"
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text-soft)', textDecoration: 'none',
          }}
        >
          <ExternalLink size={13} /> Ver canal
        </a>

        <button
          onClick={() => onAdd(canal)}
          disabled={adicionado || adicionando}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: adicionado ? 'var(--green-light)' : 'var(--accent-glow)',
            border: `1px solid ${adicionado ? 'var(--green)' : 'var(--accent)'}`,
            color: adicionado ? 'var(--green)' : 'var(--accent)',
            cursor: adicionado || adicionando ? 'default' : 'pointer',
            opacity: adicionando ? 0.7 : 1,
            transition: 'all 0.15s',
          }}
        >
          {adicionado
            ? <><Check size={13} /> Adicionado</>
            : adicionando
            ? 'Salvando...'
            : <><Plus size={13} /> Adicionar</>
          }
        </button>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────
export default function Descoberta() {
  const [apiKey, setApiKey]           = useState(localStorage.getItem('yt_api_key') || '')
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('yt_api_key') || '')
  const [showKeyForm, setShowKeyForm] = useState(!localStorage.getItem('yt_api_key'))
  const [query, setQuery]             = useState('')
  const [canais, setCanais]           = useState([])
  const [loading, setLoading]         = useState(false)
  const [erro, setErro]               = useState(null)
  const [adicionados, setAdicionados] = useState(new Set())
  const [adicionando, setAdicionando] = useState(null)
  const [tamanhosFiltro, setTamanhosFiltro] = useState(['nano', 'micro'])
  const [toast, showToast]            = useToast()

  function salvarApiKey() {
    localStorage.setItem('yt_api_key', apiKeyInput)
    setApiKey(apiKeyInput)
    setShowKeyForm(false)
    showToast('API Key salva!')
  }

  function limparApiKey() {
    localStorage.removeItem('yt_api_key')
    setApiKey('')
    setApiKeyInput('')
    setShowKeyForm(true)
  }

  function toggleTamanho(key) {
    setTamanhosFiltro(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const buscar = useCallback(async (q = query) => {
    if (!q.trim()) return
    if (!apiKey) { setShowKeyForm(true); return }
    setLoading(true)
    setErro(null)
    try {
      const resultados = await searchChannels({ query: q.trim(), maxResults: 20, apiKey })
      setCanais(resultados)
      if (resultados.length === 0) setErro('Nenhum canal encontrado. Tente outras palavras-chave.')
    } catch (e) {
      setErro(e.message)
      setCanais([])
    } finally {
      setLoading(false)
    }
  }, [query, apiKey])

  async function adicionarParceiro(canal) {
    setAdicionando(canal.id)
    try {
      await createParceiro({
        nome:            canal.nome,
        username:        canal.handle || canal.id,
        platforms:       'YouTube',
        followers_count: canal.inscritos,
        profile_url:     canal.url,
        temas:           '',
        tipo_parceria:   '',
        status:          'ativo',
        notes:           `Canal do YouTube descoberto via busca. ${canal.descricao ? canal.descricao.slice(0, 200) : ''}`,
      })
      setAdicionados(prev => new Set([...prev, canal.id]))
      showToast(`${canal.nome} adicionado como parceiro!`)
    } catch (e) {
      showToast('Erro ao adicionar: ' + (e.message || 'Tente novamente'), 'error')
    } finally {
      setAdicionando(null)
    }
  }

  const canaisFiltrados = canais.filter(c => {
    if (tamanhosFiltro.length === 0) return true
    return tamanhosFiltro.some(key => {
      const t = TAMANHOS.find(t => t.key === key)
      return t && c.inscritos >= t.min && c.inscritos <= t.max
    })
  })

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Youtube size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Descoberta de Criadores</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Encontre BookTubers via YouTube Data API
            </p>
          </div>
        </div>

        {apiKey && (
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowKeyForm(v => !v)}>
            <Key size={13} /> API Key
          </button>
        )}
      </div>

      {/* Configuração da API Key */}
      {showKeyForm && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Key size={15} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: 14 }}>YouTube Data API Key</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Necessária para buscar canais. Crie gratuitamente em{' '}
            <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer"
               style={{ color: 'var(--accent)' }}>console.cloud.google.com</a>{' '}
            → Ative a <strong style={{ color: 'var(--text)' }}>YouTube Data API v3</strong>{' '}
            → Credenciais → Criar chave de API.
            A chave é salva apenas no seu navegador.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              type="password"
              placeholder="AIzaSy..."
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && salvarApiKey()}
            />
            <button className="btn btn-primary" onClick={salvarApiKey} disabled={!apiKeyInput.trim()}>
              Salvar
            </button>
            {apiKey && (
              <button className="btn btn-ghost" onClick={() => setShowKeyForm(false)}>
                Cancelar
              </button>
            )}
          </div>
          {apiKey && (
            <button
              onClick={limparApiKey}
              style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 12 }}
            >
              Remover chave salva
            </button>
          )}
        </div>
      )}

      {/* Busca */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="search-input"
            style={{ flex: 1 }}
            placeholder='Ex: "booktuber livros", "resenha literária", "clube do livro"...'
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()}
          />
          <button
            className="btn btn-primary"
            onClick={() => buscar()}
            disabled={loading || !query.trim() || !apiKey}
            style={{ minWidth: 100 }}
          >
            {loading ? 'Buscando...' : <><Search size={14} /> Buscar</>}
          </button>
        </div>

        {/* Sugestões */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
            Sugestões
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SUGESTOES.map(s => (
              <button
                key={s}
                onClick={() => { setQuery(s); buscar(s) }}
                style={{
                  background: query === s ? 'var(--accent-glow)' : 'var(--surface-2)',
                  border: `1px solid ${query === s ? 'var(--accent)' : 'var(--border)'}`,
                  color: query === s ? 'var(--accent)' : 'var(--text-muted)',
                  borderRadius: 20, padding: '4px 10px', fontSize: 12,
                  cursor: 'pointer', fontWeight: 500,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros de tamanho */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <SlidersHorizontal size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Filtrar por tamanho
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {TAMANHOS.map(t => {
              const ativo = tamanhosFiltro.includes(t.key)
              const tam = classificarTamanho(t.min || 1)
              return (
                <button
                  key={t.key}
                  onClick={() => toggleTamanho(t.key)}
                  style={{
                    background: ativo ? tam.bg : 'var(--surface-2)',
                    border: `1px solid ${ativo ? tam.cor : 'var(--border)'}`,
                    color: ativo ? tam.cor : 'var(--text-muted)',
                    borderRadius: 20, padding: '5px 12px',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  }}
                >
                  <span>{t.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>{t.range}</span>
                </button>
              )
            })}
            {tamanhosFiltro.length > 0 && tamanhosFiltro.length < TAMANHOS.length && (
              <button
                onClick={() => setTamanhosFiltro([])}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <X size={11} /> Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div style={{
          background: 'var(--red-light)', border: '1px solid rgba(245,101,101,0.2)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, color: 'var(--red)',
        }}>
          <AlertCircle size={15} /> {erro}
        </div>
      )}

      {/* Resultados */}
      {canaisFiltrados.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {canaisFiltrados.length} canal{canaisFiltrados.length !== 1 ? 'is' : ''} encontrado{canaisFiltrados.length !== 1 ? 's' : ''}
              {canais.length !== canaisFiltrados.length && ` (de ${canais.length} total)`}
            </span>
            {adicionados.size > 0 && (
              <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={13} /> {adicionados.size} adicionado{adicionados.size !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {canaisFiltrados.map(canal => (
              <CanalCard
                key={canal.id}
                canal={canal}
                onAdd={adicionarParceiro}
                adicionado={adicionados.has(canal.id)}
                adicionando={adicionando === canal.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {!loading && canais.length === 0 && !erro && (
        <div className="empty-state" style={{ padding: '60px 20px' }}>
          <Youtube size={36} strokeWidth={1.2} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Busque por palavra-chave para encontrar BookTubers
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Experimente: "booktuber livros", "resenha literária"
          </p>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
