-- Vitrine: ciclos explícitos por parceiro.
-- Substitui o marcador escondido em observacoes por estado próprio no banco.

CREATE TABLE IF NOT EXISTS public.vitrine_ciclos (
  parceiro_id bigint PRIMARY KEY REFERENCES public.vitrine_parceiros(id) ON DELETE CASCADE,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vitrine_ciclos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vitrine_ciclos_auth_read" ON public.vitrine_ciclos;
CREATE POLICY "vitrine_ciclos_auth_read"
  ON public.vitrine_ciclos
  FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.vitrine_abrir_novo_ciclo(p_parceiro_id bigint)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agora timestamptz := now();
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Apenas a equipe autenticada pode abrir um novo ciclo.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vitrine_parceiros WHERE id = p_parceiro_id
  ) THEN
    RAISE EXCEPTION 'Parceiro não encontrado.';
  END IF;

  INSERT INTO public.vitrine_ciclos (parceiro_id, iniciado_em, atualizado_em)
  VALUES (p_parceiro_id, v_agora, v_agora)
  ON CONFLICT (parceiro_id)
  DO UPDATE SET iniciado_em = EXCLUDED.iniciado_em,
                atualizado_em = EXCLUDED.atualizado_em;

  RETURN v_agora;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vitrine_abrir_novo_ciclo(bigint) TO authenticated;

-- A Vitrine Pública continua chamando a mesma RPC. A diferença é que o início
-- da contagem passa a ser o mais recente entre o começo do mês e o ciclo
-- aberto manualmente pela equipe.
DROP FUNCTION IF EXISTS public.vitrine_saldo_mes(bigint);

CREATE FUNCTION public.vitrine_saldo_mes(p_parceiro_id bigint)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH parceiro AS (
    SELECT id, email
    FROM public.vitrine_parceiros
    WHERE id = p_parceiro_id
      AND COALESCE(ativo, true) = true
  ),
  corte AS (
    SELECT GREATEST(
      date_trunc('month', now()),
      COALESCE(
        (SELECT c.iniciado_em
         FROM public.vitrine_ciclos c
         WHERE c.parceiro_id = p_parceiro_id),
        date_trunc('month', now())
      )
    ) AS desde
  )
  SELECT COALESCE(COUNT(DISTINCT i.livro_id), 0)::integer
  FROM parceiro p
  CROSS JOIN corte c
  JOIN public.vitrine_pedidos ped
    ON lower(ped.email) = lower(p.email)
   AND ped.created_at >= c.desde
  JOIN public.vitrine_pedido_itens i
    ON i.pedido_id = ped.id;
$$;

GRANT EXECUTE ON FUNCTION public.vitrine_saldo_mes(bigint) TO anon, authenticated;
