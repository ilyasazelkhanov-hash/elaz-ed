export type AcademyKind = 'direction' | 'course' | 'module' | 'lesson' | 'source' | 'skill' | 'assessment' | 'rubric'
export type AcademyState = 'outline' | 'draft' | 'in_review' | 'approved' | 'published' | 'archived'
export interface AcademyEntity {
  code: string
  kind: AcademyKind
  parent_code: string | null
  title: string
  position: number
  state: AcademyState
  version: number
  data: Record<string, any>
  seed_managed: boolean
}
export interface AcademySourceLink {
  source_code: string
  target_code: string
  usage: string
  visibility: string
  start_seconds?: number | null
  end_seconds?: number | null
  note?: string
  source?: AcademyEntity
}
export interface AcademySeed {
  version?: string
  entities: AcademyEntity[]
  links: AcademySourceLink[]
  prerequisites: { course_code: string; requires_code: string }[]
}

/** External references are links, never executable embeds or fetch targets. */
export function safeAcademyUrl(value: unknown, startSeconds?: number | null): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    if ([...url.searchParams.keys()].some(key => /^(token|api[_-]?key|secret|authorization|access_token)$/i.test(key))) return null
    if (startSeconds != null && Number.isInteger(startSeconds) && startSeconds >= 0) {
      if (url.hostname === 'youtu.be' || /(^|\.)youtube\.com$/.test(url.hostname)) url.searchParams.set('t', `${startSeconds}s`)
    }
    return url.href
  } catch { return null }
}
