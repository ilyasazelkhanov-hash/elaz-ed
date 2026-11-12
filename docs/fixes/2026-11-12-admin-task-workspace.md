# Admin task workspace

## Evidence and implemented scope

The previous main-app admin hub made creation secondary to long descriptions, statistics and archived course links. Content lists mixed drafts and published posts. The editor showed styling before writing, then every secondary setting in a long form. Permanent deletion was a small icon beside the title. Archived course access requests and payment controls shared one long page.

This slice changes the **main-app** Admin, AdminEditor and AdminCourses surfaces only. Academy's separate admin interface is not claimed redesigned or verified.

- Two explicit quick-create actions; compact content destinations; statistics and legacy archive are available in keyboard-focusable disclosures.
- Global title search remains server-side. Draft/published and editorial-review filters explicitly say they apply to loaded records; an empty filtered page still permits pagination and resetting filters.
- Editor keeps writing visible, with optional design, sources/review, media and advanced settings in disclosures. Publication status remains visible. Preview is visibly labelled as a save-and-view action: it is not read-only.
- Permanent delete is separate from routine controls, names its irreversible nature and recommends unpublishing for hiding. Backend delete/cascade behaviour is **unchanged**, not repaired or renamed as archive.
- Archived course operations have explicit Requests, Courses and Payments views. Request counts are visible. Failed course loading has retry instead of an endless placeholder. Payment/refund business rules, deduplication and uncertainty handling are unchanged.
- Touch and keyboard targets are preserved, labels added to essential editor fields. No permissions, API, migrations or production data changed.

## Validation

`test:admin-usability` renders real components with inert dependencies and exercises loaded-only empty filter and pagination, status tabs, request failure/retry, folded editor fields, safe delete placement and save-preview disclosure. Existing admin payment/editorial tests and TypeScript passed locally.

Actual browser verification is required on the integrated build, with DEV/demo fixtures only. The authenticated production admin workflow, actual payment or delete operations, Telegram hardware navigation and database cascade behaviour are not tested by SSR.

### Browser checklist

At 320 and 390 CSS pixels, both themes:
1. Hub: quick create, all destinations, statistics/archive expand and keyboard focus.
2. Content: search, statuses, review filter, reset, pagination and error recovery; return from editor refreshes section.
3. Editor: long title, disclosures, text focus and toolbar; save preview clearly labelled; dangerous action closed initially. Do not execute production save/delete/announce.
4. Legacy archive: requests empty/loading/error; course list; payment search and refresh. Do not execute production access decisions/refunds.

## Remaining risks

- Hard delete still destroys related data. A server-side archive/recovery design is a separate migration task.
- Editorial form validation is still authoritative at save; collapsed sections display their review status but are not a full preflight wizard.
- Draft state has the pre-existing unsaved-navigation limitations; no silent local/cloud autosave was added.
