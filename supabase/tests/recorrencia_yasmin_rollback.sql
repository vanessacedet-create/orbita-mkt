begin;
select set_config('request.jwt.claim.sub',(select id::text from public.usuarios where perfil='administrador' limit 1),true);
set local role authenticated;
do $test$
declare rid uuid:=gen_random_uuid(); modelo uuid; qtd integer; inicio date:=(now() at time zone 'America/Sao_Paulo')::date; fim date; esperado integer;
begin
 select id into strict modelo from public.banco_tarefas_inf where ativo limit 1;
 fim:=inicio+10;
 select count(*) into esperado from generate_series(inicio::timestamp,fim::timestamp,'1 day') d where extract(isodow from d) between 1 and 5;
 perform public.criar_recorrencia_yasmin_inf(rid,modelo,inicio,fim,'Teste transacional',null,'[{"texto":"Etapa de teste","dias_antes":0}]');
 select count(*) into qtd from public.tarefas_atribuidas_inf where recorrencia_id=rid;
 if qtd<>esperado then raise exception 'Contagem incorreta: % vs %',qtd,esperado; end if;
 if exists(select 1 from public.tarefas_atribuidas_inf where recorrencia_id=rid and extract(isodow from dia_recorrencia)>5) then raise exception 'Gerou fim de semana'; end if;
 perform public.gerar_recorrencias_yasmin_inf();
 if (select count(*) from public.tarefas_atribuidas_inf where recorrencia_id=rid)<>qtd then raise exception 'Duplicou'; end if;
 if (select count(*) from public.atribuicao_checklist_inf c join public.tarefas_atribuidas_inf t on t.id=c.atribuicao_id where recorrencia_id=rid)<>qtd then raise exception 'Checklist ausente'; end if;
 if exists(select 1 from public.tarefas_atribuidas_inf t where recorrencia_id=rid and not exists(select 1 from public.fila_execucao_yasmin_inf f where f.agenda->>t.id::text = t.dia_recorrencia::text)) then raise exception 'Agenda ausente'; end if;
 perform public.parar_recorrencia_yasmin_inf(rid);
 if exists(select 1 from public.tarefas_atribuidas_inf where recorrencia_id=rid and dia_recorrencia>inicio and status<>'cancelada') then raise exception 'Parada falhou'; end if;
end $test$;
select 'PASS: dias úteis, sem duplicação, checklist, agenda e encerramento; teste revertido' as resultado;
rollback;
