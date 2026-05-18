import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, ShoppingBag, X, ChevronDown, Send, Check,
  BookOpen, Filter, Minus, Plus, ArrowLeft, Loader2, Star
} from 'lucide-react';

/* ============================================
   VITRINE CEDET — Página Pública
   Rota: /vitrine (sem autenticação)
   ============================================ */

// ── Estilos inline (auto-contido, não depende de CSS externo) ──
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
  badge: '#F2B705',
  overlay: 'rgba(42, 42, 42, 0.55)',
  white: '#FFFFFF',
};

const FONTS = {
  display: "'Playfair Display', 'Georgia', serif",
  body: "'DM Sans', 'Helvetica Neue', sans-serif",
};

export default function VitrinePublica() {
  // ── State ──
  const [livros, setLivros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [editoraFiltro, setEditoraFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [showFiltros, setShowFiltros] = useState(false);
  const [soLancamentos, setSoLancamentos] = useState(false);
  const [selecionados, setSelecionados] = useState({}); // { livroId: qty }
  const [showCarrinho, setShowCarrinho] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [livroDetalhe, setLivroDetalhe] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [form, setForm] = useState({ nome: '', cpf: '', telefone: '', email: '', cep: '', endereco: '', dataDivulgacao: '', obs: '' });

  // ── Carregar livros ──
  useEffect(() => {
    carregarLivros();
  }, []);

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

  // ── Editoras e categorias únicas ──
  const editoras = useMemo(() =>
    [...new Set(livros.map(l => l.editora).filter(Boolean))].sort(),
    [livros]
  );
  const categorias = useMemo(() =>
    [...new Set(livros.map(l => l.categoria).filter(Boolean))].sort(),
    [livros]
  );

  // ── Filtro ──
  const livrosFiltrados = useMemo(() => {
    return livros.filter(l => {
      const matchBusca = !busca ||
        l.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
        l.autor?.toLowerCase().includes(busca.toLowerCase());
      const matchEditora = !editoraFiltro || l.editora === editoraFiltro;
      const matchCategoria = !categoriaFiltro || l.categoria === categoriaFiltro;
      const matchLancamento = !soLancamentos || (() => {
        if (!l.data_lancamento) return false;
        const dataLanc = new Date(l.data_lancamento);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const limite = new Date(hoje);
        limite.setDate(limite.getDate() + 14);
        return dataLanc >= hoje && dataLanc <= limite;
      })();
      return matchBusca && matchEditora && matchCategoria && matchLancamento;
    });
  }, [livros, busca, editoraFiltro, categoriaFiltro, soLancamentos]);

  // ── Seleção ──
  const totalSelecionados = Object.values(selecionados).reduce((a, b) => a + b, 0);

  function toggleSelecao(livro) {
    setSelecionados(prev => {
      const novo = { ...prev };
      if (novo[livro.id]) {
        delete novo[livro.id];
      } else {
        novo[livro.id] = 1;
      }
      return novo;
    });
  }

  function ajustarQtd(livroId, delta) {
    setSelecionados(prev => {
      const novo = { ...prev };
      const novaQtd = (novo[livroId] || 1) + delta;
      if (novaQtd <= 0) {
        delete novo[livroId];
      } else {
        novo[livroId] = novaQtd;
      }
      return novo;
    });
  }

  // ── Envio do pedido ──
  async function enviarPedido() {
    if (!form.nome.trim() || !form.email.trim() || !form.telefone.trim() || !form.cpf.trim() || !form.dataDivulgacao) return;
    setEnviando(true);

    try {
      // 1. Criar pedido
      const { data: pedido, error: errPedido } = await supabase
        .from('vitrine_pedidos')
        .insert({
          nome_parceiro: form.nome.trim(),
          cpf: form.cpf.trim(),
          contato: form.telefone.trim(),
          tipo_contato: 'whatsapp',
          email: form.email.trim(),
          cep: form.cep.trim() || null,
          endereco: form.endereco.trim() || null,
          data_divulgacao: form.dataDivulgacao,
          observacoes: form.obs.trim() || null,
        })
        .select()
        .single();

      if (errPedido) throw errPedido;

      // 2. Inserir itens
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

      // 3. Criar registro automático no Monitoramento
      const livrosSelecionados = Object.keys(selecionados).map(id => {
        const livro = livros.find(l => l.id === parseInt(id));
        return livro?.titulo || '';
      }).filter(Boolean).join(', ');

      await supabase.from('monitoramento').insert({
        parceiro_nome: form.nome.trim(),
        data: form.dataDivulgacao,
        status: 'pendente',
        tipo_postagem: null,
        observacao: `[Vitrine] Pedido #${pedido.id} — Livros: ${livrosSelecionados}`,
        origem: 'vitrine',
        origem_id: pedido.id,
      });

      setEnviado(true);
      setSelecionados({});
      setForm({ nome: '', cpf: '', telefone: '', email: '', cep: '', endereco: '', dataDivulgacao: '', obs: '' });

      setTimeout(() => {
        setEnviado(false);
        setShowForm(false);
        setShowCarrinho(false);
      }, 3000);
    } catch (err) {
      console.error('Erro ao enviar pedido:', err);
      alert('Erro ao enviar pedido. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  // ── Limpar filtros ──
  function limparFiltros() {
    setBusca('');
    setEditoraFiltro('');
    setCategoriaFiltro('');
    setSoLancamentos(false);
  }

  const temFiltroAtivo = busca || editoraFiltro || categoriaFiltro || soLancamentos;

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

  // ── Render ──
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
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
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
              letterSpacing: '0.3px',
            }}>
              Catálogo de livros para parceiros
            </p>
          </div>

          {/* Botão carrinho */}
          <button
            onClick={() => setShowCarrinho(true)}
            style={{
              position: 'relative',
              background: totalSelecionados > 0 ? COLORS.accent : 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 12,
              padding: '10px 16px',
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
            <ShoppingBag size={20} />
            {totalSelecionados > 0 && (
              <span>{totalSelecionados}</span>
            )}
          </button>
        </div>
      </header>

      {/* ─── BARRA DE BUSCA E FILTROS ─── */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '20px 24px 0',
      }}>
        {/* Busca */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginBottom: 12,
        }}>
          <div style={{
            flex: 1,
            position: 'relative',
          }}>
            <Search size={18} style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: COLORS.textMuted,
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
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = COLORS.accent}
              onBlur={e => e.target.style.borderColor = COLORS.border}
            />
          </div>
          <button
            onClick={() => setShowFiltros(!showFiltros)}
            style={{
              background: showFiltros || temFiltroAtivo ? COLORS.primary : COLORS.white,
              color: showFiltros || temFiltroAtivo ? COLORS.white : COLORS.text,
              border: `1.5px solid ${showFiltros || temFiltroAtivo ? COLORS.primary : COLORS.border}`,
              borderRadius: 12,
              padding: '12px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: FONTS.body,
              fontWeight: 500,
              fontSize: 14,
              whiteSpace: 'nowrap',
            }}
          >
            <Filter size={16} />
            Filtros
            {temFiltroAtivo && (
              <span style={{
                background: COLORS.accent,
                color: COLORS.white,
                borderRadius: '50%',
                width: 18,
                height: 18,
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
              }}>
                {[busca, editoraFiltro, categoriaFiltro].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Painel de filtros */}
        {showFiltros && (
          <div style={{
            background: COLORS.white,
            border: `1.5px solid ${COLORS.border}`,
            borderRadius: 14,
            padding: 20,
            marginBottom: 12,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'flex-end',
          }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.textLight,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>Editora</label>
              <select
                value={editoraFiltro}
                onChange={e => setEditoraFiltro(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1.5px solid ${COLORS.border}`,
                  borderRadius: 10,
                  fontSize: 14,
                  fontFamily: FONTS.body,
                  background: COLORS.white,
                  color: COLORS.text,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Todas as editoras</option>
                {editoras.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>

            {categorias.length > 0 && (
              <div style={{ flex: '1 1 200px' }}>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: COLORS.textLight,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>Categoria</label>
                <select
                  value={categoriaFiltro}
                  onChange={e => setCategoriaFiltro(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1.5px solid ${COLORS.border}`,
                    borderRadius: 10,
                    fontSize: 14,
                    fontFamily: FONTS.body,
                    background: COLORS.white,
                    color: COLORS.text,
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">Todas as categorias</option>
                  {categorias.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setSoLancamentos(!soLancamentos)}
              style={{
                flex: '0 0 auto',
                padding: '10px 16px',
                border: `1.5px solid ${soLancamentos ? COLORS.accent : COLORS.border}`,
                borderRadius: 10,
                background: soLancamentos ? `${COLORS.accent}15` : COLORS.white,
                color: soLancamentos ? COLORS.accent : COLORS.textLight,
                fontSize: 13,
                fontFamily: FONTS.body,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              🆕 Próximos lançamentos
            </button>

            {temFiltroAtivo && (
              <button
                onClick={limparFiltros}
                style={{
                  background: 'none',
                  border: `1.5px solid ${COLORS.border}`,
                  borderRadius: 10,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: FONTS.body,
                  color: COLORS.textLight,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* Contagem de resultados */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0 4px',
        }}>
          <p style={{
            fontSize: 13,
            color: COLORS.textMuted,
            margin: 0,
          }}>
            {loading ? 'Carregando...' : `${livrosFiltrados.length} livro${livrosFiltrados.length !== 1 ? 's' : ''} disponíve${livrosFiltrados.length !== 1 ? 'is' : 'l'}`}
          </p>
        </div>
      </div>

      {/* ─── GRID DE LIVROS ─── */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '12px 24px 100px',
      }}>
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '80px 0',
            flexDirection: 'column',
            gap: 16,
          }}>
            <Loader2 size={32} color={COLORS.accent} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: COLORS.textMuted, fontSize: 15 }}>Carregando catálogo...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : livrosFiltrados.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: COLORS.textMuted,
          }}>
            <BookOpen size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
            <p style={{ fontSize: 16, fontWeight: 500 }}>Nenhum livro encontrado</p>
            <p style={{ fontSize: 14 }}>Tente ajustar os filtros de busca</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 20,
          }}>
            {livrosFiltrados.map(livro => (
              <LivroCard
                key={livro.id}
                livro={livro}
                selecionado={!!selecionados[livro.id]}
                onToggle={() => toggleSelecao(livro)}
                onDetalhe={() => setLivroDetalhe(livro)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── BOTÃO FLUTUANTE ENVIAR ─── */}
      {totalSelecionados > 0 && !showCarrinho && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 90,
        }}>
          <button
            onClick={() => setShowCarrinho(true)}
            style={{
              background: COLORS.primary,
              color: COLORS.white,
              border: 'none',
              borderRadius: 16,
              padding: '14px 28px',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: FONTS.body,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 6px 30px rgba(75, 52, 40, 0.35)',
            }}
          >
            <ShoppingBag size={18} />
            Ver seleção ({totalSelecionados} {totalSelecionados === 1 ? 'livro' : 'livros'})
            <Send size={16} />
          </button>
        </div>
      )}

      {/* ─── MODAL DETALHE DO LIVRO ─── */}
      {livroDetalhe && (
        <ModalDetalhe
          livro={livroDetalhe}
          selecionado={!!selecionados[livroDetalhe.id]}
          onToggle={() => toggleSelecao(livroDetalhe)}
          onClose={() => setLivroDetalhe(null)}
        />
      )}

      {/* ─── PAINEL LATERAL: CARRINHO / FORMULÁRIO ─── */}
      {showCarrinho && (
        <PainelCarrinho
          livros={livros}
          selecionados={selecionados}
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
        />
      )}
    </div>
  );
}

/* ──────────────────────────────
   COMPONENTE: Card de Livro
   ────────────────────────────── */
function LivroCard({ livro, selecionado, onToggle, onDetalhe }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      style={{
        background: COLORS.card,
        borderRadius: 14,
        overflow: 'hidden',
        border: `2px solid ${selecionado ? COLORS.accent : COLORS.borderLight}`,
        transition: 'all 0.25s ease',
        cursor: 'pointer',
        position: 'relative',
        boxShadow: selecionado
          ? `0 4px 20px rgba(200, 149, 108, 0.25)`
          : '0 2px 8px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => {
        if (!selecionado) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={e => {
        if (!selecionado) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
      }}
    >
      {/* Badge destaque */}
      {livro.destaque && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 2,
          background: COLORS.gold,
          color: COLORS.white,
          borderRadius: 8,
          padding: '3px 8px',
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          letterSpacing: '0.3px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <Star size={11} fill="white" /> DESTAQUE
        </div>
      )}

      {/* Check de seleção */}
      {selecionado && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 2,
          background: COLORS.accent,
          borderRadius: '50%',
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          <Check size={16} color="white" strokeWidth={3} />
        </div>
      )}

      {/* Imagem da capa */}
      <div
        onClick={onDetalhe}
        style={{
          width: '100%',
          aspectRatio: '3/4',
          background: `linear-gradient(135deg, ${COLORS.borderLight}, ${COLORS.accentLight})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {livro.imagem_url && !imgError ? (
          <img
            src={livro.imagem_url}
            alt={livro.titulo}
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <BookOpen size={40} color={COLORS.textMuted} style={{ opacity: 0.3 }} />
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px' }}>
        <p
          onClick={onDetalhe}
          style={{
            fontFamily: FONTS.display,
            fontSize: 14,
            fontWeight: 600,
            margin: '0 0 4px',
            lineHeight: 1.3,
            color: COLORS.text,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {livro.titulo}
        </p>
        <p style={{
          fontSize: 12,
          color: COLORS.textLight,
          margin: '0 0 6px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {livro.autor || 'Autor não informado'}
        </p>
        {livro.data_lancamento && (
          <p style={{
            fontSize: 11,
            color: COLORS.textMuted,
            margin: '0 0 6px',
          }}>
            📅 {new Date(livro.data_lancamento).toLocaleDateString('pt-BR')}
          </p>
        )}
        {livro.ean && (
          <p style={{
            fontSize: 10,
            color: COLORS.textMuted,
            margin: '0 0 6px',
            fontFamily: 'monospace',
          }}>
            ISBN: {livro.ean}
          </p>
        )}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: 11,
            color: COLORS.accent,
            fontWeight: 600,
            background: `${COLORS.accent}15`,
            padding: '2px 8px',
            borderRadius: 6,
          }}>
            {livro.editora}
          </span>
          {livro.preco && (
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.primaryDark,
            }}>
              R$ {Number(livro.preco).toFixed(2).replace('.', ',')}
            </span>
          )}
        </div>
      </div>

      {/* Botão selecionar */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        style={{
          width: '100%',
          padding: '10px',
          border: 'none',
          borderTop: `1px solid ${COLORS.borderLight}`,
          background: selecionado ? COLORS.accent : COLORS.bg,
          color: selecionado ? COLORS.white : COLORS.primary,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: FONTS.body,
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {selecionado ? (
          <><Check size={14} /> Selecionado</>
        ) : (
          <><Plus size={14} /> Selecionar</>
        )}
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
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.overlay,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: COLORS.white,
          borderRadius: 18,
          maxWidth: 600,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Imagem grande */}
        <div style={{
          width: '100%',
          maxHeight: 350,
          background: `linear-gradient(135deg, ${COLORS.borderLight}, ${COLORS.accentLight})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(0,0,0,0.5)',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
            }}
          >
            <X size={18} />
          </button>
          {livro.imagem_url && !imgError ? (
            <img
              src={livro.imagem_url}
              alt={livro.titulo}
              onError={() => setImgError(true)}
              style={{ maxWidth: '100%', maxHeight: 350, objectFit: 'contain' }}
            />
          ) : (
            <BookOpen size={60} color={COLORS.textMuted} style={{ opacity: 0.3 }} />
          )}
        </div>

        {/* Conteúdo */}
        <div style={{ padding: '24px' }}>
          <h2 style={{
            fontFamily: FONTS.display,
            fontSize: 22,
            fontWeight: 700,
            margin: '0 0 8px',
            color: COLORS.primaryDark,
            lineHeight: 1.3,
          }}>
            {livro.titulo}
          </h2>

          <p style={{
            fontSize: 15,
            color: COLORS.textLight,
            margin: '0 0 16px',
          }}>
            {livro.autor || 'Autor não informado'}
          </p>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 20,
          }}>
            {livro.editora && (
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.accent,
                background: `${COLORS.accent}15`,
                padding: '4px 12px',
                borderRadius: 8,
              }}>
                {livro.editora}
              </span>
            )}
            {livro.encadernacao && (
              <span style={{
                fontSize: 12,
                color: COLORS.textLight,
                background: `${COLORS.textMuted}15`,
                padding: '4px 12px',
                borderRadius: 8,
              }}>
                {livro.encadernacao}
              </span>
            )}
            {livro.preco && (
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                color: COLORS.primaryDark,
                background: `${COLORS.gold}20`,
                padding: '4px 12px',
                borderRadius: 8,
              }}>
                R$ {Number(livro.preco).toFixed(2).replace('.', ',')}
              </span>
            )}
          </div>

          {livro.descricao && (
            <div style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: COLORS.textLight,
              borderTop: `1px solid ${COLORS.borderLight}`,
              paddingTop: 16,
              marginBottom: 20,
              maxHeight: 300,
              overflowY: 'auto',
            }}>
              {livro.descricao}
            </div>
          )}

          <button
            onClick={onToggle}
            style={{
              width: '100%',
              padding: '14px',
              border: 'none',
              borderRadius: 12,
              background: selecionado ? COLORS.textMuted : COLORS.primary,
              color: COLORS.white,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: FONTS.body,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {selecionado ? (
              <><X size={16} /> Remover da seleção</>
            ) : (
              <><Plus size={16} /> Selecionar para divulgação</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────
   COMPONENTE: Painel Lateral (Carrinho + Form)
   ────────────────────────────── */
function PainelCarrinho({
  livros, selecionados, onAjustarQtd, onRemover,
  showForm, setShowForm, form, setForm,
  enviando, enviado, onEnviar, onClose
}) {
  const itens = Object.entries(selecionados).map(([id, qty]) => ({
    livro: livros.find(l => l.id === parseInt(id)),
    qty,
    id: parseInt(id),
  })).filter(i => i.livro);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
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
          maxWidth: 440,
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
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {showForm && (
              <button
                onClick={() => setShowForm(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: COLORS.text,
                }}
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h2 style={{
              fontFamily: FONTS.display,
              fontSize: 20,
              fontWeight: 700,
              margin: 0,
              color: COLORS.primaryDark,
            }}>
              {showForm ? 'Seus dados' : 'Livros selecionados'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: COLORS.textMuted,
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {enviado ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: COLORS.success,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <Check size={32} color="white" />
              </div>
              <h3 style={{
                fontFamily: FONTS.display,
                fontSize: 22,
                color: COLORS.primaryDark,
                margin: '0 0 10px',
              }}>
                Pedido enviado!
              </h3>
              <p style={{
                color: COLORS.textLight,
                fontSize: 15,
                lineHeight: 1.6,
              }}>
                Recebemos sua seleção de livros. Nossa equipe entrará em contato em breve.
              </p>
            </div>
          ) : showForm ? (
            /* ── Formulário ── */
            <div>
              <p style={{
                fontSize: 14,
                color: COLORS.textLight,
                marginBottom: 20,
                lineHeight: 1.5,
              }}>
                Preencha seus dados para que possamos enviar os livros selecionados.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Nome completo *</label>
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>CPF *</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={e => setForm({ ...form, cpf: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Telefone *</label>
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={form.telefone}
                    onChange={e => setForm({ ...form, telefone: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>E-mail *</label>
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: '0 0 120px' }}>
                  <label style={labelStyle}>CEP *</label>
                  <input
                    type="text"
                    placeholder="00000-000"
                    value={form.cep}
                    onChange={e => setForm({ ...form, cep: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Endereço completo *</label>
                  <input
                    type="text"
                    placeholder="Rua, número, complemento, bairro, cidade - UF"
                    value={form.endereco}
                    onChange={e => setForm({ ...form, endereco: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Data prevista de divulgação *</label>
                <input
                  type="date"
                  value={form.dataDivulgacao}
                  onChange={e => setForm({ ...form, dataDivulgacao: e.target.value })}
                  style={inputStyle}
                />
                <p style={{
                  fontSize: 11,
                  color: COLORS.textMuted,
                  marginTop: 4,
                  margin: '4px 0 0',
                }}>
                  Informe a data em que você pretende divulgar os livros selecionados.
                </p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Observações (opcional)</label>
                <textarea
                  placeholder="Alguma observação sobre os livros ou sobre a divulgação..."
                  value={form.obs}
                  onChange={e => setForm({ ...form, obs: e.target.value })}
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    minHeight: 80,
                  }}
                />
              </div>
            </div>
          ) : (
            /* ── Lista de itens ── */
            <div>
              {itens.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: COLORS.textMuted,
                }}>
                  <ShoppingBag size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p style={{ fontSize: 15 }}>Nenhum livro selecionado</p>
                  <p style={{ fontSize: 13 }}>Navegue pelo catálogo e selecione os livros que deseja divulgar</p>
                </div>
              ) : (
                itens.map(({ livro, qty, id }) => (
                  <div
                    key={id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '14px 0',
                      borderBottom: `1px solid ${COLORS.borderLight}`,
                      alignItems: 'center',
                    }}
                  >
                    {/* Mini capa */}
                    <div style={{
                      width: 50,
                      height: 66,
                      borderRadius: 6,
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: COLORS.borderLight,
                    }}>
                      {livro.imagem_url && (
                        <img
                          src={livro.imagem_url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13,
                        fontWeight: 600,
                        margin: '0 0 2px',
                        lineHeight: 1.3,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {livro.titulo}
                      </p>
                      <p style={{
                        fontSize: 11,
                        color: COLORS.textMuted,
                        margin: 0,
                      }}>
                        {livro.editora}
                      </p>

                      {/* Quantidade */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 6,
                      }}>
                        <button
                          onClick={() => onAjustarQtd(id, -1)}
                          style={miniBtn}
                        >
                          <Minus size={12} />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>
                          {qty}
                        </span>
                        <button
                          onClick={() => onAjustarQtd(id, 1)}
                          style={miniBtn}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Remover */}
                    <button
                      onClick={() => onRemover(id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        color: COLORS.textMuted,
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer com botão */}
        {!enviado && itens.length > 0 && (
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${COLORS.borderLight}`,
            background: COLORS.bg,
          }}>
            {showForm ? (
              <button
                onClick={onEnviar}
                disabled={enviando || !form.nome.trim() || !form.email.trim() || !form.telefone.trim() || !form.cpf.trim() || !form.cep.trim() || !form.endereco.trim() || !form.dataDivulgacao}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: 'none',
                  borderRadius: 12,
                  background: (!form.nome.trim() || !form.email.trim() || !form.telefone.trim() || !form.cpf.trim() || !form.cep.trim() || !form.endereco.trim() || !form.dataDivulgacao)
                    ? COLORS.textMuted
                    : COLORS.primary,
                  color: COLORS.white,
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: FONTS.body,
                  cursor: enviando ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: enviando ? 0.7 : 1,
                }}
              >
                {enviando ? (
                  <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</>
                ) : (
                  <><Send size={16} /> Enviar pedido ({itens.length} {itens.length === 1 ? 'livro' : 'livros'})</>
                )}
              </button>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                style={{
                  width: '100%',
                  padding: '14px',
                  border: 'none',
                  borderRadius: 12,
                  background: COLORS.primary,
                  color: COLORS.white,
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: FONTS.body,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                Continuar
                <Send size={16} />
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
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: COLORS.textLight,
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: `1.5px solid ${COLORS.border}`,
  borderRadius: 10,
  fontSize: 14,
  fontFamily: FONTS.body,
  background: COLORS.white,
  color: COLORS.text,
  outline: 'none',
  boxSizing: 'border-box',
};

const miniBtn = {
  width: 26,
  height: 26,
  border: `1.5px solid ${COLORS.border}`,
  borderRadius: 6,
  background: COLORS.white,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: COLORS.text,
  padding: 0,
};
