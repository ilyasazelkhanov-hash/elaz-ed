# Academy completion API

All actions use the existing authenticated `/academy` endpoint and service-role-only `academy_action(bigint,text,jsonb)`. The extension migration runs after the original Academy and existing `006_courses_stars_freezes.sql` migrations. It renames the original dispatcher to `aa_base_action`; callers continue using `academy_action`.

## Competencies

- `skills {}` → `{skills: Entity[], links: {target_code,skill_code}[]}`. Learners see published skills and published targets; editors see drafts too.
- `skill_map {target_code,skill_codes:string[]}` → `{target_code,skill_codes}`. Editor only. Atomically replaces that course/lesson's mappings. Codes must reference `kind=skill` nodes. Creating/editing skills continues using `admin_save`.
- `skill_progress {}` → `{skills:[{code,title,required,completed,percent,verified}]}` for the current learner. Course mappings expand to required lessons, direct lesson mappings count only required lessons, and duplicate links count once. Verified means a nonempty mapped required lesson set is completely present in server `aa_progress`; optional lessons, self-reported flags and mere enrollment cannot grant mastery. No inferred or seeded mappings.

## Existing Stars products

Editors set Academy course `data.legacy_course_id` to an existing `courses.id`. The server validates the ID; client `paid`, `has_access` or price flags have no effect. `course` adds `offer: null | {legacy_course_id,title,price_stars,has_access,purchasable}`. Use the existing course invoice API with `offer.legacy_course_id`; the extension creates neither invoices nor grants. Unmapped Academy courses remain free. A linked published product priced at zero remains free. Paid access requires a current existing `course_access` row, including admin/invites grants. An unpublished linked product is unavailable.

Enrollment, content reads, completion, quiz start/submit, submission save/submit and certificate issuance recheck grants. Refund deletion removes access to already-open attempts. The grant row is locked against refund deletion during a transaction. Course metadata remains readable to show the offer. Editors retain draft content preview; they receive no exemption for learner submissions or completion.

## Shared block bank

- `block_list {code?:string}` → `{blocks:[{code,version,state,payload}]}`, editor only, at most 500 versions.
- `block_save {code,expected_version:number,state:'draft'|'approved'|'published',payload:ContentBlock}` → saved `{code,version,state,payload,created_at}`. `expected_version=0` creates a new code; subsequent saves match the latest version. Each save inserts a new immutable version. A published version requires the latest version to be approved with exactly the same payload. Conflict → `academy_version_conflict`.
- A lesson embeds `{type:'reference',ref_code:'BLOCK-CODE',ref_version:2}`. Only that exact published version resolves. Missing/draft/approved references reject authoring and reads. Published bank payloads cannot reference other bank blocks. Lesson `blocks` contains sanitized resolved payloads, and newer versions never silently replace pinned references.
- Completion preserves a resolved content snapshot on the first completion. Previously completed attempts/submissions and their grading snapshots are untouched. Historical completions present before migration retain null snapshots until completed again; no historical content is fabricated.

Authorized lesson reads also return `localized_blocks: {en?: ContentBlock[], kk?: ContentBlock[]}`. These use explicitly authored translation blocks (`content_blocks`, `blocks`, or `contentBlocks`, nested `data` overrides flat fields), or an authored string `body`/`text`/`content`. Empty or absent translations fall back to the main `blocks` in the UI. Locale keys accept uppercase inputs and normalize to lowercase outputs. Translated bank references must pin an existing published version; authoring and reads reject unpublished pins. Resolved translated blocks are recursively scrubbed of grading/editor keys and are also available under `lesson.data.translations[locale].content_blocks`. Catalog/course metadata never include them. No text is automatically translated.

## Analytics

`analytics {}` → `{funnel:[{event,count,learners}],dropout:[{course_code,enrolled,started,completed,inactive}],time_to_first_result:{learners,median_seconds}}`, editor only. Empty durations return `median_seconds:null`. Inactive means enrolled, incomplete and no course activity for seven days. Completed uses server required lesson progress. Time to first result measures first successful quiz or lesson completion after first enrollment, per learner. It is an aggregate across the Academy, not a per-course attribution metric.

Events are written only after successful server actions and deduplicated by learner/event/entity. Enum: `catalog_view`, `course_view`, `enrolled`, `lesson_open`, `quiz_started`, `quiz_passed`, `submission_submitted`, `lesson_completed`, `certificate_issued`. The table stores only actor ID (internal aggregation), enum, entity code and timestamp. It has no client event action, arbitrary payload, prompt, answer, artifact, email or Telegram profile fields. Aggregates expose no learner IDs. Editor preview reads currently contribute read events; admin edits do not.

## Deployment and checks

New tables have RLS and revoke PUBLIC/anon/authenticated privileges; helpers and both dispatchers are executable only by service_role. Apply `20261018150000_ai_academy_completion.sql` after the original migration, then deploy the API allowlist update. No cloud deployment is performed locally. Supabase CLI is absent; the additive timestamped migration is exercised with PGlite and existing `001`, `006`, and base Academy migrations. Test: `node --test tests/api/academy-completion.test.mjs`.

When the optional later files migration provides `aa_valid_files(bigint,text,jsonb)`, submission save and submit validate `artifact.file_ids` through that helper, bound to the exact assessment code. Until then nonempty file IDs reject.

