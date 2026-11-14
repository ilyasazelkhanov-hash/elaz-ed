export type PracticeReaderView = 'all' | 'reading' | 'practice' | 'check' | 'resources'
export type PracticeReaderDraft = { view: PracticeReaderView; answer: string }
const views = new Set<PracticeReaderView>(['all', 'reading', 'practice', 'check', 'resources'])

/** The lesson text stays on the server; only a learner's own draft is stored here. */
export function practiceReaderStorageKey(userId: string | number | undefined, courseKey: string, lessonKey: string) {
 return userId === undefined ? null : `og-reader-v1:${[String(userId), courseKey, lessonKey].map(encodeURIComponent).join(':')}`
}

export function readPracticeReaderDraft(key: string | null, storage?: Pick<Storage, 'getItem'>): PracticeReaderDraft {
 const fallback: PracticeReaderDraft = {view: 'reading', answer: ''}
 if (!key) return fallback
 try {
  const value: unknown = JSON.parse((storage ?? localStorage).getItem(key) || 'null')
  if (!value || typeof value !== 'object') return fallback
  const draft = value as Record<string, unknown>
  return {view: typeof draft.view === 'string' && views.has(draft.view as PracticeReaderView) ? draft.view as PracticeReaderView : 'reading', answer: typeof draft.answer === 'string' ? draft.answer : ''}
 } catch { return fallback }
}

/** Only actual headings disclose an answer, never a heading inside a fenced example. */
export function splitPracticeCheck(markdown: string): {question: string; answer: string} {
 let fence: {marker: string; length: number} | null = null, offset = 0
 for (const line of markdown.split('\n')) {
  const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
  if (marker) {
   if (!fence) fence = {marker: marker[1][0], length: marker[1].length}
   else if (marker[1][0] === fence.marker && marker[1].length >= fence.length && !marker[2].trim()) fence = null
  } else if (!fence && /^##\s+Разбор ответа(?:\s|$)/i.test(line)) {
   return {question: markdown.slice(0, offset), answer: markdown.slice(offset)}
  }
  offset += line.length + 1
 }
 return {question: markdown, answer: ''}
}

/** Lossless reading pages, not generated lessons. Never split a fenced example,
 * table, list continuation, or heading from its first paragraph. Oversized atomic
 * blocks remain scrollable. Reference definitions need the whole document scope. */
export function practiceReadingPages(markdown: string, target = 600): string[] {
 if (!markdown || /^ {0,3}\[[^\]]+\]:\s*\S/m.test(markdown)) return [markdown]
 const blocks: string[] = []
 let start=0,offset=0,blank=false,last='',kind='',fence:{marker:string;length:number}|null=null
 for (const line of markdown.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
  const text=line.replace(/\r?\n$/, ''), nonempty=!!text.trim()
  if (!fence && nonempty && blank && offset>start && !/^ {0,3}#{1,6}\s/.test(last)) {
   const listContinues=kind==='list'&&(/^(?: {0,3}(?:[-+*]|\d+[.)])\s|[\t ]+\S)/.test(text))
   const quoteContinues=kind==='quote'&&/^ {0,3}>/.test(text)
   const codeContinues=kind==='code'&&/^(?: {4}|\t)/.test(text)
   if (!listContinues&&!quoteContinues&&!codeContinues) {blocks.push(markdown.slice(start,offset));start=offset;kind=''}
  }
  if (!kind&&nonempty) kind=/^ {0,3}(?:[-+*]|\d+[.)])\s/.test(text)?'list':/^ {0,3}>/.test(text)?'quote':/^(?: {4}|\t)/.test(text)?'code':'other'
  const marker=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text)
  if(marker){if(!fence)fence={marker:marker[1][0],length:marker[1].length};else if(marker[1][0]===fence.marker&&marker[1].length>=fence.length&&!marker[2].trim())fence=null}
  blank=!nonempty&&!fence
  if(nonempty)last=text
  offset+=line.length
 }
 if(start<markdown.length)blocks.push(markdown.slice(start))
 const pages:string[]=[];let page=''
 for(const block of blocks){
  if(page&&page.length+block.length>target){pages.push(page);page=''}
  page+=block
 }
 if(page)pages.push(page)
 return pages.length?pages:[markdown]
}


export type PracticeReaderBookmark = {revision:string; page:number; mode:'reading'|'training'}

/** Local bookmark invalidation only, NOT an entitlement or content-authenticity hash.
 * Store no lesson text, only two checksums plus its length. */
export function practiceReaderRevision(body:string):string {
 let first=2166136261,second=5381
 for(let i=0;i<body.length;i++) {
  first=Math.imul(first^body.charCodeAt(i),16777619)
  second=Math.imul(second,33)^body.charCodeAt(i)
 }
 return `reading-v1:${body.length}:${first>>>0}:${second>>>0}`
}

export function readPracticeReaderBookmark(key:string|null,revision:string,storage?:Pick<Storage,'getItem'>):PracticeReaderBookmark {
 const fallback:PracticeReaderBookmark={revision,page:0,mode:'reading'}
 if(!key)return fallback
 try {
  const value:unknown=JSON.parse((storage??localStorage).getItem(key+':bookmark')||'null')
  if(!value||typeof value!=='object')return fallback
  const saved=value as Record<string,unknown>
  if(saved.revision!==revision)return fallback
  return {revision,page:typeof saved.page==='number'&&Number.isSafeInteger(saved.page)&&saved.page>=0?saved.page:0,mode:saved.mode==='training'?'training':'reading'}
 }catch{return fallback}
}
