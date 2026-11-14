# Course deletion safety, 2026-11-14

## Source-confirmed risk, not a confirmed production incident

`admin_course_delete` previously physically deleted a course. Migration 006 defines `lessons.course_id` and `payments.course_id` with `ON DELETE SET NULL`. `canRead` intentionally allows standalone materials (`!course_id`). Together those rules could make formerly paid lessons public after administrative course deletion and detach purchase history from its course.

No production database was accessed, mutated, or inspected for affected rows. This change does not repair historical orphan rows. Standalone news/materials remain supported; a blanket denial for null course_id would break them.

## Narrow mitigation

- The API authenticates the administrator, then returns HTTP 409 `course_delete_disabled`, with no deletion or dependent writes.
- The course editor no longer offers permanent course deletion. Its existing save-as-draft operation hides the course from the catalog while retaining course/lesson/purchase/access identities.
- Unpublishing is not access revocation: previously entitled users can still access published lessons by existing links. No payment or entitlement policy changes here.
- Demo follows the same refusal. Old clients receive an actionable error once the API is deployed.

## Deployment boundary

A Vercel frontend deployment removes the button in new UI only. Server protection requires an authorized deployment of `supabase/functions/api`; frontend shipment alone is NOT a completed backend mitigation. There is no SQL migration or production data operation in this patch. Until the API is deployed, an old client can still invoke the previous route.

Verify the deployed route in staging using an administrator and a paid-course fixture: HTTP 409, unchanged IDs/links/purchases/access, other user denied the paid lesson, entitled user allowed, free preview allowed. Also verify a non-admin still receives HTTP 403.

## Rollback

Do not revert the API refusal without a replacement database-level retention/access design: rollback would reopen the source-confirmed risk. A UI rollback does not bypass the API refusal after deployment. To restore course visibility, use the existing publication toggle; nothing needs reconstruction or refund.

## Checks

API regression verifies course/lesson/payment/access data remains identical after refused deletion, including invalid/missing course IDs, and paid/free-preview access semantics remain intact. Existing non-admin route tests remain. Editor render check verifies no deletion action and a reversible hiding explanation. No actual database deletion is used in tests.

## Separate follow-ups

Database read failures currently masked as 403/404 and master webhook timeouts were reported separately; they are not changed by this narrow patch. Historical orphan inventory and a database deletion restriction require a separately reviewed migration and authorized environment.
