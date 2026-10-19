begin;
-- Refund jobs retain their original immutable charge even when the subscription invoice renews.
alter table az_refund_jobs add column charge_id text;
update az_refund_jobs r set charge_id=i.charge_id from az_invoices i where i.id=r.invoice_id;
alter table az_refund_jobs alter column charge_id set not null;
alter table az_refund_jobs drop constraint az_refund_jobs_invoice_id_key;
alter table az_refund_jobs add unique(invoice_id,charge_id);
create or replace function public.az_refund_request(p_actor bigint,p_invoice_id uuid,p_reason text default '') returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare inv az_invoices; job az_refund_jobs;
begin
 perform az_require_role(p_actor,array[]::text[]); perform az_require_module('learning'); perform az_actor(p_actor);
 select * into inv from az_invoices where id=p_invoice_id for update;
 if inv.id is null or inv.status not in ('paid','refunded') or inv.charge_id is null then raise exception 'invoice_not_refundable'; end if;
 insert into az_refund_jobs(invoice_id,charge_id,requested_by,reason,status) values(inv.id,inv.charge_id,p_actor,left(p_reason,1000),case when inv.status='refunded' then 'succeeded' else 'pending' end) on conflict(invoice_id,charge_id) do nothing;
 select * into job from az_refund_jobs where invoice_id=inv.id and charge_id=inv.charge_id;
 insert into az_audit(actor_id,action,target_id) values(p_actor,'admin.refund',inv.id::text);
 return az_refund_json(job);
end $$;
create or replace function public.az_refunds_claim(p_limit integer default 5,p_invoice_id uuid default null) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare out jsonb;
begin
 update az_refund_jobs r set status='succeeded',lease_token=null,lease_until=null from az_invoices i where i.id=r.invoice_id and ((i.status='refunded' and i.charge_id=r.charge_id) or exists(select 1 from az_membership_charges c where c.charge_id=r.charge_id and c.refunded)) and r.status<>'succeeded';
 update az_refund_jobs set status='dead',lease_token=null,lease_until=null where status in ('pending','leased') and attempts>=5 and (lease_until is null or lease_until<now());
 with ready as (select r.id from az_refund_jobs r join az_invoices i on i.id=r.invoice_id where r.status in ('pending','leased') and r.attempts<5 and r.next_at<=now() and (r.lease_until is null or r.lease_until<now()) and (i.status='paid' or exists(select 1 from az_membership_charges c where c.charge_id=r.charge_id and not c.refunded)) and (p_invoice_id is null or i.id=p_invoice_id) order by r.next_at limit greatest(1,least(p_limit,10)) for update of r skip locked),
 claimed as (update az_refund_jobs r set status='leased',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1 from ready where r.id=ready.id returning r.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'invoiceId',i.id,'leaseToken',r.lease_token,'userId',i.user_id::text,'chargeId',r.charge_id)),'[]') into out from claimed r join az_invoices i on i.id=r.invoice_id;
 return out;
end $$;
create or replace function public.az_refunds_finish(p_id uuid,p_lease uuid,p_success boolean,p_error text default '',p_retry integer default 0) returns void language plpgsql set search_path=public,pg_temp as $$
declare r az_refund_jobs; inv az_invoices;
begin
 select * into r from az_refund_jobs where id=p_id and lease_token=p_lease and status='leased' for update; if r.id is null then return; end if;
 select * into inv from az_invoices where id=r.invoice_id for update;
 if p_success then
   update az_membership_charges set refunded=true where charge_id=r.charge_id;
   update az_invoices set status='refunded' where id=inv.id and charge_id=r.charge_id;
   update az_enrollments set revoked=true where user_id=inv.user_id and course_id=inv.entity_id and source=inv.id::text;
   update az_refund_jobs set status='succeeded',lease_token=null,lease_until=null,last_error=null where id=r.id;
 else update az_refund_jobs set status=case when attempts>=5 then 'dead' else 'pending' end,next_at=now()+make_interval(secs=>greatest(p_retry,least(3600,(power(2,attempts)*30)::integer))),lease_token=null,lease_until=null,last_error=left(p_error,200) where id=r.id;
 end if;
end $$;
create or replace function public.az_payments(p_actor bigint,p_limit integer default 100,p_before text default null) returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare out jsonb;
begin
 perform az_require_role(p_actor,array[]::text[]); perform az_require_module('learning');
 select coalesce(jsonb_agg(jsonb_build_object('invoiceId',i.id,'userId',i.user_id::text,'name',m.name,'entityId',i.entity_id,'title',e.title,'amount',i.amount,'currency',i.currency,'status',i.status,'createdAt',i.created_at,
 'refund',(select jsonb_build_object('id',r.id,'status',r.status,'attempts',r.attempts,'nextAt',r.next_at,'lastError',r.last_error) from az_refund_jobs r where r.invoice_id=i.id and r.charge_id=i.charge_id)) order by i.created_at desc,i.id desc),'[]') into out
 from (select * from az_invoices where p_before is null or created_at<p_before::timestamptz order by created_at desc,id desc limit greatest(1,least(p_limit,200))) i join az_members m on m.id=i.user_id join az_entities e on e.id=i.entity_id;
 return out;
end $$;
create or replace function az_og_progress_summary(p_actor bigint) returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare legacy jsonb;platform integer;
begin
 if not exists(select 1 from az_settings where config->>'id'='og-cre8r') then raise exception 'bridge_disabled';end if;
 select xp into platform from az_members where id=p_actor;

 if to_regclass('public.users') is not null then execute 'select to_jsonb(u) from public.users u where id::text=$1' into legacy using p_actor::text;end if;
 if legacy is null and platform is null then raise exception 'authentication_required';end if;
 platform:=coalesce(platform,0);
 return jsonb_build_object('baseXp',coalesce((legacy->>'xp')::integer,0),'platformXp',platform,'totalXp',coalesce((legacy->>'xp')::integer,0)+platform,'name',coalesce(legacy->>'first_name',(select name from az_members where id=p_actor)),'photoUrl',legacy->>'photo_url');
end $$;
alter table az_files add column project_id text references az_projects;
alter table az_files drop constraint az_files_purpose_check;
alter table az_files add check(purpose in ('homework','content','project'));
alter table az_files add check((purpose='project')=(project_id is not null));
create function az_project_file_access(p_actor bigint,p_project text) returns boolean language sql stable set search_path=public,pg_temp as $$
 select exists(select 1 from az_projects p join az_members m on m.id=p_actor where p.id=p_project and (p.user_id=p_actor or m.role in ('owner','admin') or p.manager_id=p_actor and m.role='editor'))
$$;
alter function az_file_create(bigint,text,text,text) rename to az_file_create_base;
create function az_file_create(p_actor bigint,p_filename text,p_type text,p_purpose text) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare file_id uuid:=gen_random_uuid();project text;path text;
begin
 if p_purpose not like 'project:%' then return az_file_create_base(p_actor,p_filename,p_type,p_purpose);end if;
 perform az_require_module('commerce');perform az_actor(p_actor);project:=substring(p_purpose from 9);
 if not az_project_file_access(p_actor,project) then raise exception 'file_forbidden';end if;
 if p_type not in ('image/jpeg','image/png','image/webp','application/pdf','text/plain') or length(p_filename) not between 1 and 200 then raise exception 'invalid_file';end if;
 path:='projects/'||file_id;
 insert into az_files(id,user_id,object_path,filename,content_type,purpose,project_id) values(file_id,p_actor,path,p_filename,p_type,'project',project);
 return jsonb_build_object('fileId',file_id,'path',path);
end $$;
alter function az_file_get(bigint,text) rename to az_file_get_base;
create function az_file_get(p_actor bigint,p_file_id text) returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare f az_files;
begin
 select * into f from az_files where id::text=p_file_id;
 if f.purpose is distinct from 'project' then return az_file_get_base(p_actor,p_file_id);end if;
 perform az_require_module('commerce');perform az_actor(p_actor);
 if not az_project_file_access(p_actor,f.project_id) then raise exception 'file_forbidden';end if;
 return jsonb_build_object('path',f.object_path,'filename',f.filename);
end $$;
create or replace function az_dispatch(p_actor bigint,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql set search_path=public,pg_temp as $$
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
   if exists(select 1 from (select value url from jsonb_array_elements_text(item->'media') union all select value->>'url' from jsonb_array_elements(item->'documents')) refs where coalesce(url,'') !~ '^(https://|file:[a-f0-9-]{36}$)' or url ~ '/storage/v1/object/sign/' or url ~ '[?&](token|signature|X-Amz-Signature)=') then raise exception 'invalid_project_url';end if;
   if exists(select 1 from (select value url from jsonb_array_elements_text(item->'media') union all select value->>'url' from jsonb_array_elements(item->'documents')) refs where url like 'file:%' and not exists(select 1 from az_files f where f.id::text=substring(refs.url from 6) and f.purpose='project' and f.project_id=j->>'id')) then raise exception 'file_forbidden';end if;
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
create or replace function az_webhook(p_update jsonb) returns jsonb language plpgsql set search_path=public,pg_temp as $$
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
  update az_invoices set status=case when exists(select 1 from az_membership_charges where charge_id=charge and refunded) then 'refunded' else 'paid' end,charge_id=charge where id=inv.id and (charge_id=charge or charge_id is null or (not is_refund and coalesce((select expires_at from az_membership_charges where charge_id=az_invoices.charge_id),'-infinity'::timestamptz)<=expiry));
  if exists(select 1 from az_membership_charges where user_id=uid and entity_id=inv.entity_id and not refunded and expires_at>now()) then
   insert into az_enrollments(user_id,course_id,source) values(uid,inv.entity_id,'subscription') on conflict(user_id,course_id) do update set revoked=false,source='subscription';
  else update az_enrollments set revoked=true where user_id=uid and course_id=inv.entity_id;end if;
  out:='{"ok":true}';
 end if;
 update az_webhook_inbox set response=out,processed_at=now() where update_id=(p_update->>'update_id')::bigint;
 return out;
end $$;
do $$ declare r record;begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'az_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',r.signature);execute format('grant execute on function %s to service_role',r.signature);end loop;end $$;
commit;
