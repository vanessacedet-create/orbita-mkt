// GET /api/envio-brindes/baixar?lote_id=123   (só equipe logada)
// Devolve a planilha do lote (com CPF e endereço) direto do Google Drive
// e registra a data do primeiro download (necessária para apagar os dados depois).
const { clienteServidor } = require('../_lib/supabase');
const { exigirEquipe } = require('../_lib/auth');
const { baixarArquivo } = require('../_lib/drive');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  try {
    const supabase = clienteServidor();
    await exigirEquipe(req, supabase);

    const loteId = Number(req.query && req.query.lote_id);
    if (!Number.isInteger(loteId) || loteId <= 0) return res.status(400).json({ erro: 'Lote inválido.' });

    const { data: lote } = await supabase
      .from('envio_brinde_lotes')
      .select('id, drive_arquivo_id, drive_arquivo_nome, baixado_em, dados_apagados_em')
      .eq('id', loteId).single();
    if (!lote) return res.status(404).json({ erro: 'Lote não encontrado.' });
    if (lote.dados_apagados_em || !lote.drive_arquivo_id)
      return res.status(410).json({ erro: 'Os dados pessoais deste lote já foram apagados.' });

    const buffer = await baixarArquivo(lote.drive_arquivo_id);

    if (!lote.baixado_em) {
      await supabase.from('envio_brinde_lotes')
        .update({ baixado_em: new Date().toISOString() }).eq('id', loteId).is('baixado_em', null);
    }

    const nome = String(lote.drive_arquivo_nome || `lote-${loteId}.xlsx`).replace(/[^\w.\-]+/g, '_');
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    return res.status(200).send(buffer);
  } catch (e) {
    return res.status(e.status || 500).json({ erro: e.status ? e.message : 'Erro inesperado ao baixar.' });
  }
};
