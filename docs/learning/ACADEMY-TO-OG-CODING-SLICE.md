# Academy → OG: substantive coding slice

Base: main `9389a19`. Source-only work; no database, permissions, price, entitlement or publication changed. Original lost Academy commits were not recovered or treated as present.

## Actual architecture and mismatch

OG `content/ai-practice-2026-10-25/paths.json` contains 5 courses and 33 lessons. These are not simply two-minute text cards: coding/block-7 includes a 45-minute estimate, starter HTML, a worked example, independent assignment and readiness criteria. Its interactive explanation layer was missing, while only two foundations bodies had authored interaction candidates. The user's difficulty is therefore partly presentation and guided practice, not solely lack of source material.

Academy `catalog.learning.json` holds 28 courses and 448 source lessons with distinct assignment/quiz/rubric/version structures. Counts are source data, not live availability. Copying all Academy lessons into OG would produce duplicate progression, ambiguous prerequisites and access problems. Preserve learner-facing OG entry point and adapt useful outcomes into OG's existing artifact/Reader flow. Keep Academy assessment authority separate.

## Priority map

| OG destination | Relevant Academy outcomes | Why / safe approach |
| --- | --- | --- |
| coding/block-7 | VC-101-M1-L1, DS-101-M1-L1 | Start with a user's action, bounded prototype and observed behavior. Original short examples, not copied Academy lesson bodies. Implemented here. |
| coding/coding-spec | DS job stories, acceptance, keyboard/mobile constraints | Inspect exact existing key/body before adding; scenario-based acceptance tests rather than another generic prompt list. Not implemented here. |
| automation | AU process clarity, duplicate/exception handling | Preserve draft-only examples, distinguish memory state from durable system. Coordinate separate authoring; not implemented here. |
| media | CR actual export, rights, generation versus editing | Verify file/result, not a brand ranking; keep licence-specific caveats. Not implemented here. |
| text | Source verification and evidence-backed synthesis | Combine evidence table and honest uncertainty; avoid fabricated citations or unsourced medical recommendations. Not implemented here. |

No default change to paid/free boundaries. Current coding/block-7 is marked `free_preview` in the committed source, but this does not establish live permissions; existing server-gated body delivery still determines eligibility. The new module contains original fictional examples and no imported Academy text or paid payload.

## Implemented vertical slice

`src/lib/og-coding-interactions.ts` supplies 3 authored teaching steps and 3 checks: meaningful acceptance criterion, diagnosis of whitespace/false-success defects, and ordering an evidence-based change cycle. Every distractor explains the actual mistake. The transfer task adds a new topic and verifies that the selected value reaches confirmation.

Learner artifact: own `index.html` and `checks.md` with input / expected / observed / conclusion; empty input, whitespace, normal input, keyboard and mobile checks. It builds on the existing independent assignment and PracticeArtifact, not a new assessment or simulated code runner. No quiz answer is described as skill verification, execution, XP or course credit.

The registry pins exact UTF-8 SHA256 of coding/block-7's existing body. Missing, gated, changed content or unavailable crypto yields the unchanged Reader. Original lesson reading remains visible, and the original practice artifact route is used. No canonical content mutation or database import is needed for this source-only candidate; deployment and matching live body are still required for activation.

## Verification and limits

Four existing interaction tests pass, including all authored options, wrong answers, exact mismatch, empty/gated bodies, crypto failure, source visibility and entitlement-boundary source assertions. This is not browser evidence. TypeScript/aggregate and browser device checks must be run in integration. Check 320/390 layouts, keyboard flow, refresh/back, changed source fallback, locked next lesson and local artifact export before release.

Coverage after this isolated slice: 3 reviewed OG interaction candidates of 33 source lessons, 9 checks total. Only 1 new lesson is implemented here. This does not claim all courses migrated, Academy completion transferred, or any live candidate activated. Next should improve a complete beginner course sequence, not bulk-copy hundreds of lessons or conceal missing backend work.

## Integration warning: divergent observed inventories

This worker directly inspected git object `9389a19b497e924899bfe2f9a29aac0ca5a0d74c`, which has two registry entries. Another worker reports a remote 33-flow/99-check implementation associated with `9055a9b`, unavailable in this local object store. Reconcile the remote registry before integration. If all 33 flows already exist, treat this authored module as a proposed quality replacement, not new coverage; do not replace or reduce the remote registry. Counts above describe this inspected snapshot only, not verified current remote/live state.


## Reconciled integration baseline

Fresh GitHub main `c42bb196` has two foundation registry entries, not 33 flows.
Its tree is identical to local `c85cafa`; integration preserves all published
Home/Courses changes. This release adds only coding/block-7 as the third
conditional candidate. The unavailable historical 33-flow work is not claimed
as recovered or published. The inactive creator bridge remains source draft only.
