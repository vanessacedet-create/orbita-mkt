alter table public.fila_execucao_yasmin_inf add column agenda jsonb not null default '{}'::jsonb check (jsonb_typeof(agenda) = 'object');
grant update (agenda) on public.fila_execucao_yasmin_inf to authenticated;
