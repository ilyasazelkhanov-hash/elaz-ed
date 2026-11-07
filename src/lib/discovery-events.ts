import { beginnerGuides } from './beginner-content.ts'
import type { ClientEvent } from './types'

/** Revision of the original five exercises; bump deliberately when their substance changes. */
export const GUIDE_CONTENT_VERSION = 'free-guides-v1'
export const discoveryEventNames = ['guide_open','guide_copy','guide_try','guide_feedback','blog_save','course_view','course_preview','checkout_start','checkout_result','discovery_open'] as const
export type DiscoveryEventName = typeof discoveryEventNames[number]
const sources = ['direct','home','free_start','guide_next','telegram_guide','blog','post','course','telegram_post','telegram_course'] as const
export type DiscoverySource = typeof sources[number]
const knownGuide = (value: unknown): value is string => typeof value === 'string' && beginnerGuides.some(guide => guide.id === value)
const positiveId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const version = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value)
export function normalizeDiscoverySource(value: unknown): DiscoverySource {
 return sources.includes(value as DiscoverySource) ? value as DiscoverySource : 'direct'
}
export function guideStartParam(guideId: string): string | null {
 return knownGuide(guideId) ? 'g_' + guideId : null
}
export function parseGuideStartParam(value: unknown): {guideId: string; source: 'telegram_guide'} | null {
 if (typeof value !== 'string' || value.length > 64 || !value.startsWith('g_')) return null
 const guideId = value.slice(2)
 return knownGuide(guideId) ? {guideId,source:'telegram_guide'} : null
}
/** This is an allowlist, not a generic property copier. Never send prompts, answers or raw entry parameters. */
export function discoveryEvent(name: DiscoveryEventName, input: Record<string, unknown> = {}, lessonId?: number): ClientEvent | null {
 if (!discoveryEventNames.includes(name)) return null
 const source = normalizeDiscoverySource(input.source)
 if (name.startsWith('guide_')) {
  if (!knownGuide(input.guide_id)) return null
  const props: NonNullable<ClientEvent['props']> = {guide_id:input.guide_id,content_version:GUIDE_CONTENT_VERSION,source}
  if (name === 'guide_feedback') {
   if (typeof input.useful !== 'boolean') return null
   props.useful = input.useful
  }
  return {name,props}
 }
 const props: NonNullable<ClientEvent['props']> = {source}
 if (name === 'blog_save') {
  if (!positiveId(lessonId) || typeof input.saved !== 'boolean') return null
  props.saved = input.saved
  if (version(input.content_version)) props.content_version = input.content_version
  return {name,lesson_id:lessonId,props}
 }
 if (name !== 'discovery_open') {
  if (!positiveId(input.course_id)) return null
  props.course_id = input.course_id
  if (version(input.content_version)) props.content_version = input.content_version
 }
 if (name === 'course_preview') {
  if (!positiveId(lessonId)) return null
 }
 if (name === 'checkout_result') {
  if (!['paid','cancelled','failed','pending'].includes(input.status as string)) return null
  props.status = input.status as string
 }
 return {...(name === 'course_preview' ? {lesson_id:lessonId} : {}),name,props}
}
export function guideEvent(action: 'open'|'copy'|'try'|'feedback', guideId: string, source: DiscoverySource = 'free_start', useful?: boolean) {
 return discoveryEvent(`guide_${action}`,{guide_id:guideId,source,useful})
}
