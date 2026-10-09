// POST /api/envio-brindes/aprovar
// corpo: { "email": "<e-mail da livraria>", "lote_id": 123, "nome": "...", "email_aprovador": "..." }
// A livraria aprova o valor final (livros + frete) de um envio que está aguardando aprovação.
const { clienteServidor } = require('../_lib/supabase');
const { identificarParceiro, EMAIL_VALIDO } = require('../_lib/parceiro');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  try {
    const b = req.body || {};
    const loteId = Number(b.lote_id);
    const nome = String(b.nome || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const emailAprovador = String(b.email_aprovador || '').trim().toLowerCase().slice(0, 200);
    if (!Number.isInteger(loteId) || loteId <= 0) return res.status(400).json({ erro: 'Envio inválido.' });
    if (nome.split(' ').filter(Boolean).length < 2) return res.status(400).json({ erro: 'Informe seu nome completo.' });
    if (!EMAIL_VALIDO.test(emailAprovador)) return res.status(400).json({ erro: 'Informe seu e-mail.' });

    const supabase = clienteServidor();
    const parceiro = await identificarParceiro(supabase, b.email);
    if (!parceiro) return res.status(404).json({ erro: 'E-mail da livraria não encontrado.' });

    const { error } = await supabase.rpc('envio_brinde_aprovar', {
      p_parceiro_id: parceiro.id, p_lote_id: loteId, p_nome: nome, p_email: emailAprovador,
    });
    if (error) return res.status(422).json({ erro: error.message || 'Não foi possível aprovar.' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(e.status || 500).json({ erro: 'Erro inesperado. Tente novamente.' });
  }
};
