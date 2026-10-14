-- Возвраты звёзд и адрес вебхука.

-- Когда звёзды вернули: оплата остаётся в журнале, но доступ за неё закрывается и в выручку она не идёт.
alter table public.payments add column if not exists refunded_at timestamptz;

-- Один замок на пару пользователь/курс: оплата и возврат не могут перезаписать друг друга.
-- Журнал и доступ фиксируются вместе; при ошибке вся операция откатывается.
create or replace function public.apply_star_payment(p_user bigint, p_course bigint, p_stars integer, p_charge text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare payment public.payments%rowtype; inserted_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text || ':' || p_course::text, 0));
  insert into public.payments(user_id,course_id,stars,charge_id)
  values(p_user,p_course,p_stars,p_charge)
  on conflict(charge_id) do nothing returning id into inserted_id;
  select * into strict payment from public.payments where charge_id=p_charge for update;
  if payment.user_id is distinct from p_user or payment.course_id is distinct from p_course or payment.stars is distinct from p_stars then
    raise exception 'Payment data mismatch';
  end if;
  if payment.refunded_at is not null then
    return jsonb_build_object('duplicate',true,'refunded',true);
  end if;
  insert into public.course_access(user_id,course_id,source) values(p_user,p_course,'stars')
  on conflict(user_id,course_id) do nothing;
  return jsonb_build_object('duplicate',inserted_id is null,'refunded',false);
end;
$$;

create or replace function public.apply_star_refund(p_charge text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare payment public.payments%rowtype; fresh boolean;
begin
  select * into strict payment from public.payments where charge_id=p_charge;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(payment.user_id::text,'') || ':' || coalesce(payment.course_id::text,''), 0));
  select * into strict payment from public.payments where charge_id=p_charge for update;
  fresh := payment.refunded_at is null;
  update public.payments set refunded_at=coalesce(refunded_at,now()) where id=payment.id;
  -- Возврат старой покупки не закрывает новую оплаченную покупку или ручной доступ.
  if not exists(select 1 from public.payments where user_id=payment.user_id and course_id=payment.course_id and refunded_at is null) then
    delete from public.course_access where user_id=payment.user_id and course_id=payment.course_id and source='stars';
  end if;
  return jsonb_build_object('user_id',payment.user_id,'course_id',payment.course_id,'stars',payment.stars,'new_refund',fresh);
end;
$$;

revoke execute on function public.apply_star_payment(bigint,bigint,integer,text) from public,anon,authenticated;
revoke execute on function public.apply_star_refund(text) from public,anon,authenticated;
grant execute on function public.apply_star_payment(bigint,bigint,integer,text) to service_role;
grant execute on function public.apply_star_refund(text) to service_role;

-- Адрес вебхука функция теперь берёт из окружения своего проекта.
-- Отдельная настройка больше не нужна: в ней мог остаться адрес старого проекта.
delete from public.settings where key = 'api_url';
