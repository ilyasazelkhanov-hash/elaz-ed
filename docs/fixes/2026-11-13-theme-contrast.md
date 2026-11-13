# Light/dark contrast correction

Baseline: local 1571c99, same source tree as published b1c8829. This is a source-level audit, not certification of all live routes.

## Proven defects and changes
- Light `faint` was only 3.93:1 against app background. Dark `faint` was 4.34:1 on card2. Both are used for small explanatory text, not just decorative icons. Adjusted these semantic tokens.
- Light mint, sky, amber, peach, pink and rose were 2.82-3.66:1 on app background. Darkened the light variants while retaining their hue roles. Every normal text token now reaches 4.5:1 on bg/card/card2/float; filled controls with the on-color token are also tested.
- Admin publishing buttons, selected KnowledgeHub audience, advent quiz letter and missing-story close used fixed white on theme-aware violet. Use existing on-violet so the light violet of dark mode gets dark readable labels.
- AdminEditor save/publish used white on the bright fixed aurora gradient. Use the same dark label as the shared cta-aurora. Holographic profile card is intentionally an independent dark context and remains unchanged.

## Scope and limits
No navigation, data, backend, animation timings, content or publication changes. Tests cover exact CSS token values and known affected control bindings. They do not establish contrast for opacity variants, image/gradient overlays, every animation frame, authenticated admin data, or Telegram device chrome. Those require rendered QA separately. Keep accessibility/reduced-motion behavior intact.
