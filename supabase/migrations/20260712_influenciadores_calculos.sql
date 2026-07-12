-- ============================================================
-- ORBITA MKT — CALCULADORA DE PROPOSTAS PARA INFLUENCIADORES
-- Migração ADITIVA e ISOLADA.
-- Não altera tabelas, políticas, rotas ou funções de Editoras Parceiras.
-- ============================================================

create table if not exists public.influenciadores_calculos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  nome_influenciador text not null,
  arroba text,
  plataforma text not null default 'Instagram',
  perfil_url text,
  seguidores bigint not null default 0 check (seguidores >= 0),
  visualizacoes_medias bigint not null default 0 check (visualizacoes_medias >= 0),
  alcance_medio bigint not null default 0 check (alcance_medio >= 0),
  engajamento_socialcat numeric(8,3) not null default 0 check (engajamento_socialcat >= 0),
  socialcat_url text,
  socialcat_consultado_em date,
  afinidade_editorial smallint not null default 3 check (afinidade_editorial between 1 and 5),
  qualidade_publico smallint not null default 3 check (qualidade_publico between 1 and 5),
  qualidade_conteudo smallint not null default 3 check (qualidade_conteudo between 1 and 5),
  profissionalismo smallint not null default 3 check (profissionalismo between 1 and 5),
  potencial_comercial smallint not null default 3 check (potencial_comercial between 1 and 5),
  seguranca_marca smallint not null default 3 check (seguranca_marca between 1 and 5),
  objetivo text,
  selo text,
  produto_campanha text,
  quantidade_stories integer not null default 0 check (quantidade_stories >= 0),
  quantidade_videos integer not null default 0 check (quantidade_videos >= 0),
  quantidade_posts integer not null default 0 check (quantidade_posts >= 0),
  custo_produtos numeric(12,2) not null default 0 check (custo_produtos >= 0),
  frete numeric(12,2) not null default 0 check (frete >= 0),
  cpm_visualizacoes numeric(12,2) not null default 35 check (cpm_visualizacoes >= 0),
  comissao_percentual numeric(6,2) not null default 10 check (comissao_percentual >= 0),
  direitos_uso text not null default 'orgânico',
  exclusividade text not null default 'sem exclusividade',
  pontuacao integer not null default 0 check (pontuacao between 0 and 100),
  classificacao text,
  valor_proposta_1 numeric(12,2) not null default 0,
  valor_proposta_2 numeric(12,2) not null default 0,
  valor_proposta_3 numeric(12,2) not null default 0,
  valor_negociado numeric(12,2),
  receita_gerada numeric(12,2),
  pedidos_gerados integer,
  cliques_gerados integer,
  parceria_concluida boolean not null default false,
  voltaria_a_trabalhar boolean,
  avaliacao_final smallint check (avaliacao_final between 1 and 5),
  observacoes text
);

create index if not exists idx_influenciadores_calculos_criado_em on public.influenciadores_calculos (criado_em desc);
create index if not exists idx_influenciadores_calculos_arroba on public.influenciadores_calculos (lower(arroba));
create index if not exists idx_influenciadores_calculos_criado_por on public.influenciadores_calculos (criado_por);

alter table public.influenciadores_calculos enable row level security;

drop policy if exists "influenciadores_calculos_select" on public.influenciadores_calculos;
create policy "influenciadores_calculos_select" on public.influenciadores_calculos for select to authenticated using (true);

drop policy if exists "influenciadores_calculos_insert" on public.influenciadores_calculos;
create policy "influenciadores_calculos_insert" on public.influenciadores_calculos for insert to authenticated with check (auth.uid() = criado_por or criado_por is null);

drop policy if exists "influenciadores_calculos_update" on public.influenciadores_calculos;
create policy "influenciadores_calculos_update" on public.influenciadores_calculos for update to authenticated using (true) with check (true);

drop policy if exists "influenciadores_calculos_delete" on public.influenciadores_calculos;
create policy "influenciadores_calculos_delete" on public.influenciadores_calculos for delete to authenticated using (true);

create or replace function public.set_influenciadores_calculos_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_influenciadores_calculos_atualizado_em on public.influenciadores_calculos;
create trigger trg_influenciadores_calculos_atualizado_em
before update on public.influenciadores_calculos
for each row execute function public.set_influenciadores_calculos_atualizado_em();
