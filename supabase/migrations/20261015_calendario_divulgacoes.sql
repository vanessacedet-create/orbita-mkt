-- Calendário de divulgações / Órbita
-- Execute no SQL Editor do projeto Órbita, antes de publicar a interface.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.calendario_divulgacoes (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  data_publicacao date not null,
  titulo text not null,
  tipo text not null default 'Reels' check (tipo in ('Reels','Stories','Carrossel','Post','Live','Outro')),
  tema text not null default '',
  roteiro text not null default '',
  orientacoes text not null default '',
  livro_id uuid references public.livros(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente','aguardando_aprovacao','agendado','postado')),
  link_publicacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calendario_divulgacoes_parceiro_data_idx on public.calendario_divulgacoes (parceiro_id,data_publicacao);
create table if not exists public.calendario_links (
  parceiro_id uuid primary key references public.parceiros(id) on delete cascade,
  token_hash text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create or replace function public.calendario_equipe_autorizada()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios u where u.id = auth.uid()
    and u.perfil in ('administrador','gerente','analista_influencers','estagiario_influencers','supervisor_parceiras','analista_parceiras','estagiario_parceiras'));
$$;
revoke all on function public.calendario_equipe_autorizada() from public;
grant execute on function public.calendario_equipe_autorizada() to authenticated;
alter table public.calendario_divulgacoes enable row level security;
alter table public.calendario_links enable row level security;
drop policy if exists calendario_equipe on public.calendario_divulgacoes;
create policy calendario_equipe on public.calendario_divulgacoes for all to authenticated
using (public.calendario_equipe_autorizada()) with check (public.calendario_equipe_autorizada());
drop policy if exists calendario_links_equipe on public.calendario_links;
create policy calendario_links_equipe on public.calendario_links for all to authenticated
using (public.calendario_equipe_autorizada()) with check (public.calendario_equipe_autorizada());
-- Apenas as funções abaixo disponibilizam acesso externo. O token em texto claro nunca é armazenado.
create or replace function public.calendario_criar_link(p_parceiro uuid, p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if not public.calendario_equipe_autorizada() then raise exception 'Sem permissão'; end if;
 if length(p_token) < 64 or length(p_token) > 256 then raise exception 'Token inválido'; end if;
 insert into public.calendario_links (parceiro_id,token_hash,ativo,criado_em)
 values (p_parceiro,encode(extensions.digest(p_token,'sha256'),'hex'),true,now())
 on conflict (parceiro_id) do update set token_hash=excluded.token_hash, ativo=true, criado_em=now();
 return true;
end $$;
create or replace function public.calendario_consultar(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; nome text; itens jsonb;
begin
 if p_token is null or length(p_token)<64 or length(p_token)>256 then return null; end if;
 select parceiro_id into pid from public.calendario_links
 where ativo and token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if pid is null then return null; end if;
 select nome into nome from public.parceiros where id=pid;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.data_publicacao,d.created_at),'[]'::jsonb) into itens
 from (select id,data_publicacao,titulo,tipo,tema,roteiro,orientacoes,status,link_publicacao
       from public.calendario_divulgacoes where parceiro_id=pid) d;
 return jsonb_build_object('parceiro',nome,'itens',itens);
end $$;
create or replace function public.calendario_atualizar_publico(
 p_token text,p_divulgacao uuid,p_status text,p_link text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
 if p_token is null or length(p_token)<64 or length(p_token)>256 then return false; end if;
 if p_status not in ('pendente','aguardando_aprovacao','agendado','postado') then return false; end if;
 if p_link is not null and length(p_link)>2048 then return false; end if;
 if p_link is not null and p_link<>'' and p_link !~* '^https://[^[:space:]]+$' then return false; end if;
 select parceiro_id into pid from public.calendario_links
 where ativo and token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if pid is null then return false; end if;
 update public.calendario_divulgacoes
 set status=p_status,link_publicacao=nullif(p_link,''),updated_at=now()
 where id=p_divulgacao and parceiro_id=pid;
 return found;
end $$;
revoke all on function public.calendario_criar_link(uuid,text) from public;
revoke all on function public.calendario_consultar(text) from public;
revoke all on function public.calendario_atualizar_publico(text,uuid,text,text) from public;
grant execute on function public.calendario_criar_link(uuid,text) to authenticated;
grant execute on function public.calendario_consultar(text) to anon,authenticated;
grant execute on function public.calendario_atualizar_publico(text,uuid,text,text) to anon,authenticated;
