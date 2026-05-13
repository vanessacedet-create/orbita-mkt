import { useState, useCallback } from 'react'
import mammoth from 'mammoth'
import { searchChannels, classificarTamanho, formatarInscritos } from '../lib/youtube'
import {
  Upload, FileText, Search, Mail, ChevronRight, ChevronLeft,
  Check, X, Youtube, Users, ExternalLink, Sparkles, Copy,
  AlertCircle, Loader, BookOpen, RefreshCw, Globe,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4500)
  }
  return [toast, show]
}

async function chamarIA(systemPrompt, userContent, maxTokens = 1000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.content?.find(b => b.type === 'text')?.text || ''
}

async function buscarCriadoresWeb(genero, titulo) {
  const texto = await chamarIA(
    `Você é um especialista em marketing de influenciadores do mercado editorial brasileiro.
Retorne APENAS JSON válido, sem texto antes ou depois, sem markdown.
Formato: {"criadores": [{"nome": "...", "plataforma": "YouTube|Instagram|TikTok", "handle": "...", "nicho": "...", "tamanho": "nano|micro|medio|grande", "url": "..."}]}
Retorne até 8 criadores brasileiros reais e relevantes.`,
    `Encontre criadores de conteúdo brasileiros para divulgar um livro de ${genero} chamado "${titulo}".
Priorize BookTubers, Bookstagrammers e BookTokers que costumam fazer resenhas desse gênero.`
  )
  try {
    const limpo = texto.replace(/```json|```/g, '').trim()
    return JSON.parse(limpo).criadores || []
  } catch { return [] }
}

// ── Passo 1: Upload do livro ───────────────────────────────
function PassoLivro({ onConcluir }) {
  const [dragging, setDragging]     = useState(false)
  const [arquivo, setArquivo]       = useState(null)
  const [livroInfo, setLivroInfo]   = useState(null)
  const [loading, setLoading]       = useState(false)
  const [erro, setErro]             = useState(null)
  const [editando, setEditando]     = useState(false)

  async function processarArquivo(file) {
    if (!file || !file.name.endsWith('.docx')) {
      setErro('Envie um arquivo .docx')
      return
    }
    setArquivo(file)
    setLoading(true)
    setErro(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer: buffer })
      const texto = result.value.slice(0, 4000)

      const resposta = await chamarIA(
        `Você é um assistente editorial. Extraia informações do documento e retorne APENAS JSON válido sem markdown.
Formato: {"titulo":"...","autor":"...","genero":"...","sinopse":"...","palavras_chave":["...","..."]}
Sinopse: máximo 3 frases. Palavras-chave: 3 a 5 termos do nicho para buscar influenciadores.`,
        `Documento:\n${texto}`
      )
      const limpo = resposta.replace(/```json|```/g, '').trim()
      setLivroInfo(JSON.parse(limpo))
    } catch (e) {
      setErro('Erro ao processar o arquivo: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processarArquivo(file)
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Informações do Livro</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
        Faça upload do arquivo .docx com press release, sinopse ou qualquer documento sobre o livro.
        A IA vai extrair as informações automaticamente.
      </p>

      {/* Dropzone */}
      {!livroInfo && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 12,
            padding: '48px 24px',
            textAlign: 'center',
            background: dragging ? 'var(--accent-glow)' : 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: 16,
          }}
          onClick={() => document.getElementById('docx-input').click()}
        >
          <input
            id="docx-input" type="file" accept=".docx"
            style={{ display: 'none' }}
            onChange={e => processarArquivo(e.target.files[0])}
          />
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Loader size={32} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Analisando documento com IA...</span>
            </div>
          ) : (
            <>
              <Upload size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
              <p style={{ fontWeight: 600, marginBottom: 4 }}>
                {arquivo ? arquivo.name : 'Arraste o .docx aqui ou clique para selecionar'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Apenas arquivos .docx</p>
            </>
          )}
        </div>
      )}

      {erro && (
        <div style={{ background: 'var(--red-light)', border: '1px solid rgba(245,101,101,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--red)' }}>
          <AlertCircle size={14} /> {erro}
        </div>
      )}

      {/* Info extraída */}
      {livroInfo && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={16} color="var(--accent)" />
              <span style={{ fontWeight: 700 }}>Informações extraídas</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setEditando(e => !e)}>
                {editando ? 'Fechar edição' : 'Editar'}
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setLivroInfo(null); setArquivo(null) }}>
                <RefreshCw size={11} /> Novo arquivo
              </button>
            </div>
          </div>

          {['titulo', 'autor', 'genero', 'sinopse'].map(campo => (
            <div key={campo} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                {campo.charAt(0).toUpperCase() + campo.slice(1)}
              </label>
              {editando ? (
                campo === 'sinopse'
                  ? <textarea
                      className="form-input"
                      rows={3}
                      value={livroInfo[campo] || ''}
                      onChange={e => setLivroInfo(i => ({ ...i, [campo]: e.target.value }))}
                      style={{ resize: 'vertical', fontSize: 13 }}
                    />
                  : <input
                      className="form-input"
                      value={livroInfo[campo] || ''}
                      onChange={e => setLivroInfo(i => ({ ...i, [campo]: e.target.value }))}
                      style={{ fontSize: 13 }}
                    />
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-soft)' }}>{livroInfo[campo] || '—'}</p>
              )}
            </div>
          ))}

          {livroInfo.palavras_chave?.length > 0 && (
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                Palavras-chave para busca
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {livroInfo.palavras_chave.map(k => (
                  <span key={k} style={{ background: 'var(--indigo-light)', border: '1px solid rgba(108,114,245,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: 'var(--indigo)' }}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {livroInfo && (
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => onConcluir(livroInfo)}
        >
          Buscar Criadores <ChevronRight size={15} />
        </button>
      )}
    </div>
  )
}

// ── Passo 2: Busca de criadores ────────────────────────────
function PassoCriadores({ livro, selecionados, setSelecionados, onVoltar, onConcluir }) {
  const [canaisYT, setCanaisYT]       = useState([])
  const [criadoresWeb, setCriadoresWeb] = useState([])
  const [loadingYT, setLoadingYT]     = useState(false)
  const [loadingWeb, setLoadingWeb]   = useState(false)
  const [apiKey]                       = useState(localStorage.getItem('yt_api_key') || '')
  const [queryYT, setQueryYT]         = useState(livro.palavras_chave?.[0] || livro.genero || '')
  const [buscouWeb, setBuscouWeb]     = useState(false)
  const [toast, showToast]            = useToast()

  const toggleSelecionado = useCallback((criador) => {
    setSelecionados(prev => {
      const existe = prev.find(c => c.id === criador.id)
      if (existe) return prev.filter(c => c.id !== criador.id)
      return [...prev, criador]
    })
  }, [setSelecionados])

  async function buscarYoutube() {
    if (!apiKey) { showToast('Configure a YouTube API Key na página Descoberta', 'error'); return }
    setLoadingYT(true)
    try {
      const res = await searchChannels({ query: queryYT, maxResults: 15, apiKey })
      setCanaisYT(res)
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoadingYT(false) }
  }

  async function buscarWeb() {
    setLoadingWeb(true)
    setBuscouWeb(true)
    try {
      const criadores = await buscarCriadoresWeb(livro.genero || livro.titulo, livro.titulo)
      setCriadoresWeb(criadores.map((c, i) => ({ ...c, id: `web-${i}` })))
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoadingWeb(false) }
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
        Livro: <strong style={{ color: 'var(--text)' }}>{livro.titulo}</strong> · Gênero: {livro.genero}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* YouTube */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Youtube size={15} color="#FF0000" />
            <span style={{ fontWeight: 700, fontSize: 14 }}>YouTube</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input
              className="form-input"
              style={{ flex: 1, fontSize: 12 }}
              value={queryYT}
              onChange={e => setQueryYT(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscarYoutube()}
              placeholder="Ex: booktuber true crime"
            />
            <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={buscarYoutube} disabled={loadingYT}>
              {loadingYT ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={12} />}
            </button>
          </div>
          {livro.palavras_chave?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {livro.palavras_chave.map(k => (
                <button key={k} onClick={() => { setQueryYT(k); }} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Web/IA */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Globe size={15} color="var(--indigo)" />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Instagram & TikTok via IA</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
            A IA sugere criadores brasileiros de Instagram e TikTok para o gênero do livro.
          </p>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
            onClick={buscarWeb}
            disabled={loadingWeb}
          >
            {loadingWeb
              ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Buscando...</>
              : <><Sparkles size={12} /> {buscouWeb ? 'Buscar novamente' : 'Sugerir criadores'}</>
            }
          </button>
        </div>
      </div>

      {/* Lista combinada */}
      {(canaisYT.length > 0 || criadoresWeb.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
          {/* Canais YouTube */}
          {canaisYT.map(canal => {
            const sel = selecionados.find(c => c.id === canal.id)
            const tam = classificarTamanho(canal.inscritos)
            const criador = { id: canal.id, nome: canal.nome, plataforma: 'YouTube', handle: canal.handle || canal.id, url: canal.url, inscritos: canal.inscritos, thumbnail: canal.thumbnail, descricao: canal.descricao }
            return (
              <div
                key={canal.id}
                onClick={() => toggleSelecionado(criador)}
                style={{ background: 'var(--surface)', border: `2px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: 14, cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative' }}
              >
                {sel && <div style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="#fff" /></div>}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  {canal.thumbnail
                    ? <img src={canal.thumbnail} alt={canal.nome} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Youtube size={16} color="var(--text-muted)" /></div>
                  }
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{canal.nome}</div>
                    <div style={{ fontSize: 11, color: tam.cor, fontWeight: 700 }}>{tam.label} · {formatarInscritos(canal.inscritos)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Youtube size={10} color="#FF0000" /> YouTube
                </div>
              </div>
            )
          })}

          {/* Criadores IA */}
          {criadoresWeb.map(c => {
            const sel = selecionados.find(s => s.id === c.id)
            const plataformaColor = c.plataforma === 'Instagram' ? '#E1306C' : c.plataforma === 'TikTok' ? '#69C9D0' : 'var(--indigo)'
            const criador = { id: c.id, nome: c.nome, plataforma: c.plataforma, handle: c.handle, url: c.url, tamanho: c.tamanho, nicho: c.nicho }
            return (
              <div
                key={c.id}
                onClick={() => toggleSelecionado(criador)}
                style={{ background: 'var(--surface)', border: `2px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: 14, cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative' }}
              >
                {sel && <div style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="#fff" /></div>}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{c.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.handle}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: plataformaColor, fontWeight: 700 }}>{c.plataforma}</span>
                  {c.tamanho && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {c.tamanho}</span>}
                  {c.nicho && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {c.nicho}</span>}
                </div>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3, marginTop: 6, textDecoration: 'none' }}>
                    <ExternalLink size={10} /> Ver perfil
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" onClick={onVoltar}>
          <ChevronLeft size={14} /> Voltar
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 1, justifyContent: 'center' }}
          disabled={totalSelecionados === 0}
          onClick={onConcluir}
        >
          Gerar E-mails para {totalSelecionados} criador{totalSelecionados !== 1 ? 'es' : ''} <ChevronRight size={15} />
        </button>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

// ── Passo 3: Geração de e-mails ────────────────────────────
function PassoEmails({ livro, criadores, onVoltar }) {
  const [emails, setEmails]       = useState({})
  const [gerando, setGerando]     = useState(new Set())
  const [gerado, setGerado]       = useState(new Set())
  const [gerandoTodos, setGerandoTodos] = useState(false)
  const [toast, showToast]        = useToast()

  async function gerarEmail(criador) {
    setGerando(prev => new Set([...prev, criador.id]))
    try {
      const texto = await chamarIA(
        `Você é um especialista em marketing editorial brasileiro.
Escreva e-mails de prospecção para influenciadores de livros.
O e-mail deve ser: personalizado, autêntico, conciso (máx 200 palavras), em português brasileiro.
Mencione especificamente o perfil do criador e por que o livro combina com ele.
Não use linguagem genérica ou de vendas agressiva.
Retorne APENAS JSON: {"assunto":"...","corpo":"..."}`,
        `Criador: ${criador.nome} (${criador.plataforma}, ${criador.handle || ''})
${criador.nicho ? `Nicho: ${criador.nicho}` : ''}
${criador.inscritos ? `Inscritos: ${formatarInscritos(criador.inscritos)}` : ''}

Livro: "${livro.titulo}"
Autor: ${livro.autor || 'N/A'}
Gênero: ${livro.genero || 'N/A'}
Sinopse: ${livro.sinopse || 'N/A'}

Escreva um e-mail de prospecção para convidar esse criador a divulgar o livro.`
      , 800)
      const limpo = texto.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(limpo)
      setEmails(prev => ({ ...prev, [criador.id]: parsed }))
      setGerado(prev => new Set([...prev, criador.id]))
    } catch (e) {
      showToast('Erro ao gerar e-mail para ' + criador.nome, 'error')
    } finally {
      setGerando(prev => { const n = new Set(prev); n.delete(criador.id); return n })
    }
  }

  async function gerarTodos() {
    setGerandoTodos(true)
    for (const c of criadores) {
      if (!gerado.has(c.id)) await gerarEmail(c)
    }
    setGerandoTodos(false)
  }

  function copiarEmail(criadorId) {
    const e = emails[criadorId]
    if (!e) return
    navigator.clipboard.writeText(`Assunto: ${e.assunto}\n\n${e.corpo}`)
    showToast('E-mail copiado!')
  }

  function abrirOutlook(criador) {
    const e = emails[criador.id]
    if (!e) return
    const mailto = `mailto:?subject=${encodeURIComponent(e.assunto)}&body=${encodeURIComponent(e.corpo)}`
    window.open(mailto, '_blank')
  }

  const todosGerados = criadores.every(c => gerado.has(c.id))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>E-mails Personalizados</h2>
        {!todosGerados && (
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={gerarTodos} disabled={gerandoTodos}>
            {gerandoTodos
              ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Gerando...</>
              : <><Sparkles size={12} /> Gerar todos</>
            }
          </button>
        )}
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
        {criadores.length} criador{criadores.length !== 1 ? 'es' : ''} selecionado{criadores.length !== 1 ? 's' : ''} · Livro: <strong style={{ color: 'var(--text)' }}>{livro.titulo}</strong>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {criadores.map(criador => {
          const email = emails[criador.id]
          const estaGerando = gerando.has(criador.id)
          const jaGerado = gerado.has(criador.id)

          return (
            <div key={criador.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              {/* Cabeçalho do criador */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {criador.thumbnail && (
                    <img src={criador.thumbnail} alt={criador.nome} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  )}
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{criador.nome}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{criador.plataforma} · {criador.handle}</span>
                  </div>
                </div>
                {!jaGerado && (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 11 }}
                    onClick={() => gerarEmail(criador)}
                    disabled={estaGerando}
                  >
                    {estaGerando
                      ? <><Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Gerando...</>
                      : <><Sparkles size={11} /> Gerar e-mail</>
                    }
                  </button>
                )}
              </div>

              {/* E-mail gerado */}
              {email ? (
                <div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', marginBottom: 4 }}>Assunto</label>
                    <input
                      className="form-input"
                      style={{ fontSize: 13 }}
                      value={email.assunto}
                      onChange={e => setEmails(prev => ({ ...prev, [criador.id]: { ...email, assunto: e.target.value } }))}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', marginBottom: 4 }}>Corpo</label>
                    <textarea
                      className="form-input"
                      rows={6}
                      style={{ fontSize: 13, resize: 'vertical' }}
                      value={email.corpo}
                      onChange={e => setEmails(prev => ({ ...prev, [criador.id]: { ...email, corpo: e.target.value } }))}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => copiarEmail(criador.id)}>
                      <Copy size={12} /> Copiar
                    </button>
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => abrirOutlook(criador)}>
                      <Mail size={12} /> Abrir no Outlook
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setGerado(prev => { const n = new Set(prev); n.delete(criador.id); return n }); setEmails(prev => { const n = { ...prev }; delete n[criador.id]; return n }) }}>
                      <RefreshCw size={12} /> Regenerar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  {estaGerando
                    ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Gerando e-mail personalizado...</span>
                    : 'Clique em "Gerar e-mail" para criar um e-mail personalizado para este criador'
                  }
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button className="btn btn-ghost" onClick={onVoltar}>
        <ChevronLeft size={14} /> Voltar para criadores
      </button>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────
const PASSOS = [
  { id: 1, label: 'Livro',     icon: BookOpen },
  { id: 2, label: 'Criadores', icon: Users    },
  { id: 3, label: 'E-mails',   icon: Mail     },
]

export default function Prospeccao() {
  const [passo, setPasso]             = useState(1)
  const [livro, setLivro]             = useState(null)
  const [selecionados, setSelecionados] = useState([])

  function reiniciar() { setPasso(1); setLivro(null); setSelecionados([]) }

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Sparkles size={22} color="var(--accent)" />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Prospecção</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Encontre criadores e gere e-mails personalizados com IA</p>
          </div>
        </div>
        {passo > 1 && (
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={reiniciar}>
            <X size={12} /> Recomeçar
          </button>
        )}
      </div>

      {/* Steps indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
        {PASSOS.map((p, i) => {
          const ativo    = passo === p.id
          const concluido = passo > p.id
          const Icon = p.icon
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', flex: i < PASSOS.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: concluido ? 'var(--green)' : ativo ? 'var(--accent)' : 'var(--surface-2)',
                  border: `2px solid ${concluido ? 'var(--green)' : ativo ? 'var(--accent)' : 'var(--border)'}`,
                  flexShrink: 0,
                }}>
                  {concluido ? <Check size={14} color="#fff" /> : <Icon size={14} color={ativo ? '#fff' : 'var(--text-muted)'} />}
                </div>
                <span style={{ fontSize: 13, fontWeight: ativo ? 700 : 500, color: ativo ? 'var(--text)' : concluido ? 'var(--text-soft)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {p.label}
                </span>
              </div>
              {i < PASSOS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: passo > p.id ? 'var(--green)' : 'var(--border)', margin: '0 12px' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Conteúdo */}
      {passo === 1 && (
        <PassoLivro
          onConcluir={info => { setLivro(info); setPasso(2) }}
        />
      )}
      {passo === 2 && livro && (
        <PassoCriadores
          livro={livro}
          selecionados={selecionados}
          setSelecionados={setSelecionados}
          onVoltar={() => setPasso(1)}
          onConcluir={() => setPasso(3)}
        />
      )}
      {passo === 3 && livro && (
        <PassoEmails
          livro={livro}
          criadores={selecionados}
          onVoltar={() => setPasso(2)}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
