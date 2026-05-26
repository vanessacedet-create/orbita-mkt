import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getMarcas, getConversas, getConversa, getMensagens,
  addMensagem, marcarLidas, getContagemNaoLidas,
  vincularParceiro, updateConversa,
  enviarMensagemMeta, subscribeConversa, subscribeConversas,
} from '../lib/inbox'
import { getParceiros } from '../lib/supabase'
import {
  Inbox, Search, Send, RefreshCw, ExternalLink,
  Instagram, Youtube, Link2, User, ChevronDown, X,
  MessageSquare, Clock, CheckCheck, Wifi,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── UTILITÁRIOS ────────────────────────────────────────────────
function iniciais(nome = '') {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

function avatarCor(nome = '') {
  const CORES = ['#6c72f5','#3ecf8e','#e06030','#f5a623','#f56565','#06b6d4','#a855f7','#14b8a6']
  let h = 0
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return CORES[Math.abs(h) % CORES.length]
}

function TempoRelativo({ data }) {
  if (!data) return null
  return (
    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
      {formatDistanceToNow(new Date(data), { addSuffix: false, locale: ptBR })}
    </span>
  )
}

// ── AVATAR ────────────────────────────────────────────────────
function Avatar({ nome, size = 32 }) {
  const cor = avatarCor(nome)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: cor + '22', border: `1px solid ${cor}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: cor, flexShrink: 0,
    }}>
      {iniciais(nome)}
    </div>
  )
}

// ── BADGE DE MARCA ────────────────────────────────────────────
function BadgeMarca({ marca, cor, small }) {
  return (
    <span style={{
      display: 'inline-block',
      fontSize: small ? 10 : 11,
      padding: small ? '1px 6px' : '2px 9px',
      borderRadius: 20,
      background: (cor || '#6c72f5') + '22',
      border: `1px solid ${(cor || '#6c72f5')}44`,
      color: cor || '#6c72f5',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {marca}
    </span>
  )
}

// ── BADGE STATUS ──────────────────────────────────────────────
const STATUS_STYLE = {
  aberto:      { label: 'Aberto',      cor: '#3ecf8e' },
  aguardando:  { label: 'Aguardando',  cor: '#f5a623' },
  fechado:     { label: 'Fechado',     cor: '#6e7190' },
}

function BadgeStatus({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.aberto
  return (
    <span style={{
      fontSize: 10, padding: '1px 7px', borderRadius: 20, fontWeight: 700,
      background: s.cor + '22', border: `1px solid ${s.cor}44`, color: s.cor,
    }}>
      {s.label}
    </span>
  )
}

// ── ITEM DA LISTA DE CONVERSAS ────────────────────────────────
function ItemConversa({ conversa, ativo, naoLida, marcaCor, onClick }) {
  const nome = conversa.parceiro?.nome || conversa.messenger_id || 'Desconhecido'
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        background: ativo ? 'var(--surface-3)' : 'transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!ativo) e.currentTarget.style.background = 'var(--surface-2)' }}
      onMouseLeave={e => { if (!ativo) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <Avatar nome={nome} size={30} />
        <span style={{
          flex: 1, fontSize: 13, fontWeight: naoLida ? 700 : 500,
          color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {nome}
        </span>
        {naoLida && (
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--indigo)', flexShrink: 0,
          }} />
        )}
        <TempoRelativo data={conversa.ultima_msg_at} />
      </div>
      <div style={{
        fontSize: 12, color: 'var(--text-muted)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginBottom: 5,
      }}>
        {conversa.ultima_mensagem || 'Sem mensagens ainda'}
      </div>
      <BadgeMarca marca={conversa.marca} cor={marcaCor} small />
    </div>
  )
}

// ── BOLHA DE MENSAGEM ─────────────────────────────────────────
function Bolha({ msg, usuario }) {
  const enviada = msg.direcao === 'enviada'
  return (
    <div style={{
      display: 'flex',
      flexDirection: enviada ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginBottom: 12,
    }}>
      {!enviada && <Avatar nome={usuario?.nome || 'Influencer'} size={24} />}
      <div style={{ maxWidth: '68%' }}>
        <div style={{
          padding: '9px 13px',
          borderRadius: enviada ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: enviada ? 'var(--indigo-light)' : 'var(--surface-2)',
          border: `1px solid ${enviada ? 'rgba(108,114,245,0.2)' : 'var(--border)'}`,
          fontSize: 13,
          color: 'var(--text)',
          lineHeight: 1.5,
        }}>
          {msg.conteudo}
        </div>
        <div style={{
          fontSize: 10, color: 'var(--text-muted)',
          textAlign: enviada ? 'right' : 'left',
          marginTop: 3, display: 'flex', alignItems: 'center',
          justifyContent: enviada ? 'flex-end' : 'flex-start', gap: 4,
        }}>
          {format(new Date(msg.created_at), 'HH:mm')}
          {enviada && msg.lida && <CheckCheck size={11} style={{ color: 'var(--indigo)' }} />}
        </div>
      </div>
    </div>
  )
}

// ── PAINEL LATERAL DIREITO: PERFIL DO PARCEIRO ────────────────
function PainelParceiro({ conversa, todos, onVincular, marcaCor }) {
  const [buscando, setBuscando] = useState(false)
  const [query, setQuery] = useState('')
  const [sugestoes, setSugestoes] = useState([])

  const parceiro = conversa?.parceiro

  function buscar(v) {
    setQuery(v)
    if (!v.trim()) { setSugestoes([]); return }
    const q = v.toLowerCase()
    setSugestoes(todos.filter(p =>
      p.nome.toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q)
    ).slice(0, 6))
  }

  async function vincular(p) {
    await onVincular(conversa.id, p.id)
    setBuscando(false)
    setQuery('')
    setSugestoes([])
  }

  const plataformas = parceiro?.platforms
    ? (Array.isArray(parceiro.platforms) ? parceiro.platforms : [parceiro.platforms]).filter(Boolean)
    : []

  return (
    <div style={{
      width: 220, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-soft)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Parceiro no CRM
        </span>
      </div>

      {parceiro ? (
        <div style={{ padding: 14, flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Avatar nome={parceiro.nome} size={38} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{parceiro.nome}</div>
              {parceiro.username && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{parceiro.username}</div>
              )}
            </div>
          </div>

          {plataformas.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Plataformas</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {plataformas.map(p => (
                  <span key={p} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 20,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    color: 'var(--text-soft)',
                  }}>{p}</span>
                ))}
              </div>
            </div>
          )}

          {parceiro.followers_count && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Seguidores</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>
                {typeof parceiro.followers_count === 'object'
                  ? Object.entries(parceiro.followers_count).map(([k, v]) => `${k}: ${Number(v).toLocaleString('pt-BR')}`).join(' · ')
                  : Number(parceiro.followers_count).toLocaleString('pt-BR')}
              </div>
            </div>
          )}

          {parceiro.contact_value && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Valor de contato</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{parceiro.contact_value}</div>
            </div>
          )}

          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Marca atual</div>
            <BadgeMarca marca={conversa.marca} cor={marcaCor} />
          </div>

          {parceiro.profile_url && (
            <a
              href={parceiro.profile_url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                marginTop: 12, fontSize: 12, color: 'var(--indigo)', textDecoration: 'none',
              }}
            >
              <ExternalLink size={12} /> Ver perfil
            </a>
          )}

          <button
            onClick={() => setBuscando(true)}
            style={{
              marginTop: 12, width: '100%', padding: '6px 0',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 12, color: 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            <Link2 size={12} /> Trocar vínculo
          </button>
        </div>
      ) : (
        <div style={{ padding: 14, flex: 1 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            Mensagem não vinculada a nenhum parceiro do CRM.
          </p>
          <button
            onClick={() => setBuscando(true)}
            style={{
              width: '100%', padding: '7px 0',
              background: 'var(--indigo-light)', border: '1px solid rgba(108,114,245,0.3)',
              borderRadius: 8, fontSize: 12, color: 'var(--indigo)',
              cursor: 'pointer', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            <Link2 size={12} /> Vincular ao CRM
          </button>
        </div>
      )}

      {buscando && (
        <div style={{
          position: 'absolute', right: 0, bottom: 60, width: 240,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 12, zIndex: 10, boxShadow: 'var(--shadow)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Buscar parceiro</span>
            <button onClick={() => setBuscando(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          </div>
          <input
            autoFocus
            placeholder="Nome ou @username"
            value={query}
            onChange={e => buscar(e.target.value)}
            style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text)', fontSize: 12 }}
          />
          {sugestoes.map(p => (
            <div
              key={p.id}
              onClick={() => vincular(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 4px', cursor: 'pointer', borderRadius: 6,
                marginTop: 4, transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Avatar nome={p.nome} size={24} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>{p.nome}</div>
                {p.username && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>@{p.username}</div>}
              </div>
            </div>
          ))}
          {query && sugestoes.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Nenhum parceiro encontrado.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────
export default function InboxInfluenciadores() {
  const { user } = useAuth()

  const [marcas, setMarcas] = useState([])
  const [marcaAtiva, setMarcaAtiva] = useState('todas')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [busca, setBusca] = useState('')

  const [conversas, setConversas] = useState([])
  const [conversaId, setConversaId] = useState(null)
  const [conversa, setConversa] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')

  const [todos, setTodos] = useState([])     // todos os parceiros para vincular
  const [contagem, setContagem] = useState({})

  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [wsStatus, setWsStatus] = useState('conectando') // conectando | ativo | erro

  const fimRef = useRef(null)
  const inputRef = useRef(null)

  // ── Carregamento inicial ──────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [ms, ps, cnt] = await Promise.all([getMarcas(), getParceiros(), getContagemNaoLidas()])
        setMarcas(ms)
        setTodos(ps)
        setContagem(cnt)
        setWsStatus('ativo')
      } catch (e) {
        setErro('Erro ao carregar dados: ' + e.message)
        setWsStatus('erro')
      } finally {
        setCarregando(false)
      }
    }
    init()
  }, [])

  // ── Carregar conversas quando filtros mudam ───────────────
  useEffect(() => {
    let ativo = true
    async function load() {
      try {
        const cs = await getConversas({ marca: marcaAtiva, status: statusFiltro, busca })
        if (ativo) setConversas(cs)
      } catch (e) {
        console.error(e)
      }
    }
    load()
    return () => { ativo = false }
  }, [marcaAtiva, statusFiltro, busca])

  // ── Realtime: lista de conversas ─────────────────────────
  useEffect(() => {
    const unsub = subscribeConversas(updated => {
      setConversas(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
      getContagemNaoLidas().then(setContagem).catch(console.error)
    })
    return unsub
  }, [])

  // ── Abrir conversa ────────────────────────────────────────
  useEffect(() => {
    if (!conversaId) return
    let ativo = true
    async function load() {
      const [cv, msgs] = await Promise.all([getConversa(conversaId), getMensagens(conversaId)])
      if (!ativo) return
      setConversa(cv)
      setMensagens(msgs)
      marcarLidas(conversaId).catch(console.error)
    }
    load()
    return () => { ativo = false }
  }, [conversaId])

  // ── Realtime: mensagens da conversa ativa ─────────────────
  useEffect(() => {
    if (!conversaId) return
    const unsub = subscribeConversa(conversaId, nova => {
      setMensagens(prev => [...prev, nova])
    })
    return unsub
  }, [conversaId])

  // ── Scroll para o fim ─────────────────────────────────────
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  // ── Enviar mensagem ───────────────────────────────────────
  async function enviar() {
    if (!texto.trim() || !conversa) return
    setEnviando(true)
    try {
      // Salva localmente
      const nova = await addMensagem({
        conversa_id: conversa.id,
        direcao: 'enviada',
        conteudo: texto.trim(),
        enviada_por_id: user?.id,
      })
      setMensagens(prev => [...prev, nova])
      setTexto('')

      // Envia pelo Meta se tiver credenciais
      const marcaConfig = marcas.find(m => m.nome === conversa.marca)
      if (marcaConfig?.access_token && conversa.messenger_id) {
        await enviarMensagemMeta({
          page_id: marcaConfig.page_id,
          access_token: marcaConfig.access_token,
          messenger_id: conversa.messenger_id,
          texto: texto.trim(),
        })
      }
    } catch (e) {
      setErro('Erro ao enviar: ' + e.message)
    } finally {
      setEnviando(false)
      inputRef.current?.focus()
    }
  }

  async function handleVincular(conversaId, parceiroId) {
    await vincularParceiro(conversaId, parceiroId)
    const cv = await getConversa(conversaId)
    setConversa(cv)
    setConversas(prev => prev.map(c => c.id === conversaId ? { ...c, parceiro: cv.parceiro } : c))
  }

  async function handleStatus(novoStatus) {
    await updateConversa(conversa.id, { status: novoStatus })
    setConversa(prev => ({ ...prev, status: novoStatus }))
    setConversas(prev => prev.map(c => c.id === conversa.id ? { ...c, status: novoStatus } : c))
  }

  const marcaCor = (nome) => marcas.find(m => m.nome === nome)?.cor || '#6c72f5'

  // ── RENDER ────────────────────────────────────────────────
  if (carregando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', height: 'calc(100vh - 60px)',
      overflow: 'hidden', position: 'relative',
    }}>

      {/* ── COLUNA: LISTA DE CONVERSAS ── */}
      <div style={{
        width: 290, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        background: 'var(--surface)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Inbox size={16} style={{ color: 'var(--indigo)' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Inbox de Influenciadores</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {conversas.length} conversa{conversas.length !== 1 ? 's' : ''} · {marcas.length} marcas
          </span>
        </div>

        {/* Busca */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="Buscar..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ width: '100%', paddingLeft: 28, fontSize: 12 }}
          />
        </div>

        {/* Filtro marcas */}
        <div style={{
          display: 'flex', gap: 6, padding: '8px 12px',
          borderBottom: '1px solid var(--border)', overflowX: 'auto',
        }}>
          {[{ nome: 'todas', cor: '#6c72f5' }, ...marcas].map(m => (
            <button
              key={m.nome}
              onClick={() => setMarcaAtiva(m.nome)}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                whiteSpace: 'nowrap', fontWeight: marcaAtiva === m.nome ? 700 : 500,
                background: marcaAtiva === m.nome ? (m.cor || '#6c72f5') + '22' : 'transparent',
                border: `1px solid ${marcaAtiva === m.nome ? (m.cor || '#6c72f5') + '66' : 'var(--border)'}`,
                color: marcaAtiva === m.nome ? (m.cor || '#6c72f5') : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {m.nome === 'todas' ? 'Todas' : m.nome}
              {m.nome !== 'todas' && contagem[m.nome] ? ` ${contagem[m.nome]}` : ''}
              {m.nome === 'todas' && contagem._total ? ` ${contagem._total}` : ''}
            </button>
          ))}
        </div>

        {/* Filtro status */}
        <div style={{ display: 'flex', gap: 4, padding: '6px 12px', borderBottom: '1px solid var(--border)' }}>
          {['todos','aberto','aguardando','fechado'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFiltro(s)}
              style={{
                padding: '2px 9px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                background: statusFiltro === s ? 'var(--surface-3)' : 'transparent',
                border: `1px solid ${statusFiltro === s ? 'var(--border)' : 'transparent'}`,
                color: statusFiltro === s ? 'var(--text)' : 'var(--text-muted)',
                textTransform: 'capitalize',
              }}
            >
              {s === 'todos' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversas.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <MessageSquare size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p>Nenhuma conversa</p>
            </div>
          ) : conversas.map(c => (
            <ItemConversa
              key={c.id}
              conversa={c}
              ativo={conversaId === c.id}
              naoLida={c.status === 'aberto'}
              marcaCor={marcaCor(c.marca)}
              onClick={() => setConversaId(c.id)}
            />
          ))}
        </div>
      </div>

      {/* ── COLUNA: CHAT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!conversa ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
          }}>
            <Inbox size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <p style={{ fontSize: 14 }}>Selecione uma conversa</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--surface)',
            }}>
              <Avatar nome={conversa.parceiro?.nome || conversa.messenger_id || '?'} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                  {conversa.parceiro?.nome || conversa.messenger_id || 'Desconhecido'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <BadgeMarca marca={conversa.marca} cor={marcaCor(conversa.marca)} small />
                  <BadgeStatus status={conversa.status} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Wifi size={11} style={{ color: '#3ecf8e' }} /> Meta Messenger
                  </span>
                </div>
              </div>
              {/* Troca de status */}
              <div style={{ display: 'flex', gap: 6 }}>
                {['aberto','aguardando','fechado'].filter(s => s !== conversa.status).map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatus(s)}
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)'; e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Mensagens */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {mensagens.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 40 }}>
                  <Clock size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p>Nenhuma mensagem ainda</p>
                </div>
              ) : mensagens.map(m => (
                <Bolha key={m.id} msg={m} usuario={user} />
              ))}
              <div ref={fimRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: '10px 14px', borderTop: '1px solid var(--border)',
              background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <input
                ref={inputRef}
                placeholder={`Responder como ${conversa.marca}...`}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
                style={{ flex: 1, fontSize: 13 }}
                disabled={enviando}
              />
              <button
                onClick={enviar}
                disabled={!texto.trim() || enviando}
                style={{
                  width: 36, height: 36, borderRadius: 9, border: 'none',
                  background: texto.trim() ? 'var(--indigo)' : 'var(--surface-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: texto.trim() ? 'pointer' : 'default',
                  transition: 'background 0.15s', flexShrink: 0,
                }}
              >
                <Send size={15} style={{ color: texto.trim() ? '#fff' : 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Status webhook */}
            <div style={{
              padding: '5px 14px', borderTop: '1px solid var(--border)',
              background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 10, color: 'var(--text-muted)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50', flexShrink: 0,
                background: wsStatus === 'ativo' ? 'var(--green)' : wsStatus === 'erro' ? 'var(--red)' : 'var(--amber)',
                animation: wsStatus === 'ativo' ? 'pulse 2.5s infinite' : 'none',
              }} />
              {wsStatus === 'ativo'
                ? 'Webhook Meta Messenger ativo · realtime ligado'
                : wsStatus === 'erro'
                  ? 'Erro na conexão com Meta Messenger'
                  : 'Conectando...'}
            </div>
          </>
        )}
      </div>

      {/* ── COLUNA: PAINEL DO PARCEIRO ── */}
      {conversa && (
        <PainelParceiro
          conversa={conversa}
          todos={todos}
          onVincular={handleVincular}
          marcaCor={marcaCor(conversa?.marca)}
        />
      )}

      {/* ── ERRO GLOBAL ── */}
      {erro && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--surface-2)', border: '1px solid var(--red)',
          borderRadius: 10, padding: '10px 16px', fontSize: 13,
          color: 'var(--red)', zIndex: 999, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {erro}
          <button onClick={() => setErro(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
