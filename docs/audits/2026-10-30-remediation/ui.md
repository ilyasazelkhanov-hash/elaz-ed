# UI accessibility remediation — 30 October 2026

Implemented the three UI findings in the 28 October audit:

- UI-1: screen, reward and share scopes move focus inside, keep Tab/Shift+Tab inside, make the background and lower screens inert, and restore the opener on dismissal. Exiting screens relinquish focus immediately. Each scope owns a short fade and isolates descendant presence animations so dismissed screens reliably unmount. The share sheet also closes with Escape.
- UI-2: aurora CTA text uses dark `#12091c`. The regression check computes WCAG relative luminance for 101 interpolated samples per segment of the standard, orange and festive aurora gradients and requires at least 4.5:1.
- UI-3: the daily bonus is a native button with immediate Enter/Space activation, a synchronous duplicate-request guard, disabled/busy state, and a visible keyboard focus ring. Pointer users retain the existing hold interaction.

## Validation

Before implementation, `scripts/ui-accessibility-browser.cjs` reproduced all three original failures at 390×844 and 1024×844: focus stayed outside the article, the bonus was a DIV, and the white CTA text yielded 3.89/3.26/2.24:1 at the standard gradient stops.

The final browser check uses the real local Vite app with demo data. It covers initial article focus, 25 forward and 25 reverse Tab presses, inert navigation, share-sheet Escape and focus return, nested screen isolation/return, return to the original blog card, separate Enter and Space claims with autorepeat/busy suppression, pointer hold, and gradient contrast. Machine-readable outcomes and screenshots are in `ui/` beside this report. `npx tsc --noEmit` also passed. No build command was run.

Run with Playwright available on Node's module path:

```
node scripts/ui-accessibility-browser.cjs
```

The default origin is `http://127.0.0.1:5173/?demo`; `UI_ORIGIN` overrides it. `UI_CASE` optionally selects one scenario. Browser automation used bundled Node Playwright because the bundled Python runtime does not include Playwright. All fixtures and mutations were local synthetic demo state. Blog sharing itself opens Telegram; the sheet test supplies a synthetic share card through the store to exercise the separate app share sheet. No live Telegram, physical device, screen reader or production backend was tested; this is not a claim of complete WCAG conformance.
