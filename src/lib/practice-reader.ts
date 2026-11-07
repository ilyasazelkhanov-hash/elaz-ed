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
