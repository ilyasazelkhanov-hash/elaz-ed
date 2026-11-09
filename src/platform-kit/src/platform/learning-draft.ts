export interface HomeworkDraft { body: string; file: string }
const memory = new Map<string, HomeworkDraft>()
export function homeworkDraftKey(app: string, actor: string, demo: boolean, entity: string) {
  return `az-homework:v1:${[demo ? 'demo' : 'live', app, actor, entity].map(encodeURIComponent).join(':')}`
}
export function readHomeworkDraft(key: string): HomeworkDraft {
  const cached = memory.get(key)
  if (cached) return cached
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (saved?.version === 1 && Number.isFinite(saved.savedAt) && saved.savedAt <= Date.now() && Date.now() - saved.savedAt < 7 * 86400000 && typeof saved.body === 'string' && saved.body.length <= 20000 && typeof saved.file === 'string' && saved.file.length <= 1000) {
      const value = { body: saved.body, file: saved.file }
      memory.set(key, value)
      return value
    }
  } catch { /* Keep navigation-safe memory when storage is unavailable. */ }
  return { body: '', file: '' }
}
export function writeHomeworkDraft(key: string, value: HomeworkDraft): boolean {
  memory.set(key, value)
  try {
    if (!value.body && !value.file) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify({ ...value, version: 1, savedAt: Date.now() }))
    return true
  } catch { return false }
}
/** A late submission must not remove edits made after the request started. */
export function clearSubmittedHomework(key: string, submitted: HomeworkDraft): boolean {
  const current = readHomeworkDraft(key)
  if (current.body !== submitted.body || current.file !== submitted.file) return false
  writeHomeworkDraft(key, { body: '', file: '' })
  return true
}
