-- Prioridade editorial solicitada para novembro/2026.
-- Mantém a disponibilidade física e os controles de acesso existentes.
-- As datas do calendário de lançamentos são a referência para esta campanha.
UPDATE public.vitrine_livros v
SET data_lancamento = l.data_lancamento
FROM public.livros l
WHERE l.data_lancamento >= DATE '2026-11-01'
  AND l.data_lancamento < DATE '2026-12-01'
  AND (v.livro_id = l.id OR v.ean = l.isbn)
  AND v.data_lancamento IS DISTINCT FROM l.data_lancamento;

CREATE OR REPLACE FUNCTION public.vitrine_catalogo()
RETURNS SETOF public.vitrine_livros
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.*
  FROM public.vitrine_livros l
  WHERE COALESCE(l.ativo, true) = true
    AND l.estoque_disponivel > 0
  ORDER BY
    CASE WHEN l.data_lancamento >= DATE '2026-11-01'
           AND l.data_lancamento < DATE '2026-12-01'
         THEN 0 ELSE 1 END,
    COALESCE(l.destaque, false) DESC,
    l.titulo ASC,
    l.id ASC;
$$;
