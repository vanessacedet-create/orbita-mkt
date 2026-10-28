-- Completa a capa ausente usando o SKU do catálogo oficial, verificado no S3.
UPDATE public.vitrine_livros v
SET imagem_url = 'https://cedet-publico.s3.amazonaws.com/produtos_imagem_principal/' || l.sku || '.jpg',
    produto_id = l.sku::integer,
    livro_id = l.id
FROM public.livros l
WHERE v.ean = '9788584915576'
  AND l.isbn = v.ean
  AND l.sku = '37509'
  AND nullif(trim(v.imagem_url), '') IS NULL;

-- Mantém todos os registros e suas referências em pedidos/seleções.
-- A vitrine pública apresenta somente um registro elegível por ISBN/EAN.
CREATE OR REPLACE FUNCTION public.vitrine_catalogo()
RETURNS SETOF public.vitrine_livros
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH elegiveis AS (
    SELECT l AS livro,
      row_number() OVER (
        PARTITION BY CASE
          WHEN nullif(regexp_replace(l.ean, '[^0-9]', '', 'g'), '') IS NOT NULL
            THEN 'ean:' || regexp_replace(l.ean, '[^0-9]', '', 'g')
          WHEN l.livro_id IS NOT NULL THEN 'livro:' || l.livro_id::text
          ELSE 'id:' || l.id::text
        END
        ORDER BY
          (nullif(trim(l.imagem_url), '') IS NOT NULL) DESC,
          (l.livro_id IS NOT NULL) DESC,
          (l.produto_id IS NOT NULL) DESC,
          l.updated_at DESC NULLS LAST,
          l.id DESC
      ) AS posicao
    FROM public.vitrine_livros l
    WHERE COALESCE(l.ativo, true) = true
      AND l.estoque_disponivel > 0
  )
  SELECT (e.livro).*
  FROM elegiveis e
  WHERE e.posicao = 1
  ORDER BY
    CASE WHEN (e.livro).data_lancamento >= DATE '2026-11-01'
           AND (e.livro).data_lancamento < DATE '2026-12-01'
         THEN 0 ELSE 1 END,
    COALESCE((e.livro).destaque, false) DESC,
    (e.livro).titulo ASC,
    (e.livro).id ASC;
$$;
