import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Link2, Plus, Copy, Check, Search, X, Loader2, Lock,
  ExternalLink, CalendarDays, BookOpen, UserRound, Edit2
} from 'lucide-react';

const STATUS = {
  aberta: { label: 'Aguardando escolha', bg: '#fff7ed', color: '#9a3412' },
  respondida: { label: 'Respondida', bg: '#ecfdf5', color: '#166534' },
  encerrada: { label: 'Encerrada', bg: '#f3f4f6', color: '#6b7280' },
};

export default function VitrineSelecoesAdmin({ livros = [], parceiros = [] }) {
  const [selecoes, setSelecoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNova, setShowNova] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(null);
  const [buscaLivro, setBuscaLivro] = useState('');
  const [form, setForm] = useState({
    parceiroId: '',
    nome: '',
    quantidade: 3,
    expiraEm: '',
    livros: [],
  });

  const parceirosAtivos = useMemo(
    () => parceiros.filter(p => p.ativo !== false).sort((a, b) => (a.nome || '').localeCompare(b.nome || '')),
    [parceiros]
  );

  const livrosAtivos = useMemo(
    () => livros.filter(l => l.ativo !== false),
    [livros]
  );

  const livrosFiltrados = useMemo(() => {
    const termo = buscaLivro.trim().toLowerCase();
    if (!termo) return livrosAtivos;
    return livrosAtivos.filter(l =>
      l.titulo?.toLowerCase().includes(termo) ||
      l.autor?.toLowerCase().includes(termo) ||
      l.editora?.toLowerCase().includes(termo)
    );
  }, [livrosAtivos, buscaLivro]);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from('vitrine_selecoes')
      .select('*, vitrine_selecao_livros(livro_id)')
      .order('created_at', { ascending: false });
    if (!error) setSelecoes(data || []);
    setLoading(false);
  }

  function parceiroNome(id) {
    return parceiros.find(p => String(p.id) === String(id))?.nome || 'Parceiro';
  }

  function livroTitulo(id) {
    return livros.find(l => String(l.id) === String(id))?.titulo || `Livro #${id}`;
  }

  function linkDaSelecao(sel) {
    return `${window.location.origin}/vitrine/selecao/${sel.token}`;
  }

  async function copiarLink(sel) {
    await navigator.clipboard.writeText(linkDaSelecao(sel));
    setCopiado(sel.id);
    setTimeout(() => setCopiado(null), 1800);
  }

  function toggleLivro(id) {
    setForm(prev => ({
      ...prev,
      livros: prev.livros.includes(id)
        ? prev.livros.filter(x => x !== id)
        : [...prev.livros, id],
    }));
  }

  function abrirNova() {
    setEditando(null);
    setForm({ parceiroId: '', nome: '', quantidade: 3, expiraEm: '', livros: [] });
    setBuscaLivro('');
    setShowNova(true);
  }

  function abrirEdicao(sel) {
    if (sel.status !== 'aberta') {
      alert('Somente seleções que ainda aguardam resposta podem ser editadas.');
      return;
    }
    setEditando(sel);
    setForm({
      parceiroId: String(sel.parceiro_id),
      nome: sel.nome || '',
      quantidade: sel.quantidade_titulos || 1,
      expiraEm: sel.expira_em ? new Date(sel.expira_em).toISOString().slice(0, 10) : '',
      livros: (sel.vitrine_selecao_livros || []).map(i => i.livro_id),
    });
    setBuscaLivro('');
    setShowNova(true);
  }

  function fecharModal() {
    if (salvando) return;
    setShowNova(false);
    setEditando(null);
    setBuscaLivro('');
  }

  async function salvarSelecao() {
    const quantidade = Number(form.quantidade);
    if (!form.parceiroId || !form.nome.trim()) {
      alert('Selecione o parceiro e informe o nome da ação.');
      return;
    }
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      alert('Informe uma quantidade válida de títulos.');
      return;
    }
    if (form.livros.length < quantidade) {
      alert(`A curadoria precisa ter pelo menos ${quantidade} livros.`);
      return;
    }

    setSalvando(true);
    try {
      let sel;
      if (editando) {
        const { data, error } = await supabase
          .from('vitrine_selecoes')
          .update({
            parceiro_id: Number(form.parceiroId),
            nome: form.nome.trim(),
            quantidade_titulos: quantidade,
            expira_em: form.expiraEm ? new Date(form.expiraEm + 'T23:59:59').toISOString() : null,
          })
          .eq('id', editando.id)
          .eq('status', 'aberta')
          .select()
          .single();
        if (error) throw error;
        sel = data;

        const { error: errDelete } = await supabase
          .from('vitrine_selecao_livros')
          .delete()
          .eq('selecao_id', sel.id);
        if (errDelete) throw errDelete;
      } else {
        const token = crypto.randomUUID();
        const { data, error } = await supabase
          .from('vitrine_selecoes')
          .insert({
            token,
            parceiro_id: Number(form.parceiroId),
            nome: form.nome.trim(),
            quantidade_titulos: quantidade,
            expira_em: form.expiraEm ? new Date(form.expiraEm + 'T23:59:59').toISOString() : null,
            status: 'aberta',
          })
          .select()
          .single();
        if (error) throw error;
        sel = data;
      }

      const { error: errItens } = await supabase
        .from('vitrine_selecao_livros')
        .insert(form.livros.map(livro_id => ({ selecao_id: sel.id, livro_id })));
      if (errItens) throw errItens;

      setForm({ parceiroId: '', nome: '', quantidade: 3, expiraEm: '', livros: [] });
      setBuscaLivro('');
      setShowNova(false);
      setEditando(null);
      await carregar();
    } catch (err) {
      console.error('[Vitrine Seleções] Erro ao salvar:', err);
      alert(editando ? 'Não foi possível salvar as alterações.' : 'Não foi possível criar a seleção.');
    } finally {
      setSalvando(false);
    }
  }

  async function encerrar(sel) {
    if (!window.confirm('Encerrar este link? O parceiro não poderá mais responder.')) return;
    const { error } = await supabase
      .from('vitrine_selecoes')
      .update({ status: 'encerrada' })
      .eq('id', sel.id);
    if (!error) await carregar();
  }

  if (loading) {
    return <div style={{ padding: 50, textAlign: 'center', color: '#777' }}><Loader2 size={26} style={{ animation: 'spin 1s linear infinite' }} /> Carregando seleções...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>Seleções personalizadas</h2>
          <p style={{ margin: '5px 0 0', color: '#777', fontSize: 13 }}>
            Envie uma curadoria exclusiva e defina quantos títulos o parceiro deve escolher.
          </p>
        </div>
        <button onClick={abrirNova} style={btnPrimary}>
          <Plus size={16} /> Nova seleção
        </button>
      </div>

      {selecoes.length === 0 ? (
        <div style={empty}>
          <Link2 size={34} />
          <strong>Nenhuma seleção criada</strong>
          <span>Crie a primeira curadoria personalizada para um parceiro.</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {selecoes.map(sel => {
            const st = STATUS[sel.status] || STATUS.encerrada;
            const candidatos = sel.vitrine_selecao_livros?.length || 0;
            const resposta = sel.resposta_livros || [];
            return (
              <div key={sel.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 230, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 15 }}>{sel.nome}</strong>
                      <span style={{ ...badge, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, color: '#777', fontSize: 12, marginTop: 8, flexWrap: 'wrap' }}>
                      <span><UserRound size={13} /> {parceiroNome(sel.parceiro_id)}</span>
                      <span><BookOpen size={13} /> escolhe {sel.quantidade_titulos} de {candidatos}</span>
                      {sel.expira_em && <span><CalendarDays size={13} /> até {new Date(sel.expira_em).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => copiarLink(sel)} style={btnSecondary}>
                      {copiado === sel.id ? <Check size={15} /> : <Copy size={15} />}
                      {copiado === sel.id ? 'Copiado' : 'Copiar link'}
                    </button>
                    <a href={linkDaSelecao(sel)} target="_blank" rel="noreferrer" style={btnLink}><ExternalLink size={15} /></a>
                    {sel.status === 'aberta' && (
                      <>
                        <button onClick={() => abrirEdicao(sel)} style={btnSecondary}><Edit2 size={15} /> Editar</button>
                        <button onClick={() => encerrar(sel)} style={btnDanger}><Lock size={15} /> Encerrar</button>
                      </>
                    )}
                  </div>
                </div>

                {sel.status === 'respondida' && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #eee' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 7 }}>TÍTULOS ESCOLHIDOS</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {resposta.map(id => <span key={id} style={chip}>{livroTitulo(id)}</span>)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showNova && (
        <div style={overlay} onClick={fecharModal}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>{editando ? 'Editar seleção' : 'Nova seleção'}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#777' }}>Cada título equivale sempre a 1 unidade.</p>
              </div>
              <button onClick={fecharModal} style={iconBtn}><X size={19} /></button>
            </div>

            <label style={label}>Parceiro</label>
            <select value={form.parceiroId} onChange={e => setForm({ ...form, parceiroId: e.target.value })} style={input}>
              <option value="">Selecione...</option>
              {parceirosAtivos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>

            <label style={label}>Nome da ação / campanha</label>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Campanha de outubro" style={input} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={label}>Títulos a escolher</label>
                <input type="number" min="1" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} style={input} />
              </div>
              <div>
                <label style={label}>Validade do link (opcional)</label>
                <input type="date" value={form.expiraEm} onChange={e => setForm({ ...form, expiraEm: e.target.value })} style={input} />
              </div>
            </div>

            <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div>
                  <strong style={{ fontSize: 14 }}>Livros disponíveis no link</strong>
                  <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{form.livros.length} selecionados para a curadoria</div>
                </div>
              </div>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: '#999' }} />
                <input value={buscaLivro} onChange={e => setBuscaLivro(e.target.value)} placeholder="Buscar título, autor ou editora..." style={{ ...input, paddingLeft: 34, margin: 0 }} />
              </div>
              <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #eee', borderRadius: 10 }}>
                {livrosFiltrados.map(l => {
                  const marcado = form.livros.includes(l.id);
                  return (
                    <button key={l.id} type="button" onClick={() => toggleLivro(l.id)} style={{
                      width: '100%', display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left',
                      border: 'none', borderBottom: '1px solid #f1f1f1', background: marcado ? '#fffbea' : '#fff',
                      padding: '10px 12px', cursor: 'pointer',
                    }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        border: `1.5px solid ${marcado ? '#d4a005' : '#bbb'}`,
                        background: marcado ? '#f2b705' : '#fff',
                        display: 'grid', placeItems: 'center',
                      }}>{marcado && <Check size={13} color="#222" />}</span>
                      <span>
                        <strong style={{ fontSize: 13, display: 'block' }}>{l.titulo}</strong>
                        <small style={{ color: '#888' }}>{[l.autor, l.editora].filter(Boolean).join(' · ')}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 18 }}>
              <button disabled={salvando} onClick={fecharModal} style={btnSecondary}>Cancelar</button>
              <button disabled={salvando} onClick={salvarSelecao} style={btnPrimary}>
                {salvando ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Link2 size={15} />}
                {editando ? 'Salvar alterações' : 'Criar e gerar link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 };
const empty = { minHeight: 240, border: '1px dashed #d1d5db', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#777' };
const badge = { fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999 };
const chip = { background: '#f5f5f4', border: '1px solid #e7e5e4', borderRadius: 999, padding: '5px 9px', fontSize: 12 };
const btnPrimary = { border: 'none', background: '#2f2f2f', color: '#fff', borderRadius: 9, padding: '9px 13px', display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontWeight: 600 };
const btnSecondary = { border: '1px solid #d1d5db', background: '#fff', color: '#444', borderRadius: 9, padding: '8px 11px', display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontWeight: 600 };
const btnDanger = { ...btnSecondary, color: '#b91c1c', borderColor: '#fecaca' };
const btnLink = { ...btnSecondary, padding: 9, textDecoration: 'none' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20 };
const modal = { background: '#fff', color: '#222', width: 'min(820px, 96vw)', maxHeight: '92vh', overflow: 'auto', borderRadius: 16, padding: 20, boxShadow: '0 24px 80px rgba(0,0,0,.25)' };
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#666', margin: '12px 0 6px' };
const input = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 9, padding: '10px 11px', fontSize: 14, background: '#fff', color: '#222' };
const iconBtn = { border: 'none', background: 'none', cursor: 'pointer', color: '#777' };
