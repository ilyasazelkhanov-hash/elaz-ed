# Audit remediation integration — 11 November 2026

## Release boundaries

The integration starts at `d64d5142a581af17b32c0f72aa9de44669f82d0c`. Local tests, a GitHub commit, a successful CI run, a deployed frontend, and an upgraded production database are separate claims. Record evidence for each; do not infer one from another.

Pushing to `main` may trigger the connected Vercel frontend deployment. It does not deploy Supabase functions or apply migrations in this repository's workflow. The payment change must not be called live until its migration and API have been released in the required order and verified against the intended Supabase project.

## Public frontend identity

Every production build now writes `/release.json` after assets and prerendered pages are complete. It contains only a validated full commit SHA, source-checkout status before content generation when available, build time, aggregate SHA-256 of built files, and file count. It does not contain environment values, credentials, user data, or payment records. Vercel's `VERCEL_GIT_COMMIT_SHA` is used when available, followed by `GITHUB_SHA`, then local Git HEAD. A build outside Git without either source deliberately reports an unknown commit.

`RELEASE_EXPECTED_COMMIT=<full SHA> npm run release:smoke` checks the public frontend identity as well as the existing API capability/content contract and unauthenticated denials. Missing identity, a mismatched commit, a dirty published build, or an old API produces a failed result. API-only checks cannot prove frontend deployment identity. The public aggregate fingerprint identifies one build; it is not a signature or evidence that database backups exist.

## Verification matrix

- Root application: `npm ci --ignore-scripts`, then `npm run test:all`. The aggregate runner executes all declared root test groups and the full build in an isolated copy. Node 24, Python 3.12+, FFmpeg and FFprobe are required.
- Standalone master: in `Azelkhanov-master`, install its own dependencies and run `npm test`, `npm run test:server-types`, and `npm run build`.
- Edge types: `deno check --no-config --no-lock supabase/functions/api/index.ts` with Deno 2.5.6 as in CI.
- Payment failure tests must cover database failure before and after the Telegram response, ambiguous network outcomes, repeated webhook delivery, gift/manual/invite grants before and after purchase, and multiple purchases. SQL and the API fake must agree. Do not use real payments as local tests.
- Navigation: free start → lesson → close, course → lesson → close, Home/News/Courses/Profile transitions, browser Back and Forward, repeated clicks, direct hashes, keyboard focus and browser zoom. Test with an isolated demo identity; demo state is not production data.
- Learning: distinguish reading, quiz and project evidence; preserve existing progress; switch users/modes; test missing storage and a failed API response. Self-reported practice must not be presented as a reviewer-approved project.
- Academy: preserve authored lesson IDs and assessments; regenerate material exports; ensure each pilot lesson has a concrete example, task and criteria relevant to its objective. This is not approval of all Academy courses.
- Master: exercise each enabled template path from the user-visible action to a meaningful result. Training sessions and fashion events must remain independent.

## Safe publication and rollback

1. Read the current remote `main` before any write. If it moved, integrate the new commits and rerun affected checks. Never force-reset another contributor's changes.
2. Preserve the prior commit and a local Git bundle. Record the exact candidate commit, source manifest and test summary. Publish via a fast-forward or an explicit expected-SHA lease, never a blind ref replacement.
3. Confirm CI for the published SHA. Then inspect Vercel status and run public smoke with that exact SHA. A running CI or an old live site is not a completed release.
4. Frontend rollback is a new revert commit or the hosting provider's verified previous deployment. Do not rewrite shared history. Confirm the old frontend is compatible with any backend already released.
5. Before payment migration/API deployment, verify the actual project, applied migrations, current function version, refund queue and scheduler, and recoverable backup. Run the new migration on an isolated restored database and verify independent access grants. See the payment remediation's dedicated runbook for ordering and reconciliation.
6. Prefer a forward repair after a database migration. Do not drop durable refund records or independent grant records during rollback. If the outcome of a real refund is uncertain, reconcile with Telegram before retrying.

## Remaining owner/production gates

- Repository visibility and content licensing are owner decisions. Making a repository private does not revoke previously downloaded copies, forks or independently published content. Check private-repository access for GitHub Actions and Vercel after changing visibility.
- Required checks and branch protection change repository policy and are not silently enabled by this code change.
- A fixture comparison is not a restore drill. Production backup age, measured RPO/RTO, roles, Storage and cron execution require isolated recovery evidence.
- Physical Telegram iOS/Android checks, real payment/refund acceptance, and reviewer acceptance of student projects remain distinct from automated tests.
- New AI tutors, expanded course catalog, conversion promises and blanket claims of production readiness are outside this remediation release.
