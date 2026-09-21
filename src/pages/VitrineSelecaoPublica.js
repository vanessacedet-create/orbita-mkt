import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Check, Loader2, BookOpen, ArrowRight, ArrowLeft, AlertCircle,
  CalendarDays, Send
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
        setDados(data);
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
            <div style={progress}>
              <strong>{selecionados.length} de {limite}</strong> selecionados
            </div>

            <div style={grid}>
              {(dados.livros || []).map(livro => {
                const marcado = selecionados.includes(livro.id);
                const bloqueado = atingiuLimite && !marcado;
                return (
                  <button key={livro.id} onClick={() => toggleLivro(livro)} disabled={bloqueado} style={{
                    ...bookCard,
                    opacity: bloqueado ? .48 : 1,
                    borderColor: marcado ? COLORS.accent : COLORS.border,
                    boxShadow: marcado ? '0 0 0 2px rgba(242,183,5,.18)' : '0 3px 14px rgba(0,0,0,.04)',
                    cursor: bloqueado ? 'not-allowed' : 'pointer',
                  }}>
                    <div style={coverWrap}>
                      {livro.imagem_url
                        ? <img src={livro.imagem_url} alt="" style={cover} />
                        : <BookOpen size={32} color="#aaa" />}
                      <span style={{
                        ...checkCircle,
                        background: marcado ? COLORS.accent : '#fff',
                        borderColor: marcado ? COLORS.accent : '#bbb',
                      }}>{marcado && <Check size={15} color="#222" />}</span>
                    </div>
                    <div style={{ padding: 13, textAlign: 'left' }}>
                      <strong style={{ display: 'block', fontSize: 14, lineHeight: 1.35 }}>{livro.titulo}</strong>
                      {livro.autor && <span style={{ display: 'block', color: COLORS.muted, fontSize: 12, marginTop: 5 }}>{livro.autor}</span>}
                      {livro.editora && <span style={{ display: 'block', color: '#999', fontSize: 11, marginTop: 3 }}>{livro.editora}</span>}
                    </div>
                  </button>
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 760px) {
          .vitrine-selecao-confirmacao { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const page = { minHeight: '100vh', background: COLORS.bg, color: COLORS.text, fontFamily: "'DM Sans', Arial, sans-serif" };
const fullCenter = { minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, fontFamily: "'DM Sans', Arial, sans-serif", color: COLORS.text, background: COLORS.bg };
const header = { background: '#2c2c2c', color: '#fff', padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 10 };
const title = { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 30, margin: 0 };
const progress = { background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '10px 13px', marginBottom: 14, fontSize: 13 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 14 };
const bookCard = { padding: 0, background: COLORS.card, border: '1.5px solid', borderRadius: 12, overflow: 'hidden', position: 'relative', transition: '.15s ease', fontFamily: 'inherit', color: COLORS.text };
const coverWrap = { height: 220, background: '#efefec', display: 'grid', placeItems: 'center', position: 'relative' };
const cover = { width: '100%', height: '100%', objectFit: 'contain' };
const checkCircle = { position: 'absolute', top: 9, right: 9, width: 25, height: 25, borderRadius: '50%', border: '1.5px solid', display: 'grid', placeItems: 'center' };
const stickyBar = { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10, background: 'rgba(255,255,255,.96)', borderTop: `1px solid ${COLORS.border}`, padding: '12px max(18px, calc((100vw - 1100px)/2 + 18px))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, boxShadow: '0 -8px 25px rgba(0,0,0,.06)' };
const primaryBtn = { border: 'none', borderRadius: 9, background: COLORS.primary, color: '#fff', padding: '11px 15px', display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontFamily: 'inherit' };
const panel = { background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18 };
const backBtn = { border: 'none', background: 'none', padding: 0, marginBottom: 18, color: '#666', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' };
const label = { display: 'block', fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '.4px', margin: '13px 0 6px' };
const input = { width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: '10px 11px', fontSize: 14, fontFamily: 'inherit', color: COLORS.text, background: '#fff' };
const errorBox = { marginTop: 12, background: '#fef3f2', color: COLORS.error, border: '1px solid #fecdca', borderRadius: 9, padding: 10, display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 };
const successIcon = { width: 64, height: 64, borderRadius: '50%', background: '#eaf5ed', color: COLORS.success, display: 'grid', placeItems: 'center', margin: '0 auto 18px' };
