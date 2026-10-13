// События интерфейса для аналитики. Копятся пачкой, чтобы не дёргать сервер на каждый тап.
import { api, isDemo } from './api'
import type { ClientEvent } from './types'

const queue: ClientEvent[] = []
let timer: number | undefined

function flush() {
  timer = undefined
  const batch = queue.splice(0)
  if (batch.length) api.track(batch).catch(() => {})
}

export function track(name: ClientEvent['name'], props?: ClientEvent['props'], lessonId?: number) {
  if (isDemo) return
  queue.push({ name, props, lesson_id: lessonId })
  timer ??= window.setTimeout(flush, 1200)
}

// Приложение сворачивают без предупреждения — отправляем накопленное сразу.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush()
})
