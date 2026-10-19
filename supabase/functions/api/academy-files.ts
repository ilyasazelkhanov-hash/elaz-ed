import { AcademyError } from './academy.ts'

const BUCKET = 'academy-private'
const MAX = 10 * 1024 * 1024
const TYPES: Record<string, string[]> = { 'application/pdf': ['pdf'], 'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'], 'image/webp': ['webp'], 'text/plain': ['txt'], 'application/zip': ['zip'] }
type Result = { data: any; error: { message?: string; code?: string } | null }
type Storage = {
  createSignedUploadUrl(path: string, options: { upsert: boolean }): PromiseLike<Result>
  createSignedUrl(path: string, seconds: number, options: { download: string }): PromiseLike<Result>
  list(folder: string, options: { search: string; limit: number }): PromiseLike<Result>
  download(path: string): PromiseLike<Result>
}
type Db = { rpc(name: string, args: Record<string, unknown>): PromiseLike<Result>; storage?: { from(bucket: string): Storage } }
async function rpc(db: Db, name: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(name, args)
  if (error) {
    const code = error.message?.match(/academy_[a-z_]+/)?.[0] || 'academy_unavailable'
    throw new AcademyError(code.includes('forbidden') ? 403 : code.includes('not_found') ? 404 : code === 'academy_unavailable' ? 503 : 400, code)
  }
  return data
}
function validType(filename: unknown, mime: unknown, size: unknown) {
  return typeof filename === 'string' && filename.length <= 180 && !/[\\/\x00-\x1f]/.test(filename) && typeof mime === 'string' && TYPES[mime]?.includes(filename.split('.').pop()!.toLowerCase()) && Number.isSafeInteger(size) && Number(size) > 0 && Number(size) <= MAX
}
function signature(bytes: Uint8Array, mime: string) {
  const starts = (...prefix: number[]) => prefix.every((b, i) => bytes[i] === b)
  if (mime === 'application/pdf') return starts(37, 80, 68, 70, 45)
  if (mime === 'image/png') return starts(137, 80, 78, 71, 13, 10, 26, 10)
  if (mime === 'image/jpeg') return starts(255, 216, 255)
  if (mime === 'image/webp') return starts(82, 73, 70, 70) && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  if (mime === 'application/zip') return starts(80, 75, 3, 4) || starts(80, 75, 5, 6)
  if (mime === 'text/plain') {
    try { const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); return !text.includes('\0') && !/<\s*(?:!doctype|html|svg|script|iframe|object)\b/i.test(text) } catch { return false }
  }
  return false
}

// Actor identity comes from the API's verified Telegram member, never from payload.
export async function handleAcademyFiles(db: Db, actor: { id: number; is_admin?: boolean } | null, action: string, payload: Record<string, unknown> = {}) {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object' || JSON.stringify(payload).length > 120_000) throw new AcademyError(400, 'academy_invalid_payload')
  if (action === 'certificate_public') return rpc(db, 'academy_certificate_public', { p_code: payload.code })
  if (action === 'portfolio_public') return rpc(db, 'academy_portfolio', { p_actor: null, p_action: 'public', p_payload: { slug: payload.slug } })
  if (!actor || !Number.isSafeInteger(actor.id) || actor.id <= 0) throw new AcademyError(401, 'academy_auth_required')
  if (['portfolio_list', 'portfolio_publish', 'portfolio_revoke'].includes(action)) return rpc(db, 'academy_portfolio', { p_actor: actor.id, p_action: action.slice(10), p_payload: payload })
  if (!['file_upload', 'file_finalize', 'file_download'].includes(action)) throw new AcademyError(400, 'academy_unknown_action')
  if (!db.storage) throw new AcademyError(503, 'academy_storage_unavailable')
  const storage = db.storage.from(BUCKET)
  const fileRpc = (step: string, value: Record<string, unknown>) => rpc(db, 'academy_files_action', { p_actor: actor.id, p_action: step, p_payload: value })
  if (action === 'file_upload') {
    if (!validType(payload.filename, payload.mime, payload.size)) throw new AcademyError(400, 'academy_file_invalid')
    const file = await fileRpc('reserve', { lesson_code: payload.lesson_code, filename: payload.filename, mime: payload.mime, size: payload.size })
    const signed = await storage.createSignedUploadUrl(file.path, { upsert: false })
    if (signed.error || !signed.data?.signedUrl || !signed.data?.token) throw new AcademyError(503, 'academy_storage_unavailable')
    return { file_id: file.id, path: file.path, token: signed.data.token, signed_url: signed.data.signedUrl }
  }
  const file = await fileRpc(action === 'file_finalize' ? 'owner' : 'download', { file_id: payload.file_id })
  if (action === 'file_download') {
    const signed = await storage.createSignedUrl(file.path, 60, { download: file.filename })
    if (signed.error || !signed.data?.signedUrl) throw new AcademyError(503, 'academy_storage_unavailable')
    return { file_id: file.id, signed_url: signed.data.signedUrl, expires_in: 60 }
  }
  const slash = file.path.lastIndexOf('/'), name = file.path.slice(slash + 1)
  const objects = await storage.list(file.path.slice(0, slash), { search: name, limit: 100 })
  if (objects.error) throw new AcademyError(503, 'academy_storage_unavailable')
  const object = objects.data?.find((item: any) => item.name === name)
  if (!object) throw new AcademyError(400, 'academy_file_upload_incomplete')
  const size = Number(object.metadata?.size), mime = object.metadata?.mimetype
  if (!validType(file.filename, mime, size) || size !== file.expected_size || mime !== file.mime) throw new AcademyError(400, 'academy_file_metadata_mismatch')
  const blob = await storage.download(file.path)
  if (blob.error || !blob.data) throw new AcademyError(503, 'academy_storage_unavailable')
  if (blob.data.size !== size || !signature(new Uint8Array(await blob.data.arrayBuffer()), mime)) throw new AcademyError(400, 'academy_file_content_invalid')
  return fileRpc('ready', { file_id: file.id, actual_size: size, actual_mime: mime })
}
