# BCC Hub motion study and OG CRE8R adaptation

Checked 12 November 2026. These are original implementations inspired by interaction principles, not copied assets or scripts.

## Observed evidence

- https://bcchub.kz/ru: public HTML has separate product background/object layers and staggered `data-reveal` delays on editorial cards. Its public `7946-99c9e782a83cbcaf.js` bundle exposes `WanderingCursors`: named role cursors follow bounded curved paths, avoid text and controls, and guard reduced motion and viewport/visibility. The team strip also has explicit pause controls.
- https://bcchub.kz/ru/products: product overview is the relevant reference for layered product cards, rather than making every section a moving canvas.
- https://bcchub.kz/ru/products/corporate-banking: the captured page was an under-construction placeholder. Separate captures returned different decorative treatment; do not claim a finished banking interaction was tested.
- https://bcchub.kz/ru/blog: editorial card composition, not its loading/image failures, is the reusable pattern.

## Adapted, not copied

1. Course overview: a bounded cursor illustration of “Запрос → Проверка → Проект”, labelled to assistive technology as a learning route. The decorative cursors are not real users or online agents. They never leave the illustration or cover controls. A single 4.6-second sequence starts in view, pauses offscreen/background, then settles.
2. Course list: subtle, one-time entry for newly displayed cards and fine-pointer lift. Content is never initially hidden, so a missing observer cannot hide courses. Focus cancels entry motion.
3. News: quiet hover depth, focus border and directional link response. No animation changes content, order, reading state or navigation.

No global cursor replacement, no copied BCC artwork, no new package, no background animation loop. Reduced motion produces a static composition; touch devices keep stable targets. The existing Dots character remains a separate implementation.

## Validation

`tests/editorial-motion.test.mjs` exercises reveal lifecycle, focus, media preference changes, background/offscreen pause, unsupported observers and repeated cleanup. Full application regression and browser review must be performed on the integrated revision before release.
