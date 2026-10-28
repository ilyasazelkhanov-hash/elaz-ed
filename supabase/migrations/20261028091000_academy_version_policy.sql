-- Attempts are limited per assessment version; immutable drafts retain history.
create or replace function public.aa_base_action(p_actor bigint,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$
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
   and (p_action<>'library' or aa_library_match(z,p_payload)) and (p_payload->>'q' is null or z.title || ' ' || (case when p_action='admin_list' then z.data else aa_safe(z)->'data' end)::text ilike '%'||(p_payload->>'q')||'%') and (p_payload->>'level' is null or z.data->>'level'=p_payload->>'level') and (p_payload->>'direction' is null or z.parent_code=p_payload->>'direction') and (not (p_payload ? 'parent_code') or z.parent_code is not distinct from (p_payload->>'parent_code'));
  select coalesce(jsonb_agg(v),'[]') into result from(select case when p_action='admin_list' then to_jsonb(z) else aa_safe(z) end v from aa_nodes z where
   (case p_action when 'catalog' then z.kind='course' and z.state<>'archived' when 'library' then z.kind='source' and aa_source_visible(z) else (p_payload->>'kind' is null or z.kind=p_payload->>'kind') end)
   and (p_action<>'library' or aa_library_match(z,p_payload)) and (p_payload->>'q' is null or z.title || ' ' || (case when p_action='admin_list' then z.data else aa_safe(z)->'data' end)::text ilike '%'||(p_payload->>'q')||'%') and (p_payload->>'level' is null or z.data->>'level'=p_payload->>'level') and (p_payload->>'direction' is null or z.parent_code=p_payload->>'direction') and (not (p_payload ? 'parent_code') or z.parent_code is not distinct from (p_payload->>'parent_code')) order by position,code offset offn limit lim) t;
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
   if (select count(*) from aa_attempts where user_id=p_actor and assessment_code=v_code and assessment_version=n.version)>=coalesce((n.data->>'max_attempts')::integer,3) then raise exception 'academy_attempt_limit'; end if;
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
  if s.state='draft' and s.assessment_version=n.version then update aa_submissions set artifact=p_payload->'artifact' where id=s.id returning * into s;
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
  if n.kind<>'course' or n.state<>'published' or not aa_eligible(p_actor,c) or not coalesce((aa_course_progress(p_actor,c)->>'all_required_passed')::boolean,false) or not exists(select 1 from aa_submissions ss join aa_nodes a on a.code=ss.assessment_code join aa_reviews rv on rv.submission_id=ss.id where ss.user_id=p_actor and aa_course(a.code)=c and a.data->>'kind'='capstone' and a.state='published' and ss.assessment_version=a.version and ss.state='passed' and rv.score>=70) or exists(select 1 from aa_nodes a where a.kind='assessment' and a.state='published' and a.data->>'kind'='capstone' and aa_course(a.code)=c and not exists(select 1 from aa_submissions ss join aa_reviews rv on rv.submission_id=ss.id where ss.user_id=p_actor and ss.assessment_code=a.code and ss.assessment_version=a.version and ss.state='passed' and rv.score>=70)) then raise exception 'academy_completion_required'; end if;
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

-- Expose only a learner's current-version passed receipt so completion can be retried after reload.
alter function public.academy_action(bigint,text,jsonb) rename to aa_pre_audit_action;
create function public.academy_action(p_actor bigint,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb; receipt jsonb;
begin
 result:=aa_pre_audit_action(p_actor,p_action,p_payload);
 if p_action='lesson' then
  select jsonb_build_object('passed',true,'score',t.score) into receipt from aa_attempts t join aa_nodes a on a.code=t.assessment_code where t.user_id=p_actor and t.passed and t.assessment_version=a.version and a.code=result->'assessment'->>'code' order by t.id desc limit 1;
  result:=result||jsonb_build_object('quiz_result',receipt);
 end if;
 return result;
end $$;
revoke all on function public.aa_pre_audit_action(bigint,text,jsonb),public.academy_action(bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.aa_pre_audit_action(bigint,text,jsonb),public.academy_action(bigint,text,jsonb) to service_role;
