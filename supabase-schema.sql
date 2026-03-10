-- ═══════════════════════════════════════════════════════════════
-- ORBITA MKT — Script SQL para o Supabase
-- Cole este script no SQL Editor do seu projeto Supabase
-- ═══════════════════════════════════════════════════════════════

-- Tabela de Usuários (perfis ligados ao auth do Supabase)
CREATE TABLE IF NOT EXISTS usuarios (
  id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome      text NOT NULL,
  email     text,
  perfil    text NOT NULL DEFAULT 'assistente'
              CHECK (perfil IN ('administrador','gerente','analista','assistente')),
  created_at timestamptz DEFAULT now()
);

-- Trigger: cria o perfil automaticamente quando um usuário confirma o e-mail
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuarios (id, nome, email, perfil)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'perfil', 'assistente')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Tabela de Parceiros
CREATE TABLE IF NOT EXISTS parceiros (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome         text NOT NULL,
  email        text,
  canal        text,
  tipo         text,
  seguidores   integer,
  observacoes  text,
  created_at   timestamptz DEFAULT now()
);

-- Tabela de Livros
CREATE TABLE IF NOT EXISTS livros (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo      text NOT NULL,
  autor       text,
  isbn        text,
  editora     text,
  ano         integer,
  sinopse     text,
  created_at  timestamptz DEFAULT now()
);

-- Tabela de Envios
CREATE TABLE IF NOT EXISTS envios (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  parceiro_id  uuid REFERENCES parceiros(id) ON DELETE CASCADE,
  livro_id     uuid REFERENCES livros(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'enviado'
                CHECK (status IN ('enviado','divulgado','cancelado')),
  data_envio   date,
  observacoes  text,
  created_at   timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_envios_parceiro ON envios(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_envios_livro    ON envios(livro_id);
CREATE INDEX IF NOT EXISTS idx_envios_status   ON envios(status);

-- ───────────────────────────────────────────────────────────────
-- Row Level Security
-- ───────────────────────────────────────────────────────────────
ALTER TABLE usuarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE parceiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros    ENABLE ROW LEVEL SECURITY;
ALTER TABLE envios    ENABLE ROW LEVEL SECURITY;

-- Apenas usuários autenticados podem acessar
CREATE POLICY "auth_only" ON usuarios  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_only" ON parceiros FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_only" ON livros    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_only" ON envios    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
