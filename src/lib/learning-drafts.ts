/** Session-only learner input. Question keys and grading feedback are never persisted. */
type Answer = number | number[] | string
type Draft = { version: 1; savedAt: number; scrollTop?: number; attemptId?: string | number; signature?: string; answers?: Record<string, Answer> }
const MAX_BYTES = 250000
export function learningDraftKey(scope: string, actor: string | number | undefined, entity: string | number) {
  return actor == null ? null : `learning-draft:v1:${encodeURIComponent(scope)}:${encodeURIComponent(String(actor))}:${encodeURIComponent(String(entity))}`
}
function valid(value: unknown): value is Draft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const d = value as Draft
  if (d.version !== 1 || !Number.isFinite(d.savedAt) || d.savedAt > Date.now() || Date.now() - d.savedAt >= 7 * 86400000) return false
  if (d.scrollTop !== undefined) return Object.keys(d).every(k => ['version','savedAt','scrollTop'].includes(k)) && Number.isFinite(d.scrollTop) && d.scrollTop >= 0 && d.scrollTop <= 10000000
  if (!['string','number'].includes(typeof d.attemptId) || !String(d.attemptId).length || String(d.attemptId).length > 128 || typeof d.signature !== 'string' || d.signature.length > 128 || !d.answers || typeof d.answers !== 'object' || Array.isArray(d.answers)) return false
  if (typeof d.attemptId === 'number' && (!Number.isSafeInteger(d.attemptId) || d.attemptId <= 0)) return false
  if (!Object.keys(d).every(k => ['version','savedAt','attemptId','signature','answers'].includes(k))) return false
  return Object.entries(d.answers).length <= 100 && Object.entries(d.answers).every(([key, a]) => key.length <= 128 && !['__proto__','constructor','prototype'].includes(key) && (typeof a === 'string' ? a.length <= 20000 : typeof a === 'number' ? Number.isInteger(a) && a >= 0 && a < 100 : Array.isArray(a) && a.length <= 100 && new Set(a).size === a.length && a.every(n => Number.isInteger(n) && n >= 0 && n < 100)))
}
export function readLearningDraft(key: string | null): Draft | null {
  if (!key) return null
  try { const raw = sessionStorage.getItem(key); if (!raw || raw.length > MAX_BYTES) return null; const value: unknown = JSON.parse(raw); return valid(value) ? value : null } catch { return null }
}
export function writeLearningDraft(key: string | null, input: Record<string, unknown>): boolean {
  if (!key) return false
  try { const value = { ...input, version: 1, savedAt: Date.now() }; if (!valid(value)) return false; const raw = JSON.stringify(value); if (raw.length > MAX_BYTES) return false; sessionStorage.setItem(key, raw); return true } catch { return false }
}
export function clearLearningDraft(key: string | null) { if (key) try { sessionStorage.removeItem(key) } catch { /* Storage may be unavailable. */ } }
export function questionSignature(questions: unknown) { const value=JSON.stringify(questions) ?? ''; let hash=2166136261; for(let i=0;i<value.length;i++) hash=Math.imul(hash^value.charCodeAt(i),16777619); return `${value.length}:${hash>>>0}` }
export function restoreLearningAnswers(saved: Draft | null, attemptId: string | number, questions: any[]): Record<string, Answer> | null {
  if (!saved || !valid(saved) || String(saved.attemptId) !== String(attemptId) || saved.signature !== questionSignature(questions)) return null
  const answers = saved.answers || {}
  for (const [key, answer] of Object.entries(answers)) {
    const q = questions.find((q, i) => String(q.id ?? i) === key)
    if (!q) return null
    const type = q.type || 'mcq', size = (q.choices || q.options || []).length
    if (type === 'text' || type === 'code') { if (typeof answer !== 'string') return null }
    else if (type === 'multi') { if (!Array.isArray(answer) || answer.some(i => i >= size)) return null }
    else if (typeof answer !== 'number' || answer >= size) return null
  }
  return answers
}
