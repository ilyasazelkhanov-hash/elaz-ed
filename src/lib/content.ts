import type { Card } from './types'

/** The original storage calls blog entries "lesson"; that is not their product role. */
export function isBlogPost(item?: Pick<Card,'kind'|'course_id'> | null) {
  return !!item && item.kind === 'lesson' && item.course_id == null
}
export function postDate(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return ''
  return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(new Date(value))
}
export function blogPostEntry(hash:string):number|null {
  const match=/^#\/blog\/([1-9]\d*)$/.exec(hash),id=Number(match?.[1])
  return Number.isSafeInteger(id)&&id>0?id:null
}
