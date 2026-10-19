-- Additive Academy completion layer. No curriculum content or purchase grants are seeded.
create table public.aa_skill_links (
 target_code text not null references public.aa_nodes(code),
 skill_code text not null references public.aa_nodes(code), primary key(target_code,skill_code)
);
create table public.aa_block_versions (
 code text not null check(code ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$'),
 version integer not null check(version>0), state text not null check(state in ('draft','approved','published')),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(), created_by bigint not null references public.users(id),
 primary key(code,version)
);
create table public.aa_events (
 id bigint generated always as identity primary key, actor_id bigint not null references public.users(id),
 event text not null check(event in ('catalog_view','course_view','enrolled','lesson_open','quiz_started','quiz_passed','submission_submitted','lesson_completed','certificate_issued')),
 entity_code text not null check(entity_code ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$'), created_at timestamptz not null default now(), unique(actor_id,event,entity_code)
);
create index aa_events_course_time on public.aa_events(entity_code,created_at);
alter table public.aa_progress add column content_snapshot jsonb;

create function public.aa_completion_immutable() returns trigger language plpgsql set search_path=public as $$
begin raise exception 'academy_immutable'; end $$;
create trigger aa_block_immutable before update or delete on public.aa_block_versions for each row execute function public.aa_completion_immutable();
create trigger aa_event_immutable before update or delete on public.aa_events for each row execute function public.aa_completion_immutable();

create function public.aa_skill_link_validate() returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from aa_nodes where code=new.target_code and kind in ('course','lesson')) or not exists(select 1 from aa_nodes where code=new.skill_code and kind='skill') then raise exception 'academy_skill_link_invalid'; end if;
 return new;
end $$;
create trigger aa_skill_link_validate before insert or update on public.aa_skill_links for each row execute function public.aa_skill_link_validate();

create function public.aa_purchase_access(p_user bigint,p_course text) returns boolean language sql stable set search_path=public as $$
 select case when n.data->>'legacy_course_id' is null then true else exists(
 select 1 from courses c where c.id::text=n.data->>'legacy_course_id' and c.published and (c.price_stars=0 or exists(select 1 from course_access a where a.course_id=c.id and a.user_id=p_user))) end
 from aa_nodes n where n.code=p_course and n.kind='course'
$$;
create function public.aa_offer(p_user bigint,p_course text) returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('legacy_course_id',c.id,'title',c.title,'price_stars',c.price_stars,'has_access',c.published and (c.price_stars=0 or exists(select 1 from course_access a where a.course_id=c.id and a.user_id=p_user)),'purchasable',c.published and c.price_stars>0)
 from aa_nodes n join courses c on c.id::text=n.data->>'legacy_course_id' where n.code=p_course and n.kind='course'
$$;
alter function public.aa_can_study(bigint,text) rename to aa_base_can_study;
create function public.aa_can_study(p_user bigint,p_code text) returns boolean language sql stable set search_path=public as $$
 select aa_base_can_study(p_user,p_code) and coalesce(aa_purchase_access(p_user,aa_course(p_code)),false)
$$;

create function public.aa_resolve_blocks(p_blocks jsonb) returns jsonb language plpgsql stable set search_path=public as $$
declare b jsonb; resolved jsonb; result jsonb:='[]';
begin
 if jsonb_typeof(p_blocks) is distinct from 'array' then raise exception 'academy_blocks_invalid'; end if;
 for b in select value from jsonb_array_elements(p_blocks) loop
  if b->>'type'='reference' then
   select payload into resolved from aa_block_versions where code=b->>'ref_code' and version::text=b->>'ref_version' and state='published';
   if resolved is null then raise exception 'academy_block_unpublished'; end if;
   result:=result||jsonb_build_array(aa_public_json(resolved));
  else result:=result||jsonb_build_array(aa_public_json(b)); end if;
 end loop;
 return result;
end $$;
create function public.aa_localized_blocks(p_data jsonb) returns jsonb language plpgsql stable set search_path=public as $$
declare locale text; translated jsonb; blocks jsonb; body text; result jsonb:='{}';
begin
 foreach locale in array array['en','kk'] loop
  translated:=coalesce(p_data->'translations'->locale,p_data->'translations'->upper(locale));
  if jsonb_typeof(translated) is distinct from 'object' then continue; end if;
  translated:=translated||case when jsonb_typeof(translated->'data')='object' then translated->'data' else '{}' end;
  blocks:=coalesce(translated->'content_blocks',translated->'blocks',translated->'contentBlocks');
  if blocks is null then
   body:=case when jsonb_typeof(coalesce(translated->'body',translated->'text',translated->'content'))='string' then coalesce(translated->>'body',translated->>'text',translated->>'content') end;
   if nullif(trim(body),'') is not null then blocks:=jsonb_build_array(jsonb_build_object('type','markdown','body',body)); end if;
  end if;
  if blocks is null then continue; end if;
  if jsonb_typeof(blocks) is distinct from 'array' then raise exception 'academy_blocks_invalid'; end if;
  if jsonb_array_length(blocks)>0 then result:=result||jsonb_build_object(locale,aa_resolve_blocks(blocks)); end if;
 end loop;
 return result;
end $$;
alter function public.aa_has_content(jsonb) rename to aa_base_has_content;
create function public.aa_has_content(p_data jsonb) returns boolean language sql stable set search_path=public as $$
 select aa_base_has_content(jsonb_build_object('content_blocks',aa_resolve_blocks(coalesce(p_data->'content_blocks',p_data->'blocks',p_data->'contentBlocks','[]'))))
$$;
create function public.aa_completion_validate_node() returns trigger language plpgsql set search_path=public as $$
begin
 if new.kind='course' and new.data ? 'legacy_course_id' and (jsonb_typeof(new.data->'legacy_course_id') not in ('number','string') or not exists(select 1 from courses where id::text=new.data->>'legacy_course_id')) then raise exception 'academy_offer_invalid'; end if;
 if new.kind='lesson' then
  perform aa_resolve_blocks(coalesce(new.data->'content_blocks',new.data->'blocks',new.data->'contentBlocks','[]'));
  perform aa_localized_blocks(new.data);
 end if;
 return new;
end $$;
create trigger aa_completion_validate_node before insert or update on public.aa_nodes for each row execute function public.aa_completion_validate_node();

create function public.aa_skill_progress(p_user bigint) returns jsonb language sql stable set search_path=public as $$
 with mapped as (
  select distinct s.skill_code,l.code from aa_skill_links s join aa_nodes target on target.code=s.target_code
  join aa_nodes l on l.kind='lesson' and (l.code=target.code or (target.kind='course' and aa_course(l.code)=target.code))
  where l.state<>'archived' and coalesce((l.data->>'required')::boolean,true)
 ), counts as (
  select n.code,n.title,count(m.code) required,count(p.lesson_code) completed from aa_nodes n
  left join mapped m on m.skill_code=n.code left join aa_progress p on p.user_id=p_user and p.lesson_code=m.code
  where n.kind='skill' and n.state='published' group by n.code,n.title
 ) select jsonb_build_object('skills',coalesce(jsonb_agg(jsonb_build_object('code',code,'title',title,'required',required,'completed',completed,'percent',case when required=0 then 0 else round(100.0*completed/required) end,'verified',required>0 and completed=required) order by code),'[]')) from counts
$$;

alter function public.academy_action(bigint,text,jsonb) rename to aa_base_action;
create function public.academy_action(p_actor bigint,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$
declare permissions jsonb; editor boolean; result jsonb; v_code text:=p_payload->>'code'; course text; ev text; b jsonb; latest aa_block_versions; current_version integer; snapshot jsonb; target text; item jsonb; artifact jsonb; source_data jsonb; localized jsonb; locale text; translations jsonb;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'academy_invalid_payload'; end if;
 permissions:=aa_base_action(p_actor,'permissions','{}'); editor:=coalesce((permissions->>'editor')::boolean,false);
 if p_action in ('block_save','skill_map','admin_save','enroll','complete','quiz_start','quiz_submit','submission_save','submission_submit','certificate') then perform pg_advisory_xact_lock(7813); end if;
 if p_action='skills' then
  return jsonb_build_object('skills',(select coalesce(jsonb_agg(aa_safe(n) order by code),'[]') from aa_nodes n where kind='skill' and (editor or state='published')),'links',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from aa_skill_links s join aa_nodes sk on sk.code=s.skill_code join aa_nodes nt on nt.code=s.target_code where editor or (sk.state='published' and nt.state='published')));
 elsif p_action='skill_progress' then return aa_skill_progress(p_actor);
 elsif p_action='skill_map' then
  if not editor then raise exception 'academy_forbidden'; end if;
  target:=p_payload->>'target_code';
  if not exists(select 1 from aa_nodes where aa_nodes.code=target and kind in ('course','lesson')) or jsonb_typeof(p_payload->'skill_codes') is distinct from 'array' then raise exception 'academy_skill_link_invalid'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'skill_codes') v where jsonb_typeof(v)<>'string' or not exists(select 1 from aa_nodes where aa_nodes.code=v#>>'{}' and kind='skill')) then raise exception 'academy_skill_link_invalid'; end if;
  delete from aa_skill_links where target_code=target;
  insert into aa_skill_links select distinct target,value from jsonb_array_elements_text(p_payload->'skill_codes');
  insert into aa_audit(actor_id,action,object_code,after_json) values(p_actor,'skill_map',target,jsonb_build_object('skill_codes',p_payload->'skill_codes'));
  return jsonb_build_object('target_code',target,'skill_codes',p_payload->'skill_codes');
 elsif p_action in ('block_list','block_save') then
  if not editor then raise exception 'academy_forbidden'; end if;
  if p_action='block_list' then
   return jsonb_build_object('blocks',(select coalesce(jsonb_agg(to_jsonb(z) order by z.code,z.version desc),'[]') from (select code,version,state,payload from aa_block_versions where (p_payload->>'code' is null or aa_block_versions.code=p_payload->>'code') order by code,version desc limit 500) z));
  end if;
  select * into latest from aa_block_versions where aa_block_versions.code=v_code order by version desc limit 1;
  current_version:=coalesce(latest.version,0);
  if current_version<>coalesce((p_payload->>'expected_version')::integer,0) then raise exception 'academy_version_conflict'; end if;
  b:=p_payload->'payload';
  if jsonb_typeof(b) is distinct from 'object' or b->>'type' is null or b->>'type' not in ('markdown','text','code','video','file','link','checklist','practice','external_reference','resource') or length(b::text)>100000 then raise exception 'academy_blocks_invalid'; end if;
  if p_payload->>'state'='published' and (latest.state is distinct from 'approved' or latest.payload is distinct from b) then raise exception 'academy_approval_required'; end if;
  if not aa_base_has_content(jsonb_build_object('content_blocks',jsonb_build_array(b))) then raise exception 'academy_content_required'; end if;
  insert into aa_block_versions(code,version,state,payload,created_by) values(v_code,current_version+1,coalesce(p_payload->>'state','draft'),b,p_actor) returning to_jsonb(aa_block_versions)-'created_by' into result;
  insert into aa_audit(actor_id,action,object_code,after_json) values(p_actor,'block_save',v_code,result);
  return result;
 elsif p_action='analytics' then
  if not editor then raise exception 'academy_forbidden'; end if;
  return jsonb_build_object('funnel',(select coalesce(jsonb_agg(to_jsonb(z) order by event),'[]') from (select event,count(*) count,count(distinct actor_id) learners from aa_events group by event) z),
   'dropout',(select coalesce(jsonb_agg(to_jsonb(z) order by course_code),'[]') from (
    select n.code course_code,count(distinct e.user_id) enrolled,
    count(distinct e.user_id) filter(where exists(select 1 from aa_events v where v.actor_id=e.user_id and aa_course(v.entity_code)=n.code and v.event in ('lesson_open','quiz_started'))) started,
    count(distinct e.user_id) filter(where (aa_course_progress(e.user_id,n.code)->>'all_required_passed')::boolean) completed,
    count(distinct e.user_id) filter(where not (aa_course_progress(e.user_id,n.code)->>'all_required_passed')::boolean and coalesce((select max(v.created_at) from aa_events v where v.actor_id=e.user_id and aa_course(v.entity_code)=n.code),e.created_at)<now()-interval '7 days') inactive
    from aa_nodes n join aa_enrollments e on e.course_code=n.code where n.kind='course' group by n.code) z),
   'time_to_first_result',(with firsts as (select actor_id,min(created_at) filter(where event='enrolled') enrolled,min(created_at) filter(where event in ('quiz_passed','lesson_completed')) result from aa_events group by actor_id), delays as(select greatest(0,extract(epoch from f.result-f.enrolled)) seconds from firsts f where f.enrolled is not null and f.result>=f.enrolled) select jsonb_build_object('learners',count(*),'median_seconds',percentile_cont(0.5) within group(order by seconds)) from delays));
 end if;
 if p_action='quiz_submit' then select assessment_code into v_code from aa_attempts where id=(p_payload->>'attempt_id')::bigint and user_id=p_actor;
 elsif p_action='submission_submit' then select assessment_code,s.artifact into v_code,artifact from aa_submissions s where id=(p_payload->>'submission_id')::bigint and user_id=p_actor; end if;
 course:=aa_course(v_code);
 if p_action in ('lesson','enroll','complete','quiz_start','quiz_submit','submission_save','submission_submit','certificate') and course is not null and not (p_action='lesson' and editor) then
  -- Hold an existing grant against concurrent refund deletion until this operation commits.
  perform 1 from course_access a join aa_nodes n on n.data->>'legacy_course_id'=a.course_id::text where a.user_id=p_actor and n.code=course for key share of a;
  if not coalesce(aa_purchase_access(p_actor,course),false) then raise exception 'academy_purchase_required'; end if;
 end if;
 if p_action='submission_save' then artifact:=p_payload->'artifact'; end if;
 if p_action in ('submission_save','submission_submit') and artifact ? 'file_ids' then
  if jsonb_typeof(artifact->'file_ids') is distinct from 'array' then raise exception 'academy_files_invalid'; end if;
  if to_regprocedure('public.aa_valid_files(bigint,text,jsonb)') is null then
   if artifact->'file_ids'<>'[]'::jsonb then raise exception 'academy_files_invalid'; end if;
  else
   execute 'select public.aa_valid_files($1,$2,$3)' into editor using p_actor,v_code,artifact;
   if not coalesce(editor,false) then raise exception 'academy_files_invalid'; end if;
  end if;
 end if;
 result:=aa_base_action(p_actor,p_action,p_payload);
 if p_action='course' then result:=result||jsonb_build_object('offer',aa_offer(p_actor,course));
 elsif p_action='lesson' and result ? 'blocks' then
  result:=jsonb_set(result,'{blocks}',aa_resolve_blocks(result->'blocks'));
  if result->'lesson'->>'kind'='lesson' then
   result:=jsonb_set(result,'{lesson,data}',(result->'lesson'->'data')-'content_blocks'-'blocks'-'contentBlocks');
   select data into source_data from aa_nodes where aa_nodes.code=v_code;
   localized:=aa_localized_blocks(source_data);
   translations:=coalesce(aa_translation_metadata(source_data->'translations'),'{}');
   for locale,item in select key,value from jsonb_each(localized) loop
    translations:=translations||jsonb_build_object(locale,coalesce(translations->locale,translations->upper(locale),'{}')||jsonb_build_object('content_blocks',item));
   end loop;
   if source_data ? 'translations' then result:=jsonb_set(result,'{lesson,data,translations}',translations); end if;
   result:=result||jsonb_build_object('localized_blocks',localized);
  end if;
 elsif p_action='complete' then
  select aa_resolve_blocks(coalesce(data->'content_blocks',data->'blocks',data->'contentBlocks','[]')) into snapshot from aa_nodes where aa_nodes.code=v_code;
  update aa_progress set content_snapshot=snapshot where user_id=p_actor and lesson_code=v_code and content_snapshot is null;
 end if;
 ev:=case p_action when 'catalog' then 'catalog_view' when 'course' then 'course_view' when 'enroll' then 'enrolled' when 'lesson' then 'lesson_open' when 'quiz_start' then 'quiz_started' when 'quiz_submit' then case when (result->>'passed')::boolean then 'quiz_passed' end when 'submission_submit' then 'submission_submitted' when 'complete' then 'lesson_completed' when 'certificate' then 'certificate_issued' end;
 if ev is not null then insert into aa_events(actor_id,event,entity_code) values(p_actor,ev,case when p_action='catalog' then 'catalog' else v_code end) on conflict do nothing; end if;
 return result;
end $$;

do $$ declare t text; f record; begin
 foreach t in array array['aa_skill_links','aa_block_versions','aa_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and (proname like 'aa_%' or proname='academy_action') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
grant usage,select on sequence public.aa_events_id_seq to service_role;
-- Reads only existing purchase tables; no grants to clients and no purchase writes.
grant select on public.courses,public.course_access to service_role;

