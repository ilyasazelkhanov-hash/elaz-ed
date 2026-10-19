begin;
create table public.az_gifts(id uuid primary key default gen_random_uuid(),sender_id bigint not null references az_members,recipient_id bigint references az_members,reward_id text not null references az_entities,request_id uuid not null, token text not null unique default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''), cost integer not null check(cost>0),title text not null,status text not null default 'sent' check(status in ('sent','claimed','cancelled')),expires_at timestamptz not null default now()+interval '7 days',created_at timestamptz not null default now(),unique(sender_id,request_id),check(recipient_id is null or recipient_id<>sender_id));
create table public.az_passport(user_id bigint references az_members,entity_id text references az_entities,title text not null,earned_at timestamptz not null default now(),primary key(user_id,entity_id));
create table public.az_projects(id text primary key,user_id bigint not null references az_members,manager_id bigint not null references az_members,title text not null check(length(title) between 1 and 300),status text not null default 'active',milestones jsonb not null default '[]' check(jsonb_typeof(milestones)='array'),updated_at timestamptz not null default now());
create table public.az_preferences(user_id bigint primary key references az_members,sizes jsonb not null default '{}',style text not null default '');
alter table az_preferences enable row level security;
create table public.az_journeys(user_id bigint primary key references az_members,entity_id text not null,chosen_at timestamptz not null default now());
create table public.az_membership_charges(charge_id text primary key,invoice_id uuid not null references az_invoices,user_id bigint not null references az_members,entity_id text not null references az_entities,expires_at timestamptz not null,refunded boolean not null default false);
alter table az_gifts enable row level security;
alter table az_passport enable row level security;
alter table az_projects enable row level security;
alter table az_journeys enable row level security;
alter table az_membership_charges enable row level security;
alter function az_snapshot(bigint) rename to az_snapshot_base;
create function az_snapshot(p_actor bigint) returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare s jsonb;
begin
 s:=az_snapshot_base(p_actor);
 if exists(select 1 from az_settings where config->>'id'='og-cre8r') then
  s:=jsonb_set(s,'{me}',(s->'me')||jsonb_build_object('xp',(az_og_progress_summary(p_actor)->'totalXp'),'baseXp',(az_og_progress_summary(p_actor)->'baseXp'),'platformXp',(az_og_progress_summary(p_actor)->'platformXp')));
  s:=s||jsonb_build_object('leaderboard',(az_og_progress_top(p_actor)->'top'));
 end if;
 return s||jsonb_build_object(
 'gifts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'senderId',sender_id::text,'recipientId',recipient_id::text,'rewardId',reward_id,'title',title,'status',status,'expiresAt',expires_at,'createdAt',created_at)) from az_gifts where sender_id=p_actor or recipient_id=p_actor),'[]'::jsonb),
 'passport',coalesce((select jsonb_agg(jsonb_build_object('entityId',entity_id,'title',title,'earnedAt',earned_at)) from az_passport where user_id=p_actor),'[]'::jsonb),
 'projects',coalesce((select jsonb_agg(jsonb_build_object('id',id,'userId',user_id::text,'managerId',manager_id::text,'title',title,'status',status,'milestones',milestones,'updatedAt',updated_at)) from az_projects where user_id=p_actor or manager_id=p_actor or exists(select 1 from az_members where id=p_actor and role in ('owner','admin'))),'[]'::jsonb),
 'membership',coalesce((select jsonb_agg(jsonb_build_object('entityId',entity_id,'expiresAt',expiry,'status',case when expiry>now() then 'active' else 'expired' end)) from (select entity_id,max(expires_at) expiry from az_membership_charges where user_id=p_actor and not refunded group by entity_id) x),'[]'::jsonb),
 'preferences',(select jsonb_build_object('sizes',sizes,'style',style) from az_preferences where user_id=p_actor),
 'journey',(select jsonb_build_object('entityId',entity_id,'chosenAt',chosen_at) from az_journeys where user_id=p_actor));
end $$;
alter function az_dispatch(bigint,text,jsonb) rename to az_dispatch_base;
create function az_dispatch(p_actor bigint,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare m az_members;e az_entities;g az_gifts;pr az_projects;j jsonb; item jsonb; items jsonb;cost integer;result jsonb:='{}';
begin
 if p_action not in ('gift.send','gift.claim','gift.cancel','passport.claim','project.approve','admin.project.save','admin.project.update','journey.choose','profile.preferences') then return az_dispatch_base(p_actor,p_action,p_payload);end if;
 if jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_payload';end if;
 select * into m from az_members where id=p_actor for update;
 if m.id is null then raise exception 'authentication_required';end if;
 if exists(select 1 from az_settings where config->>'access' in ('employee','invite') and not m.approved and m.role not in ('owner','admin')) then raise exception 'access_denied';end if;
 perform az_require_module(case when p_action like 'gift.%' then 'loyalty' when p_action like '%project%' or p_action='profile.preferences' then 'commerce' else 'progress' end);
 if p_action='profile.preferences' then
  if jsonb_typeof(p_payload->'sizes') is distinct from 'object' or exists(select 1 from jsonb_each(p_payload->'sizes') x where x.key not in ('top','bottom','shoe') or jsonb_typeof(x.value)<>'string' or length(x.value#>>'{}')>30) or coalesce(length(p_payload->>'style'),0)>100 or (p_payload ? 'style' and jsonb_typeof(p_payload->'style')<>'string') then raise exception 'invalid_preferences';end if;
  insert into az_preferences values(p_actor,p_payload->'sizes',coalesce(p_payload->>'style','')) on conflict(user_id) do update set sizes=excluded.sizes,style=excluded.style;
 elsif p_action='gift.send' then
  select * into g from az_gifts where sender_id=p_actor and request_id=(p_payload->>'requestId')::uuid;
  if g.id is not null then
   if g.reward_id is distinct from p_payload->>'entityId' then raise exception 'request_conflict';end if;
  else
   select * into e from az_entities where id=p_payload->>'entityId' for update;
   if e.id is null or e.kind<>'reward' or not e.published or not az_can_access(p_actor,e.id) or coalesce(e.data->>'digital','false')='true' then raise exception 'invalid_reward';end if;
   cost:=(e.data->>'pointsCost')::integer;
   if cost is null or cost<=0 or m.points<cost then raise exception 'insufficient_points';end if;
   if e.capacity is not null and e.capacity<=0 then raise exception 'out_of_stock';end if;
   insert into az_gifts(sender_id,reward_id,request_id,cost,title) values(p_actor,e.id,(p_payload->>'requestId')::uuid,cost,e.title) returning * into g;
   perform az_credit(p_actor,-cost,'gift', 'gift:'||g.id);
   update az_entities set capacity=capacity-1 where id=e.id and capacity is not null;
  end if;
  result:=jsonb_build_object('giftId',g.id,'token',g.token,'link','?gift='||g.token);
 elsif p_action='gift.claim' then
  select * into g from az_gifts where token=p_payload->>'token' for update;
  if g.id is null or g.sender_id=p_actor then raise exception 'invalid_gift';end if;
  if g.status='claimed' and g.recipient_id=p_actor then null;
  elsif g.status<>'sent' or g.expires_at<=now() then raise exception 'gift_unavailable';
  else
   update az_gifts set status='claimed',recipient_id=p_actor where id=g.id;
   insert into az_coupons(user_id,reward_id,title,expires_at) values(p_actor,g.reward_id,g.title,now()+interval '30 days');
  end if;
 elsif p_action='gift.cancel' then
  select * into g from az_gifts where id=(p_payload->>'giftId')::uuid for update;
  if g.id is null or g.sender_id<>p_actor then raise exception 'forbidden';end if;
  if g.status='claimed' then raise exception 'gift_already_claimed';end if;
  if g.status='sent' then
   update az_gifts set status='cancelled' where id=g.id;
   perform az_credit(p_actor,g.cost,'gift_refund','gift_refund:'||g.id);
   update az_entities set capacity=capacity+1 where id=g.reward_id and capacity is not null;
  end if;
 elsif p_action='passport.claim' then
  select * into e from az_entities where id=p_payload->>'entityId';
  if e.id is null or not exists(select 1 from az_progress where user_id=p_actor and entity_id=e.id) then raise exception 'verified_action_required';end if;
  insert into az_passport(user_id,entity_id,title) values(p_actor,e.id,e.title) on conflict do nothing;
 elsif p_action='journey.choose' then
  if p_payload->>'entityId' not in ('goal:tools','goal:content','goal:apps','goal:services') and not az_can_access(p_actor,p_payload->>'entityId') then raise exception 'entity_unavailable';end if;
  insert into az_journeys values(p_actor,p_payload->>'entityId',now()) on conflict(user_id) do update set entity_id=excluded.entity_id,chosen_at=excluded.chosen_at;
 elsif p_action in ('admin.project.save','admin.project.update') then
  j:=p_payload->'project';
  select * into pr from az_projects where id=j->>'id' for update;
  if m.role not in ('owner','admin') and (m.role<>'editor' or pr.manager_id is distinct from p_actor) then raise exception 'forbidden';end if;
  if m.role not in ('owner','admin') and (pr.user_id::text is distinct from j->>'userId' or pr.manager_id::text is distinct from j->>'managerId') then raise exception 'forbidden';end if;
  if length(j->>'id') not between 1 and 100 or jsonb_typeof(j->'milestones')<>'array' or jsonb_array_length(j->'milestones')>50 then raise exception 'invalid_project';end if;
  items:='[]';
  for item in select value from jsonb_array_elements(j->'milestones') loop
   if length(coalesce(item->>'id','')) not between 1 and 100 or length(coalesce(item->>'title','')) not between 1 and 300 or item->>'status' not in ('pending','review','approved') or jsonb_typeof(item->'media')<>'array' or jsonb_typeof(item->'documents')<>'array' then raise exception 'invalid_milestone';end if;
   if exists(select 1 from jsonb_array_elements(items) x where x->>'id'=item->>'id') then raise exception 'duplicate_milestone';end if;
   if exists(select 1 from jsonb_array_elements_text(item->'media') x where x !~ '^https://') or exists(select 1 from jsonb_array_elements(item->'documents') x where coalesce(x->>'url','') !~ '^https://') then raise exception 'invalid_project_url';end if;
   if item->>'status'='approved' and not exists(select 1 from jsonb_array_elements(coalesce(pr.milestones,'[]')) x where x=item) then raise exception 'client_approval_required';end if;
   items:=items||jsonb_build_array(item);
  end loop;
  insert into az_projects(id,user_id,manager_id,title,status,milestones) values(j->>'id',(j->>'userId')::bigint,(j->>'managerId')::bigint,j->>'title',coalesce(j->>'status','active'),items) on conflict(id) do update set user_id=excluded.user_id,manager_id=excluded.manager_id,title=excluded.title,status=excluded.status,milestones=excluded.milestones,updated_at=now();
 elsif p_action='project.approve' then
  select * into pr from az_projects where id=p_payload->>'projectId' for update;
  if pr.user_id is distinct from p_actor then raise exception 'forbidden';end if;
  if not exists(select 1 from jsonb_array_elements(pr.milestones) x where x->>'id'=p_payload->>'milestoneId' and x->>'status' in ('review','approved')) then raise exception 'milestone_unavailable';end if;
  select jsonb_agg(case when x->>'id'=p_payload->>'milestoneId' then x||'{"status":"approved"}'::jsonb else x end) into items from jsonb_array_elements(pr.milestones) x;
  update az_projects set milestones=items,updated_at=now() where id=pr.id;
 end if;
 return jsonb_build_object('snapshot',az_snapshot(p_actor),'result',result);
end $$;
create or replace function public.az_invoice_prepare(p_actor bigint,p_entity_id text) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare e az_entities; i az_invoices;
begin
 perform az_require_module('learning'); perform 1 from az_members where id=p_actor for update;
 select * into e from az_entities where id=p_entity_id and kind='course';
 if e.id is null or e.price<=0 or not az_can_access(p_actor,e.id) then raise exception 'invalid_course'; end if;
 if coalesce(e.data->>'subscription','false')<>'true' and exists(select 1 from az_enrollments where user_id=p_actor and course_id=e.id and not revoked) then raise exception 'already_enrolled'; end if;
 select * into i from az_invoices where user_id=p_actor and entity_id=e.id and status='pending' and amount=e.price and created_at>now()-interval '1 hour' order by created_at desc limit 1;
 if i.id is null then insert into az_invoices(user_id,entity_id,amount,currency) values(p_actor,e.id,e.price,'XTR') returning * into i; end if;
 return jsonb_build_object('invoiceId',i.id,'amount',i.amount,'title',e.title,'description',left(coalesce(nullif(e.subtitle,''),e.title),255),'subscriptionPeriod',case when e.data->>'subscription'='true' then 2592000 else null end);
end $$;
alter function az_can_access(bigint,text) rename to az_can_access_base;
create function az_can_access(p_actor bigint,p_entity text) returns boolean language plpgsql stable set search_path=public,pg_temp as $$
declare e az_entities;c az_entities;
begin
 select * into e from az_entities where id=p_entity;
 if e.kind='lesson' then
  select * into c from az_entities where id=e.data->>'courseId';
  if c.data->>'subscription'='true' and not exists(select 1 from az_members where id=p_actor and role in ('owner','admin')) and not exists(select 1 from az_membership_charges where user_id=p_actor and entity_id=c.id and not refunded and expires_at>now()) then return false;end if;
 end if;
 return az_can_access_base(p_actor,p_entity);
end $$;
alter function az_webhook(jsonb) rename to az_webhook_base;
create function az_webhook(p_update jsonb) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare inv az_invoices;pay jsonb;pc jsonb;uid bigint;out jsonb;expiry timestamptz;is_refund boolean;charge text;
begin
 pc:=p_update->'pre_checkout_query';pay:=coalesce(p_update->'message'->'successful_payment',p_update->'message'->'refunded_payment');
 select * into inv from az_invoices where id::text=coalesce(pc->>'invoice_payload',pay->>'invoice_payload');
 if inv.id is null or not exists(select 1 from az_entities where id=inv.entity_id and data->>'subscription'='true') then return az_webhook_base(p_update);end if;
 uid:=coalesce(pc->'from'->>'id',p_update->'message'->'from'->>'id')::bigint;
 perform 1 from az_members where id=uid for update;
 select * into inv from az_invoices where id=inv.id for update;
 insert into az_webhook_inbox(update_id,payload) values((p_update->>'update_id')::bigint,p_update) on conflict do nothing;
 if not found then return coalesce((select response from az_webhook_inbox where update_id=(p_update->>'update_id')::bigint),'{"ok":true}');end if;
 if pc is not null then
  out:=jsonb_build_object('preCheckoutId',pc->>'id','accepted',inv.user_id=uid and inv.amount=(pc->>'total_amount')::integer and pc->>'currency'='XTR' and inv.status in ('pending','checkout') and not exists(select 1 from az_membership_charges where user_id=uid and entity_id=inv.entity_id and not refunded and expires_at>now()));
  if (out->>'accepted')::boolean then update az_invoices set status='checkout',reserved_until=now()+interval '15 minutes' where id=inv.id;end if;
 else
  charge:=pay->>'telegram_payment_charge_id';is_refund:=p_update->'message' ? 'refunded_payment';
  if uid is distinct from inv.user_id or inv.amount is distinct from (pay->>'total_amount')::integer or pay->>'currency' is distinct from 'XTR' or length(coalesce(charge,''))=0 then raise exception 'payment_mismatch';end if;
  if exists(select 1 from az_membership_charges where charge_id=charge and invoice_id<>inv.id) then raise exception 'payment_mismatch';end if;
  if not is_refund and coalesce((pay->>'is_recurring')::boolean,false)=false then raise exception 'invalid_subscription';end if;
  expiry:=case when is_refund then now() else to_timestamp((pay->>'subscription_expiration_date')::bigint) end;
  if expiry is null then raise exception 'invalid_subscription_expiry';end if;
  insert into az_membership_charges(charge_id,invoice_id,user_id,entity_id,expires_at,refunded) values(charge,inv.id,uid,inv.entity_id,expiry,is_refund) on conflict(charge_id) do update set refunded=az_membership_charges.refunded or excluded.refunded;
  update az_invoices set status=case when exists(select 1 from az_membership_charges where charge_id=charge and refunded) then 'refunded' else 'paid' end,charge_id=charge where id=inv.id;
  if exists(select 1 from az_membership_charges where user_id=uid and entity_id=inv.entity_id and not refunded and expires_at>now()) then
   insert into az_enrollments(user_id,course_id,source) values(uid,inv.entity_id,'subscription') on conflict(user_id,course_id) do update set revoked=false,source='subscription';
  else update az_enrollments set revoked=true where user_id=uid and course_id=inv.entity_id;end if;
  out:='{"ok":true}';
 end if;
 update az_webhook_inbox set response=out,processed_at=now() where update_id=(p_update->>'update_id')::bigint;
 return out;
end $$;
create function az_membership_refund_sync() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin
 if new.status='refunded' and old.status is distinct from new.status then update az_membership_charges set refunded=true where charge_id=new.charge_id;end if;return new;end $$;
create trigger az_membership_refund after update on az_invoices for each row execute function az_membership_refund_sync();
create function az_og_progress_summary(p_actor bigint) returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare legacy jsonb;platform integer;
begin
 if not exists(select 1 from az_settings where config->>'id'='og-cre8r') then raise exception 'bridge_disabled';end if;
 select xp into platform from az_members where id=p_actor;
 if platform is null then raise exception 'authentication_required';end if;
 if to_regclass('public.users') is not null then execute 'select to_jsonb(u) from public.users u where id::text=$1' into legacy using p_actor::text;end if;
 return jsonb_build_object('baseXp',coalesce((legacy->>'xp')::integer,0),'platformXp',platform,'totalXp',coalesce((legacy->>'xp')::integer,0)+platform,'name',coalesce(legacy->>'first_name',(select name from az_members where id=p_actor)),'photoUrl',legacy->>'photo_url');
end $$;
create or replace function public.az_can_access_base(p_actor bigint,p_entity text) returns boolean language plpgsql stable set search_path=public,pg_temp as $$
declare e az_entities; c az_entities; m az_members; enrollment az_enrollments; previous_id text;
begin
 select * into m from az_members where id=p_actor; select * into e from az_entities where id=p_entity;
 if e.id is null or m.id is null or not exists(select 1 from az_settings where config->'modules' ? e.module) then return false; end if;
 if m.role in ('owner','admin') then return true; end if;
 if not e.published or e.publish_at>now() or e.audience='employees' and not m.approved or e.team_id is not null and e.team_id is distinct from m.team_id then return false; end if;
 if e.kind='lesson' then
   select * into c from az_entities where id=e.data->>'courseId' and kind='course';
   if c.id is null or not az_can_access(p_actor,c.id) then return false; end if;
   select * into enrollment from az_enrollments where user_id=p_actor and course_id=c.id and not revoked;
   if c.price>0 and enrollment.user_id is null and not (c.data->>'subscription'='true' and exists(select 1 from az_membership_charges where user_id=p_actor and entity_id=c.id and not refunded and expires_at>now())) then return false; end if;
   if coalesce((e.data->>'dripDays')::integer,0)>0 and (enrollment.user_id is null or now()<enrollment.granted_at+make_interval(days=>(e.data->>'dripDays')::integer)) then return false; end if;
   if coalesce((c.data->>'ordered')::boolean,false) then
     select id into previous_id from az_entities where kind='lesson' and data->>'courseId'=c.id and published and coalesce((data->>'order')::integer,0)<coalesce((e.data->>'order')::integer,0) order by coalesce((data->>'order')::integer,0) desc limit 1;
     if previous_id is not null and not exists(select 1 from az_progress where user_id=p_actor and entity_id=previous_id) then return false; end if;
   end if;
 end if;
 return true;
end $$;
create function az_og_progress_top(p_actor bigint) returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare rows jsonb;place bigint;
begin
 perform az_og_progress_summary(p_actor);
 if to_regclass('public.users') is null then return jsonb_build_object('top','[]'::jsonb,'rank',null);end if;
 execute $q$ with totals as (
 select u.id::text id,coalesce(to_jsonb(u)->>'first_name',m.name,'Участник') name,to_jsonb(u)->>'photo_url' photo,
 coalesce((to_jsonb(u)->>'xp')::integer,0)+coalesce(m.xp,0) xp,coalesce((to_jsonb(u)->>'streak')::integer,0) streak
 from public.users u left join az_members m on m.id::text=u.id::text and m.verified_at is not null
 where coalesce((to_jsonb(u)->>'subscribed')::boolean,false)
 ),ranked as (select *,row_number() over(order by xp desc,id) position from totals)
 select jsonb_build_object('top',coalesce((select jsonb_agg(to_jsonb(x)-'position') from (select * from ranked order by position limit 100) x),'[]'::jsonb),'rank',(select position from ranked where id=$1)) $q$ into rows using p_actor::text;
 return rows;
end $$;
do $$ declare r record;begin
 for r in select tablename from pg_tables where schemaname='public' and tablename like 'az_%' loop
 execute format('revoke all on table public.%I from public,anon,authenticated',r.tablename);
 execute format('grant all on table public.%I to service_role',r.tablename);
 end loop;
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'az_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',r.signature);
 execute format('grant execute on function %s to service_role',r.signature);
 end loop;
end $$;
commit;
