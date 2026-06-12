import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import {
  Plus, Trash2, Edit2, Upload, Download, Search, Eye, EyeOff,
  Star, StarOff, Save, X, ChevronDown, Loader2, BookOpen,
  FileSpreadsheet, Check, AlertCircle, Package, ClipboardList, Users, Link2
} from 'lucide-react';

/* ============================================
   VITRINE ADMIN — Gerenciamento de Livros
   Rota: /admin/vitrine (autenticado)
   ============================================ */

// ── Vincula EANs ao catálogo oficial (tabela livros) em lotes ──
async function mapearEansParaLivroIds(eans) {
  const unicos = [...new Set(eans.filter(Boolean).map(String))];
  const mapa = {};
  for (let i = 0; i < unicos.length; i += 200) {
    const lote = unicos.slice(i, i + 200);
    const { data } = await supabase
      .from('livros')
      .select('id, isbn')
      .in('isbn', lote);
    for (const l of (data || [])) mapa[l.isbn] = l.id;
  }
  return mapa;
}

export default function VitrineAdmin() {
  const [tab, setTab] = useState('livros'); // 'livros' | 'pedidos' | 'parceiros'
  const [livros, setLivros] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [parceiros, setParceiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [importando, setImportando] = useState(false);
  const [msgImport, setMsgImport] = useState(null);
  const [showFormParceiro, setShowFormParceiro] = useState(false);
  const [editandoParceiro, setEditandoParceiro] = useState(null);
  const [buscaParceiro, setBuscaParceiro] = useState('');
  const [subTabPedidos, setSubTabPedidos] = useState('andamento'); // 'andamento' | 'concluidos'
  const [buscaPedido, setBuscaPedido] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);

    const [{ data: livrosData }, { data: pedidosData }, { data: parceirosData }] = await Promise.all([
      supabase
        .from('vitrine_livros')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('vitrine_pedidos')
        .select('*, vitrine_pedido_itens(*)')
        .order('created_at', { ascending: false }),
      supabase
        .from('vitrine_parceiros')
        .select('*')
        .order('nome', { ascending: true }),
    ]);

    if (livrosData) setLivros(livrosData);
    if (pedidosData) setPedidos(pedidosData);
    if (parceirosData) setParceiros(parceirosData);
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
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
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
          data_lancamento: r['Data de lançamento'] instanceof Date
            ? r['Data de lançamento'].toISOString().split('T')[0]
            : r['Data de lançamento'] || null,
          ativo: true,
          destaque: false,
        }));

      if (livrosParaInserir.length === 0) {
        setMsgImport({ tipo: 'erro', texto: 'Nenhum livro encontrado na planilha.' });
        setImportando(false);
        return;
      }

      // ── Vínculo automático com o catálogo oficial (livros) pelo EAN/ISBN ──
      const mapaEan = await mapearEansParaLivroIds(livrosParaInserir.map(l => l.ean));
      let vinculados = 0;
      for (const l of livrosParaInserir) {
        l.livro_id = l.ean ? (mapaEan[l.ean] || null) : null;
        if (l.livro_id) vinculados++;
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
        texto: `${inseridos} livros importados! ${vinculados} vinculados automaticamente ao catálogo Órbita${inseridos - vinculados > 0 ? ` — ${inseridos - vinculados} sem correspondência de ISBN (vincule manualmente ao editar)` : ''}.`,
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

      if (novoStatus === 'concluido') {
        const pedido = pedidos.find(p => p.id === pedidoId);
        if (pedido) {
          const resultado = await criarEnvioCortesia(pedido);
          if (resultado.ok) {
            const aviso = resultado.livrosFaltando > 0
              ? `Envio criado nas cortesias (Envio #${resultado.envioId}). ⚠️ ${resultado.livrosFaltando} livro(s) não encontrado(s) no catálogo — verifique manualmente.`
              : `Envio criado nas cortesias (Envio #${resultado.envioId}).`;
            alert(aviso);
          } else {
            alert(`Pedido marcado como concluído, mas não foi possível criar o envio nas cortesias automaticamente.\n\n${resultado.msg}\n\nCrie o envio manualmente em Cortesias.`);
          }
        }
      }
    }
  }

  // ── Parceiros: salvar (criar ou editar) ──
  async function salvarParceiro(dados) {
    if (editandoParceiro) {
      const { error } = await supabase
        .from('vitrine_parceiros')
        .update(dados)
        .eq('id', editandoParceiro.id);
      if (!error) {
        setParceiros(prev => prev.map(p =>
          p.id === editandoParceiro.id ? { ...p, ...dados } : p
        ));
      }
    } else {
      const { data, error } = await supabase
        .from('vitrine_parceiros')
        .insert(dados)
        .select()
        .single();
      if (!error && data) {
        setParceiros(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      }
    }
    setShowFormParceiro(false);
    setEditandoParceiro(null);
  }

  // ── Concluir pedido → criar envio nas cortesias ──
  async function criarEnvioCortesia(pedido) {
    try {
      // 1. Buscar parceiro no CRM pelo nome (tenta nome exato, depois livraria)
      const nomeParceiro = (pedido.nome_parceiro || '').trim();

      let parceiroCRM = null;

      // Tenta pelo nome do parceiro
      const { data: porNome } = await supabase
        .from('parceiros')
        .select('id, nome, livraria')
        .ilike('nome', `%${nomeParceiro}%`)
        .limit(1)
        .maybeSingle();

      if (porNome) {
        parceiroCRM = porNome;
      } else {
        // Tenta pelo nome da livraria
        const { data: porLivraria } = await supabase
          .from('parceiros')
          .select('id, nome, livraria')
          .ilike('livraria', `%${nomeParceiro}%`)
          .limit(1)
          .maybeSingle();
        parceiroCRM = porLivraria;
      }

      if (!parceiroCRM) {
        return {
          ok: false,
          msg: `Parceiro "${nomeParceiro}" não encontrado no CRM.\n\nVerifique se o nome cadastrado na vitrine bate com o nome ou livraria no CRM.`,
        };
      }

      // 2. Resolver o livro do catálogo oficial de cada item:
      //    item.livro_id aponta para vitrine_livros (bigint, legado);
      //    o catálogo vem de vitrine_livros.livro_id (UUID),
      //    com fallback pelo EAN/ISBN para pedidos antigos.
      const itens = pedido.vitrine_pedido_itens || [];
      const livroIdsSet = new Set();
      const eansResolvidos = new Set();

      // 2a. Caminho principal: vitrine_pedido_itens.livro_id → vitrine_livros.livro_id
      const vitrineIds = itens.map(i => i.livro_id).filter(Boolean);
      if (vitrineIds.length > 0) {
        const { data: vls } = await supabase
          .from('vitrine_livros')
          .select('id, livro_id, ean')
          .in('id', vitrineIds);
        for (const v of (vls || [])) {
          if (v.livro_id) {
            livroIdsSet.add(v.livro_id);
            if (v.ean) eansResolvidos.add(String(v.ean));
          }
        }
      }

      // 2b. Fallback: itens não resolvidos, pelo EAN na vitrine e depois no catálogo
      const eansSemVinculo = itens
        .filter(i => i.ean_livro && !eansResolvidos.has(String(i.ean_livro)))
        .map(i => String(i.ean_livro));

      if (eansSemVinculo.length > 0) {
        const { data: vlivros } = await supabase
          .from('vitrine_livros')
          .select('ean, livro_id')
          .in('ean', eansSemVinculo)
          .not('livro_id', 'is', null);
        const resolvidos = new Set();
        for (const v of (vlivros || [])) {
          livroIdsSet.add(v.livro_id);
          resolvidos.add(String(v.ean));
        }
        const restantes = eansSemVinculo.filter(e => !resolvidos.has(e));
        if (restantes.length > 0) {
          const { data: livrosEncontrados } = await supabase
            .from('livros')
            .select('id, isbn')
            .in('isbn', restantes);
          for (const l of (livrosEncontrados || [])) livroIdsSet.add(l.id);
        }
      }

      const livroIds = [...livroIdsSet];

      // 3. Criar envio
      const { data: envio, error: errEnvio } = await supabase
        .from('envios')
        .insert({
          parceiro_id: parceiroCRM.id,
          status: 'enviado',
          data_envio: pedido.data_divulgacao || new Date().toISOString().slice(0, 10),
          observacoes: `[Vitrine] Pedido #${pedido.id} — ${itens.map(i => i.titulo_livro).join(', ')}`,
        })
        .select()
        .single();

      if (errEnvio) throw errEnvio;

      // 4. Vincular livros ao envio
      if (livroIds.length > 0) {
        await supabase.from('envio_livros').insert(
          livroIds.map(livro_id => ({ envio_id: envio.id, livro_id }))
        );
      }

      return { ok: true, envioId: envio.id, livrosFaltando: itens.length - livroIds.length < 0 ? 0 : itens.length - livroIds.length };
    } catch (err) {
      console.error('[Vitrine→Cortesia] Erro:', err);
      return { ok: false, msg: 'Erro ao criar envio nas cortesias.' };
    }
  }

  // ── Parceiros: toggle ativo ──
  async function toggleAtivoParceiro(parceiro) {
    const { error } = await supabase
      .from('vitrine_parceiros')
      .update({ ativo: !parceiro.ativo })
      .eq('id', parceiro.id);
    if (!error) {
      setParceiros(prev => prev.map(p =>
        p.id === parceiro.id ? { ...p, ativo: !p.ativo } : p
      ));
    }
  }

  // ── Parceiros: excluir ──
  async function excluirParceiro(id) {
    if (!window.confirm('Excluir este parceiro? O acesso dele à vitrine será removido.')) return;
    const { error } = await supabase.from('vitrine_parceiros').delete().eq('id', id);
    if (!error) setParceiros(prev => prev.filter(p => p.id !== id));
  }

  // ── Parceiros: filtro ──
  const parceirosFiltrados = parceiros.filter(p => {
    if (!buscaParceiro) return true;
    const t = buscaParceiro.toLowerCase();
    return p.nome?.toLowerCase().includes(t) || p.email?.toLowerCase().includes(t);
  });

  // ── Contadores ──
  const totalAtivos = livros.filter(l => l.ativo).length;
  const totalInativos = livros.filter(l => !l.ativo).length;
  const totalSemVinculo = livros.filter(l => !l.livro_id).length;
  const pedidosNovos = pedidos.filter(p => p.status === 'novo').length;
  const pedidosConcluidos = pedidos.filter(p => p.status === 'concluido');
  const pedidosAndamento = pedidos.filter(p => p.status !== 'concluido');
  const basePedidosSubTab = subTabPedidos === 'concluidos' ? pedidosConcluidos : pedidosAndamento;
  const pedidosFiltrados = basePedidosSubTab.filter(p =>
    !buscaPedido.trim() ||
    (p.nome_parceiro || '').toLowerCase().includes(buscaPedido.trim().toLowerCase())
  );
  const parceirosAtivos = parceiros.filter(p => p.ativo).length;

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
            background: '#f5f3ff',
            border: '1px solid #ddd6fe',
            borderRadius: 10,
            padding: '8px 16px',
            textAlign: 'center',
          }} title="Livros da vitrine sem vínculo com o catálogo Órbita">
            <div style={{ fontSize: 20, fontWeight: 700, color: '#7c3aed' }}>{totalSemVinculo}</div>
            <div style={{ fontSize: 11, color: '#666' }}>Sem vínculo</div>
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
          <div style={{
            background: '#eef2ff',
            border: '1px solid #c7d2fe',
            borderRadius: 10,
            padding: '8px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#4338ca' }}>{parceirosAtivos}</div>
            <div style={{ fontSize: 11, color: '#666' }}>Parceiros</div>
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
          { key: 'livros',     label: 'Livros',    icon: BookOpen },
          { key: 'pedidos',    label: 'Pedidos',   icon: ClipboardList, badge: pedidosNovos },
          { key: 'parceiros',  label: 'Parceiros', icon: Users },
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
                    <th style={th}>ISBN</th>
                    <th style={th}>Preço</th>
                    <th style={th}>Catálogo</th>
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
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{livro.ean || '—'}</td>
                      <td style={td}>
                        {livro.preco ? `R$ ${Number(livro.preco).toFixed(2).replace('.', ',')}` : '—'}
                      </td>
                      <td style={td}>
                        {livro.livro_id ? (
                          <span title="Vinculado ao catálogo Órbita" style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: '#f0fdf4', color: '#16a34a',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}>
                            <Link2 size={11} /> Vinculado
                          </span>
                        ) : (
                          <span title="Sem vínculo com o catálogo — edite para vincular" style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: '#f5f3ff', color: '#7c3aed',
                          }}>
                            Sem vínculo
                          </span>
                        )}
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
            <>
              {/* Sub-abas: Em andamento / Concluídos */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setSubTabPedidos('andamento')}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid', borderColor: subTabPedidos === 'andamento' ? '#F2B705' : 'rgba(255,255,255,0.12)',
                    background: subTabPedidos === 'andamento' ? 'rgba(242,183,5,0.12)' : 'transparent',
                    color: subTabPedidos === 'andamento' ? '#F2B705' : '#999',
                  }}
                >
                  Em andamento ({pedidosAndamento.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSubTabPedidos('concluidos')}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid', borderColor: subTabPedidos === 'concluidos' ? '#16a34a' : 'rgba(255,255,255,0.12)',
                    background: subTabPedidos === 'concluidos' ? 'rgba(22,163,74,0.12)' : 'transparent',
                    color: subTabPedidos === 'concluidos' ? '#16a34a' : '#999',
                  }}
                >
                  Concluídos ({pedidosConcluidos.length})
                </button>

                <div style={{ position: 'relative', marginLeft: 'auto', minWidth: 240 }}>
                  <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                  <input
                    type="text"
                    value={buscaPedido}
                    onChange={(e) => setBuscaPedido(e.target.value)}
                    placeholder="Buscar parceiro..."
                    style={{
                      width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8, fontSize: 14,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', outline: 'none',
                    }}
                  />
                </div>
              </div>

              {pedidosFiltrados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                  <p style={{ fontSize: 14 }}>
                    {buscaPedido.trim()
                      ? 'Nenhum pedido encontrado para esse parceiro nesta aba.'
                      : (subTabPedidos === 'concluidos' ? 'Nenhum pedido concluído ainda.' : 'Nenhum pedido em andamento.')}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {pedidosFiltrados.map(pedido => {
                const statusConfig = {
                  novo:       { color: '#F2B705', bg: 'rgba(242,183,5,0.12)', label: '🟡 Novo' },
                  visto:      { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', label: '🔵 Visto' },
                  respondido: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', label: '🟣 Respondido' },
                  concluido:  { color: '#16a34a', bg: 'rgba(22,163,74,0.12)', label: '🟢 Concluído' },
                };
                const sc = statusConfig[pedido.status] || statusConfig.novo;
                const itens = pedido.vitrine_pedido_itens || [];

                return (
                  <div
                    key={pedido.id}
                    style={{
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: `1px solid rgba(255,255,255,0.1)`,
                      background: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    {/* Header do pedido */}
                    <div style={{
                      padding: '18px 22px',
                      background: 'rgba(255,255,255,0.06)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {/* Avatar inicial */}
                        <div style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          background: sc.bg,
                          border: `2px solid ${sc.color}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          fontWeight: 700,
                          color: sc.color,
                          flexShrink: 0,
                        }}>
                          {(pedido.nome_parceiro || 'P')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>
                            {pedido.nome_parceiro}
                            {pedido.cpf && (
                              <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.5)', marginLeft: 10 }}>
                                CPF: {pedido.cpf}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                            {pedido.contato && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 13,
                                color: 'rgba(255,255,255,0.7)',
                                background: 'rgba(255,255,255,0.08)',
                                padding: '3px 10px',
                                borderRadius: 6,
                              }}>
                                📱 {pedido.contato}
                              </span>
                            )}
                            {pedido.email && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 13,
                                color: 'rgba(255,255,255,0.7)',
                                background: 'rgba(255,255,255,0.08)',
                                padding: '3px 10px',
                                borderRadius: 6,
                              }}>
                                ✉️ {pedido.email}
                              </span>
                            )}
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                              {new Date(pedido.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {(pedido.cep || pedido.endereco) && (
                            <div style={{
                              fontSize: 12,
                              color: 'rgba(255,255,255,0.5)',
                              marginTop: 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                            }}>
                              📍 {pedido.endereco}{pedido.cep ? ` — CEP: ${pedido.cep}` : ''}
                            </div>
                          )}
                          {pedido.data_divulgacao && (
                            <div style={{
                              fontSize: 12,
                              color: '#F2B705',
                              marginTop: 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              fontWeight: 600,
                            }}>
                              📅 Divulgação prevista: {new Date(pedido.data_divulgacao).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </div>
                      </div>

                      <select
                        value={pedido.status}
                        onChange={e => atualizarStatusPedido(pedido.id, e.target.value)}
                        style={{
                          padding: '8px 12px',
                          border: `1.5px solid ${sc.color}40`,
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: sc.bg,
                          color: sc.color,
                        }}
                      >
                        <option value="novo">🟡 Novo</option>
                        <option value="visto">🔵 Visto</option>
                        <option value="respondido">🟣 Respondido</option>
                        <option value="concluido">🟢 Concluído</option>
                      </select>
                    </div>

                    {/* Corpo do pedido */}
                    <div style={{ padding: '18px 22px' }}>
                      {/* Observações */}
                      {pedido.observacoes && (
                        <div style={{
                          fontSize: 13,
                          color: 'rgba(255,255,255,0.7)',
                          fontStyle: 'italic',
                          margin: '0 0 16px',
                          padding: '10px 14px',
                          background: 'rgba(242,183,5,0.08)',
                          borderRadius: 8,
                          borderLeft: '3px solid rgba(242,183,5,0.4)',
                          lineHeight: 1.5,
                        }}>
                          "{pedido.observacoes}"
                        </div>
                      )}

                      {/* Label */}
                      <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.4)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: 10,
                      }}>
                        📚 {itens.length} {itens.length === 1 ? 'livro selecionado' : 'livros selecionados'}
                      </div>

                      {/* Lista de livros em formato de lista legível */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {itens.map(item => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              background: 'rgba(255,255,255,0.06)',
                              borderRadius: 8,
                              border: '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                            }}>
                              <BookOpen size={14} style={{ color: '#F2B705', flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }} />
                              <div>
                                <span style={{
                                  fontSize: 14,
                                  fontWeight: 500,
                                  color: '#fff',
                                }}>
                                  {item.titulo_livro}
                                </span>
                                {item.ean_livro && (
                                  <div style={{
                                    fontSize: 11,
                                    color: 'rgba(255,255,255,0.4)',
                                    fontFamily: 'monospace',
                                    marginTop: 2,
                                  }}>
                                    ISBN: {item.ean_livro}
                                  </div>
                                )}
                              </div>
                            </div>
                            {item.quantidade > 1 && (
                              <span style={{
                                background: '#F2B705',
                                color: '#2A2A2A',
                                borderRadius: 6,
                                padding: '2px 8px',
                                fontSize: 12,
                                fontWeight: 700,
                                flexShrink: 0,
                                marginLeft: 10,
                              }}>
                                ×{item.quantidade}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ═══ ABA PARCEIROS ═══ */}
      {tab === 'parceiros' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={16} style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', color: '#999',
              }} />
              <input
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                value={buscaParceiro}
                onChange={e => setBuscaParceiro(e.target.value)}
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
              onClick={() => { setEditandoParceiro(null); setShowFormParceiro(true); }}
              style={btnPrimary}
            >
              <Plus size={16} /> Adicionar parceiro
            </button>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', padding: 40, color: '#999' }}>Carregando...</p>
          ) : parceirosFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa' }}>
              <Users size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontSize: 15, margin: '0 0 6px' }}>Nenhum parceiro encontrado</p>
              <p style={{ fontSize: 13 }}>
                {buscaParceiro ? 'Tente um termo diferente.' : 'Adicione o primeiro parceiro para liberar acesso à vitrine.'}
              </p>
            </div>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ ...th, textAlign: 'left' }}>Nome</th>
                    <th style={{ ...th, textAlign: 'left' }}>E-mail</th>
                    <th style={th}>Grupo</th>
                    <th style={th}>Cadastrado em</th>
                    <th style={th}>Acesso</th>
                    <th style={th}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {parceirosFiltrados.map(parceiro => (
                    <tr key={parceiro.id} style={{
                      borderTop: '1px solid #f0f0f0',
                      opacity: parceiro.ativo ? 1 : 0.5,
                    }}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>
                        {parceiro.nome}
                      </td>
                      <td style={{ ...td, textAlign: 'left', color: '#555', fontFamily: 'monospace', fontSize: 12 }}>
                        {parceiro.email || '—'}
                      </td>
                      <td style={td}>
                        {parceiro.grupo ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 10px', borderRadius: 20,
                            fontSize: 12, fontWeight: 700,
                            background: { A: '#dcfce7', B: '#dbeafe', C: '#fef9c3', D: '#f3f4f6' }[parceiro.grupo] || '#f3f4f6',
                            color:      { A: '#15803d', B: '#1d4ed8', C: '#854d0e', D: '#6b7280' }[parceiro.grupo] || '#6b7280',
                          }}>
                            {parceiro.grupo}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={td}>
                        {parceiro.created_at
                          ? new Date(parceiro.created_at).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td style={td}>
                        <button
                          onClick={() => toggleAtivoParceiro(parceiro)}
                          style={{
                            padding: '4px 12px',
                            borderRadius: 20,
                            border: 'none',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: parceiro.ativo ? '#dcfce7' : '#f3f4f6',
                            color: parceiro.ativo ? '#16a34a' : '#6b7280',
                          }}
                        >
                          {parceiro.ativo ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            onClick={() => { setEditandoParceiro(parceiro); setShowFormParceiro(true); }}
                            style={iconBtn}
                            title="Editar"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => excluirParceiro(parceiro.id)}
                            style={{ ...iconBtn, color: '#dc2626' }}
                            title="Excluir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {/* ═══ MODAL FORM PARCEIRO ═══ */}
      {showFormParceiro && (
        <FormParceiro
          parceiro={editandoParceiro}
          onSalvar={salvarParceiro}
          onCancelar={() => { setShowFormParceiro(false); setEditandoParceiro(null); }}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────
   COMPONENTE: Formulário de Parceiro
   ────────────────────────────── */
function FormParceiro({ parceiro, onSalvar, onCancelar }) {
  const [form, setForm] = useState({
    nome:  parceiro?.nome  || '',
    email: parceiro?.email || '',
    grupo: parceiro?.grupo || '',
    ativo: parceiro?.ativo ?? true,
  });
  const [erro, setErro] = useState('');

  function handleSubmit() {
    if (!form.nome.trim()) { setErro('O nome é obrigatório.'); return; }
    if (!form.email.trim()) { setErro('O e-mail é obrigatório.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setErro('Informe um e-mail válido.');
      return;
    }
    setErro('');
    onSalvar({ nome: form.nome.trim(), email: form.email.trim().toLowerCase(), grupo: form.grupo || null, ativo: form.ativo });
  }

  return (
    <div
      onClick={onCancelar}
      style={{
        position: 'fixed', inset: 0,
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
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
            {parceiro ? 'Editar parceiro' : 'Adicionar parceiro'}
          </h2>
          <button onClick={onCancelar} style={iconBtn}><X size={18} /></button>
        </div>

        {/* Campos */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.5 }}>
            O parceiro poderá acessar a Vitrine Pública usando o e-mail cadastrado aqui.
          </p>

          <Field label="Nome completo *" value={form.nome} onChange={v => setForm({ ...form, nome: v })} />
          <Field label="E-mail *" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" />

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Grupo
            </label>
            <select
              value={form.grupo}
              onChange={e => setForm({ ...form, grupo: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 14, background: '#fff', color: '#1a1a1a', cursor: 'pointer', boxSizing: 'border-box' }}
            >
              <option value="">Sem grupo definido</option>
              <option value="A">Grupo A — sem limite de livros</option>
              <option value="B">Grupo B — até 3 livros</option>
              <option value="C">Grupo C — até 2 livros</option>
              <option value="D">Grupo D — 1 livro</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={e => setForm({ ...form, ativo: e.target.checked })}
            />
            Acesso ativo (parceiro consegue entrar na vitrine)
          </label>

          {erro && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center',
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: '#dc2626',
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              {erro}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
        }}>
          <button onClick={onCancelar} style={btnSecondary}>Cancelar</button>
          <button
            onClick={handleSubmit}
            style={btnPrimary}
          >
            <Save size={16} /> {parceiro ? 'Salvar alterações' : 'Adicionar'}
          </button>
        </div>
      </div>
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

  // ── Vínculo com o catálogo oficial (tabela livros) ──
  const [livroId, setLivroId] = useState(livro?.livro_id || null);
  const [vinculadoNome, setVinculadoNome] = useState('');
  const [buscaCat, setBuscaCat] = useState('');
  const [resultadosCat, setResultadosCat] = useState([]);
  const [buscandoCat, setBuscandoCat] = useState(false);

  // Carrega o nome do livro vinculado ao abrir em edição
  useEffect(() => {
    let ativo = true;
    if (livro?.livro_id) {
      supabase.from('livros').select('id, titulo, autor').eq('id', livro.livro_id).maybeSingle()
        .then(({ data }) => { if (ativo && data) setVinculadoNome(`${data.titulo}${data.autor ? ' — ' + data.autor : ''}`); });
    }
    return () => { ativo = false; };
  }, [livro]);

  // Busca no catálogo com debounce
  useEffect(() => {
    if (!buscaCat || buscaCat.length < 3) { setResultadosCat([]); return; }
    const t = setTimeout(async () => {
      setBuscandoCat(true);
      try {
        // Busca por título OU ISBN
        const { data } = await supabase
          .from('livros')
          .select('id, titulo, autor, editora, isbn')
          .or(`titulo.ilike.%${buscaCat}%,isbn.ilike.%${buscaCat}%`)
          .limit(8);
        setResultadosCat(data || []);
      } catch (e) { console.error(e); }
      finally { setBuscandoCat(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [buscaCat]);

  function selecionarDoCatalogo(l) {
    setLivroId(l.id);
    setVinculadoNome(`${l.titulo}${l.autor ? ' — ' + l.autor : ''}`);
    setBuscaCat('');
    setResultadosCat([]);
    // Preenche campos vazios com os dados do catálogo
    setForm(f => ({
      ...f,
      titulo: f.titulo || l.titulo || '',
      autor: f.autor || l.autor || '',
      editora: f.editora || l.editora || '',
      ean: f.ean || l.isbn || '',
    }));
  }

  function removerVinculo() {
    setLivroId(null);
    setVinculadoNome('');
  }

  function handleSubmit() {
    if (!form.titulo.trim()) return;
    onSalvar({
      ...form,
      preco: form.preco ? Number(form.preco) : null,
      livro_id: livroId,
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

          {/* ── Vínculo com o catálogo Órbita ── */}
          <div style={{
            background: livroId ? '#f0fdf4' : '#faf5ff',
            border: `1.5px solid ${livroId ? '#bbf7d0' : '#e9d5ff'}`,
            borderRadius: 10,
            padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Link2 size={14} color={livroId ? '#16a34a' : '#7c3aed'} />
              <span style={{ fontSize: 12, fontWeight: 700, color: livroId ? '#16a34a' : '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Catálogo Órbita
              </span>
            </div>

            {livroId ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                  ✓ {vinculadoNome || 'Livro vinculado'}
                </div>
                <button
                  type="button"
                  onClick={removerVinculo}
                  style={{ background: 'none', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Remover vínculo
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={buscaCat}
                  onChange={e => setBuscaCat(e.target.value)}
                  placeholder="Buscar por título ou ISBN no cadastro de livros..."
                  style={{
                    width: '100%', padding: '9px 12px',
                    border: '1.5px solid #ddd', borderRadius: 8,
                    fontSize: 13, boxSizing: 'border-box',
                  }}
                />
                {buscandoCat && (
                  <Loader2 size={14} className="spin" style={{ position: 'absolute', right: 12, top: 11, color: '#999' }} />
                )}
                {resultadosCat.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                    maxHeight: 220, overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  }}>
                    {resultadosCat.map(l => (
                      <div
                        key={l.id}
                        onClick={() => selecionarDoCatalogo(l)}
                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{l.titulo}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>
                          {l.autor || '—'} · {l.editora || '—'}{l.isbn ? ` · ISBN ${l.isbn}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: 11, color: '#888', margin: '6px 0 0' }}>
                  Vincular ao cadastro oficial permite cruzar pedidos e divulgações deste livro.
                </p>
              </div>
            )}
          </div>

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
