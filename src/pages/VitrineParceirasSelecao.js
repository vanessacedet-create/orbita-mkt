import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Check, Loader2, BookOpen, ArrowRight, ArrowLeft, AlertCircle, CalendarDays, Send, Search, X } from 'lucide-react'

/* ============================================
   VITRINE EDITORAS PARCEIRAS — Seleção personalizada
   Rota: /vitrine-parceiras/selecao/:token (sem login no Órbita)
   O influencer escolhe exatamente a quantidade definida pela equipe.
   Usa só as funções vp_selecao_por_token e vp_responder_selecao.
   ============================================ */

const C = {
  bg: '#F7F7F5', card: '#FFFFFF', text: '#2A2A2A', muted: '#777', border: '#E4E4E1',
  primary: '#343434', accent: '#F2B705', success: '#4B7D5B', error: '#B42318',
}

function soDigitos(v) { return (v || '').replace(/\D/g, '') }
function mascaraCpf(v) {
  const n = soDigitos(v).slice(0, 11)
  return n.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}
function hojeISO() {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
}
function fmtData(d) {
  if (!d) return ''
  const [a, m, dia] = String(d).slice(0, 10).split('-')
  return `${dia}/${m}/${a}`
}
function fmtPreco(v) {
  const n = Number(v)
  return v == null || !Number.isFinite(n) ? null : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function resumo(texto, max = 150) {
  const t = (texto || '').replace(/\s+/g, ' ').trim()
  if (!t) return 'Sinopse não disponível para este título.'
  return t.length > max ? t.slice(0, max).trimEnd() + '…' : t
}

export default function VitrineParceirasSelecao() {
  const { token } = useParams()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [escolhidos, setEscolhidos] = useState([])
  const [etapa, setEtapa] = useState('livros') // 'livros' | 'confirmacao'
  const [enviando, setEnviando] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [busca, setBusca] = useState('')
  const [detalhe, setDetalhe] = useState(null)
  const [form, setForm] = useState({ cpf: '', telefone: '', cep: '', endereco: '', dataDivulgacao: '', obs: '' })

  useEffect(() => {
    if (document.getElementById('vitrine-fonts')) return
    const link = document.createElement('link')
    link.id = 'vitrine-fonts'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap'
    document.head.appendChild(link)
  }, [])

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data, error } = await supabase.rpc('vp_selecao_por_token', { p_token: token })
      if (error || !data) {
        setErro('Este link não é válido ou não está mais disponível.')
      } else {
        setDados(data)
        if (data.status === 'respondida') setConcluido(true)
        if (data.influencer?.id) {
          const { data: rows } = await supabase.rpc('vp_ultimo_endereco', { p_influencer_id: data.influencer.id })
          const u = Array.isArray(rows) ? rows[0] : rows
          if (u) setForm(f => ({ ...f, telefone: u.contato || '', cep: u.cep || '', endereco: u.endereco || '' }))
        }
      }
      setLoading(false)
    }
    carregar()
  }, [token])

  const limite = Number(dados?.quantidade_titulos || 0)
  const atingiu = escolhidos.length >= limite
  const livros = dados?.livros || []
  const escolhidosDetalhe = useMemo(() => livros.filter(l => escolhidos.includes(l.id)), [livros, escolhidos])
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return livros
    return livros.filter(l =>
      (l.titulo || '').toLowerCase().includes(t) || (l.autor || '').toLowerCase().includes(t) || (l.editora || '').toLowerCase().includes(t))
  }, [livros, busca])

  function alternar(livro) {
    setEscolhidos(prev => {
      if (prev.includes(livro.id)) return prev.filter(id => id !== livro.id)
      if (prev.length >= limite) return prev
      return [...prev, livro.id]
    })
  }

  async function confirmar() {
    if (escolhidos.length !== limite) return
    if (soDigitos(form.cpf).length !== 11 || !form.telefone.trim() || !form.dataDivulgacao) {
      setErro('Preencha CPF, telefone e data prevista de divulgação.')
      return
    }
    if (form.dataDivulgacao < hojeISO()) {
      setErro('A data de divulgação precisa ser hoje ou uma data futura.')
      return
    }
    setErro('')
    setEnviando(true)
    try {
      const { error } = await supabase.rpc('vp_responder_selecao', {
        p_token: token,
        p_cpf: soDigitos(form.cpf),
        p_contato: form.telefone.trim(),
        p_cep: form.cep.trim(),
        p_endereco: form.endereco.trim(),
        p_data_divulgacao: form.dataDivulgacao,
        p_observacoes: form.obs.trim(),
        p_livros: escolhidos,
      })
      if (error) throw error
      setConcluido(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setErro(e?.message || 'Não foi possível enviar a seleção. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) return <div style={centro}><Loader2 size={30} className="vps-spin" /><span>Carregando sua seleção...</span><Estilo /></div>

  if (!dados) return <div style={centro}><AlertCircle size={36} color={C.error} /><h2 style={{ margin: 0 }}>Link indisponível</h2><p>{erro}</p></div>

  if (dados.status === 'expirada' || dados.status === 'encerrada') {
    return <div style={centro}><AlertCircle size={36} color={C.error} /><h2 style={{ margin: 0 }}>Esta seleção foi encerrada</h2><p>Fale com a equipe CEDET para receber um novo link.</p></div>
  }

  if (concluido) {
    return (
      <div style={{ ...pagina, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div style={{ ...painel, maxWidth: 560, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#eaf5ed', color: C.success, display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}><Check size={34} /></div>
          <h1 style={titulo}>Seleção recebida!</h1>
          <p style={{ color: C.muted, lineHeight: 1.7 }}>
            Obrigado, {dados.influencer?.nome}. A equipe CEDET recebeu os títulos escolhidos para <strong>{dados.nome}</strong>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={pagina}>
      <header style={{ background: '#2c2c2c', color: '#fff', padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <BookOpen size={22} color={C.accent} />
        <div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: 20 }}>Vitrine Editoras Parceiras</div>
          <div style={{ fontSize: 12, color: '#cfcfcf' }}>Seleção personalizada</div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '30px 18px 120px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Olá, {dados.influencer?.nome}</div>
          <h1 style={{ ...titulo, marginBottom: 8 }}>{dados.nome}</h1>
          <p style={{ margin: 0, color: C.muted, lineHeight: 1.65, maxWidth: 720 }}>
            Preparamos esta curadoria para você. Escolha exatamente <strong>{limite} {limite === 1 ? 'título' : 'títulos'}</strong>. Cada título corresponde a 1 unidade.
          </p>
        </div>

        {etapa === 'livros' ? (
          <>
            <div className="vps-ferramentas" style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 220px) 1fr', gap: 12, marginBottom: 18 }}>
              <div style={{ ...painel, padding: '12px 14px', fontSize: 13 }}><strong>{escolhidos.length} de {limite}</strong> selecionados</div>
              <div style={{ position: 'relative' }}>
                <Search size={17} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por título, autor ou editora..." style={{ ...entrada, height: '100%', minHeight: 44, paddingLeft: 40 }} />
              </div>
            </div>

            <div className="vps-grade" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
              {filtrados.map(l => {
                const marcado = escolhidos.includes(l.id)
                const bloqueado = atingiu && !marcado
                return (
                  <article key={l.id} style={{
                    background: C.card, border: `1.5px solid ${marcado ? C.accent : C.border}`, borderRadius: 13, overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', opacity: bloqueado ? 0.6 : 1,
                    boxShadow: marcado ? '0 0 0 2px rgba(242,183,5,.18)' : '0 3px 14px rgba(0,0,0,.04)',
                  }}>
                    <button type="button" onClick={() => alternar(l)} disabled={bloqueado}
                      style={{ border: 0, padding: 0, background: 'transparent', cursor: bloqueado ? 'not-allowed' : 'pointer' }}>
                      <div style={{ height: 260, padding: '14px 12px 8px', boxSizing: 'border-box', background: '#fafaf8', display: 'grid', placeItems: 'center', position: 'relative' }}>
                        {l.imagem_url ? <img src={l.imagem_url} alt={l.titulo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <BookOpen size={32} color="#aaa" />}
                        <span style={{ position: 'absolute', top: 9, right: 9, width: 25, height: 25, borderRadius: '50%', border: `1.5px solid ${marcado ? C.accent : '#bbb'}`, background: marcado ? C.accent : '#fff', display: 'grid', placeItems: 'center' }}>
                          {marcado && <Check size={15} color="#222" />}
                        </span>
                      </div>
                    </button>
                    <div style={{ padding: '12px 13px 14px', display: 'flex', flexDirection: 'column', flex: 1, borderTop: `1px solid ${C.border}` }}>
                      <strong style={{ fontSize: 14, lineHeight: 1.35 }}>{l.titulo}</strong>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>{[l.autor, l.editora].filter(Boolean).join(' · ')}</div>
                      <p style={{ margin: '9px 0 10px', color: '#626262', fontSize: 12, lineHeight: 1.5, flex: 1 }}>{resumo(l.descricao)}</p>
                      <button type="button" onClick={() => setDetalhe(l)} style={{ border: 0, background: 'transparent', padding: 0, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start', color: C.text }}>
                        Ver mais <ArrowRight size={14} />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>

            {dados.expira_em && (
              <div style={{ marginTop: 18, display: 'flex', gap: 7, alignItems: 'center', color: C.muted, fontSize: 12 }}>
                <CalendarDays size={14} /> Link válido até {new Date(dados.expira_em).toLocaleDateString('pt-BR')}.
              </div>
            )}

            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10, background: 'rgba(255,255,255,.96)', borderTop: `1px solid ${C.border}`, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 -8px 25px rgba(0,0,0,.06)' }}>
              <div><strong>{escolhidos.length}/{limite}</strong> <span style={{ color: C.muted, fontSize: 13 }}>títulos selecionados</span></div>
              <button disabled={escolhidos.length !== limite} onClick={() => { setEtapa('confirmacao'); window.scrollTo(0, 0) }}
                style={{ ...botao, opacity: escolhidos.length === limite ? 1 : 0.45, cursor: escolhidos.length === limite ? 'pointer' : 'not-allowed' }}>
                Continuar <ArrowRight size={17} />
              </button>
            </div>
          </>
        ) : (
          <div className="vps-confirmacao" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 420px)', gap: 22, alignItems: 'start' }}>
            <div style={painel}>
              <button onClick={() => setEtapa('livros')} style={{ border: 'none', background: 'none', padding: 0, marginBottom: 16, color: '#666', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                <ArrowLeft size={15} /> Alterar livros
              </button>
              <h2 style={{ ...titulo, fontSize: 22 }}>Sua escolha</h2>
              <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                {escolhidosDetalhe.map(l => (
                  <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 9, border: `1px solid ${C.border}`, borderRadius: 9 }}>
                    {l.imagem_url && <img src={l.imagem_url} alt="" style={{ width: 38, height: 52, objectFit: 'cover', borderRadius: 4 }} />}
                    <div><strong style={{ fontSize: 13 }}>{l.titulo}</strong><div style={{ color: C.muted, fontSize: 11 }}>1 unidade</div></div>
                  </div>
                ))}
              </div>
            </div>

            <div style={painel}>
              <h2 style={{ ...titulo, fontSize: 22, marginBottom: 12 }}>Confirmar envio</h2>
              <label style={rotulo}>CPF *</label>
              <input value={form.cpf} onChange={e => setForm({ ...form, cpf: mascaraCpf(e.target.value) })} placeholder="000.000.000-00" style={entrada} />
              <label style={rotulo}>Telefone / WhatsApp *</label>
              <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" style={entrada} />
              <label style={rotulo}>CEP</label>
              <input value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} placeholder="00000-000" style={entrada} />
              <label style={rotulo}>Endereço completo</label>
              <input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade - UF" style={entrada} />
              <label style={rotulo}>Data prevista de divulgação *</label>
              <input type="date" min={hojeISO()} value={form.dataDivulgacao} onChange={e => setForm({ ...form, dataDivulgacao: e.target.value })} style={entrada} />
              <label style={rotulo}>Observações (opcional)</label>
              <textarea rows={3} value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} style={{ ...entrada, resize: 'vertical' }} />
              {erro && (
                <div style={{ marginTop: 12, background: '#fef3f2', color: C.error, border: '1px solid #fecdca', borderRadius: 9, padding: 10, display: 'flex', gap: 8, fontSize: 12 }}>
                  <AlertCircle size={16} /> {erro}
                </div>
              )}
              <button onClick={confirmar} disabled={enviando} style={{ ...botao, width: '100%', justifyContent: 'center', marginTop: 14, cursor: enviando ? 'wait' : 'pointer' }}>
                {enviando ? <Loader2 size={17} className="vps-spin" /> : <Send size={17} />} Confirmar seleção
              </button>
            </div>
          </div>
        )}
      </main>

      {detalhe && (
        <div onClick={() => setDetalhe(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,20,20,.48)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="vps-detalhe" style={{ position: 'relative', width: 'min(860px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#fff', borderRadius: 16, padding: 22 }}>
            <button onClick={() => setDetalhe(null)} style={{ position: 'absolute', top: 12, right: 12, border: 0, background: '#fff', width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}><X size={20} /></button>
            <div className="vps-detalhe-grade" style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 300px) 1fr', gap: 24 }}>
              <div style={{ background: '#fafaf8', borderRadius: 12, padding: 16, height: 380, display: 'grid', placeItems: 'center' }}>
                {detalhe.imagem_url ? <img src={detalhe.imagem_url} alt={detalhe.titulo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <BookOpen size={46} color="#aaa" />}
              </div>
              <div>
                <h2 style={{ ...titulo, fontSize: 26, marginBottom: 5 }}>{detalhe.titulo}</h2>
                {detalhe.autor && <div style={{ color: C.muted, fontSize: 15 }}>{detalhe.autor}</div>}
                {detalhe.editora && <div style={{ color: '#999', fontSize: 13, marginTop: 3 }}>{detalhe.editora}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, margin: '18px 0', padding: '14px 0', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                  {fmtPreco(detalhe.preco) && <div><div style={{ color: C.muted, fontSize: 11 }}>Preço de capa</div><strong>{fmtPreco(detalhe.preco)}</strong></div>}
                  {detalhe.encadernacao && <div><div style={{ color: C.muted, fontSize: 11 }}>Encadernação</div><strong>{detalhe.encadernacao}</strong></div>}
                  {detalhe.ean && <div><div style={{ color: C.muted, fontSize: 11 }}>ISBN / EAN</div><strong>{detalhe.ean}</strong></div>}
                  {detalhe.data_lancamento && <div><div style={{ color: C.muted, fontSize: 11 }}>Lançamento</div><strong>{fmtData(detalhe.data_lancamento)}</strong></div>}
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Sobre o livro</h3>
                <p style={{ margin: 0, whiteSpace: 'pre-line', color: '#555', fontSize: 13, lineHeight: 1.7 }}>{detalhe.descricao || 'Sinopse não disponível para este título.'}</p>
                <button type="button" disabled={atingiu && !escolhidos.includes(detalhe.id)} onClick={() => alternar(detalhe)}
                  style={{ ...botao, width: '100%', justifyContent: 'center', marginTop: 18, cursor: 'pointer', opacity: atingiu && !escolhidos.includes(detalhe.id) ? 0.45 : 1 }}>
                  {escolhidos.includes(detalhe.id) ? 'Remover da seleção' : 'Adicionar à seleção'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Estilo />
    </div>
  )
}

function Estilo() {
  return (
    <style>{`
      @keyframes vps-spin { to { transform: rotate(360deg) } }
      .vps-spin { animation: vps-spin 1s linear infinite; }
      @media (max-width: 900px) { .vps-grade { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } }
      @media (max-width: 760px) {
        .vps-grade { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
        .vps-confirmacao, .vps-ferramentas, .vps-detalhe-grade { grid-template-columns: 1fr !important; }
      }
    `}</style>
  )
}

const pagina = { minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'DM Sans', Arial, sans-serif" }
const centro = { minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, fontFamily: "'DM Sans', Arial, sans-serif", color: C.text, background: C.bg }
const titulo = { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 30, margin: 0 }
const painel = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }
const rotulo = { display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '.4px', margin: '13px 0 6px' }
const entrada = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 11px', fontSize: 14, fontFamily: 'inherit', color: C.text, background: '#fff', outline: 'none' }
const botao = { border: 'none', borderRadius: 9, background: C.primary, color: '#fff', padding: '11px 15px', display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontFamily: 'inherit' }
