# Learner accessibility and unavailable repository link

Base: `31a2b67`. This patch changes no API, payment, permission or database logic.

## Changes

- Telegram initialization no longer calls `lockOrientation`. Device orientation and the user's accessibility settings govern the layout. Fullscreen, ready/expand and existing swipe handling remain unchanged. No forced `unlockOrientation` is sent either.
- Removed the learner catalog's `Читать модули` link to this private repository. There is no equivalent public, complete set of those documents exposed by the app, so the link was not silently redirected to unrelated free content.
- Preview course copy now says that materials are unavailable and will open inside the course when learning is available. Existing program notice, refresh action and published course/lesson paths remain intact.

## Verification

`node --test tests/learner-accessibility.test.mjs` exercises actual SDK initialization for iOS, Android, desktop, no SDK and an incomplete older SDK, plus an SSR render of the learner catalog. TypeScript checked.

Physical rotation in Telegram iOS/Android and landscape rendering remain device QA tasks, not certified by the mocked SDK test. No production changes were made by this patch.
