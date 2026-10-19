-- Private submissions: only the verified API's service role can reserve or finalize.
create table public.aa_files (
 id uuid primary key default gen_random_uuid(), owner_id bigint not null references public.users(id),
 lesson_code text not null references public.aa_nodes(code), filename text not null,
 path text not null unique, mime text not null check(mime in ('application/pdf','image/png','image/jpeg','image/webp','text/plain','application/zip')),
 expected_size bigint not null check(expected_size between 1 and 10485760), actual_size bigint,
 state text not null default 'pending' check(state in ('pending','ready')), created_at timestamptz not null default now()
);
create index aa_files_owner on public.aa_files(owner_id,lesson_code);
alter table public.aa_files enable row level security;
revoke all on public.aa_files from public,anon,authenticated;
grant select,insert,update on public.aa_files to service_role;

-- A lesson and its child assessment share the same attachment scope. Course capstones retain their own scope.
create function public.aa_file_lesson(p_code text) returns text language sql stable set search_path=public as $$
 select case when n.kind='assessment' and p.kind='lesson' then p.code else n.code end from aa_nodes n left join aa_nodes p on p.code=n.parent_code where n.code=p_code
$$;
create function public.aa_valid_files(p_user bigint,p_lesson text,p_artifact jsonb) returns boolean language plpgsql stable set search_path=public as $$
declare item jsonb; ids jsonb:=p_artifact->'file_ids';
begin
 if ids is null then return true; end if;
 if jsonb_typeof(ids) is distinct from 'array' then return false; end if;
 if jsonb_array_length(ids)>10 then return false; end if;
 if (select count(distinct value) from jsonb_array_elements(ids))<>jsonb_array_length(ids) then return false; end if;
 for item in select value from jsonb_array_elements(ids) loop
  if jsonb_typeof(item)<>'string' then return false; end if;
  if not exists(select 1 from aa_files where id::text=item#>>'{}' and owner_id=p_user and lesson_code=aa_file_lesson(p_lesson) and state='ready') then return false; end if;
 end loop;
 return true;
end $$;
create function public.academy_files_action(p_actor bigint,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$
declare f aa_files; fid uuid; scope text; adm boolean;
begin
 if not exists(select 1 from users where id=p_actor) then raise exception 'academy_auth_required'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'academy_invalid_payload'; end if;
 if p_action='reserve' then
  scope:=aa_file_lesson(p_payload->>'lesson_code');
  if not aa_can_study(p_actor,p_payload->>'lesson_code') or not exists(select 1 from aa_nodes where code=scope and kind in ('lesson','assessment')) then raise exception 'academy_access_forbidden'; end if;
  if length(p_payload->>'filename') not between 1 and 180 or p_payload->>'filename' ~ E'[\\\\/\\x00-\\x1f]' or (p_payload->>'size')::bigint not between 1 and 10485760 then raise exception 'academy_file_invalid'; end if;
  if not (case p_payload->>'mime' when 'application/pdf' then p_payload->>'filename' ~* '\.pdf$' when 'image/png' then p_payload->>'filename' ~* '\.png$' when 'image/jpeg' then p_payload->>'filename' ~* '\.jpe?g$' when 'image/webp' then p_payload->>'filename' ~* '\.webp$' when 'text/plain' then p_payload->>'filename' ~* '\.txt$' when 'application/zip' then p_payload->>'filename' ~* '\.zip$' else false end) then raise exception 'academy_file_invalid'; end if;
  if (select count(*) from aa_files where owner_id=p_actor and created_at>now()-interval '1 hour')>=100 then raise exception 'academy_file_limit'; end if;
  fid:=gen_random_uuid();
  insert into aa_files(id,owner_id,lesson_code,filename,path,mime,expected_size) values(fid,p_actor,scope,p_payload->>'filename',p_actor::text||'/'||fid::text||'.'||lower(substring(p_payload->>'filename' from '[^.]+$')),p_payload->>'mime',(p_payload->>'size')::bigint) returning * into f;
  return to_jsonb(f);
 end if;
 select * into f from aa_files where id::text=p_payload->>'file_id';
 if f.id is null then raise exception 'academy_file_not_found'; end if;
 if p_action='download' then
  select exists(select 1 from settings,jsonb_each(settings.value) v where settings.key='admins' and jsonb_typeof(v.value)='number' and v.value=to_jsonb(p_actor)) into adm;
  if f.state<>'ready' or not (f.owner_id=p_actor or adm or (exists(select 1 from aa_roles where user_id=p_actor and role='instructor') and exists(select 1 from aa_submissions s where s.user_id=f.owner_id and s.assigned_to=p_actor and aa_file_lesson(s.assessment_code)=f.lesson_code and s.artifact->'file_ids' @> jsonb_build_array(f.id::text)))) then raise exception 'academy_file_forbidden'; end if;
 elsif p_action in ('owner','ready') then
  if f.owner_id<>p_actor or not aa_can_study(p_actor,f.lesson_code) then raise exception 'academy_file_forbidden'; end if;
  if p_action='ready' then
   if (p_payload->>'actual_size')::bigint is distinct from f.expected_size or p_payload->>'actual_mime' is distinct from f.mime then raise exception 'academy_file_metadata_mismatch'; end if;
   update aa_files set actual_size=f.expected_size,state='ready' where id=f.id returning * into f;
  end if;
 else raise exception 'academy_unknown_action'; end if;
 return to_jsonb(f);
end $$;

create table public.aa_portfolio (
 submission_id bigint primary key references public.aa_submissions(id), owner_id bigint not null references public.users(id),
 slug text not null unique default replace(gen_random_uuid()::text,'-',''),
 consent_at timestamptz not null, revoked_at timestamptz, artifact jsonb not null, title text not null
);
alter table public.aa_portfolio enable row level security;
revoke all on public.aa_portfolio from public,anon,authenticated;
grant select,insert,update on public.aa_portfolio to service_role;
create function public.academy_portfolio(p_actor bigint,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security invoker set search_path=public as $$
declare s aa_submissions; a jsonb; entry aa_portfolio; u text;
begin
 if p_action='public' then
  select p.* into entry from aa_portfolio p join aa_submissions sub on sub.id=p.submission_id where p.slug=p_payload->>'slug' and p.revoked_at is null and sub.state='passed';
  if entry.submission_id is null then raise exception 'academy_portfolio_not_found'; end if;
  return jsonb_build_object('slug',entry.slug,'title',entry.title,'artifact',entry.artifact,'published_at',entry.consent_at);
 end if;
 if not exists(select 1 from users where id=p_actor) then raise exception 'academy_auth_required'; end if;
 if p_action='list' then return jsonb_build_object('entries',(select coalesce(jsonb_agg(to_jsonb(p) - 'owner_id'),'[]') from aa_portfolio p where p.owner_id=p_actor)); end if;
 select * into s from aa_submissions where id::text=p_payload->>'submission_id' and user_id=p_actor;
 if s.id is null then raise exception 'academy_portfolio_forbidden'; end if;
 if p_action='revoke' then
  update aa_portfolio set revoked_at=now() where submission_id=s.id and owner_id=p_actor;
  return jsonb_build_object('revoked',true);
 elsif p_action='publish' then
  if p_payload->'consent' is distinct from 'true'::jsonb then raise exception 'academy_consent_required'; end if;
  if s.state<>'passed' then raise exception 'academy_review_required'; end if;
  u:=s.artifact->>'url';
  -- Public snapshots accept plain HTTPS addresses only. Queries/fragments can carry signed credentials, including encoded/provider-specific keys.
  if u is not null and (u !~ '^https://[A-Za-z0-9][^[:space:]]*$' or u ~ '^https://[^/]*@' or u ~ '[?#]') then u:=null; end if;
  a:=jsonb_strip_nulls(jsonb_build_object('text',left(s.artifact->>'text',10000),'url',u));
  if coalesce(a->>'text','')='' and coalesce(a->>'url','')='' then raise exception 'academy_portfolio_artifact_required'; end if;
  insert into aa_portfolio(submission_id,owner_id,consent_at,artifact,title) values(s.id,p_actor,now(),a,(select title from aa_nodes where code=s.assessment_code)) on conflict(submission_id) do update set consent_at=now(),revoked_at=null,artifact=excluded.artifact,title=excluded.title returning * into entry;
  return to_jsonb(entry)-'owner_id';
 end if;
 raise exception 'academy_unknown_action';
end $$;
create function public.academy_certificate_public(p_code text) returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
 select jsonb_build_object('code',c.code,'course_title',n.title,'issued_at',c.issued_at,'valid',c.revoked_at is null) into result from aa_certificates c join aa_nodes n on n.code=c.course_code where c.code=p_code;
 if result is null then raise exception 'academy_certificate_not_found'; end if;
 return result;
end $$;
revoke all on function public.aa_file_lesson(text),public.aa_valid_files(bigint,text,jsonb),public.academy_files_action(bigint,text,jsonb),public.academy_portfolio(bigint,text,jsonb),public.academy_certificate_public(text) from public,anon,authenticated;
grant execute on function public.aa_file_lesson(text),public.aa_valid_files(bigint,text,jsonb),public.academy_files_action(bigint,text,jsonb),public.academy_portfolio(bigint,text,jsonb),public.academy_certificate_public(text) to service_role;

-- Storage is optional in local PostgreSQL tests. Never use the public share bucket.
do $$ begin
 if to_regclass('storage.buckets') is not null then
  execute $bucket$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('academy-private','academy-private',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp','text/plain','application/zip']) on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types$bucket$;
 end if;
end $$;
