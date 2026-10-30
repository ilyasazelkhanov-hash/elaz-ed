// OG CRE8R² API: проверка подписи Telegram, доступ по подписке на канал, XP, стрики, админка, вебхук бота.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleAcademy, AcademyError } from './academy.ts'
import { handleAcademyFiles } from './academy-files.ts'
import { newsTelegramPost } from '../_shared/news.ts'
import { rewardNotifications } from '../_shared/rewardNotifications.ts'
import { handleCertifications, CertificationError } from './certifications.ts'
import { processRefundJobs } from './payments.ts'

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
const OG_PLATFORM_ENABLED = Deno.env.get('OG_PLATFORM_ENABLED') === 'true'
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

let secretKey: Uint8Array<ArrayBuffer> | null = null

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

// Часовой пояс человека хранится на сервере. Раньше он приходил с каждым запросом, и сменой пояса
// можно было забрать бонус дня два-три раза за сутки. Теперь пояс меняется не чаще раза в 20 часов.
const TZ_LOCK = 20 * 3600_000

function tzOf(row: Row, fallback?: unknown) {
  return row.tz ?? clampTz(fallback)
}

async function syncTz(row: Row, clientTz: unknown): Promise<Row> {
  const tz = clampTz(clientTz)
  if (row.tz === tz) return row
  const lockedUntil = row.tz_at ? Date.parse(row.tz_at) + TZ_LOCK : 0
  if (row.tz != null && Date.now() < lockedUntil) return row
  const patch = { tz, tz_at: new Date().toISOString() }
  await db.from('users').update(patch).eq('id', row.id)
  return { ...row, ...patch }
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
  const { data, error } = await db.rpc('resolve_admin', { p_user: row.id, p_username: String(row.username ?? '').toLowerCase() })
  if (error) throw new HttpError(503, 'db')
  if (data === true && s.admins) {
    const username = String(row.username ?? '').toLowerCase()
    if (Object.hasOwn(s.admins, username) && s.admins[username] == null) { s.admins[username] = row.id; settingsCache = null }
  }
  return data === true
}

// Журнал событий для аналитики. Сбой записи не должен ломать запрос пользователя.
// supabase-js не бросает исключений, а возвращает error — поэтому проверяем его, а не ловим.
async function logEvent(userId: number, name: string, lessonId: number | null = null, props: Row = {}) {
  const { error } = await db.from('events').insert({ user_id: userId, name, lesson_id: lessonId, props })
  if (error) console.error('event', name, error.message)
}

// Стрик, который ещё жив на сегодня: пропущен один день, но есть заморозка — его можно спасти.
function aliveStreak(row: Row) {
  const gap = row.last_claim ? dayDiff(localDay(tzOf(row)), row.last_claim) : Infinity
  return gap <= 1 || (gap === 2 && row.freezes > 0) ? row.streak : 0
}

// Уровни дублируют src/lib/game.ts: бот показывает тот же уровень, что и вкладка профиля.
const LEVELS = [
  { xp: 0, title: 'Новичок', emoji: '🐣' },
  { xp: 100, title: 'Искатель', emoji: '🧭' },
  { xp: 250, title: 'Вайбкодер', emoji: '⚡' },
  { xp: 500, title: 'Промптер', emoji: '🧠' },
  { xp: 900, title: 'Билдер', emoji: '🛠️' },
  { xp: 1500, title: 'Архитектор', emoji: '🚀' },
  { xp: 2500, title: 'Нейромаг', emoji: '🔮' },
  { xp: 4000, title: 'Легенда', emoji: '👑' },
]

function levelOf(xp: number) {
  let i = 0
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++
  const cur = LEVELS[i]
  const next = LEVELS[i + 1] ?? null
  return { index: i + 1, title: cur.title, emoji: cur.emoji, next, left: next ? next.xp - xp : 0 }
}

// Команда из текста сообщения: без @имени бота и аргументов, в нижнем регистре.
function botCmd(text: string) {
  return (text.trim().split(/\s+/)[0] ?? '').split('@')[0].toLowerCase()
}

function botSender(msg: Row): number {
  const id = Number(msg?.from?.id ?? msg?.chat?.id)
  return Number.isInteger(id) && id > 0 ? id : 0
}

async function buildMe(row: Row) {
  const day = localDay(tzOf(row))
  // Место считаем среди подписчиков — так же, как строится таблица рейтинга.
  const { count, error: rankError } = await db.from('users').select('id', { count: 'exact', head: true }).eq('subscribed', true).or(`xp.gt.${Number(row.xp)},and(xp.eq.${Number(row.xp)},id.lt.${Number(row.id)})`)
  if (rankError) throw new HttpError(500, 'db')
  let combined: Row | null = null
  let combinedRank: number | null = null
  if (OG_PLATFORM_ENABLED) {
    const [progress, rating] = await Promise.all([
      db.rpc('az_og_progress_summary', { p_actor: row.id }),
      db.rpc('az_og_progress_top', { p_actor: row.id }),
    ])
    if (progress.error || rating.error || !progress.data) throw new HttpError(503, 'platform_not_ready')
    combined = progress.data
    combinedRank = rating.data?.rank ?? null
  }
  return {
    id: row.id,
    name: row.first_name || 'Друг',
    username: row.username,
    photo: row.photo_url,
    xp: combined?.totalXp ?? row.xp,
    ...(combined ? { base_xp: combined.baseXp, platform_xp: combined.platformXp } : {}),
    streak: aliveStreak(row),
    best_streak: row.best_streak,
    daily_claimed: !!row.last_claim && row.last_claim >= day,
    lessons_done: row.lessons_done,
    is_admin: row.is_admin,
    achievements: row.achievements ?? [],
    rank: combinedRank ?? (count ?? 0) + 1,
    invited: row.invited,
    freezes: row.freezes ?? 0,
  }
}

async function freshMe(id: number) {
  const { data } = await db.from('users').select('*').eq('id', id).single()
  if (!data) throw new HttpError(500, 'db')
  return buildMe(data)
}

// Авторизованный и подписанный пользователь — для всего, кроме boot.
async function member(body: Row, admin = false): Promise<Row> {
  const tu = await verifyInitData(body.auth)
  const { data } = await db.from('users').select('*').eq('id', tu.id).maybeSingle()
  if (!data) throw new HttpError(401, 'no_user')
  const row = await refreshSub(data, await getSettings(), false)
  if (!row.subscribed) throw new HttpError(403, 'locked')
  row.is_admin = await resolveAdmin({ ...row, username: tu.username }, {})
  if (admin && !row.is_admin) throw new HttpError(403, 'forbidden')
  return row
}

// ---------- Курсы ----------

function adminIds(s: Settings): number[] {
  return Object.values(s.admins ?? {}).filter((v): v is number => typeof v === 'number')
}

async function grantAccess(userId: number, courseId: number, source: 'stars' | 'admin' | 'invites') {
  const { error } = await db.rpc('grant_course_access', { p_user: userId, p_course: courseId, p_source: source })
  if (error) throw new HttpError(500, 'db')
  return true
}

async function hasAccess(userId: number, courseId: number) {
  const { data } = await db.from('course_access').select('course_id').eq('user_id', userId).eq('course_id', courseId).maybeSingle()
  return !!data
}

// Урок из курса открыт, если он помечен бесплатным, у человека есть доступ к курсу или это админ.
async function canRead(row: Row, les: Row): Promise<boolean> {
  if (!les.course_id || les.free_preview || row.is_admin) return true
  if (await hasAccess(row.id, les.course_id)) return true
  const { data } = await db.from('lesson_access').select('lesson_id').eq('user_id', row.id).eq('lesson_id', les.id).maybeSingle()
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
      access: row.is_admin || has.has(c.id) || (c.price_stars === 0 && lessons.length > 0 && lessons.every((l) => l.free_preview)),
      request: asked.get(c.id) ?? null,
    })
  }
  return out
}

async function notifyOpened(userId: number, course: Row, s: Settings) {
  if (!s.app_url) return
  await tg('sendMessage', {
    chat_id: userId,
    parse_mode: 'HTML',
    text: `🎉 <b>Доступ к курсу открыт!</b>\n\nКурс <b>«${escapeHtml(course.title)}»</b> теперь разблокирован в твоём профиле. Все уроки, практические задания и квизы доступны для изучения.`,
    reply_markup: { inline_keyboard: [[{ text: '📚 Начать обучение', web_app: { url: `${s.app_url}/?sp=c${course.id}` } }]] },
  })
}

// Решение по заявке: из админки или кнопкой прямо в чате с ботом.
async function decideRequest(courseId: number, userId: number, approve: boolean): Promise<string | null> {
  const { data: course } = await db.from('courses').select('id,title').eq('id', courseId).maybeSingle()
  if (!course) return null
  const { error } = await db.rpc('decide_course_request', { p_user: userId, p_course: courseId, p_approve: approve })
  if (error) throw new HttpError(500, 'db')
  if (approve) await notifyOpened(userId, course, await getSettings())
  return course.title
}

// Возврат звёзд: помечаем оплату и закрываем доступ, выданный за неё. Повторный вызов ничего не меняет.
async function markRefunded(chargeId: string) {
  const { data: p, error } = await db.rpc('apply_star_refund', { p_charge: chargeId })
  if (error || !p) throw new HttpError(500, 'db')
  // Билет за возвращённые звёзды отзываем, если он ещё не потрачен.
  await db.from('advent_tickets').update({ revoked_at: new Date().toISOString() }).eq('ref', `stars:${chargeId}`).is('used_at', null).is('revoked_at', null)
  if (!p.new_refund || !p.user_id) return
  await logEvent(p.user_id, 'refund', null, { course: p.course_id, stars: p.stars })
  if (!p.course_id) {
    await tg('sendMessage', { chat_id: p.user_id, text: 'Звёзды за билет календаря возвращены. Если билет не был потрачен, он отменён.' })
    return
  }
  const { data: course } = await db.from('courses').select('title').eq('id', p.course_id).maybeSingle()
  await tg('sendMessage', { chat_id: p.user_id, text: `Звёзды за курс «${course?.title ?? ''}» возвращены. ${p.access_retained ? 'Доступ к курсу сохранён.' : 'Доступ к курсу закрыт.'}` })
}

async function buildFeed(userId: number) {
  const [lessons, stories, progress, likes] = await Promise.all([
    db.from('feed_cards').select('*').eq('published', true).eq('kind','lesson').order('pinned', {ascending:false}).order('published_at', { ascending: false }).order('id',{ascending:false}).limit(300),
    db.from('feed_cards').select('*').eq('published', true).eq('kind','story').order('published_at', { ascending: false }).order('id',{ascending:false}).limit(300),
    db.from('progress').select('lesson_id').eq('user_id', userId),
    db.from('likes').select('lesson_id').eq('user_id', userId),
  ])
  if (lessons.error || stories.error || progress.error || likes.error) throw new HttpError(500, 'db')
  const done = new Set((progress.data ?? []).map((p) => p.lesson_id))
  const liked = new Set((likes.data ?? []).map((l) => l.lesson_id))
  return [...(lessons.data ?? []),...(stories.data ?? [])].map((l) => ({ ...l, completed: done.has(l.id), liked: liked.has(l.id) }))
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
  row = await syncTz(row, body.tz)
  const storyOwner = Number(/(?:^|_)st(\d+)/.exec(typeof body.sp === 'string' ? body.sp : '')?.[1] ?? 0)
  if (storyOwner) await storyVisit(storyOwner, row.id, s)
  if (row.referred_by && !row.ref_rewarded) {
    const { data: referrer } = await db.rpc('reward_referral', { p_user: row.id })
    if (referrer) await logEvent(row.id, 'referral', null, { by: referrer })
    const { data } = await db.from('users').select('*').eq('id', row.id).single()
    if (data) row = data
  }
  // «Амбассадор» раньше выдавался только при открытии рейтинга — теперь при любом входе.
  const fresh = row.invited >= 3 && !(row.achievements ?? []).includes('invite') ? ['invite'] : []
  if (fresh.length) {
    await db.rpc('grant_achievements', { p_user: row.id, p_codes: fresh })
    row = { ...row, achievements: [...(row.achievements ?? []), ...fresh] }
  }
  const feed = await buildFeed(row.id)
  const [me, courses, advent] = await Promise.all([
    buildMe(row),
    buildCourses(row, feed),
    adventSummary(row, s),
    logEvent(row.id, 'open', null, { platform: str(body.platform, 20), theme: str(body.theme, 10) }),
  ])
  return { status: 'ok', me, feed, courses, advent, new_achievements: fresh, ...meta }
}

/** Keyset pagination: promoted posts first, then the complete chronological archive. */
async function blogFeed(body: Row) {
  const row = await member(body)
  const cursor = body.cursor
  if (cursor != null && (typeof cursor !== 'object' || typeof cursor.pinned !== 'boolean' || !Number.isSafeInteger(cursor.id) || cursor.id < 0 ||
    (cursor.date !== null && (typeof cursor.date !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(cursor.date) || !Number.isFinite(Date.parse(cursor.date)))))) throw new HttpError(400, 'bad_cursor')
  const promoted = cursor?.pinned ?? true
  let query = db.from('feed_cards').select('*').eq('published', true).eq('kind', 'lesson').is('course_id', null).eq('pinned', promoted)
    .order('published_at', {ascending:false,nullsFirst:false}).order('id', {ascending:false}).limit(31)
  // id=0 denotes the beginning of the unpromoted group; real IDs are positive.
  if (cursor?.id) {
    if (cursor.date === null) query=query.is('published_at',null).lt('id',cursor.id)
    else query=query.or(`published_at.lt.${cursor.date},and(published_at.eq.${cursor.date},id.lt.${cursor.id}),published_at.is.null`)
  }
  const result=await query
  if(result.error) throw new HttpError(500,'db')
  const posts=(result.data??[]).slice(0,30),last=posts.at(-1)
  const next=(result.data??[]).length>30&&last?{pinned:promoted,date:last.published_at??null,id:last.id}:promoted?{pinned:false,date:null,id:0}:null
  const likes=posts.length?await db.from('likes').select('lesson_id').eq('user_id',row.id).in('lesson_id',posts.map(p=>p.id)):{data:[],error:null}
  if(likes.error)throw new HttpError(500,'db')
  const liked=new Set((likes.data??[]).map(l=>l.lesson_id))
  return {posts:posts.map(p=>({...p,liked:liked.has(p.id),completed:false})),next}
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
    // Keys stay private even for completed lessons/practice and an admin's member view.
    quiz: publicQuiz(data.quiz),
    quiz_count: data.quiz?.length ?? 0,
    has_video: !!data.video_url,
    completed: !!p.data,
    score: p.data?.score ?? null,
    liked: !!l.data,
  }
}

function publicQuiz(quiz: unknown) {
  return (Array.isArray(quiz) ? quiz : []).map((q: Row) => ({ q: q.q, options: q.options }))
}

function quizDbError(error: { message?: string } | null) {
  if (!error) return
  const code = ['quiz_not_found', 'quiz_answer_invalid', 'quiz_answer_locked', 'quiz_sequence', 'quiz_required', 'quiz_answers_mismatch'].find(code => error.message?.includes(code))
  throw new HttpError(code === 'quiz_not_found' ? 404 : code === 'quiz_answer_invalid' ? 400 : code ? 409 : 500, code ?? 'db')
}

async function quizStart(body: Row) {
  const row = await member(body)
  const id = Number(body.id)
  const { data: les } = await db.from('lessons').select('id,quiz,published,course_id,free_preview').eq('id', id).maybeSingle()
  if (!les || (!les.published && !row.is_admin)) throw new HttpError(404, 'not_found')
  if (!(await canRead(row, les))) throw new HttpError(403, 'course_locked')
  const { data, error } = await db.rpc('start_lesson_quiz', { p_user: row.id, p_lesson: id })
  quizDbError(error)
  if (!data) throw new HttpError(500, 'db')
  return { attemptId: data.id, questions: publicQuiz(data.quiz), answers: data.answers, feedback: data.feedback,
    practice: data.practice, done: !!data.completed_at, score: data.score, bonus: data.bonus, combo: data.combo }
}

async function quizAnswer(body: Row) {
  const row = await member(body)
  if (typeof body.attemptId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.attemptId) || !Number.isInteger(body.index) || !Number.isInteger(body.answer) || body.index < 0 || body.answer < 0) throw new HttpError(400, 'quiz_answer_invalid')
  const { data: attempt, error: lookupError } = await db.from('lesson_quiz_attempts').select('lesson_id').eq('id', body.attemptId).eq('user_id', row.id).maybeSingle()
  if (lookupError) throw new HttpError(500, 'db')
  if (!attempt) throw new HttpError(404, 'quiz_not_found')
  const { data: les } = await db.from('lessons').select('id,published,course_id,free_preview').eq('id', attempt.lesson_id).maybeSingle()
  if (!les || (!les.published && !row.is_admin)) throw new HttpError(404, 'not_found')
  if (!(await canRead(row, les))) throw new HttpError(403, 'course_locked')
  const { data, error } = await db.rpc('answer_lesson_quiz', { p_user: row.id, p_attempt: body.attemptId, p_index: body.index, p_answer: body.answer })
  quizDbError(error)
  if (!data) throw new HttpError(500, 'db')
  return data
}

async function complete(body: Row) {
  const row = await member(body)
  const id = Number(body.id)
  const { data: les } = await db.from('lessons').select('id,kind,xp,quiz,published,course_id,free_preview').eq('id', id).maybeSingle()
  if (!les || (!les.published && !row.is_admin)) throw new HttpError(404, 'not_found')
  if (!(await canRead(row, les))) throw new HttpError(403, 'course_locked')
  const { data: previous, error: progressError } = await db.from('progress').select('score,total').eq('user_id', row.id).eq('lesson_id', id).maybeSingle()
  if (progressError) throw new HttpError(500, 'db')
  if (body.attemptId !== undefined && (typeof body.attemptId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.attemptId))) throw new HttpError(400, 'quiz_answer_invalid')
  let quiz: Row[] = Array.isArray(les.quiz) ? les.quiz : []
  const query = db.from('lesson_quiz_attempts').select('*').eq('user_id', row.id).eq('lesson_id', id).eq('practice', false)
  if (body.attemptId !== undefined) query.eq('id', body.attemptId)
  const { data: attempt, error: attemptError } = await query.maybeSingle()
  if (attemptError) throw new HttpError(500, 'db')
  // Historical completions have no recorded attempt; keep them idempotent without regrading.
  if (previous && !attempt && !body.attemptId) {
    const {data:receipt,error}=await db.rpc('complete_lesson_awarded',{p_user:row.id,p_lesson:id,p_score:previous.score,p_total:previous.total,p_xp:0,p_tz:tzOf(row)})
    quizDbError(error)
    return { already: true, gained: 0, base: 0, bonus: 0, score: previous.score, total: previous.total, new_achievements: receipt.new_achievements, me: await freshMe(row.id) }
  }
  let answers: number[] = []
  let score = 0
  let bonus = 0
  if (quiz.length || attempt || body.attemptId !== undefined) {
    if (!attempt || !attempt.completed_at || attempt.answers.length !== attempt.quiz.length) throw new HttpError(409, 'quiz_required')
    answers = attempt.answers
    if (body.answers !== undefined && (!Array.isArray(body.answers) || body.answers.length !== answers.length || body.answers.some((value: unknown, index: number) => value !== answers[index]))) throw new HttpError(409, 'quiz_answers_mismatch')
    quiz = attempt.quiz
    score = attempt.score
    bonus = attempt.bonus
  }
  const gained = les.xp + bonus
  const { data: receipt, error } = await db.rpc('complete_lesson_awarded', {
    p_user: row.id,
    p_lesson: id,
    p_score: score,
    p_total: quiz.length,
    p_xp: gained,
    p_tz: tzOf(row),
  })
  // Раньше сбой базы выглядел как «урок уже пройден» и XP молча терялись.
  quizDbError(error)
  if (!receipt.inserted) return { already: true, gained: 0, base: 0, bonus: 0, score, total: quiz.length, new_achievements: receipt.new_achievements, me: await freshMe(row.id) }
  const fresh: string[] = receipt.new_achievements
  await logEvent(row.id, les.kind === 'story' ? 'story_done' : 'lesson_done', id, { score, total: quiz.length, xp: gained, answers: answers.slice(0, 10) })
  return { already: false, gained, base: les.xp, bonus, score, total: quiz.length, new_achievements: fresh, me: await freshMe(row.id) }
}

async function daily(body: Row) {
  const row = await member(body)
  const { data, error } = await db.rpc('claim_daily_awarded', { p_user: row.id, p_today: localDay(tzOf(row, body.tz)) })
  if (error) throw new HttpError(500, 'db')
  const res = Array.isArray(data) ? data[0] : data
  const gained = res?.gained ?? 0
  const streak = res?.new_streak ?? 0
  const fresh: string[] = res?.new_achievements ?? []
  if (gained > 0) await logEvent(row.id, 'daily', null, { streak, xp: gained, froze: !!res?.used_freeze })
  return { gained, froze: !!res?.used_freeze, new_achievements: fresh, me: await freshMe(row.id) }
}

async function like(body: Row) {
  const row = await member(body)
  const { data } = await db.rpc('toggle_like', { p_user: row.id, p_lesson: Number(body.id) })
  const res = Array.isArray(data) ? data[0] : data
  if (res?.liked) await logEvent(row.id, 'like', Number(body.id))
  return { liked: !!res?.liked, likes: res?.likes ?? 0 }
}

// События с клиента: только из белого списка и небольшими пачками.
const CLIENT_EVENTS = ['share', 'copy', 'story_open', 'theme', 'lab', 'catchup']

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
  let caption = 'Учусь в OG CRE8R²: уроки с XP, стриком и рейтингом.'
  let start = `r${row.id}`
  let articleLink: string | null = null
  if (kind === 'lesson' && lessonId > 0) {
    const { data: les, error } = await db.from('lessons').select('id,title,subtitle,body,emoji,course_id,free_preview').eq('id', lessonId).eq('published', true).maybeSingle()
    if (error) throw new HttpError(500, 'db')
    if (!les) throw new HttpError(404, 'not_found')
    if (!(await canRead(row, les))) throw new HttpError(403, 'course_locked')
    const post = newsTelegramPost(les, s.bot, row.id)
    caption = post.text
    articleLink = post.link
    start = `l${les.id}_r${row.id}`
  } else if (kind === 'streak') {
    // Сырой row.streak мог остаться от оборванного стрика — берём живой.
    caption = `Держу стрик в OG CRE8R²: ${aliveStreak(row)} дн. подряд.`
  } else if (kind === 'achievement') {
    caption = 'Открыл новую ачивку в OG CRE8R².'
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
      ...(articleLink ? { parse_mode: 'HTML' } : {}),
      reply_markup: { inline_keyboard: [[{ text: articleLink ? 'Читать полностью' : 'Открыть OG CRE8R²', url: articleLink ?? `https://t.me/${s.bot.username}?${s.bot.main_app ? 'startapp' : 'start'}=${start}` }]] },
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
  const { data: course } = await db.from('courses').select('id,title,published,price_stars').eq('id', id).maybeSingle()
  if (!course?.published) throw new HttpError(404, 'not_found')
  if (await hasAccess(row.id, id)) return { request: 'approved' }
  // У курса с ценой бесплатной заявки нет: он открывается оплатой. Вручную доступ по-прежнему выдаёт автор.
  if (course.price_stars > 0) throw new HttpError(400, 'paid_only')
  // Пока заявка ждёт ответа, повторное нажатие ничего не шлёт: иначе админов можно завалить сообщениями.
  const { data: prev } = await db.from('access_requests').select('status').eq('user_id', row.id).eq('course_id', id).maybeSingle()
  if (prev?.status === 'pending') return { request: 'pending' }
  const { error } = await db.from('access_requests').upsert({ user_id: row.id, course_id: id, status: 'pending', created_at: new Date().toISOString(), decided_at: null })
  if (error) throw new HttpError(500, 'db')
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
  if (row.is_admin || (await hasAccess(row.id, id))) throw new HttpError(400, 'already_open')
  const { data: intent, error } = await db.rpc('course_purchase_intent', { p_user: row.id, p_course: id })
  if (error || !intent) throw new HttpError(500, 'db')
  if (intent.link) return { link: intent.link }
  const r = await tg('createInvoiceLink', {
    title: String(c.title).slice(0, 32), description: String(c.subtitle || c.title).slice(0, 255),
    payload: intent.payload, provider_token: '', currency: 'XTR',
    prices: [{ label: 'Доступ к курсу', amount: intent.stars }],
  })
  if (!r.ok) throw new HttpError(502, 'telegram')
  const stored = await db.rpc('course_purchase_link', { p_user: row.id, p_payload: intent.payload, p_link: r.result })
  if (stored.error || !stored.data) throw new HttpError(500, 'db')
  await logEvent(row.id, 'invoice', null, { course: id, stars: intent.stars })
  return { link: stored.data }
}

// Билет календаря за звёзды. Выдаёт его вебхук после подтверждения оплаты Telegram.
async function adventTicketInvoice(body: Row) {
  const row = await member(body)
  const cfg = needAdvent(await getSettings())
  if (!cfg.catchup.methods.includes('stars')) throw new HttpError(400, 'not_for_sale')
  if (adventClosed(cfg, adventToday(cfg))) throw new HttpError(403, 'advent_closed')
  const r = await tg('createInvoiceLink', {
    title: 'Билет календаря',
    description: 'Открывает одну пропущенную дверь адвент-календаря.',
    payload: `catchup:${row.id}:${Date.now()}`,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: 'Билет', amount: cfg.catchup.stars }],
  })
  if (!r.ok) throw new HttpError(502, 'telegram')
  await logEvent(row.id, 'invoice', null, { catchup: true, stars: cfg.catchup.stars })
  return { link: r.result }
}

async function top(body: Row) {
  const row = await member(body)
  if (OG_PLATFORM_ENABLED) {
    const result = await db.rpc('az_og_progress_top', { p_actor: row.id })
    if (result.error || !result.data) throw new HttpError(503, 'platform_not_ready')
    return result.data
  }
  // В рейтинге только подписчики: экран так и подписан, и отписавшиеся не занимают места.
  const { data } = await db
    .from('users')
    .select('id,first_name,photo_url,xp,streak,last_claim,freezes,tz')
    .eq('subscribed', true)
    .gt('xp', 0)
    .order('xp', { ascending: false })
    .order('id')
    .limit(50)
  const me = await buildMe(row)
  return {
    top: (data ?? []).map((u) => ({ id: u.id, name: u.first_name || 'Друг', photo: u.photo_url, xp: u.xp, streak: aliveStreak(u) })),
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
  const { error } = await db.from('courses').delete().eq('id', Number(body.id))
  if (error) throw new HttpError(500, 'db')
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
  // В шаблоне ilike знаки _ и % — подстановочные; экранируем, чтобы ivan_p не совпал с ivanxp.
  const { data: user } = await db.from('users').select('id,first_name').ilike('username', username.replace(/[\\%_]/g, '\\$&')).maybeSingle()
  if (!user) throw new HttpError(404, 'user_not_found')
  const title = await decideRequest(courseId, user.id, true)
  if (!title) throw new HttpError(404, 'not_found')
  return { name: user.first_name || username }
}

async function adminPayments(body: Row) {
  await member(body, true)
  const cursor = body.cursor
  if (cursor != null && (!Number.isSafeInteger(cursor) || cursor <= 0)) throw new HttpError(400, 'bad_cursor')
  const { data, error } = await db.rpc('admin_payment_page', { p_cursor: cursor ?? null, p_query: str(body.query, 100).trim() })
  if (error) throw new HttpError(500, 'db')
  return data
}

// Возврат звёзд делает сам Telegram по номеру оплаты; после этого закрываем доступ.
async function adminRefund(body: Row) {
  await member(body, true)
  const { data: p } = await db.from('payments').select('id,user_id,charge_id,refunded_at').eq('id', Number(body.id)).maybeSingle()
  if (!p) throw new HttpError(404, 'not_found')
  if (p.refunded_at) {
    await markRefunded(p.charge_id)
    return { ok: true }
  }
  if (!p.user_id) throw new HttpError(404, 'user_not_found')
  const r = await tg('refundStarPayment', { user_id: p.user_id, telegram_payment_charge_id: p.charge_id })
  // Telegram уже вернул эти звёзды раньше — остаётся только отметить это у себя.
  if (!r.ok && !/ALREADY_REFUNDED/i.test(r.description ?? '')) throw new HttpError(502, 'telegram')
  await markRefunded(p.charge_id)
  return { ok: true }
}

async function adminList(body: Row) {
  await member(body, true)
  const scope=body.scope
  if(scope!=null&&!['summary','blog','stories','legacy'].includes(scope))throw new HttpError(400,'bad_scope')
  if(body.cursor!=null&&(!Number.isSafeInteger(body.cursor)||body.cursor<=0))throw new HttpError(400,'bad_cursor')
  const search=String(body.query??'').trim().slice(0,120)
  let materials=db.from('lessons').select('*')
  if(scope==='stories')materials=materials.eq('kind','story')
  if(scope==='blog')materials=materials.eq('kind','lesson').is('course_id',null)
  if(scope==='legacy')materials=materials.eq('kind','lesson').not('course_id','is',null)
  if(scope&&body.cursor!=null)materials=materials.lt('id',body.cursor)
  if(scope&&search)materials=materials.ilike('title',`%${search.replace(/[\\%_]/g,'\\$&')}%`)
  const dayStart=new Date(Date.now()-24*3600_000).toISOString()
  const [lessons,users,subs,active,done]=await Promise.all([
    scope==='summary'?Promise.resolve({data:[],error:null}):scope?materials.order('id',{ascending:false}).limit(31):materials.order('created_at',{ascending:false}).limit(500),
    db.from('users').select('id',{count:'exact',head:true}),
    db.from('users').select('id',{count:'exact',head:true}).eq('subscribed',true),
    db.from('users').select('id',{count:'exact',head:true}).gte('last_seen',dayStart),
    db.from('progress').select('lesson_id',{count:'exact',head:true}),
  ])
  if([lessons,users,subs,active,done].some(result=>result.error))throw new HttpError(500,'db')
  const page=(lessons.data??[]).slice(0,scope?30:500)
  return {lessons:page,next:scope&&(lessons.data??[]).length>30?page.at(-1)!.id:null,stats:{users:users.count??0,subscribed:subs.count??0,active:active.count??0,completions:done.count??0}}
}

async function adminAnalytics(body: Row) {
  await member(body, true)
  const { data, error } = await db.rpc('analytics_summary', { p_days: 14, p_tz: clampTz(body.tz) })
  if (error) throw new HttpError(500, 'db')
  const { data: pays } = await db.from('payments').select('stars').is('refunded_at', null)
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
  const { error } = await db.from('lessons').delete().eq('id', Number(body.id))
  if (error) throw new HttpError(500, 'db')
  return { ok: true }
}

// Анонс урока в канал: кнопка ведёт обратно в приложение.
async function adminAnnounce(body: Row) {
  await member(body, true)
  const s = await getSettings()
  const { data: les } = await db.from('lessons').select('*').eq('id', Number(body.id)).maybeSingle()
  if (!les || !les.published) throw new HttpError(400, 'not_published')
  if (les.course_id || les.kind !== 'lesson') throw new HttpError(400, 'news_only')
  if (!s.channel?.id || !s.bot?.username) throw new HttpError(400, 'not_ready')
  // The durable queue owns news delivery; manual clicks must not duplicate it.
  if (s.news_publishing?.enabled && les.kind === 'lesson' && !les.course_id) return { ok: true, queued: true }
  const { text, link } = newsTelegramPost(les, s.bot)
  const r = await tg('sendMessage', {
    chat_id: s.channel.id,
    text,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: 'Открыть в OG CRE8R²', url: link }]] },
  })
  if (!r.ok) throw new HttpError(502, 'telegram')
  return { ok: true }
}

// ---------- Бот: команды профиля и новостей ----------

// /profile (и псевдоним /me): та же аналитика, что во вкладке профиля — XP, уровень, стрик, место.
async function handleProfile(chatId: number, userId: number, s: Settings) {
  const appUrl = typeof s.app_url === 'string' ? s.app_url : ''
  try {
    const { data: row } = await db.from('users').select('*').eq('id', userId).maybeSingle()
    if (!row) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: 'Профиля пока нет. Открой приложение один раз через /start — тогда появится статистика.',
        ...(appUrl
          ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть OG CRE8R²', web_app: { url: appUrl } }]] } }
          : {}),
      })
      return
    }
    const me = await buildMe(row)
    const lvl = levelOf(me.xp)
    const achTotal = 9
    const achGot = Array.isArray(me.achievements) ? me.achievements.length : 0
    const lines = [
      `<b>${escapeHtml(me.name)}</b> — ${escapeHtml(lvl.emoji)} ${escapeHtml(lvl.title)}, уровень ${lvl.index}`,
      `⚡ ${me.xp} XP · 🏆 место ${me.rank}`,
      `🔥 стрик ${me.streak} · лучший ${me.best_streak}`,
      `📚 уроков: ${me.lessons_done} · 🏅 ачивки ${achGot}/${achTotal}`,
      `🤝 приглашено: ${me.invited} · ❄️ заморозки: ${me.freezes}`,
      lvl.next ? `До уровня «${escapeHtml(lvl.next.title)}» осталось ${lvl.left} XP.` : 'Максимальный уровень.',
      me.daily_claimed ? 'Бонус дня уже забран.' : 'Бонус дня ждёт в приложении.',
    ]
    await tg('sendMessage', {
      chat_id: chatId,
      text: lines.join('\n'),
      parse_mode: 'HTML',
      ...(appUrl
        ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть профиль', web_app: { url: appUrl } }]] } }
        : {}),
    })
  } catch (e) {
    console.error('profile_cmd', e)
    await tg('sendMessage', { chat_id: chatId, text: 'Не получилось достать профиль. Загляни чуть позже.' })
  }
}

// /news: три свежих опубликованных урока из общей ленты (без уроков закрытых курсов).
async function handleNews(chatId: number, s: Settings) {
  const appUrl = typeof s.app_url === 'string' ? s.app_url : ''
  const botName = s.bot?.username ? String(s.bot.username) : ''
  try {
    const { data, error } = await db
      .from('lessons')
      .select('id,title,subtitle,emoji,minutes,xp,published_at')
      .eq('published', true)
      .eq('kind', 'lesson')
      .is('course_id', null)
      .order('published_at', { ascending: false })
      .limit(3)
    if (error) throw error
    const items = data ?? []
    if (!items.length) {
      await tg('sendMessage', { chat_id: chatId, text: 'Пока пусто. Первый урок появится здесь сразу после анонса.' })
      return
    }
    const lines = items.map((l: Row, i: number) => {
      const title = escapeHtml(String(l.title ?? 'Без названия'))
      const sub = str(l.subtitle, 120)
      const meta = `${Number(l.minutes) || 3} мин · +${Number(l.xp) || 0} XP`
      return `${i + 1}. ${escapeHtml(String(l.emoji ?? '✨'))} <b>${title}</b>\n${sub ? `${escapeHtml(sub)}\n` : ''}${escapeHtml(meta)}`
    })
    const payload: Row = { chat_id: chatId, text: `Свежее в OG CRE8R²:\n\n${lines.join('\n\n')}`, parse_mode: 'HTML' }
    if (appUrl) {
      payload.reply_markup = {
        inline_keyboard: items.map((l: Row) => [{ text: `Открыть: ${String(l.title ?? '').slice(0, 24) || 'урок'}`, web_app: { url: `${appUrl}/?sp=l${l.id}` } }]),
      }
    } else if (botName) {
      const mainApp = !!s.bot?.main_app
      payload.reply_markup = {
        inline_keyboard: items.map((l: Row) => [{ text: `Открыть: ${String(l.title ?? '').slice(0, 24) || 'урок'}`, url: `https://t.me/${botName}?${mainApp ? 'startapp' : 'start'}=l${l.id}` }]),
      }
    }
    await tg('sendMessage', payload)
  } catch (e) {
    console.error('news_cmd', e)
    await tg('sendMessage', { chat_id: chatId, text: 'Не получилось достать новости. Загляни чуть позже.' })
  }
}

// ---------- Бот ----------

async function webhook(req: Request) {
  if (!BOT_TOKEN) return json({ ok: false }, 503)
  if (req.headers.get('x-telegram-bot-api-secret-token') !== (await webhookSecret())) return json({ ok: false }, 401)
  const update = await req.json().catch(() => ({}))
  // One Telegram bot has one webhook. New module invoices use UUID payloads;
  // legacy course:/catchup: payments and bot commands stay on their existing path.
  const platformPayload = update.pre_checkout_query?.invoice_payload ?? update.message?.successful_payment?.invoice_payload ?? update.message?.refunded_payment?.invoice_payload
  if (typeof platformPayload === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(platformPayload)) {
    const appUrl = Deno.env.get('APP_URL')
    if (!appUrl) return json({ ok:false, error:'platform_not_configured' },503)
    const [{createHandler},{createGateway}] = await Promise.all([import('../_shared/handler.ts'),import('../_shared/gateway.ts')])
    const names = ['ADMIN_TELEGRAM_IDS','OIDC_CLIENT_ID','OIDC_CLIENT_SECRET','ALLOWED_ORIGINS','CRON_SECRET','INTEGRATION_WEBHOOK_SECRET','ADMIN_RETURN_PATH','API_PUBLIC_PATH']
    const env = {...Object.fromEntries(names.map(name=>[name,Deno.env.get(name)||''])),APP_URL:appUrl,BOT_TOKEN,SUPABASE_URL,ADMIN_TELEGRAM_IDS:Deno.env.get('ADMIN_TELEGRAM_IDS')||'',WEBHOOK_SECRET:await webhookSecret()}
    return await createHandler({env,gateway:createGateway(SUPABASE_URL,serviceKey())})(new Request(`${SUPABASE_URL}/functions/v1/az-master-api/v1/webhook`,{method:'POST',headers:{'Content-Type':'application/json','x-telegram-bot-api-secret-token':env.WEBHOOK_SECRET},body:JSON.stringify(update)}))
  }
  // Оплату нельзя потерять: если базу не удалось обновить, отвечаем ошибкой — Telegram пришлёт уведомление ещё раз.
  let retry = false
  try {
    const s = await getSettings(!!update.my_chat_member)

    const msg = update.message
    const cmd = msg?.chat?.type === 'private' && typeof msg.text === 'string' ? botCmd(msg.text) : ''
    if (cmd === '/start') {
      const payload = msg.text.split(/\s+/)[1]?.replace(/[^\w-]/g, '').slice(0, 64) ?? ''
      const appUrl = s.app_url
      if (appUrl) {
        await tg('sendMessage', {
          chat_id: msg.chat.id,
          text: 'Это OG CRE8R². Уроки, туториалы и новости — в одном месте, с XP и стриком.\n\nДоступ открыт подписчикам канала.',
          reply_markup: {
            inline_keyboard: [[{ text: 'Открыть OG CRE8R²', web_app: { url: payload ? `${appUrl}/?sp=${payload}` : appUrl } }]],
          },
        })
      }
    }

    if (cmd === '/paysupport') {
      await tg('sendMessage', { chat_id: msg.chat.id, text: 'Вопрос по оплате? Напиши @elazart — разберёмся и вернём звёзды, если курс не открылся.' })
    }

    if (cmd === '/profile' || cmd === '/me') {
      const userId = botSender(msg)
      if (userId) await handleProfile(msg.chat.id, userId, s)
    }

    if (cmd === '/news') {
      await handleNews(msg.chat.id, s)
    }

    // Telegram ждёт ответа на проверку перед оплатой не дольше 10 секунд.
    const pcq = update.pre_checkout_query
    if (pcq) {
      let ok = false
      let reason = 'Курс сейчас недоступен или уже открыт. Звёзды не списаны.'
      if (pcq.currency === 'XTR' && /^(?:course:|purchase:)/.test(pcq.invoice_payload ?? '')) {
        const checked = await db.rpc('check_course_checkout', { p_user: pcq.from?.id, p_payload: pcq.invoice_payload, p_stars: pcq.total_amount, p_query: pcq.id })
        if (checked.error) throw new HttpError(500, 'db')
        ok = checked.data === true
      }
      // Билет календаря: цена из настроек, календарь должен быть открыт.
      const t = /^catchup:(\d+):\d+$/.exec(pcq.invoice_payload ?? '')
      if (t && pcq.currency === 'XTR' && Number(t[1]) === pcq.from?.id) {
        const cfg = adventCfg(s)
        ok = !!cfg && cfg.catchup.methods.includes('stars') && cfg.catchup.stars === pcq.total_amount && !adventClosed(cfg, adventToday(cfg))
        reason = 'Календарь сейчас не продаёт билеты. Звёзды не списаны.'
      }
      await tg('answerPreCheckoutQuery', {
        pre_checkout_query_id: pcq.id,
        ok,
        ...(ok ? {} : { error_message: reason }),
      })
    }

    const paid = msg?.successful_payment
    if (paid && /^(?:course:|purchase:)/.test(paid.invoice_payload ?? '')) {
      const userId = msg.from?.id
      if (paid.currency !== 'XTR') throw new HttpError(400, 'payment_currency')
      const { data: payment, error } = await db.rpc('apply_course_purchase', {
        p_user: userId, p_payload: paid.invoice_payload, p_stars: paid.total_amount, p_charge: paid.telegram_payment_charge_id,
      })
      if (error || !payment) {
        console.error('payment', paid.telegram_payment_charge_id, error)
        retry = true
      } else if (!payment.duplicate && !payment.refunded && !payment.refund_pending) {
        await logEvent(userId, 'purchase', null, { course: payment.course_id, stars: paid.total_amount })
        const { data: course } = await db.from('courses').select('id,title').eq('id', payment.course_id).maybeSingle()
        if (course) await notifyOpened(userId, course, s)
      }
      if (payment?.refund_pending) {
        try { await processRefundJobs(db, tg) } catch (error) { console.error('refund worker', error) }
      }
    }

    // Оплата билета календаря: запись в журнале и билет — обе операции можно повторять без дублей.
    const ticketPay = paid && /^catchup:(\d+):\d+$/.exec(paid.invoice_payload ?? '')
    if (ticketPay && Number(ticketPay[1]) === msg.from?.id) {
      const userId = Number(ticketPay[1])
      const charge = String(paid.telegram_payment_charge_id)
      const { data: payment, error } = await db.rpc('apply_ticket_payment', { p_user: userId, p_stars: paid.total_amount, p_charge: charge })
      if (error || !payment) retry = true
      else if (payment.inserted && !payment.refunded) {
        await logEvent(userId, 'purchase', null, { catchup: true, stars: paid.total_amount })
        await tg('sendMessage', { chat_id: userId, text: '🎟 Билет успешно получен! Открой календарь и выбери пропущенную дверь.' })
      }
    }

    // Звёзды вернули (из админки или через поддержку Telegram) — доступ закрываем.
    const refunded = msg?.refunded_payment
    if (refunded?.telegram_payment_charge_id) await markRefunded(String(refunded.telegram_payment_charge_id))

    const cb = update.callback_query
    if (typeof cb?.data === 'string' && cb.data.startsWith('req:')) {
      const [, action, courseId, userId] = cb.data.split(':')
      if (await resolveAdmin({ id: cb.from?.id, username: cb.from?.username }, {})) {
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
      if (st === 'administrator' && (s.channel?.id === mine.chat.id || (!s.channel?.id && adminIds(s).includes(Number(mine.from?.id))))) {
        await setSetting('channel', { id: mine.chat.id, title: mine.chat.title ?? '' })
        if (mine.from?.id) {
          await tg('sendMessage', { chat_id: mine.from.id, text: `Канал «${mine.chat.title ?? ''}» подключён. OG CRE8R² теперь проверяет подписку.` })
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
    if (update.message?.successful_payment || update.message?.refunded_payment) retry = true
  }
  return retry ? json({ ok: false }, 500) : json({ ok: true })
}

// Идемпотентная настройка бота: вебхук, кнопка меню, команды. Секретов не возвращает.
async function setup(req: Request) {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const secret = Deno.env.get('SETUP_SECRET')
  if (!secret) return json({ error: 'setup_disabled' }, 503)
  if (req.headers.get('x-setup-secret') !== secret) return json({ error: 'forbidden' }, 403)
  if (!BOT_TOKEN) return json({ ok: false, error: 'no_token' }, 503)
  const s = await getSettings(true)
  const me = await tg('getMe')
  if (!me.ok) return json({ ok: false, error: 'bad_token' }, 502)
  await setSetting('bot', { id: me.result.id, username: me.result.username, main_app: !!me.result.has_main_web_app })
  // Адрес вебхука берём из проекта, в котором работает функция. Раньше он читался из settings.api_url,
  // а миграция 006 записывает туда адрес старого проекта — после переезда /setup вешал вебхук не туда.
  const hook = await tg('setWebhook', {
    url: `${SUPABASE_URL}/functions/v1/api/webhook`,
    secret_token: await webhookSecret(),
    allowed_updates: ['message', 'my_chat_member', 'chat_member', 'pre_checkout_query', 'callback_query'],
  })
  let menu = false
  if (s.app_url) {
    const r = await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'OG CRE8R²', web_app: { url: s.app_url } } })
    menu = r.ok
  }
  await tg('setMyCommands', {
    commands: [
      { command: 'start', description: 'Открыть OG CRE8R²' },
      { command: 'profile', description: 'Мой прогресс' },
      { command: 'news', description: 'Три свежие новости' },
      { command: 'paysupport', description: 'Вопрос по оплате' },
    ],
  })
  await tg('setMyShortDescription', { short_description: 'OG CRE8R² — уроки, туториалы и новости для подписчиков канала.' })
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

// ---------- Адвент-календарь ----------
// Двери открываются по календарю кампании (пояс из settings.advent.tz), а не по поясу человека:
// у всех участников дверь №7 открывается в одну и ту же минуту. Все очки и награды считает сервер.

const ADVENT_THEMES = ['standard', 'halloween', 'newyear']
/** Чем можно заработать билет «догнать». Каждый способ проверяет сервер. */
const CATCHUP_METHODS = ['quiz', 'invite', 'story', 'stars']
/** Сколько билетов за переходы из сторис может получить один человек — защита от накрутки своими аккаунтами. */
const STORY_TICKETS = 5
const REWARD_KINDS = ['promo', 'message', 'link', 'video', 'lesson', 'course', 'certification']
/** Как выдаётся приз: за N дверей, в выбранные дни, мгновенный выигрыш или розыгрыш после окна. */
const REWARD_MODES = ['threshold', 'day', 'instant', 'draw']
const DOOR_KINDS = ['quiz', 'scratch', 'arcade', 'story']

interface CatchupCfg {
  methods: string[]
  stars: number
}

function catchupCfg(c: Row | undefined): CatchupCfg {
  const methods = Array.isArray(c?.methods) ? c.methods.filter((m: unknown) => CATCHUP_METHODS.includes(String(m))) : CATCHUP_METHODS
  return { methods, stars: int(c?.stars, 1, 10_000, 50) }
}

interface AdventCfg {
  title: string
  theme: string
  catchup: CatchupCfg
  start: string
  days: number
  tz: number
  grace: number
  push_hour: number
}

function adventCfg(s: Settings): AdventCfg | null {
  const a = s.advent
  if (!a?.enabled || typeof a.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.start)) return null
  return {
    title: str(a.title, 60) || 'Адвент-календарь',
    theme: ADVENT_THEMES.includes(a.theme) ? a.theme : 'standard',
    catchup: catchupCfg(a.catchup),
    start: a.start,
    days: int(a.days, 1, 60, 24),
    tz: clampTz(a.tz ?? 300),
    grace: int(a.grace, 0, 30, 3),
    push_hour: int(a.push_hour, 0, 23, 10),
  }
}

/** Номер сегодняшнего дня кампании: 1 — первый день, 0 и меньше — до старта. */
const adventToday = (cfg: AdventCfg) => dayDiff(localDay(cfg.tz), cfg.start) + 1
const adventClosed = (cfg: AdventCfg, today: number) => today > cfg.days + cfg.grace

const QUIZ_POINT = 10
const LATE_RATE = 0.5
const arcadeCap = (door: Row) => int(door.arcade?.cap, 1, 1000, 40)
const arcadeSeconds = (door: Row) => int(door.arcade?.seconds, 10, 120, 30)

/** XP за дверь: база + 10 за верный ответ квиза или половина очков аркады (не выше потолка). Опоздание — вдвое меньше. */
function doorXp(door: Row, score: number, late: boolean) {
  const bonus = door.kind === 'quiz' ? score * QUIZ_POINT : door.kind === 'arcade' ? Math.floor(Math.min(score, arcadeCap(door)) / 2) : 0
  return Math.round((door.xp + bonus) * (late ? LATE_RATE : 1))
}

/** Серия: сколько дней подряд двери открывались в свой день, считая от сегодня (или вчера, если сегодня ещё нет). */
function adventStreak(opens: Row[], today: number) {
  const onTime = new Set(opens.filter((o) => !o.late).map((o) => o.day))
  let d = onTime.has(today) ? today : today - 1
  let n = 0
  while (d >= 1 && onTime.has(d)) {
    n++
    d--
  }
  return n
}

async function adventSummary(row: Row, s: Settings) {
  const cfg = adventCfg(s)
  if (!cfg) return null
  const today = adventToday(cfg)
  if (adventClosed(cfg, today)) return null
  const { data } = await db.from('advent_opens').select('day,late').eq('user_id', row.id)
  const opens = data ?? []
  return {
    title: cfg.title,
    theme: cfg.theme,
    start: cfg.start,
    days: cfg.days,
    today,
    opened: opens.length,
    today_open: opens.some((o) => o.day === today),
    streak: adventStreak(opens, today),
  }
}

/** Начало кампании как момент времени: полночь первого дня по поясу календаря. */
const campaignSince = (cfg: AdventCfg) => new Date(Date.parse(`${cfg.start}T00:00:00Z`) - cfg.tz * 60_000).toISOString()

/** Начисляет билеты за то, что уже сделано: уроки с квизом без ошибок и приглашённые друзья. Повторно ничего не дублирует. */
async function syncTickets(row: Row, cfg: AdventCfg) {
  const since = campaignSince(cfg)
  const fresh: Row[] = []
  if (cfg.catchup.methods.includes('quiz')) {
    const { data } = await db.from('progress').select('lesson_id,score,total').eq('user_id', row.id).gte('completed_at', since)
    for (const p of data ?? []) if (p.total > 0 && p.score === p.total) fresh.push({ user_id: row.id, source: 'quiz', ref: `quiz:${row.id}:${p.lesson_id}` })
  }
  if (cfg.catchup.methods.includes('invite')) {
    // Друг засчитывается, только когда прошёл проверку подписки (ref_rewarded) и пришёл во время кампании.
    const { data } = await db.from('users').select('id').eq('referred_by', row.id).eq('ref_rewarded', true).gte('created_at', since)
    for (const u of data ?? []) fresh.push({ user_id: row.id, source: 'invite', ref: `invite:${u.id}` })
  }
  if (fresh.length) await db.from('advent_tickets').upsert(fresh, { onConflict: 'ref', ignoreDuplicates: true })
}

async function ticketStats(userId: number) {
  const { data } = await db.from('advent_tickets').select('source,used_at,revoked_at').eq('user_id', userId)
  const live = (data ?? []).filter((t) => !t.revoked_at)
  const earned: Record<string, number> = { quiz: 0, invite: 0, story: 0, stars: 0, admin: 0 }
  for (const t of live) earned[t.source] = (earned[t.source] ?? 0) + 1
  return { available: live.filter((t) => !t.used_at).length, used: live.filter((t) => t.used_at).length, earned }
}

/** Кто-то открыл приложение по ссылке из сторис — автору сторис билет. Себе и дважды от одного человека — нельзя. */
async function storyVisit(ownerId: number, visitorId: number, s: Settings) {
  const cfg = adventCfg(s)
  if (!cfg || !cfg.catchup.methods.includes('story') || ownerId === visitorId) return
  if (adventClosed(cfg, adventToday(cfg))) return
  const { count } = await db.from('advent_tickets').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).eq('source', 'story')
  if ((count ?? 0) >= STORY_TICKETS) return
  const { error } = await db.from('advent_tickets').insert({ user_id: ownerId, source: 'story', ref: `story:${ownerId}:${visitorId}` })
  if (!error) await tg('sendMessage', { chat_id: ownerId, text: '🎟 По ссылке из твоей сторис зашёл человек — у тебя билет, чтобы догнать пропущенную дверь календаря.' })
}

function needAdvent(s: Settings) {
  const cfg = adventCfg(s)
  if (!cfg) throw new HttpError(404, 'advent_off')
  return cfg
}

async function advent(body: Row) {
  const row = await member(body)
  const cfg = needAdvent(await getSettings())
  const today = adventToday(cfg)
  const closed = adventClosed(cfg, today)
  await syncTickets(row, cfg)
  await runDueDraws(cfg, today, await getSettings())
  const [doors, opens, rewards, codes, tickets] = await Promise.all([
    db.from('advent_doors').select('day,kind,title,emoji').lte('day', cfg.days).order('day'),
    db.from('advent_opens').select('day,score,total,xp,late').eq('user_id', row.id),
    db.from('advent_rewards').select('id,doors,title,description,emoji,stock,kind,payload,mode,day_from,day_to,drawn_at').order('doors').order('position'),
    db.from('reward_codes').select('code,reward_id,status,redeemed_at').eq('user_id', row.id),
    ticketStats(row.id),
  ])
  if (doors.error || rewards.error) throw new HttpError(500, 'db')
  const opened = new Map((opens.data ?? []).map((o) => [o.day, o]))
  const mine = new Map((codes.data ?? []).map((c) => [c.reward_id, c]))
  // Сколько осталось у призов с лимитом — показываем в календаре: «осталось 9 из 13».
  const issued = new Map<number, number>()
  await Promise.all(
    (rewards.data ?? [])
      .filter((r) => r.stock != null)
      .map(async (r) => {
        const { count } = await db.from('reward_codes').select('code', { count: 'exact', head: true }).eq('reward_id', r.id)
        issued.set(r.id, count ?? 0)
      }),
  )
  return {
    title: cfg.title,
    theme: cfg.theme,
    start: cfg.start,
    days: cfg.days,
    today,
    closed,
    opened: opened.size,
    streak: adventStreak(opens.data ?? [], today),
    // Будущие двери — сюрприз: тему и иконку не показываем, пока не наступил день.
    doors: (doors.data ?? []).map((d) => {
      const o = opened.get(d.day)
      const state = o ? 'open' : d.day > today ? 'locked' : closed ? 'missed' : d.day === today ? 'today' : 'late'
      return { day: d.day, kind: d.kind, title: d.day <= today ? d.title : null, emoji: d.day <= today ? d.emoji : null, state, xp: o?.xp ?? null }
    }),
    // Содержимое приза (текст, ссылка, урок) отдаём только тому, кому он уже выдан.
    rewards: (rewards.data ?? []).map((r) => {
      const c = mine.get(r.id)
      const kind = r.kind ?? 'promo'
      return {
        id: r.id,
        doors: r.doors,
        title: r.title,
        description: r.description,
        emoji: r.emoji,
        stock: r.stock,
        kind,
        issued: !!c,
        code: c && kind === 'promo' ? c.code : null,
        redeemed: c?.status === 'redeemed',
        content: c ? rewardContent(kind, r.payload) : null,
        mode: r.mode ?? 'threshold',
        day_from: r.day_from ?? null,
        day_to: r.day_to ?? null,
        left: r.stock != null ? Math.max(0, r.stock - (issued.get(r.id) ?? 0)) : null,
        drawn: !!r.drawn_at,
        // Шансы в розыгрыше: сколько дверей окна человек уже открыл.
        entries: r.mode === 'draw' ? (opens.data ?? []).filter((o) => inWindow(r, o.day)).length : null,
      }
    }),
    catchup: { methods: cfg.catchup.methods, stars: cfg.catchup.stars, tickets: tickets.available, used: tickets.used, earned: tickets.earned },
  }
}

function rewardContent(kind: string, payload: Row | null) {
  const p = payload ?? {}
  if (kind === 'message') return { text: String(p.text ?? '') }
  if (kind === 'link' || kind === 'video') return { url: String(p.url ?? ''), label: String(p.label ?? '') }
  if (kind === 'lesson') return { lesson_id: Number(p.lesson_id) || null }
  if (kind === 'course') return { course_id: Number(p.course_id) || null }
  if (kind === 'certification') return { certification_id: String(p.certification_id ?? '') }
  return null
}

/** Дверь, человек и день кампании. Будущую дверь не отдаём даже по прямому запросу. */
async function loadDoor(body: Row) {
  const row = await member(body)
  const cfg = needAdvent(await getSettings())
  const today = adventToday(cfg)
  const day = int(body.day, 1, 60, 0)
  if (!day || day > cfg.days) throw new HttpError(404, 'not_found')
  if (day > today) throw new HttpError(403, 'door_locked')
  const [door, open] = await Promise.all([
    db.from('advent_doors').select('*').eq('day', day).maybeSingle(),
    db.from('advent_opens').select('score,total,xp,late').eq('user_id', row.id).eq('day', day).maybeSingle(),
  ])
  if (!door.data) throw new HttpError(404, 'not_found')
  return { row, cfg, today, door: door.data as Row, open: open.data as Row | null }
}

/** Что видно на двери. До открытия — без правильных ответов, текста и приза: их нельзя подсмотреть в запросе. */
function doorView(door: Row, open: Row | null, cfg: AdventCfg, today: number) {
  const quiz: Row[] = Array.isArray(door.quiz) ? door.quiz : []
  return {
    day: door.day,
    kind: door.kind,
    title: door.title,
    subtitle: door.subtitle,
    emoji: door.emoji,
    xp: door.xp,
    late: !open && door.day < today,
    closed: !open && adventClosed(cfg, today),
    opened: open ? { score: open.score, total: open.total, xp: open.xp, late: open.late } : null,
    quiz: quiz.map((q) => ({ q: q.q, options: q.options, ...(open ? { correct: q.correct, explain: q.explain ?? '' } : {}) })),
    arcade: door.kind === 'arcade' ? { seconds: arcadeSeconds(door), cap: arcadeCap(door) } : null,
    prize: open ? door.prize : null,
    body: open ? door.body : null,
  }
}

async function adventDoor(body: Row) {
  const { row, cfg, today, door, open } = await loadDoor(body)
  if (open) await recoverDoorRewards(row, door.day, today, await getSettings())
  return doorView(door, open, cfg, today)
}

// Коды генерирует база (advent_grant): без похожих символов 0/O, 1/I/L — кассиру проще прочитать с экрана.
const normCode = (v: unknown) => {
  const s = str(v, 20).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : s
}

/** Случайное число [0, 1) из криптографического генератора. */
const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4_294_967_296

const inWindow = (r: Row, day: number) => day >= (r.day_from ?? 1) && day <= (r.day_to ?? 60)

/**
 * Шанс мгновенного выигрыша при этом открытии. Темп считаем по открытиям в окне:
 * сколько уже было в день и сколько, значит, ещё будет до конца окна. Остаток делим на ожидаемые
 * открытия — так лимит расходится равномерно, а в последний день окна разыгрывается всё, что осталось.
 */
async function instantChance(r: Row, today: number, left: number) {
  const from = r.day_from ?? 1
  const to = r.day_to ?? 60
  const span = to - from + 1
  const elapsed = Math.min(Math.max(today - from + 1, 1), span)
  const { count } = await db.from('advent_opens').select('day', { count: 'exact', head: true }).gte('day', from).lte('day', to)
  const rate = (count ?? 0) / elapsed
  const expected = rate * (span - elapsed) + 1
  return Math.min(1, left / expected)
}

/** Призы, которые можно получить этим открытием двери: за N дверей, подарок дня, мгновенный выигрыш. */
async function awardOnOpen(row: Row, opened: number, day: number, today: number, s: Settings) {
  const [rewards, mine] = await Promise.all([
    db.from('advent_rewards').select('*').order('doors').order('position'),
    db.from('reward_codes').select('reward_id').eq('user_id', row.id),
  ])
  if (rewards.error || mine.error) throw new HttpError(500, 'db')
  const have = new Set((mine.data ?? []).map((c) => c.reward_id))
  const fresh: Row[] = []
  for (const r of rewards.data ?? []) {
    if (have.has(r.id)) continue
    const mode = r.mode ?? 'threshold'
    let take = false
    if (mode === 'threshold') take = opened >= r.doors
    else if (mode === 'day') take = inWindow(r, day)
    else if (mode === 'instant' && inWindow(r, day) && r.stock != null) {
      const { count } = await db.from('reward_codes').select('code', { count: 'exact', head: true }).eq('reward_id', r.id)
      const left = r.stock - (count ?? 0)
      take = left > 0 && secureRandom() < (await instantChance(r, today, left))
    }
    const decision = await db.rpc('advent_reward_decision', { p_user: row.id, p_day: day, p_reward: r.id, p_take: take })
    if (decision.error) throw new HttpError(500, 'db')
    if (!decision.data) continue
    // Лимит и повтор проверяет база под блокировкой: лишний приз не выпадет даже при одновременных открытиях.
    const { data: code, error } = await db.rpc('advent_grant', { p_user: row.id, p_reward: r.id })
    if (error) throw new HttpError(500, 'db')
    if (!code) continue
    const kind = r.kind ?? 'promo'
    fresh.push({ reward_id: r.id, code: kind === 'promo' ? code : null, kind, mode, title: r.title, emoji: r.emoji, content: rewardContent(kind, r.payload) })
  }
  if (fresh.length) await notifyRewards(row.id, fresh, s)
  return fresh
}

// Приз дублируем в чат с ботом: так он не потеряется, даже если человек закроет приложение.
async function notifyRewards(userId: number, fresh: Row[], s: Settings, heading = '🎉 <b>Поздравляем! Награда получена:</b>') {
  for (const text of rewardNotifications(fresh, heading)) await tg('sendMessage', {
    chat_id: userId,
    parse_mode: 'HTML',
    text,
    ...(s.app_url ? { reply_markup: { inline_keyboard: [[{ text: '🎁 Мои награды в календаре', web_app: { url: `${s.app_url}/?sp=advent` } }]] } } : {}),
  })
}

/** Розыгрыш одного приза: победителей выбирает база, мы сообщаем им в чат. */
async function runDraw(reward: Row, s: Settings) {
  const { data, error } = await db.rpc('advent_draw', { p_reward: reward.id })
  if (error) throw new HttpError(500, 'db')
  const winners: Row[] = Array.isArray(data) ? data : []
  const kind = reward.kind ?? 'promo'
  for (const w of winners) {
    await notifyRewards(
      w.winner_id,
      [{ reward_id: reward.id, code: kind === 'promo' ? w.winner_code : null, kind, title: reward.title, emoji: reward.emoji, content: rewardContent(kind, reward.payload) }],
      s,
      'Ты выиграл в розыгрыше календаря!',
    )
  }
  return winners.length
}

/** Розыгрыши, у которых окно уже закончилось, проводятся при первом же обращении к календарю. */
async function runDueDraws(cfg: AdventCfg, today: number, s: Settings) {
  const { data } = await db.from('advent_rewards').select('*').eq('mode', 'draw').is('drawn_at', null)
  for (const r of data ?? []) {
    const end = Math.min(r.day_to ?? cfg.days, cfg.days)
    if (today > end) await runDraw(r, s)
  }
}

async function recoverDoorRewards(row: Row, day: number, today: number, s: Settings) {
  const { count, error } = await db.from('advent_opens').select('day', { count: 'exact', head: true }).eq('user_id', row.id)
  if (error) throw new HttpError(500, 'db')
  return awardOnOpen(row, count ?? 0, day, today, s)
}

async function adventOpen(body: Row) {
  const { row, cfg, today, door, open } = await loadDoor(body)
  const s = await getSettings()
  if (open) {
    const recovered = await recoverDoorRewards(row, door.day, today, s)
    return { already: true, gained: 0, score: open.score, total: open.total, opened: null, new_codes: recovered, door: doorView(door, open, cfg, today), me: await buildMe(row) }
  }
  if (adventClosed(cfg, today)) throw new HttpError(403, 'advent_closed')
  const late = door.day < today
  let score = 0
  let total = 0
  if (door.kind === 'quiz') {
    const quiz: Row[] = Array.isArray(door.quiz) ? door.quiz : []
    const answers: unknown[] = Array.isArray(body.answers) ? body.answers : []
    total = quiz.length
    score = quiz.filter((q, i) => Number(answers[i]) === q.correct).length
  } else if (door.kind === 'arcade') {
    // Счёт аркады присылает клиент, поэтому он ограничен потолком: накрутка даёт не больше cap / 2 XP.
    total = arcadeCap(door)
    score = Math.min(int(body.score, 0, 100_000, 0), total)
  }
  const xp = doorXp(door, score, late)
  // Пропущенная дверь открывается только за билет; билет списывается в той же транзакции.
  if (late) await syncTickets(row, cfg)
  const { data, error } = late
    ? await db.rpc('advent_open_late', { p_user: row.id, p_day: door.day, p_score: score, p_total: total, p_xp: xp })
    : await db.rpc('advent_open', { p_user: row.id, p_day: door.day, p_score: score, p_total: total, p_xp: xp, p_late: false })
  if (error) throw new HttpError(500, 'db')
  const res = Array.isArray(data) ? data[0] : data
  if (late && res && !res.ticket) throw new HttpError(402, 'need_ticket')
  const inserted = !!res?.inserted
  const newCodes = await awardOnOpen(row, res.opened, door.day, today, s)
  if (inserted) await logEvent(row.id, 'advent_open', null, { day: door.day, kind: door.kind, score, late })
  const after = { score, total, xp, late }
  return {
    already: !inserted,
    gained: inserted ? xp : 0,
    score,
    total,
    opened: res?.opened ?? null,
    new_codes: newCodes,
    door: doorView(door, after, cfg, today),
    me: await freshMe(row.id),
  }
}

// ---------- Погашение кодов (страница кассира, без Telegram) ----------

async function sha256Hex(text: string) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))))
}

async function cashierPoint(body: Row) {
  const id = Number(body.point)
  const hash = await sha256Hex(`${id}:${str(body.pin, 12)}`)
  const { data, error } = await db.rpc('cashier_auth', { p_point: id, p_hash: hash })
  if (error || !data) throw new HttpError(500, 'db')
  if (!data.ok) throw new HttpError(data.error === 'pin_locked' ? 429 : data.error === 'point_not_found' ? 404 : 403, data.error)
  return data.point
}

async function redeemPoints() {
  const { data } = await db.from('advent_points').select('id,name').order('id')
  return { points: data ?? [] }
}

async function redeem(body: Row) {
  const p = await cashierPoint(body)
  const code = normCode(body.code)
  if (body.check) {
    const { data: c } = await db.from('reward_codes').select('status,redeemed_at,advent_rewards(title,emoji)').eq('code', code).maybeSingle()
    if (!c) throw new HttpError(404, 'code_not_found')
    // deno-lint-ignore no-explicit-any
    const r: any = c.advent_rewards
    return { status: c.status, redeemed_at: c.redeemed_at, title: r?.title ?? '', emoji: r?.emoji ?? '🎁' }
  }
  const { data, error } = await db.rpc('redeem_code', { p_code: code, p_point: p.id })
  if (error) throw new HttpError(500, 'db')
  if (!data?.ok) throw new HttpError(data?.error === 'already' ? 409 : 404, data?.error === 'already' ? 'code_used' : 'code_not_found')
  return data
}

async function adminAdvent(body: Row) {
  await member(body, true)
  const { data, error } = await db.rpc('advent_summary')
  if (error) throw new HttpError(500, 'db')
  const s = await getSettings()
  const a = s.advent ?? {}
  const [full, doors] = await Promise.all([
    db.from('advent_rewards').select('*').order('doors').order('position'),
    db.from('advent_doors').select('day', { count: 'exact', head: true }),
  ])
  return {
    ...data,
    theme: ADVENT_THEMES.includes(a.theme) ? a.theme : 'standard',
    settings: {
      enabled: !!a.enabled,
      title: str(a.title, 60) || 'Адвент-календарь',
      start: typeof a.start === 'string' ? a.start : '',
      days: int(a.days, 1, 60, 24),
      catchup: catchupCfg(a.catchup),
    },
    doors_defined: doors.count ?? 0,
    reward_list: full.data ?? [],
  }
}

// Настройки календаря: число дней, название, старт, включение, способы догнать и цена билета.
async function adminAdventSave(body: Row) {
  await member(body, true)
  const input = body.settings ?? {}
  const s = await getSettings(true)
  const prev = s.advent ?? { enabled: false }
  const start = str(input.start, 10)
  if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new HttpError(400, 'bad_date')
  const next = {
    ...prev,
    title: str(input.title, 60) || prev.title || 'Адвент-календарь',
    start: start || prev.start,
    days: int(input.days, 1, 60, prev.days ?? 24),
    enabled: input.enabled == null ? !!prev.enabled : !!input.enabled,
    catchup: catchupCfg(input.catchup ?? prev.catchup),
  }
  await setSetting('advent', next)
  return { ok: true }
}

// Приз: вид и содержимое проверяем до записи — пустую ссылку или несуществующий курс сохранить нельзя.
async function cleanReward(input: Row) {
  const kind = REWARD_KINDS.includes(input.kind) ? input.kind : 'promo'
  const title = str(input.title, 80)
  if (!title) throw new HttpError(400, 'title_required')
  const p = input.payload ?? {}
  let payload: Row = {}
  if (kind === 'message') {
    const text = typeof p.text === 'string' ? p.text.trim() : ''
    if (!text) throw new HttpError(400, 'reward_payload')
    if (text.length > 6000) throw new HttpError(400, 'reward_payload')
    payload = { text }
  } else if (kind === 'link' || kind === 'video') {
    const url = httpsUrl(p.url)
    if (!url) throw new HttpError(400, 'reward_payload')
    payload = { url, label: str(p.label, 40) }
  } else if (kind === 'lesson') {
    const { data } = await db.from('lessons').select('id').eq('id', Number(p.lesson_id)).maybeSingle()
    if (!data) throw new HttpError(400, 'reward_payload')
    payload = { lesson_id: data.id }
  } else if (kind === 'certification') {
    const { data } = await db.from('ai_certifications').select('id').eq('id', String(p.certification_id ?? '')).eq('published', true).maybeSingle()
    if (!data) throw new HttpError(400, 'reward_payload')
    payload = { certification_id: data.id }
  } else if (kind === 'course') {
    const { data } = await db.from('courses').select('id').eq('id', Number(p.course_id)).maybeSingle()
    if (!data) throw new HttpError(400, 'reward_payload')
    payload = { course_id: data.id }
  }
  const mode = REWARD_MODES.includes(input.mode) ? input.mode : 'threshold'
  const windowed = mode !== 'threshold'
  const dayFrom = windowed ? int(input.day_from, 1, 60, 1) : null
  const dayTo = windowed ? int(input.day_to, 1, 60, dayFrom ?? 1) : null
  if (windowed && dayTo! < dayFrom!) throw new HttpError(400, 'bad_window')
  // Мгновенный выигрыш и розыгрыш без лимита не имеют смысла: «выпадет всем» — это подарок дня.
  if ((mode === 'instant' || mode === 'draw') && !(Number(input.stock) >= 1)) throw new HttpError(400, 'stock_required')
  return {
    title,
    description: str(input.description, 300),
    emoji: [...str(input.emoji, 16)].slice(0, 8).join('') || '🎁',
    mode,
    day_from: dayFrom,
    day_to: dayTo,
    doors: int(input.doors, 1, 60, 1),
    stock: input.stock == null || input.stock === '' ? null : int(input.stock, 0, 1_000_000, 0),
    position: int(input.position, 0, 999, 0),
    kind,
    payload,
  }
}

async function adminAdventRewardSave(body: Row) {
  await member(body, true)
  const input = body.reward ?? {}
  const clean = await cleanReward(input)
  const id = Number(input.id)
  const query = id ? db.from('advent_rewards').update(clean).eq('id', id) : db.from('advent_rewards').insert(clean)
  const { data, error } = await query.select('*').single()
  if (error) throw new HttpError(500, 'db')
  return data
}

// Розыгрыш вручную — например, раньше конца окна. Повторно не проводится.
async function adminAdventDraw(body: Row) {
  await member(body, true)
  const { data: r } = await db.from('advent_rewards').select('*').eq('id', Number(body.id)).maybeSingle()
  if (!r || r.mode !== 'draw') throw new HttpError(404, 'not_found')
  if (r.drawn_at) throw new HttpError(409, 'already_drawn')
  return { winners: await runDraw(r, await getSettings()) }
}

// ---------- Двери календаря ----------

function cleanDoor(input: Row) {
  const day = int(input.day, 1, 60, 0)
  if (!day) throw new HttpError(400, 'bad_day')
  const title = str(input.title, 80)
  if (!title) throw new HttpError(400, 'title_required')
  const kind = DOOR_KINDS.includes(input.kind) ? input.kind : 'quiz'
  const quiz = (Array.isArray(input.quiz) ? input.quiz : [])
    .slice(0, 10)
    .map((q: Row) => {
      const options = (Array.isArray(q?.options) ? q.options : []).map((o: unknown) => str(o, 160)).filter(Boolean).slice(0, 4)
      return { q: str(q?.q, 300), options, correct: int(q?.correct, 0, Math.max(0, options.length - 1), 0), explain: str(q?.explain, 400) }
    })
    .filter((q: { q: string; options: string[] }) => q.q && q.options.length >= 2)
  if (kind === 'quiz' && quiz.length === 0) throw new HttpError(400, 'quiz_required')
  const prize = str(input.prize, 500)
  if (kind === 'scratch' && !prize) throw new HttpError(400, 'prize_required')
  return {
    day,
    kind,
    title,
    subtitle: str(input.subtitle, 160),
    emoji: [...str(input.emoji, 16)].slice(0, 8).join('') || '🎁',
    body: typeof input.body === 'string' ? input.body.slice(0, 20_000) : '',
    quiz: kind === 'quiz' ? quiz : [],
    prize: kind === 'scratch' ? prize : '',
    arcade: kind === 'arcade' ? { seconds: int(input.arcade?.seconds, 10, 120, 30), cap: int(input.arcade?.cap, 1, 1000, 40) } : {},
    xp: int(input.xp, 0, 500, 30),
    updated_at: new Date().toISOString(),
  }
}

async function adminAdventDoors(body: Row) {
  await member(body, true)
  const { data, error } = await db.from('advent_doors').select('*').order('day')
  if (error) throw new HttpError(500, 'db')
  return { doors: data ?? [] }
}

async function adminAdventDoorSave(body: Row) {
  await member(body, true)
  const clean = cleanDoor(body.door ?? {})
  const { data, error } = await db.from('advent_doors').upsert(clean, { onConflict: 'day' }).select('*').single()
  if (error) throw new HttpError(500, 'db')
  return data
}

// Открытую кем-то дверь не удаляем: у людей пропали бы XP и прогресс.
async function adminAdventDoorDelete(body: Row) {
  await member(body, true)
  const day = Number(body.day)
  const { count } = await db.from('advent_opens').select('day', { count: 'exact', head: true }).eq('day', day)
  if ((count ?? 0) > 0) throw new HttpError(409, 'door_opened')
  const { error } = await db.from('advent_doors').delete().eq('day', day)
  if (error) throw new HttpError(500, 'db')
  return { ok: true }
}

// ---------- Ход календаря для админа ----------

/**
 * Сводка для корректировки: билеты «догнать» (откуда пришли, сколько потрачено, кто открывал окно
 * и какие способы выбирал) и темп призов с окном — сколько выдано против ожидаемого к сегодняшнему дню.
 */
async function adminAdventPulse(body: Row) {
  await member(body, true)
  const s = await getSettings()
  const cfg = adventCfg(s)
  const a = s.advent ?? {}
  const days = int(a.days, 1, 60, 24)
  const today = cfg ? adventToday(cfg) : 0
  const [tickets, events, rewards, codes] = await Promise.all([
    db.from('advent_tickets').select('source,used_at,revoked_at'),
    db.from('events').select('user_id,props').eq('name', 'catchup').limit(5000),
    db.from('advent_rewards').select('id,title,emoji,mode,stock,day_from,day_to,drawn_at').order('id'),
    db.from('reward_codes').select('reward_id,status'),
  ])
  const bySource: Record<string, { earned: number; used: number; revoked: number }> = {}
  for (const t of tickets.data ?? []) {
    const b = (bySource[t.source] ??= { earned: 0, used: 0, revoked: 0 })
    if (t.revoked_at) b.revoked++
    else {
      b.earned++
      if (t.used_at) b.used++
    }
  }
  const opened = new Set<number>()
  const tries: Record<string, number> = {}
  for (const e of events.data ?? []) {
    if (e.props?.step === 'open') opened.add(e.user_id)
    if (e.props?.step === 'try' && typeof e.props?.method === 'string') tries[e.props.method] = (tries[e.props.method] ?? 0) + 1
  }
  const issued = new Map<number, { issued: number; redeemed: number }>()
  for (const c of codes.data ?? []) {
    const x = issued.get(c.reward_id) ?? { issued: 0, redeemed: 0 }
    x.issued++
    if (c.status === 'redeemed') x.redeemed++
    issued.set(c.reward_id, x)
  }
  return {
    today,
    days,
    catchup: { sheet_users: opened.size, tries, sources: bySource },
    // Ожидание: лимит, равномерно разложенный по дням окна. Сильно впереди — призы кончатся рано, сильно позади — останутся.
    pacing: (rewards.data ?? []).map((r) => {
      const from = r.day_from ?? 1
      const to = r.day_to ?? days
      const span = Math.max(1, to - from + 1)
      const elapsed = Math.min(Math.max(today - from + 1, 0), span)
      return {
        id: r.id,
        title: r.title,
        emoji: r.emoji,
        mode: r.mode ?? 'threshold',
        stock: r.stock,
        day_from: r.day_from,
        day_to: r.day_to,
        drawn: !!r.drawn_at,
        issued: issued.get(r.id)?.issued ?? 0,
        redeemed: issued.get(r.id)?.redeemed ?? 0,
        expected: r.mode === 'instant' && r.stock != null ? Math.round((r.stock * elapsed) / span) : null,
      }
    }),
  }
}

/** Кто что получил: приз, человек, код, погашение. Последние 500 — с фильтром по призу. */
async function adminAdventWinners(body: Row) {
  await member(body, true)
  let q = db
    .from('reward_codes')
    .select('code,status,issued_at,redeemed_at,reward_id,users(id,first_name,username),advent_rewards(title,emoji,kind),advent_points(name)')
    .order('issued_at', { ascending: false })
    .limit(500)
  if (Number(body.reward_id) > 0) q = q.eq('reward_id', Number(body.reward_id))
  const { data, error } = await q
  if (error) throw new HttpError(500, 'db')
  return {
    // deno-lint-ignore no-explicit-any
    winners: (data ?? []).map((c: any) => ({
      code: c.code,
      status: c.status,
      issued_at: c.issued_at,
      redeemed_at: c.redeemed_at,
      reward_id: c.reward_id,
      reward: c.advent_rewards?.title ?? 'Приз удалён',
      emoji: c.advent_rewards?.emoji ?? '🎁',
      kind: c.advent_rewards?.kind ?? 'promo',
      user_id: c.users?.id ?? null,
      name: c.users?.first_name || 'Без имени',
      username: c.users?.username ?? null,
      point: c.advent_points?.name ?? null,
    })),
  }
}

/** Ручная корректировка: выдать человеку билеты «догнать» — например, если что-то пошло не так. */
async function adminAdventTicketGrant(body: Row) {
  await member(body, true)
  const username = str(body.username, 64).replace(/^@/, '')
  const count = int(body.count, 1, 10, 1)
  if (!username) throw new HttpError(400, 'user_not_found')
  const { data: user } = await db.from('users').select('id,first_name').ilike('username', username.replace(/[\\%_]/g, '\\$&')).maybeSingle()
  if (!user) throw new HttpError(404, 'user_not_found')
  const stamp = Date.now()
  const rows = Array.from({ length: count }, (_, i) => ({ user_id: user.id, source: 'admin', ref: `admin:${user.id}:${stamp}:${i}` }))
  const { error } = await db.from('advent_tickets').insert(rows)
  if (error) throw new HttpError(500, 'db')
  const s = await getSettings()
  const appUrl = typeof s.app_url === 'string' ? s.app_url : ''
  await tg('sendMessage', {
    chat_id: user.id,
    parse_mode: 'HTML',
    text: [
      `🎟 <b>Тебе начислены билеты календаря!</b>`,
      '',
      `Автор календаря выдал тебе ${count === 1 ? 'билет' : `билеты: <b>${count} шт.</b>`}`,
      `Теперь ты можешь открыть пропущенные двери и забрать награды! 🚪✨`,
    ].join('\n'),
    ...(appUrl ? { reply_markup: { inline_keyboard: [[{ text: '✨ Открыть календарь', web_app: { url: `${appUrl}/?sp=advent` } }]] } } : {}),
  })
  return { name: user.first_name || username, count }
}

// ---------- Точки погашения ----------

async function adminAdventPoints(body: Row) {
  await member(body, true)
  const [points, used] = await Promise.all([db.from('advent_points').select('id,name,locked_until').order('id'), db.from('reward_codes').select('point_id').not('point_id', 'is', null)])
  const counts = new Map<number, number>()
  for (const u of used.data ?? []) counts.set(u.point_id, (counts.get(u.point_id) ?? 0) + 1)
  return {
    points: (points.data ?? []).map((p) => ({ id: p.id, name: p.name, locked: !!p.locked_until && Date.parse(p.locked_until) > Date.now(), redeemed: counts.get(p.id) ?? 0 })),
  }
}

// PIN храним только как sha256(`<id>:<pin>`) — у новой точки id появляется после вставки, поэтому хеш пишем вторым шагом.
async function adminAdventPointSave(body: Row) {
  await member(body, true)
  const name = str(body.name, 60)
  if (!name) throw new HttpError(400, 'title_required')
  const pin = str(body.pin, 12)
  if (pin && !/^\d{4,8}$/.test(pin)) throw new HttpError(400, 'bad_pin_format')
  let id = Number(body.id)
  if (!id) {
    if (!pin) throw new HttpError(400, 'bad_pin_format')
    const { data, error } = await db.from('advent_points').insert({ name, pin_hash: '' }).select('id').single()
    if (error || !data) throw new HttpError(500, 'db')
    id = data.id
  }
  const patch: Row = { name }
  if (pin) Object.assign(patch, { pin_hash: await sha256Hex(`${id}:${pin}`), fails: 0, locked_until: null })
  const { error } = await db.from('advent_points').update(patch).eq('id', id)
  if (error) throw new HttpError(500, 'db')
  return { id }
}

// Точку с погашениями не удаляем: в журнале «где погашен» осталась бы пустота. Можно сменить PIN.
async function adminAdventPointDelete(body: Row) {
  await member(body, true)
  const id = Number(body.id)
  const { count } = await db.from('reward_codes').select('code', { count: 'exact', head: true }).eq('point_id', id)
  if ((count ?? 0) > 0) throw new HttpError(409, 'point_used')
  const { error } = await db.from('advent_points').delete().eq('id', id)
  if (error) throw new HttpError(500, 'db')
  return { ok: true }
}

// Выданный приз не удаляем: у людей остались коды и доступы, а статистика потеряла бы смысл.
async function adminAdventRewardDelete(body: Row) {
  await member(body, true)
  const id = Number(body.id)
  const { count } = await db.from('reward_codes').select('code', { count: 'exact', head: true }).eq('reward_id', id)
  if ((count ?? 0) > 0) throw new HttpError(409, 'reward_issued')
  const { error } = await db.from('advent_rewards').delete().eq('id', id)
  if (error) throw new HttpError(500, 'db')
  return { ok: true }
}

// Оформление календаря меняется у всех сразу; остальные настройки адвента не трогаем.
async function adminAdventTheme(body: Row) {
  await member(body, true)
  if (!ADVENT_THEMES.includes(body.theme)) throw new HttpError(400, 'bad_theme')
  const s = await getSettings(true)
  await setSetting('advent', { ...(s.advent ?? { enabled: false }), theme: body.theme })
  return { ok: true }
}

// ---------- Напоминание о новой двери и вечерний пуш (вызывает cron / pg_net) ----------
// Telegram пропускает около 30 сообщений в секунду; шлём пачками по 25 с паузой в 1 сек.
// Поддерживает курсорную очередь: база любого размера обрабатывается без обрыва и таймаутов.

const PUSH_BATCH = 1000

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

async function adventPush(req: Request) {
  const s = await getSettings(true)
  if (!s.cron_key || !safeEqual(req.headers.get('x-cron-key') ?? '', String(s.cron_key))) return json({ ok: false }, 401)
  const cfg = adventCfg(s)
  if (!cfg || !s.app_url) return json({ ok: true, sent: 0, reason: 'off' })
  const today = adventToday(cfg)
  await runDueDraws(cfg, today, s)
  if (today < 1 || today > cfg.days) return json({ ok: true, sent: 0, reason: 'out_of_range' })

  const url = new URL(req.url)
  let bodyJson: Row = {}
  try {
    bodyJson = await req.json()
  } catch {
    /* запрос без JSON-тела */
  }

  const type = String(bodyJson.type ?? url.searchParams.get('type') ?? 'morning')
  const isEvening = type === 'evening'
  const reset = bodyJson.reset === true || url.searchParams.get('reset') === '1'

  // Состояние рассылки хранится отдельно для утреннего и вечернего пушей.
  const stateKey = isEvening ? 'advent_push_evening' : 'advent_push_morning'
  const state: Row = s[stateKey] ?? {}
  const dayChanged = state.day !== today

  if (dayChanged || reset) {
    state.day = today
    state.cursor = 0
    state.done = false
    state.sent = 0
  } else if (state.done) {
    return json({ ok: true, sent: 0, reason: 'already_completed', day: today, type })
  }

  const cursor = Number(state.cursor) || 0

  const [door, done, usersRes] = await Promise.all([
    db.from('advent_doors').select('title,emoji,kind,xp').eq('day', today).maybeSingle(),
    db.from('advent_opens').select('user_id').eq('day', today),
    db.from('users').select('id').eq('subscribed', true).gt('id', cursor).order('id').limit(PUSH_BATCH),
  ])

  if (!door.data) return json({ ok: true, sent: 0, reason: 'no_door' })
  const users = usersRes.data ?? []
  if (!users.length) {
    state.done = true
    await setSetting(stateKey, state)
    if (!isEvening) await setSetting('advent_push_day', today)
    return json({ ok: true, sent: 0, reason: 'completed', day: today, type })
  }

  const skip = new Set((done.data ?? []).map((o) => o.user_id))
  const ids = users.map((u) => u.id).filter((id) => !skip.has(id))

  const kindHints: Record<string, string> = {
    quiz: '🧠 Внутри квиз: ответь без ошибок и получи билет «догнать»!',
    arcade: '🎮 Внутри аркада: набери комбо очков и забери максимум XP!',
    scratch: '✨ Внутри скретч-карта: сотри слой и забери скрытую награду!',
    story: '📖 Вдохновляющая история и свежий инсайт.',
  }
  const hint = kindHints[door.data.kind] ?? 'Загляни внутрь и забери награду!'
  const xpBadge = door.data.xp ? ` · <b>+${door.data.xp} XP</b>` : ''

  const text = isEvening
    ? [
        `⏳ <b>Дверь №${today} закроется через несколько часов!</b>`,
        '',
        `${door.data.emoji} <b>«${escapeHtml(door.data.title)}»</b>${xpBadge}`,
        `Не упусти шанс забрать XP и защитить свой стрик без траты заморозки или билета! 🔥`,
      ].join('\n')
    : [
        `🎄 <b>Адвент-календарь: Дверь №${today} открыта!</b>`,
        '',
        `${door.data.emoji} <b>«${escapeHtml(door.data.title)}»</b>${xpBadge}`,
        hint,
        '',
        `⚡ <i>Открой дверь сегодня, чтобы забрать максимум XP и не прерывать новогодний стрик!</i>`,
      ].join('\n')

  const markup = {
    inline_keyboard: [
      [{ text: isEvening ? `🚪 Успеть открыть дверь №${today}` : `✨ Открыть дверь №${today}`, web_app: { url: `${s.app_url}/?sp=advent` } }],
    ],
  }

  const nextCursor = users[users.length - 1].id
  const isLastBatch = users.length < PUSH_BATCH

  const send = async () => {
    let sent = 0
    for (let i = 0; i < ids.length; i += 25) {
      const res = await Promise.all(
        ids.slice(i, i + 25).map((id) => tg('sendMessage', { chat_id: id, text, parse_mode: 'HTML', reply_markup: markup }))
      )
      sent += res.filter((r) => r.ok).length
      if (i + 25 < ids.length) await new Promise((r) => setTimeout(r, 1000))
    }
    state.cursor = nextCursor
    state.done = isLastBatch
    state.sent = (state.sent || 0) + sent
    state.updated_at = new Date().toISOString()
    await setSetting(stateKey, state)
    if (!isEvening && isLastBatch) await setSetting('advent_push_day', today)
    console.log('advent_push', type, today, sent, '/', ids.length, 'cursor:', nextCursor, 'done:', isLastBatch)
  }

  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(send())
  else await send()

  return json({
    ok: true,
    type,
    day: today,
    queued: ids.length,
    batch_size: users.length,
    cursor: nextCursor,
    done: isLastBatch,
  })
}

// ---------- Роутер ----------

async function academy(body: Row) {
  const actor = await member(body)
  if (typeof body.action !== 'string') throw new HttpError(400, 'academy_unknown_action')
  try {
    if (['file_upload','file_finalize','file_download','portfolio_list','portfolio_publish','portfolio_revoke'].includes(body.action)) return await handleAcademyFiles(db,{id:actor.id,is_admin:!!actor.is_admin},body.action,body.payload??{})
    return await handleAcademy(db, { id: actor.id, is_admin: !!actor.is_admin }, body.action, body.payload ?? {})
  } catch (error) {
    if (error instanceof AcademyError) throw new HttpError(error.status, error.code)
    throw error
  }
}

const academyPublicLimits=new Map<string,{count:number;expires:number}>()
async function academyPublic(req:Request){
  const ip=(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown').slice(0,128),now=Date.now()
  if(academyPublicLimits.size>4096)for(const [key,value] of academyPublicLimits)if(value.expires<now)academyPublicLimits.delete(key)
  const bucket=academyPublicLimits.get(ip)
  if(bucket&&bucket.expires>now){if(bucket.count++>=30)throw new HttpError(429,'academy_rate_limited')}
  else {
    if(academyPublicLimits.size>=4096){for(const [key,value] of academyPublicLimits)if(value.expires<=now)academyPublicLimits.delete(key)}
    if(academyPublicLimits.size>=4096)academyPublicLimits.delete(academyPublicLimits.keys().next().value!)
    academyPublicLimits.set(ip,{count:1,expires:now+60000})
  }
  const raw=await req.text();if(raw.length>2000)throw new HttpError(400,'academy_invalid_payload')
  let body:Row
  try{body=JSON.parse(raw||'{}')}catch{throw new HttpError(400,'academy_invalid_payload')}
  if(!body||Array.isArray(body)||typeof body!=='object'||!body.payload||Array.isArray(body.payload)||typeof body.payload!=='object')throw new HttpError(400,'academy_invalid_payload')
  if(!['certificate_public','portfolio_public'].includes(body.action))throw new HttpError(404,'not_found')
  const value=body.action==='certificate_public'?body.payload?.code:body.payload?.slug
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{12,120}$/.test(value))throw new HttpError(400,'academy_invalid_payload')
  try{return json(await handleAcademyFiles(db,null,body.action,body.payload??{}))}
  catch(error){if(error instanceof AcademyError)throw new HttpError(error.status,error.code);throw error}
}

async function certifications(body: Row) {
  const row=await member(body)
  try { return await handleCertifications(db,row.id,aliveStreak(row),String(body.action??'catalog'),body) }
  catch(error){if(error instanceof CertificationError)throw new HttpError(error.status,error.message);throw error}
}

const routes: Record<string, (body: Row) => Promise<unknown>> = {
  certifications,
  academy,
  boot,
  blog_feed: blogFeed,
  lesson,
  quiz_start: quizStart,
  quiz_answer: quizAnswer,
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
  admin_payments: adminPayments,
  admin_refund: adminRefund,
  admin_list: adminList,
  admin_analytics: adminAnalytics,
  admin_save: adminSave,
  admin_delete: adminDelete,
  admin_announce: adminAnnounce,
  advent,
  advent_door: adventDoor,
  advent_open: adventOpen,
  admin_advent: adminAdvent,
  admin_advent_theme: adminAdventTheme,
  admin_advent_save: adminAdventSave,
  admin_advent_reward_save: adminAdventRewardSave,
  admin_advent_reward_delete: adminAdventRewardDelete,
  admin_advent_draw: adminAdventDraw,
  admin_advent_pulse: adminAdventPulse,
  admin_advent_winners: adminAdventWinners,
  admin_advent_ticket_grant: adminAdventTicketGrant,
  admin_advent_points: adminAdventPoints,
  admin_advent_point_save: adminAdventPointSave,
  admin_advent_point_delete: adminAdventPointDelete,
  admin_advent_doors: adminAdventDoors,
  admin_advent_door_save: adminAdventDoorSave,
  admin_advent_door_delete: adminAdventDoorDelete,
  advent_ticket_invoice: adventTicketInvoice,
  // Без Telegram: страница кассира проверяет PIN точки, а не подпись пользователя.
  redeem,
  redeem_points: redeemPoints,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? ''
  try {
    if (route === 'webhook' && req.method === 'POST') return await webhook(req)
    if (route === 'setup') return await setup(req)
    if (route === 'health' || route === 'api') return await health()
    if (route === 'payment_refunds' && req.method === 'POST') {
      const s = await getSettings()
      if (!s.cron_key || !safeEqual(req.headers.get('x-cron-key') ?? '', String(s.cron_key))) return json({ ok: false }, 401)
      return json(await processRefundJobs(db, tg))
    }
    if (route === 'advent_push' && req.method === 'POST') return await adventPush(req)
    if (route === 'academy_public' && req.method === 'POST') return await academyPublic(req)
    // Только собственные ключи: иначе адрес вроде /constructor попадал во встроенные методы объекта.
    const handler = Object.hasOwn(routes, route) ? routes[route] : null
    if (!handler || req.method !== 'POST') return json({ error: 'not_found' }, 404)
    const body = JSON.parse((await req.text()) || '{}')
    return json(await handler(body))
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status)
    console.error(route, e)
    return json({ error: 'server' }, 500)
  }
})
