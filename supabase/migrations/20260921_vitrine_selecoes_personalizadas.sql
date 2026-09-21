-- Vitrine: seleções personalizadas por parceiro
-- Cria curadorias com link exclusivo e escolha exata de X títulos (1 unidade por título).

CREATE TABLE IF NOT EXISTS public.vitrine_selecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  parceiro_id bigint NOT NULL,
  nome text NOT NULL,
  quantidade_titulos integer NOT NULL CHECK (quantidade_titulos > 0),
  status text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'respondida', 'encerrada')),
  expira_em timestamptz,
  resposta_livros bigint[],
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vitrine_selecao_livros (
  selecao_id uuid NOT NULL REFERENCES public.vitrine_selecoes(id) ON DELETE CASCADE,
  livro_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (selecao_id, livro_id)
);

CREATE INDEX IF NOT EXISTS idx_vitrine_selecoes_parceiro
  ON public.vitrine_selecoes(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_vitrine_selecoes_status
  ON public.vitrine_selecoes(status);
CREATE INDEX IF NOT EXISTS idx_vitrine_selecao_livros_livro
  ON public.vitrine_selecao_livros(livro_id);

ALTER TABLE public.vitrine_selecoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitrine_selecao_livros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vitrine_selecoes_auth_manage" ON public.vitrine_selecoes;
CREATE POLICY "vitrine_selecoes_auth_manage"
  ON public.vitrine_selecoes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "vitrine_selecao_livros_auth_manage" ON public.vitrine_selecao_livros;
CREATE POLICY "vitrine_selecao_livros_auth_manage"
  ON public.vitrine_selecao_livros
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

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
          'ean', l.ean,
          'data_lancamento', l.data_lancamento
        )
        ORDER BY l.titulo
      )
      FROM public.vitrine_selecao_livros sl
      JOIN public.vitrine_livros l ON l.id = sl.livro_id
      WHERE sl.selecao_id = s.id
        AND COALESCE(l.ativo, true) = true
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

CREATE OR REPLACE FUNCTION public.vitrine_responder_selecao(
  p_token text,
  p_cpf text,
  p_contato text,
  p_cep text,
  p_endereco text,
  p_data_divulgacao date,
  p_observacoes text,
  p_livros bigint[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sel public.vitrine_selecoes%ROWTYPE;
  v_qtd integer;
  v_invalidos integer;
  v_itens jsonb;
BEGIN
  SELECT *
  INTO v_sel
  FROM public.vitrine_selecoes
  WHERE token::text = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seleção não encontrada.';
  END IF;

  IF v_sel.status <> 'aberta' THEN
    RAISE EXCEPTION 'Esta seleção não está mais disponível.';
  END IF;

  IF v_sel.expira_em IS NOT NULL AND v_sel.expira_em < now() THEN
    RAISE EXCEPTION 'Esta seleção expirou.';
  END IF;

  SELECT count(DISTINCT x)::integer
  INTO v_qtd
  FROM unnest(COALESCE(p_livros, ARRAY[]::bigint[])) AS x;

  IF v_qtd <> v_sel.quantidade_titulos THEN
    RAISE EXCEPTION 'Selecione exatamente % títulos.', v_sel.quantidade_titulos;
  END IF;

  SELECT count(*)::integer
  INTO v_invalidos
  FROM (
    SELECT DISTINCT x AS livro_id
    FROM unnest(p_livros) AS x
  ) escolhidos
  LEFT JOIN public.vitrine_selecao_livros sl
    ON sl.selecao_id = v_sel.id
   AND sl.livro_id = escolhidos.livro_id
  WHERE sl.livro_id IS NULL;

  IF v_invalidos > 0 THEN
    RAISE EXCEPTION 'Há títulos fora da seleção enviada.';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('livro_id', x, 'quantidade', 1))
  INTO v_itens
  FROM (
    SELECT DISTINCT x
    FROM unnest(p_livros) AS x
    ORDER BY x
  ) q;

  -- Reaproveita o fluxo atual de pedidos da Vitrine.
  PERFORM public.vitrine_criar_pedido(
    p_parceiro_id     => v_sel.parceiro_id,
    p_cpf             => p_cpf,
    p_contato         => p_contato,
    p_cep             => NULLIF(p_cep, ''),
    p_endereco        => NULLIF(p_endereco, ''),
    p_data_divulgacao => p_data_divulgacao,
    p_observacoes     => concat(
      '[Seleção personalizada: ', v_sel.nome, ']',
      CASE WHEN NULLIF(trim(p_observacoes), '') IS NOT NULL
        THEN ' ' || trim(p_observacoes)
        ELSE ''
      END
    ),
    p_itens           => v_itens
  );

  UPDATE public.vitrine_selecoes
  SET status = 'respondida',
      resposta_livros = ARRAY(
        SELECT DISTINCT x FROM unnest(p_livros) AS x ORDER BY x
      ),
      respondido_em = now()
  WHERE id = v_sel.id;

  RETURN jsonb_build_object('ok', true, 'selecao_id', v_sel.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vitrine_selecao_por_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vitrine_responder_selecao(
  text, text, text, text, text, date, text, bigint[]
) TO anon, authenticated;
