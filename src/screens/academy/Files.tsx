import { useState } from 'react'
import { academyRequest } from '../../lib/academy'
import { openLink } from '../../lib/tg'
import { Tap } from '../../ui'

const extensions: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', txt: 'text/plain', zip: 'application/zip' }
export function AcademyAttachmentLinks({ fileIds }: { fileIds: unknown }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const ids = Array.isArray(fileIds) ? fileIds.filter((id): id is string => typeof id === 'string').slice(0, 10) : []
  async function download(fileId: string) {
    setBusy(true); setError('')
    try { const result = await academyRequest<{ signed_url: string }>('file_download', { file_id: fileId }); openLink(result.signed_url) } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось открыть файл.') } finally { setBusy(false) }
  }
  return ids.length ? <div className="mt-3"><div className="flex flex-wrap gap-2">{ids.map((id, i) => <Tap key={id} className="academy-chip text-violet" disabled={busy} onClick={() => void download(id)}>Скачать вложение {i + 1}</Tap>)}</div>{error && <p role="alert" className="mt-2 text-xs text-rose">{error}</p>}</div> : null
}
export function AcademyFiles({ lessonCode, onChange, initialFileIds = [] }: { lessonCode: string; onChange: (fileIds: string[]) => void; initialFileIds?: string[] }) {
  const [files, setFiles] = useState(() => initialFileIds.map(id => ({ id, name: 'Прикреплённый файл' })))
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function upload(file: File) {
    setError('')
    const mime = extensions[file.name.split('.').pop()?.toLowerCase() || '']
    if (!mime || (file.type && file.type !== mime && !(mime === 'application/zip' && file.type === 'application/x-zip-compressed'))) { setError('Разрешены PDF, PNG, JPEG, WEBP, TXT и ZIP.'); return }
    if (!file.size || file.size > 10 * 1024 * 1024) { setError('Размер файла — от 1 байта до 10 МБ.'); return }
    setBusy(true)
    try {
      const signed = await academyRequest<{ file_id: string; signed_url: string }>('file_upload', { lesson_code: lessonCode, filename: file.name, mime, size: file.size })
      // Same multipart PUT protocol as Supabase uploadToSignedUrl. Do not set Content-Type: the browser supplies its boundary.
      const body = new FormData(); body.append('cacheControl', '3600'); body.append('', new Blob([file], { type: mime }), file.name)
      const response = await fetch(signed.signed_url, { method: 'PUT', headers: { 'x-upsert': 'false' }, body })
      if (!response.ok) throw new Error('Хранилище не приняло файл. Попробуйте ещё раз.')
      await academyRequest('file_finalize', { file_id: signed.file_id })
      const next = [...files, { id: signed.file_id, name: file.name }]; setFiles(next); onChange(next.map(item => item.id))
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить файл.') } finally { setBusy(false) }
  }
  async function download(id: string) {
    setError('')
    try { const result = await academyRequest<{ signed_url: string }>('file_download', { file_id: id }); openLink(result.signed_url) } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось открыть файл.') }
  }
  return <fieldset className="mt-5 rounded-xl border border-line p-4" disabled={busy}><legend className="px-1 text-sm font-semibold">Приватные вложения</legend><p className="text-xs leading-relaxed text-mute">До 10 файлов по 10 МБ. PDF, PNG, JPEG, WEBP, TXT, ZIP. Файлы доступны тебе и назначенному преподавателю. ZIP скачивается как архив.</p><label className="academy-label mt-3" htmlFor={`academy-file-${lessonCode}`}>{busy ? 'Загрузка и проверка файла…' : 'Добавить файл'}</label><input id={`academy-file-${lessonCode}`} type="file" disabled={busy || files.length >= 10} accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.zip" className="block max-w-full text-xs" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file) }}/>{files.map(file => <div key={file.id} className="mt-3 flex items-center gap-3 text-xs"><Tap className="min-w-0 flex-1 truncate text-left text-violet" onClick={() => void download(file.id)}>{file.name}</Tap><Tap aria-label={`Убрать ${file.name}`} onClick={() => { const next = files.filter(item => item.id !== file.id); setFiles(next); onChange(next.map(item => item.id)) }}>Убрать</Tap></div>)}{busy && <p role="status" className="mt-3 text-xs text-mute">Файл будет прикреплён после проверки сервером.</p>}{error && <p role="alert" className="mt-3 text-xs text-rose">{error}</p>}</fieldset>
}
