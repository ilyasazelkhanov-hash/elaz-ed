begin;
create or replace function public.az_queue_retry(p_actor bigint,p_job_id uuid,p_kind text default 'notification') returns void language plpgsql set search_path=public,pg_temp as $$
begin
 if p_kind='refund' then perform az_require_role(p_actor,array[]::text[]);
 update az_refund_jobs r set status='pending',attempts=0,next_at=now(),lease_token=null,lease_until=null,last_error=null from az_invoices i where r.id=p_job_id and i.id=r.invoice_id and (i.status='paid' or exists(select 1 from az_membership_charges c where c.charge_id=r.charge_id and not c.refunded)) and r.status in ('dead','pending') and (r.lease_until is null or r.lease_until<now());
 elsif p_kind='notification' then perform az_require_role(p_actor,array['campaign_manager']); perform az_require_module('retention');
 update az_notification_jobs j set status='pending',attempts=0,next_at=now(),lease_token=null,lease_until=null,last_error=null from az_members m where j.id=p_job_id and j.user_id=m.id and m.notification_opt_in and j.status in ('dead','pending') and (j.lease_until is null or j.lease_until<now());
 else raise exception 'invalid_queue_kind'; end if;
 if not found then raise exception 'job_not_retryable'; end if;
end $$;

revoke all on function az_queue_retry(bigint,uuid,text) from public,anon,authenticated;
grant execute on function az_queue_retry(bigint,uuid,text) to service_role;
commit;
