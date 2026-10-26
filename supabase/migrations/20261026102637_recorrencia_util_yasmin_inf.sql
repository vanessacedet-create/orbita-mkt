-- Repetições independentes por dia útil; não modifica registros existentes.
create table public.recorrencias_yasmin_inf (
 id uuid primary key default gen_random_uuid(),
 banco_tarefa_id uuid not null references public.banco_tarefas_inf(id),
 responsavel_id uuid not null references public.usuarios(id),
 atribuida_por uuid not null references public.usuarios(id),
 especificidade text,
 parceiro_id uuid references public.parceiros(id),
 checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist)='array'),
 inicio date not null,
 fim date check (fim is null or fim >= inicio),
 gerada_ate date,
 ativo boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.recorrencias_yasmin_inf enable row level security;
revoke all on public.recorrencias_yasmin_inf from anon, authenticated;
grant select, insert on public.recorrencias_yasmin_inf to authenticated;
grant update (ativo, gerada_ate) on public.recorrencias_yasmin_inf to authenticated;
create policy recorrencia_leitura on public.recorrencias_yasmin_inf for select to authenticated using (
 auth.uid()=responsavel_id or public.perfil_do_usuario_atual() in ('administrador','gerente','supervisor_influencers'));
create policy recorrencia_criacao on public.recorrencias_yasmin_inf for insert to authenticated with check (
 public.perfil_do_usuario_atual() in ('administrador','gerente','supervisor_influencers') and atribuida_por=auth.uid()
 and responsavel_id=(select responsavel_id from public.fila_execucao_yasmin_inf where id='yasmin'));
create policy recorrencia_gestao on public.recorrencias_yasmin_inf for update to authenticated
 using (public.perfil_do_usuario_atual() in ('administrador','gerente','supervisor_influencers'))
 with check (public.perfil_do_usuario_atual() in ('administrador','gerente','supervisor_influencers'));
alter table public.tarefas_atribuidas_inf add column recorrencia_id uuid references public.recorrencias_yasmin_inf(id);
alter table public.tarefas_atribuidas_inf add column dia_recorrencia date;
create unique index tarefa_recorrencia_dia_inf on public.tarefas_atribuidas_inf(recorrencia_id,dia_recorrencia) where recorrencia_id is not null;
create index recorrencia_yasmin_responsavel_inf on public.recorrencias_yasmin_inf(responsavel_id);
create index recorrencia_yasmin_modelo_inf on public.recorrencias_yasmin_inf(banco_tarefa_id);
create index recorrencia_yasmin_criador_inf on public.recorrencias_yasmin_inf(atribuida_por);
create index recorrencia_yasmin_parceiro_inf on public.recorrencias_yasmin_inf(parceiro_id);

create function public.gerar_recorrencias_yasmin_inf() returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.recorrencias_yasmin_inf%rowtype; d date; limite date; tid uuid; total integer:=0; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 if current_user <> 'postgres' and coalesce(public.perfil_do_usuario_atual(),'') not in ('administrador','gerente','supervisor_influencers') then raise exception 'Somente a gestão pode gerar repetições'; end if;
 perform pg_advisory_xact_lock(hashtext('recorrencias_yasmin_inf'));
 for r in select * from public.recorrencias_yasmin_inf where ativo order by created_at for update loop
  d := greatest(r.inicio,coalesce(r.gerada_ate+1,r.inicio));
  limite := least(hoje+14,coalesce(r.fim,hoje+14),d+365);
  while d <= limite loop
   if extract(isodow from d) between 1 and 5 then
    tid := null;
    insert into public.tarefas_atribuidas_inf(banco_tarefa_id,responsavel_id,atribuida_por,data_atribuicao,data_prazo,especificidade,status,grupo,parceiro_id,parceiros_ids,recorrencia_id,dia_recorrencia)
    values(r.banco_tarefa_id,r.responsavel_id,r.atribuida_por,hoje,d,r.especificidade,'a_fazer','influencers',r.parceiro_id,case when r.parceiro_id is null then '{}'::uuid[] else array[r.parceiro_id] end,r.id,d)
    on conflict (recorrencia_id,dia_recorrencia) where recorrencia_id is not null do nothing returning id into tid;
    if tid is not null then
     insert into public.atribuicao_responsaveis_inf(atribuicao_id,usuario_id) values(tid,r.responsavel_id);
     insert into public.atribuicao_checklist_inf(atribuicao_id,texto,ordem,data_prazo)
      select tid,item->>'texto',(n-1)::integer,d-coalesce((item->>'dias_antes')::integer,0) from jsonb_array_elements(r.checklist) with ordinality as x(item,n) where length(trim(item->>'texto'))>0;
     update public.fila_execucao_yasmin_inf set agenda=agenda||jsonb_build_object(tid::text,d::text),versao=versao+1 where id='yasmin';
     total:=total+1;
    end if;
   end if;
   d:=d+1;
  end loop;
  if limite >= r.inicio then update public.recorrencias_yasmin_inf set gerada_ate=limite where id=r.id; end if;
 end loop;
 return total;
end $$;
revoke all on function public.gerar_recorrencias_yasmin_inf() from public,anon;
grant execute on function public.gerar_recorrencias_yasmin_inf() to authenticated;

create function public.criar_recorrencia_yasmin_inf(p_id uuid,p_modelo uuid,p_inicio date,p_fim date,p_descricao text,p_parceiro uuid,p_checklist jsonb)
 returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare alvo uuid; existente public.recorrencias_yasmin_inf%rowtype;
begin
 if coalesce(public.perfil_do_usuario_atual(),'') not in ('administrador','gerente','supervisor_influencers') then raise exception 'Somente a gestão pode criar recorrências'; end if;
 if p_inicio is null or p_inicio < (now() at time zone 'America/Sao_Paulo')::date or (p_fim is not null and p_fim < p_inicio) then raise exception 'Confira as datas da recorrência'; end if;
 select responsavel_id into strict alvo from public.fila_execucao_yasmin_inf where id='yasmin';
 insert into public.recorrencias_yasmin_inf(id,banco_tarefa_id,responsavel_id,atribuida_por,inicio,fim,especificidade,parceiro_id,checklist)
 values(p_id,p_modelo,alvo,auth.uid(),p_inicio,p_fim,p_descricao,p_parceiro,p_checklist) on conflict(id) do nothing;
 select * into strict existente from public.recorrencias_yasmin_inf where id=p_id;
 if existente.atribuida_por<>auth.uid() then raise exception 'Recorrência inválida'; end if;
 perform public.gerar_recorrencias_yasmin_inf();
 return p_id;
end $$;
revoke all on function public.criar_recorrencia_yasmin_inf(uuid,uuid,date,date,text,uuid,jsonb) from public,anon;
grant execute on function public.criar_recorrencia_yasmin_inf(uuid,uuid,date,date,text,uuid,jsonb) to authenticated;

create function public.parar_recorrencia_yasmin_inf(p_id uuid) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if coalesce(public.perfil_do_usuario_atual(),'') not in ('administrador','gerente','supervisor_influencers') then raise exception 'Somente a gestão pode parar recorrências'; end if;
 update public.recorrencias_yasmin_inf set ativo=false where id=p_id;
 update public.tarefas_atribuidas_inf set status='cancelada' where recorrencia_id=p_id and dia_recorrencia>(now() at time zone 'America/Sao_Paulo')::date and status='a_fazer';
end $$;
revoke all on function public.parar_recorrencia_yasmin_inf(uuid) from public,anon;
grant execute on function public.parar_recorrencia_yasmin_inf(uuid) to authenticated;
select cron.schedule('recorrencias-yasmin-inf','5 * * * *','select public.gerar_recorrencias_yasmin_inf()');
