# Home hierarchy: contextual rewards, visible identity

User evidence: the attached screenshot showed a standalone “Рад видеть тебя снова” introduction with zero streak above the real reward card. It repeated the same goal and occupied space before the actual action.

## Implemented

- Removed the separate greeting/streak heading and the second “Мой прогресс” row.
- Moved account XP beside the home avatar. The value still comes from `me.xp`; the existing `xp-pill` animation destination is preserved exactly once. Profile HoloCard continues to display account XP.
- Daily available/claimed state still follows `me.daily_claimed` from the API. Claiming code, idempotency, keyboard support and guard/error handling are unchanged.
- Confirmed daily state replaces the reward in place. Following the second screenshot review, the weekly meter is now inline, not behind another disclosure. A short freeze hint and stock count replace the explanatory paragraph. Sharing stays in the card header; the record remains in profile statistics.
- Home news filters are available under a collapsed disclosure by default and automatically exposed when filters are active. Loading/error/retry stay visible; the full blog keeps its expanded controls.
- Topic discovery is a native collapsed disclosure. No filter routes or followed topics were removed.
- Saved-content shortcut appears only when there are saved posts; the profile library and news controls remain available in the empty state.
- Removed duplicate news eyebrow and decorative closing slogan. Daily/Advent stay immediately after Dots as requested.

## Validation

SSR tests check XP placement, one animation target, available/claimed states, empty/nonempty saved content, topic/filter disclosures, exact server values, inline weekly progress and retained profile card. Advent renders its campaign name with one state line; the home course promotion combines its offer without hiding paid status or the introduction. Navigation tests preserve the Dots → Daily → Advent → News order.

## Deliberately not changed

No database writes, award calculation or data migration. No Dots renderer/cloud edits (parallel iteration). No deletion of achievements, account data, settings or payment paths. Further simplification of the profile information hierarchy should be evaluated as a separate task, not hidden inside a visual refactor.
