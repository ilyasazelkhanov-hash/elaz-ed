# GIF covers without overlay controls

Owner request: remove the GIF pause button throughout OG CRE8R.

- Removed the per-cover pause/play button from the shared `CoverImage` component. Static cover navigation and error handling are unchanged.
- GIFs autoplay normally. System reduced-motion remains authoritative and renders a captured still frame.
- A single labelled `GIF-анимация` checkbox in Profile settings provides an alternative way to stop all GIF covers. This avoids replacing clutter with inaccessible uninterruptible motion.
- The device-wide preference is stored locally, synchronizes between tabs, and remains usable in memory if browser storage is blocked. It is not account data and is not sent to the server.
- Dots, story navigation and learning-scene controls are not GIF cover controls and were not removed.

Verification: six cover/preference tests exercise the real component/store, including system preference, no overlay button, still capture, navigation, errors, storage failures and subscription cleanup. Existing profile tests and TypeScript pass. Final integrated browser and aggregate checks remain the publisher's gate.
