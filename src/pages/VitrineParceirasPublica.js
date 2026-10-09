import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Search, ShoppingBag, X, Send, Check, BookOpen, Filter, ArrowLeft, Loader2, Star,
  LogIn, History, ChevronRight, Package, LogOut, AlertCircle, Plus,
} from 'lucide-react'

/* ============================================
   VITRINE EDITORAS PARCEIRAS — Página pública
   Rota: /vitrine-parceiras (sem login no Órbita)
   O influencer entra com o e-mail cadastrado no menu "Influencers".
   Usa só as funções vp_ do banco (nunca lê as tabelas diretamente).
   ============================================ */

const C = {
  bg: '#F7F7F5', card: '#FFFFFF', primary: '#3A3A3A', dark: '#2A2A2A', accent: '#F2B705',
  accentLight: '#FBE9A0', text: '#2A2A2A', textLight: '#6B6B6B', muted: '#9A9A9A',
  border: '#E0E0DE', borderLight: '#EDEDEB', success: '#5A8F6B', error: '#C0392B',
  errorLight: '#FDECEA', overlay: 'rgba(42,42,42,0.55)', white: '#FFFFFF',
}
const F = {
  display: "'Playfair Display', Georgia, serif",
  body: "'DM Sans', 'Helvetica Neue', sans-serif",
}

const STATUS_PEDIDO = {
  novo:      { label: 'Recebido',   bg: '#EAF0F8', color: '#1A3A5C' },
  visto:     { label: 'Em análise', bg: '#FBF3E4', color: '#8B5E1A' },
  aprovado:  { label: 'Aprovado',   bg: '#EAF3DE', color: '#3B6D11' },
  concluido: { label: 'Aprovado',   bg: '#EAF3DE', color: '#3B6D11' },
  cancelado: { label: 'Cancelado',  bg: '#FDECEA', color: '#C0392B' },
}
const STATUS_ENVIO = {
  preparando: 'Preparando envio',
  enviado: 'Enviado',
  divulgado: 'Divulgado',
  cancelado: 'Envio cancelado',
}

function soDigitos(v) { return (v || '').replace(/\D/g, '') }
function mascaraCpf(v) {
  const n = soDigitos(v).slice(0, 11)
  return n.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}
function fmtData(d) {
  if (!d) return '—'
  const [a, m, dia] = String(d).slice(0, 10).split('-')
  return `${dia}/${m}/${a}`
}
function fmtPreco(v) { return v == null ? null : `R$ ${Number(v).toFixed(2).replace('.', ',')}` }
function hojeISO() {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
}

function useFontes() {
  useEffect(() => {
    if (document.getElementById('vitrine-fonts')) return
    const link = document.createElement('link')
    link.id = 'vitrine-fonts'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap'
    document.head.appendChild(link)
  }, [])
}

// ════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════
function TelaLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  useFontes()

  async function entrar(e) {
    e.preventDefault()
    const valor = email.trim()
    if (!valor) return
    setErro('')
    setCarregando(true)
    try {
      const { data, error } = await supabase.rpc('vp_identificar', { p_email: valor })
      const inf = Array.isArray(data) ? data[0] : data
      if (error || !inf) {
        setErro('E-mail não encontrado. Confira o e-mail ou fale com a equipe CEDET.')
        return
      }
      onLogin({ ...inf, email: valor })
    } catch {
      setErro('Erro ao verificar o acesso. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: F.body, display: 'flex', flexDirection: 'column' }}>
      <Cabecalho subtitulo="Catálogo de livros para divulgação" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ background: C.white, borderRadius: 20, padding: '40px 32px', maxWidth: 420, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.08)', border: `1px solid ${C.borderLight}` }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${C.accent}20`, display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            <BookOpen size={26} color={C.accent} />
          </div>
          <h2 style={{ fontFamily: F.display, fontSize: 22, color: C.dark, margin: '0 0 6px', textAlign: 'center' }}>Acesso de influencer</h2>
          <p style={{ fontSize: 14, color: C.muted, margin: '0 0 26px', textAlign: 'center', lineHeight: 1.6 }}>
            Digite o e-mail cadastrado para ver os livros disponíveis.
          </p>
          <form onSubmit={entrar}>
            <label style={labelStyle}>E-mail</label>
            <input type="email" autoFocus value={email} placeholder="seu@email.com"
              onChange={e => { setEmail(e.target.value); setErro('') }}
              style={{ ...inputStyle, borderColor: erro ? C.error : C.border, marginBottom: 14 }} />
            {erro && <ErroBox texto={erro} />}
            <button type="submit" disabled={carregando || !email.trim()} style={{ ...btnPrimario, width: '100%', opacity: carregando || !email.trim() ? 0.5 : 1 }}>
              {carregando ? <><Loader2 size={18} className="vp-spin" /> Verificando...</> : <><LogIn size={18} /> Acessar vitrine</>}
            </button>
          </form>
        </div>
      </div>
      <EstiloGlobal />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════════
export default function VitrineParceirasPublica() {
  const [influencer, setInfluencer] = useState(null)
  const [livros, setLivros] = useState([])
  const [loading, setLoading] = useState(true)
  const [usados, setUsados] = useState(0)
  const [busca, setBusca] = useState('')
  const [editora, setEditora] = useState('')
  const [categoria, setCategoria] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [selecionados, setSelecionados] = useState([])
  const [detalhe, setDetalhe] = useState(null)
  const [painel, setPainel] = useState(null) // null | 'carrinho' | 'historico'
  const [etapa, setEtapa] = useState('lista') // 'lista' | 'dados' | 'enviado'
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')
  const [form, setForm] = useState({ cpf: '', telefone: '', cep: '', endereco: '', dataDivulgacao: '', obs: '' })
  useFontes()

  useEffect(() => {
    if (!influencer) return
    carregarCatalogo()
    atualizarSaldo()
    preencherUltimoEndereco()
  }, [influencer])

  async function carregarCatalogo() {
    setLoading(true)
    try {
      const todos = []
      for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await supabase.rpc('vp_catalogo').range(inicio, inicio + 999)
        if (error) throw error
        todos.push(...(data || []))
        if (!data || data.length < 1000) break
      }
      setLivros(todos)
    } catch (e) {
      console.error('[Vitrine Parceiras] catálogo:', e)
      setLivros([])
    } finally {
      setLoading(false)
    }
  }

  async function atualizarSaldo() {
    const { data } = await supabase.rpc('vp_saldo_mes', { p_influencer_id: influencer.id })
    setUsados(Number(data) || 0)
  }

  async function preencherUltimoEndereco() {
    const { data } = await supabase.rpc('vp_ultimo_endereco', { p_influencer_id: influencer.id })
    const u = Array.isArray(data) ? data[0] : data
    if (u) setForm(f => ({ ...f, telefone: u.contato || f.telefone, cep: u.cep || '', endereco: u.endereco || '' }))
  }

  const limiteTotal = Number(influencer?.limite_mensal || 0)
  const restante = Math.max(0, limiteTotal - usados)
  const atingiu = selecionados.length >= restante

  const editoras = useMemo(() => [...new Set(livros.map(l => l.editora).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [livros])
  const categorias = useMemo(() => [...new Set(livros.map(l => l.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [livros])
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return livros.filter(l =>
      (!t || (l.titulo || '').toLowerCase().includes(t) || (l.autor || '').toLowerCase().includes(t)) &&
      (!editora || l.editora === editora) &&
      (!categoria || l.categoria === categoria))
  }, [livros, busca, editora, categoria])

  function alternar(livro) {
    setSelecionados(prev => {
      if (prev.includes(livro.id)) return prev.filter(id => id !== livro.id)
      if (prev.length >= restante) return prev
      return [...prev, livro.id]
    })
  }

  const cpfValido = soDigitos(form.cpf).length === 11
  const formValido = cpfValido && form.telefone.trim() && form.dataDivulgacao && form.dataDivulgacao >= hojeISO()

  async function enviar() {
    if (!formValido || selecionados.length === 0) return
    setErroEnvio('')
    setEnviando(true)
    try {
      const { error } = await supabase.rpc('vp_criar_pedido', {
        p_influencer_id: influencer.id,
        p_cpf: soDigitos(form.cpf),
        p_contato: form.telefone.trim(),
        p_cep: form.cep.trim() || null,
        p_endereco: form.endereco.trim() || null,
        p_data_divulgacao: form.dataDivulgacao,
        p_observacoes: form.obs.trim() || null,
        p_itens: selecionados.map(id => ({ livro_id: id, quantidade: 1 })),
      })
      if (error) throw error
      await atualizarSaldo()
      setSelecionados([])
      setForm(f => ({ ...f, cpf: '', dataDivulgacao: '', obs: '' }))
      setEtapa('enviado')
    } catch (e) {
      const msg = (e?.message || '').toLowerCase()
      if (msg.includes('limite')) setErroEnvio('Você já atingiu o limite de livros deste mês.')
      else if (msg.includes('data de divulga')) setErroEnvio('A data de divulgação precisa ser hoje ou uma data futura.')
      else setErroEnvio('Não foi possível enviar o pedido. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  function sair() {
    setInfluencer(null)
    setSelecionados([])
    setPainel(null)
    setEtapa('lista')
  }

  if (!influencer) return <TelaLogin onLogin={setInfluencer} />

  const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const primeiroDiaProximoMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('pt-BR')
  const filtrosAtivos = [editora, categoria].filter(Boolean).length

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: F.body, color: C.text }}>
      <header style={{ background: C.dark, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 20px rgba(0,0,0,0.15)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: F.display, fontSize: 'clamp(18px, 3vw, 24px)', color: C.white, margin: 0 }}>Vitrine Editoras Parceiras</h1>
            <p style={{ color: C.accentLight, fontSize: 12, margin: '3px 0 0' }}>Olá, {(influencer.nome || '').split(' ')[0]}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPainel('historico')} style={btnTopo}><History size={16} /> Meus pedidos</button>
            <button onClick={() => { setPainel('carrinho'); setEtapa('lista') }} style={{ ...btnTopo, background: selecionados.length ? C.accent : 'rgba(255,255,255,0.15)', color: selecionados.length ? C.dark : C.white }}>
              <ShoppingBag size={16} /> {selecionados.length || ''}
            </button>
            <button onClick={sair} title="Sair" style={{ ...btnTopo, background: 'none', border: '1px solid rgba(255,255,255,0.25)' }}><LogOut size={16} /></button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 20px 0' }}>
        <div style={{
          background: restante === 0 ? '#FEF2F2' : '#F0FDF4', border: `1.5px solid ${restante === 0 ? '#FCA5A5' : '#86EFAC'}`,
          borderRadius: 10, padding: '9px 14px', marginBottom: 12, fontSize: 13, fontWeight: 600,
          color: restante === 0 ? '#DC2626' : '#16A34A',
        }}>
          {restante === 0
            ? `Você já usou seu limite de ${limiteTotal} livro${limiteTotal !== 1 ? 's' : ''} em ${mesAtual}. O limite renova em ${primeiroDiaProximoMes}.`
            : `Você ainda pode escolher ${restante} livro${restante !== 1 ? 's' : ''} em ${mesAtual} (${usados} de ${limiteTotal} usados).`}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por título ou autor..." style={{ ...inputStyle, paddingLeft: 42 }} />
          </div>
          <button onClick={() => setMostrarFiltros(v => !v)} style={{
            ...btnSecundario, background: mostrarFiltros || filtrosAtivos ? C.primary : C.white, color: mostrarFiltros || filtrosAtivos ? C.white : C.text,
          }}>
            <Filter size={16} /> Filtros{filtrosAtivos ? ` (${filtrosAtivos})` : ''}
          </button>
        </div>

        {mostrarFiltros && (
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={labelStyle}>Editora</label>
              <select value={editora} onChange={e => setEditora(e.target.value)} style={inputStyle}>
                <option value="">Todas as editoras</option>
                {editoras.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            {categorias.length > 0 && (
              <div style={{ flex: '1 1 200px' }}>
                <label style={labelStyle}>Categoria</label>
                <select value={categoria} onChange={e => setCategoria(e.target.value)} style={inputStyle}>
                  <option value="">Todas as categorias</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {filtrosAtivos > 0 && <button onClick={() => { setEditora(''); setCategoria('') }} style={btnSecundario}>Limpar filtros</button>}
          </div>
        )}

        <p style={{ fontSize: 13, color: C.muted, margin: '4px 0' }}>
          {loading ? 'Carregando...' : `${filtrados.length} livro${filtrados.length !== 1 ? 's' : ''} disponíve${filtrados.length !== 1 ? 'is' : 'l'}`}
        </p>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 20px 110px' }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '80px 0', color: C.muted, gap: 12 }}>
            <Loader2 size={32} color={C.accent} className="vp-spin" /> Carregando catálogo...
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
            <BookOpen size={44} style={{ opacity: 0.4, marginBottom: 12 }} />
            <p style={{ fontSize: 15, margin: 0 }}>Nenhum livro encontrado.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 18 }}>
            {filtrados.map(l => (
              <CardLivro key={l.id} livro={l} selecionado={selecionados.includes(l.id)}
                bloqueado={!selecionados.includes(l.id) && atingiu}
                onAlternar={() => alternar(l)} onDetalhe={() => setDetalhe(l)} />
            ))}
          </div>
        )}
      </div>

      {selecionados.length > 0 && !painel && (
        <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 90 }}>
          <button onClick={() => { setPainel('carrinho'); setEtapa('lista') }} style={{ ...btnPrimario, padding: '14px 26px', borderRadius: 16, boxShadow: '0 6px 30px rgba(0,0,0,0.3)' }}>
            <ShoppingBag size={18} /> Ver seleção ({selecionados.length}) <Send size={16} />
          </button>
        </div>
      )}

      {detalhe && (
        <ModalDetalhe livro={detalhe} selecionado={selecionados.includes(detalhe.id)}
          bloqueado={!selecionados.includes(detalhe.id) && atingiu}
          onAlternar={() => alternar(detalhe)} onFechar={() => setDetalhe(null)} />
      )}

      {painel === 'carrinho' && (
        <PainelLateral titulo={etapa === 'dados' ? 'Dados de envio' : etapa === 'enviado' ? 'Pedido enviado' : 'Livros selecionados'}
          onVoltar={etapa === 'dados' ? () => setEtapa('lista') : null}
          onFechar={() => { setPainel(null); if (etapa === 'enviado') setEtapa('lista') }}
          rodape={
            etapa === 'lista' && selecionados.length > 0 ? (
              <button onClick={() => setEtapa('dados')} style={{ ...btnPrimario, width: '100%' }}>Continuar <Send size={16} /></button>
            ) : etapa === 'dados' ? (
              <button onClick={enviar} disabled={!formValido || enviando} style={{ ...btnPrimario, width: '100%', opacity: !formValido || enviando ? 0.5 : 1 }}>
                {enviando ? <><Loader2 size={18} className="vp-spin" /> Enviando...</> : <><Send size={16} /> Enviar pedido ({selecionados.length})</>}
              </button>
            ) : null
          }>
          {etapa === 'enviado' ? (
            <div style={{ textAlign: 'center', padding: '50px 10px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.success, display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}><Check size={32} color="white" /></div>
              <h3 style={{ fontFamily: F.display, fontSize: 22, color: C.dark, margin: '0 0 10px' }}>Pedido enviado!</h3>
              <p style={{ color: C.textLight, fontSize: 15, lineHeight: 1.6 }}>Recebemos sua escolha. A equipe CEDET vai analisar e você acompanha tudo em "Meus pedidos".</p>
            </div>
          ) : etapa === 'dados' ? (
            <div>
              <div style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}40`, borderRadius: 12, padding: '10px 14px', marginBottom: 18, fontSize: 13 }}>
                <strong style={{ color: C.dark }}>{influencer.nome}</strong>
                <div style={{ color: C.muted }}>{influencer.email}</div>
              </div>
              <Campo label="CPF *">
                <input value={form.cpf} onChange={e => setForm({ ...form, cpf: mascaraCpf(e.target.value) })} placeholder="000.000.000-00"
                  style={{ ...inputStyle, borderColor: form.cpf && !cpfValido ? C.error : C.border }} />
              </Campo>
              <Campo label="Telefone / WhatsApp *">
                <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" style={inputStyle} />
              </Campo>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: '0 0 120px' }}>
                  <Campo label="CEP"><input value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} placeholder="00000-000" style={inputStyle} /></Campo>
                </div>
                <div style={{ flex: 1 }}>
                  <Campo label="Endereço completo"><input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade - UF" style={inputStyle} /></Campo>
                </div>
              </div>
              <Campo label="Data prevista de divulgação *">
                <input type="date" min={hojeISO()} value={form.dataDivulgacao} onChange={e => setForm({ ...form, dataDivulgacao: e.target.value })} style={inputStyle} />
              </Campo>
              <Campo label="Observações (opcional)">
                <textarea rows={3} value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
              </Campo>
              {erroEnvio && <ErroBox texto={erroEnvio} />}
            </div>
          ) : selecionados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: C.muted }}>
              <ShoppingBag size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
              <p style={{ margin: 0 }}>Nenhum livro selecionado.</p>
            </div>
          ) : (
            livros.filter(l => selecionados.includes(l.id)).map(l => (
              <div key={l.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.borderLight}`, alignItems: 'center' }}>
                <div style={{ width: 46, height: 62, borderRadius: 6, overflow: 'hidden', background: C.borderLight, flexShrink: 0 }}>
                  {l.imagem_url && <img src={l.imagem_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{l.titulo}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{l.editora}</div>
                </div>
                <button onClick={() => alternar(l)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={16} /></button>
              </div>
            ))
          )}
        </PainelLateral>
      )}

      {painel === 'historico' && <PainelHistorico influencer={influencer} onFechar={() => setPainel(null)} />}

      <EstiloGlobal />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// COMPONENTES
// ════════════════════════════════════════════════════════════════
function Cabecalho({ subtitulo }) {
  return (
    <header style={{ background: C.dark, padding: '20px 24px', textAlign: 'center' }}>
      <h1 style={{ fontFamily: F.display, fontSize: 'clamp(20px, 4vw, 28px)', color: C.white, margin: 0 }}>Vitrine Editoras Parceiras</h1>
      <p style={{ color: C.accentLight, fontSize: 13, margin: '4px 0 0' }}>{subtitulo}</p>
    </header>
  )
}

function CardLivro({ livro, selecionado, bloqueado, onAlternar, onDetalhe }) {
  const [erroImg, setErroImg] = useState(false)
  return (
    <div style={{
      background: C.card, borderRadius: 14, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column',
      border: `2px solid ${selecionado ? C.accent : C.borderLight}`,
      boxShadow: selecionado ? '0 4px 20px rgba(242,183,5,0.25)' : '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      {livro.destaque && (
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 2, background: C.accent, color: C.dark, borderRadius: 8, padding: '3px 8px', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
          <Star size={10} fill={C.dark} /> DESTAQUE
        </div>
      )}
      {selecionado && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, background: C.accent, borderRadius: '50%', width: 28, height: 28, display: 'grid', placeItems: 'center' }}>
          <Check size={16} color={C.dark} strokeWidth={3} />
        </div>
      )}
      <div onClick={onDetalhe} style={{ aspectRatio: '3/4', background: `linear-gradient(135deg, ${C.borderLight}, ${C.accentLight})`, display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden' }}>
        {livro.imagem_url && !erroImg
          ? <img src={livro.imagem_url} alt={livro.titulo} onError={() => setErroImg(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <BookOpen size={40} color={C.muted} style={{ opacity: 0.3 }} />}
      </div>
      <div style={{ padding: '12px 14px', flex: 1 }}>
        <p onClick={onDetalhe} style={{ fontFamily: F.display, fontSize: 14, fontWeight: 600, margin: '0 0 4px', lineHeight: 1.3, cursor: 'pointer' }}>{livro.titulo}</p>
        <p style={{ fontSize: 12, color: C.textLight, margin: '0 0 6px' }}>{livro.autor || 'Autor não informado'}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          {livro.editora && <span style={{ fontSize: 11, color: '#8a6a00', background: `${C.accent}22`, padding: '2px 8px', borderRadius: 6 }}>{livro.editora}</span>}
          {fmtPreco(livro.preco) && <span style={{ fontSize: 12, fontWeight: 600 }}>{fmtPreco(livro.preco)}</span>}
        </div>
      </div>
      <button onClick={onAlternar} disabled={bloqueado} style={{
        width: '100%', padding: 10, border: 'none', borderTop: `1px solid ${C.borderLight}`, fontFamily: F.body, fontSize: 13, fontWeight: 600,
        background: selecionado ? C.accent : bloqueado ? C.borderLight : C.bg,
        color: selecionado ? C.dark : bloqueado ? C.muted : C.primary,
        cursor: bloqueado ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        {selecionado ? <><Check size={14} /> Selecionado</> : bloqueado ? 'Limite atingido' : <><Plus size={14} /> Selecionar</>}
      </button>
    </div>
  )
}

function ModalDetalhe({ livro, selecionado, bloqueado, onAlternar, onFechar }) {
  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: C.overlay, zIndex: 200, display: 'grid', placeItems: 'center', padding: 18 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 18, maxWidth: 620, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ position: 'relative', background: `linear-gradient(135deg, ${C.borderLight}, ${C.accentLight})`, display: 'grid', placeItems: 'center', maxHeight: 340, overflow: 'hidden' }}>
          <button onClick={onFechar} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={18} /></button>
          {livro.imagem_url ? <img src={livro.imagem_url} alt={livro.titulo} style={{ maxWidth: '100%', maxHeight: 340, objectFit: 'contain' }} /> : <BookOpen size={60} color={C.muted} style={{ margin: 60, opacity: 0.3 }} />}
        </div>
        <div style={{ padding: 24 }}>
          <h2 style={{ fontFamily: F.display, fontSize: 22, color: C.dark, margin: '0 0 6px' }}>{livro.titulo}</h2>
          <p style={{ fontSize: 15, color: C.textLight, margin: '0 0 14px' }}>{livro.autor || 'Autor não informado'}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, fontSize: 12 }}>
            {livro.editora && <span style={chip}>{livro.editora}</span>}
            {livro.encadernacao && <span style={chip}>{livro.encadernacao}</span>}
            {fmtPreco(livro.preco) && <span style={chip}>{fmtPreco(livro.preco)}</span>}
            {livro.ean && <span style={chip}>ISBN {livro.ean}</span>}
            {livro.data_lancamento && <span style={chip}>Lançamento {fmtData(livro.data_lancamento)}</span>}
          </div>
          {livro.descricao && <div style={{ fontSize: 14, lineHeight: 1.7, color: C.textLight, borderTop: `1px solid ${C.borderLight}`, paddingTop: 14, marginBottom: 18, whiteSpace: 'pre-line' }}>{livro.descricao}</div>}
          <button onClick={onAlternar} disabled={bloqueado} style={{ ...btnPrimario, width: '100%', opacity: bloqueado ? 0.5 : 1 }}>
            {selecionado ? <><X size={16} /> Remover da seleção</> : bloqueado ? 'Limite do mês atingido' : <><Plus size={16} /> Selecionar para divulgação</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function PainelLateral({ titulo, onVoltar, onFechar, rodape, children }) {
  return (
    <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: C.overlay, zIndex: 300, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, width: '100%', maxWidth: 460, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onVoltar && <button onClick={onVoltar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text }}><ArrowLeft size={20} /></button>}
            <h2 style={{ fontFamily: F.display, fontSize: 20, margin: 0, color: C.dark }}>{titulo}</h2>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={22} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>{children}</div>
        {rodape && <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.borderLight}`, background: C.bg }}>{rodape}</div>}
      </div>
    </div>
  )
}

function PainelHistorico({ influencer, onFechar }) {
  const [pedidos, setPedidos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState(null)

  useEffect(() => {
    supabase.rpc('vp_meus_pedidos', { p_influencer_id: influencer.id })
      .then(({ data }) => setPedidos(Array.isArray(data) ? data : []))
      .finally(() => setCarregando(false))
  }, [influencer])

  return (
    <PainelLateral titulo="Meus pedidos" onFechar={onFechar}>
      {carregando ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: '60px 0', color: C.muted }}><Loader2 size={26} color={C.accent} className="vp-spin" /></div>
      ) : pedidos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 10px', color: C.muted }}>
          <Package size={42} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ margin: 0 }}>Nenhum pedido ainda.</p>
        </div>
      ) : pedidos.map(p => {
        const st = STATUS_PEDIDO[p.status] || STATUS_PEDIDO.novo
        const abre = aberto === p.id
        const itens = p.itens || []
        return (
          <div key={p.id} style={{ border: `1px solid ${abre ? C.accent : C.borderLight}`, borderRadius: 14, marginBottom: 10, overflow: 'hidden' }}>
            <button onClick={() => setAberto(abre ? null : p.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', background: C.white, border: 'none', cursor: 'pointer', fontFamily: F.body, textAlign: 'left' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>Pedido #{p.id}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20 }}>{st.label}</span>
                  {p.status_envio && <span style={{ fontSize: 11, fontWeight: 600, background: '#E8F0EC', color: '#1A3A2A', padding: '2px 8px', borderRadius: 20 }}>{STATUS_ENVIO[p.status_envio] || p.status_envio}</span>}
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  {fmtData(p.created_at)} · {itens.length} livro{itens.length !== 1 ? 's' : ''}{p.data_divulgacao ? ` · Divulgação: ${fmtData(p.data_divulgacao)}` : ''}
                </div>
              </div>
              <ChevronRight size={16} color={C.muted} style={{ transform: abre ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {abre && (
              <div style={{ borderTop: `1px solid ${C.borderLight}`, padding: '10px 15px', background: C.bg, fontSize: 13 }}>
                {itens.map((it, i) => <div key={i} style={{ padding: '6px 0', borderBottom: i < itens.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>{it.titulo_livro}</div>)}
                {p.data_envio && <div style={{ marginTop: 8, color: C.textLight }}>Enviado em {fmtData(p.data_envio)}</div>}
                {p.codigo_rastreio && <div style={{ color: C.textLight }}>Código de rastreio: <strong style={{ fontFamily: 'monospace' }}>{p.codigo_rastreio}</strong></div>}
                {p.observacoes && <div style={{ marginTop: 8, fontStyle: 'italic', color: C.muted }}>Obs.: {p.observacoes}</div>}
              </div>
            )}
          </div>
        )
      })}
    </PainelLateral>
  )
}

function Campo({ label, children }) {
  return <div style={{ marginBottom: 14 }}><label style={labelStyle}>{label}</label>{children}</div>
}

function ErroBox({ texto }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: C.errorLight, border: `1px solid ${C.error}40`, borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: C.error }}>
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {texto}
    </div>
  )
}

function EstiloGlobal() {
  return <style>{`@keyframes vp-spin { to { transform: rotate(360deg) } } .vp-spin { animation: vp-spin 1s linear infinite; }`}</style>
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: C.textLight, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }
const inputStyle = { width: '100%', padding: '12px 14px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14, fontFamily: F.body, background: C.white, color: C.text, outline: 'none', boxSizing: 'border-box' }
const btnPrimario = { border: 'none', borderRadius: 12, background: C.primary, color: C.white, padding: '13px 16px', fontSize: 15, fontWeight: 600, fontFamily: F.body, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }
const btnSecundario = { border: `1.5px solid ${C.border}`, borderRadius: 12, background: C.white, color: C.text, padding: '11px 15px', fontSize: 14, fontWeight: 500, fontFamily: F.body, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }
const btnTopo = { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '9px 13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: C.white, fontSize: 13, fontWeight: 600, fontFamily: F.body }
const chip = { background: `${C.accent}18`, color: C.dark, padding: '4px 10px', borderRadius: 8 }
