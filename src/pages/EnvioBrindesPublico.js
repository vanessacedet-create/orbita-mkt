import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, Send, Check, AlertCircle, Loader2, BookOpen, FileSpreadsheet, RefreshCw, Package } from 'lucide-react';
import { CAMPOS, lerLinhas, mascararCpf, formatarMoeda } from '../lib/envio-brindes-validacao';

/* ============================================
   ENVIO DE BRINDES — Página pública (livrarias parceiras)
   Rota: /envio-brindes (sem login do Órbita)
   A livraria se identifica pelo e-mail, escolhe o livro, sobe a planilha,
   vê os erros por linha e o valor dos livros, e envia à CEDET.
   Os dados pessoais vão para o Google Drive (pelo servidor); o banco só
   guarda nomes, valores e status.
   ============================================ */

const COLORS = {
  bg: '#F7F7F5', card: '#FFFFFF', primary: '#3A3A3A', text: '#2A2A2A', textLight: '#6B6B6B',
  border: '#E0E0DE', gold: '#F2B705', success: '#5A8F6B', error: '#C0392B', errorLight: '#FDECEA',
  successLight: '#EAF4EE', warnLight: '#FFF8E1',
};
const FONTS = {
  display: "'Playfair Display', 'Georgia', serif",
  body: "'DM Sans', 'Helvetica Neue', sans-serif",
};

const s = {
  page: { minHeight: '100vh', background: COLORS.bg, fontFamily: FONTS.body, color: COLORS.text, padding: '32px 16px' },
  wrap: { maxWidth: 980, margin: '0 auto' },
  card: { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 24, marginBottom: 20 },
  h1: { fontFamily: FONTS.display, fontSize: 30, margin: '0 0 6px' },
  h2: { fontFamily: FONTS.display, fontSize: 20, margin: '0 0 14px' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 15, fontFamily: FONTS.body, background: '#fff' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 },
  btn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 8, border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: FONTS.body, background: COLORS.primary, color: '#fff' },
  btnGhost: { background: '#fff', color: COLORS.primary, border: `1px solid ${COLORS.border}` },
  btnOff: { opacity: 0.45, cursor: 'not-allowed' },
  muted: { color: COLORS.textLight, fontSize: 14 },
  box: (bg, cor) => ({ background: bg, border: `1px solid ${cor}`, color: COLORS.text, borderRadius: 8, padding: '12px 14px', fontSize: 14, marginTop: 12 }),
  th: { textAlign: 'left', padding: '8px 10px', fontSize: 12, borderBottom: `1px solid ${COLORS.border}`, background: '#FAFAF8', whiteSpace: 'nowrap', position: 'sticky', top: 0 },
  td: { padding: '7px 10px', fontSize: 13, borderBottom: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap' },
};

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function chamarApi(caminho, corpo) {
  const resp = await fetch(`/api/envio-brindes/${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const json = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, json };
}

// ── Tela de confirmação depois do envio (hierarquia: H1 > H2 > H3) ──
export function TelaSucesso({ sucesso, onNovo, onVerEnvios }) {
  const n = sucesso.quantidade;
  const linha = { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: 15 };
  const rotulo = { color: COLORS.textLight, margin: 0 };
  const valor = { margin: 0, fontWeight: 600, textAlign: 'right' };
  const passos = [
    { t: 'Calculamos o frete', d: 'A equipe da CEDET calcula o frete de cada envio.' },
    { t: 'Você aprova o valor final', d: 'Quando o frete estiver calculado, o valor final (livros + frete) aparece na aba "Meus envios" para você aprovar.' },
    { t: 'Pagamento e despacho', d: 'Combinamos a forma de pagamento (comissão no portal CEDET, PIX, cartão ou boleto) e despachamos os livros. Os códigos de rastreio ficam disponíveis em "Meus envios".' },
  ];
  return (
    <div style={s.page}><div style={{ ...s.wrap, maxWidth: 640 }}>
      <div style={{ ...s.card, padding: 32 }}>
        <header style={{ textAlign: 'center', paddingBottom: 24, borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: COLORS.successLight, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={32} color={COLORS.success} />
          </div>
          <h1 style={{ ...s.h1, fontSize: 36, margin: '16px 0 8px' }}>Envio recebido</h1>
          <p style={{ fontSize: 17, margin: '0 0 14px' }}>
            Recebemos a planilha com <strong>{n} {n === 1 ? 'pessoa' : 'pessoas'}</strong>.
          </p>
          <span style={{ display: 'inline-block', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 999, padding: '5px 14px', fontSize: 13, fontWeight: 600 }}>
            Protocolo nº {sucesso.lote_id}
          </span>
        </header>

        <section style={{ marginTop: 28 }}>
          <h2 style={s.h2}>Resumo do pedido</h2>
          <dl style={{ margin: 0 }}>
            <div style={linha}><dt style={rotulo}>Livro</dt><dd style={{ ...valor, maxWidth: '65%' }}>{sucesso.livro}</dd></div>
            <div style={linha}><dt style={rotulo}>Quantidade</dt><dd style={valor}>{n} {n === 1 ? 'livro' : 'livros'}</dd></div>
            <div style={linha}><dt style={rotulo}>Preço de capa</dt><dd style={valor}>{formatarMoeda(sucesso.preco_capa)}</dd></div>
            <div style={linha}><dt style={rotulo}>Desconto da sua livraria</dt><dd style={valor}>{Number(sucesso.desconto_percentual)}%</dd></div>
            <div style={linha}><dt style={rotulo}>Preço por livro</dt><dd style={valor}>{formatarMoeda(sucesso.preco_unitario)}</dd></div>
            <div style={{ ...linha, alignItems: 'baseline', borderBottom: 'none', paddingTop: 16 }}>
              <dt style={{ ...rotulo, fontSize: 16, color: COLORS.text, fontWeight: 600 }}>Valor dos livros</dt>
              <dd style={{ ...valor, fontSize: 28, fontFamily: FONTS.display }}>{formatarMoeda(sucesso.valor_livros)}</dd>
            </div>
          </dl>
          <p style={{ ...s.muted, margin: '4px 0 0', textAlign: 'right' }}>Frete: a calcular pela CEDET</p>
        </section>

        <section style={{ marginTop: 32 }}>
          <h2 style={s.h2}>O que acontece agora</h2>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
            {passos.map((p, i) => (
              <li key={p.t} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span aria-hidden="true" style={{ flex: '0 0 30px', height: 30, borderRadius: '50%', background: COLORS.primary, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{i + 1}</span>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 2px' }}>{p.t}</h3>
                  <p style={{ ...s.muted, margin: 0 }}>{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside role="note" style={{ marginTop: 28, background: COLORS.warnLight, border: `1px solid ${COLORS.gold}`, borderRadius: 8, padding: '12px 14px', fontSize: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertCircle size={18} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span><strong>Não envie esta mesma planilha de novo.</strong> Guarde o número do protocolo para falar com a equipe sobre este envio.</span>
        </aside>

        <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={s.btn} onClick={onVerEnvios}>Ver meus envios</button>
          <button style={{ ...s.btn, ...s.btnGhost }} onClick={onNovo}>Fazer outro envio</button>
        </div>
      </div>
    </div></div>
  );
}

// ── "Meus envios": o que a livraria enviou e o que precisa aprovar ──
const STATUS_LIVRARIA = {
  recebido:             { t: 'Em análise pela CEDET',              cor: '#6B6B6B', bg: '#F0F0EE' },
  em_analise:           { t: 'Em análise pela CEDET',              cor: '#6B6B6B', bg: '#F0F0EE' },
  frete_calculado:      { t: 'Em análise pela CEDET',              cor: '#6B6B6B', bg: '#F0F0EE' },
  aguardando_aprovacao: { t: 'Aguardando a sua aprovação',         cor: '#8A6500', bg: COLORS.warnLight },
  aprovado:             { t: 'Aprovado, combinando o pagamento',   cor: '#2F6B45', bg: COLORS.successLight },
  enviado:              { t: 'Enviado',                            cor: '#2F6B45', bg: COLORS.successLight },
  cancelado:            { t: 'Cancelado',                          cor: COLORS.error, bg: COLORS.errorLight },
};
const FORMA_PAGAMENTO = {
  desconto_comissao: 'Desconto na comissão do portal CEDET',
  pix: 'PIX',
  cartao: 'Cartão de crédito',
  boleto: 'Boleto',
};
const TIPO_ROTULO = { aluno_novo: 'Aluno novo', renovacao: 'Renovação' };
const mesAno = (iso) => (iso ? `${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : '');
const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

export function CartaoEnvio({ envio, nomePadrao, emailPadrao, onAprovar, onCarregarRastreio, rastreioInicial }) {
  const [nome, setNome] = useState(nomePadrao || '');
  const [email, setEmail] = useState(emailPadrao || '');
  const [concordo, setConcordo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [rast, setRast] = useState(rastreioInicial || null); // lista [{nome_completo, codigo_rastreio}]
  const [rastAberto, setRastAberto] = useState(!!rastreioInicial);
  const [rastCarregando, setRastCarregando] = useState(false);
  const [rastErro, setRastErro] = useState('');
  const nRastreios = Number(envio.rastreios_informados || 0);

  async function alternarRastreio() {
    if (rastAberto) { setRastAberto(false); return; }
    if (!rast) {
      setRastCarregando(true); setRastErro('');
      const r = await onCarregarRastreio(envio);
      setRastCarregando(false);
      if (!r.ok) { setRastErro(r.erro); return; }
      setRast(r.itens);
    }
    setRastAberto(true);
  }
  function baixarRastreio() {
    const ws = XLSX.utils.aoa_to_sheet([['Nome completo', 'Código de rastreio'], ...rast.map((r) => [r.nome_completo, r.codigo_rastreio])]);
    ws['!cols'] = [{ wch: 36 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rastreio');
    XLSX.writeFile(wb, `rastreio-envio-${envio.id}.xlsx`);
  }

  const st = STATUS_LIVRARIA[envio.status] || { t: envio.status, cor: COLORS.textLight, bg: '#F0F0EE' };
  const temFinal = envio.valor_final != null;
  const aguardando = envio.status === 'aguardando_aprovacao';
  const nomeOk = nome.trim().split(/\s+/).filter(Boolean).length >= 2;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const podeAprovar = aguardando && nomeOk && emailOk && concordo && !enviando;

  async function aprovar() {
    setEnviando(true); setErro('');
    const r = await onAprovar(envio, nome.trim(), email.trim());
    if (!r.ok) setErro(r.erro);
    setEnviando(false);
  }

  const linha = { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: 14 };
  const rot = { color: COLORS.textLight, margin: 0 };
  const val = { margin: 0, fontWeight: 600, textAlign: 'right' };

  return (
    <article style={{ ...s.card, padding: 20, borderColor: aguardando ? COLORS.gold : COLORS.border, borderWidth: aguardando ? 2 : 1 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 2px' }}>Envio nº {envio.id}</h3>
          <p style={{ ...s.muted, margin: 0 }}>{TIPO_ROTULO[envio.tipo] || envio.tipo} · {mesAno(envio.mes_referencia)} · enviado em {dataCurta(envio.criado_em)}</p>
        </div>
        <span style={{ background: st.bg, color: st.cor, borderRadius: 999, padding: '5px 12px', fontSize: 13, fontWeight: 600 }}>{st.t}</span>
      </header>

      <dl style={{ margin: '14px 0 0' }}>
        <div style={linha}><dt style={rot}>Livro</dt><dd style={{ ...val, maxWidth: '65%' }}>{envio.livro_titulo}</dd></div>
        <div style={linha}><dt style={rot}>Quantidade</dt><dd style={val}>{envio.qtd_livros} {envio.qtd_livros === 1 ? 'livro' : 'livros'}</dd></div>
        <div style={linha}><dt style={rot}>Valor dos livros</dt><dd style={val}>{formatarMoeda(envio.valor_livros)}</dd></div>
        {temFinal && <div style={linha}><dt style={rot}>Frete</dt><dd style={val}>{formatarMoeda(envio.valor_frete)}</dd></div>}
        <div style={{ ...linha, borderBottom: 'none', alignItems: 'baseline', paddingTop: 12 }}>
          <dt style={{ ...rot, color: COLORS.text, fontWeight: 600, fontSize: 15 }}>{temFinal ? 'Valor final' : 'Valor final'}</dt>
          <dd style={{ ...val, fontSize: temFinal ? 24 : 15, fontFamily: temFinal ? FONTS.display : FONTS.body, color: temFinal ? COLORS.text : COLORS.textLight, fontWeight: temFinal ? 700 : 400 }}>
            {temFinal ? formatarMoeda(envio.valor_final) : 'frete a calcular'}
          </dd>
        </div>
      </dl>

      {envio.forma_pagamento && (
        <p style={{ ...s.muted, margin: '8px 0 0' }}>Forma de pagamento: <strong>{FORMA_PAGAMENTO[envio.forma_pagamento] || envio.forma_pagamento}</strong></p>
      )}
      {envio.aprovado_em && <p style={{ ...s.muted, margin: '4px 0 0' }}>Aprovado em {dataCurta(envio.aprovado_em)}.</p>}

      {envio.status === 'enviado' && (
        <section style={{ marginTop: 16, borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
          <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Rastreio</h4>
          {nRastreios === 0 ? (
            <p style={{ ...s.muted, margin: 0 }}>Os códigos de rastreio ainda não foram informados. Eles aparecem aqui assim que a CEDET enviar.</p>
          ) : (
            <>
              <p style={{ ...s.muted, margin: '0 0 10px' }}>{nRastreios} de {envio.qtd_livros} códigos informados.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button style={{ ...s.btn, ...s.btnGhost }} onClick={alternarRastreio} disabled={rastCarregando}>
                  {rastCarregando ? <Loader2 size={16} /> : <Package size={16} />} {rastAberto ? 'Ocultar códigos' : 'Ver códigos de rastreio'}
                </button>
                {rast && <button style={{ ...s.btn, ...s.btnGhost }} onClick={baixarRastreio}><Download size={16} /> Baixar planilha (.xlsx)</button>}
              </div>
              {rastErro && <div style={s.box(COLORS.errorLight, COLORS.error)}><AlertCircle size={14} /> {rastErro}</div>}
              {rastAberto && rast && (
                <div style={{ overflow: 'auto', maxHeight: 360, border: `1px solid ${COLORS.border}`, borderRadius: 8, marginTop: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead><tr style={{ textAlign: 'left', background: '#FAFAF8' }}>
                      <th style={{ padding: '8px 12px' }}>Nome</th><th style={{ padding: '8px 12px' }}>Código de rastreio</th>
                    </tr></thead>
                    <tbody>
                      {rast.map((r, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                          <td style={{ padding: '8px 12px' }}>{r.nome_completo}</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{r.codigo_rastreio}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {aguardando && (
        <section style={{ marginTop: 18, background: COLORS.warnLight, border: `1px solid ${COLORS.gold}`, borderRadius: 8, padding: 16 }}>
          <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Aprovar o valor final</h4>
          <p style={{ ...s.muted, margin: '0 0 12px' }}>Depois do seu OK, a equipe da CEDET combina com você a forma de pagamento e despacha os livros.</p>
          <div style={s.grid}>
            <div>
              <label style={s.label} htmlFor={`ap-nome-${envio.id}`}>Seu nome completo</label>
              <input id={`ap-nome-${envio.id}`} style={s.input} value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <label style={s.label} htmlFor={`ap-email-${envio.id}`}>Seu e-mail</label>
              <input id={`ap-email-${envio.id}`} style={s.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, marginTop: 12 }}>
            <input type="checkbox" checked={concordo} onChange={(e) => setConcordo(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Li o valor final de <strong>{formatarMoeda(envio.valor_final)}</strong> e concordo com ele.</span>
          </label>
          {erro && <div style={s.box(COLORS.errorLight, COLORS.error)}><AlertCircle size={14} /> {erro}</div>}
          <div style={{ marginTop: 14 }}>
            <button style={{ ...s.btn, ...(podeAprovar ? {} : s.btnOff) }} disabled={!podeAprovar} onClick={aprovar}>
              {enviando ? <Loader2 size={16} /> : <Check size={16} />} Aprovar valor final
            </button>
          </div>
        </section>
      )}
    </article>
  );
}

export function MeusEnvios({ envios, carregando, erro, onAtualizar, onAprovar, onCarregarRastreio, nomePadrao, emailPadrao }) {
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ ...s.h2, marginBottom: 4 }}>Meus envios</h2>
          <p style={{ ...s.muted, margin: 0 }}>Acompanhe cada envio e aprove o valor final quando o frete estiver calculado.</p>
        </div>
        <button style={{ ...s.btn, ...s.btnGhost }} onClick={onAtualizar} disabled={carregando}>
          {carregando ? <Loader2 size={16} /> : <RefreshCw size={16} />} Atualizar
        </button>
      </div>
      {erro && <div style={s.box(COLORS.errorLight, COLORS.error)}><AlertCircle size={14} /> {erro}</div>}
      <div style={{ marginTop: 18 }}>
        {!carregando && !erro && envios.length === 0 && (
          <div style={{ ...s.card, textAlign: 'center', color: COLORS.textLight }}>Você ainda não fez nenhum envio.</div>
        )}
        {envios.map((e) => (
          <CartaoEnvio key={e.id} envio={e} nomePadrao={nomePadrao} emailPadrao={emailPadrao} onAprovar={onAprovar} onCarregarRastreio={onCarregarRastreio} />
        ))}
      </div>
    </section>
  );
}

export default function EnvioBrindesPublico() {
  // Identificação da livraria
  const [emailLivraria, setEmailLivraria] = useState('');
  const [parceiro, setParceiro] = useState(null);
  const [livros, setLivros] = useState([]);
  const [identificando, setIdentificando] = useState(false);
  const [erroId, setErroId] = useState('');

  // Dados do envio
  const [nomeEnvio, setNomeEnvio] = useState('');
  const [emailEnvio, setEmailEnvio] = useState('');
  const [tipo, setTipo] = useState('');
  const [mes, setMes] = useState(mesAtual());
  const [livroId, setLivroId] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Planilha
  const [arquivoNome, setArquivoNome] = useState('');
  const [linhas, setLinhas] = useState([]);
  const [erroArquivo, setErroArquivo] = useState('');

  // Envio
  const [autorizo, setAutorizo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [errosServidor, setErrosServidor] = useState([]);
  const [sucesso, setSucesso] = useState(null);

  // Meus envios
  const [aba, setAba] = useState('novo'); // 'novo' | 'meus'
  const [envios, setEnvios] = useState([]);
  const [carregandoEnvios, setCarregandoEnvios] = useState(false);
  const [erroEnvios, setErroEnvios] = useState('');

  const livro = useMemo(() => livros.find((l) => String(l.livro_id) === String(livroId)) || null, [livros, livroId]);
  const comErro = useMemo(() => linhas.filter((l) => l.erros.length > 0), [linhas]);
  const qtd = linhas.length;
  const valorTotal = livro ? Math.round(Number(livro.preco_parceiro) * qtd * 100) / 100 : 0;

  const cabecalhoOk = nomeEnvio.trim().split(/\s+/).length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailEnvio.trim()) && tipo && mes && livro;
  const podeEnviar = cabecalhoOk && qtd > 0 && comErro.length === 0 && autorizo && !enviando;

  async function identificar(e) {
    e.preventDefault();
    setErroId('');
    setIdentificando(true);
    try {
      const r = await chamarApi('livros', { email: emailLivraria.trim() });
      if (!r.ok) { setErroId(r.json.erro || 'Não foi possível identificar a livraria.'); return; }
      setParceiro(r.json.parceiro);
      setLivros(r.json.livros || []);
      carregarEnvios(emailLivraria.trim());
    } catch {
      setErroId('Erro de conexão. Tente novamente.');
    } finally {
      setIdentificando(false);
    }
  }

  async function carregarEnvios(email = emailLivraria.trim()) {
    setCarregandoEnvios(true); setErroEnvios('');
    try {
      const r = await chamarApi('meus-envios', { email });
      if (!r.ok) { setErroEnvios(r.json.erro || 'Não foi possível carregar os envios.'); return; }
      setEnvios(r.json.envios || []);
    } catch {
      setErroEnvios('Erro de conexão. Tente novamente.');
    } finally {
      setCarregandoEnvios(false);
    }
  }

  async function aprovarEnvio(envio, nome, emailAprovador) {
    try {
      const r = await chamarApi('aprovar', { email: emailLivraria.trim(), lote_id: envio.id, nome, email_aprovador: emailAprovador });
      if (!r.ok) return { ok: false, erro: r.json.erro || 'Não foi possível aprovar.' };
      await carregarEnvios();
      return { ok: true };
    } catch {
      return { ok: false, erro: 'Erro de conexão. A aprovação NÃO foi registrada; tente novamente.' };
    }
  }

  async function carregarRastreio(envio) {
    try {
      const r = await chamarApi('rastreio', { email: emailLivraria.trim(), lote_id: envio.id });
      if (!r.ok) return { ok: false, erro: r.json.erro || 'Não foi possível carregar os códigos.' };
      return { ok: true, itens: r.json.rastreios || [] };
    } catch {
      return { ok: false, erro: 'Erro de conexão. Tente novamente.' };
    }
  }

  function baixarModelo() {
    const ws = XLSX.utils.aoa_to_sheet([CAMPOS.map((c) => c.titulo)]);
    ws['!cols'] = CAMPOS.map(() => ({ wch: 22 }));
    const info = XLSX.utils.aoa_to_sheet([
      ['Preencha uma pessoa por linha, na aba "Destinatários".'],
      ['Todas as colunas são obrigatórias, menos "Complemento".'],
      ['Se o endereço não tiver número, escreva S/N.'],
      ['Não apague nem renomeie os títulos das colunas.'],
    ]);
    info['!cols'] = [{ wch: 70 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Destinatários');
    XLSX.utils.book_append_sheet(wb, info, 'Instruções');
    XLSX.writeFile(wb, 'modelo-envio-brindes.xlsx');
  }

  async function lerArquivo(e) {
    const arquivo = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!arquivo) return;
    setErroArquivo(''); setErroEnvio(''); setErrosServidor([]); setLinhas([]); setArquivoNome('');
    if (arquivo.size > 5 * 1024 * 1024) { setErroArquivo('Arquivo muito grande (máximo 5 MB).'); return; }
    try {
      const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
      const aba = wb.Sheets[wb.SheetNames[0]];
      const matriz = XLSX.utils.sheet_to_json(aba, { header: 1, raw: false, defval: '' });
      const r = lerLinhas(matriz);
      setArquivoNome(arquivo.name);
      if (r.erroArquivo) { setErroArquivo(r.erroArquivo); return; }
      if (r.linhas.length === 0) { setErroArquivo('A planilha não tem nenhuma pessoa.'); return; }
      if (r.linhas.length > 500) { setErroArquivo('Máximo de 500 pessoas por envio. Divida a planilha em partes.'); return; }
      setLinhas(r.linhas);
    } catch {
      setErroArquivo('Não consegui ler este arquivo. Use o modelo (.xlsx) ou um .csv.');
    }
  }

  async function enviar() {
    setEnviando(true); setErroEnvio(''); setErrosServidor([]);
    try {
      const r = await chamarApi('enviar', {
        email: emailLivraria.trim(),
        enviado_por_nome: nomeEnvio.trim(),
        enviado_por_email: emailEnvio.trim(),
        tipo, mes_referencia: mes, livro_id: livro.livro_id,
        observacoes: observacoes.trim(),
        destinatarios: linhas.map((l) => ({ ...l.dados, _linha: l._linha })),
      });
      if (r.ok && r.json.ok) {
        setSucesso(r.json);
        carregarEnvios();
        setLinhas([]); setArquivoNome(''); // não mantém dados pessoais na tela
        return;
      }
      setErroEnvio(r.json.erro || 'Não foi possível enviar. Tente novamente.');
      if (Array.isArray(r.json.erros)) setErrosServidor(r.json.erros);
    } catch {
      setErroEnvio('Erro de conexão. Seu envio NÃO foi concluído; tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  function novoEnvio() {
    setSucesso(null); setLinhas([]); setArquivoNome(''); setAutorizo(false);
    setErroEnvio(''); setErrosServidor([]); setObservacoes(''); setAba('novo');
  }
  function verEnvios() {
    novoEnvio();
    setAba('meus');
  }

  // ───────────── Telas ─────────────
  if (!parceiro) {
    return (
      <div style={s.page}><div style={s.wrap}>
        <h1 style={s.h1}>Envio de brindes</h1>
        <p style={s.muted}>CEDET Livros — envio de livros-brinde para os alunos da sua comunidade.</p>
        <form onSubmit={identificar} style={{ ...s.card, maxWidth: 480, marginTop: 24 }}>
          <h2 style={s.h2}>Identifique sua livraria</h2>
          <label style={s.label} htmlFor="emailLivraria">E-mail cadastrado na CEDET</label>
          <input id="emailLivraria" style={s.input} type="email" value={emailLivraria} onChange={(e) => setEmailLivraria(e.target.value)} placeholder="livraria@exemplo.com.br" required />
          {erroId && <div style={s.box(COLORS.errorLight, COLORS.error)}><AlertCircle size={14} /> {erroId}</div>}
          <div style={{ marginTop: 16 }}>
            <button type="submit" style={{ ...s.btn, ...(identificando ? s.btnOff : {}) }} disabled={identificando}>
              {identificando ? <Loader2 size={16} /> : <Check size={16} />} Continuar
            </button>
          </div>
        </form>
      </div></div>
    );
  }

  if (sucesso) return <TelaSucesso sucesso={sucesso} onNovo={novoEnvio} onVerEnvios={verEnvios} />;

  return (
    <div style={s.page}><div style={s.wrap}>
      <h1 style={s.h1}>Envio de brindes</h1>
      <p style={s.muted}>Livraria: <strong>{parceiro.nome}</strong></p>

      <div role="tablist" style={{ display: 'flex', gap: 8, margin: '18px 0 20px', borderBottom: `1px solid ${COLORS.border}` }}>
        {[['novo', 'Novo envio'], ['meus', 'Meus envios']].map(([k, r]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
            style={{ background: 'none', border: 'none', borderBottom: aba === k ? `3px solid ${COLORS.primary}` : '3px solid transparent', padding: '10px 14px', fontSize: 16, fontWeight: aba === k ? 700 : 500, fontFamily: FONTS.body, color: aba === k ? COLORS.text : COLORS.textLight, cursor: 'pointer' }}>
            {r}
            {k === 'meus' && envios.filter((e) => e.status === 'aguardando_aprovacao').length > 0 && (
              <span style={{ marginLeft: 8, background: COLORS.gold, color: COLORS.text, borderRadius: 999, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>
                {envios.filter((e) => e.status === 'aguardando_aprovacao').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {aba === 'meus' && (
        <MeusEnvios envios={envios} carregando={carregandoEnvios} erro={erroEnvios}
          onAtualizar={() => carregarEnvios()} onAprovar={aprovarEnvio} onCarregarRastreio={carregarRastreio} nomePadrao={nomeEnvio} emailPadrao={emailEnvio} />
      )}

      {aba === 'novo' && (<>
      <div style={{ ...s.card, marginTop: 0 }}>
        <h2 style={s.h2}>1. Sobre este envio</h2>
        <div style={s.grid}>
          <div>
            <label style={s.label} htmlFor="nomeEnvio">Seu nome completo (quem está enviando)</label>
            <input id="nomeEnvio" style={s.input} value={nomeEnvio} onChange={(e) => setNomeEnvio(e.target.value)} />
          </div>
          <div>
            <label style={s.label} htmlFor="emailEnvio">Seu e-mail</label>
            <input id="emailEnvio" style={s.input} type="email" value={emailEnvio} onChange={(e) => setEmailEnvio(e.target.value)} />
          </div>
          <div>
            <label style={s.label} htmlFor="tipo">Tipo de envio</label>
            <select id="tipo" style={s.input} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Selecione…</option>
              <option value="aluno_novo">Aluno novo</option>
              <option value="renovacao">Renovação</option>
            </select>
          </div>
          <div>
            <label style={s.label} htmlFor="mes">Mês de referência</label>
            <input id="mes" style={s.input} type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={s.label} htmlFor="livro"><BookOpen size={13} /> Livro do brinde</label>
          <select id="livro" style={s.input} value={livroId} onChange={(e) => setLivroId(e.target.value)}>
            <option value="">Selecione…</option>
            {livros.map((l) => (
              <option key={l.livro_id} value={l.livro_id}>
                {l.titulo} — {formatarMoeda(l.preco_parceiro)}
              </option>
            ))}
          </select>
          {livros.length === 0 && <div style={s.box(COLORS.warnLight, COLORS.gold)}>Sua livraria ainda não tem livros liberados para brinde. Fale com a equipe CEDET.</div>}
          {livro && (
            <p style={s.muted}>
              Preço de capa {formatarMoeda(livro.preco_capa)} · desconto {Number(livro.desconto_percentual)}% ·
              {' '}<strong>seu preço {formatarMoeda(livro.preco_parceiro)} por livro</strong>
            </p>
          )}
        </div>
      </div>

      <div style={s.card}>
        <h2 style={s.h2}>2. Planilha dos alunos</h2>
        <p style={s.muted}>Use o modelo: uma pessoa por linha. Todas as colunas são obrigatórias, menos "Complemento".</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          <button style={{ ...s.btn, ...s.btnGhost }} onClick={baixarModelo}><Download size={16} /> Baixar modelo</button>
          <label style={{ ...s.btn, cursor: 'pointer' }}>
            <Upload size={16} /> Escolher planilha
            <input type="file" accept=".xlsx,.xls,.csv" onChange={lerArquivo} style={{ display: 'none' }} />
          </label>
        </div>
        {arquivoNome && <p style={s.muted}><FileSpreadsheet size={14} /> {arquivoNome}</p>}
        {erroArquivo && <div style={s.box(COLORS.errorLight, COLORS.error)}><AlertCircle size={14} /> {erroArquivo}</div>}

        {qtd > 0 && (
          <>
            <div style={comErro.length ? s.box(COLORS.errorLight, COLORS.error) : s.box(COLORS.successLight, COLORS.success)}>
              {comErro.length
                ? <><strong>{comErro.length}</strong> {comErro.length === 1 ? 'linha tem' : 'linhas têm'} erro. Corrija na sua planilha e escolha o arquivo de novo.</>
                : <><Check size={14} /> {qtd} {qtd === 1 ? 'pessoa conferida' : 'pessoas conferidas'}, sem erros.</>}
            </div>

            {comErro.length > 0 && (
              <ul style={{ fontSize: 13, margin: '12px 0', paddingLeft: 18 }}>
                {comErro.slice(0, 60).map((l) => (
                  <li key={l._linha}>
                    <strong>Linha {l._linha}</strong> ({l.dados.nome_completo || 'sem nome'}): {l.erros.map((e) => e.mensagem).join('; ')}
                  </li>
                ))}
                {comErro.length > 60 && <li>… e mais {comErro.length - 60} linhas com erro.</li>}
              </ul>
            )}

            <div style={{ overflow: 'auto', maxHeight: 340, border: `1px solid ${COLORS.border}`, borderRadius: 8, marginTop: 12 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr>
                  <th style={s.th}>Linha</th><th style={s.th}>Nome</th><th style={s.th}>CPF</th>
                  <th style={s.th}>Telefone</th><th style={s.th}>CEP</th><th style={s.th}>Cidade/UF</th><th style={s.th}>Status</th>
                </tr></thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l._linha} style={{ background: l.erros.length ? COLORS.errorLight : 'transparent' }}>
                      <td style={s.td}>{l._linha}</td>
                      <td style={s.td}>{l.dados.nome_completo}</td>
                      <td style={s.td}>{mascararCpf(l.dados.cpf)}</td>
                      <td style={s.td}>{l.dados.telefone}</td>
                      <td style={s.td}>{l.dados.cep}</td>
                      <td style={s.td}>{l.dados.cidade}/{l.dados.uf}</td>
                      <td style={s.td}>{l.erros.length ? 'Corrigir' : 'OK'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={s.card}>
        <h2 style={s.h2}>3. Resumo e envio</h2>
        {livro && qtd > 0 ? (
          <>
            <p style={{ margin: '0 0 4px' }}>{qtd} × {formatarMoeda(livro.preco_parceiro)} = <strong>{formatarMoeda(valorTotal)}</strong> em livros</p>
            <p style={s.muted}>Frete: a calcular pela CEDET (informaremos antes de enviar).</p>
          </>
        ) : <p style={s.muted}>Escolha o livro e a planilha para ver o valor.</p>}

        <label style={{ ...s.label, marginTop: 14 }} htmlFor="obs">Observações (opcional)</label>
        <input id="obs" style={s.input} value={observacoes} maxLength={500} onChange={(e) => setObservacoes(e.target.value)} />

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, marginTop: 14 }}>
          <input type="checkbox" checked={autorizo} onChange={(e) => setAutorizo(e.target.checked)} style={{ marginTop: 3 }} />
          <span>Confirmo que tenho autorização para enviar estes dados à CEDET, apenas para o envio do livro-brinde.</span>
        </label>

        {erroEnvio && (
          <div style={s.box(COLORS.errorLight, COLORS.error)}>
            <AlertCircle size={14} /> {erroEnvio}
            {errosServidor.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {errosServidor.slice(0, 30).map((e, i) => <li key={i}>Linha {e.linha}: {e.mensagem}</li>)}
              </ul>
            )}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button style={{ ...s.btn, ...(podeEnviar ? {} : s.btnOff) }} disabled={!podeEnviar} onClick={enviar}>
            {enviando ? <Loader2 size={16} /> : <Send size={16} />} Enviar para a CEDET
          </button>
          {!podeEnviar && !enviando && (
            <p style={s.muted}>
              {!cabecalhoOk ? 'Preencha a seção 1 (nome completo, e-mail, tipo, mês e livro).'
                : qtd === 0 ? 'Escolha a planilha.'
                : comErro.length > 0 ? 'Corrija os erros da planilha.'
                : 'Marque a confirmação para enviar.'}
            </p>
          )}
        </div>
      </div>
      </>)}
    </div></div>
  );
}
