-- Atomic authorization, request decisions and fulfillment. Service role only.
create function public.resolve_admin(p_user bigint,p_username text) returns boolean language plpgsql set search_path=public as $$
declare admins jsonb;
begin
 select value into admins from settings where key='admins' for update;
 if exists(select 1 from jsonb_each(coalesce(admins,'{}')) e where e.value=to_jsonb(p_user)) then return true; end if;
 if p_username<>'' and admins ? p_username and admins->p_username='null'::jsonb then
  update settings set value=jsonb_set(value,array[p_username],to_jsonb(p_user)) where key='admins'; return true;
 end if;
 return false;
end $$;
create function public.cashier_auth(p_point bigint,p_hash text) returns jsonb language plpgsql set search_path=public as $$
declare p advent_points; n integer;
begin
 select * into p from advent_points where id=p_point for update;
 if not found then return jsonb_build_object('ok',false,'error','point_not_found'); end if;
 if p.locked_until>now() then return jsonb_build_object('ok',false,'error','pin_locked'); end if;
 if p.pin_hash is distinct from p_hash then
  n:=case when p.locked_until is not null then 1 else coalesce(p.fails,0)+1 end;
  update advent_points set fails=case when n>=8 then 0 else n end,locked_until=case when n>=8 then now()+interval '15 minutes' else null end where id=p_point;
  return jsonb_build_object('ok',false,'error','bad_pin');
 end if;
 update advent_points set fails=0,locked_until=null where id=p_point;
 return jsonb_build_object('ok',true,'point',to_jsonb(p)-'pin_hash');
end $$;
create function public.decide_course_request(p_user bigint,p_course bigint,p_approve boolean) returns void language plpgsql set search_path=public as $$
begin
 if p_approve then insert into course_access(user_id,course_id,source) values(p_user,p_course,'admin') on conflict(user_id,course_id) do nothing; end if;
 insert into access_requests(user_id,course_id,status,decided_at) values(p_user,p_course,case when p_approve then 'approved' else 'declined' end,now()) on conflict(user_id,course_id) do update set status=excluded.status,decided_at=excluded.decided_at;
end $$;
create function public.apply_ticket_payment(p_user bigint,p_stars integer,p_charge text) returns jsonb language plpgsql set search_path=public as $$
declare p payments; ticket bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('charge:'||p_charge,0));
 insert into payments(user_id,course_id,stars,charge_id,purpose) values(p_user,null,p_stars,p_charge,'catchup') on conflict(charge_id) do nothing;
 select * into strict p from payments where charge_id=p_charge for update;
 if p.user_id is distinct from p_user or p.stars is distinct from p_stars or p.purpose<>'catchup' then raise exception 'Payment data mismatch'; end if;
 if p.refunded_at is not null then return jsonb_build_object('inserted',false,'refunded',true); end if;
 insert into advent_tickets(user_id,source,ref) values(p_user,'stars','stars:'||p_charge) on conflict(ref) do nothing returning id into ticket;
 return jsonb_build_object('inserted',ticket is not null,'refunded',false);
end $$;
create table public.advent_reward_decisions(user_id bigint not null references users(id) on delete cascade,day integer not null,reward_id bigint not null references advent_rewards(id) on delete cascade,take boolean not null,primary key(user_id,day,reward_id));
alter table public.advent_reward_decisions enable row level security;
create function public.advent_reward_decision(p_user bigint,p_day integer,p_reward bigint,p_take boolean) returns boolean language plpgsql set search_path=public as $$
begin
 insert into advent_reward_decisions values(p_user,p_day,p_reward,p_take) on conflict do nothing;
 return (select take from advent_reward_decisions where user_id=p_user and day=p_day and reward_id=p_reward);
end $$;

create or replace function public.apply_star_refund(p_charge text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare payment public.payments%rowtype; fresh boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('charge:' || p_charge,0));
  select * into strict payment from public.payments where charge_id=p_charge;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(payment.user_id::text,'') || ':' || coalesce(payment.course_id::text,''), 0));
  select * into strict payment from public.payments where charge_id=p_charge for update;
  fresh := payment.refunded_at is null;
  update public.payments set refunded_at=coalesce(refunded_at,now()) where id=payment.id;
  -- Возврат старой покупки не закрывает новую оплаченную покупку или ручной доступ.
  update public.advent_tickets set revoked_at=coalesce(revoked_at,now()) where ref='stars:'||p_charge and used_at is null;
  if not exists(select 1 from public.payments where user_id=payment.user_id and course_id=payment.course_id and refunded_at is null) then
    delete from public.course_access where user_id=payment.user_id and course_id=payment.course_id and source='stars';
  end if;
  return jsonb_build_object('user_id',payment.user_id,'course_id',payment.course_id,'stars',payment.stars,'new_refund',fresh);
end;
$$;

revoke all on table public.advent_reward_decisions from public,anon,authenticated;
grant select,insert on public.advent_reward_decisions to service_role;
revoke all on function public.resolve_admin(bigint,text) from public,anon,authenticated;
grant execute on function public.resolve_admin(bigint,text) to service_role;
revoke all on function public.cashier_auth(bigint,text) from public,anon,authenticated;
grant execute on function public.cashier_auth(bigint,text) to service_role;
revoke all on function public.decide_course_request(bigint,bigint,boolean) from public,anon,authenticated;
grant execute on function public.decide_course_request(bigint,bigint,boolean) to service_role;
revoke all on function public.apply_ticket_payment(bigint,integer,text) from public,anon,authenticated;
grant execute on function public.apply_ticket_payment(bigint,integer,text) to service_role;
revoke all on function public.advent_reward_decision(bigint,integer,bigint,boolean) from public,anon,authenticated;
grant execute on function public.advent_reward_decision(bigint,integer,bigint,boolean) to service_role;

-- Repair unspent legacy tickets from already refunded charges.
update public.advent_tickets t set revoked_at=now() from public.payments p
 where t.ref='stars:'||p.charge_id and p.refunded_at is not null and t.used_at is null and t.revoked_at is null;
