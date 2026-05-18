import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import {
  Plus, Trash2, Edit2, Upload, Download, Search, Eye, EyeOff,
  Star, StarOff, Save, X, ChevronDown, Loader2, BookOpen,
  FileSpreadsheet, Check, AlertCircle, Package, ClipboardList
} from 'lucide-react';

/* ============================================
   VITRINE ADMIN — Gerenciamento de Livros
   Rota: /admin/vitrine (autenticado)
   ============================================ */

export default function VitrineAdmin() {
  const [tab, setTab] = useState('livros'); // 'livros' | 'pedidos'
  const [livros, setLivros] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [importando, setImportando] = useState(false);
  const [msgImport, setMsgImport] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);

    const [{ data: livrosData }, { data: pedidosData }] = await Promise.all([
      supabase
        .from('vitrine_livros')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('vitrine_pedidos')
        .select('*, vitrine_pedido_itens(*)')
        .order('created_at', { ascending: false }),
    ]);

    if (livrosData) setLivros(livrosData);
    if (pedidosData) setPedidos(pedidosData);
    setLoading(false);
  }

  // ── Filtro de livros ──
  const livrosFiltrados = useMemo(() => {
    if (!busca) return livros;
    const termo = busca.toLowerCase();
    return livros.filter(l =>
      l.titulo?.toLowerCase().includes(termo) ||
      l.autor?.toLowerCase().includes(termo) ||
      l.editora?.toLowerCase().includes(termo)
    );
  }, [livros, busca]);

  // ── Toggle ativo ──
  async function toggleAtivo(livro) {
    const { error } = await supabase
      .from('vitrine_livros')
      .update({ ativo: !livro.ativo })
      .eq('id', livro.id);
    if (!error) {
      setLivros(prev => prev.map(l => l.id === livro.id ? { ...l, ativo: !l.ativo } : l));
    }
  }

  // ── Toggle destaque ──
  async function toggleDestaque(livro) {
    const { error } = await supabase
      .from('vitrine_livros')
      .update({ destaque: !livro.destaque })
      .eq('id', livro.id);
    if (!error) {
      setLivros(prev => prev.map(l => l.id === livro.id ? { ...l, destaque: !l.destaque } : l));
    }
  }

  // ── Excluir livro ──
  async function excluirLivro(id) {
    if (!window.confirm('Tem certeza que deseja excluir este livro da vitrine?')) return;
    const { error } = await supabase.from('vitrine_livros').delete().eq('id', id);
    if (!error) {
      setLivros(prev => prev.filter(l => l.id !== id));
    }
  }

  // ── Importar planilha ──
  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    setMsgImport(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];

      // Detectar se cabeçalhos estão na linha 1 ou 2
      let rows = XLSX.utils.sheet_to_json(ws);
      if (rows.length > 0 && !rows[0]['Nome produto']) {
        rows = XLSX.utils.sheet_to_json(ws, { range: 1 });
      }

      // Mapear colunas da planilha CEDET
      const livrosParaInserir = rows
        .filter(r => r['Nome produto'])
        .map(r => ({
          produto_id: r['Id'] || null,
          titulo: r['Nome produto'],
          autor: r['Autor(es)'] || null,
          editora: r['Fabricante'] || null,
          preco: r['Preço de capa'] || null,
          descricao: r['Descrição'] || null,
          imagem_url: r['Link Imagem'] || null,
          ean: r['EAN'] ? String(r['EAN']) : null,
          encadernacao: r['Encadernação'] || null,
          data_lancamento: r['Data de lançamento'] || null,
          ativo: true,
          destaque: false,
        }));

      if (livrosParaInserir.length === 0) {
        setMsgImport({ tipo: 'erro', texto: 'Nenhum livro encontrado na planilha.' });
        setImportando(false);
        return;
      }

      // Inserir em lotes de 100
      let inseridos = 0;
      for (let i = 0; i < livrosParaInserir.length; i += 100) {
        const lote = livrosParaInserir.slice(i, i + 100);
        const { error } = await supabase.from('vitrine_livros').insert(lote);
        if (error) {
          console.error('Erro no lote:', error);
          setMsgImport({
            tipo: 'erro',
            texto: `Erro ao inserir lote ${Math.floor(i / 100) + 1}: ${error.message}`,
          });
          setImportando(false);
          return;
        }
        inseridos += lote.length;
      }

      setMsgImport({
        tipo: 'sucesso',
        texto: `${inseridos} livros importados com sucesso!`,
      });
      carregarDados();
    } catch (err) {
      console.error('Erro na importação:', err);
      setMsgImport({ tipo: 'erro', texto: `Erro: ${err.message}` });
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ── Atualizar status do pedido ──
  async function atualizarStatusPedido(pedidoId, novoStatus) {
    const { error } = await supabase
      .from('vitrine_pedidos')
      .update({ status: novoStatus })
      .eq('id', pedidoId);
    if (!error) {
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, status: novoStatus } : p));
    }
  }

  // ── Contadores ──
  const totalAtivos = livros.filter(l => l.ativo).length;
  const totalInativos = livros.filter(l => !l.ativo).length;
  const pedidosNovos = pedidos.filter(p => p.status === 'novo').length;

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px' }}>
            Vitrine de Livros
          </h1>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
            Gerencie o catálogo de livros disponíveis para parceiros
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 10,
            padding: '8px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{totalAtivos}</div>
            <div style={{ fontSize: 11, color: '#666' }}>Ativos</div>
          </div>
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: '8px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{totalInativos}</div>
            <div style={{ fontSize: 11, color: '#666' }}>Inativos</div>
          </div>
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 10,
            padding: '8px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#D4A005' }}>{pedidosNovos}</div>
            <div style={{ fontSize: 11, color: '#666' }}>Pedidos novos</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 20,
        borderBottom: '2px solid #e5e7eb',
      }}>
        {[
          { key: 'livros', label: 'Livros', icon: BookOpen },
          { key: 'pedidos', label: 'Pedidos', icon: ClipboardList, badge: pedidosNovos },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: tab === t.key ? '#3A3A3A' : '#888',
              borderBottom: tab === t.key ? '2px solid #3A3A3A' : '2px solid transparent',
              marginBottom: -2,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <t.icon size={16} />
            {t.label}
            {t.badge > 0 && (
              <span style={{
                background: '#dc2626',
                color: 'white',
                borderRadius: '50%',
                width: 20,
                height: 20,
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ ABA LIVROS ═══ */}
      {tab === 'livros' && (
        <>
          {/* Barra de ações */}
          <div style={{
            display: 'flex',
            gap: 10,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={16} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: '#999',
              }} />
              <input
                type="text"
                placeholder="Buscar livro..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  border: '1.5px solid #ddd',
                  borderRadius: 8,
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              onClick={() => { setEditando(null); setShowForm(true); }}
              style={btnPrimary}
            >
              <Plus size={16} /> Adicionar livro
            </button>
            <label style={{
              ...btnSecondary,
              cursor: importando ? 'wait' : 'pointer',
              opacity: importando ? 0.6 : 1,
            }}>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                disabled={importando}
                style={{ display: 'none' }}
              />
              {importando ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
              Importar planilha
            </label>
          </div>

          {/* Mensagem de importação */}
          {msgImport && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 8,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: msgImport.tipo === 'sucesso' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${msgImport.tipo === 'sucesso' ? '#bbf7d0' : '#fecaca'}`,
              color: msgImport.tipo === 'sucesso' ? '#16a34a' : '#dc2626',
              fontSize: 14,
            }}>
              {msgImport.tipo === 'sucesso' ? <Check size={16} /> : <AlertCircle size={16} />}
              {msgImport.texto}
              <button
                onClick={() => setMsgImport(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Tabela de livros */}
          {loading ? (
            <p style={{ textAlign: 'center', padding: 40, color: '#999' }}>Carregando...</p>
          ) : (
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              overflow: 'hidden',
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={th}>Capa</th>
                    <th style={{ ...th, textAlign: 'left' }}>Título / Autor</th>
                    <th style={th}>Editora</th>
                    <th style={th}>Preço</th>
                    <th style={th}>Status</th>
                    <th style={th}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {livrosFiltrados.map(livro => (
                    <tr key={livro.id} style={{
                      borderTop: '1px solid #f0f0f0',
                      opacity: livro.ativo ? 1 : 0.5,
                    }}>
                      <td style={{ ...td, width: 50 }}>
                        {livro.imagem_url ? (
                          <img
                            src={livro.imagem_url}
                            alt=""
                            style={{
                              width: 40,
                              height: 52,
                              objectFit: 'cover',
                              borderRadius: 4,
                            }}
                          />
                        ) : (
                          <div style={{
                            width: 40,
                            height: 52,
                            background: '#f0f0f0',
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <BookOpen size={14} color="#ccc" />
                          </div>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'left', maxWidth: 300 }}>
                        <div style={{
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 300,
                        }}>
                          {livro.destaque && <Star size={12} fill="#D4A005" color="#D4A005" style={{ marginRight: 4 }} />}
                          {livro.titulo}
                        </div>
                        <div style={{ fontSize: 12, color: '#888' }}>{livro.autor}</div>
                      </td>
                      <td style={td}>{livro.editora}</td>
                      <td style={td}>
                        {livro.preco ? `R$ ${Number(livro.preco).toFixed(2).replace('.', ',')}` : '—'}
                      </td>
                      <td style={td}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: livro.ativo ? '#f0fdf4' : '#f5f5f5',
                          color: livro.ativo ? '#16a34a' : '#999',
                        }}>
                          {livro.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => toggleAtivo(livro)}
                          title={livro.ativo ? 'Desativar' : 'Ativar'}
                          style={iconBtn}
                        >
                          {livro.ativo ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          onClick={() => toggleDestaque(livro)}
                          title={livro.destaque ? 'Remover destaque' : 'Destacar'}
                          style={iconBtn}
                        >
                          {livro.destaque ? <StarOff size={14} /> : <Star size={14} />}
                        </button>
                        <button
                          onClick={() => { setEditando(livro); setShowForm(true); }}
                          title="Editar"
                          style={iconBtn}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => excluirLivro(livro.id)}
                          title="Excluir"
                          style={{ ...iconBtn, color: '#dc2626' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {livrosFiltrados.length === 0 && (
                <p style={{ textAlign: 'center', padding: 30, color: '#999', fontSize: 14 }}>
                  Nenhum livro encontrado
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ ABA PEDIDOS ═══ */}
      {tab === 'pedidos' && (
        <>
          {pedidos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
              <Package size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 16, fontWeight: 500 }}>Nenhum pedido recebido ainda</p>
              <p style={{ fontSize: 14 }}>Quando parceiros selecionarem livros na vitrine, os pedidos aparecerão aqui.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pedidos.map(pedido => (
                <div
                  key={pedido.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    overflow: 'hidden',
                    borderLeft: `4px solid ${
                      pedido.status === 'novo' ? '#D4A005' :
                      pedido.status === 'visto' ? '#3b82f6' :
                      pedido.status === 'respondido' ? '#8b5cf6' :
                      '#16a34a'
                    }`,
                  }}
                >
                  {/* Header do pedido */}
                  <div style={{
                    padding: '16px 20px',
                    background: '#f9fafb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{pedido.nome_parceiro}</div>
                      <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                        {pedido.tipo_contato === 'whatsapp' ? '📱' : '✉️'} {pedido.contato}
                        <span style={{ marginLeft: 12, color: '#999' }}>
                          {new Date(pedido.created_at).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <select
                        value={pedido.status}
                        onChange={e => atualizarStatusPedido(pedido.id, e.target.value)}
                        style={{
                          padding: '6px 10px',
                          border: '1.5px solid #ddd',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <option value="novo">🟡 Novo</option>
                        <option value="visto">🔵 Visto</option>
                        <option value="respondido">🟣 Respondido</option>
                        <option value="concluido">🟢 Concluído</option>
                      </select>
                    </div>
                  </div>

                  {/* Itens do pedido */}
                  <div style={{ padding: '12px 20px' }}>
                    {pedido.observacoes && (
                      <p style={{
                        fontSize: 13,
                        color: '#666',
                        fontStyle: 'italic',
                        margin: '0 0 12px',
                        padding: '8px 12px',
                        background: '#fffbeb',
                        borderRadius: 6,
                      }}>
                        "{pedido.observacoes}"
                      </p>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(pedido.vitrine_pedido_itens || []).map(item => (
                        <span
                          key={item.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '5px 10px',
                            background: '#f0f0f0',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          <BookOpen size={12} />
                          {item.titulo_livro}
                          {item.quantidade > 1 && (
                            <span style={{
                              background: '#3A3A3A',
                              color: 'white',
                              borderRadius: 4,
                              padding: '1px 5px',
                              fontSize: 10,
                              fontWeight: 700,
                            }}>
                              ×{item.quantidade}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ MODAL FORM LIVRO ═══ */}
      {showForm && (
        <FormLivro
          livro={editando}
          onSalvar={async (dados) => {
            if (editando) {
              const { error } = await supabase
                .from('vitrine_livros')
                .update(dados)
                .eq('id', editando.id);
              if (!error) {
                setLivros(prev => prev.map(l => l.id === editando.id ? { ...l, ...dados } : l));
              }
            } else {
              const { data, error } = await supabase
                .from('vitrine_livros')
                .insert(dados)
                .select()
                .single();
              if (!error && data) {
                setLivros(prev => [data, ...prev]);
              }
            }
            setShowForm(false);
            setEditando(null);
          }}
          onCancelar={() => { setShowForm(false); setEditando(null); }}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────
   COMPONENTE: Formulário de Livro
   ────────────────────────────── */
function FormLivro({ livro, onSalvar, onCancelar }) {
  const [form, setForm] = useState({
    titulo: livro?.titulo || '',
    autor: livro?.autor || '',
    editora: livro?.editora || '',
    preco: livro?.preco || '',
    descricao: livro?.descricao || '',
    imagem_url: livro?.imagem_url || '',
    ean: livro?.ean || '',
    encadernacao: livro?.encadernacao || '',
    categoria: livro?.categoria || '',
    ativo: livro?.ativo ?? true,
    destaque: livro?.destaque ?? false,
  });

  function handleSubmit() {
    if (!form.titulo.trim()) return;
    onSalvar({
      ...form,
      preco: form.preco ? Number(form.preco) : null,
    });
  }

  return (
    <div
      onClick={onCancelar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 12,
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            {livro ? 'Editar livro' : 'Adicionar livro'}
          </h2>
          <button onClick={onCancelar} style={iconBtn}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Título *" value={form.titulo} onChange={v => setForm({ ...form, titulo: v })} />
          <Field label="Autor(es)" value={form.autor} onChange={v => setForm({ ...form, autor: v })} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Editora" value={form.editora} onChange={v => setForm({ ...form, editora: v })} />
            <Field label="Preço (R$)" value={form.preco} onChange={v => setForm({ ...form, preco: v })} type="number" />
          </div>
          <Field label="URL da imagem" value={form.imagem_url} onChange={v => setForm({ ...form, imagem_url: v })} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="EAN" value={form.ean} onChange={v => setForm({ ...form, ean: v })} />
            <Field label="Encadernação" value={form.encadernacao} onChange={v => setForm({ ...form, encadernacao: v })} />
          </div>
          <Field label="Categoria" value={form.categoria} onChange={v => setForm({ ...form, categoria: v })} placeholder="Ex: Infantil, Religioso, Formação..." />
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>
              Descrição
            </label>
            <textarea
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              rows={4}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1.5px solid #ddd',
                borderRadius: 8,
                fontSize: 14,
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={e => setForm({ ...form, ativo: e.target.checked })}
              />
              Ativo na vitrine
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.destaque}
                onChange={e => setForm({ ...form, destaque: e.target.checked })}
              />
              Destaque
            </label>
          </div>
        </div>

        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
        }}>
          <button onClick={onCancelar} style={btnSecondary}>Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!form.titulo.trim()}
            style={{
              ...btnPrimary,
              opacity: form.titulo.trim() ? 1 : 0.5,
            }}
          >
            <Save size={16} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1.5px solid #ddd',
          borderRadius: 8,
          fontSize: 14,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

/* ── Estilos ── */
const th = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#888', textAlign: 'center' };
const td = { padding: '10px 14px', textAlign: 'center', verticalAlign: 'middle' };
const iconBtn = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 6,
  borderRadius: 6,
  color: '#666',
  display: 'inline-flex',
  alignItems: 'center',
};
const btnPrimary = {
  background: '#3A3A3A',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
};
const btnSecondary = {
  background: 'white',
  color: '#555',
  border: '1.5px solid #ddd',
  borderRadius: 8,
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
};
