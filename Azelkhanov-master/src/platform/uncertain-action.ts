import type { Data, Snapshot } from './contracts.ts'

/** A sent mutation may have committed even though its response was lost. */
export class UnknownOutcomeError extends Error {
  constructor() {
    super('Связь прервалась. Результат действия пока неизвестен; проверяем данные, не повторяя запрос.')
    this.name = 'UnknownOutcomeError'
  }
}
export type UncertainAction = { action: string; requestId?: string; checked: boolean }
export type UncertainActions = Record<string, UncertainAction>
export const uncertaintyKey = (app: string, user: string, endpoint: string) =>
  `az-uncertain:v1:${encodeURIComponent(endpoint)}:${encodeURIComponent(app)}:${encodeURIComponent(user)}`
const memory = new Map<string, UncertainActions>()
export function readUncertain(key: string): UncertainActions {
  try {
    const stored = sessionStorage.getItem(key)
    if (!stored) return memory.get(key) ?? {}
    const value = JSON.parse(stored)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([action, item]) =>
      /^[a-z.]+$/.test(action) && !!item && typeof item === 'object' &&
      (item as UncertainAction).action === action && typeof (item as UncertainAction).checked === 'boolean')) as UncertainActions
  } catch { return memory.get(key) ?? {} }
}
export function saveUncertain(key: string, value: UncertainActions) {
  memory.set(key, value)
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* Current session still keeps the guard. */ }
}
export function canRetrySafely(unknown: UncertainAction, action: string, payload: Data) {
  return unknown.checked && ['order.create', 'gift.send'].includes(action) &&
    !!unknown.requestId && payload.requestId === unknown.requestId
}
export function reconcileUncertain(values: UncertainActions, snapshot: Snapshot): UncertainActions {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => {
    // Absence from a snapshot is not proof of failure. Only a matching receipt resolves it.
    return !(value.action === 'order.create' && value.requestId &&
      snapshot.orders?.some((order) => order.userId === snapshot.me.id && order.requestId === value.requestId))
  }).map(([key, value]) => [key, { ...value, checked: true }]))
}
