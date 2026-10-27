/** Local teaching contract. No request is sent to a server or a person. */
export const KEY = 'master-request-v1'
export const SERVICES = [
  { id: 'tap', title: 'Ремонт смесителя', description: 'Выбери проблему с краном. Диагноз и стоимость здесь не назначаются.' },
  { id: 'light', title: 'Установка светильника', description: 'Оставь учебную заявку. Время визита и безопасность работ согласуются отдельно.' },
  { id: 'inspect', title: 'Диагностика поломки', description: 'Начни с обращения. Автоматического заключения о неисправности здесь нет.' },
]
export function validateDraft(value) {
  const errors = {}
  if (!value || !SERVICES.some(service => service.id === value.serviceId)) errors.serviceId = 'Выбери одну услугу из трёх.'
  if (typeof value?.name !== 'string' || value.name.trim().length < 2 || value.name.trim().length > 60) errors.name = 'Введи вымышленное имя: от 2 до 60 символов без крайних пробелов.'
  if (typeof value?.contact !== 'string' || value.contact.trim().length < 3 || value.contact.trim().length > 80) errors.contact = 'Введи учебный контакт: от 3 до 80 символов. Например, student@example.test.'
  return errors
}
export function saveRequest(storage, draft, now = () => new Date()) {
  const errors = validateDraft(draft)
  if (Object.keys(errors).length) return { ok: false, kind: 'validation', errors }
  const request = { serviceId: draft.serviceId, name: draft.name.trim(), contact: draft.contact.trim(), createdAt: now().toISOString() }
  try { storage.setItem(KEY, JSON.stringify(request)) }
  catch { return { ok: false, kind: 'storage', errors: { storage: 'Не удалось сохранить на этом устройстве. Ввод остался в форме; проверь настройки браузера или отключи учебный сбой и повтори.' } } }
  return { ok: true, request }
}
export function readRequest(storage) {
  let raw
  try { raw = storage.getItem(KEY) }
  catch { return { state: 'unavailable', request: null } }
  if (raw === null) return { state: 'empty', request: null }
  try {
    const value = JSON.parse(raw)
    if (Object.keys(validateDraft(value)).length || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) return { state: 'unreadable', request: null }
    const request = { serviceId: value.serviceId, name: value.name.trim(), contact: value.contact.trim(), createdAt: value.createdAt }
    return { state: 'saved', request }
  } catch { return { state: 'unreadable', request: null } }
}
export function deleteRequest(storage) {
  try { storage.removeItem(KEY); return { ok: true } }
  catch { return { ok: false } }
}
