import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, Send, Check, AlertCircle, Loader2, BookOpen, FileSpreadsheet } from 'lucide-react';
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
    } catch {
      setErroId('Erro de conexão. Tente novamente.');
    } finally {
      setIdentificando(false);
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
    setErroEnvio(''); setErrosServidor([]); setObservacoes('');
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

  if (sucesso) {
    return (
      <div style={s.page}><div style={s.wrap}>
        <div style={{ ...s.card, maxWidth: 560 }}>
          <h1 style={s.h1}><Check size={26} color={COLORS.success} /> Envio recebido</h1>
          <p>Recebemos <strong>{sucesso.quantidade}</strong> {sucesso.quantidade === 1 ? 'pessoa' : 'pessoas'} para o livro <strong>{sucesso.livro}</strong>.</p>
          <p style={s.muted}>
            Preço de capa {formatarMoeda(sucesso.preco_capa)} com {sucesso.desconto_percentual}% de desconto:
            {' '}{formatarMoeda(sucesso.preco_unitario)} por livro.
          </p>
          <p><strong>Valor dos livros: {formatarMoeda(sucesso.valor_livros)}</strong><br />
            <span style={s.muted}>Frete: a calcular pela CEDET. Entraremos em contato com o valor final.</span></p>
          <p style={s.muted}>Protocolo do envio: nº {sucesso.lote_id}. <strong>Não envie esta mesma planilha de novo.</strong></p>
          <button style={s.btn} onClick={novoEnvio}>Fazer outro envio</button>
        </div>
      </div></div>
    );
  }

  return (
    <div style={s.page}><div style={s.wrap}>
      <h1 style={s.h1}>Envio de brindes</h1>
      <p style={s.muted}>Livraria: <strong>{parceiro.nome}</strong></p>

      <div style={{ ...s.card, marginTop: 20 }}>
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
    </div></div>
  );
}
