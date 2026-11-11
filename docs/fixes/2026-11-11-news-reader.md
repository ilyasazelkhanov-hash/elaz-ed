# News sources, freshness notices and course recommendations

Base: `main` at `a9e047c6fc8392dbda8f295010af2f1b102a471b`.

## Reader changes

- News has one structured «Первоисточники» footer from the existing `editorial.sources` authoring contract. Equivalent source URLs are deduplicated for display only, preserving document/query identity and the original stored objects.
- Legacy Markdown appendices named «Источники анонса», «Источники», «Первоисточники» and close news-specific variants lose their source-list heading and bibliography entries in the reader. Substantive paragraphs, inline citations, reference definitions, code fences, indentation and subsequent sections remain. Stored `body` and metadata are not rewritten.
- The reader never promotes a secondary announcement/repost or a link found in Markdown into `editorial.sources`. With no primary metadata it says «Первоисточники пока не указаны». Authoring guidance now requires verified original announcements, documentation or research, not media reports.
- News no longer displays the normal «Обновление инструмента» metadata box, reviewer or review schedule. An expired `review_due` remains an editorial task, not a reader-facing assertion of obsolescence. Non-news learning summaries keep their previous behavior.
- Only an explicit editor-authored `outdated_note` plus a safe `outdated_source_url` shows «Материал устарел», with the specific reason and original confirmation link. Neither age nor an expired review date creates it.
- The end of each news article recommends up to two relevant OG courses. Matching uses concrete subjects in the title/subtitle, resolves each course uniquely against the current server catalog, and requires a positive integer lesson count. Missing, ambiguous and empty courses are omitted. Current access/pricing comes from the catalog. No new-course coverage or free access is invented. No match has an honest empty state.

## Deployment and safety

Vercel/frontend deployment suffices for deduplicated source presentation, hidden routine metadata, and recommendations on existing and future articles. No production data migration, source rewrite, course access change, or resend is needed.

The updated `api` Edge Function is needed before newly authored `outdated_note` / `outdated_source_url` can round-trip through the editor. The schema remains the existing `editorial` JSON object: no SQL migration or permission change. This task did not deploy the API or access/change production data.

If the frontend is deployed before the API, the editor checks the saved response for both notice fields. A dropped or changed notice is reported as partial success, with the unsaved notice retained locally and the confirmed article ID preserved to prevent duplicate creation. It does not falsely confirm the notice or automatically retry the write.

The primary-source authority of existing production URLs was not independently re-audited. The implementation trusts the pre-existing author-designated `editorial.sources`, not source URL shape or a body fallback. Production article counts and the number needing source verification are unknown; no claim of a completed editorial fact-check is made.

## Verification

- Focused reader/editorial/navigation regressions: 28 passed, including legacy heading variants, setext section boundaries, source-only versus prose attributions, reference definitions, preserved code, canonical deduplication, unavailable/ambiguous courses, live access/pricing and recommendation navigation.
- TypeScript: passed after the final focused changes.
- API harness: 109/109 passed, including saved obsolete-notice metadata and existing authorization boundaries.
- Independent review reproduced three Markdown issues; all three were fixed and regression-tested. The reviewer confirmed no secondary-source promotion and verified the old-API partial-save guard.
- Aggregate runner: 32/32 stages passed, including production build. After final review fixes, affected focused tests and TypeScript passed again; the production build was repeated. Logs: `og-news-content-all.log`, `og-news-content-focused.log`, `og-news-content-build-final.log` in the shared release workspace. The integrating release task should run its combined validation after merging the category changes.
- Real-browser rendering and production source content need deployment QA; local tests do not establish those results.

## Combined release review

The category branch is integrated with both test scripts and both editor changes preserved. A further independent review found that a link-led list item could contain substantive qualifications. The reader now removes only complete source-only entries, preserving trailing prose for inline links, reference links and bare URLs. The additional regression passes; independent targeted integration checks passed 32/32. The final combined aggregate runner passed all 33/33 stages, including all test commands, TypeScript, production build and prerender. Production API and database rollout remain outside this frontend release.
