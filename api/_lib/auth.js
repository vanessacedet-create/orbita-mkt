// Confere se quem chama a função está na LISTA DE AUTORIZADAS do módulo de brindes.
// 1) valida a sessão (token no cabeçalho Authorization: Bearer ...);
// 2) confere se o usuário está na tabela envio_brinde_equipe.
// Essa tabela só é alterada pelo SQL Editor do Supabase (Bloco 4): nenhum usuário do Órbita
// consegue se incluir nela, ao contrário do campo "perfil" da tabela usuarios.

function falhar(mensagem, status) {
  const e = new Error(mensagem);
  e.status = status;
  return e;
}

async function exigirEquipe(req, supabase) {
  const cab = String((req.headers && req.headers.authorization) || '');
  const token = cab.startsWith('Bearer ') ? cab.slice(7).trim() : '';
  if (!token) throw falhar('Faça login no Órbita.', 401);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data || !data.user) throw falhar('Sessão inválida. Entre novamente.', 401);

  const { data: autorizada, error: errLista } = await supabase
    .from('envio_brinde_equipe').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (errLista || !autorizada) throw falhar('Sem permissão para este módulo.', 403);

  const { data: u } = await supabase.from('usuarios').select('nome').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, nome: (u && u.nome) || '' };
}

module.exports = { exigirEquipe };
