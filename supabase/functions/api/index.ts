// Elaz Ed API: проверка подписи Telegram, доступ по подписке на канал, XP, стрики, админка, вебхук бота.
import { createClient } from 'npm:@supabase/supabase-js@2'

const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''

function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    return String(keys.default ?? Object.values(keys)[0] ?? '')
  } catch {
    return ''
  }
}

const db = createClient(SUPABASE_URL, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const GRADIENTS = ['aurora', 'sunset', 'mint', 'ocean', 'candy', 'lime']
const SUB_TTL = 5 * 60_000
const AUTH_TTL = 48 * 3600

class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code)
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } })
}

// ---------- Telegram ----------

const enc = new TextEncoder()

async function hmac(key: BufferSource, msg: string) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))
}

function hex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

let secretKey: Uint8Array | null = null

interface TgUser {
  id: number
  first_name?: string
  username?: string
  photo_url?: string
}

async function verifyInitData(initData: unknown): Promise<TgUser> {
  if (!BOT_TOKEN) throw new HttpError(503, 'no_token')
  if (typeof initData !== 'string' || !initData) throw new HttpError(401, 'no_auth')
  const params = new URLSearchParams(initData)
  const hash = params.get('hash') ?? ''
  params.delete('hash')
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n')
  secretKey ??= await hmac(enc.encode('WebAppData'), BOT_TOKEN)
  if (!safeEqual(hex(await hmac(secretKey, check)), hash)) throw new HttpError(401, 'bad_auth')
  const authDate = Number(params.get('auth_date') ?? 0)
  if (!authDate || Date.now() / 1000 - authDate > AUTH_TTL) throw new HttpError(401, 'expired')
  try {
    const user = JSON.parse(params.get('user') ?? '')
    if (!user?.id) throw new Error('no user')
    return user
  } catch {
    throw new HttpError(401, 'bad_auth')
  }
}

async function tg(method: string, payload: Record<string, unknown> = {}) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    // deno-lint-ignore no-explicit-any
    return (await r.json()) as { ok: boolean; result?: any; description?: string }
  } catch {
    return { ok: false, description: 'network' }
  }
}

async function webhookSecret() {
  return hex(await hmac(enc.encode('elaz-ed-webhook'), BOT_TOKEN)).slice(0, 48)
}

async function membership(channelId: number, userId: number) {
  const r = await tg('getChatMember', { chat_id: channelId, user_id: userId })
  if (!r.ok) {
    const d = (r.description ?? '').toLowerCase()
    if (d.includes('user not found') || d.includes('participant')) return { ok: true, member: false }
    return { ok: false, member: false }
  }
  const st = r.result.status
  const member = st === 'creator' || st === 'administrator' || st === 'member' || (st === 'restricted' && r.result.is_member === true)
  return { ok: true, member }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ---------- Настройки ----------

// deno-lint-ignore no-explicit-any
type Settings = Record<string, any>
let settingsCache: { at: number; data: Settings } | null = null

async function getSettings(fresh = false): Promise<Settings> {
  if (!fresh && settingsCache && Date.now() - settingsCache.at < 15_000) return settingsCache.data
  const { data, error } = await db.from('settings').select('key,value')
  if (error) throw new HttpError(500, 'db')
  const s: Settings = {}
  for (const r of data ?? []) s[r.key] = r.value
  settingsCache = { at: Date.now(), data: s }
  return s
}

async function setSetting(key: string, value: unknown) {
  await db.from('settings').upsert({ key, value, updated_at: new Date().toISOString() })
  settingsCache = null
}

// ---------- Пользователь ----------

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

function clampTz(tz: unknown) {
  const n = Number(tz)
  return Number.isFinite(n) ? Math.max(-720, Math.min(840, Math.round(n))) : 180
}

function localDay(tz: unknown) {
  return new Date(Date.now() + clampTz(tz) * 60_000).toISOString().slice(0, 10)
}

function dayDiff(a: string, b: string) {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000)
}

async function loadUser(tu: TgUser, sp?: string): Promise<Row> {
  const profile = {
    first_name: String(tu.first_name ?? '').slice(0, 64),
    username: tu.username ? String(tu.username).slice(0, 64) : null,
    photo_url: tu.photo_url ? String(tu.photo_url).slice(0, 500) : null,
    last_seen: new Date().toISOString(),
  }
  const { data: existing } = await db.from('users').select('*').eq('id', tu.id).maybeSingle()
  if (existing) {
    await db.from('users').update(profile).eq('id', tu.id)
    return { ...existing, ...profile }
  }
  let referred_by: number | null = null
  const ref = Number(/(?:^|_)r(\d+)/.exec(sp ?? '')?.[1] ?? 0)
  if (ref && ref !== tu.id) {
    const { data: r } = await db.from('users').select('id').eq('id', ref).maybeSingle()
    if (r) referred_by = ref
  }
  const { data: created } = await db.from('users').insert({ id: tu.id, ...profile, referred_by }).select('*').single()
  if (created) return created
  const { data: again } = await db.from('users').select('*').eq('id', tu.id).single()
  if (!again) throw new HttpError(500, 'db')
  return again
}

async function refreshSub(row: Row, s: Settings, force: boolean): Promise<Row> {
  const channelId = s.channel?.id
  if (!channelId) return row
  const age = row.sub_checked_at ? Date.now() - Date.parse(row.sub_checked_at) : Infinity
  if (!force && row.subscribed && age < SUB_TTL) return row
  const m = await membership(channelId, row.id)
  if (!m.ok) return row
  const patch = { subscribed: m.member, sub_checked_at: new Date().toISOString() }
  await db.from('users').update(patch).eq('id', row.id)
  return { ...row, ...patch }
}

// Админка — только у аккаунтов из настройки admins (ключ — @username в нижнем регистре).
// При первом входе username привязывается к Telegram ID: если его потом займёт другой человек, прав он не получит.
async function resolveAdmin(row: Row, s: Settings): Promise<boolean> {
  const admins: Record<string, number | null> = s.admins ?? {}
  if (Object.values(admins).includes(row.id)) return true
  const username = String(row.username ?? '').toLowerCase()
  if (username && username in admins && admins[username] == null) {
    await setSetting('admins', { ...admins, [username]: row.id })
    return true
  }
  return false
}

// Журнал событий для аналитики. Сбой записи не должен ломать запрос пользователя.
async function logEvent(userId: number, name: string, lessonId: number | null = null, props: Row = {}) {
  try {
    await db.from('events').insert({ user_id: userId, name, lesson_id: lessonId, props })
  } catch (e) {
    console.error('event', name, e)
  }
}

async function buildMe(row: Row, tz: unknown) {
  const day = localDay(tz)
  // Пропущен один день, но есть заморозка — стрик ещё можно спасти, поэтому показываем его.
  const gap = row.last_claim ? dayDiff(day, row.last_claim) : Infinity
  const alive = gap <= 1 || (gap === 2 && row.freezes > 0)
  const { count } = await db.from('users').select('id', { count: 'exact', head: true }).gt('xp', row.xp)
  return {
    id: row.id,
    name: row.first_name || 'Друг',
    username: row.username,
    photo: row.photo_url,
    xp: row.xp,
    streak: alive ? row.streak : 0,
    best_streak: row.best_streak,
    daily_claimed: !!row.last_claim && row.last_claim >= day,
    lessons_done: row.lessons_done,
    is_admin: row.is_admin,
    achievements: row.achievements ?? [],
    rank: (count ?? 0) + 1,
    invited: row.invited,
    freezes: row.freezes ?? 0,
  }
}

async function freshMe(id: number, tz: unknown) {
  const { data } = await db.from('users').select('*').eq('id', id).single()
  if (!data) throw new HttpError(500, 'db')
  return buildMe(data, tz)
}

// Авторизованный и подписанный пользователь — для всего, кроме boot.
async function member(body: Row, admin = false): Promise<Row> {
  const tu = await verifyInitData(body.auth)
  const { data } = await db.from('users').select('*').eq('id', tu.id).maybeSingle()
  if (!data) throw new HttpError(401, 'no_user')
  const row = await refreshSub(data, await getSettings(), false)
  if (!row.subscribed) throw new HttpError(403, 'locked')
  if (admin && !row.is_admin) throw new HttpError(403, 'forbidden')
  return row
}

// ---------- Курсы ----------

function adminIds(s: Settings): number[] {
  return Object.values(s.admins ?? {}).filter((v): v is number => typeof v === 'number')
}

async function grantAccess(userId: number, courseId: number, source: 'stars' | 'admin' | 'invites') {
  await db.from('course_access').upsert({ user_id: userId, course_id: courseId, source }, { onConflict: 'user_id,course_id', ignoreDuplicates: true })
}

// Урок из курса открыт, если он помечен бесплатным, у человека есть доступ к курсу или это админ.
async function canRead(row: Row, les: Row): Promise<boolean> {
  if (!les.course_id || les.free_preview || row.is_admin) return true
  const { data } = await db.from('course_access').select('course_id').eq('user_id', row.id).eq('course_id', les.course_id).maybeSingle()
  return !!data
}

async function buildCourses(row: Row, feed: Row[]) {
  const [courses, access, requests] = await Promise.all([
    db.from('courses').select('*').eq('published', true).order('position').order('id'),
    db.from('course_access').select('course_id').eq('user_id', row.id),
    db.from('access_requests').select('course_id,status').eq('user_id', row.id),
  ])
  const has = new Set((access.data ?? []).map((a) => a.course_id))
  const asked = new Map((requests.data ?? []).map((r) => [r.course_id, r.status]))
  const out = []
  for (const c of courses.data ?? []) {
    // «Открой с друзьями»: привёл нужное число людей — курс открывается сам.
    if (!has.has(c.id) && c.invite_unlock > 0 && row.invited >= c.invite_unlock) {
      await grantAccess(row.id, c.id, 'invites')
      has.add(c.id)
    }
    const lessons = feed.filter((l) => l.course_id === c.id)
    out.push({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      description: c.description,
      emoji: c.emoji,
      gradient: c.gradient,
      price_stars: c.price_stars,
      invite_unlock: c.invite_unlock,
      lessons: lessons.length,
      done: lessons.filter((l) => l.completed).length,
      access: row.is_admin || has.has(c.id),
      request: asked.get(c.id) ?? null,
    })
  }
  return out
}

async function notifyOpened(userId: number, course: Row, s: Settings) {
  if (!s.app_url) return
  await tg('sendMessage', {
    chat_id: userId,
    text: `Курс «${course.title}» открыт. Заходи.`,
    reply_markup: { inline_keyboard: [[{ text: 'Открыть курс', web_app: { url: `${s.app_url}/?sp=c${course.id}` } }]] },
  })
}

// Решение по заявке: из админки или кнопкой прямо в чате с ботом.
async function decideRequest(courseId: number, userId: number, approve: boolean): Promise<string | null> {
  const { data: course } = await db.from('courses').select('id,title').eq('id', courseId).maybeSingle()
  if (!course) return null
  await db.from('access_requests').upsert({ user_id: userId, course_id: courseId, status: approve ? 'approved' : 'declined', decided_at: new Date().toISOString() })
  if (approve) {
    await grantAccess(userId, courseId, 'admin')
    await notifyOpened(userId, course, await getSettings())
  }
  return course.title
}

async function buildFeed(userId: number) {
  const [lessons, progress, likes] = await Promise.all([
    db.from('feed_cards').select('*').eq('published', true).order('published_at', { ascending: false }).limit(300),
    db.from('progress').select('lesson_id').eq('user_id', userId),
    db.from('likes').select('lesson_id').eq('user_id', userId),
  ])
  if (lessons.error) throw new HttpError(500, 'db')
  const done = new Set((progress.data ?? []).map((p) => p.lesson_id))
  const liked = new Set((likes.data ?? []).map((l) => l.lesson_id))
  return (lessons.data ?? []).map((l) => ({ ...l, completed: done.has(l.id), liked: liked.has(l.id) }))
}

// ---------- Обработчики ----------

async function boot(body: Row) {
  const tu = await verifyInitData(body.auth)
  const s = await getSettings()
  let row = await loadUser(tu, typeof body.sp === 'string' ? body.sp : undefined)
  const meta = {
    channel: { title: s.channel?.title ?? null, invite: s.channel_invite ?? null },
    bot: { username: s.bot?.username ?? null, main_app: !!s.bot?.main_app },
  }
  const admin = await resolveAdmin(row, s)
  if (admin !== row.is_admin) {
    await db.from('users').update({ is_admin: admin }).eq('id', row.id)
    row = { ...row, is_admin: admin }
  }
  if (!s.channel?.id) return { status: 'setup', ...meta }
  row = await refreshSub(row, s, !!body.force)
  if (!row.subscribed) {
    await logEvent(row.id, 'gate')
    return { status: 'locked', ...meta }
  }
  if (row.referred_by && !row.ref_rewarded) {
    const { data: referrer } = await db.rpc('reward_referral', { p_user: row.id })
    if (referrer) await logEvent(row.id, 'referral', null, { by: referrer })
    const { data } = await db.from('users').select('*').eq('id', row.id).single()
    if (data) row = data
  }
  const feed = await buildFeed(row.id)
  const [me, courses] = await Promise.all([
    buildMe(row, body.tz),
    buildCourses(row, feed),
    logEvent(row.id, 'open', null, { platform: str(body.platform, 20), theme: str(body.theme, 10) }),
  ])
  return { status: 'ok', me, feed, courses, ...meta }
}

async function lesson(body: Row) {
  const row = await member(body)
  const id = Number(body.id)
  const { data } = await db.from('lessons').select('*').eq('id', id).maybeSingle()
  if (!data || (!data.published && !row.is_admin)) throw new HttpError(404, 'not_found')
  if (!(await canRead(row, data))) throw new HttpError(403, 'course_locked')
  const [p, l] = await Promise.all([
    db.from('progress').select('score,total').eq('user_id', row.id).eq('lesson_id', id).maybeSingle(),
    db.from('likes').select('lesson_id').eq('user_id', row.id).eq('lesson_id', id).maybeSingle(),
    db.rpc('bump_views', { p_lesson: id }),
    logEvent(row.id, 'lesson_open', id),
  ])
  return {
    ...data,
    quiz_count: data.quiz?.length ?? 0,
    has_video: !!data.video_url,
    completed: !!p.data,
    score: p.data?.score ?? null,
    liked: !!l.data,
  }
}

async function complete(body: Row) {
  const row = await member(body)
  const id = Number(body.id)
  const { data: les } = await db.from('lessons').select('id,kind,xp,quiz,published,course_id,free_preview').eq('id', id).maybeSingle()
  if (!les || (!les.published && !row.is_admin)) throw new HttpError(404, 'not_found')
  if (!(await canRead(row, les))) throw new HttpError(403, 'course_locked')
  const quiz: { correct: number }[] = Array.isArray(les.quiz) ? les.quiz : []
  const answers: unknown[] = Array.isArray(body.answers) ? body.answers : []
  // Серия верных ответов поднимает награду: 10, 15, дальше по 20. Ошибка сбрасывает серию.
  let combo = 0
  let score = 0
  let bonus = 0
  quiz.forEach((q, i) => {
    if (Number(answers[i]) === q.correct) {
      combo++
      score++
      bonus += 10 + 5 * Math.min(combo - 1, 2)
    } else {
      combo = 0
    }
  })
  const gained = les.xp + bonus
  const { data: inserted } = await db.rpc('complete_lesson', {
    p_user: row.id,
    p_lesson: id,
    p_score: score,
    p_total: quiz.length,
    p_xp: gained,
  })
  if (!inserted) return { already: true, gained: 0, base: 0, bonus: 0, score, total: quiz.length, new_achievements: [], me: await buildMe(row, body.tz) }

  const earned: string[] = []
  if (les.kind === 'lesson') {
    const { data: now } = await db.from('users').select('lessons_done').eq('id', row.id).single()
    const n = now?.lessons_done ?? 0
    if (n >= 1) earned.push('first')
    if (n >= 5) earned.push('five')
    if (n >= 10) earned.push('ten')
    if (quiz.length > 0 && score === quiz.length) earned.push('perfect')
    const hour = new Date(Date.now() + clampTz(body.tz) * 60_000).getUTCHours()
    if (hour < 5) earned.push('night')
  }
  const fresh = earned.filter((c) => !(row.achievements ?? []).includes(c))
  if (fresh.length) await db.rpc('grant_achievements', { p_user: row.id, p_codes: fresh })
  await logEvent(row.id, les.kind === 'story' ? 'story_done' : 'lesson_done', id, { score, total: quiz.length, xp: gained, answers: answers.slice(0, 10) })
  return { already: false, gained, base: les.xp, bonus, score, total: quiz.length, new_achievements: fresh, me: await freshMe(row.id, body.tz) }
}

async function daily(body: Row) {
  const row = await member(body)
  const { data } = await db.rpc('claim_daily', { p_user: row.id, p_today: localDay(body.tz) })
  const res = Array.isArray(data) ? data[0] : data
  const gained = res?.gained ?? 0
  const streak = res?.new_streak ?? 0
  const earned: string[] = []
  if (streak >= 3) earned.push('streak3')
  if (streak >= 7) earned.push('streak7')
  if (streak >= 30) earned.push('streak30')
  const fresh = gained > 0 ? earned.filter((c) => !(row.achievements ?? []).includes(c)) : []
  if (fresh.length) await db.rpc('grant_achievements', { p_user: row.id, p_codes: fresh })
  if (gained > 0) await logEvent(row.id, 'daily', null, { streak, xp: gained, froze: !!res?.used_freeze })
  return { gained, froze: !!res?.used_freeze, new_achievements: fresh, me: await freshMe(row.id, body.tz) }
}

async function like(body: Row) {
  const row = await member(body)
  const { data } = await db.rpc('toggle_like', { p_user: row.id, p_lesson: Number(body.id) })
  const res = Array.isArray(data) ? data[0] : data
  if (res?.liked) await logEvent(row.id, 'like', Number(body.id))
  return { liked: !!res?.liked, likes: res?.likes ?? 0 }
}

// События с клиента: только из белого списка и небольшими пачками.
const CLIENT_EVENTS = ['share', 'copy', 'story_open', 'theme', 'lab']

async function track(body: Row) {
  const row = await member(body)
  const events = (Array.isArray(body.events) ? body.events : [])
    .slice(0, 20)
    .filter((e: Row) => CLIENT_EVENTS.includes(e?.name))
    .map((e: Row) => {
      const lessonId = Number(e.lesson_id)
      const props = e.props && typeof e.props === 'object' && JSON.stringify(e.props).length <= 300 ? e.props : {}
      return { user_id: row.id, name: e.name, lesson_id: Number.isInteger(lessonId) && lessonId > 0 ? lessonId : null, props }
    })
  if (events.length) await db.from('events').insert(events)
  return { ok: true }
}

// Картинка для сторис: Telegram умеет публиковать и сохранять файл только по ссылке, поэтому кладём её в хранилище.
const SHARE_KINDS = ['level', 'lesson', 'streak', 'achievement']

async function shareUpload(body: Row) {
  const row = await member(body)
  const kind = SHARE_KINDS.includes(body.kind) ? body.kind : 'level'
  if (typeof body.image !== 'string' || body.image.length > 1_300_000) throw new HttpError(400, 'bad_image')
  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(body.image), (c) => c.charCodeAt(0))
  } catch {
    throw new HttpError(400, 'bad_image')
  }
  // Принимаем только JPEG: три первых байта у него всегда FF D8 FF.
  if (bytes.length < 1000 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new HttpError(400, 'bad_image')
  const file = `${row.id}/${kind}.jpg`
  const { error } = await db.storage.from('shares').upload(file, bytes, { contentType: 'image/jpeg', upsert: true, cacheControl: '60' })
  if (error) throw new HttpError(500, 'upload')
  return { url: `${SUPABASE_URL}/storage/v1/object/public/shares/${file}?v=${Date.now()}` }
}

// «Поделиться» карточкой с кнопкой: бот заранее готовит сообщение, а человек сам выбирает чат.
// Подпись и ссылку собирает сервер, чтобы от имени бота нельзя было отправить произвольный текст.
async function shareMessage(body: Row) {
  const row = await member(body)
  const s = await getSettings()
  if (!s.bot?.username) throw new HttpError(400, 'not_ready')
  const kind = SHARE_KINDS.includes(body.kind) ? body.kind : 'level'
  const lessonId = Number(body.lesson_id)
  let caption = 'Учусь в Elaz Ed: уроки с XP, стриком и рейтингом.'
  let start = `r${row.id}`
  if (kind === 'lesson' && lessonId > 0) {
    const { data: les } = await db.from('lessons').select('id,title').eq('id', lessonId).eq('published', true).maybeSingle()
    if (les) {
      caption = `Прошёл урок «${les.title}» в Elaz Ed.`
      start = `l${les.id}_r${row.id}`
    }
  } else if (kind === 'streak') {
    caption = `Держу стрик в Elaz Ed: ${row.streak} дн. подряд.`
  } else if (kind === 'achievement') {
    caption = 'Открыл новую ачивку в Elaz Ed.'
  }
  const photo = `${SUPABASE_URL}/storage/v1/object/public/shares/${row.id}/${kind}.jpg?v=${Date.now()}`
  const r = await tg('savePreparedInlineMessage', {
    user_id: row.id,
    result: {
      type: 'photo',
      id: crypto.randomUUID().replace(/-/g, ''),
      photo_url: photo,
      thumbnail_url: photo,
      caption,
      reply_markup: { inline_keyboard: [[{ text: 'Открыть Elaz Ed', url: `https://t.me/${s.bot.username}?${s.bot.main_app ? 'startapp' : 'start'}=${start}` }]] },
    },
    allow_user_chats: true,
    allow_group_chats: true,
    allow_channel_chats: true,
  })
  if (!r.ok) throw new HttpError(502, 'telegram')
  return { id: r.result.id }
}

async function courseRequest(body: Row) {
  const row = await member(body)
  const id = Number(body.id)
  const { data: course } = await db.from('courses').select('id,title,published').eq('id', id).maybeSingle()
  if (!course?.published) throw new HttpError(404, 'not_found')
  await db.from('access_requests').upsert({ user_id: row.id, course_id: id, status: 'pending', created_at: new Date().toISOString(), decided_at: null })
  await logEvent(row.id, 'course_request', null, { course: id })
  const who = `${row.first_name || 'Без имени'}${row.username ? ` (@${row.username})` : ''}`
  const s = await getSettings()
  await Promise.all(
    adminIds(s).map((admin) =>
      tg('sendMessage', {
        chat_id: admin,
        text: `Заявка на курс «${course.title}»\nОт: ${who}`,
        reply_markup: {
          inline_keyboard: [[
            { text: 'Открыть доступ', callback_data: `req:a:${id}:${row.id}` },
            { text: 'Отклонить', callback_data: `req:d:${id}:${row.id}` },
          ]],
        },
      }),
    ),
  )
  return { request: 'pending' }
}

// Счёт в звёздах Telegram. Доступ выдаёт вебхук, когда Telegram подтвердит оплату.
async function courseInvoice(body: Row) {
  const row = await member(body)
  const id = Number(body.id)
  const { data: c } = await db.from('courses').select('*').eq('id', id).maybeSingle()
  if (!c?.published || c.price_stars <= 0) throw new HttpError(400, 'not_for_sale')
  const r = await tg('createInvoiceLink', {
    title: String(c.title).slice(0, 32),
    description: String(c.subtitle || `Доступ к курсу «${c.title}»`).slice(0, 255),
    payload: `course:${id}:${row.id}`,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: 'Доступ к курсу', amount: c.price_stars }],
  })
  if (!r.ok) throw new HttpError(502, 'telegram')
  await logEvent(row.id, 'invoice', null, { course: id, stars: c.price_stars })
  return { link: r.result }
}

async function top(body: Row) {
  const row = await member(body)
  const { data } = await db
    .from('users')
    .select('id,first_name,photo_url,xp,streak')
    .gt('xp', 0)
    .order('xp', { ascending: false })
    .order('id')
    .limit(50)
  if (row.invited >= 3 && !(row.achievements ?? []).includes('invite')) {
    await db.rpc('grant_achievements', { p_user: row.id, p_codes: ['invite'] })
  }
  const me = await buildMe(row, body.tz)
  return {
    top: (data ?? []).map((u) => ({ id: u.id, name: u.first_name || 'Друг', photo: u.photo_url, xp: u.xp, streak: u.streak })),
    rank: me.rank,
  }
}

// ---------- Админка ----------

function str(v: unknown, max: number) {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function httpsUrl(v: unknown) {
  const s = str(v, 500)
  return /^https:\/\/\S+$/.test(s) ? s : null
}

function int(v: unknown, min: number, max: number, fallback: number) {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}

function cleanLesson(input: Row) {
  const title = str(input.title, 120)
  if (!title) throw new HttpError(400, 'title_required')
  const quiz = (Array.isArray(input.quiz) ? input.quiz : [])
    .slice(0, 10)
    .map((q: Row) => {
      const options = (Array.isArray(q?.options) ? q.options : []).map((o: unknown) => str(o, 160)).filter(Boolean).slice(0, 4)
      return { q: str(q?.q, 300), options, correct: int(q?.correct, 0, Math.max(0, options.length - 1), 0), explain: str(q?.explain, 400) }
    })
    .filter((q: { q: string; options: string[] }) => q.q && q.options.length >= 2)
  return {
    kind: input.kind === 'story' ? 'story' : 'lesson',
    title,
    subtitle: str(input.subtitle, 200),
    category: str(input.category, 30) || 'Уроки',
    emoji: [...str(input.emoji, 16)].slice(0, 8).join('') || '✨',
    gradient: GRADIENTS.includes(input.gradient) ? input.gradient : 'aurora',
    cover_url: httpsUrl(input.cover_url),
    body: typeof input.body === 'string' ? input.body.slice(0, 60_000) : '',
    video_url: httpsUrl(input.video_url),
    copy_text: typeof input.copy_text === 'string' && input.copy_text.trim() ? input.copy_text.slice(0, 20_000) : null,
    quiz,
    minutes: int(input.minutes, 1, 180, 3),
    xp: int(input.xp, 0, 500, 50),
    pinned: !!input.pinned,
    published: !!input.published,
    course_id: Number(input.course_id) > 0 ? Number(input.course_id) : null,
    position: int(input.position, 0, 999, 0),
    free_preview: !!input.free_preview,
    updated_at: new Date().toISOString(),
  }
}

function cleanCourse(input: Row) {
  const title = str(input.title, 80)
  if (!title) throw new HttpError(400, 'title_required')
  return {
    title,
    subtitle: str(input.subtitle, 160),
    description: typeof input.description === 'string' ? input.description.slice(0, 4000) : '',
    emoji: [...str(input.emoji, 16)].slice(0, 8).join('') || '🎓',
    gradient: GRADIENTS.includes(input.gradient) ? input.gradient : 'ocean',
    price_stars: int(input.price_stars, 0, 100_000, 0),
    invite_unlock: int(input.invite_unlock, 0, 100, 0),
    position: int(input.position, 0, 999, 0),
    published: !!input.published,
    updated_at: new Date().toISOString(),
  }
}

async function adminCourses(body: Row) {
  await member(body, true)
  const [courses, access, requests] = await Promise.all([
    db.from('courses').select('*').order('position').order('id'),
    db.from('course_access').select('course_id'),
    db.from('access_requests').select('user_id,course_id,created_at,users(first_name,username)').eq('status', 'pending').order('created_at'),
  ])
  const students = new Map<number, number>()
  for (const a of access.data ?? []) students.set(a.course_id, (students.get(a.course_id) ?? 0) + 1)
  return {
    courses: (courses.data ?? []).map((c) => ({ ...c, students: students.get(c.id) ?? 0 })),
    // deno-lint-ignore no-explicit-any
    requests: (requests.data ?? []).map((r: any) => ({
      user_id: r.user_id,
      course_id: r.course_id,
      created_at: r.created_at,
      name: r.users?.first_name || 'Без имени',
      username: r.users?.username ?? null,
    })),
  }
}

async function adminCourseSave(body: Row) {
  await member(body, true)
  const input = body.course ?? {}
  const clean = cleanCourse(input)
  const id = Number(input.id)
  const query = id ? db.from('courses').update(clean).eq('id', id) : db.from('courses').insert(clean)
  const { data, error } = await query.select('*').single()
  if (error) throw new HttpError(500, 'db')
  return data
}

async function adminCourseDelete(body: Row) {
  await member(body, true)
  await db.from('courses').delete().eq('id', Number(body.id))
  return { ok: true }
}

async function adminRequest(body: Row) {
  await member(body, true)
  const title = await decideRequest(Number(body.course_id), Number(body.user_id), !!body.approve)
  if (!title) throw new HttpError(404, 'not_found')
  return { ok: true }
}

// Доступ вручную по @username. Человек должен хотя бы раз открыть приложение — иначе его нет в базе.
async function adminGrant(body: Row) {
  await member(body, true)
  const username = str(body.username, 64).replace(/^@/, '')
  const courseId = Number(body.course_id)
  if (!username) throw new HttpError(400, 'user_not_found')
  const { data: user } = await db.from('users').select('id,first_name').ilike('username', username).maybeSingle()
  if (!user) throw new HttpError(404, 'user_not_found')
  const title = await decideRequest(courseId, user.id, true)
  if (!title) throw new HttpError(404, 'not_found')
  return { name: user.first_name || username }
}

async function adminList(body: Row) {
  await member(body, true)
  const dayStart = new Date(Date.now() - 24 * 3600_000).toISOString()
  const [lessons, users, subs, active, done] = await Promise.all([
    db.from('lessons').select('*').order('created_at', { ascending: false }).limit(500),
    db.from('users').select('id', { count: 'exact', head: true }),
    db.from('users').select('id', { count: 'exact', head: true }).eq('subscribed', true),
    db.from('users').select('id', { count: 'exact', head: true }).gte('last_seen', dayStart),
    db.from('progress').select('lesson_id', { count: 'exact', head: true }),
  ])
  return {
    lessons: lessons.data ?? [],
    stats: { users: users.count ?? 0, subscribed: subs.count ?? 0, active: active.count ?? 0, completions: done.count ?? 0 },
  }
}

async function adminAnalytics(body: Row) {
  await member(body, true)
  const { data, error } = await db.rpc('analytics_summary', { p_days: 14, p_tz: clampTz(body.tz) })
  if (error) throw new HttpError(500, 'db')
  const { data: pays } = await db.from('payments').select('stars')
  const stars = { total: (pays ?? []).reduce((n, p) => n + p.stars, 0), count: (pays ?? []).length }
  return { ...data, stars }
}

async function adminSave(body: Row) {
  await member(body, true)
  const input = body.lesson ?? {}
  const clean = cleanLesson(input)
  const id = Number(input.id)
  if (id) {
    const { data: prev } = await db.from('lessons').select('published_at').eq('id', id).maybeSingle()
    if (!prev) throw new HttpError(404, 'not_found')
    const patch = { ...clean, published_at: prev.published_at ?? (clean.published ? new Date().toISOString() : null) }
    const { data, error } = await db.from('lessons').update(patch).eq('id', id).select('*').single()
    if (error) throw new HttpError(500, 'db')
    return data
  }
  const { data, error } = await db
    .from('lessons')
    .insert({ ...clean, published_at: clean.published ? new Date().toISOString() : null })
    .select('*')
    .single()
  if (error) throw new HttpError(500, 'db')
  return data
}

async function adminDelete(body: Row) {
  await member(body, true)
  await db.from('lessons').delete().eq('id', Number(body.id))
  return { ok: true }
}

// Анонс урока в канал: кнопка ведёт обратно в приложение.
async function adminAnnounce(body: Row) {
  await member(body, true)
  const s = await getSettings()
  const { data: les } = await db.from('lessons').select('*').eq('id', Number(body.id)).maybeSingle()
  if (!les || !les.published) throw new HttpError(400, 'not_published')
  if (!s.channel?.id || !s.bot?.username) throw new HttpError(400, 'not_ready')
  const link = `https://t.me/${s.bot.username}?${s.bot.main_app ? 'startapp' : 'start'}=l${les.id}`
  const meta = les.kind === 'story' ? 'Сторис' : `${les.minutes} мин · +${les.xp} XP`
  const text = `${les.emoji} <b>${escapeHtml(les.title)}</b>\n${escapeHtml(les.subtitle)}\n\n${meta}`
  const r = await tg('sendMessage', {
    chat_id: s.channel.id,
    text,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: 'Открыть в Elaz Ed', url: link }]] },
  })
  if (!r.ok) throw new HttpError(502, 'telegram')
  return { ok: true }
}

// ---------- Бот ----------

async function webhook(req: Request) {
  if (!BOT_TOKEN) return json({ ok: false }, 503)
  if (req.headers.get('x-telegram-bot-api-secret-token') !== (await webhookSecret())) return json({ ok: false }, 401)
  const update = await req.json().catch(() => ({}))
  try {
    const s = await getSettings()

    const msg = update.message
    if (msg?.chat?.type === 'private' && typeof msg.text === 'string' && msg.text.startsWith('/start')) {
      const payload = msg.text.split(/\s+/)[1]?.replace(/[^\w-]/g, '').slice(0, 64) ?? ''
      const appUrl = s.app_url
      if (appUrl) {
        await tg('sendMessage', {
          chat_id: msg.chat.id,
          text: 'Это Elaz Ed. Уроки, туториалы и новости — в одном месте, с XP и стриком.\n\nДоступ открыт подписчикам канала.',
          reply_markup: {
            inline_keyboard: [[{ text: 'Открыть Elaz Ed', web_app: { url: payload ? `${appUrl}/?sp=${payload}` : appUrl } }]],
          },
        })
      }
    }

    if (msg?.chat?.type === 'private' && typeof msg.text === 'string' && msg.text.startsWith('/paysupport')) {
      await tg('sendMessage', { chat_id: msg.chat.id, text: 'Вопрос по оплате? Напиши @elazart — разберёмся и вернём звёзды, если курс не открылся.' })
    }

    // Telegram ждёт ответа на проверку перед оплатой не дольше 10 секунд.
    const pcq = update.pre_checkout_query
    if (pcq) {
      const m = /^course:(\d+):(\d+)$/.exec(pcq.invoice_payload ?? '')
      let ok = false
      if (m && pcq.currency === 'XTR' && Number(m[2]) === pcq.from?.id) {
        const { data: c } = await db.from('courses').select('price_stars,published').eq('id', Number(m[1])).maybeSingle()
        ok = !!c?.published && c.price_stars === pcq.total_amount
      }
      await tg('answerPreCheckoutQuery', {
        pre_checkout_query_id: pcq.id,
        ok,
        ...(ok ? {} : { error_message: 'Курс сейчас недоступен. Звёзды не списаны.' }),
      })
    }

    const paid = msg?.successful_payment
    if (paid) {
      const m = /^course:(\d+):(\d+)$/.exec(paid.invoice_payload ?? '')
      if (m && Number(m[2]) === msg.from?.id) {
        const courseId = Number(m[1])
        const userId = Number(m[2])
        const { error } = await db.from('payments').insert({ user_id: userId, course_id: courseId, stars: paid.total_amount, charge_id: paid.telegram_payment_charge_id })
        if (!error) {
          await grantAccess(userId, courseId, 'stars')
          await logEvent(userId, 'purchase', null, { course: courseId, stars: paid.total_amount })
          const { data: course } = await db.from('courses').select('id,title').eq('id', courseId).maybeSingle()
          if (course) await notifyOpened(userId, course, s)
        }
      }
    }

    const cb = update.callback_query
    if (typeof cb?.data === 'string' && cb.data.startsWith('req:')) {
      const [, action, courseId, userId] = cb.data.split(':')
      if (adminIds(s).includes(cb.from?.id)) {
        const approve = action === 'a'
        await decideRequest(Number(courseId), Number(userId), approve)
        await tg('answerCallbackQuery', { callback_query_id: cb.id, text: approve ? 'Доступ открыт' : 'Заявка отклонена' })
        if (cb.message) {
          await tg('editMessageText', {
            chat_id: cb.message.chat.id,
            message_id: cb.message.message_id,
            text: `${cb.message.text ?? 'Заявка'}\n\n${approve ? 'Доступ открыт.' : 'Отклонено.'}`,
          })
        }
      } else {
        await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Решать может только админ' })
      }
    }

    const mine = update.my_chat_member
    if (mine?.chat?.type === 'channel') {
      const st = mine.new_chat_member?.status
      if (st === 'administrator' && (!s.channel?.id || s.channel.id === mine.chat.id)) {
        await setSetting('channel', { id: mine.chat.id, title: mine.chat.title ?? '' })
        if (mine.from?.id) {
          await tg('sendMessage', { chat_id: mine.from.id, text: `Канал «${mine.chat.title ?? ''}» подключён. Elaz Ed теперь проверяет подписку.` })
        }
      }
    }

    const cm = update.chat_member
    if (cm && s.channel?.id && cm.chat?.id === s.channel.id) {
      const st = cm.new_chat_member?.status
      const uid = cm.new_chat_member?.user?.id
      const isMember = ['creator', 'administrator', 'member'].includes(st) || (st === 'restricted' && cm.new_chat_member?.is_member === true)
      if (uid) {
        await db
          .from('users')
          .update({ subscribed: isMember, sub_checked_at: new Date().toISOString() })
          .eq('id', uid)
      }
    }
  } catch (e) {
    console.error('webhook', e)
  }
  return json({ ok: true })
}

// Идемпотентная настройка бота: вебхук, кнопка меню, команды. Секретов не возвращает.
async function setup() {
  if (!BOT_TOKEN) return json({ ok: false, error: 'no_token' }, 503)
  const s = await getSettings(true)
  const me = await tg('getMe')
  if (!me.ok) return json({ ok: false, error: 'bad_token' }, 502)
  await setSetting('bot', { id: me.result.id, username: me.result.username, main_app: !!me.result.has_main_web_app })
  const hook = await tg('setWebhook', {
    url: `${s.api_url ?? `${SUPABASE_URL}/functions/v1/api`}/webhook`,
    secret_token: await webhookSecret(),
    allowed_updates: ['message', 'my_chat_member', 'chat_member', 'pre_checkout_query', 'callback_query'],
  })
  let menu = false
  if (s.app_url) {
    const r = await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Elaz Ed', web_app: { url: s.app_url } } })
    menu = r.ok
  }
  await tg('setMyCommands', {
    commands: [
      { command: 'start', description: 'Открыть Elaz Ed' },
      { command: 'paysupport', description: 'Вопрос по оплате' },
    ],
  })
  await tg('setMyShortDescription', { short_description: 'Elaz Ed — уроки, туториалы и новости для подписчиков канала.' })
  return json({
    ok: true,
    bot: me.result.username,
    main_app: !!me.result.has_main_web_app,
    webhook: hook.ok,
    menu,
    channel: s.channel?.title ?? null,
  })
}

async function health() {
  const { error } = await db.from('settings').select('key').limit(1)
  const s = error ? {} : await getSettings()
  return json({ ok: !error, token: !!BOT_TOKEN, db: !error, channel: s.channel?.title ?? null, app_url: s.app_url ?? null })
}

// ---------- Роутер ----------

const routes: Record<string, (body: Row) => Promise<unknown>> = {
  boot,
  lesson,
  complete,
  daily,
  like,
  top,
  track,
  share_upload: shareUpload,
  share_message: shareMessage,
  course_request: courseRequest,
  course_invoice: courseInvoice,
  admin_courses: adminCourses,
  admin_course_save: adminCourseSave,
  admin_course_delete: adminCourseDelete,
  admin_request: adminRequest,
  admin_grant: adminGrant,
  admin_list: adminList,
  admin_analytics: adminAnalytics,
  admin_save: adminSave,
  admin_delete: adminDelete,
  admin_announce: adminAnnounce,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? ''
  try {
    if (route === 'webhook' && req.method === 'POST') return await webhook(req)
    if (route === 'setup') return await setup()
    if (route === 'health' || route === 'api') return await health()
    const handler = routes[route]
    if (!handler || req.method !== 'POST') return json({ error: 'not_found' }, 404)
    const body = JSON.parse((await req.text()) || '{}')
    return json(await handler(body))
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status)
    console.error(route, e)
    return json({ error: 'server' }, 500)
  }
})
