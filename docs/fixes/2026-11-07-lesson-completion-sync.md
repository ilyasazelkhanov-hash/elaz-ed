# Confirmed lesson completion across OG screens

## Defect

The ordinary `LessonScreen` is reachable through a direct lesson link and from an OG reader's quiz button. Its successful completion handler updated `feed`, but OG program rows and counters prefer `courses[].practice_lessons`. Closing the reward after a quiz also revealed the still-mounted OG reader, whose fetched lesson snapshot remained incomplete.

The server could have saved the lesson and awarded XP while the program still offered the completed lesson as the next step. Reopening the program did not repair this until another boot refreshed the catalog. This is a client-state synchronization defect, not a lost server completion.

## Change

- `markLessonCompleted(id)` applies a confirmed completion atomically to the feed and matching course outline. It increments the matching course count once, including the legacy feed-backed representation, and leaves access and unrelated lessons/courses unchanged.
- Both ordinary and OG completion handlers use the shared action only after `api.complete` succeeds.
- A mounted OG reader accepts confirmed completion from its current outline as well as its fetched lesson. Returning from the quiz reward therefore shows the saved state immediately.
- Pending refs prevent repeated taps from starting concurrent completion requests. Failed requests remain retryable by the learner.
- No new network requests, reloads, payment actions, server changes, migrations or content changes. The OG no-quiz handler's existing boot refresh remains; local completion is visible before that refresh finishes.

## Offline regression

`npm run test:lesson-completion` compiles and executes the actual store, OG practice screens, ordinary lesson, quiz and reward with controlled API boundaries. It uses synthetic free lesson text and synthetic quiz questions, not authored paid materials. The bundled demo examples have no quiz; the quiz test covers the supported quiz-bearing lesson contract, not a claim about production quiz assignments.

Coverage includes direct free preview completion with and without a feed card, course access true/false, real quiz-answer and reward-close handlers, program count and next action, still-mounted reader state, failed completion and explicit retry, an already-completed response, repeated pending taps, idempotence, unrelated ID/access isolation and the existing no-quiz path. The script is automatically included by `test:all`, which discovers `test:*` scripts from package.json.

Verified locally:

- New completion suite: 13/13.
- Frontend error suite: 4/4.
- Legacy course suite: 13/13.
- Course funnel, OG access, checkout, practice reader and progress-award suites: 40/40.
- TypeScript `tsc --noEmit`: passed.
- `git diff --check`: passed.

No browser or production checks were run. Full aggregate validation is separate from these focused checks.
