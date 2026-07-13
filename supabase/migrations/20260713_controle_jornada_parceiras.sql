-- Controle de Jornada — Editoras Parceiras

create table if not exists public.jornada_config (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references public.usuarios(id) on delete cascade,
  carga_minutos integer not null check (carga_minutos between 60 and 720),
  entrada_padrao time,
  saida_padrao time,
  almoco_inicio_padrao time,
  almoco_fim_padrao time,
  pausa_minutos integer not null default 0 check (pausa_minutos between 0 and 120),
  editavel_pelo_usuario boolean not null default false,
  updated_by uuid references public.usuarios(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.jornada_registros (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  data date not null,
  entrada time,
  almoco_inicio time,
  almoco_fim time,
  saida time,
  pausa_inicio time,
  pausa_fim time,
  intervalo_remunerado boolean not null default false,
  status text not null default 'normal' check (status in ('normal','atestado','falta','folga','férias','home office','outro')),
  observacoes text,
  inativo boolean not null default false,
  motivo_inativo text,
  editado_por uuid references public.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(usuario_id, data)
);

create table if not exists public.jornada_dias_inativos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  usuario_id uuid references public.usuarios(id) on delete cascade,
  motivo text not null,
  created_by uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

create index if not exists jornada_registros_usuario_data_idx on public.jornada_registros(usuario_id,data);
create index if not exists jornada_dias_inativos_data_idx on public.jornada_dias_inativos(data);

alter table public.jornada_config enable row level security;
alter table public.jornada_registros enable row level security;
alter table public.jornada_dias_inativos enable row level security;

create or replace function public.eh_supervisora_parceiras()
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.usuarios
    where id=auth.uid() and perfil in ('administrador','supervisor_parceiras')
  );
$$;

-- Configuração: integrantes leem a própria; supervisora lê e altera todas.
drop policy if exists "jornada_config_select" on public.jornada_config;
create policy "jornada_config_select" on public.jornada_config for select
using (usuario_id=auth.uid() or public.eh_supervisora_parceiras());
drop policy if exists "jornada_config_write" on public.jornada_config;
create policy "jornada_config_write" on public.jornada_config for all
using (public.eh_supervisora_parceiras()) with check (public.eh_supervisora_parceiras());

-- Registro diário: cada pessoa vê e altera apenas o próprio; supervisora vê e altera todos.
drop policy if exists "jornada_registros_select" on public.jornada_registros;
create policy "jornada_registros_select" on public.jornada_registros for select
using (usuario_id=auth.uid() or public.eh_supervisora_parceiras());
drop policy if exists "jornada_registros_insert" on public.jornada_registros;
create policy "jornada_registros_insert" on public.jornada_registros for insert
with check (usuario_id=auth.uid() or public.eh_supervisora_parceiras());
drop policy if exists "jornada_registros_update" on public.jornada_registros;
create policy "jornada_registros_update" on public.jornada_registros for update
using (usuario_id=auth.uid() or public.eh_supervisora_parceiras())
with check (usuario_id=auth.uid() or public.eh_supervisora_parceiras());

-- Dias inativos: equipe pode consultar; somente supervisora administra.
drop policy if exists "jornada_inativos_select" on public.jornada_dias_inativos;
create policy "jornada_inativos_select" on public.jornada_dias_inativos for select
using (usuario_id is null or usuario_id=auth.uid() or public.eh_supervisora_parceiras());
drop policy if exists "jornada_inativos_write" on public.jornada_dias_inativos;
create policy "jornada_inativos_write" on public.jornada_dias_inativos for all
using (public.eh_supervisora_parceiras()) with check (public.eh_supervisora_parceiras());

-- Referências iniciais; os nomes são associados pela interface e podem ser ajustados pela supervisora.
insert into public.jornada_config (usuario_id,carga_minutos,entrada_padrao,saida_padrao,almoco_inicio_padrao,almoco_fim_padrao,pausa_minutos,updated_by)
select id,
  case when perfil='estagiario_parceiras' then 360 else 480 end,
  case when lower(nome) like '%sarah%' then '07:00'::time when lower(nome) like '%vanessa%' then '07:30'::time when lower(nome) like '%gabriela%' then '08:30'::time end,
  case when lower(nome) like '%sarah%' then '16:00'::time when lower(nome) like '%vanessa%' then '16:30'::time when lower(nome) like '%gabriela%' then '14:30'::time end,
  case when lower(nome) like '%sarah%' then '13:00'::time when lower(nome) like '%vanessa%' then '12:30'::time when lower(nome) like '%gabriela%' then '13:00'::time end,
  case when lower(nome) like '%sarah%' then '14:00'::time when lower(nome) like '%vanessa%' then '13:30'::time when lower(nome) like '%gabriela%' then '13:20'::time end,
  case when perfil='estagiario_parceiras' then 20 else 15 end,
  id
from public.usuarios
where perfil in ('analista_parceiras','estagiario_parceiras')
on conflict (usuario_id) do nothing;
