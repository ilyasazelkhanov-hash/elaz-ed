# Content-first news and course discovery

User request: news opens on articles rather than settings; the course header retains the cursor illustration and reduces competing panels.

## Changes

- News now has a single compact heading. Search, reading mode, topics and categories are in one native disclosure, initially closed on both home and the news tab.
- Active selections remain visible outside it, with a direct reset. Closing controls never clears the user's filter or silently switches their saved/unread view. Loading, errors, retry and archive loading remain outside.
- Courses retain the bounded cursor illustration at the top. Promotional headline/counters and the large beginner banner are removed. Search, topics and the route assistant are available under optional discovery. A compact free-start link, existing resume, prices and course access information remain.
- The local cursor canvas has more breathing room and a subtle grid/gradient; continuous motion, pause and offscreen/reduced-motion protections are unchanged. It does not imply online agents.
- Disclosure summary elements are explicitly keyboard-focusable to work with the existing overlay focus layer. Touch targets remain at least 44px.

## Checks

48 focused tests passed (news filtering/presentation, course handlers, recommendations, motion). TypeScript passed. Full suite started; final integrated validation and actual 320/390px browser QA remain required.

Browser acceptance: initial viewport contains news/card content, open/close controls, set search/topic/saved filter, collapse and reset; courses open search and route helper, select and clear, follow free start and return; check pause/resume and both themes at 320/390px, long active query wrapping, keyboard traversal inside learning overlay. Preserve payment gates and the unfinished-course resume.
