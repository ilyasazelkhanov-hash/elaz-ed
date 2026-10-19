# Master API

Production logic lives in `supabase/functions/_shared/`; `server/*.ts` re-export the same portable modules for Node 24 tests and local tooling. The Edge entrypoint imports only files inside `supabase/functions/`, so local and deployed bundles use the same code. Storage and transactions always use PostgreSQL/Supabase; there is no in-memory production repository.

## Provisioning and deployment

Use a separate Supabase project per client app. Apply `supabase/migrations/20261016195015_az_master.sql` once after any OG migrations 001–011. It adds only `az_` tables/functions plus the private `az-private` storage bucket. It never changes OG users or other OG domain tables. The migration is transactional. New table RLS denies direct anon/authenticated access; all `az_` function execution is explicitly revoked from PUBLIC/anon/authenticated and granted to `service_role`. Functions are SECURITY INVOKER and use a fixed search path.

Configure these secrets in the client's Edge environment:

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Canonical HTTPS frontend origin; no trailing path |
| `BOT_TOKEN` | Client's own bot token |
| `ADMIN_TELEGRAM_IDS` | Comma-separated verified Telegram owner IDs; do not use OIDC `sub` |
| `SUPABASE_URL` | Client's project URL |
| `SUPABASE_SECRET_KEY` | Server secret API key; legacy `SUPABASE_SERVICE_ROLE_KEY` also supported |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | BotFather Login Widget credentials, RS256 signing |
| `ALLOWED_ORIGINS` | Optional comma-separated additional frontend origins for Telegram requests |
| `WEBHOOK_SECRET` | Random Telegram webhook secret token |
| `CRON_SECRET` | Separate random bearer token for notification workers |

With the CLI installed, `supabase functions deploy master-api --use-api` deploys the function without Docker. `supabase/config.toml` deliberately disables platform JWT verification: the handler verifies Telegram initData, OIDC cookies, webhook secret or cron secret for each protected route. Never deploy a handler that omits these checks. Keep secrets exclusively in server environment settings.

Reverse proxy `/api/*` on the frontend origin to `/functions/v1/master-api/*` on the client's Supabase project. Preserve method, body, `Cookie`, `Origin`, `X-CSRF-Token`, response `Set-Cookie` and `Location`; never cache `/api`. Register `https://CLIENT/api/v1/auth/callback` in BotFather. Direct Edge URLs work for Mini App requests; browser admin cookies require this same-origin proxy.

Initial owner provisioning needs a fresh signed Telegram Mini App initData for an ID in `ADMIN_TELEGRAM_IDS`. Set `AZ_API_URL=https://CLIENT/api` and `AZ_INIT_DATA` in the local process environment, then run:

```powershell
node server/provision.mjs --root CLIENT_FOLDER
```

The script loads the client's `app.config.json`, `brand.config.json` and private `content/catalog.json`, filters entities to enabled modules, and POSTs to `/v1/provision`. It neither uses nor prints a service key. Pass `--rules rules.json` to provision settings such as `{ "channelId": "-100123", "moderatePosts": true }`. Re-provisioning is an authenticated owner operation and upserts supplied entities. Keep answer-bearing catalog JSON outside public frontend assets. Do not call provisioning on each page load.

## Routes and contracts

All paths below are under `/api/v1` through the proxy, or `/functions/v1/master-api/v1` directly.

| Route | Authentication and result |
| --- | --- |
| `POST /dispatch` | `{auth?, action, payload:{}}`; returns `{snapshot,result?}`; Telegram auth is raw initData |
| `GET /auth/login` | Redirects to Telegram Authorization Code + S256 PKCE; stores short-lived state/nonce/verifier in DB and a browser-binding HttpOnly cookie |
| `GET /auth/callback` | Consumes state once, exchanges code, verifies Telegram JWKS RS256/issuer/audience/iat/exp/nonce, uses signed profile `id`, then creates an eight-hour session |
| `GET /auth/session` | Returns `{csrf,userId}` for current cookie session |
| `POST /auth/logout` | Revokes the session and clears cookies; requires origin and CSRF for cookie auth |
| `POST /provision` | Verified owner only; `{auth,config,brand,entities,rules}` |
| `GET /certificates/CODE` | Public minimal `{name,course,date}` only |
| `POST /webhook` | `X-Telegram-Bot-Api-Secret-Token`; transactional inbox dedupe/payment validation |
| `POST /jobs/run` | `Authorization: Bearer CRON_SECRET`; claims up to 20 durable jobs, awaits bounded parallel Telegram delivery and persists results |
| `GET /health` | `{ok:true,version:"1"}`; does not probe external services |

Standard errors are `{error:"stable_code"}`. No request credentials, payment payloads or upstream SQL/Telegram error details are logged. Cookie mutations require `Origin: APP_URL_ORIGIN` and `X-CSRF-Token` from `/auth/session`. Session cookies are Secure, HttpOnly, SameSite=Lax and host-only. The CSRF cookie is intentionally readable; the DB stores hashes of both tokens. Owner/admin/editor/campaign manager/moderator/mentor/analyst/cashier can use browser sessions; ordinary members use Telegram Mini Apps.

Snapshots filter personal records to the caller; owner/admin receive administrative records, mentor receives homework/progress, cashier receives operational orders/bookings, moderator receives pending posts. Member lists/audit are owner/admin-only. Answer keys/explanations are removed from member entity snapshots and `hasQuiz` is added. Lesson bodies and private file URLs remain inaccessible unless publication, audience/team, payment, ordered prerequisite and drip checks pass. Free-course drip starts at first bootstrap after publication; paid drip starts at payment.

## Domain rules

- Default role is `member`. Every action checks fresh DB roles and enabled modules. Owner/admin have broad access; editors manage content/learning/commerce, campaign managers campaigns/loyalty/events, moderators community, mentors homework, cashiers operational redemption/checkin/orders/visits. Only owners can assign owner/admin role or cashier `pointIds`; use `admin.member.update` with optional `pointIds: ["shop-id"]` to assign cashier scope.
- `daily.claim` uses app IANA timezone, grants 20 XP/10 points once per local date, maintains streak, consumes a freeze for one skipped day and awards a capped freeze each seventh day. Article/simple lesson completion grants 20 XP/5 points once. Questions require `quiz.start`/`quiz.answer`, never `content.complete`.
- Quiz attempts freeze question/answer data at start, expire in one hour, require sequential answers and bind to one user/entity. An answer is fixed before its correctness/explanation is returned; replay cannot change it or earn twice. One rewarded completion per entity, with 10 XP/5 points per correct answer. Campaign mission quizzes use these same endpoints.
- Non-quiz games require `game.start` and its `sessionId` before `campaign.open`. Server validates campaign dates, local day, entity/campaign/game/session owner binding, minimum elapsed duration and ten-minute expiry. Outcome is generated by PostgreSQL; claimed client score has no effect on prize. Wheel/scratch reveal outcome at start. Prizes are fixed server-controlled 5–25 point participation outcomes. `minSeconds` is returned (1; memory/puzzle 3; arcade/runner/catch 10). Model each calendar door as a separate mission for one rewarded opening per mission. Campaign `game:"mixed"` can select a supported game.
- Reward redemption locks stock and balances, creates one expiring coupon per user/reward and deducts `data.pointsCost`. Cashier coupon/checkin scope comes from DB `point_ids` and reward/event allowed points. Coupon redemption and visits are idempotent (one visit stamp per member/local date).
- Orders lock products in deterministic order, use server variant prices and atomically reserve capacity. Cancellation restores stock once; invalid status transitions are rejected. Orders are physical product/service reservations; digital course access only comes from Stars.
- Bookings lock the event to serialize capacity. Overflow is waitlisted; cancellation promotes the oldest waitlisted booking atomically. Checkin is cashier-scoped and one-time.
- Posts start pending by default; three distinct reports return a published post to moderation. Likes toggle, poll votes are immutable, referral credits happen once per joining account, homework is resubmittable until approval and certificates require all published course lessons and required homework approval.
- Stars invoices snapshot course price in XTR, precheckout validates buyer/amount/currency and reserves checkout, successful payments grant access, duplicate updates/charges cannot double-grant, refunds revoke the matching access. Register Telegram webhook to `/webhook` with `secret_token=WEBHOOK_SECRET` and request `pre_checkout_query` plus `message` updates. Owner/admin initiate durable refunds with admin.refund; incoming Telegram refund updates reconcile the same operation.
- Storage upload results are `{fileId,path,url,token?}` for the private 10 MiB bucket. Upload using the returned signed URL; submit `fileId` in homework or link `data.fileId` in a content entity. `file.download-url {fileId}` authorizes ownership/mentor or entity access before signing a five-minute URL. Supabase signed-upload tokens use the Storage service's expiry semantics.
- Notification queue supports segments `all`, `employees`, `members`, `team:ID`, `active`, `inactive`. It checks opt-out/quiet hours, leases with tokens and SKIP LOCKED, retries with exponential backoff/Telegram retry_after and marks failures dead after five attempts. Equal quiet hours disables quiet time. Configure an external scheduler to call `/jobs/run` each minute using `CRON_SECRET`. Delivery is at least once; a crash after Telegram accepts a message and before DB acknowledgement can duplicate delivery because Telegram has no sendMessage idempotency key.

## Verification

```powershell
node --test tests/server.test.mjs tests/database.test.mjs
```

The tests use actual PostgreSQL compiled to WASM via PGlite for SQL, privilege checks and transaction rollback, plus real WebCrypto HMAC/RSA verification and controlled HTTP boundary tests. They do not contact Telegram, Supabase cloud or deploy. See `docs/BACKEND-REPORT.md` for measured scope and limitations.

References: [Telegram initData](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app), [Telegram OIDC](https://core.telegram.org/bots/telegram-login), [Telegram Stars](https://core.telegram.org/bots/payments-stars), [Supabase function authentication](https://supabase.com/docs/guides/functions/auth).

## Integration and order additions

POST /integrations/events uses timestamped HMAC-SHA256, a durable deduplicated inbox and four typed event kinds. See docs/INTEGRATION-EVENTS.md. order.create requires a UUID requestId; preserve it across a retry of the same items/note/brief. Reusing it with changed input fails idempotency_conflict. Service data.briefFields are validated before reservation and stored as labelled order notes.

Current secret key environments SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY and managed SUPABASE_SECRET_KEYS are supported. Browser OIDC needs a same-origin proxy; API_PUBLIC_PATH controls the callback prefix, ADMIN_RETURN_PATH its landing page.
