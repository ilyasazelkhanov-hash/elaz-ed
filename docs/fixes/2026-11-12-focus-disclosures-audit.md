# Keyboard reliability audit: native disclosures

Baseline: `c895075` (Stage 3 candidate). Scope: common screen/dialog focus handling, transport timeouts, animation suspension and scoped local drafts. This is a targeted source/handler audit, not a claim to have tested every production scenario.

## P2 fixed: focus traps skip native controls

Both `src/FocusLayer.tsx` and `src/platform-kit/src/components/modal-focus.ts` queried buttons/links/form controls/explicit tabindex but omitted native `summary`. The main FocusLayer also omitted audio controls. Once keyboard focus reached one of these elements, its index became -1, so the next Tab or Shift+Tab reset to a boundary instead of following the browser's natural order.

Current examples include the free-start glossary and Academy guidance disclosures. Some newer components explicitly set tabindex, masking rather than fixing the shared problem. No changes to every individual lesson are required.

The main scope also accepted `visibility:hidden` controls that still have layout boxes. A trap boundary could attempt to focus an invisible element. It now excludes hidden/inert/aria-hidden ancestry and hidden/collapse computed visibility. The platform modal already had these guards.

## Changes

- Include native summary in both focus selectors and audio controls in the main selector.
- Keep negative tabindex, disabled and layout exclusions; reevaluate candidates on each keypress.
- Keep existing focus restore, Escape, overlay ownership and navigation unchanged.
- No API, DB, permission, destructive action or content changes.

## Evidence

Three new tests execute the real main FocusLayer effect/keyboard handler. All three fail against baseline and pass after the fix. An additional platform modal handler regression verifies summary traversal. Existing free-start focus and post navigation tests remain passing.

The tests model DOM layout, not a browser accessibility tree. Integration QA should use native Tab/Shift+Tab on the glossary, closed/open details and Academy guidance, in a screen overlay and modal, and check focus return on close. Physical Telegram WebView and screen reader verification remain outstanding.

## Other audit observations

- Request deadlines cover response body consumption and do not retry mutations after uncertain timeout. No change needed here.
- Story playback suspends scheduling while hidden/paused. No change needed here.
- Scoped practice drafts and explicit local-only persistence are covered by existing tests, not evidence of cross-device sync.
- Theme writes catch storage denial but reread persisted mode immediately; in blocked-storage contexts a selected theme may not take effect. This is a separate low-risk future fix, not bundled here.
- Hard-delete/cascade and release manifest identity remain separate known risks from the broader audit; this change does not resolve them.
