import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, ShoppingBag, X, Send, Check,
  BookOpen, Filter, Minus, Plus, ArrowLeft, Loader2, Star,
  LogIn, History, ChevronRight, Package, LogOut, AlertCircle
} from 'lucide-react';

/* ============================================
   VITRINE CEDET — Página Pública
   Rota: /vitrine (sem autenticação)
   Login por e-mail via vitrine_parceiros
   ============================================ */

const COLORS = {
  bg: '#F7F7F5',
  card: '#FFFFFF',
  cardHover: '#FFFDF5',
  primary: '#3A3A3A',
  primaryLight: '#5C5C5C',
  primaryDark: '#2A2A2A',
  accent: '#F2B705',
  accentLight: '#FBE9A0',
  gold: '#F2B705',
  text: '#2A2A2A',
  textLight: '#6B6B6B',
  textMuted: '#9A9A9A',
  border: '#E0E0DE',
  borderLight: '#EDEDEB',
  success: '#5A8F6B',
  error: '#C0392B',
  errorLight: '#FDECEA',
  badge: '#F2B705',
  overlay: 'rgba(42, 42, 42, 0.55)',
  white: '#FFFFFF',
};

const FONTS = {
  display: "'Playfair Display', 'Georgia', serif",
  body: "'DM Sans', 'Helvetica Neue', sans-serif",
};

// ── Limite de títulos por grupo ──
const LIMITE_GRUPO = { A: Infinity, B: 3, C: 2, D: 1 };
function limiteDoGrupo(grupo) {
  return LIMITE_GRUPO[grupo?.toUpperCase()] ?? 1; // sem grupo = tratado como D
}

// ── Normaliza CPF (remove pontuação para salvar/comparar) ──
function normalizeCpf(cpf) {
  return (cpf || '').replace(/\D/g, '');
}

// ── Formata CPF com máscara ──
function formatarCpf(valor) {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  return nums
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

// ── Formata data dd/mm/aaaa ──
function fmtData(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/* ============================================
   TELA DE LOGIN
   ============================================ */
function TelaLogin({ onLogin }) {
  const [valor, setValor] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!document.getElementById('vitrine-fonts')) {
      const link = document.createElement('link');
      link.id = 'vitrine-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    const email = valor.trim();
    if (!email) return;
    setErro('');
    setCarregando(true);

    try {
      const { data, error } = await supabase
        .from('vitrine_parceiros')
        .select('*')
        .eq('ativo', true)
        .ilike('email', email)
        .limit(1)
        .single();

      if (error || !data) {
        setErro('E-mail não encontrado. Verifique seus dados ou entre em contato com a equipe CEDET.');
        setCarregando(false);
        return;
      }

      onLogin(data);
    } catch {
      setErro('Erro ao verificar acesso. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bg,
      fontFamily: FONTS.body,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        background: COLORS.primaryDark,
        padding: '20px 24px',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: FONTS.display,
          fontSize: 'clamp(20px, 4vw, 28px)',
          fontWeight: 700,
          color: COLORS.white,
          margin: 0,
          letterSpacing: '0.5px',
        }}>
          Vitrine CEDET
        </h1>
        <p style={{
          color: COLORS.accentLight,
          fontSize: 13,
          margin: '4px 0 0',
          fontWeight: 500,
        }}>
          Catálogo de livros para parceiros
        </p>
      </header>

      {/* Card de login */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
      }}>
        <div style={{
          background: COLORS.white,
          borderRadius: 20,
          padding: '40px 36px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
          border: `1px solid ${COLORS.borderLight}`,
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: `${COLORS.accent}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <BookOpen size={26} color={COLORS.accent} />
          </div>

          <h2 style={{
            fontFamily: FONTS.display,
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.primaryDark,
            margin: '0 0 6px',
            textAlign: 'center',
          }}>
            Acesso de Parceiro
          </h2>

          <p style={{
            fontSize: 14,
            color: COLORS.textMuted,
            margin: '0 0 28px',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            Digite seu e-mail cadastrado para acessar o catálogo de lançamentos.
          </p>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.textLight,
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                E-mail
              </label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={valor}
                onChange={e => { setValor(e.target.value); setErro(''); }}
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: `1.5px solid ${erro ? COLORS.error : COLORS.border}`,
                  borderRadius: 12,
                  fontSize: 15,
                  fontFamily: FONTS.body,
                  background: COLORS.white,
                  color: COLORS.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => { if (!erro) e.target.style.borderColor = COLORS.accent; }}
                onBlur={e => { if (!erro) e.target.style.borderColor = COLORS.border; }}
              />
            </div>

            {erro && (
              <div style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                background: COLORS.errorLight,
                border: `1px solid ${COLORS.error}30`,
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 16,
                fontSize: 13,
                color: COLORS.error,
                lineHeight: 1.5,
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando || !valor.trim()}
              style={{
                width: '100%',
                padding: '14px',
                border: 'none',
                borderRadius: 12,
                background: (!valor.trim() || carregando) ? COLORS.textMuted : COLORS.primary,
                color: COLORS.white,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: FONTS.body,
                cursor: (!valor.trim() || carregando) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background 0.2s',
              }}
            >
              {carregando
                ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Verificando...</>
                : <><LogIn size={18} /> Acessar vitrine</>
              }
            </button>
          </form>

          <p style={{
            fontSize: 12,
            color: COLORS.textMuted,
            textAlign: 'center',
            marginTop: 20,
            lineHeight: 1.6,
          }}>
            Não sabe seu e-mail cadastrado? Entre em contato com a equipe CEDET.
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

/* ============================================
   PAINEL HISTÓRICO DE PEDIDOS
   ============================================ */
function PainelHistorico({ parceiro, onClose }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pedidoAberto, setPedidoAberto] = useState(null);

  useEffect(() => {
    async function carregarHistorico() {
      setLoading(true);
      const cpfNorm = normalizeCpf(parceiro.cpf);

      const { data } = await supabase
        .from('vitrine_pedidos')
        .select('*, vitrine_pedido_itens(*)')
        .or(`cpf.eq.${parceiro.cpf},cpf.eq.${cpfNorm},email.ilike.${parceiro.email}`)
        .order('created_at', { ascending: false });

      setPedidos(data || []);
      setLoading(false);
    }
    carregarHistorico();
  }, [parceiro]);

  const STATUS_LABEL = {
    novo:         { label: 'Recebido',    bg: '#EAF0F8', color: '#1A3A5C' },
    em_analise:   { label: 'Em análise',  bg: '#FBF3E4', color: '#8B5E1A' },
    aprovado:     { label: 'Aprovado',    bg: '#EAF3DE', color: '#3B6D11' },
    enviado:      { label: 'Enviado',     bg: '#E8F0EC', color: '#1A3A2A' },
    entregue:     { label: 'Entregue',    bg: '#E8F0EC', color: '#1A3A2A' },
    cancelado:    { label: 'Cancelado',   bg: '#FDECEA', color: '#C0392B' },
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: COLORS.overlay,
        zIndex: 300,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: COLORS.white,
          width: '100%',
          maxWidth: 480,
          height: '100%',
          overflowY: 'auto',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${COLORS.borderLight}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: COLORS.bg,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}>
          <div>
            <h2 style={{
              fontFamily: FONTS.display,
              fontSize: 20,
              fontWeight: 700,
              margin: '0 0 2px',
              color: COLORS.primaryDark,
            }}>
              Meus Pedidos
            </h2>
            <p style={{ fontSize: 13, color: COLORS.textMuted, margin: 0 }}>
              {parceiro.nome}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              cursor: 'pointer', padding: 4,
              color: COLORS.textMuted,
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, padding: '16px 24px' }}>
          {loading ? (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '60px 0', gap: 12,
            }}>
              <Loader2 size={28} color={COLORS.accent} style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ color: COLORS.textMuted, fontSize: 14 }}>Carregando histórico...</p>
            </div>
          ) : pedidos.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              color: COLORS.textMuted,
            }}>
              <Package size={44} style={{ marginBottom: 14, opacity: 0.3 }} />
              <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 6px' }}>
                Nenhum pedido ainda
              </p>
              <p style={{ fontSize: 13, margin: 0 }}>
                Seus pedidos de livros aparecerão aqui depois que você enviar a primeira seleção.
              </p>
            </div>
          ) : (
            pedidos.map(pedido => {
              const st = STATUS_LABEL[pedido.status] || { label: pedido.status, bg: '#F1EFE8', color: '#5F5E5A' };
              const aberto = pedidoAberto === pedido.id;
              const totalItens = (pedido.vitrine_pedido_itens || []).reduce((a, b) => a + (b.quantidade || 1), 0);

              return (
                <div
                  key={pedido.id}
                  style={{
                    border: `1px solid ${aberto ? COLORS.accent : COLORS.borderLight}`,
                    borderRadius: 14,
                    marginBottom: 10,
                    overflow: 'hidden',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {/* Cabeçalho do pedido */}
                  <button
                    onClick={() => setPedidoAberto(aberto ? null : pedido.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      background: aberto ? `${COLORS.accent}08` : COLORS.white,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: FONTS.body,
                      textAlign: 'left',
                      gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: 4, flexWrap: 'wrap',
                      }}>
                        <span style={{
                          fontSize: 13, fontWeight: 600, color: COLORS.primaryDark,
                        }}>
                          Pedido #{pedido.id}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          background: st.bg, color: st.color,
                          padding: '2px 8px', borderRadius: 20,
                        }}>
                          {st.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                        {fmtData(pedido.created_at)} · {totalItens} {totalItens === 1 ? 'livro' : 'livros'}
                        {pedido.data_divulgacao && ` · Divulgação: ${fmtData(pedido.data_divulgacao)}`}
                      </div>
                    </div>
                    <ChevronRight
                      size={16}
                      color={COLORS.textMuted}
                      style={{
                        flexShrink: 0,
                        transform: aberto ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </button>

                  {/* Itens do pedido (expansível) */}
                  {aberto && (
                    <div style={{
                      borderTop: `1px solid ${COLORS.borderLight}`,
                      padding: '12px 16px',
                      background: COLORS.bg,
                    }}>
                      {(pedido.vitrine_pedido_itens || []).length === 0 ? (
                        <p style={{ fontSize: 13, color: COLORS.textMuted, margin: 0 }}>
                          Sem itens registrados.
                        </p>
                      ) : (
                        (pedido.vitrine_pedido_itens || []).map((item, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 0',
                              borderBottom: i < pedido.vitrine_pedido_itens.length - 1
                                ? `1px solid ${COLORS.borderLight}`
                                : 'none',
                              fontSize: 13,
                            }}
                          >
                            <span style={{
                              color: COLORS.text,
                              flex: 1,
                              paddingRight: 12,
                              lineHeight: 1.4,
                            }}>
                              {item.titulo_livro || 'Livro'}
                            </span>
                            <span style={{
                              color: COLORS.textMuted,
                              fontWeight: 600,
                              flexShrink: 0,
                            }}>
                              × {item.quantidade || 1}
                            </span>
                          </div>
                        ))
                      )}
                      {pedido.observacoes && (
                        <p style={{
                          fontSize: 12,
                          color: COLORS.textMuted,
                          margin: '10px 0 0',
                          fontStyle: 'italic',
                          lineHeight: 1.5,
                        }}>
                          Obs: {pedido.observacoes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================
   COMPONENTE PRINCIPAL
   ============================================ */
export default function VitrinePublica() {
  // ── Auth ──
  const [parceiro, setParceiro] = useState(null);

  // ── Vitrine ──
  const _urlParams = new URLSearchParams(window.location.search);
  const _editoraUrl = _urlParams.get('editora') || '';
  const editoraLocked = !!_editoraUrl; // quando veio da URL, bloqueia filtro

  const [livros, setLivros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [editoraFiltro, setEditoraFiltro] = useState(_editoraUrl);
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [showFiltros, setShowFiltros] = useState(false);
  const [selecionados, setSelecionados] = useState({});
  const [showCarrinho, setShowCarrinho] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [livroDetalhe, setLivroDetalhe] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [form, setForm] = useState({
    cpf: '', telefone: '', cep: '', endereco: '', dataDivulgacao: '', obs: '',
  });

  // ── Google Fonts ──
  useEffect(() => {
    if (!document.getElementById('vitrine-fonts')) {
      const link = document.createElement('link');
      link.id = 'vitrine-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // ── Carregar livros ──
  useEffect(() => {
    if (parceiro) carregarLivros();
  }, [parceiro]);

  async function carregarLivros() {
    setLoading(true);
    const { data, error } = await supabase
      .from('vitrine_livros')
      .select('*')
      .eq('ativo', true)
      .order('destaque', { ascending: false })
      .order('data_lancamento', { ascending: false, nullsFirst: false })
      .order('titulo', { ascending: true });

    if (!error && data) setLivros(data);
    setLoading(false);
  }

  // ── Pré-preencher dados do último pedido ──
  async function preencherUltimoPedido(parceiroData) {
    const cpfNorm = normalizeCpf(parceiroData.cpf);
    const { data } = await supabase
      .from('vitrine_pedidos')
      .select('contato, cep, endereco, cpf')
      .or(`cpf.eq.${parceiroData.cpf},cpf.eq.${cpfNorm},email.ilike.${parceiroData.email}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    setForm(prev => ({
      ...prev,
      cpf: data?.cpf || parceiroData.cpf || '',
      telefone: data?.contato || '',
      cep: data?.cep || '',
      endereco: data?.endereco || '',
    }));
  }

  function handleLogin(parceiroData) {
    setParceiro(parceiroData);
    preencherUltimoPedido(parceiroData);
  }

  // ── Filtros ──
  const editoras = useMemo(() =>
    [...new Set(livros.map(l => l.editora).filter(Boolean))].sort(), [livros]);
  const categorias = useMemo(() =>
    [...new Set(livros.map(l => l.categoria).filter(Boolean))].sort(), [livros]);

  const livrosFiltrados = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + 14);

    return livros.filter(l => {
      if (l.data_lancamento) {
        const dataLanc = new Date(l.data_lancamento);
        if (dataLanc > limite) return false;
      }
      const matchBusca = !busca ||
        l.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
        l.autor?.toLowerCase().includes(busca.toLowerCase());
      const matchEditora = !editoraFiltro || l.editora === editoraFiltro;
      const matchCategoria = !categoriaFiltro || l.categoria === categoriaFiltro;
      return matchBusca && matchEditora && matchCategoria;
    });
  }, [livros, busca, editoraFiltro, categoriaFiltro]);

  // ── Seleção ──
  const totalTitulos = Object.keys(selecionados).length;
  const totalSelecionados = Object.values(selecionados).reduce((a, b) => a + b, 0);
  const limite = limiteDoGrupo(parceiro?.grupo);

  function toggleSelecao(livro) {
    setSelecionados(prev => {
      if (prev[livro.id]) {
        const novo = { ...prev };
        delete novo[livro.id];
        return novo;
      }
      if (Object.keys(prev).length >= limite) return prev; // limite atingido
      return { ...prev, [livro.id]: 1 };
    });
  }

  function ajustarQtd(livroId, delta) {
    setSelecionados(prev => {
      const novo = { ...prev };
      const novaQtd = (novo[livroId] || 1) + delta;
      if (novaQtd <= 0) delete novo[livroId];
      else novo[livroId] = novaQtd;
      return novo;
    });
  }

  // ── Enviar pedido ──
  async function enviarPedido() {
    if (!form.cpf.trim() || !form.telefone.trim() || !form.dataDivulgacao) return;
    const cpfLimpo = normalizeCpf(form.cpf);
    setEnviando(true);

    try {
      const { data: pedido, error: errPedido } = await supabase
        .from('vitrine_pedidos')
        .insert({
          nome_parceiro: parceiro.nome,
          cpf: cpfLimpo,
          contato: form.telefone.trim(),
          tipo_contato: 'whatsapp',
          email: parceiro.email,
          cep: form.cep.trim() || null,
          endereco: form.endereco.trim() || null,
          data_divulgacao: form.dataDivulgacao,
          observacoes: form.obs.trim() || null,
        })
        .select()
        .single();

      if (errPedido) throw errPedido;

      const itens = Object.entries(selecionados).map(([livroId, qty]) => {
        const livro = livros.find(l => l.id === parseInt(livroId));
        return {
          pedido_id: pedido.id,
          livro_id: parseInt(livroId),
          titulo_livro: livro?.titulo || 'Título desconhecido',
          ean_livro: livro?.ean || null,
          quantidade: qty,
        };
      });

      const { error: errItens } = await supabase
        .from('vitrine_pedido_itens')
        .insert(itens);

      if (errItens) throw errItens;

      const livrosSelecionados = Object.keys(selecionados)
        .map(id => livros.find(l => l.id === parseInt(id))?.titulo || '')
        .filter(Boolean).join(', ');

      // Busca parceiro_id no CRM (parceiros) — primeiro pelo nome, depois pela livraria
      let parceiroCRMid = null;
      const { data: porNome } = await supabase
        .from('parceiros')
        .select('id')
        .ilike('nome', `%${parceiro.nome}%`)
        .limit(1)
        .maybeSingle();

      if (porNome) {
        parceiroCRMid = porNome.id;
      } else {
        const { data: porLivraria } = await supabase
          .from('parceiros')
          .select('id')
          .ilike('livraria', `%${parceiro.nome}%`)
          .limit(1)
          .maybeSingle();
        parceiroCRMid = porLivraria?.id || null;
      }

      // Só registra no monitoramento se encontrou o parceiro no CRM
      if (parceiroCRMid) {
        await supabase.from('monitoramento').insert({
          parceiro_id: parceiroCRMid,
          data: form.dataDivulgacao,
          status: 'pendente',
          tipo_postagem: null,
          observacao: `[Vitrine] Pedido #${pedido.id} — Livros: ${livrosSelecionados}`,
          origem: 'vitrine',
          origem_id: pedido.id,
        });
      } else {
        console.warn(`[Vitrine→Monitoramento] Parceiro "${parceiro.nome}" não encontrado no CRM. Registro não criado.`);
      }

      setEnviado(true);
      setSelecionados({});
      setForm(prev => ({ ...prev, dataDivulgacao: '', obs: '' }));
      setTimeout(() => {
        setEnviado(false);
        setShowForm(false);
        setShowCarrinho(false);
      }, 3500);
    } catch (err) {
      console.error('Erro ao enviar pedido:', err);
      alert('Erro ao enviar pedido. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  function limparFiltros() {
    setBusca('');
    if (!editoraLocked) setEditoraFiltro('');
    setCategoriaFiltro('');
  }

  const temFiltroAtivo = busca || (!editoraLocked && editoraFiltro) || categoriaFiltro;

  // ── Login ──
  if (!parceiro) return <TelaLogin onLogin={handleLogin} />;

  // ── Vitrine principal ──
  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bg,
      fontFamily: FONTS.body,
      color: COLORS.text,
    }}>

      {/* ─── HEADER ─── */}
      <header style={{
        background: COLORS.primaryDark,
        padding: '0',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 20px rgba(0,0,0,0.15)',
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div>
            <h1 style={{
              fontFamily: FONTS.display,
              fontSize: 'clamp(18px, 3vw, 24px)',
              fontWeight: 700,
              color: COLORS.white,
              margin: 0,
              letterSpacing: '0.5px',
            }}>
              Vitrine CEDET
            </h1>
            <p style={{
              color: COLORS.accentLight,
              fontSize: 12,
              margin: '3px 0 0',
              fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Olá, {parceiro.nome.split(' ')[0]}
              {parceiro.grupo && (
                <span style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 5, padding: '1px 6px',
                  fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
                }}>
                  Grupo {parceiro.grupo}
                  {limite < Infinity ? ` · ${totalTitulos}/${limite} livros` : ` · ${totalTitulos} livros`}
                </span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Histórico */}
            <button
              onClick={() => setShowHistorico(true)}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 10,
                padding: '9px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: COLORS.white,
                fontSize: 13,
                fontWeight: 500,
                fontFamily: FONTS.body,
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            >
              <History size={16} />
              <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Meus pedidos</span>
            </button>

            {/* Carrinho */}
            <button
              onClick={() => setShowCarrinho(true)}
              style={{
                position: 'relative',
                background: totalSelecionados > 0 ? COLORS.accent : 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: 10,
                padding: '9px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: COLORS.white,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: FONTS.body,
                transition: 'all 0.2s',
              }}
            >
              <ShoppingBag size={18} />
              {totalSelecionados > 0 && <span>{totalSelecionados}</span>}
            </button>

            {/* Sair */}
            <button
              onClick={() => setParceiro(null)}
              title="Sair"
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 10,
                padding: '9px 10px',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.6)',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = COLORS.white}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── BARRA DE BUSCA E FILTROS ─── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{
              position: 'absolute', left: 14, top: '50%',
              transform: 'translateY(-50%)', color: COLORS.textMuted,
            }} />
            <input
              type="text"
              placeholder="Buscar por título ou autor..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                border: `1.5px solid ${COLORS.border}`,
                borderRadius: 12,
                fontSize: 15,
                fontFamily: FONTS.body,
                background: COLORS.white,
                color: COLORS.text,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = COLORS.accent}
              onBlur={e => e.target.style.borderColor = COLORS.border}
            />
          </div>
          {!editoraLocked && <button
            onClick={() => setShowFiltros(!showFiltros)}
            style={{
              background: showFiltros || temFiltroAtivo ? COLORS.primary : COLORS.white,
              color: showFiltros || temFiltroAtivo ? COLORS.white : COLORS.text,
              border: `1.5px solid ${showFiltros || temFiltroAtivo ? COLORS.primary : COLORS.border}`,
              borderRadius: 12, padding: '12px 16px',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: 6, fontFamily: FONTS.body, fontWeight: 500,
              fontSize: 14, whiteSpace: 'nowrap',
            }}
          >
            <Filter size={16} /> Filtros
            {temFiltroAtivo && (
              <span style={{
                background: COLORS.accent, color: COLORS.white,
                borderRadius: '50%', width: 18, height: 18,
                fontSize: 11, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700,
              }}>
                {[busca, editoraFiltro, categoriaFiltro].filter(Boolean).length}
              </span>
            )}
          </button>}
        </div>

        {editoraLocked && (
          <div style={{
            background: `${COLORS.accent}12`, border: `1.5px solid ${COLORS.accent}40`,
            borderRadius: 10, padding: '8px 14px', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
            color: COLORS.accent, fontWeight: 600,
          }}>
            <Filter size={14} />
            Mostrando apenas livros de: <strong>{editoraFiltro}</strong>
          </div>
        )}

        {!editoraLocked && showFiltros && (
          <div style={{
            background: COLORS.white, border: `1.5px solid ${COLORS.border}`,
            borderRadius: 14, padding: 20, marginBottom: 12,
            display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
          }}>
            {!editoraLocked && (
              <div style={{ flex: '1 1 200px' }}>
                <label style={labelStyle}>Editora</label>
                <select value={editoraFiltro} onChange={e => setEditoraFiltro(e.target.value)} style={selectStyle}>
                  <option value="">Todas as editoras</option>
                  {editoras.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            )}
            {categorias.length > 0 && (
              <div style={{ flex: '1 1 200px' }}>
                <label style={labelStyle}>Categoria</label>
                <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)} style={selectStyle}>
                  <option value="">Todas as categorias</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {temFiltroAtivo && (
              <button onClick={limparFiltros} style={{
                background: 'none', border: `1.5px solid ${COLORS.border}`,
                borderRadius: 10, padding: '10px 16px', cursor: 'pointer',
                fontSize: 13, fontFamily: FONTS.body, color: COLORS.textLight,
                fontWeight: 500, whiteSpace: 'nowrap',
              }}>
                Limpar filtros
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 4px' }}>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: 0 }}>
            {loading ? 'Carregando...' : `${livrosFiltrados.length} livro${livrosFiltrados.length !== 1 ? 's' : ''} disponíve${livrosFiltrados.length !== 1 ? 'is' : 'l'}`}
          </p>
        </div>
      </div>

      {/* ─── GRID DE LIVROS ─── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 24px 100px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0', flexDirection: 'column', gap: 16 }}>
            <Loader2 size={32} color={COLORS.accent} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: COLORS.textMuted, fontSize: 15 }}>Carregando catálogo...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : livrosFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: COLORS.textMuted }}>
            <BookOpen size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
            <p style={{ fontSize: 16, fontWeight: 500 }}>Nenhum livro encontrado</p>
            <p style={{ fontSize: 14 }}>Tente ajustar os filtros de busca</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
            {livrosFiltrados.map(livro => (
              <LivroCard
                key={livro.id}
                livro={livro}
                selecionado={!!selecionados[livro.id]}
                limiteAtingido={!selecionados[livro.id] && totalTitulos >= limite}
                onToggle={() => toggleSelecao(livro)}
                onDetalhe={() => setLivroDetalhe(livro)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── BOTÃO FLUTUANTE ─── */}
      {totalSelecionados > 0 && !showCarrinho && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 90 }}>
          <button
            onClick={() => setShowCarrinho(true)}
            style={{
              background: COLORS.primary, color: COLORS.white,
              border: 'none', borderRadius: 16, padding: '14px 28px',
              fontSize: 15, fontWeight: 600, fontFamily: FONTS.body,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: 10, boxShadow: '0 6px 30px rgba(75, 52, 40, 0.35)',
            }}
          >
            <ShoppingBag size={18} />
            Ver seleção ({totalSelecionados} {totalSelecionados === 1 ? 'livro' : 'livros'})
            <Send size={16} />
          </button>
        </div>
      )}

      {/* ─── MODAL DETALHE ─── */}
      {livroDetalhe && (
        <ModalDetalhe
          livro={livroDetalhe}
          selecionado={!!selecionados[livroDetalhe.id]}
          onToggle={() => toggleSelecao(livroDetalhe)}
          onClose={() => setLivroDetalhe(null)}
        />
      )}

      {/* ─── PAINEL CARRINHO ─── */}
      {showCarrinho && (
        <PainelCarrinho
          livros={livros}
          selecionados={selecionados}
          limite={limite}
          onAjustarQtd={ajustarQtd}
          onRemover={(id) => ajustarQtd(id, -999)}
          showForm={showForm}
          setShowForm={setShowForm}
          form={form}
          setForm={setForm}
          enviando={enviando}
          enviado={enviado}
          onEnviar={enviarPedido}
          onClose={() => { setShowCarrinho(false); setShowForm(false); }}
          parceiro={parceiro}
        />
      )}

      {/* ─── PAINEL HISTÓRICO ─── */}
      {showHistorico && (
        <PainelHistorico
          parceiro={parceiro}
          onClose={() => setShowHistorico(false)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

/* ──────────────────────────────
   COMPONENTE: Card de Livro
   ────────────────────────────── */
function LivroCard({ livro, selecionado, limiteAtingido, onToggle, onDetalhe }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div style={{
      background: COLORS.card,
      borderRadius: 14,
      overflow: 'hidden',
      border: `2px solid ${selecionado ? COLORS.accent : COLORS.borderLight}`,
      transition: 'all 0.25s ease',
      cursor: 'pointer',
      position: 'relative',
      boxShadow: selecionado ? `0 4px 20px rgba(200, 149, 108, 0.25)` : '0 2px 8px rgba(0,0,0,0.04)',
    }}
      onMouseEnter={e => { if (!selecionado) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { if (!selecionado) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
    >
      {livro.destaque && (
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 2,
          background: COLORS.gold, color: COLORS.white,
          borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 3, letterSpacing: '0.3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <Star size={11} fill="white" /> DESTAQUE
        </div>
      )}

      {selecionado && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 2,
          background: COLORS.accent, borderRadius: '50%',
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          <Check size={16} color="white" strokeWidth={3} />
        </div>
      )}

      <div onClick={onDetalhe} style={{
        width: '100%', aspectRatio: '3/4',
        background: `linear-gradient(135deg, ${COLORS.borderLight}, ${COLORS.accentLight})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {livro.imagem_url && !imgError ? (
          <img src={livro.imagem_url} alt={livro.titulo} onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <BookOpen size={40} color={COLORS.textMuted} style={{ opacity: 0.3 }} />
        )}
      </div>

      <div style={{ padding: '12px 14px' }}>
        <p onClick={onDetalhe} style={{
          fontFamily: FONTS.display, fontSize: 14, fontWeight: 600,
          margin: '0 0 4px', lineHeight: 1.3, color: COLORS.text,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {livro.titulo}
        </p>
        <p style={{ fontSize: 12, color: COLORS.textLight, margin: '0 0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {livro.autor || 'Autor não informado'}
        </p>
        {livro.data_lancamento && (
          <p style={{ fontSize: 11, color: COLORS.textMuted, margin: '0 0 6px' }}>
            📅 {new Date(livro.data_lancamento).toLocaleDateString('pt-BR')}
          </p>
        )}
        {livro.ean && (
          <p style={{ fontSize: 10, color: COLORS.textMuted, margin: '0 0 6px', fontFamily: 'monospace' }}>
            ISBN: {livro.ean}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: COLORS.accent, fontWeight: 600, background: `${COLORS.accent}15`, padding: '2px 8px', borderRadius: 6 }}>
            {livro.editora}
          </span>
          {livro.preco && (
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.primaryDark }}>
              R$ {Number(livro.preco).toFixed(2).replace('.', ',')}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); if (!limiteAtingido) onToggle(); }}
        disabled={limiteAtingido && !selecionado}
        style={{
          width: '100%', padding: '10px', border: 'none',
          borderTop: `1px solid ${COLORS.borderLight}`,
          background: selecionado ? COLORS.accent : limiteAtingido ? COLORS.borderLight : COLORS.bg,
          color: selecionado ? COLORS.white : limiteAtingido ? COLORS.textMuted : COLORS.primary,
          fontSize: 13, fontWeight: 600, fontFamily: FONTS.body,
          cursor: (limiteAtingido && !selecionado) ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        {selecionado
          ? <><Check size={14} /> Selecionado</>
          : limiteAtingido
            ? 'Limite atingido'
            : <><Plus size={14} /> Selecionar</>
        }
      </button>
    </div>
  );
}

/* ──────────────────────────────
   COMPONENTE: Modal de Detalhe
   ────────────────────────────── */
function ModalDetalhe({ livro, selecionado, onToggle, onClose }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: COLORS.overlay,
      zIndex: 200, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: COLORS.white, borderRadius: 18, maxWidth: 600,
        width: '100%', maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          width: '100%', maxHeight: 350,
          background: `linear-gradient(135deg, ${COLORS.borderLight}, ${COLORS.accentLight})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', position: 'relative',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', color: 'white',
          }}>
            <X size={18} />
          </button>
          {livro.imagem_url && !imgError ? (
            <img src={livro.imagem_url} alt={livro.titulo} onError={() => setImgError(true)}
              style={{ maxWidth: '100%', maxHeight: 350, objectFit: 'contain' }} />
          ) : (
            <BookOpen size={60} color={COLORS.textMuted} style={{ opacity: 0.3 }} />
          )}
        </div>
        <div style={{ padding: '24px' }}>
          <h2 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: COLORS.primaryDark, lineHeight: 1.3 }}>
            {livro.titulo}
          </h2>
          <p style={{ fontSize: 15, color: COLORS.textLight, margin: '0 0 16px' }}>
            {livro.autor || 'Autor não informado'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            {livro.editora && <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent, background: `${COLORS.accent}15`, padding: '4px 12px', borderRadius: 8 }}>{livro.editora}</span>}
            {livro.encadernacao && <span style={{ fontSize: 12, color: COLORS.textLight, background: `${COLORS.textMuted}15`, padding: '4px 12px', borderRadius: 8 }}>{livro.encadernacao}</span>}
            {livro.preco && <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.primaryDark, background: `${COLORS.gold}20`, padding: '4px 12px', borderRadius: 8 }}>R$ {Number(livro.preco).toFixed(2).replace('.', ',')}</span>}
          </div>
          {livro.descricao && (
            <div style={{ fontSize: 14, lineHeight: 1.7, color: COLORS.textLight, borderTop: `1px solid ${COLORS.borderLight}`, paddingTop: 16, marginBottom: 20, maxHeight: 300, overflowY: 'auto' }}>
              {livro.descricao}
            </div>
          )}
          <button onClick={onToggle} style={{
            width: '100%', padding: '14px', border: 'none', borderRadius: 12,
            background: selecionado ? COLORS.textMuted : COLORS.primary,
            color: COLORS.white, fontSize: 15, fontWeight: 600, fontFamily: FONTS.body,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {selecionado ? <><X size={16} /> Remover da seleção</> : <><Plus size={16} /> Selecionar para divulgação</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────
   COMPONENTE: Painel Carrinho + Form
   ────────────────────────────── */
function PainelCarrinho({
  livros, selecionados, limite, onAjustarQtd, onRemover,
  showForm, setShowForm, form, setForm,
  enviando, enviado, onEnviar, onClose, parceiro,
}) {
  const itens = Object.entries(selecionados).map(([id, qty]) => ({
    livro: livros.find(l => l.id === parseInt(id)),
    qty, id: parseInt(id),
  })).filter(i => i.livro);

  const cpfValido = normalizeCpf(form.cpf).length === 11;
  const formValido = cpfValido && form.telefone.trim() && form.dataDivulgacao;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: COLORS.overlay, zIndex: 300,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: COLORS.white, width: '100%', maxWidth: 440,
        height: '100%', overflowY: 'auto', boxShadow: '-10px 0 40px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: `1px solid ${COLORS.borderLight}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: COLORS.bg, position: 'sticky', top: 0, zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {showForm && (
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: COLORS.text }}>
                <ArrowLeft size={20} />
              </button>
            )}
            <h2 style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 700, margin: 0, color: COLORS.primaryDark }}>
              {showForm ? 'Dados de envio' : 'Livros selecionados'}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: COLORS.textMuted }}>
            <X size={22} />
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {enviado ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: COLORS.success,
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              }}>
                <Check size={32} color="white" />
              </div>
              <h3 style={{ fontFamily: FONTS.display, fontSize: 22, color: COLORS.primaryDark, margin: '0 0 10px' }}>
                Pedido enviado!
              </h3>
              <p style={{ color: COLORS.textLight, fontSize: 15, lineHeight: 1.6 }}>
                Recebemos sua seleção de livros. Nossa equipe entrará em contato em breve.
              </p>
            </div>

          ) : showForm ? (
            /* ── Formulário simplificado (dados do parceiro já conhecidos) ── */
            <div>
              {/* Resumo do parceiro */}
              <div style={{
                background: `${COLORS.accent}10`,
                border: `1px solid ${COLORS.accent}30`,
                borderRadius: 12, padding: '12px 16px', marginBottom: 20,
                fontSize: 13,
              }}>
                <p style={{ margin: '0 0 2px', fontWeight: 600, color: COLORS.primaryDark }}>{parceiro.nome}</p>
                <p style={{ margin: 0, color: COLORS.textMuted }}>{parceiro.email}</p>
              </div>

              {/* CPF */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>CPF *</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={e => setForm({ ...form, cpf: formatarCpf(e.target.value) })}
                  style={{
                    ...inputStyle,
                    borderColor: form.cpf && !cpfValido ? COLORS.error : COLORS.border,
                  }}
                />
                {form.cpf && !cpfValido && (
                  <p style={{ fontSize: 11, color: COLORS.error, marginTop: 4 }}>
                    CPF inválido. Verifique os dígitos.
                  </p>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Telefone / WhatsApp *</label>
                <input
                  type="tel" placeholder="(11) 99999-9999"
                  value={form.telefone}
                  onChange={e => setForm({ ...form, telefone: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: '0 0 120px' }}>
                  <label style={labelStyle}>CEP</label>
                  <input type="text" placeholder="00000-000" value={form.cep}
                    onChange={e => setForm({ ...form, cep: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Endereço completo</label>
                  <input type="text" placeholder="Rua, número, bairro, cidade - UF"
                    value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Data prevista de divulgação *</label>
                <input type="date" value={form.dataDivulgacao}
                  onChange={e => setForm({ ...form, dataDivulgacao: e.target.value })} style={inputStyle} />
                <p style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                  Informe a data em que você pretende divulgar os livros selecionados.
                </p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Observações (opcional)</label>
                <textarea
                  placeholder="Alguma observação sobre os livros ou sobre a divulgação..."
                  value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })}
                  rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                />
              </div>
            </div>

          ) : (
            /* ── Lista de itens ── */
            <div>
              {itens.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: COLORS.textMuted }}>
                  <ShoppingBag size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p style={{ fontSize: 15 }}>Nenhum livro selecionado</p>
                  <p style={{ fontSize: 13 }}>Navegue pelo catálogo e selecione os livros que deseja divulgar</p>
                </div>
              ) : (
                itens.map(({ livro, qty, id }) => (
                  <div key={id} style={{
                    display: 'flex', gap: 12, padding: '14px 0',
                    borderBottom: `1px solid ${COLORS.borderLight}`, alignItems: 'center',
                  }}>
                    <div style={{ width: 50, height: 66, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: COLORS.borderLight }}>
                      {livro.imagem_url && <img src={livro.imagem_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {livro.titulo}
                      </p>
                      <p style={{ fontSize: 11, color: COLORS.textMuted, margin: 0 }}>{livro.editora}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                        <button onClick={() => onAjustarQtd(id, -1)} style={miniBtn}><Minus size={12} /></button>
                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{qty}</span>
                        <button onClick={() => onAjustarQtd(id, 1)} style={miniBtn}><Plus size={12} /></button>
                      </div>
                    </div>
                    <button onClick={() => onRemover(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: COLORS.textMuted }}>
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!enviado && itens.length > 0 && (
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${COLORS.borderLight}`, background: COLORS.bg }}>
            {showForm ? (
              <button
                onClick={onEnviar}
                disabled={enviando || !formValido}
                style={{
                  width: '100%', padding: '14px', border: 'none', borderRadius: 12,
                  background: (!formValido || enviando) ? COLORS.textMuted : COLORS.primary,
                  color: COLORS.white, fontSize: 15, fontWeight: 600, fontFamily: FONTS.body,
                  cursor: enviando ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: enviando ? 0.7 : 1,
                }}
              >
                {enviando
                  ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</>
                  : <><Send size={16} /> Enviar pedido ({itens.length} {itens.length === 1 ? 'livro' : 'livros'})</>
                }
              </button>
            ) : (
              <button onClick={() => setShowForm(true)} style={{
                width: '100%', padding: '14px', border: 'none', borderRadius: 12,
                background: COLORS.primary, color: COLORS.white,
                fontSize: 15, fontWeight: 600, fontFamily: FONTS.body, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                Continuar <Send size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Estilos reutilizáveis ── */
const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: COLORS.textLight, marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.5px',
};

const inputStyle = {
  width: '100%', padding: '12px 14px',
  border: `1.5px solid ${COLORS.border}`, borderRadius: 10,
  fontSize: 14, fontFamily: FONTS.body,
  background: COLORS.white, color: COLORS.text,
  outline: 'none', boxSizing: 'border-box',
};

const selectStyle = {
  width: '100%', padding: '10px 12px',
  border: `1.5px solid ${COLORS.border}`, borderRadius: 10,
  fontSize: 14, fontFamily: FONTS.body,
  background: COLORS.white, color: COLORS.text,
  cursor: 'pointer', boxSizing: 'border-box',
};

const miniBtn = {
  width: 26, height: 26, border: `1.5px solid ${COLORS.border}`,
  borderRadius: 6, background: COLORS.white, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: COLORS.text, padding: 0,
};
