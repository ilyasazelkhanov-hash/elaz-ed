export { normalizeEditorial, editorialReviewStatus, editorialReviewLabel } from '../../supabase/functions/_shared/editorial.ts'
export type { EditorialMetadata, EditorialSource, EditorialReviewStatus } from '../../supabase/functions/_shared/editorial.ts'

/** Dedupe only the reader's list; do not rewrite the editor's stored provenance. */
export function primarySourcesForReader(sources: import('../../supabase/functions/_shared/editorial.ts').EditorialSource[] = []) {
 const seen = new Set<string>()
 return sources.filter(source => {
  const url = new URL(source.url)
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key)
  url.searchParams.sort()
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, '')
  const key = url.href
  if (seen.has(key)) return false
  seen.add(key)
  return true
 })
}

/** An older API may silently drop newly supported fields. Never report that as saved. */
export function outdatedNoticeMatches(expected: { outdated_note?: string; outdated_source_url?: string } | null | undefined, saved: { outdated_note?: string; outdated_source_url?: string } | null | undefined): boolean {
 return (expected?.outdated_note ?? '') === (saved?.outdated_note ?? '') && (expected?.outdated_source_url ?? '') === (saved?.outdated_source_url ?? '')
}
