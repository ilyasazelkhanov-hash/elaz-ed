import type { LearningGoalInput, LearningGoalState } from './types'

export type LearningSettingsSnapshot = {
  saved: LearningGoalState | null
  draft: LearningGoalInput | null
  busy: 'loading' | 'saving' | null
  error: 'load' | 'save' | 'permission' | null
  notice: string
  writePending: boolean
  needsReconcile: boolean
  saveUncertain: boolean
}

export function learningSettings(value: LearningGoalState): LearningGoalInput {
  const { enabled, goal, day, hour, timezone } = value
  return { enabled, goal, day, hour, timezone }
}

export function learningSettingsChanged(saved: LearningGoalState | null, draft: LearningGoalInput | null) {
  return !!saved && !!draft && (Object.keys(learningSettings(saved)) as (keyof LearningGoalInput)[]).some(key => saved[key] !== draft[key])
}

class SettingsTimeout extends Error {}
async function within<T>(promise: Promise<T>, milliseconds: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SettingsTimeout('timeout')), milliseconds)
    })])
  } finally { clearTimeout(timer) }
}

/** Keep confirmed settings separate from edits. A UI deadline does not cancel a write. */
export function createLearningSettings(deps: {
  load: () => Promise<LearningGoalState>
  save: (input: LearningGoalInput) => Promise<LearningGoalState>
  requestPermission: () => Promise<boolean>
  onError?: (error: unknown) => void
  timeoutMs?: number
}) {
  let state: LearningSettingsSnapshot = { saved: null, draft: null, busy: 'loading', error: null, notice: '', writePending: false, needsReconcile: false, saveUncertain: false }
  let revision = 0
  let pending = false
  // A rejected transport can outlive even a later successful request on the server.
  // Without an operation ID, keep that warning for this controller's lifetime.
  let priorUncertainWrite = false
  const listeners = new Set<() => void>()
  const update = (patch: Partial<LearningSettingsSnapshot>) => {
    state = { ...state, ...patch }
    listeners.forEach(listener => listener())
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    cancel() {
      revision++; pending = false
      // Invalidate callbacks, not the server request. A later mount must read afresh.
      if (state.writePending) {
        priorUncertainWrite = true
        update({ writePending: false, busy: null, needsReconcile: true, saveUncertain: true, error: 'save' })
      }
    },
    edit(patch: Partial<LearningGoalInput>) {
      if (pending || state.needsReconcile || !state.draft) return
      update({ draft: { ...state.draft, ...patch }, notice: '' })
    },
    reset() {
      if (pending || state.needsReconcile || !state.saved) return
      update({ draft: learningSettings(state.saved), notice: '', error: null })
    },
    async load(onlyIfUnedited = false) {
      if (pending || (onlyIfUnedited && (state.needsReconcile || learningSettingsChanged(state.saved, state.draft)))) return
      pending = true
      const current = ++revision
      update({ busy: 'loading', error: null, notice: '' })
      try {
        const saved = await within(deps.load(), deps.timeoutMs ?? 25_000)
        if (current === revision) update({ saved, draft: learningSettings(saved), needsReconcile: false, notice: onlyIfUnedited ? 'Данные обновлены.' : '' })
      } catch (error) {
        if (current === revision) {
          update({ error: 'load' })
          if (!(error instanceof SettingsTimeout)) deps.onError?.(error)
        }
      } finally {
        if (current === revision) { pending = false; update({ busy: null }) }
      }
    },
    async save() {
      if (pending || state.needsReconcile || !state.saved || !state.draft || !learningSettingsChanged(state.saved, state.draft)) return
      pending = true
      const current = ++revision
      const input = { ...state.draft }
      const enabling = input.enabled && !state.saved.enabled
      let startedWrite = false
      update({ busy: 'saving', error: null, notice: '' })
      try {
        if (enabling) {
          let permitted: boolean
          try { permitted = await within(deps.requestPermission(), deps.timeoutMs ?? 60_000) }
          catch {
            if (current === revision) update({ error: 'permission' })
            return
          }
          if (current !== revision) return
          if (!permitted) {
            update({ notice: 'Разрешение Telegram не выдано. Изменения не сохранены.' })
            return
          }
        }
        startedWrite = true
        update({ writePending: true })
        // Observe the original promise even after our UI deadline. Until it settles,
        // another read could race it and another write could overwrite it.
        const write = Promise.resolve().then(() => deps.save(input)).then(saved => {
          if (current !== revision) return
          pending = false
          update({ saved, draft: learningSettings(saved), busy: null, writePending: false, needsReconcile: false, saveUncertain: priorUncertainWrite, error: null, notice: 'Настройки сохранены.' })
        }, error => {
          if (current !== revision) return
          pending = false
          priorUncertainWrite = true
          update({ busy: null, writePending: false, needsReconcile: true, saveUncertain: true, error: 'save' })
          deps.onError?.(error)
        })
        try { await within(write, deps.timeoutMs ?? 25_000) }
        catch (error) {
          if (current === revision && error instanceof SettingsTimeout && state.writePending) {
            update({ busy: null, error: 'save', needsReconcile: true, saveUncertain: true })
          }
        }
      } finally {
        if (!startedWrite && current === revision) { pending = false; update({ busy: null }) }
      }
    },
  }
}
