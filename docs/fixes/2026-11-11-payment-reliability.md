# Payment reliability remediation (2026-11-11)

Base audited revision: `d64d5142a581af17b32c0f72aa9de44669f82d0c`.

## What changes

- PAY-1 / TEST-1: Advent grants use the same per-user/course lock as payment/refund and persist `manual_source='advent'`. Payments can no longer erase an independent prize. New prize codes snapshot `granted_course_id` so later reward edits do not change the original grant evidence. Shared RPC fixtures run against the fake and PostgreSQL/PGlite. The fake now uses the real SQL removal predicate, refund completion errors, lease expiry, fencing and backoff.
- PAY-2: `queue_payment_refund` records the administrator's refund intent before contacting Telegram. The targeted immediate attempt and cron share the durable job and lease. Unknown remote outcomes recover with Telegram's `ALREADY_REFUNDED` response. A primary payment pending a manual refund still keeps its access until its refund is confirmed, even if a duplicate charge is refunded meanwhile.
- REL-1: `setSetting` checks persistence errors and clears cached settings; failed saves do not return success.
- PAY-3: Telegram header/body reads have an 8-second deadline and no blind automatic retry. Legacy course/catchup pre-checkout uses one 8-second budget across settings, SQL and acknowledgement and returns non-2xx if acknowledgement fails. Refund batches use four independent lanes and a 60-second deadline, shorter than the two-minute lease.
- Refund notifications remain best-effort after a committed refund. They do not control financial retry and are not a durable notification outbox.

## API contract

`admin_refund` still requires an authenticated administrator and a positive integer payment ID.

- `200 {ok:true}`: refund already committed or the immediate worker completed it.
- `503 {error:'refund_pending'}`: the intent is safely recorded but Telegram, DB finalization, backoff or a concurrent lease prevents confirmed completion. Do not label this as refunded. Show that automatic retry is pending, then refresh `admin_payments`; `refund_pending` is true until confirmation.
- `500 {error:'db'}` before queue acknowledgement: no Telegram call is made by this request. A database/network response can be uncertain; refresh rather than assuming the write failed.
- `404 not_found/user_not_found`, `400 bad_id`, and existing auth errors retain their meaning.

## Deployment gate and order

1. Take a verified recoverable snapshot and inspect existing migration receipts. This work did not read or change production.
2. Review historical Advent prize candidates below against reward configuration history or business records. Old `reward_codes` do not contain immutable course IDs, and administrators can edit reward payloads. The migration safely marks existing `source='advent'` rows but deliberately does not infer hidden/deleted grants from current payloads. Historical repair remains a required operator step for confirmed mappings; ambiguous rows must not be auto-granted.
3. Apply `20261111231000_payment_reliability.sql` transactionally, after the existing payment-intent migration, in an appropriate quiet window. It extends a check constraint, updates access rows, adds the original-prize course snapshot and job reason columns, and replaces service-role RPCs. It does not call Telegram or initiate a refund.
4. Deploy the API, then the frontend's pending-refund presentation. New API requires the two new RPCs. The database migration remains compatible with the prior API, but that API's manual refunds do not gain durability.
5. Verify the existing every-minute `payment_refunds` cron and recent successful runs. A source-code schedule is not proof of a live cron. Check pending job age, retries, `last_error`, expired leases, and webhook delivery errors. Use isolated/staging fixtures before any separately authorized real financial operation.

Read-only historical review query:

```sql
select rc.code, rc.issued_at, rc.user_id, r.id as reward_id,
       r.title, r.payload->>'course_id' as current_course_id,
       c.title as current_course_title, a.source, a.manual_source
from public.reward_codes rc
join public.advent_rewards r on r.id=rc.reward_id and r.kind='course'
left join public.courses c on c.id::text=r.payload->>'course_id'
left join public.course_access a on a.user_id=rc.user_id and a.course_id=c.id
order by rc.issued_at, rc.code;
```

For each historical prize whose original course is confirmed, run a reviewed mapping in a transaction. Do not populate this mapping automatically from the current reward payload. The following template is intentionally empty and makes no changes until verified rows replace it:

```sql
begin;
create temporary table verified_prize_courses(code text primary key, course_id bigint not null) on commit drop;
-- Insert only operator-verified (reward code, original course ID) pairs here.
update public.reward_codes rc set granted_course_id=v.course_id
from verified_prize_courses v join public.courses c on c.id=v.course_id
where rc.code=v.code and rc.granted_course_id is null;
select public.grant_course_access(rc.user_id, rc.granted_course_id, 'advent')
from public.reward_codes rc join verified_prize_courses v on v.code=rc.code
where rc.granted_course_id=v.course_id;
commit;
```

## Rollback and limits

Prefer rolling back API/UI while keeping the forward-compatible schema and preserving queued jobs. Do not drop `payment_refund_jobs`, clear pending flags, or restore pre-refund payment/access snapshots blindly: the remote refund may already have happened. Let an authorized worker reconcile by charge ID; retain leases/backoff and inspect external outcomes. Reverting the independent-grant schema can reintroduce access loss and requires reviewing Advent rows before narrowing the constraint.

PGlite verifies SQL transaction and privilege behavior, not real concurrent PostgreSQL sessions, production ACLs, Telegram settlement, deployed cron or historical content correctness. The checkout deadline change applies to legacy course/catchup invoices; UUID platform invoices continue through the separately owned platform handler.
