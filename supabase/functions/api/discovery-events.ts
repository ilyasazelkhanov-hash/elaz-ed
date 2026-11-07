/** Untrusted telemetry is allowlisted separately from server payment records. */
const names = ['guide_open','guide_copy','guide_try','guide_feedback','blog_save','course_view','course_preview','checkout_start','checkout_result','discovery_open']
const guides = ['first-request','check-answer','choose-tool','image-brief','safe-workflow']
const sources = ['direct','home','free_start','guide_next','telegram_guide','blog','post','course','telegram_post','telegram_course']
const id = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
const token = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(v)
export function cleanDiscoveryEvent(value: unknown): { name:string; lesson_id:number|null; props:Record<string,string|number|boolean> } | null {
 if (!value || typeof value !== 'object') return null
 const e=value as Record<string,unknown>
 if (typeof e.name!=='string' || !names.includes(e.name) || !e.props || typeof e.props!=='object' || Array.isArray(e.props)) return null
 const p=e.props as Record<string,unknown>
 const props:Record<string,string|number|boolean>={source:sources.includes(String(p.source))?String(p.source):'direct'}
 if (e.name.startsWith('guide_')) {
  if (!guides.includes(String(p.guide_id)) || !token(p.content_version)) return null
  props.guide_id=String(p.guide_id); props.content_version=p.content_version
  if(e.name==='guide_feedback'){if(typeof p.useful!=='boolean')return null;props.useful=p.useful}
 } else if(e.name==='blog_save') {
  if(!id(e.lesson_id)||typeof p.saved!=='boolean')return null
  props.saved=p.saved
 } else if(e.name!=='discovery_open') {
  if(!id(p.course_id))return null
  props.course_id=p.course_id
  if(e.name==='course_preview'&&!id(e.lesson_id))return null
  if(e.name==='checkout_result'){if(!['paid','cancelled','failed','pending'].includes(String(p.status)))return null;props.status=String(p.status)}
 }
 if(!e.name.startsWith('guide_')&&token(p.content_version))props.content_version=p.content_version
 return {name:e.name,lesson_id:(e.name==='blog_save'||e.name==='course_preview')&&id(e.lesson_id)?e.lesson_id:null,props}
}
export const isDiscoveryEvent = (name: unknown) => typeof name==='string' && names.includes(name)
