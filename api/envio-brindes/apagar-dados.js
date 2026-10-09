// POST /api/envio-brindes/apagar-dados   corpo: { "lote_id": 123 }   (só equipe logada)
// Botão "Confirmar que baixei e apagar dados pessoais": apaga a planilha do Google Drive
// e registra no lote que os dados foram apagados. Exige que a planilha já tenha sido baixada.
const { clienteServidor } = require('../_lib/supabase');
const { exigirEquipe } = require('../_lib/auth');
const { apagarArquivo } = require('../_lib/drive');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  try {
    const supabase = clienteServidor();
    await exigirEquipe(req, supabase);

    const loteId = Number(req.body && req.body.lote_id);
    if (!Number.isInteger(loteId) || loteId <= 0) return res.status(400).json({ erro: 'Lote inválido.' });

    const { data: lote } = await supabase
      .from('envio_brinde_lotes')
      .select('id, drive_arquivo_id, baixado_em, dados_apagados_em')
      .eq('id', loteId).single();
    if (!lote) return res.status(404).json({ erro: 'Lote não encontrado.' });
    if (lote.dados_apagados_em) return res.status(409).json({ erro: 'Os dados deste lote já foram apagados.' });
    if (!lote.baixado_em) return res.status(409).json({ erro: 'Baixe a planilha antes de apagar os dados.' });

    if (lote.drive_arquivo_id) await apagarArquivo(lote.drive_arquivo_id); // 404 = já não existe: ok

    const { error } = await supabase.rpc('envio_brinde_marcar_apagado', { p_lote_id: loteId });
    if (error) {
      return res.status(500).json({ erro: 'O arquivo foi apagado do Drive, mas o registro falhou. Clique de novo para concluir.' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(e.status || 500).json({ erro: e.status ? e.message : 'Erro inesperado ao apagar.' });
  }
};
