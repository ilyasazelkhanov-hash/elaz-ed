-- Reusable purchase intents, serialized checkout, independent access and refund outbox.
alter table public.payments add column refund_pending boolean not null default false;
alter table public.course_access add column manual_source text check(manual_source in ('admin','invites'));
update public.course_access set manual_source=source where source in ('admin','invites');
-- Recover approved manual access hidden behind an earlier payment row.
update public.course_access a set manual_source='admin' from public.access_requests r where r.user_id=a.user_id and r.course_id=a.course_id and r.status='approved';
create table public.course_purchase_intents (
 id uuid primary key default gen_random_uuid(),user_id bigint not null references public.users(id) on delete cascade,
 course_id bigint not null references public.courses(id) on delete cascade,stars integer not null check(stars>0),
 link text,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes',
 checkout_query text,checkout_until timestamptz,fulfilled_charge text
);
create index course_purchase_intents_pair on public.course_purchase_intents(user_id,course_id,created_at desc);
create table public.payment_refund_jobs (
 charge_id text primary key references public.payments(charge_id),user_id bigint not null,
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),lease_until timestamptz,lease_token uuid,
 completed_at timestamptz,last_error text,created_at timestamptz not null default now()
);
alter table public.course_purchase_intents enable row level security;
alter table public.payment_refund_jobs enable row level security;
revoke all on public.course_purchase_intents,public.payment_refund_jobs from public,anon,authenticated;
grant all on public.course_purchase_intents,public.payment_refund_jobs to service_role;

create function public.grant_course_access(p_user bigint,p_course bigint,p_source text) returns void language plpgsql set search_path=public as $$
begin
 if p_source not in ('admin','invites') then raise exception 'invalid_source'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_course::text,0));
 insert into course_access(user_id,course_id,source,manual_source) values(p_user,p_course,p_source,p_source)
 on conflict(user_id,course_id) do update set manual_source=case when course_access.manual_source='admin' then 'admin' else excluded.manual_source end;
end $$;
create or replace function public.decide_course_request(p_user bigint,p_course bigint,p_approve boolean) returns void language plpgsql set search_path=public as $$
begin
 if p_approve then perform grant_course_access(p_user,p_course,'admin'); end if;
 insert into access_requests(user_id,course_id,status,decided_at) values(p_user,p_course,case when p_approve then 'approved' else 'declined' end,now()) on conflict(user_id,course_id) do update set status=excluded.status,decided_at=excluded.decided_at;
end $$;
create function public.course_purchase_intent(p_user bigint,p_course bigint) returns jsonb language plpgsql set search_path=public as $$
declare c courses; i course_purchase_intents;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_course::text,0));
 select * into strict c from courses where id=p_course;
 if not c.published or c.price_stars<=0 then raise exception 'not_for_sale'; end if;
 if exists(select 1 from course_access where user_id=p_user and course_id=p_course) then raise exception 'already_open'; end if;
 select * into i from course_purchase_intents where user_id=p_user and course_id=p_course and fulfilled_charge is null and expires_at>now() and stars=c.price_stars order by created_at desc limit 1;
 if not found then insert into course_purchase_intents(user_id,course_id,stars) values(p_user,p_course,c.price_stars) returning * into i; end if;
 return jsonb_build_object('payload','purchase:'||i.id,'stars',i.stars,'link',i.link);
end $$;
create function public.course_purchase_link(p_user bigint,p_payload text,p_link text) returns text language plpgsql set search_path=public as $$
declare result text;
begin
 update course_purchase_intents set link=coalesce(link,p_link) where user_id=p_user and 'purchase:'||id=p_payload returning link into result;
 if not found then raise exception 'intent_not_found'; end if; return result;
end $$;
create function public.check_course_checkout(p_user bigint,p_payload text,p_stars integer,p_query text) returns boolean language plpgsql set search_path=public as $$
declare cid bigint;c courses;i course_purchase_intents;
begin
 if p_payload ~ '^course:[0-9]+:[0-9]+$' then
  if split_part(p_payload,':',3)::bigint<>p_user then return false;end if;
  cid:=split_part(p_payload,':',2)::bigint;
 else select course_id into cid from course_purchase_intents where user_id=p_user and 'purchase:'||id=p_payload;
 end if;
 if cid is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||cid::text,0));
 select * into c from courses where id=cid;
 if not found or not c.published or c.price_stars<=0 or c.price_stars<>p_stars or exists(select 1 from course_access where user_id=p_user and course_id=cid) then return false;end if;
 -- A second query, including another legacy invoice, cannot pass during the lease.
 if exists(select 1 from course_purchase_intents where user_id=p_user and course_id=cid and checkout_until>now() and checkout_query is distinct from p_query) then return false;end if;
 if p_payload like 'purchase:%' then
  select * into i from course_purchase_intents where user_id=p_user and 'purchase:'||id=p_payload for update;
  if not found or i.expires_at<=now() or i.fulfilled_charge is not null or i.stars<>p_stars then return false;end if;
 else
  select * into i from course_purchase_intents where user_id=p_user and course_id=cid and checkout_query=p_query limit 1;
  if not found then insert into course_purchase_intents(user_id,course_id,stars) values(p_user,cid,p_stars) returning * into i;end if;
 end if;
 update course_purchase_intents set checkout_query=p_query,checkout_until=now()+interval '10 minutes' where id=i.id;
 return true;
end $$;
create or replace function public.apply_star_payment(p_user bigint,p_course bigint,p_stars integer,p_charge text) returns jsonb language plpgsql set search_path=public as $$
declare p payments;fresh bigint;extra boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('charge:'||p_charge,0));
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_course::text,0));
 select * into p from payments where charge_id=p_charge;
 if found then
  if p.user_id is distinct from p_user or p.course_id is distinct from p_course or p.stars is distinct from p_stars or p.purpose<>'course' then raise exception 'Payment data mismatch';end if;
  return jsonb_build_object('duplicate',true,'refunded',p.refunded_at is not null,'refund_pending',p.refund_pending);
 end if;
 extra:=exists(select 1 from course_access where user_id=p_user and course_id=p_course);
 insert into payments(user_id,course_id,stars,charge_id,refund_pending) values(p_user,p_course,p_stars,p_charge,extra) returning id into fresh;
 if extra then
  insert into payment_refund_jobs(charge_id,user_id) values(p_charge,p_user) on conflict do nothing;
 else insert into course_access(user_id,course_id,source) values(p_user,p_course,'stars') on conflict do nothing;
 end if;
 return jsonb_build_object('duplicate',false,'refunded',false,'refund_pending',extra);
end $$;
create function public.apply_course_purchase(p_user bigint,p_payload text,p_stars integer,p_charge text) returns jsonb language plpgsql set search_path=public as $$
declare cid bigint;amount integer;result jsonb;
begin
 if p_payload ~ '^course:[0-9]+:[0-9]+$' then
  if split_part(p_payload,':',3)::bigint<>p_user then raise exception 'Payment data mismatch';end if;cid:=split_part(p_payload,':',2)::bigint;
 else
  select course_id,stars into cid,amount from course_purchase_intents where user_id=p_user and 'purchase:'||id=p_payload;
  if not found or amount<>p_stars then raise exception 'Payment data mismatch';end if;
 end if;
 result:=apply_star_payment(p_user,cid,p_stars,p_charge);
 update course_purchase_intents set fulfilled_charge=coalesce(fulfilled_charge,p_charge) where user_id=p_user and 'purchase:'||id=p_payload;
 return result||jsonb_build_object('course_id',cid);
end $$;
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
 if not exists(select 1 from payments where user_id=p.user_id and course_id=p.course_id and refunded_at is null and not refund_pending) then
  delete from course_access where user_id=p.user_id and course_id=p.course_id and manual_source is null;
  update course_access set source=manual_source where user_id=p.user_id and course_id=p.course_id and manual_source is not null;
 end if;
 retained:=exists(select 1 from course_access where user_id=p.user_id and course_id=p.course_id);
 return jsonb_build_object('user_id',p.user_id,'course_id',p.course_id,'stars',p.stars,'new_refund',fresh,'access_retained',retained);
end $$;
create function public.claim_payment_refunds(p_limit integer) returns jsonb language sql set search_path=public as $$
 with candidates as (select charge_id from payment_refund_jobs where completed_at is null and next_attempt_at<=now() and (lease_until is null or lease_until<now()) order by created_at for update skip locked limit least(greatest(p_limit,1),50)), claimed as (
 update payment_refund_jobs j set lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),attempts=attempts+1 from candidates c where j.charge_id=c.charge_id returning j.*)
 select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) from claimed;
$$;
create function public.finish_payment_refund(p_charge text,p_lease uuid,p_ok boolean,p_error text) returns boolean language plpgsql set search_path=public as $$
declare j payment_refund_jobs;
begin
 -- Same lock order as fulfillment/refund; leases fence stale workers.
 perform pg_advisory_xact_lock(hashtextextended('charge:'||p_charge,0));
 select * into j from payment_refund_jobs where charge_id=p_charge and lease_token=p_lease and completed_at is null for update;
 if not found then return false;end if;
 if p_ok then perform apply_star_refund(p_charge);
 else update payment_refund_jobs set lease_until=null,last_error=left(p_error,1000),next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(j.attempts-1,7)))::integer) where charge_id=p_charge;end if;
 return true;
end $$;
revoke all on function public.grant_course_access(bigint,bigint,text),public.course_purchase_intent(bigint,bigint),public.course_purchase_link(bigint,text,text),public.check_course_checkout(bigint,text,integer,text),public.apply_course_purchase(bigint,text,integer,text),public.claim_payment_refunds(integer),public.finish_payment_refund(text,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.grant_course_access(bigint,bigint,text),public.course_purchase_intent(bigint,bigint),public.course_purchase_link(bigint,text,text),public.check_course_checkout(bigint,text,integer,text),public.apply_course_purchase(bigint,text,integer,text),public.claim_payment_refunds(integer),public.finish_payment_refund(text,uuid,boolean,text) to service_role;
