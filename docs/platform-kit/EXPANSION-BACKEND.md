# Expansion backend — 18 October 2026

Implemented in the independent master only. No commits, deployments, cloud migrations, real Telegram messages or real payments were performed.

## Behavior

- Gifts reserve one physical catalog reward and debit its server-configured bonus price atomically. Actor/request UUID replay returns the same gift; changed reward is rejected. The secret is 64 random hex characters, returned only on sender creation/retry, never in snapshots. Claim locks the gift, rejects sender and expired/cancelled/other-recipient claims, and issues exactly one recipient coupon. Sender cancellation of unclaimed gifts (including expired gifts) restores points and inventory once. Seven-day claim expiry; claimed coupon lasts 30 days. Sender must explicitly reclaim expired gifts with `gift.cancel`.
- Passport stamps require a matching persisted `az_progress` completion; repeated claims do not issue duplicates or extra XP.
- Client projects include milestones, media URLs and document URLs. Snapshots expose projects to the client, assigned manager and owner/admin only. Owner/admin creates/assigns projects; assigned editor updates existing projects without changing owner/manager. Client alone approves a review milestone. Managers cannot manufacture an approved milestone or change its approved content without returning it to review.
- Course `data.subscription=true` creates Telegram Stars invoices with `subscription_period=2592000`. Membership access uses persisted charge expiry, not client flags. Recurring charges dedupe globally; renewal charges retain separate expiries; refunds revoke only their charge; refund-before-success remains refunded. Expired subscriptions cannot open lessons. Existing one-time Stars behavior is preserved. Existing refund worker synchronizes charge revocation.
- `journey.choose` stores an accessible entity or one of `goal:tools`, `goal:content`, `goal:apps`, `goal:services`. Choosing never grants completion/XP.
- `profile.preferences` saves actor-owned fashion sizes (`top`, `bottom`, `shoe`, max 30 characters each) and optional style (max 100 characters). Extra size keys/types are rejected. Payload userId is ignored.
- OG bridge is enabled only for server configuration `id=og-cre8r`. `az_og_progress_summary(p_actor)` returns `{baseXp,platformXp,totalXp,name,photoUrl}` without modifying legacy `public.users`. `az_og_progress_top(p_actor)` returns `{top:[{id,name,photo,xp,streak}],rank}` for subscribed legacy users, adding verified platform members' XP. Snapshot XP and leaderboard use the same totals; optional `me.baseXp/platformXp` retain provenance. Missing original table/member is tolerated. RPCs remain service-only.
- Explicit local demo persists the same gifts/passport/project/journey/preferences/membership flows. `demo.purchase` simulates subscription purchase; production never accepts this action. Catalog includes editable demo plan `club-membership` at 490 Stars. Demo project has review and pending stages.

## Files

- `src/platform/contracts.ts`, `src/platform/demo.ts`, `content/catalog.ts`
- `supabase/functions/_shared/validation.ts`, `supabase/functions/_shared/handler.ts`
- New migration `supabase/migrations/20261018120000_az_expansion.sql` (old migrations unchanged)
- `tests/expansion.test.mjs`

## Checks

- `npm run test:server-types`: passed.
- `npm run build`: passed, existing large Three.js chunk warning.
- Existing DB suite + expansion suite: 35/35 passed after subscription and OG leaderboard changes.
- Final `npm test` after the final fashion preference addition: result recorded below when complete.

Tests exercise actual PGlite SQL migrations/RPC transactions: gift stock/debit/replay/self/double/expiry/cancellation, passport verification/idempotency, private project snapshots/manager scopes/client approval, recurring renewal/replay/partial refunds/refund-before-success, original OG table immutability/unified totals and service-only permissions. Demo persistence tests cover gift refunds and passport/journey reload.

## Limits

PGlite is local PostgreSQL-compatible execution; it does not prove production network/webhook delivery or concurrent PostgreSQL process scheduling. Production deployment must apply the new migration and independently verify Telegram recurring invoice behavior in its own bot/environment. No direct cloud migration or sandbox/live payment was executed. Project media/documents are supplied HTTPS URLs, not a new upload pipeline; existing private-file RPC remains separate. Gift link is `?gift=<token>`; Telegram `startapp` needs the frontend's reversible base64url encoding to fit its length limit. UI/mobile checks belong to the controller/frontend report.

- Final preference contracts: npm run test:server-types and npx tsc --noEmit passed.
- Final npm test after fashion preference addition: 83 tests passed, zero failed (125.9 seconds). Full output: expansion-test-results.log.

## Review corrections — new follow-up migration

`20261018133000_az_expansion_review.sql` fixes three reviewed issues without changing earlier migration files:

- OG service summary now accepts a legacy `public.users` identity with no platform member and reports zero platform XP. Absent identities still fail. Platform snapshot/dispatch authentication is unchanged.
- Refund jobs now retain immutable charge identity and dedupe by `(invoice_id, charge_id)`. A leased refund of charge A cannot revoke a subsequent renewal B. Renewal B can be separately refunded. Historic webhook deliveries do not replace the latest invoice charge pointer. Manager payment listing selects the refund for the displayed invoice charge.
- Private project files use `file:<uuid>` refs in milestone media strings and document `url` fields. `file.upload-url` accepts `purpose: project:<projectId>`. Project client, assigned editor and owner/admin can upload/download; outsiders and cross-project attachment fail. Download authorization checks current assignment, and produces temporary signed URLs only at read time. Stored signed Supabase URLs and common signature-query URLs are rejected. Object paths are server-generated `projects/<file UUID>`, never caller-provided bucket paths. Public HTTPS media remains supported.

Additional actual DB regression coverage: legacy-only identity summary and leaderboard, missing identity rejection and unchanged platform auth; refund A lease → renewal B → finish A preserves B → separate refund B; private project upload/download client/manager/outsider scopes, cross-project reference rejection and durable file reference in snapshots. Targeted expansion suite passed 2/2 (21.4 seconds). Final full suite status follows.

Final review verification: npm test passed 83/83 with zero failures (149.9 seconds); npm run test:server-types passed. Output retained in expansion-final-results.log. No cloud operations were performed.

## Final residual review correction

New migration `20261018140000_az_refund_retry.sql` makes admin retry eligibility follow the refund job's immutable charge, matching worker claim eligibility. A dead refund A can be retried after a later renewal B has been refunded even though the invoice's current status is refunded. Targeted actual DB regression covers dead A → renewal B/refund B → admin retry A → claim exact A → finish A. Demo catalog version is now 5 in initial state and upgrade paths; version-4 states append the new club lessons without losing existing progress, passport or chosen journey.

Requested targeted verification only: `node --experimental-strip-types --test tests/expansion.test.mjs` passed 2/2 (28.2 seconds), log `expansion-retry-results.log`. The immediately preceding complete suite remains 83/83 passed. No deployment/cloud migration performed.
