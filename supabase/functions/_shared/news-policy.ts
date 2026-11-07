/** Text-only policy. Course bodies stay on the server or in the publishing CLI. */
export function normalizedNewsText(value: string): string {
 return value.normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/<[^>]*>/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ')
}

export function newsShingles(body: string): Set<string> {
 const words=normalizedNewsText(body).split(' ').filter(Boolean)
 return new Set(words.slice(0,-4).map((_,i)=>words.slice(i,i+5).join(' ')))
}

export interface CoursePolicyText { id: number | string; body: string }
export function courseOverlapReport(candidateBody: string, courses: CoursePolicyText[]) {
 const normalized=normalizedNewsText(candidateBody), candidate=newsShingles(candidateBody)
 const wordCount=normalized?normalized.split(' ').length:0
 return courses.map(course=>{
  const body=normalizedNewsText(course.body), shingles=newsShingles(course.body)
  let shared=0
  for(const item of candidate)if(shingles.has(item))shared++
  const containment=candidate.size?shared/candidate.size:0
  const exact=!!normalized&&body===normalized
  const excerpt=wordCount>=40&&(` ${body} `).includes(` ${normalized} `)
  return {id:course.id,shared_shingles:shared,candidate_shingles:candidate.size,containment,blocked:exact||excerpt||(shared>=100&&containment>=0.6)}
 })
}

export function assertNoCourseOverlap(candidateBody: string, courses: CoursePolicyText[]) {
 const blocked=courseOverlapReport(candidateBody,courses).filter(item=>item.blocked)
 if(blocked.length)throw new Error(`course_overlap:${JSON.stringify(blocked)}`)
}
