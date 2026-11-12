# Plain dashes in presentation

User preference: ordinary hyphens in product copy, not typographic long dashes.

## Scope

- Parsed TS/TSX string literals, template segments and JSX text in application-owned `src`: mechanical punctuation-only edits. No identifiers, operators, regular expressions or comments were rewritten.
- Short title/label/subtitle/description/summary/name/headline/text/hint fields in local JSON presentation data.
- Markdown rendering normalizes prose text **after parsing**, not the original string. Fenced/inline code, raw HTML, blockquotes, link destinations and definitions stay intact. Curly-quoted phrases and numeric intervals are preserved.
- News-card title/teaser presentation is normalized without mutating source records.

## Intentional exclusions

Database records, existing Telegram posts, external source material, licenses, generated historical migrations and technical docs are not bulk rewritten. Numeric date/range separators, code examples, URLs and verbatim quotations are retained. New render normalization affects current/future Markdown prose but not its stored source or code-copy controls.

The Daily component is owned by the concurrent compact-series change, which removes its old long-dash copy. Other concurrent UI additions should use ordinary hyphens.

## Verification

TypeScript pass. Content revision and Markdown typography tests pass. Feed SSR harness uses the actual typography function; title source immutability is asserted. Full integrated regression required after merging concurrent work.
