// Identifica a livraria pelo e-mail (mesma regra da Vitrine). Devolve { id, nome } ou null.
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function identificarParceiro(supabase, emailBruto) {
  const email = String(emailBruto || '').trim().toLowerCase();
  if (!EMAIL_VALIDO.test(email) || email.length > 200) return null;
  const { data, error } = await supabase.rpc('vitrine_identificar', { p_email: email });
  const p = Array.isArray(data) ? data[0] : data;
  if (error || !p || !p.id) return null;
  return { id: p.id, nome: p.nome };
}

module.exports = { identificarParceiro, EMAIL_VALIDO };
