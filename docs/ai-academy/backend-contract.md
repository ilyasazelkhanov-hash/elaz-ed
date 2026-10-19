# AI Academy backend contract

The existing API verifies Telegram initData, obtains the actor from the existing user/session flow, and calls `handleAcademy(db, {id,is_admin}, action, payload)`. The handler returns the RPC JSON value; failures throw `AcademyError` with `status` and `code`. SQL independently resolves the administrator from numeric Telegram IDs in `settings.admins`. The passed `is_admin` flag and client payload never grant SQL privileges. Optional `aa_roles` rows grant `editor` or `instructor`; an instructor sees only assigned submissions and cannot review their own work. Only administrators import seed data and approve placement requests.

All SQL entrypoints and tables are revoked from PUBLIC, anon and authenticated. The existing API's service role invokes `academy_action(p_actor bigint,p_action text,p_payload jsonb)`. RLS is enabled on every new table. No service key goes to the client. No existing curriculum/progress rows are modified.

## Entity

`{code,kind,parent_code,title,position,state,version,data,seed_managed}`. Kinds: direction/course/module/lesson/source/skill/assessment/rubric. States: outline/draft/in_review/approved/published/archived. CORE is a course with a null direction. Children have parent kinds checked in SQL. Deletion has no API; archive instead. Stable codes are immutable. Manual editing/reordering clears `seed_managed`; imports preserve those records.

Lesson content uses `data.content_blocks` (legacy `blocks`/`contentBlocks` accepted), with safe renderer-supported block types. Author supplied Markdown is rendered with the frontend's existing sanitizing renderer. No arbitrary HTML/embed execution or file upload/storage integration is provided. Content and source URLs accept HTTPS; sources reject obvious credential query parameters. Source canonical URL is `data.canonical_url` or `data.url`.

Public projections allow only documented curriculum metadata. Unpublished lesson bodies, assessment questions/keys, source editor notes and private attempts are excluded from catalog/course responses. Lesson bodies require a published lesson, published course, active enrollment and satisfied prerequisites. Editor preview can read draft lessons. Sources require explicit editorial publication; `rights_state` must be approved/owned/licensed/public_link, `link_state=verified`, and `checked_at` must be populated. Methodological/internal links are never returned to learners, even if a link visibility is accidentally changed.

## Actions

| Action | Payload | Result |
|---|---|---|
| catalog | q?, level?, direction?, offset?, limit? | directions, courses, total |
| course | code: course | course, modules, lessons (metadata), sources, enrollment, progress, prerequisites, eligible |
| lesson | code: lesson | lesson, blocks, sources, assessment metadata, progress, own submissions with reviews |
| library | q?, language?, source_type?, offset?, limit? | sources, total; case-insensitive language tokens (e.g. RU/EN) and normalized documentation/course/video/research categories |
| my | {} | own enrollments with course/progress, progress, submissions with reviews, certificates, placements, roles, permissions |
| permissions | {} | admin, editor, instructor booleans from database identity and grants |
| audit / admin_audit | offset?, limit?, code? | entries and total; editor/admin only |
| enroll | code: course | enrollment; outline/draft courses create waiting entries |
| complete | code: lesson | computed course progress; all published assessments must have a passing attempt/submission of the current version |
| quiz_start | code: assessment | id, assessment_code, questions without keys, passing_score; resumes the current unfinished attempt |
| quiz_submit | attempt_id, answers: integer[] | id, score (0–100), passed; immutable/idempotent after submission |
| submission_save | code: assessment, artifact: object | own draft submission; later revisions become separate versioned rows |
| submission_submit | submission_id | own submitted row |
| review_queue | {} | submitted assignments available to reviewer, published rubrics, pending placements for admin |
| review | submission_id, decision: passed/failed/needs_revision, scores: object, gates: object, feedback: string | immutable review with score; rubric maximums, threshold and critical gates checked on server |
| placement | code: course, evidence_url: HTTPS | pending request |
| placement | placement_id, state: passed/failed, reason | admin review; self approval forbidden |
| certificate | code: course | own certificate only after required lessons, prerequisites and reviewed capstone score ≥70 |
| certificate_verify | verify_code | code, course_code, title, issued_at, valid; no learner PII; currently requires authentication through the existing API |
| admin_list | kind?, parent_code?, q?, offset?, limit? | complete entities, total |
| admin_save | entity, expected_version (0 for new), links?: SourceLink[] | versioned saved entity, audit snapshot; wrong version returns conflict |
| admin_reorder | parent_code, kind, codes: all siblings in order | updated count; full permutation required, atomic swap supported |
| admin_import | entities, links?, prerequisites?, dry_run (default true) | dry_run, entities, links; preview runs the same transaction and rolls it back |
| admin_roles | {} | roles: array of user_id/role grants; admin only |
| admin_roles | user_id, role: editor/instructor, enabled: boolean | add/remove one grant; audited, admin only |
| admin_roles | user_id, roles: string[] | replace that user's grants; audited, admin only |
| admin_assign | submission_id, assigned_to | assign an instructor with an existing grant; self-review rejected |

`SourceLink = {source_code,target_code?,usage,visibility,start_seconds?,end_seconds?,note?}`. For `admin_save`, an explicit nonempty `target_code` selects the target; otherwise the saved entity is the target. Source editors must provide the lesson/module/course target. SQL validates both source kind and target kind before writing. Links are upserted by source/target/usage/start; set visibility internal to withdraw a link. Import always creates source links as internal and never overwrites editorial link changes. `prerequisites=[{course_code,requires_code}]`; imports reject missing courses and dependency cycles. No network URL checks happen during reads or import.

## Authoring assessments

Quiz/placement assessment data:

```json
{"kind":"quiz","passing_score":70,"max_attempts":3,"questions":[{"id":"q1","prompt":"Question","choices":["A","B"],"answer":1}]}
```

`correct` is accepted as an alias for `answer`. Questions/choices/keys and attempt limits are validated before publication. `quiz_start` snapshots all questions and grading policy; edits cannot change an in-progress grade. Only public question fields are returned. Keys are never returned, including after grading.

Assignment/capstone assessment data: `{kind:"assignment"|"capstone",rubric_code:"RUBRIC",instructions:"..."}`. A published rubric is required. Rubric data:

```json
{"criteria":[{"code":"quality","max_score":100,"critical":false}],"critical_gates":["no_secrets"]}
```

Review scores map criterion codes to numeric scores; gates map gate codes to booleans. Pass requires ≥70%, full points on critical criteria, and every critical gate true. The submission stores assessment version and immutable rubric data/code/version. Review history remains on the earlier submission when a learner creates V2. Artifacts remain private by default; storage uploads and public portfolio sharing need a separately authorized provider integration.

## Completion and publication

Publication requires approved state first. Lessons need meaningful authored blocks (nonblank text/instructions or a published source reference). Microlecture/resource/guided_demo formats can be marked studied without an assessment; all other formats require a published assessment and a passing attempt/review. Courses need published lessons with no outstanding required draft/outline lessons. A completed prerequisite is either all required lessons passed, a valid certificate, or an approved placement for the target course. Progress is computed from required non-archived lessons, so outline lessons do not produce fake 100% progress. Certificates additionally require a reviewed capstone. Enrollment never awards completion, XP, badges or a certificate. Editor preview does not bypass completion checks.

Assessment start/save and submit revalidate every publication ancestor (including module), enrollment and prerequisites. Revoked access therefore blocks pending submissions and attempts. Public lesson blocks are recursively stripped of grading keys and editorial fields even when an editor accidentally embeds those fields in a block. Administrator identity never authorizes reviewing one's own work. Instructor placement approvals are restricted to administrators until placement reviewer assignment is implemented.

Seed input is curriculum metadata, not fabricated lessons. Imported states must be outline/draft. Identical imports do not increment versions. Preview validates FK references, tree types, uniqueness and cycles without persisting changes; malformed imports roll back completely. Import and all writes use a transaction advisory lock. Published/manual records and manual source links survive repeated imports. Archive and old audit snapshots preserve learning history.

## Local verification and rollout

Run `node --test tests/api/academy-database.test.mjs tests/api/academy-api.test.mjs`. This executes the migration on local WASM PostgreSQL and verifies the handler; it never accesses cloud databases. Supabase CLI was unavailable locally (`supabase --help` failed), so the additive timestamped migration was created directly as a documented fallback. No managed migration or deployment has been executed. Normal release preparation should apply this file to a backed-up staging database, inspect advisors and existing grants, then follow the project's production release procedure.

Current quiz grading supports single-choice questions only. Multiple choice, free-text and code execution grading are not advertised. Use rubric-reviewed assignments for code/free-text work. Certificates currently have authenticated verification; a separately routed public verification page is not deployed by this migration.
