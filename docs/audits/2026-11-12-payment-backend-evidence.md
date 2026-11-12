# Payment/backend evidence review, 2026-11-12

Scope: source review at `5e827e1956770b5781c369cf9931a17afefce793`, local API regression tests. No production writes, transactions, secret reads or database migrations were performed.

## Fixed: unavailable data must not look like zero

In `supabase/functions/api/index.ts`, `adminAnalytics` ignored a failed `payments` read and returned zero Stars and zero payments. `adminCourses` similarly ignored failures reading courses, access or pending requests and could show an empty list or zero students. These required reads now return the existing HTTP 500 `db` response, rather than a false successful summary. Legitimately empty payment results still return zero. Optional discovery analytics retains its explicit unavailable fallback.

Regression evidence: `npm run test:api` passed 117/117 checks after the fix. Before the fix the four new failure-path checks failed (113/117 passed). This executes the API against test doubles; it is not a live payment/refund test. No schema change is needed for this patch. Publishing frontend assets alone does not deploy this Edge Function fix.

## Existing safeguards found in source, not verified in production

- `supabase/migrations/20261030030734_payment_purchase_intents.sql` and `docs/payment-recovery.md`: durable purchase intents/refund work, concurrency control and independent access grants; recovery requires a separately configured scheduler.
- `supabase/migrations/20261111231000_payment_reliability.sql`: independent Advent grants and original course identity for new reward codes. Historical repair must not infer course identity from today's mutable reward configuration.
- `supabase/migrations/20261030031554_admin_payment_search.sql`: dedicated administrative payment query.
- `scripts/verify-recovery.mjs`: local snapshot consistency comparator. Its `full_restore_proven: false` is deliberate. Passing it does not prove an available, recent or restorable production backup.

## Still unverified, do not report as complete

This review did not establish which migration versions are applied in production, which API revision is deployed, whether the refund scheduler runs, pending/failed queue health, backup configuration/age or successful restoration. Repository files and passing frontend deployment do not establish those facts.

Next evidence pass should use authorized read-only access to the exact production project: migration version ledger; deployed API revision; scheduler enabled state and schedule (not secret-bearing command values); aggregate queue status; provider backup availability/retention. A restore drill belongs in an isolated approved environment, with recorded row/asset integrity checks, not the production database. Do not collect patient/user data, tokens or payment identifiers for this checklist.

## Remaining product risks

`adminCourseDelete` physically deletes a course; reviewing cascade behavior and a reversible archival design remains separate work. Also, the current Stars summary is not a full accounting reconciliation: this patch only prevents database errors being presented as zeros. Large-volume completeness and payment/refund status semantics require their own scoped tests and aggregation design.
