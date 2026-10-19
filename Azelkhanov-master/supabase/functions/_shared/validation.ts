import { requireValue } from './errors.ts'
export const actionModules: Record<string, string | null> = {
  'profile.preferences': 'commerce', 'gift.send': 'loyalty', 'gift.claim': 'loyalty', 'gift.cancel': 'loyalty', 'passport.claim': 'progress', 'project.approve': 'commerce', 'admin.project.save': 'commerce', 'admin.project.update': 'commerce', 'journey.choose': 'progress',
  bootstrap: null, 'daily.claim': 'progress', 'content.complete': 'content', 'favorite.toggle': 'content', 'reaction.toggle': 'content',
  'quiz.start': null, 'quiz.answer': null, 'campaign.open': 'campaigns', 'game.start': 'campaigns', 'reward.claim': 'loyalty', 'coupon.redeem': 'loyalty', 'admin.visit': 'loyalty',
  'order.create': 'commerce', 'admin.order.update': 'commerce', 'event.book': 'events', 'event.cancel': 'events', 'event.checkin': 'events',
  'post.create': 'community', 'comment.create': 'community', 'post.like': 'community', 'post.report': 'community', 'admin.post.moderate': 'community',
  'homework.submit': 'learning', 'homework.review': 'learning', 'certificate.issue': 'learning', 'poll.vote': 'team', 'recognition.send': 'team',
  'profile.update': null, 'referral.claim': 'retention', 'notification.read': 'retention', 'admin.entity.save': null, 'admin.entity.delete': null,
  'admin.member.update': null, 'admin.points.adjust': 'loyalty', 'admin.notification.enqueue': 'retention', 'stars.invoice': 'learning', 'file.upload-url': null, 'file.download-url': null,
  'admin.entity.get': null, 'admin.analytics': 'analytics', 'admin.payments': 'learning', 'admin.refund': 'learning', 'queue.list': null, 'queue.retry': null, 'admin.queue.list': null, 'admin.queue.retry': null,
}
export const actionRoles: Record<string, string[]> = {
  'coupon.redeem': ['cashier'], 'admin.visit': ['cashier'], 'event.checkin': ['cashier'], 'admin.order.update': ['cashier'],
  'admin.post.moderate': ['moderator'], 'homework.review': ['mentor'], 'admin.entity.save': ['editor', 'campaign_manager'], 'admin.entity.delete': ['editor', 'campaign_manager'],
  'admin.member.update': [], 'admin.points.adjust': [], 'admin.notification.enqueue': ['campaign_manager'],
  'admin.entity.get': ['editor','campaign_manager'], 'admin.analytics': ['analyst'], 'admin.payments': [], 'admin.refund': [], 'queue.list': ['campaign_manager'], 'queue.retry': ['campaign_manager'], 'admin.queue.list': ['campaign_manager'], 'admin.queue.retry': ['campaign_manager'],
}
export function assertRole(action: string, role: string) {
  const allowed = actionRoles[action]
  requireValue(!allowed || role === 'owner' || role === 'admin' || allowed.includes(role), 'forbidden', 403)
}
export function validateAction(action: unknown, payload: unknown): asserts action is string {
  requireValue(typeof action === 'string' && Object.hasOwn(actionModules, action), 'unknown_action', 404)
  requireValue(payload !== null && typeof payload === 'object' && !Array.isArray(payload), 'invalid_payload')
  const p = payload as Record<string, unknown>
  const string = (key: string, max = 200, optional = false) => {
    requireValue(optional && p[key] === undefined || typeof p[key] === 'string' && (p[key] as string).length > 0 && (p[key] as string).length <= max, `invalid_${key}`)
  }
  if (['content.complete','favorite.toggle','reaction.toggle','quiz.start','campaign.open','game.start','reward.claim','event.book','event.cancel','poll.vote','stars.invoice'].includes(action)) string('entityId')
  if(action==='profile.preferences') { const sizes=p.sizes as Record<string,unknown>; requireValue(Boolean(sizes)&&typeof sizes==='object'&&!Array.isArray(sizes)&&Object.entries(sizes).every(([k,v])=>['top','bottom','shoe'].includes(k)&&typeof v==='string'&&v.length<=30)&& (p.style===undefined||typeof p.style==='string'&&p.style.length<=100),'invalid_preferences') }
  if (['gift.send','passport.claim','journey.choose'].includes(action)) string('entityId')
  if(action==='gift.send') { string('requestId',36); requireValue(/^[a-f0-9-]{36}$/i.test(String(p.requestId)),'invalid_request_id') }
  if(action==='gift.claim') string('token',100)
  if(action==='gift.cancel') string('giftId',36)
  if(action==='project.approve') { string('projectId',100); string('milestoneId',100) }
  if(action.startsWith('admin.project.')) requireValue(p.project && typeof p.project==='object' && !Array.isArray(p.project),'invalid_project')
  if (action === 'quiz.answer') { string('attemptId'); requireValue(Number.isInteger(p.index) && Number(p.index) >= 0 && Number.isInteger(p.answer) && Number(p.answer) >= 0 && Number(p.answer) < 20, 'invalid_answer') }
  if (action === 'campaign.open') requireValue(Number.isInteger(p.day) && Number(p.day) > 0 && Number(p.day) <= 366, 'invalid_day')
  if (action === 'campaign.open' || action === 'game.start') { string('campaignId', 200, true); string('game', 40) }
  if (action === 'coupon.redeem' || action === 'event.checkin') { string('code'); string('pointId') }
  if (action === 'post.create') { string('body', 5000); string('topic', 80, true) }
  if (action === 'order.create') { string('requestId',36);requireValue(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(p.requestId)),'invalid_request_id');requireValue(p.brief===undefined||p.brief&&typeof p.brief==='object'&&!Array.isArray(p.brief),'invalid_brief') }
  if (action === 'post.create') { requireValue(p.audience===undefined||['all','employees'].includes(String(p.audience)),'invalid_audience');requireValue(p.teamId===undefined||p.teamId===null||typeof p.teamId==='string'&&p.teamId.length>0&&p.teamId.length<=200,'invalid_team') }
  if (['comment.create','post.like','post.report','admin.post.moderate'].includes(action)) string('postId')
  if (action === 'comment.create' || action === 'recognition.send') string('body', 3000)
  if (['recognition.send','admin.visit','admin.member.update','admin.points.adjust'].includes(action)) string('userId')
  if (action === 'order.create') { requireValue(Array.isArray(p.items) && p.items.length > 0 && p.items.length <= 50, 'invalid_items'); for (const value of p.items as Record<string, unknown>[]) requireValue(value && typeof value.entityId === 'string' && Number.isInteger(value.quantity) && Number(value.quantity) > 0 && Number(value.quantity) <= 99 && typeof value.variant === 'string' && value.variant.length <= 100, 'invalid_item'); requireValue(p.note === undefined || typeof p.note === 'string' && p.note.length <= 2000, 'invalid_note') }
  if (action === 'admin.order.update') { string('orderId'); requireValue(['new','accepted','ready','completed','cancelled'].includes(String(p.status)), 'invalid_status') }
  if (action === 'homework.submit') { string('lessonId'); string('body', 10000); requireValue(p.file === undefined || typeof p.file === 'string' && p.file.length <= 400, 'invalid_file') }
  if (action === 'homework.review') { string('homeworkId'); requireValue(['revision','approved'].includes(String(p.status)), 'invalid_status'); requireValue(p.feedback === undefined || typeof p.feedback === 'string' && p.feedback.length <= 5000, 'invalid_feedback') }
  if (action === 'certificate.issue') string('courseId')
  if (action === 'poll.vote') requireValue(Number.isInteger(p.option) && Number(p.option) >= 0 && Number(p.option) <= 50, 'invalid_option')
  if (action === 'profile.update') { requireValue(p.notificationOptIn === undefined || typeof p.notificationOptIn === 'boolean', 'invalid_preferences'); for (const key of ['quietFrom','quietTo']) requireValue(p[key] === undefined || Number.isInteger(p[key]) && Number(p[key]) >= 0 && Number(p[key]) <= 23, 'invalid_quiet_hours'); if (p.timezone !== undefined) { string('timezone', 80); try { new Intl.DateTimeFormat('en', { timeZone: String(p.timezone) }) } catch { requireValue(false, 'invalid_timezone') } } }
  if (action === 'referral.claim') string('code')
  if (action === 'notification.read') string('noticeId')
  if (action === 'admin.entity.save') requireValue(p.entity && typeof p.entity === 'object' && !Array.isArray(p.entity) && typeof (p.entity as Record<string, unknown>).id === 'string', 'invalid_entity')
  if (action === 'admin.entity.delete' || action === 'admin.entity.get') string('entityId')
  if (action === 'admin.member.update') { requireValue(p.role === undefined || ['owner','admin','editor','campaign_manager','moderator','mentor','analyst','cashier','member'].includes(String(p.role)), 'invalid_role'); requireValue(p.approved === undefined || typeof p.approved === 'boolean', 'invalid_approved') }
  if (action === 'admin.member.update' && p.pointIds !== undefined) requireValue(Array.isArray(p.pointIds) && p.pointIds.length <= 100 && p.pointIds.every(v => typeof v === 'string' && v.length > 0 && v.length <= 100), 'invalid_point_scope')
  if (action === 'admin.member.update') requireValue(/^[1-9][0-9]{0,18}$/.test(String(p.userId)) && BigInt(String(p.userId)) <= 9223372036854775807n,'invalid_telegram_id')
  if (action === 'admin.points.adjust') { requireValue(Number.isInteger(p.delta) && Number(p.delta) !== 0 && Math.abs(Number(p.delta)) <= 1000000, 'invalid_delta'); string('reason', 500); string('ref', 200) }
  if (action === 'admin.notification.enqueue') { string('title', 200); string('body', 4000); string('segment', 200); requireValue(['all','employees','members','active','inactive'].includes(String(p.segment)) || /^team:.{1,100}$/.test(String(p.segment)),'invalid_segment') }
  if (action === 'admin.refund') { string('invoiceId'); requireValue(p.reason === undefined || typeof p.reason === 'string' && p.reason.length <= 1000,'invalid_reason') }
  if (action === 'admin.payments') { requireValue(p.limit === undefined || Number.isInteger(p.limit) && Number(p.limit)>0 && Number(p.limit)<=200,'invalid_limit'); requireValue(p.before === undefined || typeof p.before==='string' && Number.isFinite(Date.parse(p.before)),'invalid_cursor') }
  if (['queue.list','queue.retry','admin.queue.list','admin.queue.retry'].includes(action)) { requireValue(p.kind===undefined || ['notification','refund'].includes(String(p.kind)),'invalid_queue_kind'); if(action.endsWith('retry')) string('jobId') }
  if (action === 'admin.post.moderate') requireValue(['published','pending','hidden'].includes(String(p.status)), 'invalid_status')
  if (action === 'file.upload-url') { string('filename', 200); requireValue(['image/jpeg','image/png','image/webp','application/pdf','text/plain'].includes(String(p.contentType)), 'unsupported_file_type'); requireValue((['homework','content'].includes(String(p.purpose))||typeof p.purpose==='string'&&/^project:[a-zA-Z0-9_-]{1,100}$/.test(p.purpose)), 'invalid_purpose') }
  if (action === 'file.download-url') string('fileId')
}
