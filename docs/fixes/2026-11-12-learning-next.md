# One next learning action

Adaptation of the Coursiv research, not a copy of its interface or claims.

- Home now shows one suggested learning action before editorial content, while preserving the requested Dots, daily check-in, Advent order.
- An available unfinished practice lesson uses server completion and access. Local `done` flags never grant access or prove completion.
- With no such course, beginners get the free guide sequence. Experienced learners get the applied fact-check exercise, not a mandatory introduction or a fake diagnostic score.
- Preferences are shared with the practice catalog and stored on this device, scoped by account and demo/live mode. No cross-device sync is claimed.
- Free guide reading position and self-reported attempts are separate. A completed free attempt is not an assessed skill. Choosing a level does not grant credentials or bypass payment.
- Explanations, experience and goal controls are under one native disclosure. Another free guide can always be chosen.

## Verification

Focused route, access, malformed-storage, SSR and existing home/free-guide tests passed. Run final integrated `test:all` after combining the practice-artifact change, because both touch FreeStart imports and its SSR harness.

Manual acceptance: 320/390 px; beginner starts free; advanced selects fact check; open a guide, leave, resume; mark attempt, return, next guide; complete paid lesson with server response, next step; revoked paid access does not expose body; demo/live and account changes do not share reading position; blocked storage still permits reading; keyboard disclosure/select/CTA.

Not implemented: new server placement engine, cross-device preference sync, automated competency assessment, arbitrary skipping of required assessments or paid-course grants. Existing course services remain authoritative.
