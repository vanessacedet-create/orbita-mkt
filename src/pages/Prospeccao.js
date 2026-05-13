import { useState, useCallback } from 'react'
import { searchChannels, classificarTamanho, formatarInscritos } from '../lib/youtube'
import {
  Search, Mail, ChevronRight, ChevronLeft, Check, X,
  Youtube, ExternalLink, Sparkles, Copy, AlertCircle,
  Loader, BookOpen, RefreshCw, Plus, User,
} from 'lucide-react'

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }
  return [toast, show]
}

// ── Template de e-mail ─────────────────────────────────────
function gerarEmail(livro, criador) {
  const assunto = `Parceria para divulgação: ${livro.titulo}`
  const corpo = `Olá, ${criador.nome}!

Tudo bem? Meu nome é [SEU NOME] e faço parte da equipe de marketing da [EDITORA].

Acompanho o seu trabalho no ${criador.plataforma} e adorei a forma como você apresenta conteúdo sobre ${criador.nicho || livro.genero || 'livros'} para o seu público. Por isso, gostaria de te convidar para conhecer nosso novo lançamento:

📚 ${livro.titulo}${livro.autor ? `\n✍️ Autor: ${livro.autor}` : ''}${livro.genero ? `\n🏷️ Gênero: ${livro.genero}` : ''}${livro.sinopse ? `\n\n${livro.sinopse}` : ''}

Pensamos em você porque o seu perfil combina muito com o universo do livro e acreditamos que o seu público vai adorar essa indicação.

Podemos enviar um exemplar para você? Ficamos à disposição para conversar sobre os detalhes da parceria.

Aguardo seu retorno!

Abraços,
[SEU NOME]
[EDITORA] | [CONTATO]`

  return { assunto, corpo }
}

// ── Passo 1: Formulário do livro ───────────────────────────
function PassoLivro({ onConcluir, inicial }) {
  const [form, setForm] = useState(inicial || { titulo: '', autor: '', genero: '', sinopse: '' })
  const [erro, setErro] = useState(null)

  const GENEROS = [
    'True Crime', 'Romance', 'Fantasia', 'Ficção Científica', 'Thriller',
    'Autoajuda', 'Negócios', 'Biografia', 'História', 'Filosofia',
    'Religião/Espiritualidade', 'Infantil/Juvenil', 'Outro',
  ]

  function submit() {
    if (!form.titulo.trim()) { setErro('Informe o título do livro'); return }
    onConcluir(form)
  }

  return (
    <div style={{ maxWidth: 580, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Informações do Livro</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
        Preencha os dados do livro. Essas informações serão usadas para montar o e-mail de prospecção.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Título *</label>
          <input className="form-input" placeholder="Ex: Ilusões Populares e a Loucura das Multidões" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Autor</label>
          <input className="form-input" placeholder="Ex: Charles Mackay" value={form.autor} onChange={e => setForm(f => ({ ...f, autor: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Gênero</label>
          <select className="form-input" value={form.genero} onChange={e => setForm(f => ({ ...f, genero: e.target.value }))}>
            <option value="">Selecione...</option>
            {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Sinopse / Descrição</label>
          <textarea className="form-input" rows={4} placeholder="Escreva um resumo do livro para aparecer no e-mail..." value={form.sinopse} onChange={e => setForm(f => ({ ...f, sinopse: e.target.value }))} style={{ resize: 'vertical' }} />
        </div>
      </div>

      {erro && (
        <div style={{ background: 'var(--red-light)', border: '1px solid rgba(245,101,101,0.2)', borderRadius: 8, padding: '10px 14px', marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--red)' }}>
          <AlertCircle size={14} /> {erro}
        </div>
      )}

      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 20 }} onClick={submit}>
        Buscar Criadores <ChevronRight size={15} />
      </button>
    </div>
  )
}

// ── Passo 2: Busca de criadores ────────────────────────────
function PassoCriadores({ livro, selecionados, setSelecionados, onVoltar, onConcluir }) {
  const [canaisYT, setCanaisYT]       = useState([])
  const [manuais, setManuais]         = useState([])
  const [loadingYT, setLoadingYT]     = useState(false)
  const [apiKey]                       = useState(localStorage.getItem('yt_api_key') || '')
  const [queryYT, setQueryYT]         = useState(`booktuber ${livro.genero || 'livros'}`)
  const [novoManual, setNovoManual]   = useState({ nome: '', plataforma: 'Instagram', handle: '', nicho: '' })
  const [showFormManual, setShowFormManual] = useState(false)
  const [toast, showToast]            = useToast()

  const SUGESTOES = [
    `booktuber ${livro.genero}`, `resenha ${livro.genero}`,
    `bookstagram ${livro.genero}`, 'booktuber brasil', 'clube do livro',
  ].filter(s => s.trim())

  const toggleSelecionado = useCallback((criador) => {
    setSelecionados(prev => prev.find(c => c.id === criador.id) ? prev.filter(c => c.id !== criador.id) : [...prev, criador])
  }, [setSelecionados])

  async function buscarYoutube() {
    if (!apiKey) { showToast('Configure a YouTube API Key na página Descoberta', 'error'); return }
    setLoadingYT(true)
    try {
      const res = await searchChannels({ query: queryYT, maxResults: 15, apiKey })
      setCanaisYT(res)
      if (!res.length) showToast('Nenhum canal encontrado. Tente outra busca.', 'error')
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoadingYT(false) }
  }

  function adicionarManual() {
    if (!novoManual.nome.trim()) return
    const c = { id: `manual-${Date.now()}`, ...novoManual, nicho: novoManual.nicho || livro.genero || '', manual: true }
    setManuais(prev => [...prev, c])
    setNovoManual({ nome: '', plataforma: 'Instagram', handle: '', nicho: '' })
    setShowFormManual(false)
  }

  const totalSelecionados = selecionados.length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Encontrar Criadores</h2>
        {totalSelecionados > 0 && (
          <span style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
            {totalSelecionados} selecionado{totalSelecionados !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Livro: <strong style={{ color: 'var(--text)' }}>{livro.titulo}</strong>{livro.genero && ` · ${livro.genero}`}
      </p>

      {/* Busca YouTube */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Youtube size={15} color="#FF0000" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Buscar no YouTube</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input className="form-input" style={{ flex: 1, fontSize: 13 }} value={queryYT} onChange={e => setQueryYT(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarYoutube()} placeholder="Ex: booktuber true crime" />
          <button className="btn btn-primary" onClick={buscarYoutube} disabled={loadingYT}>
            {loadingYT ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {SUGESTOES.map(s => (
            <button key={s} onClick={() => setQueryYT(s)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>{s}</button>
          ))}
        </div>
      </div>

      {/* Adicionar manual */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={15} color="var(--indigo)" />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Adicionar manualmente</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Instagram, TikTok ou outro</span>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowFormManual(v => !v)}>
            {showFormManual ? <X size={13} /> : <><Plus size={13} /> Adicionar</>}
          </button>
        </div>

        {showFormManual && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input className="form-input" style={{ fontSize: 13 }} placeholder="Nome do criador *" value={novoManual.nome} onChange={e => setNovoManual(f => ({ ...f, nome: e.target.value }))} />
              <select className="form-input" style={{ fontSize: 13 }} value={novoManual.plataforma} onChange={e => setNovoManual(f => ({ ...f, plataforma: e.target.value }))}>
                {['Instagram', 'TikTok', 'YouTube', 'Blog', 'Outro'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input className="form-input" style={{ fontSize: 13 }} placeholder="@ ou handle" value={novoManual.handle} onChange={e => setNovoManual(f => ({ ...f, handle: e.target.value }))} />
              <input className="form-input" style={{ fontSize: 13 }} placeholder="Nicho (ex: true crime)" value={novoManual.nicho} onChange={e => setNovoManual(f => ({ ...f, nicho: e.target.value }))} />
            </div>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={adicionarManual} disabled={!novoManual.nome.trim()}>
              <Plus size={12} /> Adicionar
            </button>
          </div>
        )}

        {manuais.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {manuais.map(m => {
              const sel = selecionados.find(s => s.id === m.id)
              return (
                <div key={m.id} onClick={() => toggleSelecionado(m)} style={{ background: 'var(--surface-2)', border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                  {sel && <Check size={11} color="var(--accent)" />}
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{m.nome}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.plataforma}</span>
                  <button onClick={e => { e.stopPropagation(); setManuais(prev => prev.filter(x => x.id !== m.id)); setSelecionados(prev => prev.filter(x => x.id !== m.id)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
                    <X size={11} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Grid YouTube */}
      {canaisYT.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 20 }}>
          {canaisYT.map(canal => {
            const sel = selecionados.find(c => c.id === canal.id)
            const tam = classificarTamanho(canal.inscritos)
            const criador = { id: canal.id, nome: canal.nome, plataforma: 'YouTube', handle: canal.handle || canal.id, url: canal.url, inscritos: canal.inscritos, thumbnail: canal.thumbnail, nicho: livro.genero || '' }
            return (
              <div key={canal.id} onClick={() => toggleSelecionado(criador)} style={{ background: 'var(--surface)', border: `2px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: 12, cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative' }}>
                {sel && <div style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10} color="#fff" /></div>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  {canal.thumbnail ? <img src={canal.thumbnail} alt={canal.nome} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Youtube size={14} color="var(--text-muted)" /></div>}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{canal.nome}</div>
                    <div style={{ fontSize: 11, color: tam.cor, fontWeight: 700 }}>{tam.label} · {formatarInscritos(canal.inscritos)}</div>
                  </div>
                </div>
                {canal.descricao && <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 6 }}>{canal.descricao}</p>}
                <a href={canal.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                  <ExternalLink size={10} /> Ver canal
                </a>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" onClick={onVoltar}><ChevronLeft size={14} /> Voltar</button>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!totalSelecionados} onClick={onConcluir}>
          Montar e-mails para {totalSelecionados} criador{totalSelecionados !== 1 ? 'es' : ''} <ChevronRight size={15} />
        </button>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Passo 3: E-mails com template ─────────────────────────
function PassoEmails({ livro, criadores, onVoltar }) {
  const [emails, setEmails] = useState(() => {
    const init = {}
    criadores.forEach(c => { init[c.id] = gerarEmail(livro, c) })
    return init
  })
  const [aberto, setAberto] = useState(criadores[0]?.id || null)
  const [toast, showToast]  = useToast()

  function copiar(id) {
    const e = emails[id]
    navigator.clipboard.writeText(`Assunto: ${e.assunto}\n\n${e.corpo}`)
    showToast('E-mail copiado!')
  }

  function abrirOutlook(criador) {
    const e = emails[criador.id]
    window.open(`mailto:?subject=${encodeURIComponent(e.assunto)}&body=${encodeURIComponent(e.corpo)}`, '_blank')
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>E-mails Prontos</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        {criadores.length} e-mail{criadores.length !== 1 ? 's' : ''} montado{criadores.length !== 1 ? 's' : ''} com base no template. Edite antes de enviar — substitua os campos entre [colchetes].
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {criadores.map(criador => {
          const email    = emails[criador.id]
          const estaAberto = aberto === criador.id
          return (
            <div key={criador.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div onClick={() => setAberto(estaAberto ? null : criador.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {criador.thumbnail
                    ? <img src={criador.thumbnail} alt={criador.nome} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{criador.nome[0]}</div>
                  }
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{criador.nome}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{criador.plataforma}{criador.handle ? ` · ${criador.handle}` : ''}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{estaAberto ? '▲' : '▼'}</span>
              </div>

              {estaAberto && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ marginTop: 14, marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Assunto</label>
                    <input className="form-input" style={{ fontSize: 13 }} value={email.assunto} onChange={e => setEmails(prev => ({ ...prev, [criador.id]: { ...email, assunto: e.target.value } }))} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Corpo</label>
                    <textarea className="form-input" rows={10} style={{ fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} value={email.corpo} onChange={e => setEmails(prev => ({ ...prev, [criador.id]: { ...email, corpo: e.target.value } }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => copiar(criador.id)}><Copy size={12} /> Copiar</button>
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => abrirOutlook(criador)}><Mail size={12} /> Abrir no Outlook</button>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEmails(prev => ({ ...prev, [criador.id]: gerarEmail(livro, criador) }))}><RefreshCw size={12} /> Resetar</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button className="btn btn-ghost" onClick={onVoltar}><ChevronLeft size={14} /> Voltar para criadores</button>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────
const PASSOS = [
  { id: 1, label: 'Livro',     icon: BookOpen },
  { id: 2, label: 'Criadores', icon: Search   },
  { id: 3, label: 'E-mails',   icon: Mail     },
]

export default function Prospeccao() {
  const [passo, setPasso]               = useState(1)
  const [livro, setLivro]               = useState(null)
  const [selecionados, setSelecionados] = useState([])

  function reiniciar() { setPasso(1); setLivro(null); setSelecionados([]) }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Sparkles size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Prospecção</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Encontre criadores e monte e-mails de parceria</p>
          </div>
        </div>
        {passo > 1 && (
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={reiniciar}><X size={12} /> Recomeçar</button>
        )}
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
        {PASSOS.map((p, i) => {
          const ativo     = passo === p.id
          const concluido = passo > p.id
          const Icon      = p.icon
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', flex: i < PASSOS.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: concluido ? 'var(--green)' : ativo ? 'var(--accent)' : 'var(--surface-2)', border: `2px solid ${concluido ? 'var(--green)' : ativo ? 'var(--accent)' : 'var(--border)'}`, flexShrink: 0 }}>
                  {concluido ? <Check size={13} color="#fff" /> : <Icon size={13} color={ativo ? '#fff' : 'var(--text-muted)'} />}
                </div>
                <span style={{ fontSize: 13, fontWeight: ativo ? 700 : 500, color: ativo ? 'var(--text)' : concluido ? 'var(--text-soft)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{p.label}</span>
              </div>
              {i < PASSOS.length - 1 && <div style={{ flex: 1, height: 2, background: passo > p.id ? 'var(--green)' : 'var(--border)', margin: '0 12px' }} />}
            </div>
          )
        })}
      </div>

      {passo === 1 && <PassoLivro inicial={livro} onConcluir={info => { setLivro(info); setPasso(2) }} />}
      {passo === 2 && livro && <PassoCriadores livro={livro} selecionados={selecionados} setSelecionados={setSelecionados} onVoltar={() => setPasso(1)} onConcluir={() => setPasso(3)} />}
      {passo === 3 && livro && <PassoEmails livro={livro} criadores={selecionados} onVoltar={() => setPasso(2)} />}
    </div>
  )
}
