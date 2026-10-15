-- Envios de brindes: fretes duplicados autorizados pela equipe.
-- Aplicar no Supabase após revisar permissões e restrições das tabelas existentes.
-- A RPC mantém um registro de destinatário por pacote físico.
create or replace function public.envio_brinde_aplicar_frete_com_duplicados(
  p_lote_id bigint,
  p_fretes jsonb,
  p_duplicados jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote public.envio_brinde_lotes%rowtype;
  v_extra jsonb;
  v_origem public.envio_brinde_destinatarios%rowtype;
  v_valor numeric;
  v_quantidade integer := 0;
  v_frete_extra numeric := 0;
  v_frete_base numeric := 0;
begin
  if not public.envio_brinde_eh_equipe() then
    raise exception 'Sem permissão para este módulo.';
  end if;
  if jsonb_typeof(p_duplicados) <> 'array' or jsonb_array_length(p_duplicados) = 0 then
    raise exception 'Não há envios duplicados para confirmar.';
  end if;

  select * into v_lote from public.envio_brinde_lotes
    where id = p_lote_id for update;
  if not found or v_lote.status not in ('recebido', 'em_analise') then
    raise exception 'Duplicidades só podem ser autorizadas antes de gravar o frete pela primeira vez.';
  end if;
  if v_lote.valor_frete_total is not null
    or exists (select 1 from public.envio_brinde_destinatarios
               where lote_id = p_lote_id and valor_frete is not null) then
    raise exception 'Este lote já possui fretes gravados. Reimportação de duplicidades bloqueada.';
  end if;
  if v_lote.qtd_livros <> (select count(*) from public.envio_brinde_destinatarios where lote_id = p_lote_id) then
    raise exception 'Quantidade de livros diferente dos destinatários. Solicite conferência antes de continuar.';
  end if;

  -- A função existente valida e grava os fretes regulares.
  v_frete_base := public.envio_brinde_aplicar_frete(p_lote_id, p_fretes);

  for v_extra in select value from jsonb_array_elements(p_duplicados)
  loop
    if (v_extra->>'destinatario_id') !~ '^[0-9]+$'
       or (v_extra->>'valor_frete') !~ '^[0-9]+([.][0-9]{1,2})?
      raise exception 'Envio duplicado com destinatário ou valor inválido.';
    end if;
    v_valor := (v_extra->>'valor_frete')::numeric(12,2);
    if v_valor < 0 or v_valor > 99999 then
      raise exception 'Valor de frete adicional inválido.';
    end if;

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
     set qtd_livros = (select count(*) from public.envio_brinde_destinatarios where lote_id = p_lote_id),
         valor_livros = round(((select count(*) from public.envio_brinde_destinatarios where lote_id = p_lote_id) * preco_unitario)::numeric, 2),
         valor_frete_total = round((v_frete_base + v_frete_extra)::numeric, 2),
         atualizado_em = now()
   where id = p_lote_id;
end;
$$;

revoke all on function public.envio_brinde_aplicar_frete_com_duplicados(bigint,jsonb,jsonb) from public;
grant execute on function public.envio_brinde_aplicar_frete_com_duplicados(bigint,jsonb,jsonb) to authenticated;
 then
      raise exception 'Envio duplicado com destinatário ou valor inválido.';
    end if;
    v_valor := (v_extra->>'valor_frete')::numeric(12,2);
    if v_valor < 0 or v_valor > 99999 then
      raise exception 'Valor de frete adicional inválido.';
    end if;

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
     set qtd_livros = (select count(*) from public.envio_brinde_destinatarios where lote_id = p_lote_id),
         valor_livros = round(((select count(*) from public.envio_brinde_destinatarios where lote_id = p_lote_id) * preco_unitario)::numeric, 2),
         valor_frete_total = round((v_frete_base + v_frete_extra)::numeric, 2),
         atualizado_em = now()
   where id = p_lote_id;
end;
$$;

revoke all on function public.envio_brinde_aplicar_frete_com_duplicados(bigint,jsonb,jsonb) from public;
grant execute on function public.envio_brinde_aplicar_frete_com_duplicados(bigint,jsonb,jsonb) to authenticated;
