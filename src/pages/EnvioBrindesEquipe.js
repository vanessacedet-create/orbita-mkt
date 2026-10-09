import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import {
  Package, Download, Upload, Check, AlertCircle, Loader2, RefreshCw, Trash2, Send, X,
} from 'lucide-react';
import {
  lerCabecalho, extrairLinhas, casar, montarFretes,
} from '../lib/envio-brindes-equipe';

/* ============================================
   BRINDES — Tela da equipe (somente pessoas autorizadas no Bloco 4)
   Rota: /envio-brindes-equipe
   Lotes enviados pelas livrarias: frete, aprovação da livraria,
   pagamento, despacho e exclusão dos dados pessoais.
   ============================================ */

const STATUS = {
  recebido:             { rotulo: 'Recebido',                cor: 'badge-gray' },
  em_analise:           { rotulo: 'Em análise',              cor: 'badge-indigo' },
  frete_calculado:      { rotulo: 'Frete calculado',         cor: 'badge-amber' },
  aguardando_aprovacao: { rotulo: 'Aguardando a livraria',   cor: 'badge-amber' },
  aprovado:             { rotulo: 'Aprovado pela livraria',  cor: 'badge-accent' },
  enviado:              { rotulo: 'Enviado',                 cor: 'badge-green' },
  cancelado:            { rotulo: 'Cancelado',               cor: 'badge-red' },
};
const PAGAMENTOS = [
  { valor: 'desconto_comissao', rotulo: 'Descontar da comissão no portal CEDET' },
  { valor: 'pix',               rotulo: 'PIX' },
  { valor: 'cartao',            rotulo: 'Cartão de crédito' },
  { valor: 'boleto',            rotulo: 'Boleto' },
];
const TIPOS = { aluno_novo: 'Aluno novo', renovacao: 'Renovação' };

const moeda = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const mesBR = (iso) => (iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

async function chamarApi(caminho, { metodo = 'GET', corpo } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data && data.session && data.session.access_token;
  const resp = await fetch(`/api/envio-brindes/${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return resp;
}

const caixa = (cor) => ({ border: `1px solid ${cor}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, margin: '10px 0' });

// ───────────────────────── Detalhe de um lote ─────────────────────────
function DetalheLote({ lote, onAtualizar, avisar }) {
  const [dests, setDests] = useState([]);
  const [ocupado, setOcupado] = useState('');
  const [frete, setFrete] = useState(null); // { nomeArquivo, matriz, idxCab, cabecalho, idxNome, idxValor }
  const [resolucoes, setResolucoes] = useState({});
  const [forma, setForma] = useState(lote.forma_pagamento || '');
  const [pago, setPago] = useState(!!lote.pagamento_confirmado_em);

  const carregarDests = useCallback(async () => {
    const { data } = await supabase.from('envio_brinde_destinatarios')
      .select('id, nome_completo, valor_frete').eq('lote_id', lote.id).order('id');
    setDests(data || []);
  }, [lote.id]);
  useEffect(() => { carregarDests(); }, [carregarDests, lote.status]);
  useEffect(() => { setForma(lote.forma_pagamento || ''); setPago(!!lote.pagamento_confirmado_em); }, [lote.forma_pagamento, lote.pagamento_confirmado_em]);

  const linhasFrete = useMemo(
    () => (frete && frete.idxNome >= 0 && frete.idxValor >= 0 ? extrairLinhas(frete.matriz, frete.idxCab, frete.idxNome, frete.idxValor) : []),
    [frete]
  );
  const casamento = useMemo(() => casar(dests, linhasFrete), [dests, linhasFrete]);
  const montado = useMemo(() => montarFretes(dests, linhasFrete, casamento, resolucoes), [dests, linhasFrete, casamento, resolucoes]);

  async function executar(nome, fn, sucesso) {
    setOcupado(nome);
    try {
      await fn();
      if (sucesso) avisar('ok', sucesso);
      await onAtualizar();
    } catch (e) {
      avisar('erro', e.message || 'Não foi possível concluir.');
    } finally {
      setOcupado('');
    }
  }
  const rpc = async (nome, params) => {
    const { error } = await supabase.rpc(nome, params);
    if (error) throw new Error(error.message);
  };

  async function baixar() {
    await executar('baixar', async () => {
      const resp = await chamarApi(`baixar?lote_id=${lote.id}`);
      if (!resp.ok) { const j = await resp.json().catch(() => ({})); throw new Error(j.erro || 'Não foi possível baixar.'); }
      const blob = await resp.blob();
      const cab = resp.headers.get('Content-Disposition') || '';
      const m = cab.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = m ? m[1] : `lote-${lote.id}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'Planilha baixada.');
  }

  async function apagarDados() {
    if (!window.confirm('Confirma que você JÁ baixou e conferiu a planilha?\n\nCPF, e-mail, telefone e endereço serão APAGADOS do Google Drive e não poderão ser recuperados.')) return;
    await executar('apagar', async () => {
      const resp = await chamarApi('apagar-dados', { metodo: 'POST', corpo: { lote_id: lote.id } });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j.erro || 'Não foi possível apagar.');
    }, 'Dados pessoais apagados do Drive.');
  }

  async function lerArquivoFrete(e) {
    const arquivo = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
      const matriz = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
      const cab = lerCabecalho(matriz);
      if (!cab) { avisar('erro', 'A planilha está vazia.'); return; }
      setResolucoes({});
      setFrete({ nomeArquivo: arquivo.name, matriz, ...cab });
    } catch {
      avisar('erro', 'Não consegui ler este arquivo. Use .xlsx ou .csv.');
    }
  }

  const aplicarFrete = () => executar('frete', async () => {
    await rpc('envio_brinde_aplicar_frete', { p_lote_id: lote.id, p_fretes: montado.itens });
    setFrete(null); setResolucoes({});
  }, 'Frete gravado.');

  const podeAlterarFrete = ['recebido', 'em_analise', 'frete_calculado'].includes(lote.status);
  const valorFinal = Number(lote.valor_livros || 0) + Number(lote.valor_frete_total || 0);
  const ocupadoOuNao = !!ocupado;
  const livresLinhas = casamento.sobras.filter((i) => linhasFrete[i] && linhasFrete[i].valor != null);

  return (
    <div style={{ padding: 16, background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
        <div><div style={{ color: 'var(--text-muted)' }}>Livro</div><strong>{lote.livro_titulo}</strong></div>
        <div><div style={{ color: 'var(--text-muted)' }}>Quantidade</div><strong>{lote.qtd_livros}</strong></div>
        <div><div style={{ color: 'var(--text-muted)' }}>Preço da livraria</div><strong>{moeda(lote.preco_unitario)}</strong> <span style={{ color: 'var(--text-muted)' }}>(capa {moeda(lote.preco_capa)}, {Number(lote.desconto_percentual || 0)}% off)</span></div>
        <div><div style={{ color: 'var(--text-muted)' }}>Livros</div><strong>{moeda(lote.valor_livros)}</strong></div>
        <div><div style={{ color: 'var(--text-muted)' }}>Frete</div><strong>{lote.valor_frete_total == null ? '—' : moeda(lote.valor_frete_total)}</strong></div>
        <div><div style={{ color: 'var(--text-muted)' }}>Valor final</div><strong>{lote.valor_frete_total == null ? '—' : moeda(valorFinal)}</strong></div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
        Enviado por {lote.enviado_por_nome} ({lote.enviado_por_email}) em {dataBR(lote.criado_em)}
        {lote.aprovado_em && <> · Aprovado em {dataBR(lote.aprovado_em)} por {lote.aprovado_por_nome}</>}
        {lote.observacoes && <> · Obs.: {lote.observacoes}</>}
      </div>

      {/* Dados pessoais (Drive) */}
      <div style={caixa('var(--border)')}>
        <strong>Dados pessoais (Google Drive)</strong>
        {lote.dados_apagados_em ? (
          <div style={{ marginTop: 6 }}><Check size={14} /> Apagados em {dataBR(lote.dados_apagados_em)}.</div>
        ) : (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" disabled={ocupadoOuNao || !lote.drive_arquivo_id} onClick={baixar}>
              {ocupado === 'baixar' ? <Loader2 size={14} /> : <Download size={14} />} Baixar planilha
            </button>
            <button className="btn btn-ghost btn-sm" disabled={ocupadoOuNao || !lote.baixado_em} onClick={apagarDados}
              title={lote.baixado_em ? '' : 'Baixe a planilha antes'}>
              {ocupado === 'apagar' ? <Loader2 size={14} /> : <Trash2 size={14} />} Confirmar que baixei e apagar dados pessoais
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {lote.baixado_em ? `Baixada em ${dataBR(lote.baixado_em)}.` : 'Ainda não baixada.'}
            </span>
          </div>
        )}
      </div>

      {/* Frete */}
      {podeAlterarFrete && (
        <div style={caixa('var(--border)')}>
          <strong>Frete</strong>
          {lote.status === 'recebido' && (
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 10 }} disabled={ocupadoOuNao}
              onClick={() => executar('analise', async () => {
                const { error } = await supabase.from('envio_brinde_lotes')
                  .update({ status: 'em_analise', atualizado_em: new Date().toISOString() }).eq('id', lote.id).eq('status', 'recebido');
                if (error) throw new Error(error.message);
              })}>
              Marcar em análise
            </button>
          )}
          <div style={{ marginTop: 8 }}>
            <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
              <Upload size={14} /> Subir planilha de frete
              <input type="file" accept=".xlsx,.xls,.csv" onChange={lerArquivoFrete} style={{ display: 'none' }} />
            </label>
            {frete && <span style={{ marginLeft: 8, fontSize: 12 }}>{frete.nomeArquivo}</span>}
          </div>

          {frete && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="form-group" style={{ minWidth: 220 }}>
                  <label className="form-label">Coluna do NOME</label>
                  <select className="form-select" value={frete.idxNome} onChange={(e) => { setResolucoes({}); setFrete({ ...frete, idxNome: Number(e.target.value) }); }}>
                    <option value={-1}>— escolha —</option>
                    {frete.cabecalho.map((c, i) => <option key={i} value={i}>{c || `(coluna ${i + 1})`}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ minWidth: 220 }}>
                  <label className="form-label">Coluna do VALOR DO FRETE</label>
                  <select className="form-select" value={frete.idxValor} onChange={(e) => { setResolucoes({}); setFrete({ ...frete, idxValor: Number(e.target.value) }); }}>
                    <option value={-1}>— escolha —</option>
                    {frete.cabecalho.map((c, i) => <option key={i} value={i}>{c || `(coluna ${i + 1})`}</option>)}
                  </select>
                </div>
              </div>

              {linhasFrete.length > 0 && (
                <>
                  <div style={{ overflow: 'auto', maxHeight: 320, border: '1px solid var(--border)', borderRadius: 8, marginTop: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr style={{ textAlign: 'left', background: 'var(--surface-3)' }}>
                        <th style={{ padding: 8 }}>Pessoa do lote</th><th style={{ padding: 8 }}>Planilha de frete</th><th style={{ padding: 8 }}>Frete</th>
                      </tr></thead>
                      <tbody>
                        {dests.map((d) => {
                          const c = casamento.casados.get(d.id);
                          if (c) {
                            const l = linhasFrete[c.idx];
                            return (
                              <tr key={d.id} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: 8 }}>{d.nome_completo}</td>
                                <td style={{ padding: 8 }}>{l.nome} {c.tipo === 'aproximado' && <span className="badge badge-amber">nome parecido, confira</span>}</td>
                                <td style={{ padding: 8 }}>{moeda(l.valor)}</td>
                              </tr>
                            );
                          }
                          const r = resolucoes[d.id] || {};
                          return (
                            <tr key={d.id} style={{ borderTop: '1px solid var(--border)', background: 'var(--red-light)' }}>
                              <td style={{ padding: 8 }}>{d.nome_completo}<div style={{ fontSize: 11, color: 'var(--red)' }}>sem correspondência única</div></td>
                              <td style={{ padding: 8 }}>
                                <select className="form-select" value={r.tipo === 'linha' ? String(r.idx) : (r.tipo === 'manual' ? 'manual' : '')}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setResolucoes({ ...resolucoes, [d.id]: v === '' ? undefined : v === 'manual' ? { tipo: 'manual', valor: '' } : { tipo: 'linha', idx: Number(v) } });
                                  }}>
                                  <option value="">— escolher —</option>
                                  {livresLinhas.map((i) => <option key={i} value={i}>{linhasFrete[i].nome} — {moeda(linhasFrete[i].valor)}</option>)}
                                  <option value="manual">Digitar o valor manualmente</option>
                                </select>
                              </td>
                              <td style={{ padding: 8 }}>
                                {r.tipo === 'manual'
                                  ? <input className="form-input" style={{ width: 110 }} placeholder="0,00" value={r.valor}
                                      onChange={(e) => setResolucoes({ ...resolucoes, [d.id]: { tipo: 'manual', valor: e.target.value } })} />
                                  : (r.tipo === 'linha' && linhasFrete[r.idx] ? moeda(linhasFrete[r.idx].valor) : '—')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {linhasFrete.some((l) => l.valor == null) && (
                    <div style={caixa('var(--amber)')}><AlertCircle size={13} /> {linhasFrete.filter((l) => l.valor == null).length} linha(s) da planilha com valor ilegível foram ignoradas.</div>
                  )}
                  {livresLinhas.length > 0 && montado.faltam.length === 0 && (
                    <div style={caixa('var(--amber)')}><AlertCircle size={13} /> Há {livresLinhas.length} linha(s) na planilha de frete que não são de ninguém deste lote. Confira se é a planilha certa.</div>
                  )}

                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <strong>Total do frete: {moeda(montado.total)}</strong>
                    {montado.faltam.length > 0 && <span style={{ color: 'var(--red)', fontSize: 13 }}>Falta resolver {montado.faltam.length} pessoa(s).</span>}
                    <button className="btn btn-primary" disabled={ocupadoOuNao || montado.faltam.length > 0 || dests.length === 0} onClick={aplicarFrete}>
                      {ocupado === 'frete' ? <Loader2 size={14} /> : <Check size={14} />} Gravar frete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {lote.status === 'frete_calculado' && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13 }}>Frete gravado: <strong>{moeda(lote.valor_frete_total)}</strong>. Valor final para a livraria: <strong>{moeda(valorFinal)}</strong>.</div>
              <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={ocupadoOuNao}
                onClick={() => executar('aprovacao', () => rpc('envio_brinde_enviar_aprovacao', { p_lote_id: lote.id }), 'Enviado para a aprovação da livraria.')}>
                {ocupado === 'aprovacao' ? <Loader2 size={14} /> : <Send size={14} />} Enviar valor final para aprovação da livraria
              </button>
            </div>
          )}
        </div>
      )}

      {lote.status === 'aguardando_aprovacao' && (
        <div style={caixa('var(--amber)')}>Aguardando a livraria aprovar o valor final de <strong>{moeda(valorFinal)}</strong>.</div>
      )}

      {/* Pagamento e envio */}
      {['aprovado', 'enviado'].includes(lote.status) && (
        <div style={caixa('var(--border)')}>
          <strong>Pagamento</strong>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
            <div className="form-group" style={{ minWidth: 280 }}>
              <label className="form-label">Forma de pagamento combinada</label>
              <select className="form-select" value={forma} onChange={(e) => setForma(e.target.value)} disabled={lote.status === 'enviado'}>
                <option value="">— escolher —</option>
                {PAGAMENTOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} /> Pagamento confirmado
            </label>
            <button className="btn btn-ghost" disabled={ocupadoOuNao || !forma || lote.status === 'enviado'}
              onClick={() => executar('pagamento', () => rpc('envio_brinde_definir_pagamento', { p_lote_id: lote.id, p_forma: forma, p_confirmado: pago }), 'Pagamento registrado.')}>
              {ocupado === 'pagamento' ? <Loader2 size={14} /> : <Check size={14} />} Salvar pagamento
            </button>
          </div>
          {lote.status === 'aprovado' && (
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary"
                disabled={ocupadoOuNao || !lote.forma_pagamento || !lote.pagamento_confirmado_em}
                onClick={() => window.confirm('Marcar este lote como ENVIADO (despachado)?') &&
                  executar('enviado', () => rpc('envio_brinde_marcar_enviado', { p_lote_id: lote.id }), 'Lote marcado como enviado.')}>
                {ocupado === 'enviado' ? <Loader2 size={14} /> : <Package size={14} />} Marcar como enviado
              </button>
              {(!lote.forma_pagamento || !lote.pagamento_confirmado_em) && (
                <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                  Só libera com a forma de pagamento salva e o pagamento confirmado.
                </span>
              )}
            </div>
          )}
          {lote.status === 'enviado' && <div style={{ marginTop: 8, fontSize: 13 }}>Enviado em {dataBR(lote.enviado_em)}.</div>}
        </div>
      )}

      {!['enviado', 'cancelado'].includes(lote.status) && (
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-danger btn-sm" disabled={ocupadoOuNao}
            onClick={() => window.confirm('Cancelar este lote?') &&
              executar('cancelar', async () => {
                const { error } = await supabase.from('envio_brinde_lotes')
                  .update({ status: 'cancelado', atualizado_em: new Date().toISOString() }).eq('id', lote.id);
                if (error) throw new Error(error.message);
              }, 'Lote cancelado.')}>
            <X size={14} /> Cancelar lote
          </button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Página ─────────────────────────
export default function EnvioBrindesEquipe() {
  const [acesso, setAcesso] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erroLista, setErroLista] = useState('');
  const [filtro, setFiltro] = useState('abertos');
  const [selId, setSelId] = useState(null);
  const [aviso, setAviso] = useState(null);

  function avisar(tipo, texto) {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 6000);
  }

  const carregar = useCallback(async () => {
    setCarregando(true); setErroLista('');
    const { data, error } = await supabase.from('envio_brinde_lotes')
      .select('*, vitrine_parceiros(nome)').order('criado_em', { ascending: false }).limit(300);
    if (error) setErroLista(error.message); else setLotes(data || []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    let vivo = true;
    supabase.rpc('envio_brinde_eh_equipe').then(({ data, error }) => {
      if (!vivo) return;
      const ok = !error && data === true;
      setAcesso(ok);
      if (ok) carregar();
    }).catch(() => { if (vivo) setAcesso(false); });
    return () => { vivo = false; };
  }, [carregar]);

  const visiveis = useMemo(() => lotes.filter((l) => {
    if (filtro === 'todos') return true;
    if (filtro === 'abertos') return !['enviado', 'cancelado'].includes(l.status);
    return l.status === filtro;
  }), [lotes, filtro]);

  if (acesso === null) return <div className="loading"><div className="spinner" /></div>;
  if (acesso === false) {
    return (
      <div style={{ padding: 32 }}>
        <h1 className="page-title">Brindes</h1>
        <p className="page-subtitle">Você não tem acesso a este módulo.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Brindes para livrarias parceiras</h1>
          <p className="page-subtitle">Lotes enviados pelas livrarias: frete, aprovação, pagamento e despacho.</p>
        </div>
        <button className="btn btn-ghost" onClick={carregar} disabled={carregando}>
          {carregando ? <Loader2 size={14} /> : <RefreshCw size={14} />} Atualizar
        </button>
      </div>

      {aviso && (
        <div style={{ ...caixa(aviso.tipo === 'ok' ? 'var(--green)' : 'var(--red)'), background: aviso.tipo === 'ok' ? 'var(--green-light)' : 'var(--red-light)' }}>
          {aviso.tipo === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />} {aviso.texto}
        </div>
      )}
      {erroLista && <div style={caixa('var(--red)')}><AlertCircle size={14} /> {erroLista}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
        {[['abertos', 'Em andamento'], ['todos', 'Todos'], ...Object.entries(STATUS).map(([k, v]) => [k, v.rotulo])].map(([k, r]) => (
          <button key={k} className={`btn btn-sm ${filtro === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltro(k)}>{r}</button>
        ))}
      </div>

      <div className="table-card">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: 10 }}>Nº</th><th style={{ padding: 10 }}>Livraria</th><th style={{ padding: 10 }}>Mês</th>
              <th style={{ padding: 10 }}>Tipo</th><th style={{ padding: 10 }}>Livro</th><th style={{ padding: 10 }}>Qtd</th>
              <th style={{ padding: 10 }}>Livros</th><th style={{ padding: 10 }}>Frete</th><th style={{ padding: 10 }}>Final</th>
              <th style={{ padding: 10 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 && !carregando && (
              <tr><td colSpan={10} style={{ padding: 20, color: 'var(--text-muted)' }}>Nenhum lote nesta visão.</td></tr>
            )}
            {visiveis.map((l) => {
              const st = STATUS[l.status] || { rotulo: l.status, cor: 'badge-gray' };
              const aberto = selId === l.id;
              return (
                <React.Fragment key={l.id}>
                  <tr onClick={() => setSelId(aberto ? null : l.id)} style={{ cursor: 'pointer', borderTop: '1px solid var(--border)', background: aberto ? 'var(--surface-2)' : 'transparent' }}>
                    <td style={{ padding: 10 }}>{l.id}</td>
                    <td style={{ padding: 10 }}>{(l.vitrine_parceiros && l.vitrine_parceiros.nome) || l.parceiro_id}</td>
                    <td style={{ padding: 10 }}>{mesBR(l.mes_referencia)}</td>
                    <td style={{ padding: 10 }}>{TIPOS[l.tipo] || l.tipo}</td>
                    <td style={{ padding: 10, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.livro_titulo}</td>
                    <td style={{ padding: 10 }}>{l.qtd_livros}</td>
                    <td style={{ padding: 10 }}>{moeda(l.valor_livros)}</td>
                    <td style={{ padding: 10 }}>{l.valor_frete_total == null ? '—' : moeda(l.valor_frete_total)}</td>
                    <td style={{ padding: 10 }}>{l.valor_frete_total == null ? '—' : moeda(Number(l.valor_livros) + Number(l.valor_frete_total))}</td>
                    <td style={{ padding: 10 }}><span className={`badge ${st.cor}`}>{st.rotulo}</span></td>
                  </tr>
                  {aberto && (
                    <tr><td colSpan={10} style={{ padding: 0 }}>
                      <DetalheLote lote={l} onAtualizar={carregar} avisar={avisar} />
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
