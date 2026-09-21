-- Atualiza o RPC público das seleções para incluir os detalhes comerciais exibidos no modal.
CREATE OR REPLACE FUNCTION public.vitrine_selecao_por_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', s.id,
    'token', s.token,
    'nome', s.nome,
    'quantidade_titulos', s.quantidade_titulos,
    'status', CASE
      WHEN s.status = 'aberta' AND s.expira_em IS NOT NULL AND s.expira_em < now() THEN 'expirada'
      ELSE s.status
    END,
    'expira_em', s.expira_em,
    'respondido_em', s.respondido_em,
    'resposta_livros', COALESCE(to_jsonb(s.resposta_livros), '[]'::jsonb),
    'parceiro', jsonb_build_object('id', p.id, 'nome', p.nome, 'email', p.email),
    'livros', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'titulo', l.titulo,
          'autor', l.autor,
          'editora', l.editora,
          'categoria', l.categoria,
          'imagem_url', l.imagem_url,
          'descricao', l.descricao,
          'preco', l.preco,
          'encadernacao', l.encadernacao,
          'ean', l.ean,
          'data_lancamento', l.data_lancamento
        ) ORDER BY l.titulo
      )
      FROM public.vitrine_selecao_livros sl
      JOIN public.vitrine_livros l ON l.id = sl.livro_id
      WHERE sl.selecao_id = s.id AND COALESCE(l.ativo, true) = true
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.vitrine_selecoes s
  JOIN public.vitrine_parceiros p ON p.id = s.parceiro_id
  WHERE s.token::text = p_token
  LIMIT 1;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vitrine_selecao_por_token(text) TO anon, authenticated;
