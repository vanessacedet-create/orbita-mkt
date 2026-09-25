-- Vitrine: disponibilidade por estoque importado de planilha
-- Mantém o estoque da Vitrine inteiramente dentro do projeto Órbita.

ALTER TABLE public.vitrine_livros
  ADD COLUMN IF NOT EXISTS estoque_disponivel integer NOT NULL DEFAULT 0
    CHECK (estoque_disponivel >= 0),
  ADD COLUMN IF NOT EXISTS estoque_atualizado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_vitrine_livros_estoque
  ON public.vitrine_livros (estoque_disponivel);

-- Catálogo público: somente títulos ativos e fisicamente disponíveis.
-- A função já existia no banco com outro tipo de retorno; por isso ela
-- precisa ser removida antes de ser recriada com o formato atual.
DROP FUNCTION IF EXISTS public.vitrine_catalogo();

CREATE FUNCTION public.vitrine_catalogo()
RETURNS SETOF public.vitrine_livros
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.*
  FROM public.vitrine_livros l
  WHERE COALESCE(l.ativo, true) = true
    AND COALESCE(l.estoque_disponivel, 0) > 0
  ORDER BY COALESCE(l.destaque, false) DESC, l.titulo ASC;
$$;

GRANT EXECUTE ON FUNCTION public.vitrine_catalogo() TO anon, authenticated;

-- Seleções personalizadas também respeitam o estoque no momento em que
-- o parceiro abre o link.
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
      WHEN s.status = 'aberta' AND s.expira_em IS NOT NULL AND s.expira_em < now()
        THEN 'expirada'
      ELSE s.status
    END,
    'expira_em', s.expira_em,
    'respondido_em', s.respondido_em,
    'resposta_livros', COALESCE(to_jsonb(s.resposta_livros), '[]'::jsonb),
    'parceiro', jsonb_build_object(
      'id', p.id,
      'nome', p.nome,
      'email', p.email
    ),
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
          'data_lancamento', l.data_lancamento,
          'estoque_disponivel', l.estoque_disponivel
        )
        ORDER BY l.titulo
      )
      FROM public.vitrine_selecao_livros sl
      JOIN public.vitrine_livros l ON l.id = sl.livro_id
      WHERE sl.selecao_id = s.id
        AND COALESCE(l.ativo, true) = true
        AND COALESCE(l.estoque_disponivel, 0) > 0
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
