-- CLI unavailable locally; additive migration verified with local PostgreSQL (PGlite).
-- No existing course, lesson, progress or user rows are changed.
create table public.aa_nodes (
 code text primary key check (code ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$'),
 kind text not null check (kind in ('direction','course','module','lesson','source','skill','assessment','rubric')),
 parent_code text references public.aa_nodes(code) deferrable initially deferred,
 title text not null check(length(title) between 1 and 500), position integer not null default 0 check(position>=0),
 state text not null default 'outline' check(state in ('outline','draft','in_review','approved','published','archived')),
 version integer not null default 1 check(version>0), data jsonb not null default '{}' check(jsonb_typeof(data)='object'),
 seed_managed boolean not null default false, updated_at timestamptz not null default now(),
 unique(parent_code,kind,position) deferrable initially deferred
);
create index aa_nodes_parent on public.aa_nodes(parent_code,kind,position);
create index aa_nodes_search on public.aa_nodes using gin(to_tsvector('simple',title || ' ' || data::text));
create table public.aa_source_links (
 source_code text not null references public.aa_nodes(code), target_code text not null references public.aa_nodes(code),
 usage text not null default 'supplementary', visibility text not null default 'internal' check(visibility in ('internal','student','public')),
 start_seconds integer not null default 0 check(start_seconds>=0), end_seconds integer check(end_seconds>start_seconds), note text,
 seed_managed boolean not null default false, primary key(source_code,target_code,usage,start_seconds)
);
create table public.aa_prerequisites(course_code text references public.aa_nodes(code),requires_code text references public.aa_nodes(code),primary key(course_code,requires_code),check(course_code<>requires_code));
create table public.aa_roles(user_id bigint references public.users(id),role text check(role in ('editor','instructor')),primary key(user_id,role));
create table public.aa_enrollments(user_id bigint references public.users(id),course_code text references public.aa_nodes(code),state text not null check(state in ('waiting','active')),created_at timestamptz not null default now(),primary key(user_id,course_code));
create table public.aa_progress(user_id bigint references public.users(id),lesson_code text references public.aa_nodes(code),completed_at timestamptz not null default now(),primary key(user_id,lesson_code));
create table public.aa_attempts(id bigint generated always as identity primary key,user_id bigint references public.users(id),assessment_code text references public.aa_nodes(code),assessment_version integer not null,snapshot jsonb not null,answers jsonb,score numeric,passed boolean,created_at timestamptz not null default now(),submitted_at timestamptz);
create index aa_attempts_owner on public.aa_attempts(user_id,assessment_code);
create table public.aa_submissions(id bigint generated always as identity primary key,user_id bigint references public.users(id),assessment_code text references public.aa_nodes(code),assessment_version integer not null,version integer not null,state text not null check(state in ('draft','submitted','needs_revision','passed','failed')),artifact jsonb not null default '{}',rubric_snapshot jsonb not null default '{}',assigned_to bigint references public.users(id),created_at timestamptz not null default now(),submitted_at timestamptz,unique(user_id,assessment_code,version));
create table public.aa_reviews(id bigint generated always as identity primary key,submission_id bigint references public.aa_submissions(id),reviewer_id bigint references public.users(id),scores jsonb not null,feedback text not null,decision text not null,score numeric not null,created_at timestamptz not null default now(),unique(submission_id));
create table public.aa_placements(id bigint generated always as identity primary key,user_id bigint references public.users(id),course_code text references public.aa_nodes(code),evidence_url text not null,state text not null default 'pending',reviewer_id bigint references public.users(id),reason text,created_at timestamptz not null default now());
create table public.aa_certificates(code text primary key,user_id bigint references public.users(id),course_code text references public.aa_nodes(code),issued_at timestamptz not null default now(),revoked_at timestamptz,unique(user_id,course_code));
create table public.aa_audit(id bigint generated always as identity primary key,actor_id bigint references public.users(id),action text not null,object_code text,before_json jsonb,after_json jsonb,created_at timestamptz not null default now());

create function public.aa_course(p_code text) returns text language sql stable set search_path=public as $$
 with recursive tree as(select code,parent_code,kind from aa_nodes where code=p_code union all select n.code,n.parent_code,n.kind from aa_nodes n join tree t on t.parent_code=n.code) select code from tree where kind='course' limit 1
$$;
create function public.aa_public_json(p_value jsonb) returns jsonb language plpgsql immutable strict set search_path=public as $$
declare item record; result jsonb;
begin
 if jsonb_typeof(p_value)='object' then
  result:='{}';
  for item in select key,value from jsonb_each(p_value) loop
   if lower(replace(item.key,'_','')) not in ('answer','answerkey','correct','correctindex','questions','expected','expectedanswer','acceptedanswers','editornote','internalnotes','privatenotes') then result:=result||jsonb_build_object(item.key,aa_public_json(item.value)); end if;
  end loop;
  return result;
 elsif jsonb_typeof(p_value)='array' then
  return (select coalesce(jsonb_agg(aa_public_json(value)),'[]') from jsonb_array_elements(p_value));
 end if;
 return p_value;
end $$;
-- Translation dictionaries share the same content boundary as their main entity.
-- Metadata projections retain only metadata keys, recursively, including nested data.
create function public.aa_translation_fields(p_value jsonb) returns jsonb language plpgsql immutable strict set search_path=public as $$
declare item record; result jsonb:='{}';
begin
 if jsonb_typeof(p_value)='object' then
  for item in select key,value from jsonb_each(p_value) loop
   if item.key=any(array['title','description','slug','level','outcome','outcomes','learningOutcome','audience','hours','capstone','duration_min','durationMin','primary_format','primaryFormat','locale','tags','icon','type','language','required','minutes','format','prerequisites','artifact','acceptance','keywords','source_type','author','provider','price_stars','free_preview','data']) then
    result:=result||jsonb_build_object(item.key,aa_translation_fields(item.value));
   end if;
  end loop;
  return result;
 elsif jsonb_typeof(p_value)='array' then
  return (select coalesce(jsonb_agg(aa_translation_fields(value)),'[]') from jsonb_array_elements(p_value));
 end if;
 return p_value;
end $$;
create function public.aa_translation_metadata(p_value jsonb) returns jsonb language sql immutable strict set search_path=public as $$
 select coalesce(jsonb_object_agg(key,aa_translation_fields(value)),'{}') from jsonb_each(case when jsonb_typeof(p_value)='object' then p_value else '{}' end) where jsonb_typeof(value)='object'
$$;
create function public.aa_safe(n public.aa_nodes, p_full boolean default false) returns jsonb language sql stable set search_path=public as $$
 select aa_public_json(jsonb_build_object('code',n.code,'kind',n.kind,'parent_code',n.parent_code,'title',n.title,'position',n.position,'state',n.state,'version',n.version,'seed_managed',n.seed_managed,'data',
 (select coalesce(jsonb_object_agg(key,case when key='translations' and not (p_full and n.kind='lesson') then aa_translation_metadata(value) else value end),'{}') from jsonb_each(n.data) where key=any(array['description','slug','level','outcome','learningOutcome','audience','hours','capstone','duration_min','durationMin','primary_format','primaryFormat','locale','translations','tags','icon','canonical_url','url','type','language','rights_state','link_state','checked_at','provenance','required','minutes','format','prerequisites','artifact','acceptance','chapters','original_url','rights','status','keywords','outcomes','source_type','author','provider','price_stars','free_preview']) or (p_full and n.kind='lesson' and key in ('content_blocks','blocks','contentBlocks')))))
$$;
create function public.aa_eligible(p_user bigint,p_course text) returns boolean language sql stable set search_path=public as $$
 select exists(select 1 from aa_placements where user_id=p_user and course_code=p_course and state='passed') or not exists(select 1 from aa_prerequisites p where p.course_code=p_course and not exists(select 1 from aa_certificates c where c.user_id=p_user and c.course_code=p.requires_code and c.revoked_at is null) and not (
  exists(select 1 from aa_nodes l join aa_nodes m on m.code=l.parent_code where l.kind='lesson' and m.parent_code=p.requires_code and l.state='published' and coalesce((l.data->>'required')::boolean,true)) and
  not exists(select 1 from aa_nodes l join aa_nodes m on m.code=l.parent_code where l.kind='lesson' and m.parent_code=p.requires_code and l.state<>'archived' and coalesce((l.data->>'required')::boolean,true) and not exists(select 1 from aa_progress g where g.user_id=p_user and g.lesson_code=l.code))
 ))
$$;
create function public.aa_course_progress(p_user bigint,p_course text) returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('course_code',p_course,'required',count(*),'total',count(*),'completed',count(p.lesson_code),'percent',case when count(*)=0 then 0 else round(100.0*count(p.lesson_code)/count(*)) end,'all_required_passed',count(*)>0 and count(*)=count(p.lesson_code)) from aa_nodes l join aa_nodes m on m.code=l.parent_code left join aa_progress p on p.lesson_code=l.code and p.user_id=p_user where l.kind='lesson' and m.parent_code=p_course and l.state<>'archived' and coalesce((l.data->>'required')::boolean,true)
$$;
create function public.aa_neighbors(p_code text) returns jsonb language sql stable set search_path=public as $$
 with ordered as (select l.code,lag(aa_safe(l)) over(order by m.position,l.position,l.code) previous,lead(aa_safe(l)) over(order by m.position,l.position,l.code) next from aa_nodes l join aa_nodes m on m.code=l.parent_code where l.kind='lesson' and l.state='published' and m.state='published' and m.parent_code=aa_course(p_code))
 select coalesce((select jsonb_build_object('previous',previous,'next',next) from ordered where code=p_code),jsonb_build_object('previous',null,'next',null))
$$;
create function public.aa_source_visible(p_source public.aa_nodes) returns boolean language sql stable set search_path=public as $$
 select p_source.kind='source' and p_source.state='published' and p_source.data->>'rights_state' in ('approved','owned','licensed','public_link') and p_source.data->>'link_state'='verified' and nullif(p_source.data->>'checked_at','') is not null and exists(select 1 from aa_source_links sl where sl.source_code=p_source.code and sl.visibility in ('public','student') and sl.usage not in ('methodological','internal'))
$$;
create function public.aa_source_category(p_type text) returns text language sql immutable set search_path=public as $$
 select case when lower(p_type) ~ '(video|youtube|видео|запись)' then 'video'
 when lower(p_type) ~ '(documentation|document|docs|документац|guide|specification|standards|методолог)' then 'documentation'
 when lower(p_type) ~ '(research|paper|исследован)' then 'research'
 when lower(p_type) ~ '(course|кур|программ|academ|академ|учебн|практик|сертифик|воркшоп|learning|curriculum|roadmap|syllabus|силлабус)' then 'course'
 else lower(p_type) end
$$;
create function public.aa_library_match(p_source public.aa_nodes,p_filter jsonb) returns boolean language sql immutable set search_path=public as $$
 select (coalesce(nullif(p_filter->>'language',''),nullif(p_filter->>'lang','')) is null or upper(coalesce(nullif(p_filter->>'language',''),p_filter->>'lang'))=any(regexp_split_to_array(upper(coalesce(p_source.data->>'language','')),'[/,;[:space:]]+')))
 and (coalesce(nullif(p_filter->>'source_type',''),nullif(p_filter->>'type','')) is null or aa_source_category(coalesce(p_source.data->>'source_type',p_source.data->>'type',p_source.data->>'kind',''))=aa_source_category(coalesce(nullif(p_filter->>'source_type',''),p_filter->>'type')))
$$;
create function public.aa_can_study(p_user bigint,p_code text) returns boolean language sql stable set search_path=public as $$
 with recursive lineage as (select code,parent_code,kind,state from aa_nodes where code=p_code union all select n.code,n.parent_code,n.kind,n.state from aa_nodes n join lineage l on n.code=l.parent_code)
 select exists(select 1 from lineage where kind='course') and not exists(select 1 from lineage where kind in ('assessment','lesson','module','course') and state<>'published') and exists(select 1 from aa_enrollments where user_id=p_user and course_code=aa_course(p_code) and state='active') and aa_eligible(p_user,aa_course(p_code))
$$;
create function public.aa_has_content(p_data jsonb) returns boolean language sql stable set search_path=public as $$
 select exists(select 1 from jsonb_array_elements(coalesce(p_data->'content_blocks',p_data->'blocks',p_data->'contentBlocks','[]')) b where length(trim(coalesce(b->>'body',b->>'text',b->>'instructions',b->>'content','')))>0 or (b->>'type' in ('external_reference','resource') and exists(select 1 from aa_nodes where code=coalesce(b->>'sourceCode',b->>'source_code') and kind='source' and state='published')))
$$;
create function public.aa_quiz_question_valid(q jsonb) returns boolean language plpgsql immutable set search_path=public as $$
declare typ text:=coalesce(q->>'type','mcq'); key jsonb:=coalesce(q->'answer',q->'correct',q->'expected'); item jsonb; n integer;
begin
 if jsonb_typeof(q->'prompt') is distinct from 'string' or nullif(trim(q->>'prompt'),'') is null or key is null or key='null'::jsonb then return false; end if;
 if typ in ('text','code') then
  return jsonb_typeof(key)='string' and length(key#>>'{}') between 1 and 20000 and (not (q ? 'accepted_answers') or (jsonb_typeof(q->'accepted_answers')='array' and not exists(select 1 from jsonb_array_elements(q->'accepted_answers') a where jsonb_typeof(a)<>'string')));
 end if;
 if typ not in ('mcq','single','multi') or jsonb_typeof(q->'choices') is distinct from 'array' then return false; end if;
 n:=jsonb_array_length(q->'choices'); if n not between 2 and 30 or exists(select 1 from jsonb_array_elements(q->'choices') c where jsonb_typeof(c) is distinct from 'string') then return false; end if;
 if typ='multi' then
  if jsonb_typeof(key) is distinct from 'array' or jsonb_array_length(key)=0 or jsonb_array_length(key)<>(select count(distinct value) from jsonb_array_elements(key)) then return false; end if;
  for item in select value from jsonb_array_elements(key) loop
   if jsonb_typeof(item)<>'number' or (item::text)::numeric<>trunc((item::text)::numeric) or (item::text)::integer not between 0 and n-1 then return false; end if;
  end loop;
  return true;
 end if;
 return jsonb_typeof(key)='number' and (key::text)::numeric=trunc((key::text)::numeric) and (key::text)::integer between 0 and n-1;
exception when others then return false;
end $$;
create function public.aa_quiz_score(p_questions jsonb,p_answers jsonb) returns numeric language plpgsql immutable set search_path=public as $$
declare q jsonb; a jsonb; k jsonb; item jsonb; typ text; i integer:=0; hit integer:=0; n integer; actual_text text; expected_text text; matched boolean;
begin
 if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)<>jsonb_array_length(p_questions) then raise exception 'academy_answers_invalid'; end if;
 for q in select value from jsonb_array_elements(p_questions) loop
  if aa_quiz_question_valid(q) is distinct from true then raise exception 'academy_assessment_invalid'; end if;
  a:=p_answers->i;k:=coalesce(q->'answer',q->'correct',q->'expected');typ:=coalesce(q->>'type','mcq');matched:=false;
  if typ in ('text','code') then
   if jsonb_typeof(a) is distinct from 'string' or length(a#>>'{}')>20000 then raise exception 'academy_answers_invalid'; end if;
   actual_text:=trim(replace(a#>>'{}',E'\r\n',E'\n'));
   for item in select value from jsonb_array_elements(jsonb_build_array(k)||coalesce(q->'accepted_answers','[]')) loop
    expected_text:=trim(replace(item#>>'{}',E'\r\n',E'\n'));
    if coalesce((q->>'case_sensitive')::boolean,typ='code') then matched:=matched or actual_text=expected_text;
    else matched:=matched or lower(actual_text)=lower(expected_text);end if;
   end loop;
  elsif typ='multi' then
   if jsonb_typeof(a) is distinct from 'array' or jsonb_array_length(a)<>(select count(distinct value) from jsonb_array_elements(a)) then raise exception 'academy_answers_invalid'; end if;
   n:=jsonb_array_length(q->'choices');
   for item in select value from jsonb_array_elements(a) loop
    if jsonb_typeof(item)<>'number' or (item::text)::numeric<>trunc((item::text)::numeric) or (item::text)::integer not between 0 and n-1 then raise exception 'academy_answers_invalid';end if;
   end loop;
   matched:=(select coalesce(jsonb_agg(value order by (value::text)::integer),'[]') from jsonb_array_elements(a))=(select jsonb_agg(value order by (value::text)::integer) from jsonb_array_elements(k));
  else
   if jsonb_typeof(a) is distinct from 'number' or (a::text)::numeric<>trunc((a::text)::numeric) or (a::text)::integer not between 0 and jsonb_array_length(q->'choices')-1 then raise exception 'academy_answers_invalid';end if;
   matched:=a=k;
  end if;
  if matched then hit:=hit+1;end if;i:=i+1;
 end loop;
 return round(100.0*hit/greatest(i,1));
end $$;
create function public.aa_validate_node() returns trigger language plpgsql set search_path=public as $$
declare parent_kind text; b jsonb;
begin
 if new.parent_code=new.code then raise exception 'academy_invalid_parent'; end if;
 select kind into parent_kind from aa_nodes where code=new.parent_code;
 if (new.kind in ('direction','source','skill','rubric') and new.parent_code is not null) or (new.kind='course' and new.parent_code is not null and parent_kind is distinct from 'direction') or (new.kind='module' and parent_kind is distinct from 'course') or (new.kind='lesson' and parent_kind is distinct from 'module') or (new.kind='assessment' and coalesce(parent_kind,'') not in ('lesson','course')) then raise exception 'academy_invalid_parent'; end if;
 if new.kind='source' and coalesce(new.data->>'canonical_url',new.data->>'url','') !~ '^https://[^/[:space:]]+(/|$)' then raise exception 'academy_invalid_url'; end if;
 if new.kind='source' and coalesce(new.data->>'canonical_url',new.data->>'url','') ~* '(token|api_key|secret|password)=|^https://[^/]*@' then raise exception 'academy_invalid_url'; end if;
 if new.state='published' and old.state is distinct from 'published' and old.state is distinct from 'approved' then raise exception 'academy_approval_required'; end if;
 if new.state='published' and new.kind='lesson' and (not aa_has_content(new.data) or (coalesce(new.data->>'format',new.data->>'primary_format','') not in ('microlecture','resource','guided_demo') and not exists(select 1 from aa_nodes where parent_code=new.code and kind='assessment' and state='published'))) then raise exception 'academy_content_required'; end if;
 if new.state='published' and new.kind='course' and (not exists(select 1 from aa_nodes l join aa_nodes m on m.code=l.parent_code where l.kind='lesson' and m.parent_code=new.code and l.state='published') or exists(select 1 from aa_nodes l join aa_nodes m on m.code=l.parent_code where l.kind='lesson' and m.parent_code=new.code and l.state not in ('published','archived') and coalesce((l.data->>'required')::boolean,true))) then raise exception 'academy_content_required'; end if;
 if new.state='published' and new.kind='source' and (coalesce(new.data->>'rights_state','') not in ('approved','owned','licensed','public_link') or coalesce(new.data->>'link_state','')<>'verified' or nullif(new.data->>'checked_at','') is null) then raise exception 'academy_source_unverified'; end if;
 if new.state='published' and new.kind='assessment' and (new.data->>'kind' not in ('quiz','assignment','placement','capstone') or new.data->>'kind' is null or (new.data->>'kind' in ('quiz','placement') and jsonb_array_length(coalesce(new.data->'questions','[]'))=0) or (new.data->>'kind' in ('assignment','capstone') and not exists(select 1 from aa_nodes where code=new.data->>'rubric_code' and kind='rubric' and state='published'))) then raise exception 'academy_assessment_invalid'; end if;
 if new.state='published' and new.kind='assessment' and new.data->>'kind' in ('quiz','placement') then
  if coalesce((new.data->>'passing_score')::numeric,70) not between 1 and 100 or coalesce((new.data->>'max_attempts')::integer,3) not between 1 and 20 then raise exception 'academy_assessment_invalid'; end if;
  for b in select value from jsonb_array_elements(new.data->'questions') loop
   if aa_quiz_question_valid(b) is distinct from true then raise exception 'academy_assessment_invalid'; end if;
  end loop;
 end if;
 if new.state='published' and new.kind='rubric' and (jsonb_array_length(coalesce(new.data->'criteria','[]'))=0 or exists(select 1 from jsonb_array_elements(new.data->'criteria') crit where nullif(crit->>'code','') is null or coalesce((crit->>'max_score')::numeric,100)<=0)) then raise exception 'academy_rubric_required'; end if;
 return new;
end $$;
create trigger aa_validate_node before insert or update on public.aa_nodes for each row execute function public.aa_validate_node();

create function public.academy_action(p_actor bigint,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$
<<academy>>
declare adm boolean; editor boolean; instructor boolean; n aa_nodes; oldn aa_nodes; s aa_submissions; attempt aa_attempts; e jsonb; q jsonb; r jsonb; x jsonb; result jsonb; c text; v_code text:=p_payload->>'code'; expected integer; total integer; offn integer:=greatest(0,coalesce((p_payload->>'offset')::integer,0)); lim integer:=least(100,greatest(1,coalesce((p_payload->>'limit')::integer,30))); score numeric:=0; passed boolean; countn integer:=0; dry boolean; rubric jsonb; decision text; rolestr text;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'academy_invalid_payload'; end if;
 foreach rolestr in array array['q','level','direction','parent_code','language','source_type','lang','type','kind'] loop
  if jsonb_typeof(p_payload->rolestr)='string' and trim(p_payload->>rolestr)='' then p_payload:=p_payload-rolestr; end if;
 end loop;
 if not exists(select 1 from users where id=p_actor) then raise exception 'academy_auth_required'; end if;
 select exists(select 1 from settings, jsonb_each(settings.value) v where settings.key='admins' and jsonb_typeof(v.value)='number' and v.value=to_jsonb(p_actor)) into adm;
 editor:=adm or exists(select 1 from aa_roles where user_id=p_actor and role='editor'); instructor:=adm or exists(select 1 from aa_roles where user_id=p_actor and role='instructor');
 if p_action='permissions' then return jsonb_build_object('admin',adm,'editor',editor,'instructor',instructor); end if;
 if p_action in ('audit','admin_audit') then
  if not editor then raise exception 'academy_forbidden'; end if;
  return jsonb_build_object('entries',(select coalesce(jsonb_agg(to_jsonb(au)),'[]') from (select * from aa_audit where p_payload->>'code' is null or object_code=p_payload->>'code' order by id desc offset offn limit lim) au),'total',(select count(*) from aa_audit where p_payload->>'code' is null or object_code=p_payload->>'code'));
 end if;
 if p_action like 'admin_%' and not editor then raise exception 'academy_forbidden'; end if;
 if p_action='admin_import' and not adm then raise exception 'academy_forbidden'; end if;
 if p_action in ('admin_roles','admin_assign') then
  if not adm then raise exception 'academy_forbidden'; end if;
  perform pg_advisory_xact_lock(7813);
  if p_action='admin_assign' then
   if not exists(select 1 from aa_roles where user_id=(p_payload->>'assigned_to')::bigint and role='instructor') then raise exception 'academy_instructor_required'; end if;
   update aa_submissions set assigned_to=(p_payload->>'assigned_to')::bigint where id=(p_payload->>'submission_id')::bigint and user_id<>(p_payload->>'assigned_to')::bigint returning to_jsonb(aa_submissions) into result;
   if result is null then raise exception 'academy_not_found'; end if;
  elsif p_payload ? 'user_id' then
   if p_payload ? 'role' then
    if p_payload->>'role' not in ('editor','instructor') or not exists(select 1 from users where id=(p_payload->>'user_id')::bigint) or jsonb_typeof(p_payload->'enabled') is distinct from 'boolean' then raise exception 'academy_roles_invalid'; end if;
    if (p_payload->>'enabled')::boolean then insert into aa_roles values((p_payload->>'user_id')::bigint,p_payload->>'role') on conflict do nothing;
    else delete from aa_roles where user_id=(p_payload->>'user_id')::bigint and role=p_payload->>'role'; end if;
    insert into aa_audit(actor_id,action,after_json) values(p_actor,'admin_roles',p_payload); return p_payload;
   end if;
   if not exists(select 1 from users where id=(p_payload->>'user_id')::bigint) or jsonb_typeof(p_payload->'roles') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(p_payload->'roles') role where role not in ('editor','instructor')) then raise exception 'academy_roles_invalid'; end if;
   delete from aa_roles where user_id=(p_payload->>'user_id')::bigint;
   insert into aa_roles select (p_payload->>'user_id')::bigint,role from jsonb_array_elements_text(p_payload->'roles') role on conflict do nothing;
   result:=p_payload;
  else return jsonb_build_object('roles',(select coalesce(jsonb_agg(to_jsonb(z)),'[]') from aa_roles z));
  end if;
  insert into aa_audit(actor_id,action,after_json) values(p_actor,p_action,result); return result;
 end if;
 if p_action='certificate_verify' then
  select jsonb_build_object('code',ct.code,'course_code',ct.course_code,'title',nc.title,'issued_at',ct.issued_at,'valid',ct.revoked_at is null) into result from aa_certificates ct join aa_nodes nc on nc.code=ct.course_code where ct.code=p_payload->>'verify_code';
  if result is null then raise exception 'academy_not_found'; end if; return result;
 end if;
 if p_action='review_queue' then
  if not instructor then raise exception 'academy_forbidden'; end if;
  return jsonb_build_object('submissions',(select coalesce(jsonb_agg(to_jsonb(z)||jsonb_build_object('assessment',aa_safe(a))),'[]') from (select * from aa_submissions where state='submitted' and (adm or assigned_to=p_actor) order by created_at,id offset offn limit lim) z join aa_nodes a on a.code=z.assessment_code),'total',(select count(*) from aa_submissions where state='submitted' and (adm or assigned_to=p_actor)),'rubrics',(select coalesce(jsonb_agg(to_jsonb(z)),'[]') from aa_nodes z where kind='rubric' and state='published'),'placements',(select coalesce(jsonb_agg(to_jsonb(z)),'[]') from (select * from aa_placements where state='pending' and adm order by created_at,id offset offn limit lim) z));
 end if;
 if p_action in ('enroll','complete','quiz_start','quiz_submit','submission_save','submission_submit','review','placement','certificate','admin_save','admin_reorder','admin_import') then perform pg_advisory_xact_lock(7813); end if;
 if p_action in ('catalog','library','admin_list') then
  select count(*) into total from aa_nodes z where
   (case p_action when 'catalog' then z.kind='course' and z.state<>'archived' when 'library' then z.kind='source' and aa_source_visible(z) else (p_payload->>'kind' is null or z.kind=p_payload->>'kind') end)
   and (p_action<>'library' or aa_library_match(z,p_payload)) and (p_payload->>'q' is null or z.title || ' ' || z.data::text ilike '%'||(p_payload->>'q')||'%') and (p_payload->>'level' is null or z.data->>'level'=p_payload->>'level') and (p_payload->>'direction' is null or z.parent_code=p_payload->>'direction') and (not (p_payload ? 'parent_code') or z.parent_code is not distinct from (p_payload->>'parent_code'));
  select coalesce(jsonb_agg(v),'[]') into result from(select case when p_action='admin_list' then to_jsonb(z) else aa_safe(z) end v from aa_nodes z where
   (case p_action when 'catalog' then z.kind='course' and z.state<>'archived' when 'library' then z.kind='source' and aa_source_visible(z) else (p_payload->>'kind' is null or z.kind=p_payload->>'kind') end)
   and (p_action<>'library' or aa_library_match(z,p_payload)) and (p_payload->>'q' is null or z.title || ' ' || z.data::text ilike '%'||(p_payload->>'q')||'%') and (p_payload->>'level' is null or z.data->>'level'=p_payload->>'level') and (p_payload->>'direction' is null or z.parent_code=p_payload->>'direction') and (not (p_payload ? 'parent_code') or z.parent_code is not distinct from (p_payload->>'parent_code')) order by position,code offset offn limit lim) t;
  if p_action='catalog' then return jsonb_build_object('courses',result,'total',total,'directions',(select coalesce(jsonb_agg(aa_safe(z) order by position,code),'[]') from aa_nodes z where kind='direction' and state<>'archived')); end if;
  return jsonb_build_object(case when p_action='library' then 'sources' else 'entities' end,result,'total',total);
 end if;
 if p_action='my' then return jsonb_build_object('permissions',jsonb_build_object('admin',adm,'editor',editor,'instructor',instructor),'roles',(select coalesce(jsonb_agg(role),'[]') from aa_roles where user_id=p_actor),'enrollments',(select coalesce(jsonb_agg(to_jsonb(z)||jsonb_build_object('course',(select aa_safe(nc) from aa_nodes nc where nc.code=z.course_code),'progress',aa_course_progress(p_actor,z.course_code))),'[]') from aa_enrollments z where user_id=p_actor),'progress',(select coalesce(jsonb_agg(to_jsonb(z)),'[]') from aa_progress z where user_id=p_actor),'submissions',(select coalesce(jsonb_agg(to_jsonb(z)||jsonb_build_object('reviews',(select coalesce(jsonb_agg(to_jsonb(rv)),'[]') from aa_reviews rv where rv.submission_id=z.id))),'[]') from aa_submissions z where user_id=p_actor),'certificates',(select coalesce(jsonb_agg(to_jsonb(z)),'[]') from aa_certificates z where user_id=p_actor),'placements',(select coalesce(jsonb_agg(to_jsonb(z)),'[]') from aa_placements z where user_id=p_actor)); end if;
 if p_action in ('course','lesson','enroll','complete','certificate','quiz_start','submission_save') then
  select * into n from aa_nodes where aa_nodes.code=v_code;
  if not found or n.state='archived' then raise exception 'academy_not_found'; end if;
  c:=aa_course(v_code);
 end if;
 if p_action='course' then
  if n.kind<>'course' then raise exception 'academy_not_found'; end if;
  return jsonb_build_object('course',aa_safe(n),'modules',(select coalesce(jsonb_agg(aa_safe(z) order by position,code),'[]') from aa_nodes z where parent_code=c and kind='module' and state<>'archived'),'lessons',(select coalesce(jsonb_agg(aa_safe(z) order by m.position,z.position,z.code),'[]') from aa_nodes z join aa_nodes m on m.code=z.parent_code where m.parent_code=c and z.kind='lesson' and z.state<>'archived'),'sources',(select coalesce(jsonb_agg(to_jsonb(l)-'note'||jsonb_build_object('source',aa_safe(z))),'[]') from aa_source_links l join aa_nodes z on z.code=l.source_code where l.target_code=c and l.visibility in ('public','student') and l.usage not in ('methodological','internal') and aa_source_visible(z)),'enrollment',(select to_jsonb(z) from aa_enrollments z where user_id=p_actor and course_code=c),'progress',aa_course_progress(p_actor,c),'prerequisites',(select coalesce(jsonb_agg(requires_code),'[]') from aa_prerequisites where course_code=c),'eligible',aa_eligible(p_actor,c),'assessments',(select coalesce(jsonb_agg(jsonb_build_object('code',z.code,'kind',z.kind,'title',z.title,'parent_code',z.parent_code,'state',z.state,'data',jsonb_build_object('kind',z.data->>'kind','rubric_code',z.data->>'rubric_code')) order by z.position),'[]') from aa_nodes z where z.parent_code=c and z.kind='assessment' and z.state<>'archived')); 
 end if;
 if p_action='enroll' then
  if n.kind<>'course' then raise exception 'academy_not_found'; end if;
  if n.state='published' and not aa_eligible(p_actor,c) then raise exception 'academy_prerequisites_required'; end if;
  insert into aa_enrollments values(p_actor,c,case when n.state='published' then 'active' else 'waiting' end,now()) on conflict(user_id,course_code) do update set state=excluded.state returning to_jsonb(aa_enrollments) into result; return result;
 end if;
 if p_action in ('lesson','complete','quiz_start','submission_save') then
  if not editor and not aa_can_study(p_actor,v_code) then raise exception 'academy_access_forbidden'; end if;
 end if;
 if p_action='lesson' then
  if n.kind='assessment' then
   return jsonb_build_object('lesson',aa_safe(n),'blocks',case when nullif(n.data->>'instructions','') is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('type','markdown','body',n.data->>'instructions')) end,'sources','[]'::jsonb,'assessment',jsonb_build_object('code',n.code,'kind',n.data->>'kind','passing_score',coalesce(n.data->'passing_score','70'),'rubric_code',n.data->>'rubric_code','instructions',n.data->'instructions'),'progress',null,'submissions',(select coalesce(jsonb_agg(to_jsonb(z)||jsonb_build_object('reviews',(select coalesce(jsonb_agg(to_jsonb(rv)),'[]') from aa_reviews rv where rv.submission_id=z.id))),'[]') from aa_submissions z where z.user_id=p_actor and z.assessment_code=v_code));
  end if;
  if n.kind<>'lesson' then raise exception 'academy_not_found'; end if;
  return jsonb_build_object('lesson',aa_safe(n,true),'blocks',aa_public_json(coalesce(n.data->'content_blocks',n.data->'blocks',n.data->'contentBlocks','[]')),'sources',(select coalesce(jsonb_agg(to_jsonb(l)-'note'||jsonb_build_object('source',aa_safe(z))),'[]') from aa_source_links l join aa_nodes z on z.code=l.source_code where l.target_code=v_code and l.visibility in ('public','student') and l.usage not in ('methodological','internal') and aa_source_visible(z)),'assessment',(select jsonb_build_object('code',z.code,'kind',z.data->>'kind','passing_score',coalesce(z.data->'passing_score','70'),'rubric_code',z.data->>'rubric_code','instructions',z.data->'instructions') from aa_nodes z where parent_code=v_code and kind='assessment' and state='published' order by position limit 1),'progress',(select to_jsonb(z) from aa_progress z where user_id=p_actor and lesson_code=v_code),'submissions',(select coalesce(jsonb_agg(to_jsonb(z)||jsonb_build_object('reviews',(select coalesce(jsonb_agg(to_jsonb(rv)),'[]') from aa_reviews rv where rv.submission_id=z.id))),'[]') from aa_submissions z join aa_nodes a on a.code=z.assessment_code where z.user_id=p_actor and a.parent_code=v_code))||aa_neighbors(v_code);
 end if;
 if p_action='complete' then
  if not aa_can_study(p_actor,v_code) then raise exception 'academy_access_forbidden'; end if;
  if n.kind<>'lesson' or not aa_has_content(n.data) or (coalesce(n.data->>'format',n.data->>'primary_format','') not in ('microlecture','resource','guided_demo') and not exists(select 1 from aa_nodes where parent_code=v_code and kind='assessment' and state='published')) then raise exception 'academy_assessment_required'; end if;
  if exists(select 1 from aa_nodes z where z.parent_code=v_code and z.kind='assessment' and z.state='published' and not exists(select 1 from aa_attempts t where t.user_id=p_actor and t.assessment_code=z.code and t.assessment_version=z.version and t.passed) and not exists(select 1 from aa_submissions ss where ss.user_id=p_actor and ss.assessment_code=z.code and ss.assessment_version=z.version and ss.state='passed')) then raise exception 'academy_assessment_required'; end if;
  insert into aa_progress values(p_actor,v_code,now()) on conflict do nothing; return aa_course_progress(p_actor,c);
 end if;
 if p_action='quiz_start' then
  if n.kind<>'assessment' or n.data->>'kind' not in ('quiz','placement') then raise exception 'academy_assessment_invalid'; end if;
  select * into attempt from aa_attempts where user_id=p_actor and assessment_code=v_code and submitted_at is null and assessment_version=n.version order by id desc limit 1;
  if not found then
   if (select count(*) from aa_attempts where user_id=p_actor and assessment_code=v_code)>=coalesce((n.data->>'max_attempts')::integer,3) then raise exception 'academy_attempt_limit'; end if;
   insert into aa_attempts(user_id,assessment_code,assessment_version,snapshot) values(p_actor,v_code,n.version,n.data) returning * into attempt;
  end if;
  return jsonb_build_object('id',attempt.id,'assessment_code',v_code,'questions',(select jsonb_agg(jsonb_build_object('id',v->>'id','type',coalesce(v->>'type','mcq'),'prompt',v->>'prompt','choices',v->'choices')) from jsonb_array_elements(attempt.snapshot->'questions') v),'passing_score',coalesce(attempt.snapshot->'passing_score','70'));
 end if;
 if p_action='quiz_submit' then
  select * into attempt from aa_attempts where id=(p_payload->>'attempt_id')::bigint and user_id=p_actor for update;
  if not found then raise exception 'academy_not_found'; end if;
  if not aa_can_study(p_actor,attempt.assessment_code) then raise exception 'academy_access_forbidden'; end if;
  if attempt.submitted_at is not null then return jsonb_build_object('id',attempt.id,'score',attempt.score,'passed',attempt.passed); end if;
  if jsonb_typeof(p_payload->'answers') is distinct from 'array' or jsonb_array_length(p_payload->'answers')<>jsonb_array_length(attempt.snapshot->'questions') then raise exception 'academy_answers_invalid'; end if;
  score:=aa_quiz_score(attempt.snapshot->'questions',p_payload->'answers');passed:=score>=coalesce((attempt.snapshot->>'passing_score')::numeric,70);
  update aa_attempts set answers=p_payload->'answers',score=academy.score,passed=academy.passed,submitted_at=now() where id=attempt.id;
  return jsonb_build_object('id',attempt.id,'score',score,'passed',passed);
 end if;
 if p_action='submission_save' then
  if n.kind<>'assessment' or n.data->>'kind' not in ('assignment','capstone') then raise exception 'academy_assessment_invalid'; end if;
  if jsonb_typeof(p_payload->'artifact') is distinct from 'object' or length((p_payload->'artifact')::text)>100000 or (p_payload->'artifact'->>'url' is not null and p_payload->'artifact'->>'url' !~ '^https://[^[:space:]]+$') then raise exception 'academy_artifact_invalid'; end if;
  select * into s from aa_submissions where user_id=p_actor and assessment_code=v_code order by version desc limit 1 for update;
  if s.state='draft' then update aa_submissions set artifact=p_payload->'artifact' where id=s.id returning * into s;
  else
   if s.state='submitted' then raise exception 'academy_review_pending'; end if;
   select data||jsonb_build_object('code',aa_nodes.code,'version',version) into rubric from aa_nodes where aa_nodes.code=n.data->>'rubric_code' and kind='rubric' and state='published';
   if rubric is null then raise exception 'academy_rubric_required'; end if;
   insert into aa_submissions(user_id,assessment_code,assessment_version,version,state,artifact,rubric_snapshot) values(p_actor,v_code,n.version,coalesce(s.version,0)+1,'draft',p_payload->'artifact',rubric) returning * into s;
  end if; return to_jsonb(s);
 end if;
 if p_action='submission_submit' then
  select * into s from aa_submissions where id=(p_payload->>'submission_id')::bigint and user_id=p_actor and state='draft' for update;
  if not found then raise exception 'academy_not_found'; end if;
  if not aa_can_study(p_actor,s.assessment_code) then raise exception 'academy_access_forbidden'; end if;
  update aa_submissions set state='submitted',submitted_at=now() where id=(p_payload->>'submission_id')::bigint and user_id=p_actor and state='draft' returning * into s;
  if not found then raise exception 'academy_not_found'; end if; return to_jsonb(s);
 end if;
 if p_action='review' then
  if not instructor then raise exception 'academy_forbidden'; end if;
  select * into s from aa_submissions where id=(p_payload->>'submission_id')::bigint and state='submitted' for update;
  if not found then raise exception 'academy_not_found'; end if;
  if s.user_id=p_actor or (not adm and s.assigned_to is distinct from p_actor) then raise exception 'academy_forbidden'; end if;
  decision:=p_payload->>'decision'; if decision not in ('passed','failed','needs_revision') or length(coalesce(p_payload->>'feedback',''))=0 then raise exception 'academy_review_invalid'; end if;
  score:=0; total:=0; passed:=true;
  for q in select value from jsonb_array_elements(coalesce(s.rubric_snapshot->'criteria','[]')) loop
   expected:=coalesce((q->>'max_score')::integer,100); x:=p_payload->'scores'->(q->>'code');
   if x is null or jsonb_typeof(x)<>'number' or (x::text)::numeric<0 or (x::text)::numeric>expected then raise exception 'academy_scores_invalid'; end if;
   score:=score+(x::text)::numeric; total:=total+expected;
   if coalesce((q->>'critical')::boolean,false) and (x::text)::numeric<expected then passed:=false; end if;
  end loop;
  if total=0 then raise exception 'academy_rubric_required'; end if;
  for x in select value from jsonb_array_elements(coalesce(s.rubric_snapshot->'critical_gates','[]')) loop if coalesce((p_payload->'gates'->>(x#>>'{}'))::boolean,false)=false then passed:=false; end if; end loop;
  score:=round(100*score/total); if decision='passed' and (score<70 or not passed) then raise exception 'academy_critical_gate_failed'; end if;
  insert into aa_reviews(submission_id,reviewer_id,scores,feedback,decision,score) values(s.id,p_actor,jsonb_build_object('criteria',p_payload->'scores','gates',p_payload->'gates'),p_payload->>'feedback',decision,score) returning to_jsonb(aa_reviews) into result;
  update aa_submissions set state=decision where id=s.id; insert into aa_audit(actor_id,action,object_code,after_json) values(p_actor,'review',s.id::text,result); return result;
 end if;
 if p_action='placement' then
  if p_payload->>'placement_id' is not null then
   if not adm or p_payload->>'state' not in ('passed','failed') or length(coalesce(p_payload->>'reason',''))=0 then raise exception 'academy_forbidden'; end if;
   update aa_placements set state=p_payload->>'state',reviewer_id=p_actor,reason=p_payload->>'reason' where id=(p_payload->>'placement_id')::bigint and user_id<>p_actor and state='pending' returning to_jsonb(aa_placements) into result;
   if result is null then raise exception 'academy_not_found'; end if;
   insert into aa_audit(actor_id,action,after_json) values(p_actor,'placement_review',result); return result;
  end if;
  if p_payload->>'evidence_url' !~ '^https://[^[:space:]]+$' or p_payload->>'evidence_url' is null or not exists(select 1 from aa_nodes where aa_nodes.code=v_code and kind='course') then raise exception 'academy_evidence_required'; end if;
  insert into aa_placements(user_id,course_code,evidence_url) values(p_actor,v_code,p_payload->>'evidence_url') returning to_jsonb(aa_placements) into result; return result;
 end if;
 if p_action='certificate' then
  if n.kind<>'course' or n.state<>'published' or not aa_eligible(p_actor,c) or not coalesce((aa_course_progress(p_actor,c)->>'all_required_passed')::boolean,false) or not exists(select 1 from aa_submissions ss join aa_nodes a on a.code=ss.assessment_code join aa_reviews rv on rv.submission_id=ss.id where ss.user_id=p_actor and aa_course(a.code)=c and a.data->>'kind'='capstone' and ss.state='passed' and rv.score>=70) then raise exception 'academy_completion_required'; end if;
  insert into aa_certificates(code,user_id,course_code) values('AA-'||replace(gen_random_uuid()::text,'-',''),p_actor,c) on conflict(user_id,course_code) do nothing;
  return (select to_jsonb(z) from aa_certificates z where user_id=p_actor and course_code=c);
 end if;
 if p_action='admin_save' then
  e:=p_payload->'entity'; select * into oldn from aa_nodes where aa_nodes.code=e->>'code' for update;
  expected:=coalesce((p_payload->>'expected_version')::integer,0);
  if coalesce(oldn.version,0)<>expected then raise exception 'academy_version_conflict'; end if;
  if oldn.code is not null and oldn.kind<>e->>'kind' then raise exception 'academy_kind_immutable'; end if;
  if oldn.code is null then
   insert into aa_nodes(code,kind,parent_code,title,position,state,version,data,seed_managed) values(e->>'code',e->>'kind',nullif(e->>'parent_code',''),e->>'title',coalesce((e->>'position')::integer,0),coalesce(e->>'state','draft'),1,coalesce(e->'data','{}'),false) returning * into n;
  else
   update aa_nodes set parent_code=nullif(e->>'parent_code',''),title=e->>'title',position=coalesce((e->>'position')::integer,0),state=coalesce(e->>'state','draft'),version=version+1,data=coalesce(e->'data','{}'),seed_managed=false,updated_at=now() where aa_nodes.code=oldn.code returning * into n;
  end if;
  if p_payload ? 'links' then
   for x in select value from jsonb_array_elements(p_payload->'links') loop
    c:=coalesce(nullif(x->>'target_code',''),n.code);
    if not exists(select 1 from aa_nodes src where src.code=x->>'source_code' and src.kind='source') or not exists(select 1 from aa_nodes target where target.code=c and target.kind in ('lesson','module','course')) then raise exception 'academy_source_link_invalid'; end if;
    insert into aa_source_links(source_code,target_code,usage,visibility,start_seconds,end_seconds,note,seed_managed) values(x->>'source_code',c,coalesce(x->>'usage','supplementary'),coalesce(x->>'visibility','internal'),coalesce((x->>'start_seconds')::integer,0),(x->>'end_seconds')::integer,x->>'note',false) on conflict(source_code,target_code,usage,start_seconds) do update set visibility=excluded.visibility,end_seconds=excluded.end_seconds,note=excluded.note,seed_managed=false;
   end loop;
  end if;
  insert into aa_audit(actor_id,action,object_code,before_json,after_json) values(p_actor,'admin_save',n.code,to_jsonb(oldn),to_jsonb(n)); return to_jsonb(n);
 end if;
 if p_action='admin_reorder' then
  if jsonb_typeof(p_payload->'codes') is distinct from 'array' or jsonb_array_length(p_payload->'codes')=0 then raise exception 'academy_reorder_invalid'; end if;
  if (select count(distinct value) from jsonb_array_elements_text(p_payload->'codes'))<>jsonb_array_length(p_payload->'codes') or (select count(*) from aa_nodes where parent_code is not distinct from (p_payload->>'parent_code') and kind=p_payload->>'kind')<>jsonb_array_length(p_payload->'codes') then raise exception 'academy_reorder_invalid'; end if;
  for x in select value from jsonb_array_elements(p_payload->'codes') loop
   update aa_nodes set position=countn,version=version+1,seed_managed=false,updated_at=now() where aa_nodes.code=x#>>'{}' and parent_code is not distinct from (p_payload->>'parent_code') and kind=p_payload->>'kind'; if not found then raise exception 'academy_reorder_invalid'; end if; countn:=countn+1;
  end loop;
  insert into aa_audit(actor_id,action,after_json) values(p_actor,'admin_reorder',p_payload); return jsonb_build_object('updated',countn);
 end if;
 if p_action='admin_import' then
  dry:=coalesce((p_payload->>'dry_run')::boolean,true);
  if jsonb_typeof(p_payload->'entities') is distinct from 'array' then raise exception 'academy_import_invalid'; end if;
  -- Roll back the exact same validation and writes for preview, using a subtransaction.
  begin
   for e in select value from jsonb_array_elements(p_payload->'entities') order by case value->>'kind' when 'direction' then 0 when 'course' then 1 when 'module' then 2 when 'lesson' then 3 when 'source' then 4 when 'rubric' then 5 else 6 end loop
    if e->>'state' not in ('outline','draft') then raise exception 'academy_import_unpublished_required'; end if;
    insert into aa_nodes(code,kind,parent_code,title,position,state,data,seed_managed) values(e->>'code',e->>'kind',nullif(e->>'parent_code',''),e->>'title',coalesce((e->>'position')::integer,0),e->>'state',coalesce(e->'data','{}'),true)
    on conflict(code) do update set title=excluded.title,position=excluded.position,parent_code=excluded.parent_code,data=excluded.data,version=aa_nodes.version+1,updated_at=now() where aa_nodes.seed_managed and aa_nodes.kind=excluded.kind and aa_nodes.state in ('outline','draft') and (aa_nodes.title,aa_nodes.position,aa_nodes.parent_code,aa_nodes.data) is distinct from (excluded.title,excluded.position,excluded.parent_code,excluded.data);
    countn:=countn+1;
   end loop;
   for e in select value from jsonb_array_elements(coalesce(p_payload->'links','[]')) loop
    if not exists(select 1 from aa_nodes where aa_nodes.code=e->>'source_code' and kind='source') or not exists(select 1 from aa_nodes where aa_nodes.code=e->>'target_code' and kind in ('lesson','course','module')) then raise exception 'academy_source_link_invalid'; end if;
    insert into aa_source_links(source_code,target_code,usage,visibility,start_seconds,end_seconds,note,seed_managed) values(e->>'source_code',e->>'target_code',coalesce(e->>'usage','supplementary'),'internal',coalesce((e->>'start_seconds')::integer,0),(e->>'end_seconds')::integer,e->>'note',true) on conflict do nothing;
   end loop;
   for e in select value from jsonb_array_elements(coalesce(p_payload->'prerequisites','[]')) loop
    if not exists(select 1 from aa_nodes where aa_nodes.code=e->>'course_code' and kind='course') or not exists(select 1 from aa_nodes where aa_nodes.code=e->>'requires_code' and kind='course') then raise exception 'academy_prerequisite_invalid'; end if;
    insert into aa_prerequisites values(e->>'course_code',e->>'requires_code') on conflict do nothing;
   end loop;
   if exists(with recursive walk as(select course_code,requires_code,array[course_code] path,false cycle from aa_prerequisites union all select w.course_code,p.requires_code,w.path||p.course_code,p.requires_code=any(w.path) from walk w join aa_prerequisites p on p.course_code=w.requires_code where not w.cycle) select 1 from walk where cycle) then raise exception 'academy_prerequisite_cycle'; end if;
   set constraints all immediate;
   set constraints all deferred;
   if dry then raise exception 'academy_preview_rollback'; end if;
  exception when raise_exception then if sqlerrm<>'academy_preview_rollback' then raise; end if;
  end;
  result:=jsonb_build_object('dry_run',dry,'entities',countn,'links',jsonb_array_length(coalesce(p_payload->'links','[]')));
  if not dry then insert into aa_audit(actor_id,action,after_json) values(p_actor,'admin_import',result); end if; return result;
 end if;
 raise exception 'academy_unknown_action';
end $$;

-- The Edge Function alone uses service_role after Telegram verification.
do $$ declare t text; f record; begin
 foreach t in array array['aa_nodes','aa_source_links','aa_prerequisites','aa_roles','aa_enrollments','aa_progress','aa_attempts','aa_submissions','aa_reviews','aa_placements','aa_certificates','aa_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and (proname like 'aa_%' or proname='academy_action') loop
  execute format('revoke all on function %s from public, anon, authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
grant usage,select on sequence public.aa_attempts_id_seq,public.aa_submissions_id_seq,public.aa_reviews_id_seq,public.aa_placements_id_seq,public.aa_audit_id_seq to service_role;












