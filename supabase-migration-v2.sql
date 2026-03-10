-- ═══════════════════════════════════════════════════════════════
-- ORBITA MKT — Migração: novos campos
-- Cole este script no SQL Editor do Supabase e clique em Run
-- ═══════════════════════════════════════════════════════════════

-- Adiciona campo tipo_parceria na tabela parceiros
ALTER TABLE parceiros
  ADD COLUMN IF NOT EXISTS tipo_parceria text;

-- Adiciona campo sku na tabela livros
ALTER TABLE livros
  ADD COLUMN IF NOT EXISTS sku text;

-- Remove campos antigos que não serão mais usados (opcional)
-- ALTER TABLE parceiros DROP COLUMN IF EXISTS canal;
-- ALTER TABLE parceiros DROP COLUMN IF EXISTS tipo;
-- ALTER TABLE parceiros DROP COLUMN IF EXISTS email;
-- ALTER TABLE parceiros DROP COLUMN IF EXISTS seguidores;
-- ALTER TABLE parceiros DROP COLUMN IF EXISTS observacoes;
-- ALTER TABLE livros DROP COLUMN IF EXISTS ano;
-- ALTER TABLE livros DROP COLUMN IF EXISTS sinopse;
