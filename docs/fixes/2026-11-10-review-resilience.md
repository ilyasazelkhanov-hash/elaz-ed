# Review fixes, 10 November 2026

Base: `d208cf4dd7e994186b90e93af250ab420fc06474` on `main`. Existing learning drafts, action queues, course access and modal focus behavior were preserved. No production database migration or data write is required.

## Behavior

- Operations in the embedded and standalone platforms distinguishes an empty result from a failed request. Switching filters immediately hides old rows and disables their CSV export. Late results, errors, unmount completions and old mutation callbacks cannot replace the current filter. Retry loads operations only.
- Main application background boot failures retain the current screen, confirmed progress and reward. The notice retries only boot, never the original completion or payment. Confirmed authentication/access denials still remove protected screens. Older boot responses cannot override a newer boot or access guard.
- Main and Academy requests have a 15-second deadline through complete response-body consumption. Timed-out requests are aborted and are never automatically retried. Academy preview fallback remains limited to public catalog/course reads; a known 401/403 does not become a preview.
- Platform uploads show the server-supported JPG/JPEG, PNG, WebP, PDF and TXT types. Extension/MIME, filename length, empty content and existing size limits are checked before the upload request. Storage errors explain format, size or expired permissions. Server authorization remains authoritative.
- Main and platform Stories have native keyboard-operable pause/resume buttons. Only visible, unpaused elapsed time counts. Explicit pause survives visibility and touch changes, and timers/listeners are disposed on navigation.
- Industry links resolve only own supported keys. Inherited names such as `__proto__`, `constructor` and `toString` safely fall back to the default industry.

## Validation

- Root `npm run test:all`: 29 stages, including isolated tests, TypeScript, Vite production build and Academy prerender.
- Standalone `npm test -- --test-concurrency=1`: 116 tests.
- Standalone `npm run test:server-types` and `npm run build`.
- Added focused coverage under `npm run test:review-resilience` and the standalone test glob.
- Tests use local fixtures and isolated PostgreSQL/PGlite state, not production data.

Local browser checks could not run: Chromium could not create its sandbox socket and the separate browser could not reach the local preview. This does not constitute desktop/mobile visual or real keyboard/touch verification. Production deployment/CI status is tracked separately from these local checks.

Existing large-chunk build warnings remain. No server or database change, configuration replacement, or generator/sync baseline rewrite is included.

Public-demo follow-up confirmed the three hostile industry-link fallbacks. Browser testing also exposed the native animation-frame receiver requirement: playback hooks now wrap frame cancellation in a callback, with a receiver-sensitive regression test for pause and disposal.
