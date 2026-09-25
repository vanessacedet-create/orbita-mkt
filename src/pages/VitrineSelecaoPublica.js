import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { filtrarLivrosComEstoque } from '../lib/estoqueCdl';
import {
  Check, Loader2, BookOpen, ArrowRight, ArrowLeft, AlertCircle,
  CalendarDays, Send, Search, X
} from 'lucide-react';

const COLORS = {
  bg: '#F7F7F5', card: '#FFFFFF', text: '#2A2A2A', muted: '#777',
  border: '#E4E4E1', primary: '#343434', accent: '#F2B705',
  success: '#4B7D5B', error: '#B42318',
};

function normalizeCpf(cpf) {
  return (cpf || '').replace(/\D/g, '');
}

function formatarCpf(valor) {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  return nums
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

export default function VitrineSelecaoPublica() {
  const { token } = useParams();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [selecionados, setSelecionados] = useState([]);
  const [etapa, setEtapa] = useState('livros');
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [busca, setBusca] = useState('');
  const [livroDetalhe, setLivroDetalhe] = useState(null);
  const [form, setForm] = useState({
    cpf: '', telefone: '', cep: '', endereco: '', dataDivulgacao: '', obs: '',
  });

  useEffect(() => {
    if (!document.getElementById('vitrine-fonts')) {
      const link = document.createElement('link');
      link.id = 'vitrine-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const { data, error } = await supabase.rpc('vitrine_selecao_por_token', { p_token: token });
      if (error || !data) {
        setErro('Este link não é válido ou não está mais disponível.');
      } else {
        try {
          const livrosDisponiveis = await filtrarLivrosComEstoque(data.livros || []);
          setDados({ ...data, livros: livrosDisponiveis });
        } catch (estoqueError) {
          console.error('[Vitrine Seleção] Falha ao consultar estoque físico:', estoqueError);
          setDados({ ...data, livros: [] });
          setErro('Não foi possível confirmar a disponibilidade dos livros agora. Tente novamente em alguns minutos.');
        }
        if (data.status === 'respondida') setConcluido(true);
        if (data.parceiro?.id) {
          const { data: rows } = await supabase.rpc('vitrine_ultimo_endereco', { p_parceiro_id: data.parceiro.id });
          const ultimo = Array.isArray(rows) ? rows[0] : rows;
          if (ultimo) {
            setForm(prev => ({
              ...prev,
              telefone: ultimo.contato || '',
              cep: ultimo.cep || '',
              endereco: ultimo.endereco || '',
            }));
          }
        }
      }
      setLoading(false);
    }
    carregar();
  }, [token]);

  const limite = Number(dados?.quantidade_titulos || 0);
  const atingiuLimite = selecionados.length >= limite;

  const selecionadosDetalhe = useMemo(
    () => (dados?.livros || []).filter(l => selecionados.includes(l.id)),
    [dados, selecionados]
  );

  const livrosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return dados?.livros || [];
    return (dados?.livros || []).filter(l =>
      l.titulo?.toLowerCase().includes(termo) ||
      l.autor?.toLowerCase().includes(termo) ||
      l.editora?.toLowerCase().includes(termo)
    );
  }, [dados, busca]);

  function resumoDescricao(texto, limiteChars = 150) {
    const limpo = (texto || '').replace(/\s+/g, ' ').trim();
    if (!limpo) return 'Sinopse não disponível para este título.';
    return limpo.length > limiteChars ? limpo.slice(0, limiteChars).trimEnd() + '…' : limpo;
  }

  function formatarPreco(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return null;
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function toggleLivro(livro) {
    setSelecionados(prev => {
      if (prev.includes(livro.id)) return prev.filter(id => id !== livro.id);
      if (prev.length >= limite) return prev;
      return [...prev, livro.id];
    });
  }

  async function confirmar() {
    if (selecionados.length !== limite) return;
    if (!form.cpf.trim() || !form.telefone.trim() || !form.dataDivulgacao) {
      setErro('Preencha CPF, telefone e data prevista de divulgação.');
      return;
    }

    setErro('');
    setEnviando(true);
    try {
      const { error } = await supabase.rpc('vitrine_responder_selecao', {
        p_token: token,
        p_cpf: normalizeCpf(form.cpf),
        p_contato: form.telefone.trim(),
        p_cep: form.cep.trim(),
        p_endereco: form.endereco.trim(),
        p_data_divulgacao: form.dataDivulgacao,
        p_observacoes: form.obs.trim(),
        p_livros: selecionados,
      });
      if (error) throw error;
      setConcluido(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('[Vitrine Seleção] Erro:', err);
      setErro(err?.message || 'Não foi possível enviar a seleção. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  if (loading) return (
    <div style={fullCenter}><Loader2 size={30} style={{ animation: 'spin 1s linear infinite' }} /><span>Carregando sua seleção...</span></div>
  );

  if (erro && !dados) return (
    <div style={fullCenter}><AlertCircle size={36} color={COLORS.error} /><h2>Link indisponível</h2><p>{erro}</p></div>
  );

  if (dados?.status === 'expirada' || dados?.status === 'encerrada') return (
    <div style={fullCenter}><AlertCircle size={36} color={COLORS.error} /><h2>Esta seleção foi encerrada</h2><p>Entre em contato com a equipe CEDET para receber um novo link.</p></div>
  );

  if (concluido) return (
    <div style={{ ...page, display: 'grid', placeItems: 'center' }}>
      <div style={{ ...panel, maxWidth: 560, textAlign: 'center' }}>
        <div style={successIcon}><Check size={34} /></div>
        <h1 style={title}>Seleção recebida!</h1>
        <p style={{ color: COLORS.muted, lineHeight: 1.7 }}>
          Obrigado, {dados?.parceiro?.nome}. A equipe CEDET recebeu os títulos escolhidos para <strong>{dados?.nome}</strong>.
        </p>
      </div>
    </div>
  );

  return (
    <div style={page}>
      <header style={header}>
        <BookOpen size={22} color={COLORS.accent} />
        <div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: 20 }}>Vitrine CEDET</div>
          <div style={{ fontSize: 12, color: '#cfcfcf' }}>Seleção personalizada para parceiros</div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '34px 18px 120px' }}>
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 6 }}>Olá, {dados.parceiro?.nome}</div>
          <h1 style={{ ...title, marginBottom: 8 }}>{dados.nome}</h1>
          <p style={{ margin: 0, color: COLORS.muted, lineHeight: 1.65, maxWidth: 720 }}>
            Preparamos esta curadoria para a sua próxima campanha. Escolha exatamente <strong>{limite} {limite === 1 ? 'título' : 'títulos'}</strong>. Cada título corresponde a 1 unidade.
          </p>
        </div>

        {etapa === 'livros' ? (
          <>
            <div style={selectionTools}>
              <div style={progress}>
                <strong>{selecionados.length} de {limite}</strong> selecionados
              </div>
              <div style={searchWrap}>
                <Search size={17} style={searchIcon} />
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar por título, autor ou editora..."
                  style={searchInput}
                />
              </div>
            </div>

            <div style={grid} className="vitrine-selecao-grid">
              {livrosFiltrados.map(livro => {
                const marcado = selecionados.includes(livro.id);
                const bloqueado = atingiuLimite && !marcado;
                return (
                  <article key={livro.id} style={{
                    ...bookCard,
                    opacity: bloqueado ? .62 : 1,
                    borderColor: marcado ? COLORS.accent : COLORS.border,
                    boxShadow: marcado ? '0 0 0 2px rgba(242,183,5,.18)' : '0 3px 14px rgba(0,0,0,.04)',
                  }}>
                    <button
                      type="button"
                      onClick={() => toggleLivro(livro)}
                      disabled={bloqueado}
                      aria-label={marcado ? `Remover ${livro.titulo} da seleção` : `Adicionar ${livro.titulo} à seleção`}
                      style={{ ...coverButton, cursor: bloqueado ? 'not-allowed' : 'pointer' }}
                    >
                      <div style={coverWrap}>
                        {livro.imagem_url
                          ? <img src={livro.imagem_url} alt={`Capa de ${livro.titulo}`} style={cover} />
                          : <BookOpen size={32} color="#aaa" />}
                        <span style={{
                          ...checkCircle,
                          background: marcado ? COLORS.accent : '#fff',
                          borderColor: marcado ? COLORS.accent : '#bbb',
                        }}>{marcado && <Check size={15} color="#222" />}</span>
                      </div>
                    </button>
                    <div style={bookInfo}>
                      <strong style={bookTitle}>{livro.titulo}</strong>
                      <div style={bookMeta}>
                        {livro.autor && <span>{livro.autor}</span>}
                        {livro.editora && <span style={{ color: '#999' }}>{livro.editora}</span>}
                      </div>
                      <p style={bookDescription}>{resumoDescricao(livro.descricao)}</p>
                      <button type="button" onClick={() => setLivroDetalhe(livro)} style={moreBtn}>Ver mais <ArrowRight size={14} /></button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div style={stickyBar}>
              <div>
                <strong>{selecionados.length}/{limite}</strong>
                <span style={{ color: COLORS.muted, marginLeft: 7, fontSize: 13 }}>títulos selecionados</span>
              </div>
              <button disabled={selecionados.length !== limite} onClick={() => { setEtapa('confirmacao'); window.scrollTo(0, 0); }} style={{
                ...primaryBtn,
                opacity: selecionados.length === limite ? 1 : .45,
                cursor: selecionados.length === limite ? 'pointer' : 'not-allowed',
              }}>
                Continuar <ArrowRight size={17} />
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 420px)', gap: 24, alignItems: 'start' }} className="vitrine-selecao-confirmacao">
            <div style={panel}>
              <button onClick={() => setEtapa('livros')} style={backBtn}><ArrowLeft size={15} /> Alterar livros</button>
              <h2 style={{ ...title, fontSize: 22 }}>Sua escolha</h2>
              <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                {selecionadosDetalhe.map(l => (
                  <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 9, border: `1px solid ${COLORS.border}`, borderRadius: 9 }}>
                    {l.imagem_url && <img src={l.imagem_url} alt="" style={{ width: 38, height: 52, objectFit: 'cover', borderRadius: 4 }} />}
                    <div><strong style={{ fontSize: 13 }}>{l.titulo}</strong><div style={{ color: COLORS.muted, fontSize: 11 }}>1 unidade</div></div>
                  </div>
                ))}
              </div>
            </div>

            <div style={panel}>
              <h2 style={{ ...title, fontSize: 22, marginBottom: 4 }}>Confirmar envio</h2>
              <p style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.5, marginTop: 0 }}>Usamos estes dados no mesmo fluxo de pedidos da Vitrine.</p>

              <label style={label}>CPF</label>
              <input value={form.cpf} onChange={e => setForm({ ...form, cpf: formatarCpf(e.target.value) })} placeholder="000.000.000-00" style={input} />

              <label style={label}>Telefone</label>
              <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" style={input} />

              <label style={label}>CEP</label>
              <input value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} placeholder="00000-000" style={input} />

              <label style={label}>Endereço</label>
              <input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, complemento, cidade/UF" style={input} />

              <label style={label}>Data prevista de divulgação</label>
              <input type="date" min={new Date().toISOString().slice(0, 10)} value={form.dataDivulgacao} onChange={e => setForm({ ...form, dataDivulgacao: e.target.value })} style={input} />

              <label style={label}>Observações (opcional)</label>
              <textarea value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} rows={3} style={{ ...input, resize: 'vertical' }} />

              {erro && <div style={errorBox}><AlertCircle size={16} /> {erro}</div>}

              <button onClick={confirmar} disabled={enviando} style={{ ...primaryBtn, width: '100%', justifyContent: 'center', marginTop: 14 }}>
                {enviando ? <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={17} />}
                Confirmar seleção
              </button>
            </div>
          </div>
        )}

        {dados.expira_em && etapa === 'livros' && (
          <div style={{ marginTop: 18, display: 'flex', gap: 7, alignItems: 'center', color: COLORS.muted, fontSize: 12 }}>
            <CalendarDays size={14} /> Link válido até {new Date(dados.expira_em).toLocaleDateString('pt-BR')}.
          </div>
        )}
      </main>

      {livroDetalhe && (
        <div style={detailOverlay} onClick={() => setLivroDetalhe(null)}>
          <div style={detailModal} className="vitrine-detalhe-modal" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setLivroDetalhe(null)} style={detailClose} aria-label="Fechar detalhes"><X size={22} /></button>
            <div style={detailLayout} className="vitrine-detalhe-layout">
              <div style={detailCoverColumn}>
                <div style={detailCoverWrap}>
                  {livroDetalhe.imagem_url
                    ? <img src={livroDetalhe.imagem_url} alt={`Capa de ${livroDetalhe.titulo}`} style={detailCover} />
                    : <BookOpen size={46} color="#aaa" />}
                </div>
              </div>
              <div style={detailContent}>
                <h2 style={{ ...title, fontSize: 28, marginBottom: 5 }}>{livroDetalhe.titulo}</h2>
                {livroDetalhe.autor && <div style={{ color: COLORS.muted, fontSize: 15 }}>{livroDetalhe.autor}</div>}
                {livroDetalhe.editora && <div style={{ color: '#999', fontSize: 13, marginTop: 3 }}>{livroDetalhe.editora}</div>}

                <div style={detailFacts}>
                  {formatarPreco(livroDetalhe.preco) && <div><span style={factLabel}>Preço de capa</span><strong>{formatarPreco(livroDetalhe.preco)}</strong></div>}
                  {livroDetalhe.encadernacao && <div><span style={factLabel}>Encadernação</span><strong>{livroDetalhe.encadernacao}</strong></div>}
                  {livroDetalhe.ean && <div><span style={factLabel}>ISBN / EAN</span><strong>{livroDetalhe.ean}</strong></div>}
                  {livroDetalhe.data_lancamento && <div><span style={factLabel}>Lançamento</span><strong>{new Date(livroDetalhe.data_lancamento).toLocaleDateString('pt-BR')}</strong></div>}
                </div>

                <div style={detailSection}>
                  <h3 style={detailHeading}>Sobre o livro</h3>
                  <p style={detailDescription}>{livroDetalhe.descricao || 'Sinopse não disponível para este título.'}</p>
                </div>

                <button
                  type="button"
                  disabled={atingiuLimite && !selecionados.includes(livroDetalhe.id)}
                  onClick={() => toggleLivro(livroDetalhe)}
                  style={{
                    ...primaryBtn, width: '100%', justifyContent: 'center', marginTop: 18,
                    opacity: atingiuLimite && !selecionados.includes(livroDetalhe.id) ? .45 : 1,
                  }}
                >
                  {selecionados.includes(livroDetalhe.id) ? 'Remover da seleção' : 'Adicionar à seleção'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 900px) {
          .vitrine-selecao-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 760px) {
          .vitrine-selecao-confirmacao { grid-template-columns: 1fr !important; }
          .vitrine-selecao-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .vitrine-detalhe-modal { width: calc(100vw - 24px) !important; max-height: calc(100vh - 24px) !important; padding: 18px !important; }
          .vitrine-detalhe-layout { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 520px) {
          .vitrine-selecao-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
        }
      `}</style>
    </div>
  );
}

const page = { minHeight: '100vh', background: COLORS.bg, color: COLORS.text, fontFamily: "'DM Sans', Arial, sans-serif" };
const fullCenter = { minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, fontFamily: "'DM Sans', Arial, sans-serif", color: COLORS.text, background: COLORS.bg };
const header = { background: '#2c2c2c', color: '#fff', padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 10 };
const title = { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 30, margin: 0 };
const selectionTools = { display: 'grid', gridTemplateColumns: 'minmax(180px, 230px) minmax(260px, 1fr)', gap: 12, marginBottom: 18, alignItems: 'stretch' };
const progress = { background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 13, display: 'flex', alignItems: 'center' };
const searchWrap = { position: 'relative' };
const searchIcon = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#999', pointerEvents: 'none' };
const searchInput = { width: '100%', height: '100%', minHeight: 44, boxSizing: 'border-box', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '10px 13px 10px 40px', background: '#fff', color: COLORS.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 18 };
const bookCard = { padding: 0, minWidth: 0, height: '100%', background: COLORS.card, border: '1.5px solid', borderRadius: 13, overflow: 'hidden', position: 'relative', transition: '.15s ease', fontFamily: 'inherit', color: COLORS.text, display: 'flex', flexDirection: 'column' };
const coverButton = { display: 'block', width: '100%', padding: 0, border: 0, background: 'transparent', color: 'inherit', fontFamily: 'inherit' };
const coverWrap = { height: 300, padding: '16px 14px 8px', boxSizing: 'border-box', background: '#fafaf8', display: 'grid', placeItems: 'center', position: 'relative' };
const cover = { width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom', display: 'block' };
const bookInfo = { padding: '13px 14px 15px', textAlign: 'left', minHeight: 210, display: 'flex', flexDirection: 'column', borderTop: `1px solid ${COLORS.border}`, background: '#fff' };
const bookTitle = { display: 'block', fontSize: 14, lineHeight: 1.35, minHeight: '2.7em', overflow: 'hidden' };
const bookMeta = { paddingTop: 7, display: 'flex', flexDirection: 'column', gap: 3, color: COLORS.muted, fontSize: 12, lineHeight: 1.3, minHeight: 38 };
const bookDescription = { margin: '10px 0 12px', color: '#626262', fontSize: 12, lineHeight: 1.5, flex: 1 };
const moreBtn = { border: 0, background: 'transparent', padding: 0, color: COLORS.text, fontWeight: 700, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' };
const checkCircle = { position: 'absolute', top: 9, right: 9, width: 25, height: 25, borderRadius: '50%', border: '1.5px solid', display: 'grid', placeItems: 'center' };
const stickyBar = { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10, background: 'rgba(255,255,255,.96)', borderTop: `1px solid ${COLORS.border}`, padding: '12px max(18px, calc((100vw - 1100px)/2 + 18px))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, boxShadow: '0 -8px 25px rgba(0,0,0,.06)' };
const primaryBtn = { border: 'none', borderRadius: 9, background: COLORS.primary, color: '#fff', padding: '11px 15px', display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontFamily: 'inherit' };
const panel = { background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18 };
const backBtn = { border: 'none', background: 'none', padding: 0, marginBottom: 18, color: '#666', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' };
const label = { display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '.4px', margin: '13px 0 6px' };
const input = { width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: '10px 11px', fontSize: 14, fontFamily: 'inherit', color: COLORS.text, background: '#fff' };
const errorBox = { marginTop: 12, background: '#fef3f2', color: COLORS.error, border: '1px solid #fecdca', borderRadius: 9, padding: 10, display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 };
const successIcon = { width: 64, height: 64, borderRadius: '50%', background: '#eaf5ed', color: COLORS.success, display: 'grid', placeItems: 'center', margin: '0 auto 18px' };

const detailOverlay = { position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,20,20,.48)', display: 'grid', placeItems: 'center', padding: 18 };
const detailModal = { position: 'relative', width: 'min(880px, calc(100vw - 36px))', maxHeight: 'min(760px, calc(100vh - 36px))', overflowY: 'auto', background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 24px 80px rgba(0,0,0,.25)' };
const detailClose = { position: 'absolute', top: 14, right: 14, zIndex: 2, border: 0, background: '#fff', width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#666', boxShadow: '0 2px 10px rgba(0,0,0,.08)' };
const detailLayout = { display: 'grid', gridTemplateColumns: 'minmax(220px, 330px) minmax(0, 1fr)', gap: 28, alignItems: 'start' };
const detailCoverColumn = { background: '#fafaf8', borderRadius: 12, padding: 18 };
const detailCoverWrap = { height: 430, display: 'grid', placeItems: 'center' };
const detailCover = { width: '100%', height: '100%', objectFit: 'contain' };
const detailContent = { padding: '8px 4px 4px' };
const detailFacts = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginTop: 22, padding: '18px 0', borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 };
const factLabel = { display: 'block', color: COLORS.muted, fontSize: 11, marginBottom: 3 };
const detailSection = { paddingTop: 18 };
const detailHeading = { margin: '0 0 8px', fontSize: 15 };
const detailDescription = { margin: 0, whiteSpace: 'pre-line', color: '#555', fontSize: 13, lineHeight: 1.7 };
