// POST /api/envio-brindes/meus-envios   corpo: { "email": "..." }
// Lista os envios da livraria: SÓ totais, sem nomes de alunos e sem frete por pessoa.
// O frete e o valor final só aparecem depois que a equipe manda o envio para aprovação.
const { clienteServidor } = require('../_lib/supabase');
const { identificarParceiro } = require('../_lib/parceiro');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  try {
    const supabase = clienteServidor();
    const parceiro = await identificarParceiro(supabase, req.body && req.body.email);
    if (!parceiro) return res.status(404).json({ erro: 'E-mail não encontrado.' });

    const { data, error } = await supabase.rpc('envio_brinde_meus_lotes', { p_parceiro_id: parceiro.id });
    if (error) return res.status(500).json({ erro: 'Não foi possível carregar os envios.' });
    return res.status(200).json({ parceiro, envios: data || [] });
  } catch (e) {
    return res.status(e.status || 500).json({ erro: 'Erro inesperado. Tente novamente.' });
  }
};
