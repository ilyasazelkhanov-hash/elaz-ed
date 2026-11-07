# News and course practice overlap — 7 November 2026

The read-only editorial audit used the application snapshot taken at **2026-11-07 06:40 UTC**. It inspected only lesson/course editorial fields. This report contains no article bodies, account data, credentials, payment records, or learner records. It describes the snapshot; a hash-guarded live update must check current rows separately.

There were **130 published standalone articles** and **50 published bound lessons in six paid courses**. No standalone body was byte-identical to a current bound course lesson. Eight articles nevertheless reproduce substantial authored course practice, with direct source provenance.

## Confirmed shared practice

All eight standalone bodies exactly match `content/ai-practice-2026-10-25/reference-posts.json`. Its generator, `build-reference-expansion.mjs`, imports `labs` and `renderLab` from `training-labs.mjs`. The same labs supply the historical `training.json` lessons and current paid course practice through `path-lessons.mjs` and `fromLab`. This is shared exercise text, not a conclusion based on matching topics.

| Article ID | Title | Source lesson key | Current course / lesson | Current containment | Historical containment |
| --- | --- | --- | --- | ---: | ---: |
| 159 | Как выбрать ИИ-инструмент и не утонуть в каталогах | block-1 | 3 / 169 | 64.19% | 82.10% |
| 160 | Gemini Notebook: исследование по своим документам | block-2 | 4 / 170 | 72.48% | 82.21% |
| 161 | ИИ-отчёт по таблице: сначала контрольные числа | block-3 | 4 / 171 | 69.40% | 84.70% |
| 162 | Gamma 5: от брифа к проверяемой презентации | block-4 | 4 / 172 | 71.82% | 74.91% |
| 163 | Descript: одна запись, клип, субтитры и пост | block-5 | 5 / 174 | 65.22% | 86.29% |
| 164 | Claude Desktop: поручение с готовыми файлами | block-native-automation | 7 / 179 | 73.15% | 86.58% |
| 165 | Автоматизация для бизнеса: карта процесса до запуска | block-8 | 7 / 181 | 68.15% | 83.87% |
| 166 | OpenCode: как принять работу агента, а не только макет | block-opencode | 6 / 176 | 13.36% | 82.76% |

For ID 166, the historical `block-opencode` identity now belongs to current lesson 157, while its shared lab is used by current `coding-spec`, lesson 176. A course link should target course 6 or the reviewed current exercise, rather than infer the destination from the old key alone.

Containment means the percentage of distinct article five-word shingles present in the compared course body. Normalization lowercases text, applies Unicode NFKC, removes HTTP(S) URLs, and converts punctuation/whitespace to word separators. It retains letters and digits. The denominator is the article's distinct shingles; the percentages are **not** Jaccard similarity, semantic similarity, or the fraction of the longer course copied. Historical comparison uses the matching `training.json` lesson. Current comparison uses bound course lessons from the snapshot.

## Scope of editorial decisions

The remaining 122 articles have at most **1.28%** containment in a current bound lesson under the same comparison. Similar topics alone do not establish that a free guide reproduces paid material.

A broad editorial classification estimates **45 educational/case/practice evergreen articles**, **40 resource-directory cards**, and **45 dated or product-feature/update candidates**. Thus 85 items are evergreen or resources and 45 are news-like. This is a content-format assessment, not external verification of freshness or factual claims. Only the eight rows above are confirmed course-practice overlap requiring suppression under this fix.

IDs **151** (OpenBot) and **153** (Agent Reach) have practice/completion sections and merit separate editorial review. Their current-course textual overlap is low; this audit does not automatically classify them, beginner guides, glossaries, prompts, or resource cards as paid course duplicates.

## Source and import policy

The eight reference records now carry `news_eligible: false` and provenance with role `course_practice`, source pack `ai-practice-2026-10-25`, source file `training-labs.mjs`, and the original source lesson key. Their authored bodies are unchanged.

The importer requires this exclusion flag and provenance role, inserts new reference rows with `news_eligible=false`, and restores the exclusion on repeat imports using the existing import map. It preserves the batch key and existing lesson IDs, bodies, publication timestamps/state, course bindings, likes, and progress. The database migration adding `lessons.news_eligible` must precede use of the regenerated import SQL.

Application and publisher filtering should exclude these rows from news using the eligibility field. Keep historical standalone links resolvable and retain course access checks. Do not delete, unpublish, rebind, or award course access as part of news suppression. Saved links and learner records remain attached to their original IDs.

For new editorial deduplication, direct authored-source provenance is decisive. Similarity can suggest review: at least 60% containment with at least 100 shared distinct five-word shingles is strong evidence, but a shared title/topic alone is insufficient. ID 166 demonstrates why a source relationship can remain decisive after course rewrites lower current overlap.

## Exact body preconditions

These SHA-256 values cover each article's original UTF-8 `body` string without normalization. Apply the eight-row production change only after validating IDs, standalone status, and current hashes transactionally; abort on mismatch for review.

| Article ID | SHA-256 |
| --- | --- |
| 159 | `e22c9441dac9b1b2a2d3ec649222012b07009db4453dd16ff5098cef82d8bb03` |
| 160 | `48d757ca2c907f0c767c2883e15255a6b962e43c1c3546ef6499b1b8cc4bf885` |
| 161 | `9c4f1431021c91d47f2a2621f0dbc2d6fad5ccb25525a5b9569459d7cd7a115a` |
| 162 | `bbf921caefab3985c2ab25ca4fee5de994b977a1051f87dece565e98da5ca455` |
| 163 | `f0b8fb6714a52c4abe8901ad4742c6020367f905972113409537ebdcbceb77fa` |
| 164 | `73943de34dff6beb8a2510b5e62e8a767eb4342f9fa2d3344c20460cddb184ea` |
| 165 | `467e364c7115a135fcc8e58238e60c7df39981ae84fc8eca421947ca16ee4b0a` |
| 166 | `0bcb190f8f746a22152e41eb8c8e88d8252d8a5596ad201527ab32c057089943` |

Focused regression command: `node --test tests/reference-expansion.test.mjs`. It exercises new imports, repeat imports after an eligibility reset, unchanged article identities/bodies/publication state, preserved progress/likes, unrelated free news, and rejection of a source payload that marks course practice eligible for news.
