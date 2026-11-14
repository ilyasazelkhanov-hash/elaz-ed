# AI winter advent: 14 November 2026 - 5 January 2027

## Why Home could lose the calendar

Home already rendered the server-backed AdventBanner, but the banner returned null when boot's `advent` summary was absent. Source evidence is not proof of the live campaign configuration; production DB remains unavailable.

## New public editorial season

Home now always offers the 53-day AI winter calendar directly below Dots and daily check-in. It is not limited to demo and does not depend on a reward campaign row. Content is authored, public, free and shipped with the frontend. `#/advent` opens the season. Doors use Asia/Almaty, UTC+5, across the year boundary; the client clock is editorial pacing, NOT a security boundary or entitlement mechanism. Future content exists in the bundle and must not be treated as secret.

Completion marks are self-checks stored locally per live/demo account and season; no XP, purchase, prize, attendance or server completion is fabricated. Clearing/denying storage loses local marks, with explicit UI disclosure and memory-only fallback on write errors. No answer text or sensitive information is stored. Dates outside the season and malformed stored data are ignored. Missed days remain free.

The original server reward calendar, IDs, progress, catch-up tickets, APIs and DB configuration are unchanged. Its existing banner remains available inside the season whenever boot provides it. Existing door/API routes stay intact. This release does not turn on or refill a server reward campaign.

## UX and verification

Calendar months use real dates, selected-state semantics, keyboard controls, text labels, 44px+ touch targets and reduced-motion styling. A selected task exposes concrete steps, a copyable prompt, an advanced option, an artifact and a check. Future tasks do not expose their body in the rendered UI, although public bundle content is inspectable.

Automated checks cover 53 consecutive dates, UTC+5 boundaries, catch-up, stored progress isolation/failure, public navigation, content completeness and no reward writes. Full suite and deployment receipts are reported separately. Real Telegram rendering and server reward state require authenticated validation; a source or public demo check is not that validation.
