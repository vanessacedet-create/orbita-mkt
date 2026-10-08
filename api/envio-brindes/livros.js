// POST /api/envio-brindes/livros   corpo: { "email": "..." }
// Identifica a livraria pelo e-mail (mesma regra da Vitrine) e devolve os livros
// que têm desconto cadastrado, já com o preço de capa e o preço do parceiro.
const { clienteServidor } = require('../_lib/supabase');

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido.' });
  }

  try {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    if (!EMAIL_VALIDO.test(email) || email.length > 200) {
      return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    }

    const supabase = clienteServidor();

    const { data: rows, error: errId } = await supabase.rpc('vitrine_identificar', { p_email: email });
    const parceiro = Array.isArray(rows) ? rows[0] : rows;
    if (errId || !parceiro || !parceiro.id) {
      return res.status(404).json({
        erro: 'E-mail não encontrado. Verifique seus dados ou fale com a equipe CEDET.',
      });
    }

    const { data: livros, error: errLivros } = await supabase.rpc('envio_brinde_livros_do_parceiro', {
      p_parceiro_id: parceiro.id,
    });
    if (errLivros) {
      return res.status(500).json({ erro: 'Não foi possível carregar os livros. Tente novamente.' });
    }

    return res.status(200).json({
      parceiro: { id: parceiro.id, nome: parceiro.nome },
      livros: livros || [],
    });
  } catch (e) {
    return res.status(e.status || 500).json({ erro: 'Erro inesperado. Tente novamente.' });
  }
};
