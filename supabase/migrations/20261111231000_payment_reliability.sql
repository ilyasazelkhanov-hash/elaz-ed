-- Apply before the API deploy. No Telegram calls or monetary operations occur here.
-- Keep Advent prizes as independent access even when payment and grant race.
alter table public.course_access drop constraint course_access_manual_source_check;
alter table public.course_access add constraint course_access_manual_source_check
 check (manual_source in ('admin','invites','advent'));
update public.course_access set manual_source='advent' where source='advent' and manual_source is null;

create or replace function public.grant_course_access(p_user bigint,p_course bigint,p_source text)
returns void language plpgsql set search_path=public as $$
begin
 if p_source is null or p_source not in ('admin','invites','advent') then raise exception 'invalid_source'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_course::text,0));
 insert into course_access(user_id,course_id,source,manual_source) values(p_user,p_course,p_source,p_source)
 on conflict(user_id,course_id) do update set manual_source=case
  when course_access.manual_source='admin' then 'admin'
  when excluded.manual_source='advent' then coalesce(course_access.manual_source,'advent')
  else excluded.manual_source end;
end $$;

-- Legacy reward payloads are mutable and do not prove which course was won.
-- Do not infer new access from current payloads in an automatic migration.
-- Preserve original course identity for every new prize; historical code-only
-- repairs require the reviewed mapping procedure in the deployment notes.
alter table public.reward_codes add column granted_course_id bigint references public.courses(id) on delete set null;

create or replace function public.advent_grant(p_user bigint, p_reward bigint)
returns text
language plpgsql
set search_path = ''
as $$
declare
  r public.advent_rewards%rowtype;
  abc constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea;
  c text;
  i integer;
begin
  select * into r from public.advent_rewards where id = p_reward for update;
  if not found then
    return null;
  end if;
  if exists (select 1 from public.reward_codes where user_id = p_user and reward_id = p_reward) then
    return null;
  end if;
  if r.stock is not null and (select count(*) from public.reward_codes where reward_id = p_reward) >= r.stock then
    return null;
  end if;
  loop
    b := extensions.gen_random_bytes(8);
    c := '';
    for i in 0..7 loop
      c := c || substr(abc, (get_byte(b, i) % length(abc)) + 1, 1);
    end loop;
    c := substr(c, 1, 4) || '-' || substr(c, 5, 4);
    exit when not exists (select 1 from public.reward_codes where code = c);
  end loop;
  insert into public.reward_codes (code, user_id, reward_id, granted_course_id)
    values (c, p_user, p_reward, case when r.kind='course' then (r.payload->>'course_id')::bigint else null end);
  if r.kind = 'lesson' and (r.payload ->> 'lesson_id') is not null then
    insert into public.lesson_access (user_id, lesson_id, source) values (p_user, (r.payload ->> 'lesson_id')::bigint, 'advent') on conflict do nothing;
  end if;
  if r.kind = 'course' and (r.payload ->> 'course_id') is not null then
    perform public.grant_course_access(p_user, (r.payload ->> 'course_id')::bigint, 'advent');
  end if;
  return c;
end;
$$;

-- A pending manual refund still owns its paid access until Telegram confirms.
-- Automatic duplicate refunds never owned access and must not keep it alive.
alter table public.payment_refund_jobs add column reason text not null default 'duplicate'
 check (reason in ('duplicate','manual'));

create function public.queue_payment_refund(p_payment bigint) returns jsonb
language plpgsql set search_path=public as $$
declare p payments;
begin
 select * into p from payments where id=p_payment;
 if not found then raise exception 'payment_not_found'; end if;
 perform pg_advisory_xact_lock(hashtextextended('charge:'||p.charge_id,0));
 select * into strict p from payments where id=p_payment for update;
 if p.refunded_at is not null then
  return jsonb_build_object('charge_id',p.charge_id,'refunded',true);
 end if;
 if p.user_id is null then raise exception 'user_not_found'; end if;
 insert into payment_refund_jobs(charge_id,user_id,reason) values(p.charge_id,p.user_id,'manual') on conflict do nothing;
 update payments set refund_pending=true where id=p.id;
 return jsonb_build_object('charge_id',p.charge_id,'refunded',false);
end $$;

-- Targeted claim uses the same lease, backoff and fencing contract as cron.
-- It never steals another worker's lease or processes unrelated admin requests.
create function public.claim_payment_refund(p_charge text) returns jsonb
language sql set search_path=public as $$
 with candidate as (
  select charge_id from payment_refund_jobs where charge_id=p_charge and completed_at is null
   and next_attempt_at<=now() and (lease_until is null or lease_until<now()) for update skip locked
 ), claimed as (
  update payment_refund_jobs j set lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),attempts=attempts+1
   from candidate c where j.charge_id=c.charge_id returning j.*
 ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) from claimed;
$$;
create or replace function public.apply_star_refund(p_charge text) returns jsonb language plpgsql set search_path=public as $$
declare p payments;fresh boolean;retained boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('charge:'||p_charge,0));
 select * into strict p from payments where charge_id=p_charge;
 perform pg_advisory_xact_lock(hashtextextended(coalesce(p.user_id::text,'')||':'||coalesce(p.course_id::text,''),0));
 fresh:=p.refunded_at is null;
 update payments set refunded_at=coalesce(refunded_at,now()),refund_pending=false where id=p.id;
 update payment_refund_jobs set completed_at=coalesce(completed_at,now()),lease_until=null where charge_id=p_charge;
 update advent_tickets set revoked_at=coalesce(revoked_at,now()) where ref='stars:'||p_charge and used_at is null;
 if not exists(select 1 from payments where user_id=p.user_id and course_id=p.course_id and refunded_at is null and (not refund_pending or exists(select 1 from payment_refund_jobs j where j.charge_id=payments.charge_id and j.reason='manual'))) then
  delete from course_access where user_id=p.user_id and course_id=p.course_id and manual_source is null;
  update course_access set source=manual_source where user_id=p.user_id and course_id=p.course_id and manual_source is not null;
 end if;
 retained:=exists(select 1 from course_access where user_id=p.user_id and course_id=p.course_id);
 return jsonb_build_object('user_id',p.user_id,'course_id',p.course_id,'stars',p.stars,'new_refund',fresh,'access_retained',retained);
end $$;
revoke all on function public.queue_payment_refund(bigint), public.claim_payment_refund(text) from public,anon,authenticated;
grant execute on function public.queue_payment_refund(bigint), public.claim_payment_refund(text) to service_role;
