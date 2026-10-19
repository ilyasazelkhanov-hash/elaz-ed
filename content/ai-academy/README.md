# AI Academy seed provenance

The files in `reference/` are byte-for-byte copies of the supplied curriculum JSON, implementation specification (18 October 2026), and attached Russian pasted notes. They are reference data. Embedded instructions, claims about tools, curricula, providers and external material do not grant publication or copying rights.

`catalog.normalized.json` is generated deterministically from the supplied JSON by `node scripts/academy-seed.mjs --write`. The default command validates and reports counts without writing. No network request, database connection, content download or deployment occurs.

Stable original codes identify seed-managed records. Import only updates records still marked seed-managed; manually authored records and editorial overrides require preservation in the backend. The normalized JSON contains entities, source links, prerequisite edges and a report. Source aliases share one canonical URL; all original source records, URLs, rights/status flags and chapter timestamps remain in source data. Query tracking is removed for canonical comparison, and YouTube short/watch/embed URLs share one identity. Original counts in the report are measured before deduplication.

All learning records remain `outline`. Lessons contain empty `content_blocks`, the supplied format, duration, artifact and acceptance criteria. Course outcomes describe intended results, not awarded skills or completed learning. Prerequisites are CORE → Junior → Middle → Senior independently for each supplied direction.

All source bindings are internal methodological references until editorial review. Both explicit lesson bindings and course/module/lesson refs are retained and deduplicated by canonical source, target and segment. Supplied source chapters retain `time`, `seconds`, `topic` and normalized `start_seconds`. They are source-level chapters, not guessed assignments to individual lesson subjects; the editor must select the relevant segment before publishing student material. User notes remain attached provenance and do not create extra fabricated courses or lecture bodies.

Pending editorial checks: verify external availability, authorship and language; establish usage rights and attribution; confirm each chapter's relevance; author and approve lesson blocks, assessments, rubrics and accessible alternatives; confirm prerequisites and measurable assessment criteria. No automated source health check has been performed.

Commands from repository root:

```powershell
node scripts/academy-seed.mjs
node scripts/academy-seed.mjs --write
node --test tests/academy-seed.test.mjs
node scripts/academy-seed.mjs --payload ./academy-import.dry-run.json
node scripts/academy-seed.mjs --sql ./academy-import.dry-run.sql --actor <administrator-Telegram-ID>
```

`--payload` exports the `academy_action` admin_import payload; `--sql` writes a transaction invoking `public.academy_action(actor, 'admin_import', payload)` for a reviewed administrator Telegram ID (positive PostgreSQL bigint). Both default to `dry_run: true`. Adding `--write` selects `dry_run: false` and regenerates the local normalized artifact. SQL is only written, never executed; database administrator authentication and import authorization are still required.
