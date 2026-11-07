// События интерфейса для аналитики. Копятся пачкой, чтобы не дёргать сервер на каждый тап.
import { api, isDemo } from './api'
import type { ClientEvent } from './types'
import { discoveryEvent, discoveryEventNames, type DiscoveryEventName } from './discovery-events'
import { createEventQueue } from './track-queue'

const queue = createEventQueue({
  send: events => api.track(events),
  schedule: (callback, delay) => window.setTimeout(callback,delay),
  cancel: timer => window.clearTimeout(timer),
  enabled: () => !isDemo,
})

export function track(name: ClientEvent['name'], props?: ClientEvent['props'], lessonId?: number) {
  if (isDemo) return
  const event = discoveryEventNames.includes(name as DiscoveryEventName)
    ? discoveryEvent(name as DiscoveryEventName,props,lessonId)
    : { name, props, lesson_id: lessonId }
  if (event) queue.push(event)
}

// Приложение сворачивают без предупреждения — отправляем накопленное сразу.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void queue.flush()
})
window.addEventListener('pagehide', () => {void queue.flush()})
