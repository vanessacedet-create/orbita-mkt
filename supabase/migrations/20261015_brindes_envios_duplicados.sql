-- Envios de brindes: fretes duplicados autorizados pela equipe.
-- Aplicar no Supabase após revisar permissões e restrições das tabelas existentes.
-- A RPC mantém um registro de destinatário por pacote físico.
create or replace function public.envio_brinde_aplicar_frete_com_duplicados(
  p_lote_id bigint,
  p_fretes jsonb,
  p_duplicados jsonb
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lote public.envio_brinde_lotes%rowtype;
  v_extra jsonb;
  v_origem public.envio_brinde_destinatarios%rowtype;
  v_valor numeric;
  v_quantidade integer := 0;
  v_frete_extra numeric := 0;
begin
  if jsonb_typeof(p_duplicados) <> 'array' or jsonb_array_length(p_duplicados) = 0 then
    raise exception 'Não há envios duplicados para confirmar.';
  end if;

  select * into v_lote from public.envio_brinde_lotes
    where id = p_lote_id for update;
  if not found or v_lote.status not in ('recebido', 'em_analise', 'frete_calculado') then
    raise exception 'Lote inexistente ou não permite alterações de frete.';
  end if;

  -- A função existente valida e grava os fretes regulares.
  perform public.envio_brinde_aplicar_frete(p_lote_id, p_fretes);

  for v_extra in select value from jsonb_array_elements(p_duplicados)
  loop
    if (v_extra->>'destinatario_id') !~ '^[0-9]+$'
       or (v_extra->>'valor_frete') !~ '^[0-9]+(\\.[0-9]{1,2})?$' then
      raise exception 'Envio duplicado com destinatário ou valor inválido.';
    end if;
    v_valor := (v_extra->>'valor_frete')::numeric(12,2);

    select * into v_origem
      from public.envio_brinde_destinatarios
      where id = (v_extra->>'destinatario_id')::bigint and lote_id = p_lote_id;
    if not found then
      raise exception 'Destinatário da duplicidade não pertence ao lote.';
    end if;

    -- Segundo registro representa um segundo pacote e possibilita segundo rastreio.
    insert into public.envio_brinde_destinatarios (lote_id, nome_completo, valor_frete)
      values (p_lote_id, v_origem.nome_completo, v_valor);

    v_quantidade := v_quantidade + 1;
    v_frete_extra := v_frete_extra + v_valor;
  end loop;

  update public.envio_brinde_lotes
     set qtd_livros = qtd_livros + v_quantidade,
         valor_livros = round((valor_livros + (v_quantidade * preco_unitario))::numeric, 2),
         valor_frete_total = round((valor_frete_total + v_frete_extra)::numeric, 2)
   where id = p_lote_id;
end;
$$;

revoke all on function public.envio_brinde_aplicar_frete_com_duplicados(bigint,jsonb,jsonb) from public;
grant execute on function public.envio_brinde_aplicar_frete_com_duplicados(bigint,jsonb,jsonb) to authenticated;
