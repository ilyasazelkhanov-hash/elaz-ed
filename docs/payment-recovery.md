# Course payment recovery

Apply `20261030030734_payment_purchase_intents.sql` before deploying the API. No existing migration is edited. The migration retains legacy `course:<course>:<user>` invoice support and backfills independent manual access from existing admin/invite rows and approved requests. An old manual grant that was never persisted anywhere cannot be reconstructed automatically.

The API reuses a server purchase intent and stored Telegram invoice link for 30 minutes. Checkout validation locks the user/course pair and reserves one pre-checkout query for 10 minutes; retries of that same query remain valid. Course publication, current price, actor and existing access are checked in that transaction. Successful payments remain authoritative even if they arrive after the checkout lease expires.

A second distinct charge for an already open course is recorded with `refund_pending=true` and a unique durable job. It never adds another access ground. The webhook immediately attempts those jobs. To recover network failures or a crashed webhook, schedule an external server cron **every minute**:

```http
POST https://PROJECT.supabase.co/functions/v1/api/payment_refunds
x-cron-key: EXISTING_SETTINGS_CRON_KEY
```

Use the existing private `settings.cron_key` also used by `advent_push`. Keep it in the scheduler's secret store. An absent or incorrect key returns 401. This endpoint is for server scheduling; it does not require Telegram user authentication. Configure the Edge Function's existing gateway authentication consistently with the current webhook and advent scheduler.

Workers claim up to 20 jobs with a two-minute lease. Each claim has a unique fencing token. Failed requests retry after 30 seconds, then 60, 120, 240, 480, 960, 1920, and at most 3600 seconds thereafter. A crashed worker is reclaimable after its lease expires. Telegram's `ALREADY_REFUNDED` / `PAYMENT_ALREADY_REFUNDED` response counts as success, covering a successful remote refund followed by a local crash. Completion atomically records the refund, clears pending state, and preserves access backed by another valid charge or a manual grant. Worker response `{completed,failed}` covers that batch; pending jobs remain visible in the admin payment list.

Manual approvals and invite grants use `grant_course_access`. They remain independent of paid access, including when granted after a purchase. Refund notifications reflect whether access remains. The outbox and purchase intents have RLS enabled and are available only to service_role; every new mutation RPC explicitly revokes PUBLIC/anon/authenticated execution.

Local verification:

```powershell
node --experimental-strip-types --test tests/payment-database.test.mjs tests/payment-worker.test.mjs
npm run test:api
```

The database test executes real PostgreSQL SQL in PGlite. It does not connect to or modify a live Supabase project.
