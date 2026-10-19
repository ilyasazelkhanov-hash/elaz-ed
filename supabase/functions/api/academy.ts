// Called only after the existing API has verified Telegram initData.
type AcademyDb = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }> }
export class AcademyError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message = code) { super(message); this.status=status; this.code=code }
}
const actions = new Set(['catalog','course','lesson','library','my','permissions','audit','admin_audit','enroll','complete','quiz_start','quiz_submit','submission_save','submission_submit','review','review_queue','certificate_verify','admin_roles','admin_assign','admin_list','admin_save','admin_reorder','admin_import','placement','certificate','skills','skill_map','skill_progress','block_list','block_save','analytics'])
export async function handleAcademy(db: AcademyDb, actor: { id: number; is_admin: boolean }, action: string, payload: Record<string, unknown> = {}) {
  if (!Number.isSafeInteger(actor.id) || actor.id <= 0) throw new AcademyError(401, 'academy_auth_required')
  if (!actions.has(action)) throw new AcademyError(400, 'academy_unknown_action')
  if (!payload || Array.isArray(payload) || typeof payload !== 'object' || JSON.stringify(payload).length > 4_000_000) throw new AcademyError(400, 'academy_invalid_payload')
  const { data, error } = await db.rpc('academy_action', { p_actor: actor.id, p_action: action, p_payload: payload })
  if (error) {
    const code = error.message?.match(/academy_[a-z_]+/)?.[0]
    if (!code) {
      if (error.code?.startsWith('22') || error.code?.startsWith('23')) throw new AcademyError(400, 'academy_invalid_payload')
      throw new AcademyError(500, 'academy_unavailable')
    }
    const status = code.includes('forbidden') ? 403 : code.includes('not_found') ? 404 : code.includes('conflict') ? 409 : 400
    throw new AcademyError(status, code)
  }
  return data
}



