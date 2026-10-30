-- Service API authenticates administrators before invoking this bounded joined search.
create or replace function public.admin_payment_page(p_cursor bigint default null,p_query text default '')
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb; search text := lower(left(trim(coalesce(p_query,'')),100));
begin
 if p_cursor is not null and p_cursor<=0 then raise exception 'bad_cursor';end if;
 if left(search,1)='@' then search:=substr(search,2);end if;
 with matched as (
 select p.id,p.user_id,p.course_id,p.stars,p.created_at,
 p.refunded_at is not null as refunded,coalesce(p.refund_pending,false) as refund_pending,
 coalesce(nullif(u.first_name,''),'Без имени') as name,u.username,
 case when p.purpose='catchup' then 'Билет календаря' else coalesce(c.title,'Курс удалён') end as course
 from payments p left join users u on u.id=p.user_id left join courses c on c.id=p.course_id
 where (p_cursor is null or p.id<p_cursor) and (search='' or strpos(lower(coalesce(u.first_name,'')),search)>0 or strpos(lower(coalesce(u.username,'')),search)>0 or strpos(lower(coalesce(p.charge_id,'')),search)>0 or p.user_id::text=search)
 order by p.id desc limit 51
 ), page as (select * from matched order by id desc limit 50)
 select jsonb_build_object('payments',coalesce((select jsonb_agg(to_jsonb(page) order by id desc) from page),'[]'::jsonb),'next_cursor',case when (select count(*) from matched)>50 then (select min(id) from page) else null end) into result;
 return result;
end $$;
revoke all on function public.admin_payment_page(bigint,text) from public,anon,authenticated;
grant execute on function public.admin_payment_page(bigint,text) to service_role;
