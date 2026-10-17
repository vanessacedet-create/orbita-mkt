-- Allow 128-bit (32 hex characters) tokens; existing 96-character tokens continue to work.
-- 128-bit cryptographically random tokens provide high entropy for unguessable capability URLs.
create or replace function public.calendario_criar_link(p_parceiro uuid, p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if not public.calendario_equipe_autorizada() then raise exception 'Sem permissão'; end if;
 if length(p_token) < 32 or length(p_token) > 256 then raise exception 'Token inválido'; end if;
 insert into public.calendario_links (parceiro_id,token_hash,ativo,criado_em)
 values (p_parceiro,encode(extensions.digest(p_token,'sha256'),'hex'),true,now())
 on conflict (parceiro_id) do update set token_hash=excluded.token_hash, ativo=true, criado_em=now();
 return true;
end $$;

create or replace function public.calendario_consultar(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; v_nome text; itens jsonb;
begin
 if p_token is null or length(p_token)<32 or length(p_token)>256 then return null; end if;
 select l.parceiro_id into pid from public.calendario_links l
 where l.ativo and l.token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if pid is null then return null; end if;
 select p.nome into v_nome from public.parceiros p where p.id=pid;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.data_publicacao,d.created_at),'[]'::jsonb) into itens
 from (select c.id,c.data_publicacao,c.titulo,c.tipo,c.tema,c.roteiro,c.orientacoes,c.status,c.link_publicacao,c.created_at
       from public.calendario_divulgacoes c where c.parceiro_id=pid) d;
 return jsonb_build_object('parceiro',v_nome,'itens',itens);
end $$;

create or replace function public.calendario_atualizar_publico(
 p_token text,p_divulgacao uuid,p_status text,p_link text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
 if p_token is null or length(p_token)<32 or length(p_token)>256 then return false; end if;
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
