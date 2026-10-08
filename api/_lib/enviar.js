// POST /api/envio-brindes/enviar
// Recebe os destinatários já digitados/lidos da planilha, valida TUDO no servidor,
// grava a planilha no Google Drive e registra o lote no banco (só nomes e valores).
// Se o registro no banco falhar depois de gravar no Drive, o arquivo é apagado.
const { clienteServidor } = require('../_lib/supabase');
const { garantirPasta, enviarArquivo, apagarArquivo } = require('../_lib/drive');
const { validarDestinatario } = require('../_lib/validacao');
const { montarPlanilha, TIPOS } = require('../_lib/planilha');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_PESSOAS = 500;
const MAX_ERROS = 100;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const limpa = (v, max = 200) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const slug = (s) =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });

  let arquivoGravado = null;
  try {
    const b = req.body || {};

    // 1) Cabeçalho do lote
    const email = limpa(b.email).toLowerCase();
    const enviadoPorNome = limpa(b.enviado_por_nome);
    const enviadoPorEmail = limpa(b.enviado_por_email).toLowerCase();
    const tipo = limpa(b.tipo, 20);
    const mes = limpa(b.mes_referencia, 7); // AAAA-MM
    const livroId = Number(b.livro_id);
    const observacoes = limpa(b.observacoes, 500);

    if (!EMAIL.test(email)) return res.status(400).json({ erro: 'E-mail da livraria inválido.' });
    if (!enviadoPorNome || enviadoPorNome.split(' ').length < 2)
      return res.status(400).json({ erro: 'Informe o nome completo de quem está enviando.' });
    if (!EMAIL.test(enviadoPorEmail))
      return res.status(400).json({ erro: 'Informe o e-mail de quem está enviando.' });
    if (!TIPOS[tipo]) return res.status(400).json({ erro: 'Escolha o tipo: aluno novo ou renovação.' });
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return res.status(400).json({ erro: 'Mês de referência inválido.' });
    if (!Number.isInteger(livroId) || livroId <= 0) return res.status(400).json({ erro: 'Escolha o livro.' });

    const lista = Array.isArray(b.destinatarios) ? b.destinatarios : [];
    if (lista.length < 1) return res.status(400).json({ erro: 'A planilha não tem nenhuma pessoa.' });
    if (lista.length > MAX_PESSOAS)
      return res.status(400).json({ erro: `Máximo de ${MAX_PESSOAS} pessoas por envio.` });

    // 2) Validação linha a linha (+ CPF repetido no mesmo lote)
    const erros = [];
    const limpos = [];
    const cpfsVistos = new Map();
    lista.forEach((item, i) => {
      const linha = Number(item && item._linha) || i + 2; // linha 1 = cabeçalho
      const r = validarDestinatario(item || {});
      r.erros.forEach((e) => erros.push({ linha, campo: e.campo, mensagem: e.mensagem }));
      if (r.dados.cpf && !r.erros.some((e) => e.campo === 'cpf')) {
        if (cpfsVistos.has(r.dados.cpf))
          erros.push({ linha, campo: 'cpf', mensagem: `CPF repetido (também na linha ${cpfsVistos.get(r.dados.cpf)})` });
        else cpfsVistos.set(r.dados.cpf, linha);
      }
      limpos.push(r.dados);
    });
    if (erros.length > 0) {
      return res.status(422).json({
        erro: 'A planilha tem erros. Corrija e envie de novo.',
        total_erros: erros.length,
        erros: erros.slice(0, MAX_ERROS),
      });
    }

    // 3) Livraria e livro (preço calculado no banco)
    const supabase = clienteServidor();
    const { data: rows, error: errId } = await supabase.rpc('vitrine_identificar', { p_email: email });
    const parceiro = Array.isArray(rows) ? rows[0] : rows;
    if (errId || !parceiro || !parceiro.id)
      return res.status(404).json({ erro: 'E-mail da livraria não encontrado.' });

    const { data: livros, error: errLivros } = await supabase.rpc('envio_brinde_livros_do_parceiro', {
      p_parceiro_id: parceiro.id,
    });
    if (errLivros) return res.status(500).json({ erro: 'Não foi possível conferir o livro. Tente novamente.' });
    const livro = (livros || []).find((l) => Number(l.livro_id) === livroId);
    if (!livro) return res.status(422).json({ erro: 'Este livro não tem desconto cadastrado para a sua livraria.' });

    // 4) Grava a planilha no Drive
    const buffer = montarPlanilha({
      livraria: parceiro.nome, enviadoPorNome, enviadoPorEmail, tipo, mes,
      livroTitulo: livro.titulo, precoUnitario: Number(livro.preco_parceiro), destinatarios: limpos,
    });
    const nomeArquivo = `${slug(parceiro.nome)}_${mes}_${tipo}_${Date.now().toString(36)}.xlsx`;
    const pastaId = await garantirPasta();
    const arquivo = await enviarArquivo({ pastaId, nome: nomeArquivo, buffer, mimeType: XLSX_MIME });
    arquivoGravado = arquivo.id;

    // 5) Registra o lote (só nomes e valores) — o preço é recalculado no banco
    const { data: loteId, error: errLote } = await supabase.rpc('envio_brinde_registrar_lote', {
      p_parceiro_id: parceiro.id,
      p_enviado_por_nome: enviadoPorNome,
      p_enviado_por_email: enviadoPorEmail,
      p_tipo: tipo,
      p_mes_referencia: `${mes}-01`,
      p_livro_id: livroId,
      p_nomes: limpos.map((d) => d.nome_completo),
      p_drive_arquivo_id: arquivo.id,
      p_drive_arquivo_nome: arquivo.name,
      p_observacoes: observacoes || null,
    });
    if (errLote) {
      await apagarArquivo(arquivo.id).catch(() => {}); // desfaz: não deixa dado pessoal órfão no Drive
      arquivoGravado = null;
      return res.status(422).json({ erro: errLote.message || 'Não foi possível registrar o envio.' });
    }
    arquivoGravado = null; // sucesso: o arquivo fica no Drive até a equipe baixar

    const qtd = limpos.length;
    const preco = Number(livro.preco_parceiro);
    return res.status(200).json({
      ok: true,
      lote_id: loteId,
      quantidade: qtd,
      livro: livro.titulo,
      preco_capa: Number(livro.preco_capa),
      desconto_percentual: Number(livro.desconto_percentual),
      preco_unitario: preco,
      valor_livros: Math.round(preco * qtd * 100) / 100,
      frete: 'a calcular pela CEDET',
    });
  } catch (e) {
    if (arquivoGravado) await apagarArquivo(arquivoGravado).catch(() => {});
    return res.status(e.status || 500).json({ erro: 'Erro inesperado ao enviar. Tente novamente.' });
  }
};
