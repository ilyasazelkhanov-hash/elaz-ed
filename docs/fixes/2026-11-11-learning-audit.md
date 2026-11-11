# OG: honest learning status and safe return to work

Local changes against `d64d5142a581af17b32c0f72aa9de44669f82d0c` address the learning and free-start findings in the 11 November audit.

## What changed

- Resume data uses an account + demo/live namespace, one versioned record, the course and lesson keys, and an update timestamp. The previous shared keys are not adopted because their owner and mode cannot be established. Live completion comes from the server, not local storage. Resume selects only published/mapped lessons the account can open.
- Account changes remount the lesson reader. Draft keys also include demo/live mode. Late lesson responses and completion responses from a different account cannot update the current account. Repeated completion taps share one in-flight operation.
- An empty-quiz lesson now records **familiarization**, not verified practice. Its success is a small confirmation, not the generic “lesson passed” trophy. Existing server XP rules are unchanged and described as participation. A quiz is explicitly a separate understanding check. No UI claims that a project was independently reviewed.
- Every program links to its explicit project lesson. In text and automation, later application lessons are labeled as extra practice and no longer get mistaken for the capstone. Completion copy counts marked lessons rather than asserting mastery.
- Free guides show existing tool-access conditions before the exercise, explain where to paste the prompt and how to return to the checklist, offer an external ChatGPT link without transmitting the prompt, and retain a manual alternative. The link has a 44px minimum target and keyboard focus treatment. Attempts are account/mode isolated; navigation to news is atomic.

## Scope and migration

No database, paid content, access rights, price, XP formula, certificate, or assessment rubric was changed. An actual project submission/review workflow still needs a separate server contract and reviewer process. The stored catalog version is a front-end compatibility marker, not a cryptographic version of the lesson body. Old local resume and unscoped draft records remain untouched but are not restored into the new namespace; server progress remains intact.

## Verification

Passed:

- `npm run test:og-practice` (30 tests).
- `npm run test:discovery` (33 tests, including rendering all five free guides).
- `node --experimental-strip-types --test tests/course-funnel.test.mjs` (26 tests: account remounts, late response isolation, double taps, honest labels, existing checkout flow).
- `tsc --noEmit` and `npm run build` (the existing chunk-size warning remains).

The focused browser regression is `scripts/learning-audit-browser.mjs`; point `OG_LEARNING_URL` to local Vite, set `PLAYWRIGHT_MODULE` to an installed Playwright package and optionally `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. It blocks all non-local requests and uses synthetic demo data only. Browser execution was **blocked before launch** by Chromium `socket() EPERM` in this execution environment, including an approved escalation. Therefore no browser layout, screenshots, physical Telegram client or production verification is claimed.

The parent integration task owns the final aggregate test run and release decision. Nothing was pushed or deployed from this branch.

## Follow-up review hardening

Lesson results now also carry the owning account/mode and course id, so stale content is hidden before effect cleanup even without the parent remount. Completion handlers use a per-lesson session token: leaving the screen, changing access or replacing a lesson mapping invalidates pending UI work. Late success or failure cannot replace the new lesson, update account state, show a toast or start another boot. Four additional regressions exercise these cases.
