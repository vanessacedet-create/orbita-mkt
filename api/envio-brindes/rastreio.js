// POST /api/envio-brindes/rastreio   corpo: { "email": "<e-mail da livraria>", "lote_id": 123 }
// Devolve nome + código de rastreio de um envio DA PRÓPRIA livraria, só quando o envio está "enviado".
const { clienteServidor } = require('../_lib/supabase');
const { identificarParceiro } = require('../_lib/parceiro');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  try {
    const b = req.body || {};
    const loteId = Number(b.lote_id);
    if (!Number.isInteger(loteId) || loteId <= 0) return res.status(400).json({ erro: 'Envio inválido.' });

    const supabase = clienteServidor();
    const parceiro = await identificarParceiro(supabase, b.email);
    if (!parceiro) return res.status(404).json({ erro: 'E-mail da livraria não encontrado.' });

    const { data, error } = await supabase.rpc('envio_brinde_rastreios_do_lote', {
      p_parceiro_id: parceiro.id, p_lote_id: loteId,
    });
    if (error) return res.status(500).json({ erro: 'Não foi possível carregar os códigos de rastreio.' });
    return res.status(200).json({ rastreios: data || [] });
  } catch (e) {
    return res.status(e.status || 500).json({ erro: 'Erro inesperado. Tente novamente.' });
  }
};
