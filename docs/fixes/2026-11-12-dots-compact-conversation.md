# Compact Dots conversation

## Request and baseline

The previous thought cloud felt too large and visibly assembled from decorative primitives. This iteration starts at `f492caabbe62fcf4693a1411517067e5be11c516`; the GitHub connector confirmed `main` was still identical before handoff.

## Design

- Replace the scalloped cloud, three detached circles, star and nested CTA pill with one continuous, softly asymmetric silhouette and an integrated pointer to Dots.
- Keep the character beside the conversation at 320px instead of moving the entire message to a second row. Reduce the character column, outer spacing and empty surface padding.
- Use a simple text action and arrow, not another button-shaped object inside the speech button. The whole message remains a real, generous click/touch target.
- Keep the surface's slow breathing separate from the text. No moving text or shifting hit targets. The abstract furry character's renderer, blinking, reactions, gaze, props and lifecycle are unchanged.
- Preserve full text, arbitrary-word wrapping and natural height. No ellipsis, line clamping or fixed-height clipping. Keep 44px settings/voice controls and distinct, non-overlapping control rows.
- Include the visible headline (including a transient interaction line), detail and action in the speech button's accessible name. Keep the name in the theme's violet rather than low-contrast peach/mint decoration colors.

## Measured browser comparison

Measured the built baseline and candidate side by side in Chrome, in real 320px and 390px CSS-width iframes, after the bundled Onest and Unbounded fonts reported loaded. Both copies used the same deterministic `daily:ready` cue and demo data. No app styles were overridden by the comparison harness.

| CSS width | Whole Dots zone, before / after | Reduction | Message, before / after | Reduction |
| --- | --- | --- | --- | --- |
| 320px | 256.6 / 176.4px | 31.3% | 164.6 / 129.4px | 21.4% |
| 390px | 232.2 / 159.0px | 31.5% | 182.2 / 112.0px | 38.5% |

The page's `scrollWidth` exactly matched the viewport at both widths. The SVG surface intentionally extends 3px beyond the component's content box, within the page gutter; that local decorative overhang is not page overflow.

Observed checks:

- Light theme at 320px and 390px: full headline, detail and CTA; no clipping or horizontal page scroll.
- Dark theme at 320px, with the `start` cue: readable copy, contained surface and complete inline action.
- The message opened **Бесплатный старт**; **Назад** returned to home.
- Settings opened and closed on 320px. The background companion reported `data-moving=false` while covered and `true` again after closing.
- Keyboard focus outline was visible on the 44px settings control.
- The isolated comparison tab was closed and its local server stopped. No authenticated service or production data was modified during UI QA.

These are desktop Chrome checks at narrow CSS widths, not physical-device or Telegram WebView certification. The final accessible-name-only adjustment was covered by SSR tests after the visual check; it does not alter layout.

## Automated validation

- `npm run test:all`: 38/38 stages passed, including 806/806 Node tests, 112/112 API checks, TypeScript, production Vite build and 38-page prerender.
- Final focused rerun: `test:companion` 53/53 and `test:editorial-motion` 5/5.
- `git diff --check`: clean. Independent read-only review found no blocking regression.
- Existing Vite warnings remain for the unrelated Sculpture and catalog chunks over 500kB; no new dependency or network asset was added.

Long-title and no-space strings, optional voice controls, unique SVG gradient IDs, reduced motion, pause and covered-state behavior remain covered by the companion test suite. The compact layout regression test rejects reintroduction of the second mobile row and detached decorative primitives.
