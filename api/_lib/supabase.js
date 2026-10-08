// Cliente do Supabase para as funções do servidor (Vercel).
// Usa a chave service_role, que IGNORA as regras de acesso do banco:
// por isso este arquivo nunca deve ser importado pelo código do navegador (src/).
const { createClient } = require('@supabase/supabase-js');

function clienteServidor() {
  const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    const e = new Error('Configuração do banco ausente no servidor.');
    e.status = 500;
    throw e;
  }
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

module.exports = { clienteServidor };
