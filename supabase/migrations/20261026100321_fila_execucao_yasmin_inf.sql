create table public.fila_execucao_yasmin_inf (
 id text primary key check (id = 'yasmin'),
 responsavel_id uuid not null references public.usuarios(id),
 ordem text[] not null default '{}',
 versao integer not null default 0 check (versao >= 0)
);
alter table public.fila_execucao_yasmin_inf enable row level security;
revoke all on public.fila_execucao_yasmin_inf from anon, authenticated;
grant select on public.fila_execucao_yasmin_inf to authenticated;
grant update (ordem, versao) on public.fila_execucao_yasmin_inf to authenticated;
create policy fila_yasmin_leitura on public.fila_execucao_yasmin_inf for select to authenticated
 using (auth.uid() = responsavel_id or public.perfil_do_usuario_atual() in ('administrador','gerente','supervisor_influencers'));
create policy fila_yasmin_gestao on public.fila_execucao_yasmin_inf for update to authenticated
 using (public.perfil_do_usuario_atual() in ('administrador','gerente','supervisor_influencers'))
 with check (public.perfil_do_usuario_atual() in ('administrador','gerente','supervisor_influencers'));

