# Server implementation brief
Read first: this is the server package's requirements. Implement only `supabase/`, `server/`, `tests/server*` and `tests/database*` inside this independent master. Do not edit frontend, config, scripts, package.json, or OG files. Do not spawn agents or commit. Other work is in progress in the same folder.

Shared contracts: `src/platform/contracts.ts`, registry/config: `src/platform/config.ts`. Target Deno Supabase Edge Function `master-api`, modular portable server TypeScript, local Node 24 tests. Public production API: POST `{ auth?: string, action: string, payload: Data }` to `/functions/v1/master-api/v1/dispatch`. `bootstrap` returns `{ snapshot: Snapshot }`; every action returns `{ snapshot, result? }`. Standard errors `{error: string}`. Data always scoped to authenticated actor; never trust supplied role/user id/XP/points/price.

Implement transactional PostgreSQL schema for generic platform_entities (Entity fields) and domain records shaped like contracts. Isolated DB per app. Existing OG users table exists: namespace new tables with `az_`; own users table `az_members` has Telegram bigint identity as text in API. RLS enabled; deny direct anon/authenticated tables; service-only mutation functions, revoke default PUBLIC function exec. Migration must be safe to apply after existing 001-011 OG migrations; no live DB changes. Config stored server-side (`az_settings` config/brand), loaded from app.config at provisioning via documented seed. Seed endpoint/script only authenticated owner, not public setup.

Actions FRONTEND WILL CALL:
- bootstrap; daily.claim {} -> server daily progression (IANA app timezone), idempotent.
- content.complete {entityId}; favorite.toggle {entityId}; reaction.toggle {entityId}.
- quiz.start {entityId} -> result {attemptId, questions:[{question,options}]}; quiz.answer {attemptId,index,answer} -> result {correct,correctIndex,explain,done,score,gained}. Fix each answer before reveal; one rewarded completion per entity.
- campaign.open {entityId,campaignId,day,game,score?,sessionId?}; game.start {entityId,campaignId,game} -> server round session, server outcome for wheel/scratch; validate round/time, prize not determined by untrusted score.
- reward.claim {entityId}; coupon.redeem {code,pointId} cashier+server point scope, one-time, expires; admin.visit {userId} cashier increments stamp & points server rules.
- order.create {items:[{entityId,quantity,variant}],note}; admin.order.update {orderId,status}.
- event.book {entityId}; event.cancel {entityId}; event.checkin {code,pointId}; locked capacities/waitlist promotion.
- post.create {body,topic}; comment.create {postId,body}; post.like {postId}; post.report {postId}; admin.post.moderate {postId,status}.
- homework.submit {lessonId,body,file}; homework.review {homeworkId,status,feedback}; certificate.issue {courseId} -> result {code}; public verification endpoint with only name/course/date, no private grading.
- poll.vote {entityId,option}; recognition.send {userId,body}; profile.update {notificationOptIn,quietFrom,quietTo,timezone}; referral.claim {code}; notification.read {noticeId}.
- admin.entity.save {entity:Entity}; admin.entity.delete {entityId}; admin.member.update {userId,role,teamId,approved}; admin.points.adjust {userId,delta,reason,ref}; admin.notification.enqueue {title,body,segment}.
- stars.invoice {entityId} -> {link}; Stars webhook validates amount/currency/buyer, repeat & refund logic. Digital course only Stars. Private lesson only for course access, ordered/drip rules from entity data.
- file.upload-url {filename,contentType,purpose} -> signed upload URL; private file access verified via file.download-url.

Implement Telegram initData HMAC, auth_date past/future window, DB RBAC and enabled module checks, channel / invite / employee access. Browser admin Telegram OIDC code+PKCE state/nonce, server JWT validation via Telegram JWKS, verified profile.id (NOT sub) maps Telegram identity, HttpOnly Secure SameSite session, CSRF for cookie mutations; callbacks via same-origin /api reverse proxy. Env APP_URL, BOT_TOKEN, ADMIN_TELEGRAM_IDS, OIDC_CLIENT_ID/SECRET, allowed origins, SUPABASE_URL/server secret. No secret values logged. Webhook signature and inbox dedupe. Durable notification queue with claims/lease/retry/quiet hours/opt out, cron authenticated via secret. No fire-and-forget promise for delivery.

Snapshot: caller-visible entities omit quiz correct/explain until answered, omit private lessons/content unless access, don't return other users' private records. Admin snapshot data conditioned on roles. role member default. Backend must be deployable and testable; do not fake production storage with memory.

Write meaningful Node tests for auth, RBAC, module disabled, quiz secrecy, action validation. Database integration SQL tests/scripts for transactions. You may use local `@electric-sql/pglite` if package install available (coordinate dependency via message); PostgreSQL binaries/docker absent. Prefer PostgreSQL-compatible SQL allowing PGlite tests; extensions optional. Explore official Supabase/Telegram docs as needed. Return short result and report file `docs/BACKEND-REPORT.md` with implemented coverage and exact limitations. Do not claim live Telegram/Postgres verification without evidence.
