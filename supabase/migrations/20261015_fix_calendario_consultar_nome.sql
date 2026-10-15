-- Fix: calendario_consultar had an ambiguous "nome" reference in PL/pgSQL.
-- Applied to Orbita production 2026-10-15. This file records the fix for reproducible environments.
create or replace function public.calendario_consultar(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; v_nome text; itens jsonb;
begin
 if p_token is null or length(p_token)<64 or length(p_token)>256 then return null; end if;
 select l.parceiro_id into pid from public.calendario_links l
 where l.ativo and l.token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if pid is null then return null; end if;
 select p.nome into v_nome from public.parceiros p where p.id=pid;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.data_publicacao,d.created_at),'[]'::jsonb) into itens
 from (select c.id,c.data_publicacao,c.titulo,c.tipo,c.tema,c.roteiro,c.orientacoes,c.status,c.link_publicacao,c.created_at
       from public.calendario_divulgacoes c where c.parceiro_id=pid) d;
 return jsonb_build_object('parceiro',v_nome,'itens',itens);
end $$;