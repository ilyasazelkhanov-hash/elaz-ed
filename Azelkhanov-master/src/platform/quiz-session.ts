import type { QuizQuestion } from './contracts.ts'
export type AnswerFeedback = { index: number; answer: number; correctIndex: number; explain: string }
export type QuizDraft = { initialized: boolean; attemptId: string; questions: QuizQuestion[]; index: number; picked: number | null; feedback: AnswerFeedback[]; score: number; done: boolean; ready: boolean; error: string }
export function createQuizSession() {
  let state: QuizDraft = { initialized: false, attemptId: '', questions: [], index: 0, picked: null, feedback: [], score: 0, done: false, ready: false, error: '' }
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set: (patch: Partial<QuizDraft>) => { state = { ...state, ...patch }; for (const listener of listeners) listener() },
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
}
// API identity changes on app/account boot, so navigation drafts cannot cross sessions.
const sessions = new WeakMap<object, Map<string, ReturnType<typeof createQuizSession>>>()
export function getQuizSession(api: object, entity: string) {
  let entities = sessions.get(api)
  if (!entities) { entities = new Map(); sessions.set(api, entities) }
  let draft = entities.get(entity)
  if (!draft) { draft = createQuizSession(); entities.set(entity, draft) }
  return draft
}
