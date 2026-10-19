begin;
-- Explicit opt-in gate; generic members audience retains existing semantics.
create or replace function az_can_access(p_actor bigint,p_entity text) returns boolean language plpgsql stable set search_path=public,pg_temp as $$
declare e az_entities;c az_entities;privileged boolean;
begin
 select * into e from az_entities where id=p_entity;
 select role in ('owner','admin') into privileged from az_members where id=p_actor;
 if e.data ? 'earlyAccessPlanId' and not coalesce(privileged,false) then
  if e.module<>'commerce' or not exists(select 1 from az_settings where config->'modules' ? 'commerce') or not exists(select 1 from az_membership_charges where user_id=p_actor and entity_id=e.data->>'earlyAccessPlanId' and not refunded and expires_at>now()) then return false;end if;
 end if;
 if e.kind='lesson' then
  select * into c from az_entities where id=e.data->>'courseId';
  if c.data->>'subscription'='true' and not coalesce(privileged,false) and not exists(select 1 from az_membership_charges where user_id=p_actor and entity_id=c.id and not refunded and expires_at>now()) then return false;end if;
 end if;
 return az_can_access_base(p_actor,p_entity);
end $$;
revoke all on function az_can_access(bigint,text) from public,anon,authenticated;
grant execute on function az_can_access(bigint,text) to service_role;
commit;
