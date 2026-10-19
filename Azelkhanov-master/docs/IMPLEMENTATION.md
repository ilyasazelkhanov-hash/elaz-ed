# Azelkhanov Master implementation ledger

Approved specification: the user's implementation plan in this chat, 17 October 2026.

## Decisions
- Work in the explicitly requested portable folder; no worktree relocation and no automatic Git commit/push.
- Retain React 19.3 / Vite 8 / TypeScript / Tailwind 4; CSS for small effects, lazy Motion for complex interactions. Official alternatives researched at user request.
- Isolated database and bot per installation; no shared customer database or hidden dependency on the OG checkout.
- Production integrations are activated by environment configuration; local demo must never contact a live project.

## Work packages
- [x] Contracts, branding, module registry, portable scaffold.
- [x] Backend, transactional schema, auth, notification worker, backend tests.
- [x] Member app, games, admin, three demonstrations.
- [x] Generator, upgrade reports, operating guides, AI instructions.
- [x] Independent OG integration and compatibility migration.
- [x] Build, automated checks, browser QA, verification report.

## Client staging acceptance
- [ ] Separate bot, Supabase, domain, secrets, proxy and scheduler configured.
- [ ] Real Telegram iOS/Android, OIDC, Storage, Stars payment/refund and notification delivery verified.
- [ ] Backup restored and deployment-specific load requirements verified.

Local implementation is complete. These external-environment checks remain explicitly separate; see `docs/VERIFICATION.md` for evidence and limits.

## Interface coordination
Frontend and server share `src/platform/contracts.ts`; private server secrets and quiz answer keys never enter the live frontend bundle. The backend owns production mutations; the lazy demonstration adapter owns local examples only. Generator copies only an allowlisted portable project inventory.
