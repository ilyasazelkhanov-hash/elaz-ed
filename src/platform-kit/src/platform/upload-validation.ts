// Mirrors the private storage/API allowlist. The server still authorizes every upload.
export const UPLOAD_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.txt,image/jpeg,image/png,image/webp,application/pdf,text/plain'
export const UPLOAD_TYPES = 'JPG, PNG, WebP, PDF или TXT'
const types: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf', txt: 'text/plain' }
export function validateUpload(file: { name: string; type: string; size: number }, limitMB: number): { contentType: string; error?: string } {
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : ''
  const contentType = Object.hasOwn(types, extension) ? types[extension] : ''
  if (!contentType) return { contentType: '', error: `Этот формат не поддерживается. Выберите ${UPLOAD_TYPES}.` }
  if (file.name.length > 200) return { contentType, error: 'Имя файла слишком длинное. Сократите его до 200 символов.' }
  if (file.type && file.type !== contentType) return { contentType, error: 'Тип файла не совпадает с расширением. Экспортируйте файл в поддерживаемом формате, не переименовывая расширение.' }
  if (file.size === 0) return { contentType, error: 'Файл пуст. Выберите файл с содержимым.' }
  if (file.size > limitMB * 1024 * 1024) return { contentType, error: `Файл слишком большой. Максимальный размер — ${limitMB} МБ.` }
  return { contentType }
}
export function uploadResponseError(status: number): string {
  if (status === 413) return 'Хранилище отклонило размер файла. Уменьшите файл и попробуйте снова.'
  if (status === 400 || status === 415) return `Хранилище отклонило файл. Поддерживаются ${UPLOAD_TYPES}; проверьте формат и размер.`
  if (status === 401 || status === 403) return 'Разрешение на загрузку истекло или недоступно. Выберите файл снова; если ошибка повторится, обновите страницу.'
  return 'Не удалось загрузить файл. Проверьте соединение и попробуйте снова.'
}
