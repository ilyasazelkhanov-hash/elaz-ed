# Local saved free works

The Profile library now exposes explicitly saved free-guide work. This is not Academy portfolio or verified skill evidence.

## Boundaries
- Read only the known `beginnerGuides` keys for the current live/demo account. No storage-wide enumeration, network writes or analytics payloads.
- Unknown, malformed and empty records are not listed. Current guide criteria determine whether the old self-check is still applicable.
- Only title and self-reported status appear in the profile. Work contents remain in the exercise.
- Opening uses the allowlisted `/start/<guide>` route.
- Deletion requires a second explicit action and removes only that work and its matching transient recovery. Course progress, XP, downloaded files and other scopes remain untouched. Storage failure is not reported as success.
- Refresh when returning from an overlay, on focus and on storage changes from another tab.
- Local-only retention is stated in the UI. Browser data clearing removes these works; no cross-device sync is promised.

## Validation
- TypeScript passes.
- Artifact/shelf: 14 tests, including exact-key access, account/mode isolation, corrupt data, stale rubric, deletion failure, recovery cleanup and actual component SSR.
- Profile: 32 tests including the current live scope passed to the shelf.
- Actual phone/WebView visual and interaction checks remain for the integration gate. Full aggregate must be rerun on the integrated snapshot.
