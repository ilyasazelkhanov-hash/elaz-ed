import { useStore } from './store'

/** A read-only retry inside the active focus scope, never a retry of the last write. */
export function RefreshNotice() {
  const code = useStore(s => s.refreshErrorCode)
  const refreshing = useStore(s => s.refreshing)
  if (!code) return null
  return <aside role="status" aria-live="polite" className="absolute inset-x-3 z-[80] rounded-2xl border border-line bg-card p-3 text-sm shadow-xl" style={{ top: 'calc(var(--tg-content-safe-area-inset-top, 0px) + var(--tg-safe-area-inset-top, 0px) + 12px)' }}>
    <p>Не удалось обновить данные. Последний подтверждённый результат сохранён.</p>
    <button type="button" disabled={refreshing} onClick={() => void useStore.getState().boot()} className="mt-2 min-h-11 rounded-xl px-3 font-semibold text-violet disabled:opacity-50">{refreshing ? 'Обновляем…' : 'Повторить только обновление'}</button>
  </aside>
}
