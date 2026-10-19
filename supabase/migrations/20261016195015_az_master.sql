-- Independent application tables. Does not modify any OG table or migration.
-- PostgreSQL 15+, no extensions required; service-only RPC API.
begin;
create table public.az_settings (id boolean primary key default true check(id), config jsonb not null, brand jsonb not null, rules jsonb not null default '{}');
create table public.az_members (
 id bigint primary key check(id>0), name text not null, username text not null default '',
 role text not null default 'member' check(role in ('owner','admin','editor','campaign_manager','moderator','mentor','analyst','cashier','member')),
 team_id text, approved boolean not null default false, xp integer not null default 0 check(xp>=0), points integer not null default 0 check(points>=0),
 streak integer not null default 0, freezes integer not null default 0, last_daily date, stamps integer not null default 0,
 notification_opt_in boolean not null default true, quiet_from integer not null default 22 check(quiet_from between 0 and 23), quiet_to integer not null default 8 check(quiet_to between 0 and 23),
 timezone text not null default 'UTC', achievements jsonb not null default '[]', point_ids text[] not null default '{}', verified_at timestamptz, access_verified_at timestamptz, created_at timestamptz not null default now()
);
create table public.az_entities (
 id text primary key check(length(id) between 1 and 200), kind text not null check(kind in ('article','story','video','file','course','lesson','campaign','mission','reward','product','service','event','slot','team','poll','program')),
 module text not null check(module in ('content','learning','campaigns','progress','loyalty','commerce','events','community','team','retention','analytics')),
 title text not null check(length(title) between 1 and 300), subtitle text not null default '', body text not null default '', tag text not null default '', cover text not null default '',
 published boolean not null default false, publish_at timestamptz, audience text not null default 'all' check(audience in ('all','employees','members')),
 team_id text, price integer not null default 0 check(price>=0), capacity integer check(capacity is null or capacity>=0), data jsonb not null default '{}', created_at timestamptz not null default now(),
 check ((kind in ('article','story','video','file') and module='content') or (kind in ('course','lesson') and module='learning') or (kind in ('campaign','mission') and module='campaigns') or (kind='reward' and module='loyalty') or (kind in ('product','service') and module='commerce') or (kind in ('event','slot') and module='events') or (kind in ('team','poll','program') and module='team'))
);
create table public.az_progress (id uuid primary key default gen_random_uuid(), user_id bigint not null references public.az_members, entity_id text not null references public.az_entities, campaign_id text, score integer not null default 0, completed_at timestamptz not null default now(), unique(user_id,entity_id));
create table public.az_ledger (id uuid primary key default gen_random_uuid(), user_id bigint not null references public.az_members, delta integer not null check(delta<>0), reason text not null, ref text not null, created_at timestamptz not null default now(), unique(user_id,ref));
create table public.az_toggles (user_id bigint not null references public.az_members, entity_id text not null references public.az_entities, kind text not null check(kind in ('favorite','reaction')), primary key(user_id,entity_id,kind));
create table public.az_quiz_attempts (id uuid primary key default gen_random_uuid(), user_id bigint not null references public.az_members, entity_id text not null references public.az_entities, questions jsonb not null, answers jsonb not null default '[]', score integer not null default 0, practice boolean not null default false, expires_at timestamptz not null default now()+interval '1 hour');
create unique index az_quiz_reward_attempt on public.az_quiz_attempts(user_id,entity_id) where not practice;
create table public.az_game_sessions (id uuid primary key default gen_random_uuid(), user_id bigint not null references public.az_members, entity_id text not null references public.az_entities, campaign_id text not null, game text not null, day integer not null, outcome integer not null, min_seconds integer not null default 1, started_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '10 minutes', used boolean not null default false);
create table public.az_coupons (id uuid primary key default gen_random_uuid(), user_id bigint not null references public.az_members, reward_id text not null references public.az_entities, title text not null, code text not null unique default 'AZ-'||upper(replace(gen_random_uuid()::text,'-','')), status text not null default 'issued' check(status in ('issued','redeemed','expired')), expires_at timestamptz not null, point_id text, campaign_id text, redeemed_by bigint references public.az_members, created_at timestamptz not null default now());
create table public.az_bookings (id uuid primary key default gen_random_uuid(), entity_id text not null references public.az_entities, user_id bigint not null references public.az_members, status text not null check(status in ('confirmed','waitlist','cancelled','checked_in')), code text not null unique default 'EV-'||upper(replace(gen_random_uuid()::text,'-','')), created_at timestamptz not null default now(), unique(entity_id,user_id));
create index az_bookings_waitlist on public.az_bookings(entity_id,created_at) where status='waitlist';
create table public.az_orders (id uuid primary key default gen_random_uuid(), user_id bigint not null references public.az_members, request_id uuid not null, request_payload jsonb not null, items jsonb not null, total integer not null check(total>=0), status text not null default 'new' check(status in ('new','accepted','ready','completed','cancelled')), note text not null default '', created_at timestamptz not null default now(),unique(user_id,request_id));
create table public.az_posts (id uuid primary key default gen_random_uuid(), user_id bigint not null references public.az_members, body text not null check(length(body) between 1 and 5000), topic text not null default 'general', status text not null default 'pending' check(status in ('published','pending','hidden')), audience text not null default 'all' check(audience in ('all','employees')), team_id text, created_at timestamptz not null default now());
create table public.az_post_likes (post_id uuid not null references public.az_posts, user_id bigint not null references public.az_members, primary key(post_id,user_id));
create table public.az_post_reports (post_id uuid not null references public.az_posts, user_id bigint not null references public.az_members, primary key(post_id,user_id));
create table public.az_comments (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.az_posts, user_id bigint not null references public.az_members, body text not null check(length(body) between 1 and 3000), created_at timestamptz not null default now());
create table public.az_files (id uuid primary key default gen_random_uuid(), user_id bigint not null references public.az_members, object_path text not null unique, filename text not null, content_type text not null, purpose text not null check(purpose in ('homework','content')), entity_id text references public.az_entities, created_at timestamptz not null default now());
create table public.az_homework (id uuid primary key default gen_random_uuid(), user_id bigint not null references public.az_members, lesson_id text not null references public.az_entities, body text not null check(length(body) between 1 and 10000), file text not null default '', status text not null default 'submitted' check(status in ('submitted','revision','approved')), feedback text not null default '', created_at timestamptz not null default now(), unique(user_id,lesson_id));
create table public.az_notices (id uuid primary key default gen_random_uuid(), user_id bigint not null references public.az_members, title text not null, body text not null, read boolean not null default false, created_at timestamptz not null default now());
create table public.az_audit (id uuid primary key default gen_random_uuid(), actor_id bigint references public.az_members, action text not null, target_id text not null default '', created_at timestamptz not null default now());
create table public.az_votes (user_id bigint not null references public.az_members, entity_id text not null references public.az_entities, option integer not null check(option>=0), primary key(user_id,entity_id));
create table public.az_recognitions (id uuid primary key default gen_random_uuid(), from_id bigint not null references public.az_members, to_id bigint not null references public.az_members, body text not null check(length(body) between 1 and 3000), created_at timestamptz not null default now());
create table public.az_referrals (user_id bigint primary key references public.az_members, referrer_id bigint not null references public.az_members, check(user_id<>referrer_id));
create table public.az_visits (user_id bigint not null references public.az_members, day date not null, cashier_id bigint not null references public.az_members, primary key(user_id,day));
create table public.az_invites (code text primary key, user_id bigint references public.az_members, expires_at timestamptz not null, used_by bigint references public.az_members);
create table public.az_enrollments (user_id bigint not null references public.az_members, course_id text not null references public.az_entities, source text not null, granted_at timestamptz not null default now(), revoked boolean not null default false, primary key(user_id,course_id));
create table public.az_certificates (code text primary key default replace(gen_random_uuid()::text,'-',''), user_id bigint not null references public.az_members, course_id text not null references public.az_entities, name text not null, course text not null, issued_at timestamptz not null default now(), unique(user_id,course_id));
create table public.az_invoices (id uuid primary key default gen_random_uuid(), user_id bigint not null references public.az_members, entity_id text not null references public.az_entities, amount integer not null check(amount>0), currency text not null check(currency='XTR'), charge_id text unique, status text not null default 'pending' check(status in ('pending','checkout','paid','refunded')), reserved_until timestamptz, created_at timestamptz not null default now());
create table public.az_webhook_inbox (update_id bigint primary key, payload jsonb not null, response jsonb, processed_at timestamptz, created_at timestamptz not null default now());
create table public.az_notification_jobs (id uuid primary key default gen_random_uuid(), notice_id uuid not null unique references public.az_notices, user_id bigint not null references public.az_members, status text not null default 'pending' check(status in ('pending','leased','sent','dead','skipped')), source text not null default 'manual', context jsonb not null default '{}', attempts integer not null default 0, next_at timestamptz not null default now(), lease_token uuid, lease_until timestamptz, last_error text, created_at timestamptz not null default now());
create index az_jobs_pending on public.az_notification_jobs(next_at) where status in ('pending','leased');
create table public.az_notification_dedupe (key text primary key, notice_id uuid references public.az_notices);
create table public.az_activity (id uuid primary key default gen_random_uuid(), user_id bigint not null references public.az_members, action text not null, entity_id text, occurred_at timestamptz not null default now());
create index az_activity_member_date on public.az_activity(user_id,occurred_at);
create index az_activity_date on public.az_activity(occurred_at);
create table public.az_refund_jobs (id uuid primary key default gen_random_uuid(), invoice_id uuid not null unique references public.az_invoices, requested_by bigint not null references public.az_members, reason text not null default '', status text not null default 'pending' check(status in ('pending','leased','succeeded','dead')), attempts integer not null default 0, next_at timestamptz not null default now(), lease_token uuid, lease_until timestamptz, last_error text, created_at timestamptz not null default now());
create index az_refunds_pending on public.az_refund_jobs(next_at) where status in ('pending','leased');
create table public.az_oidc_states (state_hash text primary key, browser_hash text not null, nonce text not null, verifier text not null, expires_at timestamptz not null);
create table public.az_sessions (token_hash text primary key, user_id bigint not null references public.az_members, csrf_hash text not null, expires_at timestamptz not null, created_at timestamptz not null default now());
create table public.az_rate_limits (key text primary key, window_at timestamptz not null, count integer not null);
create table public.az_integration_events (id text primary key, payload jsonb not null, status text not null default 'pending' check(status in ('pending','succeeded','failed')), attempts integer not null default 0, last_error text, created_at timestamptz not null default now());
create index az_entities_course on public.az_entities((data->>'courseId')) where kind='lesson';
create index az_progress_member on public.az_progress(user_id,completed_at);
create index az_coupons_member on public.az_coupons(user_id,created_at);
create index az_orders_member on public.az_orders(user_id,created_at);
create index az_bookings_member on public.az_bookings(user_id,created_at);
create index az_posts_status on public.az_posts(status,created_at);
create index az_comments_post on public.az_comments(post_id,created_at);
create index az_homework_member on public.az_homework(user_id,created_at);
create index az_notices_member on public.az_notices(user_id,created_at);
create index az_game_rounds_member on public.az_game_sessions(user_id,entity_id,expires_at) where not used;
create index az_invoices_member on public.az_invoices(user_id,entity_id,created_at);

create function public.az_member_json(m public.az_members) returns jsonb language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('id',m.id::text,'name',m.name,'username',m.username,'role',m.role,'teamId',m.team_id,'approved',m.approved,'xp',m.xp,'points',m.points,'streak',m.streak,'freezes',m.freezes,'lastDaily',m.last_daily,'stamps',m.stamps,'notificationOptIn',m.notification_opt_in,'quietFrom',m.quiet_from,'quietTo',m.quiet_to,'timezone',m.timezone,'achievements',m.achievements)
$$;
create function public.az_require_role(p_actor bigint,p_roles text[]) returns void language plpgsql set search_path=public,pg_temp as $$
begin if not exists(select 1 from az_members where id=p_actor and (role in ('owner','admin') or role=any(p_roles))) then raise exception 'forbidden' using errcode='P0001'; end if; end $$;
create function public.az_require_module(p_module text) returns void language plpgsql set search_path=public,pg_temp as $$
begin if not exists(select 1 from az_settings where config->'modules' ? p_module) then raise exception 'module_disabled'; end if; end $$;
create function public.az_authenticate(p_identity jsonb,p_owner boolean default false) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare m az_members; cfg jsonb;
begin
 if (p_identity->>'id') !~ '^[1-9][0-9]{0,18}$' then raise exception 'invalid_auth'; end if;
 select config into cfg from az_settings;
 insert into az_members(id,name,username,role,approved,timezone,verified_at) values ((p_identity->>'id')::bigint,left(coalesce(p_identity->>'name','Member'),200),left(coalesce(p_identity->>'username',''),64),case when p_owner then 'owner' else 'member' end,p_owner or coalesce(cfg->>'access','telegram') in ('telegram','channel'),coalesce(cfg->>'timezone','UTC'),now())
 on conflict(id) do update set name=excluded.name,username=excluded.username,verified_at=coalesce(az_members.verified_at,now()),role=case when p_owner then 'owner' else az_members.role end returning * into m;
 if cfg is null and m.role <> 'owner' then raise exception 'not_provisioned'; end if;
 -- Invite redemption is bound to a signed start_param; web/browser payload cannot select an invite.
 if cfg->>'access'='invite' and not m.approved and p_identity->>'startParam' is not null then
   update az_invites set used_by=m.id where code=p_identity->>'startParam' and used_by is null and expires_at>now() and (user_id is null or user_id=m.id);
   if found then update az_members set approved=true where id=m.id returning * into m; end if;
 end if;
 if cfg->>'access' in ('invite','employee') and not m.approved and m.role not in ('owner','admin') then raise exception 'access_denied'; end if;
 return az_member_json(m);
end $$;
create function public.az_can_access(p_actor bigint,p_entity text) returns boolean language plpgsql stable set search_path=public,pg_temp as $$
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
   if c.price>0 and enrollment.user_id is null then return false; end if;
   if coalesce((e.data->>'dripDays')::integer,0)>0 and (enrollment.user_id is null or now()<enrollment.granted_at+make_interval(days=>(e.data->>'dripDays')::integer)) then return false; end if;
   if coalesce((c.data->>'ordered')::boolean,false) then
     select id into previous_id from az_entities where kind='lesson' and data->>'courseId'=c.id and published and coalesce((data->>'order')::integer,0)<coalesce((e.data->>'order')::integer,0) order by coalesce((data->>'order')::integer,0) desc limit 1;
     if previous_id is not null and not exists(select 1 from az_progress where user_id=p_actor and entity_id=previous_id) then return false; end if;
   end if;
 end if;
 return true;
end $$;
create function public.az_entity_json(e public.az_entities,p_answers boolean default false) returns jsonb language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('id',e.id,'kind',e.kind,'module',e.module,'title',e.title,'subtitle',e.subtitle,'body',e.body,'tag',e.tag,'cover',e.cover,'published',e.published,'publishAt',e.publish_at,'audience',e.audience,'teamId',e.team_id,'price',e.price,'capacity',e.capacity,'data',
 case when p_answers then e.data else (e.data - 'questions' - 'correct' - 'explain' - 'answer' - 'answers' - 'privateContent' - 'filePath') || jsonb_build_object('hasQuiz',jsonb_array_length(coalesce(e.data->'questions','[]'))>0) end)
$$;
create function public.az_credit(p_actor bigint,p_delta integer,p_reason text,p_ref text) returns boolean language plpgsql set search_path=public,pg_temp as $$
begin
 perform 1 from az_members where id=p_actor for update;
 if p_delta=0 then return false; end if;
 insert into az_ledger(user_id,delta,reason,ref) values(p_actor,p_delta,p_reason,p_ref) on conflict(user_id,ref) do nothing;
 if not found then return false; end if;
 update az_members set points=points+p_delta where id=p_actor and points+p_delta>=0;
 if not found then raise exception 'insufficient_points'; end if;
 return true;
end $$;
create function public.az_complete(p_actor bigint,p_entity text,p_score integer,p_points integer,p_campaign text default null) returns boolean language plpgsql set search_path=public,pg_temp as $$
begin
 insert into az_progress(user_id,entity_id,campaign_id,score) values(p_actor,p_entity,p_campaign,p_score) on conflict(user_id,entity_id) do nothing;
 if not found then return false; end if;
 update az_members set xp=xp+greatest(0,p_score) where id=p_actor;
 perform az_credit(p_actor,p_points,'completion','complete:'||p_entity); return true;
end $$;
create function public.az_post_access(p_actor bigint,p_post uuid) returns boolean language sql stable set search_path=public,pg_temp as $$
 select coalesce((select m.role in ('owner','admin','moderator') or p.user_id=m.id or p.status='published' and (p.audience='all' or m.approved) and (p.team_id is null or p.team_id=m.team_id) from az_posts p cross join az_members m where p.id=p_post and m.id=p_actor),false)
$$;
create function public.az_mentor_access(p_actor bigint,p_student bigint) returns boolean language sql stable set search_path=public,pg_temp as $$
 select exists(select 1 from az_members teacher join az_members student on student.id=p_student where teacher.id=p_actor and (teacher.role in ('owner','admin') or teacher.role='mentor' and (teacher.team_id is null or teacher.team_id=student.team_id)))
$$;
create function public.az_order_point_access(p_actor bigint,p_order uuid) returns boolean language sql stable set search_path=public,pg_temp as $$
 select exists(select 1 from az_members cashier where cashier.id=p_actor and (cashier.role in ('owner','admin') or cashier.role='cashier' and cardinality(cashier.point_ids)>0 and not exists(select 1 from az_orders o cross join lateral jsonb_array_elements(o.items) item join az_entities e on e.id=item->>'entityId' where o.id=p_order and e.data->>'pointId' is not null and not (e.data->>'pointId'=any(cashier.point_ids)))))
$$;
create function public.az_snapshot(p_actor bigint) returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare m az_members; cfg jsonb; admin boolean; staff boolean; mentor boolean; moderator boolean; out jsonb;
begin
 select * into m from az_members where id=p_actor;
 if m.id is null then raise exception 'authentication_required'; end if;
 select config into cfg from az_settings; if cfg is null then raise exception 'not_provisioned'; end if;
 admin:=m.role in ('owner','admin'); staff:=admin or m.role='cashier'; mentor:=admin or m.role='mentor'; moderator:=admin or m.role='moderator';
 out:=jsonb_build_object('me',az_member_json(m),'config',cfg);
 out:=out||jsonb_build_object('entities',coalesce((select jsonb_agg(az_entity_json(e,false)) from az_entities e where az_can_access(p_actor,e.id) or (m.role='editor' and e.module in ('content','learning','commerce') or m.role='campaign_manager' and e.module in ('campaigns','loyalty','events')) and cfg->'modules' ? e.module),'[]'));
 out:=out||jsonb_build_object('progress',coalesce((select jsonb_agg(jsonb_build_object('entityId',entity_id,'userId',user_id::text,'campaignId',campaign_id,'score',score,'completedAt',completed_at)) from az_progress where user_id=p_actor or az_mentor_access(p_actor,az_progress.user_id)),'[]'));
 out:=out||jsonb_build_object('ledger',coalesce((select jsonb_agg(jsonb_build_object('id',id,'userId',user_id::text,'delta',delta,'reason',reason,'ref',ref,'createdAt',created_at) order by created_at desc) from az_ledger where user_id=p_actor or admin),'[]'));
 out:=out||jsonb_build_object('coupons',coalesce((select jsonb_agg(jsonb_build_object('id',id,'userId',user_id::text,'rewardId',reward_id,'title',title,'code',code,'status',case when status='issued' and expires_at<now() then 'expired' else status end,'expiresAt',expires_at,'pointId',point_id,'campaignId',campaign_id)) from az_coupons where user_id=p_actor or admin),'[]'));
 out:=out||jsonb_build_object('bookings',coalesce((select jsonb_agg(jsonb_build_object('id',id,'entityId',entity_id,'userId',user_id::text,'status',status,'code',code,'createdAt',created_at)) from az_bookings where user_id=p_actor or staff),'[]'));
 out:=out||jsonb_build_object('orders',coalesce((select jsonb_agg(jsonb_build_object('id',id,'userId',user_id::text,'items',items,'total',total,'status',status,'note',note,'createdAt',created_at)) from az_orders where user_id=p_actor or az_order_point_access(p_actor,az_orders.id)),'[]'));
 out:=out||jsonb_build_object('posts',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'userId',p.user_id::text,'name',u.name,'body',p.body,'topic',p.topic,'status',p.status,'audience',p.audience,'teamId',p.team_id,'likes',coalesce((select jsonb_agg(l.user_id::text) from az_post_likes l where l.post_id=p.id),'[]'),'createdAt',p.created_at)) from az_posts p join az_members u on u.id=p.user_id where cfg->'modules' ? 'community' and az_post_access(p_actor,p.id)),'[]'));
 out:=out||jsonb_build_object('comments',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'postId',c.post_id,'userId',c.user_id::text,'name',u.name,'body',c.body,'createdAt',c.created_at)) from az_comments c join az_posts p on p.id=c.post_id join az_members u on u.id=c.user_id where cfg->'modules' ? 'community' and az_post_access(p_actor,p.id)),'[]'));
 out:=out||jsonb_build_object('homework',coalesce((select jsonb_agg(jsonb_build_object('id',id,'userId',user_id::text,'lessonId',lesson_id,'body',body,'file',file,'status',status,'feedback',feedback,'createdAt',created_at)) from az_homework where user_id=p_actor or az_mentor_access(p_actor,az_homework.user_id)),'[]'));
 out:=out||jsonb_build_object('notifications',coalesce((select jsonb_agg(jsonb_build_object('id',id,'userId',user_id::text,'title',title,'body',body,'read',read,'createdAt',created_at)) from az_notices where user_id=p_actor),'[]'));
 out:=out||jsonb_build_object('audit',coalesce((select jsonb_agg(jsonb_build_object('id',id,'actorId',actor_id::text,'action',action,'targetId',target_id,'createdAt',created_at)) from (select * from az_audit where admin order by created_at desc limit 300) a),'[]'));
 out:=out||jsonb_build_object('members',case when admin then coalesce((select jsonb_agg(az_member_json(u)) from az_members u),'[]') else '[]'::jsonb end);
 if cfg->'modules' ? 'progress' then
   out:=out||jsonb_build_object('leaderboard',coalesce((select jsonb_agg(jsonb_build_object('id',id::text,'name',name,'xp',xp,'teamId',team_id) order by xp desc,id) from (select id,name,xp,team_id from az_members where verified_at is not null order by xp desc,id limit 100) r),'[]'));
   out:=out||jsonb_build_object('teamLeaderboard',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'xp',xp) order by xp desc,id) from (select e.id,e.title name,coalesce(sum(rank_member.xp),0) xp from az_entities e left join az_members rank_member on rank_member.team_id=e.id and rank_member.verified_at is not null where e.kind='team' and az_can_access(p_actor,e.id) group by e.id,e.title) r),'[]'));
   out:=out||jsonb_build_object('seasonLeaderboards',coalesce((select jsonb_object_agg(e.id,coalesce((select jsonb_agg(jsonb_build_object('id',id::text,'name',name,'xp',xp) order by xp desc,id) from (select rank_member.id,rank_member.name,sum(p.score) xp from az_progress p join az_members rank_member on rank_member.id=p.user_id where p.campaign_id=e.id group by rank_member.id,rank_member.name order by xp desc,rank_member.id limit 100) r),'[]')) from az_entities e where e.kind='campaign' and az_can_access(p_actor,e.id)),'{}'));
 end if;
 out:=out||jsonb_build_object('favorites',coalesce((select jsonb_agg(entity_id) from az_toggles where user_id=p_actor and kind='favorite'),'[]'),'reactions',coalesce((select jsonb_agg(entity_id) from az_toggles where user_id=p_actor and kind='reaction'),'[]'));
 out:=out||jsonb_build_object('votes',coalesce((select jsonb_object_agg(entity_id,option) from az_votes where user_id=p_actor),'{}'),'recognitions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'from',from_id::text,'to',to_id::text,'body',body)) from az_recognitions where from_id=p_actor or to_id=p_actor or admin),'[]'));
 if cfg->'modules' ? 'analytics' and (admin or m.role='analyst') then out:=out||jsonb_build_object('analytics',az_analytics(p_actor)); end if;
 return out;
end $$;

create function public.az_rule(p_key text,p_default integer) returns integer language sql stable set search_path=public,pg_temp as $$
 select coalesce((select greatest(0,least(coalesce((rules->'progression'->>p_key)::integer,p_default),1000000)) from az_settings),p_default)
$$;
create function public.az_campaign_gate(p_actor bigint,p_entity text) returns void language plpgsql stable set search_path=public,pg_temp as $$
declare e az_entities; c az_entities; cfg jsonb; current_day integer;
begin
 select * into e from az_entities where id=p_entity; if e.kind not in ('mission','campaign') then return; end if;
 if e.kind='campaign' then c:=e; else select * into c from az_entities where id=e.data->>'campaignId' and kind='campaign'; end if; select config into cfg from az_settings;
 if c.id is null or not az_can_access(p_actor,c.id) then raise exception 'campaign_unavailable'; end if;
 if c.data->>'startsAt' is null then raise exception 'campaign_not_scheduled'; end if;
 current_day:=((now() at time zone (cfg->>'timezone'))::date-((c.data->>'startsAt')::timestamptz at time zone (cfg->>'timezone'))::date)+1;
 if now()<(c.data->>'startsAt')::timestamptz or current_day<1 or current_day>coalesce((c.data->>'days')::integer,31) or c.data->>'endsAt' is not null and now()>(c.data->>'endsAt')::timestamptz then raise exception 'campaign_closed'; end if;
 if e.kind='mission' and (coalesce((e.data->>'day')::integer,1)>current_day or coalesce((e.data->>'day')::integer,1)<1) then raise exception 'day_locked'; end if;
end $$;

create function public.az_dispatch(p_actor bigint,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare
 m az_members; target az_members; e az_entities; campaign az_entities; rec record; a az_quiz_attempts; gs az_game_sessions; b az_bookings; hw az_homework;
 cfg jsonb; rules jsonb; result jsonb:='{}'; q jsonb; item jsonb; items jsonb:='[]'; entity_json jsonb; row_id uuid; str text; module_id text; request_body jsonb; brief_notes text:='';
 today date; yesterday date; day_no integer; amount integer; total integer:=0; n integer; answer_index integer; correct_index integer; gained integer:=0; done boolean; inserted boolean;
begin
 if jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_payload'; end if;
 -- Serializes an actor's rewards and limits; entity locks serialize inventory and capacity across actors.
 select * into m from az_members where id=p_actor for update;
 if m.id is null then raise exception 'authentication_required'; end if;
 select s.config,s.rules into cfg,rules from az_settings s;
 if cfg is null then raise exception 'not_provisioned'; end if;
 if cfg->>'access' in ('employee','invite') and not m.approved and m.role not in ('owner','admin') then raise exception 'access_denied'; end if;
 update az_members set access_verified_at=now() where id=p_actor;
 module_id:=case split_part(p_action,'.',1)
 when 'daily' then 'progress' when 'homework' then 'learning' when 'certificate' then 'learning' when 'stars' then 'learning'
 when 'campaign' then 'campaigns' when 'game' then 'campaigns' when 'reward' then 'loyalty' when 'coupon' then 'loyalty'
 when 'order' then 'commerce' when 'event' then 'events' when 'post' then 'community' when 'comment' then 'community' when 'poll' then 'team' when 'recognition' then 'team' when 'referral' then 'retention' when 'notification' then 'retention'
 else null end;
 if p_action in ('admin.visit','admin.points.adjust') then module_id:='loyalty'; end if;
 if p_action='admin.order.update' then module_id:='commerce'; end if;
 if p_action='admin.post.moderate' then module_id:='community'; end if;
 if p_action='admin.notification.enqueue' then module_id:='retention'; end if;
 if module_id is not null then perform az_require_module(module_id); end if;
 if p_payload ? 'entityId' and p_action not in ('admin.entity.delete','admin.entity.get','coupon.redeem','event.checkin') then
   select * into e from az_entities where id=p_payload->>'entityId' for update;
   if e.id is null or not az_can_access(p_actor,e.id) then raise exception 'entity_unavailable'; end if;
   perform az_require_module(e.module);
 end if;
 case p_action
 when 'bootstrap' then
   -- Free-course drip begins at the member's first bootstrap after publication.
   insert into az_enrollments(user_id,course_id,source) select p_actor,id,'free' from az_entities where kind='course' and price=0 and az_can_access(p_actor,id) on conflict(user_id,course_id) do nothing;
 when 'daily.claim' then
   today:=(now() at time zone (cfg->>'timezone'))::date; yesterday:=today-1;
   if m.last_daily is distinct from today then
     n:=case when m.last_daily=yesterday then m.streak+1 when m.last_daily=today-2 and m.freezes>0 then m.streak+1 else 1 end;
     update az_members set last_daily=today,streak=n,freezes=least(3,freezes-case when m.last_daily=today-2 and m.freezes>0 then 1 else 0 end+case when n%7=0 then 1 else 0 end),xp=xp+az_rule('dailyXp',20) where id=p_actor;
     gained:=az_rule('dailyPoints',10); perform az_credit(p_actor,gained,'daily','daily:'||today);
   end if;
   result:=jsonb_build_object('gained',gained);
 when 'content.complete' then
   if e.kind not in ('article','story','video','file','lesson') then raise exception 'invalid_entity_kind'; end if;
   if jsonb_array_length(coalesce(e.data->'questions','[]'))>0 then raise exception 'quiz_required'; end if;
   if e.kind='lesson' and coalesce((e.data->>'homeworkRequired')::boolean,false) and not exists(select 1 from az_homework where user_id=p_actor and lesson_id=e.id and status='approved') then raise exception 'homework_required'; end if;
   amount:=az_rule('contentPoints',5); inserted:=az_complete(p_actor,e.id,az_rule('contentXp',20),amount); result:=jsonb_build_object('gained',case when inserted then amount else 0 end);
 when 'favorite.toggle','reaction.toggle' then
   str:=case when p_action='favorite.toggle' then 'favorite' else 'reaction' end;
   delete from az_toggles where user_id=p_actor and entity_id=e.id and kind=str;
   if not found then insert into az_toggles values(p_actor,e.id,str); end if;
 when 'quiz.start' then
   perform az_campaign_gate(p_actor,e.id);
   if e.module not in ('learning','campaigns') or jsonb_typeof(e.data->'questions')<>'array' or jsonb_array_length(e.data->'questions') not between 1 and 100 then raise exception 'quiz_unavailable'; end if;
   -- The member row is locked above: opening again resumes the immutable reward attempt.
   -- Practice is available only after the first completion and cannot issue another reward.
   if not exists(select 1 from az_progress where user_id=p_actor and entity_id=e.id) then
     select * into a from az_quiz_attempts where user_id=p_actor and entity_id=e.id and not practice;
   end if;
   if a.id is null then
     insert into az_quiz_attempts(user_id,entity_id,questions,practice) values(p_actor,e.id,e.data->'questions',exists(select 1 from az_progress where user_id=p_actor and entity_id=e.id)) returning * into a;
   else
     update az_quiz_attempts set expires_at=now()+interval '1 hour' where id=a.id returning * into a;
   end if;
   result:=jsonb_build_object('attemptId',a.id,'questions',(select jsonb_agg(jsonb_build_object('question',v->'question','options',v->'options')) from jsonb_array_elements(a.questions) v),'answers',a.answers,'index',jsonb_array_length(a.answers),'score',a.score,'done',jsonb_array_length(a.answers)=jsonb_array_length(a.questions),'practice',a.practice);
 when 'quiz.answer' then
   select * into a from az_quiz_attempts where id=(p_payload->>'attemptId')::uuid and user_id=p_actor for update;
   if a.id is null or a.expires_at<=now() or not az_can_access(p_actor,a.entity_id) then raise exception 'attempt_expired'; end if;
   perform az_campaign_gate(p_actor,a.entity_id);
   answer_index:=(p_payload->>'index')::integer; n:=jsonb_array_length(a.answers);
   if answer_index<0 or answer_index>n or answer_index>=jsonb_array_length(a.questions) then raise exception 'invalid_answer_order'; end if;
   q:=a.questions->answer_index; correct_index:=(q->>'correct')::integer;
   if answer_index=n then
     amount:=(p_payload->>'answer')::integer;
     if amount is null or amount<0 or amount>=jsonb_array_length(q->'options') then raise exception 'invalid_answer'; end if;
     a.answers:=a.answers||jsonb_build_array(amount); a.score:=a.score+case when amount=correct_index then 1 else 0 end;
     update az_quiz_attempts set answers=a.answers,score=a.score where id=a.id;
     if jsonb_array_length(a.answers)=jsonb_array_length(a.questions) and not a.practice then
       select * into e from az_entities where id=a.entity_id;
       inserted:=az_complete(p_actor,a.entity_id,a.score*az_rule('quizXpPerCorrect',10),a.score*az_rule('quizPointsPerCorrect',5),e.data->>'campaignId');
       if inserted then gained:=a.score*az_rule('quizPointsPerCorrect',5); end if;
     end if;
   end if;
   done:=jsonb_array_length(a.answers)=jsonb_array_length(a.questions);
   result:=jsonb_build_object('answer',(a.answers->>answer_index)::integer,'correct',(a.answers->>answer_index)::integer=correct_index,'correctIndex',correct_index,'explain',coalesce(q->>'explain',''),'done',done,'score',a.score,'gained',gained);
 when 'game.start' then
   perform az_campaign_gate(p_actor,e.id);
   if e.kind not in ('campaign','mission') then raise exception 'invalid_entity_kind'; end if;
   select * into campaign from az_entities where id=case when e.kind='campaign' then e.id else e.data->>'campaignId' end and kind='campaign';
   if campaign.id is null or not az_can_access(p_actor,campaign.id) or p_payload->>'campaignId' is distinct from campaign.id then raise exception 'invalid_campaign'; end if;
   if campaign.data->>'startsAt' is null then raise exception 'campaign_not_scheduled'; end if;
   day_no:=((now() at time zone (cfg->>'timezone'))::date-((campaign.data->>'startsAt')::timestamptz at time zone (cfg->>'timezone'))::date)+1;
   if day_no<1 or day_no>coalesce((campaign.data->>'days')::integer,31) or (campaign.data->>'endsAt' is not null and now()>(campaign.data->>'endsAt')::timestamptz) then raise exception 'campaign_closed'; end if;
   if e.kind='mission' and coalesce((e.data->>'day')::integer,day_no)>day_no then raise exception 'day_locked'; end if;
   day_no:=case when e.kind='mission' then coalesce((e.data->>'day')::integer,day_no) else day_no end;
   str:=coalesce(e.data->>'game',campaign.data->>'game','wheel');
   if str='mixed' then str:=p_payload->>'game'; end if;
   if p_payload->>'game' is distinct from str or str not in ('wheel','scratch','memory','match','tap','catch','runner','reaction','quiz','puzzle','arcade') then raise exception 'invalid_game'; end if;
   if str='quiz' then raise exception 'quiz_required'; end if;
   if exists(select 1 from az_progress where user_id=p_actor and entity_id=e.id) then raise exception 'already_completed'; end if;
   select * into gs from az_game_sessions where user_id=p_actor and entity_id=e.id and not used and expires_at>now() order by started_at desc limit 1;
   if gs.id is not null then
     if gs.game<>str or gs.day<>day_no or gs.campaign_id<>campaign.id then raise exception 'round_in_progress'; end if;
   else
   -- Rewards are server-selected. Claimed animation score never determines a prize.
   amount:=az_rule('gameMinPoints',5)+floor(random()*greatest(1,least(az_rule('gameOutcomes',5),20)))::integer*az_rule('gameStepPoints',5);
   insert into az_game_sessions(user_id,entity_id,campaign_id,game,day,outcome,min_seconds) values(p_actor,e.id,campaign.id,str,day_no,amount,case when str in ('arcade','runner','catch') then 10 when str in ('memory','match','puzzle') then 3 else 1 end) returning * into gs;
   end if;
   result:=jsonb_build_object('sessionId',gs.id,'expiresAt',gs.expires_at,'day',gs.day,'minSeconds',gs.min_seconds,'outcome',case when str in ('wheel','scratch') then gs.outcome else null end);
 when 'campaign.open' then
   perform az_campaign_gate(p_actor,e.id);
   select * into gs from az_game_sessions where id=(p_payload->>'sessionId')::uuid and user_id=p_actor for update;
   if gs.id is null or gs.entity_id is distinct from e.id or gs.campaign_id is distinct from p_payload->>'campaignId' or gs.game is distinct from p_payload->>'game' or gs.day is distinct from (p_payload->>'day')::integer or gs.expires_at<=now() or gs.used then raise exception 'invalid_round'; end if;
   if now()<gs.started_at+make_interval(secs=>gs.min_seconds) then raise exception 'round_too_fast'; end if;
   update az_game_sessions set used=true where id=gs.id;
   inserted:=az_complete(p_actor,e.id,az_rule('gameXp',30),gs.outcome,gs.campaign_id);
   result:=jsonb_build_object('gained',case when inserted then gs.outcome else 0 end,'score',az_rule('gameXp',30),'outcome',gs.outcome);
 when 'reward.claim' then
   if e.kind<>'reward' then raise exception 'invalid_entity_kind'; end if;
   if e.data->>'campaignId' is not null then
     select * into campaign from az_entities where id=e.data->>'campaignId' and kind='campaign';
     if campaign.id is null or not az_can_access(p_actor,campaign.id) then raise exception 'campaign_unavailable'; end if;
     if (select count(*) from az_progress where user_id=p_actor and campaign_id=campaign.id)<greatest(0,coalesce((e.data->>'minCompletions')::integer,0)) then raise exception 'campaign_progress_required'; end if;
   end if;
   if coalesce(e.data->>'claimStartsAt',e.data->>'startsAt',campaign.data->>'startsAt') is not null and now()<coalesce(e.data->>'claimStartsAt',e.data->>'startsAt',campaign.data->>'startsAt')::timestamptz then raise exception 'reward_not_started'; end if;
   if coalesce(e.data->>'claimEndsAt',e.data->>'endsAt',campaign.data->>'claimEndsAt',campaign.data->>'endsAt') is not null and now()>coalesce(e.data->>'claimEndsAt',e.data->>'endsAt',campaign.data->>'claimEndsAt',campaign.data->>'endsAt')::timestamptz then raise exception 'reward_closed'; end if;
   if e.capacity is not null and (select count(*) from az_coupons where reward_id=e.id)>=e.capacity then raise exception 'sold_out'; end if;
   if exists(select 1 from az_coupons where user_id=p_actor and reward_id=e.id) then raise exception 'already_claimed'; end if;
   amount:=coalesce((e.data->>'pointsCost')::integer,e.price); if amount<0 then raise exception 'invalid_price'; end if;
   perform az_credit(p_actor,-amount,'reward','reward:'||e.id);
   insert into az_coupons(user_id,reward_id,title,expires_at,campaign_id) values(p_actor,e.id,e.title,now()+make_interval(days=>greatest(1,least(coalesce((e.data->>'expireDays')::integer,(e.data->>'expiresDays')::integer,30),365))),e.data->>'campaignId') returning id into row_id;
   result:=jsonb_build_object('couponId',row_id);
 when 'coupon.redeem' then
   perform az_require_role(p_actor,array['cashier']);
   if m.role not in ('owner','admin') and not (p_payload->>'pointId'=any(m.point_ids)) then raise exception 'point_forbidden'; end if;
   select c.id,c.reward_id,c.status,c.expires_at into rec from az_coupons c where c.code=p_payload->>'code' for update;
   if rec.id is null or rec.status<>'issued' or rec.expires_at<=now() then raise exception 'coupon_invalid'; end if;
   select * into e from az_entities where id=rec.reward_id;
   if jsonb_array_length(coalesce(e.data->'pointIds','[]'))>0 and not e.data->'pointIds' ? (p_payload->>'pointId') then raise exception 'point_forbidden'; end if;
   update az_coupons set status='redeemed',point_id=p_payload->>'pointId',redeemed_by=p_actor where id=rec.id;
 when 'admin.visit' then
   perform az_require_role(p_actor,array['cashier']);
   if m.role='cashier' and cardinality(m.point_ids)=0 then raise exception 'point_forbidden'; end if;
   select * into target from az_members where id=(p_payload->>'userId')::bigint for update; if target.id is null then raise exception 'member_missing'; end if;
   today:=(now() at time zone (cfg->>'timezone'))::date;
   insert into az_visits(user_id,day,cashier_id) values(target.id,today,p_actor) on conflict do nothing;
   if found then perform az_credit(target.id,az_rule('visitPoints',10),'visit','visit:'||today); update az_members set stamps=stamps+1 where id=target.id; end if;
 when 'order.create' then
   if coalesce(p_payload->>'requestId','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'request_id_required'; end if;
   request_body:=jsonb_build_object('items',p_payload->'items','note',coalesce(p_payload->>'note',''),'brief',coalesce(p_payload->'brief','{}'));
   select * into rec from az_orders where user_id=p_actor and request_id=(p_payload->>'requestId')::uuid;
   if rec.id is not null then
     if rec.request_payload<>request_body then raise exception 'idempotency_conflict'; end if;
     result:=jsonb_build_object('orderId',rec.id);
   else
   if jsonb_typeof(p_payload->'items')<>'array' or jsonb_array_length(p_payload->'items') not between 1 and 50 then raise exception 'invalid_items'; end if;
   -- Deterministic product lock order prevents cart deadlocks.
   perform 1 from az_entities where id in (select v->>'entityId' from jsonb_array_elements(p_payload->'items') v) order by id for update;
   for item in select value from jsonb_array_elements(p_payload->'items') loop
     select * into e from az_entities where id=item->>'entityId';
     if e.kind not in ('product','service') or not az_can_access(p_actor,e.id) then raise exception 'invalid_product'; end if;
     n:=(item->>'quantity')::integer; if n is null or n not between 1 and 99 then raise exception 'invalid_quantity'; end if;
     if e.kind='service' then
       if jsonb_array_length(coalesce(e.data->'briefFields','[]'))>50 then raise exception 'invalid_brief'; end if;
       for q in select value from jsonb_array_elements(coalesce(e.data->'briefFields','[]')) loop
         str:=p_payload->'brief'->e.id->>(q->>'id');
         if length(coalesce(q->>'id','')) not between 1 and 200 or coalesce((q->>'required')::boolean,false) and length(btrim(coalesce(str,'')))=0 or length(str)>2000 or str is not null and jsonb_typeof(p_payload->'brief'->e.id->(q->>'id'))<>'string' then raise exception 'invalid_brief'; end if;
         if str is not null and q->>'type'='select' and not coalesce(q->'options' ? str,false) then raise exception 'invalid_brief'; end if;
         if str is not null then brief_notes:=brief_notes||E'\n'||left(coalesce(q->>'label',q->>'id'),300)||': '||str; end if;
       end loop;
     end if;
     amount:=e.price;
     if coalesce(item->>'variant','')<>'' then
       select (v->>'price')::integer into amount from jsonb_array_elements(coalesce(e.data->'variants','[]')) v where v->>'name'=item->>'variant';
       if amount is null or amount<0 then raise exception 'invalid_variant'; end if;
     end if;
     if e.capacity is not null and e.capacity<n then raise exception 'sold_out'; end if;
     update az_entities set capacity=capacity-n where id=e.id and capacity is not null;
     total:=total+amount*n;
     items:=items||jsonb_build_array(jsonb_build_object('entityId',e.id,'quantity',n,'variant',coalesce(item->>'variant',''),'price',amount));
   end loop;
   insert into az_orders(user_id,request_id,request_payload,items,total,note) values(p_actor,(p_payload->>'requestId')::uuid,request_body,items,total,left(coalesce(p_payload->>'note',''),2000)||brief_notes) returning id into row_id; result:=jsonb_build_object('orderId',row_id);
   end if;
 when 'admin.order.update' then
   perform az_require_role(p_actor,array['cashier']);
   select * into rec from az_orders where id=(p_payload->>'orderId')::uuid for update;
   if rec.id is not null and not az_order_point_access(p_actor,rec.id) then raise exception 'point_forbidden'; end if;
   str:=p_payload->>'status';
   if rec.id is null or not (rec.status='new' and str in ('accepted','cancelled') or rec.status='accepted' and str in ('ready','cancelled') or rec.status='ready' and str in ('completed','cancelled')) then raise exception 'invalid_order_transition'; end if;
   if str='cancelled' then
     perform 1 from az_entities where id in (select v->>'entityId' from jsonb_array_elements(rec.items) v) order by id for update;
     for item in select value from jsonb_array_elements(rec.items) loop update az_entities set capacity=capacity+(item->>'quantity')::integer where id=item->>'entityId' and capacity is not null; end loop;
   end if;
   update az_orders set status=str where id=rec.id;
 when 'event.book' then
   if e.kind not in ('event','slot') or e.data->>'startsAt' is not null and (e.data->>'startsAt')::timestamptz<=now() then raise exception 'booking_closed'; end if;
   select * into b from az_bookings where entity_id=e.id and user_id=p_actor;
   if b.id is not null and b.status<>'cancelled' then null;
   else
     str:=case when e.capacity is null or (select count(*) from az_bookings where entity_id=e.id and status in ('confirmed','checked_in'))<e.capacity then 'confirmed' else 'waitlist' end;
     insert into az_bookings(entity_id,user_id,status) values(e.id,p_actor,str) on conflict(entity_id,user_id) do update set status=excluded.status,created_at=now(),code=excluded.code;
   end if;
 when 'event.cancel' then
   select * into b from az_bookings where entity_id=e.id and user_id=p_actor for update;
   if b.status='checked_in' then raise exception 'already_checked_in'; end if;
   update az_bookings set status='cancelled' where id=b.id;
   if b.status='confirmed' then
     update az_bookings set status='confirmed' where id=(select id from az_bookings where entity_id=e.id and status='waitlist' order by created_at,id limit 1 for update);
   end if;
 when 'event.checkin' then
   perform az_require_role(p_actor,array['cashier']);
   if m.role not in ('owner','admin') and not (p_payload->>'pointId'=any(m.point_ids)) then raise exception 'point_forbidden'; end if;
   select * into b from az_bookings where code=p_payload->>'code' for update;
   if b.id is null or b.status<>'confirmed' then raise exception 'booking_invalid'; end if;
   select * into e from az_entities where id=b.entity_id;
   if coalesce(e.data->>'pointId',p_payload->>'pointId') is distinct from p_payload->>'pointId' then raise exception 'point_forbidden'; end if;
   update az_bookings set status='checked_in' where id=b.id;
 when 'post.create' then
   if p_payload->>'audience'='employees' and not m.approved and m.role not in ('owner','admin') then raise exception 'forbidden'; end if;
   if p_payload->>'teamId' is not null and (m.team_id is distinct from p_payload->>'teamId') and m.role not in ('owner','admin') then raise exception 'forbidden'; end if;
   insert into az_posts(user_id,body,topic,status,audience,team_id) values(p_actor,btrim(p_payload->>'body'),left(coalesce(p_payload->>'topic','general'),80),case when coalesce((rules->>'moderatePosts')::boolean,true) then 'pending' else 'published' end,coalesce(p_payload->>'audience','all'),p_payload->>'teamId') returning id into row_id;
   result:=jsonb_build_object('postId',row_id);
 when 'comment.create','post.like','post.report' then
   select * into rec from az_posts where id=(p_payload->>'postId')::uuid for update;
   if rec.id is null or rec.status<>'published' or not az_post_access(p_actor,rec.id) then raise exception 'post_unavailable'; end if;
   if p_action='comment.create' then insert into az_comments(post_id,user_id,body) values(rec.id,p_actor,btrim(p_payload->>'body'));
   elsif p_action='post.like' then delete from az_post_likes where post_id=rec.id and user_id=p_actor; if not found then insert into az_post_likes values(rec.id,p_actor); end if;
   else insert into az_post_reports values(rec.id,p_actor) on conflict do nothing;
     if (select count(*) from az_post_reports where post_id=rec.id)>=3 then update az_posts set status='pending' where id=rec.id; end if;
   end if;
 when 'admin.post.moderate' then
   perform az_require_role(p_actor,array['moderator']); update az_posts set status=p_payload->>'status' where id=(p_payload->>'postId')::uuid; if not found then raise exception 'post_unavailable'; end if;
 when 'homework.submit' then
   select * into e from az_entities where id=p_payload->>'lessonId';
   if e.kind<>'lesson' or not az_can_access(p_actor,e.id) then raise exception 'lesson_locked'; end if;
   str:=coalesce(p_payload->>'file','');
   if str<>'' and not exists(select 1 from az_files where id::text=str and user_id=p_actor and purpose='homework') then raise exception 'file_forbidden'; end if;
   insert into az_homework(user_id,lesson_id,body,file) values(p_actor,e.id,p_payload->>'body',str)
   on conflict(user_id,lesson_id) do update set body=excluded.body,file=excluded.file,status='submitted',feedback='' where az_homework.status<>'approved' returning id into row_id;
   if row_id is null then raise exception 'homework_already_approved'; end if;
 when 'homework.review' then
   perform az_require_role(p_actor,array['mentor']); select * into hw from az_homework where id=(p_payload->>'homeworkId')::uuid for update;
   if hw.id is not null and not az_mentor_access(p_actor,hw.user_id) then raise exception 'forbidden'; end if;
   if hw.id is null or hw.status<>'submitted' then raise exception 'invalid_homework'; end if;
   if p_payload->>'status' not in ('approved','revision') then raise exception 'invalid_status'; end if;
   update az_homework set status=p_payload->>'status',feedback=left(coalesce(p_payload->>'feedback',''),5000) where id=hw.id;
   if p_payload->>'status'='approved' then perform az_complete(hw.user_id,hw.lesson_id,az_rule('homeworkXp',30),az_rule('homeworkPoints',10)); end if;
 when 'certificate.issue' then
   select * into e from az_entities where id=p_payload->>'courseId' and kind='course';
   if e.id is null or not az_can_access(p_actor,e.id) or e.price>0 and not exists(select 1 from az_enrollments where user_id=p_actor and course_id=e.id and not revoked) then raise exception 'course_locked'; end if;
   if not exists(select 1 from az_entities where kind='lesson' and published and data->>'courseId'=e.id) or exists(select 1 from az_entities l where l.kind='lesson' and l.published and l.data->>'courseId'=e.id and (not exists(select 1 from az_progress p where p.user_id=p_actor and p.entity_id=l.id) or coalesce((l.data->>'homeworkRequired')::boolean,false) and not exists(select 1 from az_homework h where h.user_id=p_actor and h.lesson_id=l.id and h.status='approved'))) then raise exception 'course_incomplete'; end if;
   insert into az_certificates(user_id,course_id,name,course) values(p_actor,e.id,m.name,e.title) on conflict(user_id,course_id) do nothing;
   select code into str from az_certificates where user_id=p_actor and course_id=e.id; result:=jsonb_build_object('code',str);
 when 'poll.vote' then
   if e.kind<>'poll' or e.data->>'closesAt' is not null and (e.data->>'closesAt')::timestamptz<=now() then raise exception 'poll_closed'; end if;
   n:=(p_payload->>'option')::integer; if n is null or n<0 or n>=jsonb_array_length(coalesce(e.data->'options','[]')) then raise exception 'invalid_option'; end if;
   insert into az_votes values(p_actor,e.id,n) on conflict(user_id,entity_id) do nothing;
 when 'recognition.send' then
   if (p_payload->>'userId')::bigint=p_actor then raise exception 'invalid_recipient'; end if;
   if not exists(select 1 from az_members where id=(p_payload->>'userId')::bigint and approved and (m.team_id is null or team_id=m.team_id)) then raise exception 'invalid_recipient'; end if;
   insert into az_recognitions(from_id,to_id,body) values(p_actor,(p_payload->>'userId')::bigint,p_payload->>'body');
 when 'profile.update' then
   if p_payload ? 'timezone' and not exists(select 1 from pg_timezone_names where name=p_payload->>'timezone') then raise exception 'invalid_timezone'; end if;
   update az_members set notification_opt_in=coalesce((p_payload->>'notificationOptIn')::boolean,notification_opt_in),quiet_from=coalesce((p_payload->>'quietFrom')::integer,quiet_from),quiet_to=coalesce((p_payload->>'quietTo')::integer,quiet_to),timezone=coalesce(p_payload->>'timezone',timezone) where id=p_actor;
 when 'referral.claim' then
   str:=p_payload->>'code'; if str !~ '^ref_[1-9][0-9]{0,18}$' then raise exception 'invalid_referral'; end if;
   select * into target from az_members where id=substring(str from 5)::bigint;
   if target.id is null or target.id=p_actor then raise exception 'invalid_referral'; end if;
   insert into az_referrals(user_id,referrer_id) values(p_actor,target.id) on conflict do nothing;
   if found then perform az_credit(p_actor,az_rule('referralPoints',15),'referral','referral:join'); perform az_credit(target.id,az_rule('referralPoints',15),'referral','referral:'||p_actor); end if;
 when 'notification.read' then
   update az_notices set read=true where id=(p_payload->>'noticeId')::uuid and user_id=p_actor;
 when 'admin.entity.get' then
   select * into e from az_entities where id=p_payload->>'entityId';
   perform az_require_role(p_actor,array['editor','campaign_manager']);
   if e.id is null then raise exception 'entity_unavailable'; end if;
   perform az_require_module(e.module);
   if m.role='editor' and e.module not in ('content','learning','commerce') or m.role='campaign_manager' and e.module not in ('campaigns','loyalty','events') then raise exception 'forbidden'; end if;
   result:=jsonb_build_object('entity',az_entity_json(e,true));
 when 'admin.analytics' then result:=jsonb_build_object('analytics',az_analytics(p_actor));
 when 'admin.payments' then result:=jsonb_build_object('payments',az_payments(p_actor,coalesce((p_payload->>'limit')::integer,100),p_payload->>'before'));
 when 'queue.list','admin.queue.list' then result:=jsonb_build_object('jobs',az_queue_list(p_actor,coalesce(p_payload->>'kind','notification')));
 when 'queue.retry','admin.queue.retry' then perform az_queue_retry(p_actor,(p_payload->>'jobId')::uuid,coalesce(p_payload->>'kind','notification')); result:=jsonb_build_object('jobs',az_queue_list(p_actor,coalesce(p_payload->>'kind','notification')));
 when 'admin.entity.save' then
   entity_json:=p_payload->'entity'; str:=entity_json->>'module';
   perform az_require_role(p_actor,array['editor','campaign_manager']); perform az_require_module(str);
   if m.role='editor' and str not in ('content','learning','commerce') or m.role='campaign_manager' and str not in ('campaigns','loyalty','events') then raise exception 'forbidden'; end if;
   if exists(select 1 from az_entities where id=entity_json->>'id' and module<>str) and m.role not in ('owner','admin') then raise exception 'forbidden'; end if;
   if jsonb_typeof(entity_json->'data')<>'object' or length(coalesce(entity_json->>'body',''))>100000 then raise exception 'invalid_entity'; end if;
   if entity_json->'data' ? 'questions' then
     if jsonb_typeof(entity_json->'data'->'questions')<>'array' or jsonb_array_length(entity_json->'data'->'questions') not between 0 and 100 then raise exception 'invalid_quiz'; end if;
     for q in select value from jsonb_array_elements(entity_json->'data'->'questions') loop
       if not (q ? 'correct') or jsonb_typeof(q->'correct')<>'number' or jsonb_typeof(q->'options') is distinct from 'array' or jsonb_array_length(q->'options') not between 2 and 20 or (q->>'correct')::integer not between 0 and jsonb_array_length(q->'options')-1 or length(coalesce(q->>'question',''))=0 or exists(select 1 from jsonb_array_elements(q->'options') v where jsonb_typeof(v)<>'string') then raise exception 'invalid_quiz'; end if;
     end loop;
   end if;
   insert into az_entities(id,kind,module,title,subtitle,body,tag,cover,published,publish_at,audience,team_id,price,capacity,data) values(entity_json->>'id',entity_json->>'kind',str,entity_json->>'title',coalesce(entity_json->>'subtitle',''),coalesce(entity_json->>'body',''),coalesce(entity_json->>'tag',''),coalesce(entity_json->>'cover',''),coalesce((entity_json->>'published')::boolean,false),(entity_json->>'publishAt')::timestamptz,coalesce(entity_json->>'audience','all'),entity_json->>'teamId',coalesce((entity_json->>'price')::integer,0),(entity_json->>'capacity')::integer,entity_json->'data')
   on conflict(id) do update set kind=excluded.kind,module=excluded.module,title=excluded.title,subtitle=excluded.subtitle,body=excluded.body,tag=excluded.tag,cover=excluded.cover,published=excluded.published,publish_at=excluded.publish_at,audience=excluded.audience,team_id=excluded.team_id,price=excluded.price,capacity=excluded.capacity,data=excluded.data;
 when 'admin.entity.delete' then
   select * into e from az_entities where id=p_payload->>'entityId' for update;
   perform az_require_role(p_actor,array['editor','campaign_manager']); perform az_require_module(e.module);
   if e.id is null or m.role='editor' and e.module not in ('content','learning','commerce') or m.role='campaign_manager' and e.module not in ('campaigns','loyalty','events') then raise exception 'forbidden'; end if;
   -- Archive preserves financial / progress references.
   update az_entities set published=false where id=e.id;
 when 'admin.member.update' then
   perform az_require_role(p_actor,array[]::text[]);
   if p_payload->>'userId' !~ '^[1-9][0-9]{0,18}$' then raise exception 'invalid_telegram_id'; end if;
   select * into target from az_members where id=(p_payload->>'userId')::bigint for update;
   if target.id is null then
     if coalesce(p_payload->>'role','member')<>'member' and m.role<>'owner' then raise exception 'owner_required'; end if;
     insert into az_members(id,name,timezone) values((p_payload->>'userId')::bigint,'Telegram '||(p_payload->>'userId'),cfg->>'timezone') returning * into target;
   end if;
   if p_payload ? 'role' and p_payload->>'role'<>target.role and m.role<>'owner' then raise exception 'owner_required'; end if;
   if (target.role='owner' or p_payload->>'role'='owner' or p_payload->>'role'='admin') and m.role<>'owner' then raise exception 'owner_required'; end if;
   if target.id=p_actor and p_payload ? 'role' and p_payload->>'role'<>m.role then raise exception 'cannot_demote_self'; end if;
   if p_payload ? 'pointIds' and m.role<>'owner' then raise exception 'owner_required'; end if;
   update az_members set role=coalesce(p_payload->>'role',role),team_id=case when p_payload ? 'teamId' then p_payload->>'teamId' else team_id end,approved=coalesce((p_payload->>'approved')::boolean,approved),point_ids=case when p_payload ? 'pointIds' then array(select jsonb_array_elements_text(p_payload->'pointIds')) else point_ids end where id=target.id;
 when 'admin.points.adjust' then
   perform az_require_role(p_actor,array[]::text[]); amount:=(p_payload->>'delta')::integer;
   if amount is null or amount=0 or abs(amount)>1000000 or length(coalesce(p_payload->>'reason',''))=0 or length(coalesce(p_payload->>'ref',''))=0 then raise exception 'invalid_adjustment'; end if;
   perform az_credit((p_payload->>'userId')::bigint,amount,p_payload->>'reason','adjust:'||(p_payload->>'ref'));
 when 'admin.notification.enqueue' then
   perform az_require_role(p_actor,array['campaign_manager']); str:=p_payload->>'segment';
   if length(coalesce(p_payload->>'title','')) not between 1 and 200 or length(coalesce(p_payload->>'body','')) not between 1 and 4000 then raise exception 'invalid_notification'; end if;
   if str not in ('all','employees','members','active','inactive') and str !~ '^team:.{1,100}$' then raise exception 'invalid_segment'; end if;
   with notices as (insert into az_notices(user_id,title,body) select id,p_payload->>'title',p_payload->>'body' from az_members where verified_at is not null and (str='all' or str='employees' and approved or str='members' and role='member' or str='team:'||team_id or str='active' and exists(select 1 from az_activity act where act.user_id=az_members.id and act.occurred_at>now()-interval '7 days') or str='inactive' and not exists(select 1 from az_activity act where act.user_id=az_members.id and act.occurred_at>now()-interval '7 days')) returning id,user_id)
   insert into az_notification_jobs(notice_id,user_id) select id,user_id from notices;
 else raise exception 'unknown_action';
 end case;
 perform az_refresh_achievements(p_actor);
 insert into az_activity(user_id,action,entity_id) values(p_actor,p_action,p_payload->>'entityId');
 if p_action<>'bootstrap' then insert into az_audit(actor_id,action,target_id) values(p_actor,p_action,coalesce(p_payload->>'entityId',p_payload->>'userId',p_payload->>'postId','')); end if;
 return jsonb_build_object('snapshot',az_snapshot(p_actor),'result',result);
end $$;

create function public.az_provision(p_actor bigint,p_config jsonb,p_brand jsonb,p_entities jsonb default '[]',p_rules jsonb default '{}') returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare item jsonb; rule record;
begin
 if not exists(select 1 from az_members where id=p_actor and role='owner') then raise exception 'owner_required'; end if;
 if p_config->>'access'='channel' and coalesce(p_rules->>'channelId','') !~ '^(-[1-9][0-9]{0,18}|@[A-Za-z0-9_]{5,32})$' then raise exception 'invalid_channel_rule'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_config->>'timezone') or jsonb_typeof(p_config->'modules')<>'array' or p_config->>'access' not in ('telegram','channel','invite','employee') or p_config->>'id' !~ '^[a-z0-9][a-z0-9-]{1,63}$' then raise exception 'invalid_config'; end if;
 if p_config ? 'botUsername' and (jsonb_typeof(p_config->'botUsername')<>'string' or p_config->>'botUsername' !~ '^@?[A-Za-z0-9_]{5,32}$') then raise exception 'invalid_bot_username'; end if;
 if jsonb_typeof(p_rules) is distinct from 'object' or p_rules ? 'progression' and jsonb_typeof(p_rules->'progression')<>'object' then raise exception 'invalid_rules'; end if;
 for rule in select key,value from jsonb_each(coalesce(p_rules->'progression','{}')) loop
   if rule.key not in ('dailyXp','dailyPoints','contentXp','contentPoints','quizXpPerCorrect','quizPointsPerCorrect','homeworkXp','homeworkPoints','visitPoints','referralPoints','gameXp','gameMinPoints','gameStepPoints','gameOutcomes') or rule.value::text !~ '^[0-9]{1,7}$' or (rule.value::text)::integer>1000000 then raise exception 'invalid_progression_rule'; end if;
 end loop;
 if p_rules ? 'notifications' and jsonb_typeof(p_rules->'notifications')<>'object' then raise exception 'invalid_notification_rules'; end if;
 for rule in select key,value from jsonb_each(coalesce(p_rules->'notifications','{}')) loop
   if rule.key in ('welcomeEnabled','inactivityEnabled','eventRemindersEnabled') then if jsonb_typeof(rule.value)<>'boolean' then raise exception 'invalid_notification_rules'; end if;
   elsif rule.key in ('inactivityDays','eventReminderMinutes') then if rule.value::text !~ '^[1-9][0-9]{0,4}$' or (rule.value::text)::integer>10080 then raise exception 'invalid_notification_rules'; end if;
   elsif rule.key in ('welcomeTitle','welcomeBody','inactivityTitle','inactivityBody') then if jsonb_typeof(rule.value)<>'string' or length(rule.value#>>'{}')>4000 then raise exception 'invalid_notification_rules'; end if;
   else raise exception 'invalid_notification_rules'; end if;
 end loop;
 insert into az_settings(id,config,brand,rules) values(true,p_config,p_brand,p_rules) on conflict(id) do update set config=excluded.config,brand=excluded.brand,rules=excluded.rules;
 if jsonb_typeof(p_entities)<>'array' or jsonb_array_length(p_entities)>1000 then raise exception 'invalid_entities'; end if;
 for item in select value from jsonb_array_elements(p_entities) loop perform az_dispatch(p_actor,'admin.entity.save',jsonb_build_object('entity',item)); end loop;
 insert into az_audit(actor_id,action) values(p_actor,'provision'); return jsonb_build_object('ok',true);
end $$;
create function public.az_runtime_settings() returns jsonb language sql stable set search_path=public,pg_temp as $$ select jsonb_build_object('config',config,'brand',brand,'rules',rules) from az_settings $$;
create function public.az_actor(p_actor bigint) returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare m az_members; cfg jsonb;
begin
 select * into m from az_members where id=p_actor; select config into cfg from az_settings;
 if m.id is null then raise exception 'authentication_required'; end if;
 if cfg->>'access' in ('employee','invite') and not m.approved and m.role not in ('owner','admin') then raise exception 'access_denied'; end if;
 return az_member_json(m);
end $$;
create function public.az_access_confirm(p_actor bigint) returns void language plpgsql set search_path=public,pg_temp as $$
begin perform az_actor(p_actor); update az_members set access_verified_at=now() where id=p_actor; end $$;
create function public.az_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql set search_path=public,pg_temp as $$
declare v_count integer;
begin
 delete from az_rate_limits where window_at<now()-interval '2 days';
 insert into az_rate_limits(key,window_at,count) values(p_key,now(),1) on conflict(key) do update set count=case when az_rate_limits.window_at<now()-make_interval(secs=>p_seconds) then 1 else az_rate_limits.count+1 end,window_at=case when az_rate_limits.window_at<now()-make_interval(secs=>p_seconds) then now() else az_rate_limits.window_at end returning count into v_count;
 return v_count<=p_limit;
end $$;
create function public.az_oidc_begin(p_state_hash text,p_browser_hash text,p_nonce text,p_verifier text) returns void language plpgsql set search_path=public,pg_temp as $$
begin
 delete from az_oidc_states where expires_at<now();
 insert into az_oidc_states values(p_state_hash,p_browser_hash,p_nonce,p_verifier,now()+interval '5 minutes');
end $$;
create function public.az_oidc_consume(p_state_hash text,p_browser_hash text) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare row az_oidc_states;
begin
 delete from az_oidc_states where state_hash=p_state_hash and browser_hash=p_browser_hash and expires_at>now() returning * into row;
 if row.state_hash is null then raise exception 'invalid_oidc_state'; end if;
 return jsonb_build_object('nonce',row.nonce,'verifier',row.verifier);
end $$;
create function public.az_session_create(p_actor bigint,p_token_hash text,p_csrf_hash text) returns void language plpgsql set search_path=public,pg_temp as $$
begin
 perform az_require_role(p_actor,array['editor','campaign_manager','moderator','mentor','analyst','cashier']);
 delete from az_sessions where expires_at<now(); insert into az_sessions(token_hash,user_id,csrf_hash,expires_at) values(p_token_hash,p_actor,p_csrf_hash,now()+interval '8 hours');
end $$;
create function public.az_session_get(p_token_hash text) returns jsonb language sql stable set search_path=public,pg_temp as $$ select jsonb_build_object('userId',user_id::text,'csrfHash',csrf_hash) from az_sessions where token_hash=p_token_hash and expires_at>now() $$;
create function public.az_session_delete(p_token_hash text) returns void language sql set search_path=public,pg_temp as $$ delete from az_sessions where token_hash=p_token_hash $$;
create function public.az_certificate_verify(p_code text) returns jsonb language sql stable set search_path=public,pg_temp as $$ select jsonb_build_object('name',name,'course',course,'date',issued_at::date) from az_certificates where code=p_code $$;
create function public.az_file_create(p_actor bigint,p_filename text,p_type text,p_purpose text) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare file_id uuid:=gen_random_uuid(); path text;
begin
 if p_purpose='content' then perform az_require_role(p_actor,array['editor']); else perform az_require_module('learning'); end if;
 if p_purpose not in ('content','homework') or p_type not in ('image/jpeg','image/png','image/webp','application/pdf','text/plain') or length(p_filename) not between 1 and 200 then raise exception 'invalid_file'; end if;
 path:=p_actor||'/'||file_id;
 insert into az_files(id,user_id,object_path,filename,content_type,purpose) values(file_id,p_actor,path,p_filename,p_type,p_purpose);
 return jsonb_build_object('fileId',file_id,'path',path);
end $$;
create function public.az_file_get(p_actor bigint,p_file_id text) returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare f az_files;
begin
 select * into f from az_files where id::text=p_file_id;
 if f.id is null or not (f.user_id=p_actor or exists(select 1 from az_members where id=p_actor and role in ('owner','admin')) or f.purpose='homework' and az_mentor_access(p_actor,f.user_id) or f.purpose='content' and exists(select 1 from az_entities where data->>'fileId'=f.id::text and az_can_access(p_actor,id))) then raise exception 'file_forbidden'; end if;
 return jsonb_build_object('path',f.object_path,'filename',f.filename);
end $$;
create function public.az_invoice_prepare(p_actor bigint,p_entity_id text) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare e az_entities; i az_invoices;
begin
 perform az_require_module('learning'); perform 1 from az_members where id=p_actor for update;
 select * into e from az_entities where id=p_entity_id and kind='course';
 if e.id is null or e.price<=0 or not az_can_access(p_actor,e.id) then raise exception 'invalid_course'; end if;
 if exists(select 1 from az_enrollments where user_id=p_actor and course_id=e.id and not revoked) then raise exception 'already_enrolled'; end if;
 select * into i from az_invoices where user_id=p_actor and entity_id=e.id and status='pending' and amount=e.price and created_at>now()-interval '1 hour' order by created_at desc limit 1;
 if i.id is null then insert into az_invoices(user_id,entity_id,amount,currency) values(p_actor,e.id,e.price,'XTR') returning * into i; end if;
 return jsonb_build_object('invoiceId',i.id,'amount',i.amount,'title',e.title,'description',left(coalesce(nullif(e.subtitle,''),e.title),255));
end $$;
create function public.az_webhook(p_update jsonb) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare inv az_invoices; payment jsonb; pc jsonb; uid bigint; out jsonb:='{"ok":true}'; existing jsonb;
begin
 insert into az_webhook_inbox(update_id,payload) values((p_update->>'update_id')::bigint,p_update) on conflict do nothing;
 if not found then select response into existing from az_webhook_inbox where update_id=(p_update->>'update_id')::bigint; return coalesce(existing,'{"ok":true,"duplicate":true}'); end if;
 if p_update ? 'pre_checkout_query' then
   pc:=p_update->'pre_checkout_query'; uid:=(pc->'from'->>'id')::bigint;
   perform 1 from az_members where id=uid for update;
   select * into inv from az_invoices where id::text=pc->>'invoice_payload' for update;
   if inv.id is null or inv.user_id is distinct from uid or inv.amount is distinct from (pc->>'total_amount')::integer or pc->>'currency' is distinct from 'XTR' or inv.status not in ('pending','checkout') or exists(select 1 from az_enrollments where user_id=uid and course_id=inv.entity_id and not revoked) or exists(select 1 from az_invoices where user_id=uid and entity_id=inv.entity_id and id<>inv.id and status='checkout' and reserved_until>now()) then
     out:=jsonb_build_object('preCheckoutId',pc->>'id','accepted',false);
   else update az_invoices set status='checkout',reserved_until=now()+interval '15 minutes' where id=inv.id; out:=jsonb_build_object('preCheckoutId',pc->>'id','accepted',true); end if;
 elsif p_update->'message' ? 'successful_payment' or p_update->'message' ? 'refunded_payment' then
   payment:=coalesce(p_update->'message'->'successful_payment',p_update->'message'->'refunded_payment'); uid:=(p_update->'message'->'from'->>'id')::bigint;
   perform 1 from az_members where id=uid for update;
   select * into inv from az_invoices where id::text=payment->>'invoice_payload' for update;
   if inv.id is null or uid is distinct from inv.user_id or inv.amount is distinct from (payment->>'total_amount')::integer or payment->>'currency' is distinct from 'XTR' or length(coalesce(payment->>'telegram_payment_charge_id',''))=0 then raise exception 'payment_mismatch'; end if;
   if p_update->'message' ? 'successful_payment' then
     if inv.status in ('paid','refunded') and inv.charge_id=payment->>'telegram_payment_charge_id' then null;
     elsif inv.status not in ('pending','checkout') then raise exception 'invalid_payment_state';
     else
       update az_invoices set status='paid',charge_id=payment->>'telegram_payment_charge_id' where id=inv.id;
       insert into az_enrollments(user_id,course_id,source) values(uid,inv.entity_id,inv.id::text) on conflict(user_id,course_id) do update set revoked=false,source=excluded.source,granted_at=now();
     end if;
   else
     if inv.status='refunded' and inv.charge_id=payment->>'telegram_payment_charge_id' then null;
     elsif inv.status<>'paid' or inv.charge_id is distinct from payment->>'telegram_payment_charge_id' then raise exception 'invalid_refund';
     else update az_invoices set status='refunded' where id=inv.id; update az_enrollments set revoked=true where user_id=uid and course_id=inv.entity_id and source=inv.id::text; end if;
   end if;
 end if;
 update az_webhook_inbox set processed_at=now(),response=out where update_id=(p_update->>'update_id')::bigint;
 if inv.id is not null and exists(select 1 from az_invoices where id=inv.id and status='refunded') then update az_refund_jobs set status='succeeded',lease_token=null,lease_until=null,last_error=null where invoice_id=inv.id; end if;
 return out;
end $$;
create function public.az_jobs_claim(p_limit integer default 20) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from az_settings where config->'modules' ? 'retention') then return '[]'::jsonb; end if;
 -- Equal hours means quiet hours are disabled. Opt-out is checked again on every claim.
 update az_notification_jobs j set status='skipped' from az_members m where m.id=j.user_id and not m.notification_opt_in and j.status in ('pending','leased');
 update az_notification_jobs j set status='skipped' from az_members m,az_settings s where m.id=j.user_id and s.config->>'access' in ('employee','invite') and not m.approved and m.role not in ('owner','admin') and j.status in ('pending','leased');
 update az_notification_jobs j set status='skipped' where j.status='pending' and j.source='event' and not exists(select 1 from az_bookings b join az_entities e on e.id=b.entity_id where b.id::text=j.context->>'bookingId' and b.status='confirmed' and e.published and (e.data->>'startsAt')::timestamptz>now());
 update az_notification_jobs j set status='skipped' where j.status='pending' and j.source='inactivity' and exists(select 1 from az_activity a where a.user_id=j.user_id and a.occurred_at>(j.context->>'lastActivityAt')::timestamptz);
 update az_notification_jobs j set status='skipped' where j.status='pending' and j.source='task' and (not az_can_access(j.user_id,j.context->>'entityId') or exists(select 1 from az_progress p where p.user_id=j.user_id and p.entity_id=j.context->>'entityId'));
 update az_notification_jobs set status='dead',lease_token=null,lease_until=null where status in ('pending','leased') and attempts>=5 and (lease_until is null or lease_until<now());
 with ready as (
  select j.id from az_notification_jobs j join az_members m on m.id=j.user_id
  where j.status in ('pending','leased') and j.next_at<=now() and (j.lease_until is null or j.lease_until<now()) and m.notification_opt_in
   and (m.quiet_from=m.quiet_to or not (case when m.quiet_from<m.quiet_to then extract(hour from now() at time zone m.timezone)>=m.quiet_from and extract(hour from now() at time zone m.timezone)<m.quiet_to else extract(hour from now() at time zone m.timezone)>=m.quiet_from or extract(hour from now() at time zone m.timezone)<m.quiet_to end))
  order by j.next_at limit greatest(1,least(p_limit,50)) for update of j skip locked
 ), claimed as (update az_notification_jobs j set status='leased',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1 from ready where j.id=ready.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'leaseToken',c.lease_token,'userId',c.user_id::text,'title',n.title,'body',n.body)), '[]') into result from claimed c join az_notices n on n.id=c.notice_id;
 return result;
end $$;
create function public.az_jobs_finish(p_id uuid,p_lease uuid,p_success boolean,p_error text default '',p_retry integer default 0) returns void language plpgsql set search_path=public,pg_temp as $$
begin
 update az_notification_jobs set status=case when p_success then 'sent' when attempts>=5 then 'dead' else 'pending' end,next_at=now()+make_interval(secs=>greatest(p_retry,least(3600,(power(2,attempts)*30)::integer))),lease_until=null,lease_token=null,last_error=case when p_success then null else left(p_error,200) end where id=p_id and lease_token=p_lease and status='leased';
end $$;

create function public.az_analytics(p_actor bigint) returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare out jsonb; tz text; today date;
begin
 perform az_require_role(p_actor,array['analyst']); perform az_require_module('analytics');
 select config->>'timezone' into tz from az_settings; today:=(now() at time zone tz)::date;
 out:=jsonb_build_object('members',(select count(*) from az_members),'approvedMembers',(select count(*) from az_members where approved),
 'active1d',(select count(distinct user_id) from az_activity where occurred_at>now()-interval '1 day'),'active7d',(select count(distinct user_id) from az_activity where occurred_at>now()-interval '7 days'),
 'completions',(select count(*) from az_progress),'orders',(select count(*) from az_orders where status<>'cancelled'),'bookings',(select count(*) from az_bookings where status in ('confirmed','checked_in')),'paidStars',coalesce((select sum(amount) from az_invoices where status='paid'),0));
 with cohorts as (select user_id,min((occurred_at at time zone tz)::date) first_day from az_activity group by user_id),
 counts as (select n,count(c.user_id) eligible,count(c.user_id) filter(where exists(select 1 from az_activity a where a.user_id=c.user_id and (a.occurred_at at time zone tz)::date=c.first_day+n)) returned from (values(1),(7)) days(n) left join cohorts c on c.first_day+n<today group by n)
 select out||jsonb_build_object('retention',jsonb_object_agg('day'||n,jsonb_build_object('eligible',eligible,'returned',returned,'rate',case when eligible=0 then null else round(returned::numeric/eligible,4) end))) into out from counts;
 out:=out||jsonb_build_object('funnel',jsonb_build_array(
 jsonb_build_object('stage','verified','count',(select count(*) from az_members where verified_at is not null)),
 jsonb_build_object('stage','completed','count',(select count(distinct user_id) from az_progress)),
 jsonb_build_object('stage','reward_claimed','count',(select count(distinct user_id) from az_coupons)),
 jsonb_build_object('stage','ordered','count',(select count(distinct user_id) from az_orders where status<>'cancelled')),
 jsonb_build_object('stage','paid','count',(select count(distinct user_id) from az_invoices where status='paid'))));
 out:=out||jsonb_build_object('campaigns',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,
 'participants',(select count(distinct user_id) from az_progress where campaign_id=e.id),'completions',(select count(*) from az_progress where campaign_id=e.id),
 'pointsIssued',coalesce((select sum(l.delta) from az_ledger l join az_progress p on p.user_id=l.user_id and l.ref='complete:'||p.entity_id where p.campaign_id=e.id and l.delta>0),0),
 'couponsIssued',(select count(*) from az_coupons where campaign_id=e.id),'couponsRedeemed',(select count(*) from az_coupons where campaign_id=e.id and status='redeemed'))) from az_entities e where kind='campaign'),'[]'));
 return out;
end $$;
create function public.az_payments(p_actor bigint,p_limit integer default 100,p_before text default null) returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare out jsonb;
begin
 perform az_require_role(p_actor,array[]::text[]); perform az_require_module('learning');
 select coalesce(jsonb_agg(jsonb_build_object('invoiceId',i.id,'userId',i.user_id::text,'name',m.name,'entityId',i.entity_id,'title',e.title,'amount',i.amount,'currency',i.currency,'status',i.status,'createdAt',i.created_at,
 'refund',(select jsonb_build_object('id',r.id,'status',r.status,'attempts',r.attempts,'nextAt',r.next_at,'lastError',r.last_error) from az_refund_jobs r where r.invoice_id=i.id)) order by i.created_at desc,i.id desc),'[]') into out
 from (select * from az_invoices where p_before is null or created_at<p_before::timestamptz order by created_at desc,id desc limit greatest(1,least(p_limit,200))) i join az_members m on m.id=i.user_id join az_entities e on e.id=i.entity_id;
 return out;
end $$;
create function public.az_refund_json(r public.az_refund_jobs) returns jsonb language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('id',r.id,'invoiceId',r.invoice_id,'status',r.status,'attempts',r.attempts,'nextAt',r.next_at,'lastError',r.last_error,'createdAt',r.created_at)
$$;
create function public.az_refund_request(p_actor bigint,p_invoice_id uuid,p_reason text default '') returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare inv az_invoices; job az_refund_jobs;
begin
 perform az_require_role(p_actor,array[]::text[]); perform az_require_module('learning'); perform az_actor(p_actor);
 select * into inv from az_invoices where id=p_invoice_id for update;
 if inv.id is null or inv.status not in ('paid','refunded') or inv.charge_id is null then raise exception 'invoice_not_refundable'; end if;
 insert into az_refund_jobs(invoice_id,requested_by,reason,status) values(inv.id,p_actor,left(p_reason,1000),case when inv.status='refunded' then 'succeeded' else 'pending' end) on conflict(invoice_id) do nothing;
 select * into job from az_refund_jobs where invoice_id=inv.id;
 insert into az_audit(actor_id,action,target_id) values(p_actor,'admin.refund',inv.id::text);
 return az_refund_json(job);
end $$;
create function public.az_refund_get(p_actor bigint,p_job_id uuid) returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare r az_refund_jobs;
begin perform az_require_role(p_actor,array[]::text[]); select * into r from az_refund_jobs where id=p_job_id; if r.id is null then raise exception 'job_missing'; end if; return az_refund_json(r); end $$;
create function public.az_refunds_claim(p_limit integer default 5,p_invoice_id uuid default null) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare out jsonb;
begin
 update az_refund_jobs r set status='succeeded',lease_token=null,lease_until=null from az_invoices i where i.id=r.invoice_id and i.status='refunded' and r.status<>'succeeded';
 update az_refund_jobs set status='dead',lease_token=null,lease_until=null where status in ('pending','leased') and attempts>=5 and (lease_until is null or lease_until<now());
 with ready as (select r.id from az_refund_jobs r join az_invoices i on i.id=r.invoice_id where r.status in ('pending','leased') and r.attempts<5 and r.next_at<=now() and (r.lease_until is null or r.lease_until<now()) and i.status='paid' and (p_invoice_id is null or i.id=p_invoice_id) order by r.next_at limit greatest(1,least(p_limit,10)) for update of r skip locked),
 claimed as (update az_refund_jobs r set status='leased',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1 from ready where r.id=ready.id returning r.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'invoiceId',i.id,'leaseToken',r.lease_token,'userId',i.user_id::text,'chargeId',i.charge_id)),'[]') into out from claimed r join az_invoices i on i.id=r.invoice_id;
 return out;
end $$;
create function public.az_refunds_finish(p_id uuid,p_lease uuid,p_success boolean,p_error text default '',p_retry integer default 0) returns void language plpgsql set search_path=public,pg_temp as $$
declare r az_refund_jobs; inv az_invoices;
begin
 select * into r from az_refund_jobs where id=p_id and lease_token=p_lease and status='leased' for update; if r.id is null then return; end if;
 select * into inv from az_invoices where id=r.invoice_id for update;
 if p_success then
   update az_invoices set status='refunded' where id=inv.id;
   update az_enrollments set revoked=true where user_id=inv.user_id and course_id=inv.entity_id and source=inv.id::text;
   update az_refund_jobs set status='succeeded',lease_token=null,lease_until=null,last_error=null where id=r.id;
 else update az_refund_jobs set status=case when attempts>=5 then 'dead' else 'pending' end,next_at=now()+make_interval(secs=>greatest(p_retry,least(3600,(power(2,attempts)*30)::integer))),lease_token=null,lease_until=null,last_error=left(p_error,200) where id=r.id;
 end if;
end $$;
create function public.az_queue_list(p_actor bigint,p_kind text default 'notification') returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare out jsonb;
begin
 if p_kind='refund' then perform az_require_role(p_actor,array[]::text[]); select coalesce(jsonb_agg(az_refund_json(r) order by r.created_at desc),'[]') into out from (select * from az_refund_jobs order by created_at desc limit 200) r;
 elsif p_kind='notification' then perform az_require_role(p_actor,array['campaign_manager']); perform az_require_module('retention');
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'userId',j.user_id::text,'title',n.title,'source',j.source,'status',j.status,'attempts',j.attempts,'nextAt',j.next_at,'lastError',j.last_error,'createdAt',j.created_at) order by j.created_at desc),'[]') into out from (select * from az_notification_jobs order by created_at desc limit 200) j join az_notices n on n.id=j.notice_id;
 else raise exception 'invalid_queue_kind'; end if; return out;
end $$;
create function public.az_queue_retry(p_actor bigint,p_job_id uuid,p_kind text default 'notification') returns void language plpgsql set search_path=public,pg_temp as $$
begin
 if p_kind='refund' then perform az_require_role(p_actor,array[]::text[]);
 update az_refund_jobs r set status='pending',attempts=0,next_at=now(),lease_token=null,lease_until=null,last_error=null from az_invoices i where r.id=p_job_id and i.id=r.invoice_id and i.status='paid' and r.status in ('dead','pending') and (r.lease_until is null or r.lease_until<now());
 elsif p_kind='notification' then perform az_require_role(p_actor,array['campaign_manager']); perform az_require_module('retention');
 update az_notification_jobs j set status='pending',attempts=0,next_at=now(),lease_token=null,lease_until=null,last_error=null from az_members m where j.id=p_job_id and j.user_id=m.id and m.notification_opt_in and j.status in ('dead','pending') and (j.lease_until is null or j.lease_until<now());
 else raise exception 'invalid_queue_kind'; end if;
 if not found then raise exception 'job_not_retryable'; end if;
end $$;
create function public.az_notice_once(p_user bigint,p_title text,p_body text,p_key text,p_source text,p_context jsonb default '{}') returns boolean language plpgsql set search_path=public,pg_temp as $$
declare notice uuid;
begin
 insert into az_notification_dedupe(key) values(p_key) on conflict do nothing; if not found then return false; end if;
 insert into az_notices(user_id,title,body) values(p_user,p_title,p_body) returning id into notice;
 update az_notification_dedupe set notice_id=notice where key=p_key;
 insert into az_notification_jobs(notice_id,user_id,source,context) values(notice,p_user,p_source,p_context); return true;
end $$;
create function public.az_jobs_produce() returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare r record; cfg jsonb; rules jsonb; total integer:=0; changed boolean; inactive_days integer; reminder_minutes integer;
begin
 select s.config,s.rules->'notifications' into cfg,rules from az_settings s;
 if cfg is null or not (cfg->'modules' ? 'retention') then return jsonb_build_object('produced',0); end if;
 inactive_days:=greatest(1,least(coalesce((rules->>'inactivityDays')::integer,7),365)); reminder_minutes:=greatest(1,least(coalesce((rules->>'eventReminderMinutes')::integer,120),10080));
 if coalesce((rules->>'welcomeEnabled')::boolean,true) then
  for r in select id from az_members m where access_verified_at is not null and notification_opt_in and (cfg->>'access' not in ('employee','invite') or approved or role in ('owner','admin')) and not exists(select 1 from az_notification_dedupe d where d.key='welcome:'||m.id) order by id limit 200 loop
   changed:=az_notice_once(r.id,coalesce(rules->>'welcomeTitle','Добро пожаловать!'),coalesce(rules->>'welcomeBody','Ваше пространство '||(cfg->>'name')||' уже ждёт вас.'),'welcome:'||r.id,'welcome'); if changed then total:=total+1; end if;
  end loop;
 end if;
 if cfg->'modules' ? 'events' and coalesce((rules->>'eventRemindersEnabled')::boolean,true) then
  for r in select b.id,b.user_id,e.title,e.data->>'startsAt' starts_at from az_bookings b join az_entities e on e.id=b.entity_id join az_members m on m.id=b.user_id where b.status='confirmed' and m.notification_opt_in and (cfg->>'access' not in ('employee','invite') or m.approved or m.role in ('owner','admin')) and e.published and (e.data->>'startsAt')::timestamptz>now() and (e.data->>'startsAt')::timestamptz<=now()+make_interval(mins=>reminder_minutes) and not exists(select 1 from az_notification_dedupe d where d.key='event:'||b.id||':'||(e.data->>'startsAt')) order by b.created_at limit 200 loop
   changed:=az_notice_once(r.user_id,'Скоро встреча: '||r.title,'Ваша встреча начинается '||r.starts_at,'event:'||r.id||':'||r.starts_at,'event',jsonb_build_object('bookingId',r.id)); if changed then total:=total+1; end if;
  end loop;
 end if;
 if cfg->'modules' ? 'campaigns' and coalesce((rules->>'taskRemindersEnabled')::boolean,false) then
  for r in select m.id user_id,e.id entity_id,e.title from az_members m cross join az_entities e join az_entities c on c.id=e.data->>'campaignId' and c.kind='campaign' where e.kind='mission' and m.access_verified_at is not null and m.notification_opt_in and az_can_access(m.id,e.id) and az_can_access(m.id,c.id) and (cfg->>'access' not in ('employee','invite') or m.approved or m.role in ('owner','admin')) and now()>=(c.data->>'startsAt')::timestamptz and (c.data->>'endsAt' is null or now()<=(c.data->>'endsAt')::timestamptz) and ((now() at time zone (cfg->>'timezone'))::date-((c.data->>'startsAt')::timestamptz at time zone (cfg->>'timezone'))::date)+1=coalesce((e.data->>'day')::integer,1) and not exists(select 1 from az_progress p where p.user_id=m.id and p.entity_id=e.id) and not exists(select 1 from az_notification_dedupe d where d.key='task:'||m.id||':'||e.id) order by m.id,e.id limit 200 loop
   changed:=az_notice_once(r.user_id,'Новое задание: '||r.title,'Ваш следующий хороший шаг уже открыт. Загляните в активности.','task:'||r.user_id||':'||r.entity_id,'task',jsonb_build_object('entityId',r.entity_id)); if changed then total:=total+1; end if;
  end loop;
 end if;
 if coalesce((rules->>'inactivityEnabled')::boolean,true) then
  for r in select * from (select m.id,coalesce((select max(occurred_at) from az_activity where user_id=m.id),m.verified_at) last_at from az_members m where m.access_verified_at is not null and m.notification_opt_in and (cfg->>'access' not in ('employee','invite') or m.approved or m.role in ('owner','admin'))) candidates where last_at<now()-make_interval(days=>inactive_days) and not exists(select 1 from az_notification_dedupe d where d.key='inactive:'||candidates.id||':'||to_char(candidates.last_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')) order by id limit 200 loop
    changed:=az_notice_once(r.id,coalesce(rules->>'inactivityTitle','Давно не виделись'),coalesce(rules->>'inactivityBody','Загляните — для вас появились новые возможности.'),'inactive:'||r.id||':'||to_char(r.last_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'),'inactivity',jsonb_build_object('lastActivityAt',r.last_at)); if changed then total:=total+1; end if;
  end loop;
 end if;
 return jsonb_build_object('produced',total);
end $$;

create function public.az_refresh_achievements(p_actor bigint) returns void language plpgsql set search_path=public,pg_temp as $$
declare earned jsonb:='[]'; n integer; m az_members;
begin
 select * into m from az_members where id=p_actor;
 select count(*) into n from az_progress where user_id=p_actor;
 if n>0 then earned:=earned||'"first_step"'::jsonb; end if;
 if n>=5 then earned:=earned||'"five_tasks"'::jsonb; end if;
 if m.streak>=7 then earned:=earned||'"week_streak"'::jsonb; end if;
 if exists(select 1 from az_referrals where referrer_id=p_actor) then earned:=earned||'"ambassador"'::jsonb; end if;
 update az_members set achievements=(select coalesce(jsonb_agg(distinct v),'[]') from jsonb_array_elements(m.achievements||earned) v) where id=p_actor;
end $$;

-- Signed integration inbox: duplicate IDs cannot change the original event. A failed
-- attempt persists its error, while its domain changes roll back in the subtransaction.
create function public.az_integration_event(p_event jsonb) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare inbox az_integration_events; owner_id bigint; uid bigint; data jsonb:=p_event->'data'; total numeric; rate numeric; points integer; today date; cfg jsonb; details text;
begin
 if p_event->>'id' !~ '^[a-zA-Z0-9._:-]{1,120}$' or p_event->>'type' not in ('visit.confirmed','purchase.confirmed','order.status','employee.approved') or jsonb_typeof(data) is distinct from 'object' then raise exception 'invalid_integration_event'; end if;
 insert into az_integration_events(id,payload) values(p_event->>'id',p_event) on conflict do nothing;
 select * into inbox from az_integration_events where id=p_event->>'id' for update;
 if inbox.payload<>p_event then return jsonb_build_object('ok',false,'error','event_id_conflict'); end if;
 if inbox.status='succeeded' then return jsonb_build_object('ok',true,'duplicate',true); end if;
 update az_integration_events set attempts=attempts+1 where id=inbox.id;
 begin
   select config into cfg from az_settings;
   select id into owner_id from az_members where role='owner' order by id limit 1;
   if owner_id is null then raise exception 'integration_owner_missing'; end if;
   if p_event->>'type' in ('visit.confirmed','purchase.confirmed') then
     perform az_require_module('loyalty');
     if data->>'userId' !~ '^[1-9][0-9]{0,18}$' then raise exception 'invalid_telegram_id'; end if;
     uid:=(data->>'userId')::bigint;
     perform 1 from az_members where id=uid and verified_at is not null for update;
     if not found then raise exception 'member_missing'; end if;
     if p_event->>'type'='visit.confirmed' then
       today:=(now() at time zone (cfg->>'timezone'))::date;
       insert into az_visits(user_id,day,cashier_id) values(uid,today,owner_id) on conflict do nothing;
       if found then perform az_credit(uid,az_rule('visitPoints',10),'visit','visit:'||today); update az_members set stamps=stamps+1 where id=uid; end if;
     else
       if data->>'currency' is distinct from cfg->>'currency' or coalesce(data->>'amount','') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then raise exception 'invalid_purchase'; end if;
       total:=(data->>'amount')::numeric;
       select coalesce((rules->'loyalty'->>'purchasePointsPerUnit')::numeric,0) into rate from az_settings;
       if rate<0 or rate>1000 or total*rate>1000000 then raise exception 'invalid_purchase_rule'; end if;
       points:=floor(total*rate)::integer;
       perform az_credit(uid,points,'purchase','integration:'||inbox.id);
     end if;
   else
     select id into owner_id from az_members where role='owner' order by id limit 1;
     if owner_id is null then raise exception 'integration_owner_missing'; end if;
     if p_event->>'type'='order.status' then
       if data->>'status' not in ('accepted','ready','completed','cancelled') then raise exception 'invalid_order_status'; end if;
       perform az_dispatch(owner_id,'admin.order.update',jsonb_build_object('orderId',data->>'orderId','status',data->>'status'));
     else
       perform az_require_module('team');
       perform az_dispatch(owner_id,'admin.member.update',jsonb_build_object('userId',data->>'userId','approved',true,'teamId',data->>'teamId'));
     end if;
   end if;
   update az_integration_events set status='succeeded',last_error=null where id=inbox.id;
   insert into az_audit(action,target_id) values('integration.'||(p_event->>'type'),inbox.id);
 exception when others then
   get stacked diagnostics details=message_text;
   -- SQL details never leave the service. Store a stable bounded failure marker.
   update az_integration_events set status='failed',last_error=case when details ~ '^[a-z_]{1,80}$' then details else 'integration_processing_failed' end where id=inbox.id;
 end;
 select * into inbox from az_integration_events where id=inbox.id;
 return jsonb_build_object('ok',inbox.status='succeeded','error',inbox.last_error,'attempts',inbox.attempts);
end $$;

-- No anonymous or authenticated table access. All checks run again inside service RPCs.
do $$ declare r record; begin
 for r in select tablename from pg_tables where schemaname='public' and tablename like 'az\_%' escape '\' loop
  execute format('alter table public.%I enable row level security',r.tablename);
  execute format('revoke all on table public.%I from public',r.tablename);
  if exists(select 1 from pg_roles where rolname='anon') then execute format('revoke all on table public.%I from anon',r.tablename); end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then execute format('revoke all on table public.%I from authenticated',r.tablename); end if;
  if exists(select 1 from pg_roles where rolname='service_role') then execute format('grant all on table public.%I to service_role',r.tablename); end if;
 end loop;
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'az\_%' escape '\' loop
  execute format('revoke all on function %s from public',r.signature);
  if exists(select 1 from pg_roles where rolname='anon') then execute format('revoke all on function %s from anon',r.signature); end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then execute format('revoke all on function %s from authenticated',r.signature); end if;
  if exists(select 1 from pg_roles where rolname='service_role') then execute format('grant execute on function %s to service_role',r.signature); end if;
 end loop;
end $$;
-- Storage is private; object reads/writes go through signed server URLs only.
do $$ begin
 if to_regclass('storage.buckets') is not null then
   insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('az-private','az-private',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','text/plain']) on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
 end if;
end $$;
commit;
