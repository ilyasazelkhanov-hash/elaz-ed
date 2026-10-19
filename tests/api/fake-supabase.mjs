// Подмена Supabase для проверки серверной функции: таблицы в памяти и те же вызовы, что использует api/index.ts.
// Это не эмулятор PostgREST — только то подмножество, которое нужно функции.

const KEYS = {
  settings: ['key'],
  users: ['id'],
  course_access: ['user_id', 'course_id'],
  access_requests: ['user_id', 'course_id'],
  progress: ['user_id', 'lesson_id'],
  likes: ['user_id', 'lesson_id'],
  lesson_access: ['user_id', 'lesson_id'],
  advent_opens: ['user_id', 'day'],
  advent_tickets: ['ref'],
  advent_doors: ['day'],
  reward_codes: ['code'],
  lesson_quiz_attempts: ['id'],
}
const UNIQUE = { payments: ['charge_id'], advent_tickets: ['ref'] }
const AUTO_ID = ['payments', 'events', 'courses', 'lessons', 'advent_tickets', 'advent_rewards', 'advent_points']

export const state = {
  tables: {},
  /** Один раз вернуть ошибку базы для указанной операции: { table, op }. */
  failNext: null,
  uploads: [],
  academyCalls: [],
  academyReply: null,
}

export function reset(tables) {
  state.tables = structuredClone(tables)
  state.failNext = null
  state.uploads = []
  state.academyCalls = []
  state.academyReply = null
}

const table = (name) => (state.tables[name === 'feed_cards' ? 'lessons' : name] ??= [])

function likeToRegex(pattern) {
  let out = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\' && i + 1 < pattern.length) out += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    else if (c === '%') out += '.*'
    else if (c === '_') out += '.'
    else out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`, 'i')
}

class Query {
  constructor(name) {
    this.name = name
    this.filters = []
    this.op = 'select'
    this.cols = '*'
    this.opts = {}
    this.mode = null
  }
  select(cols = '*', opts = {}) {
    this.cols = cols
    if (this.op === 'select') this.opts = opts
    return this
  }
  insert(rows) {
    this.op = 'insert'
    this.payload = rows
    return this
  }
  update(patch) {
    this.op = 'update'
    this.payload = patch
    return this
  }
  upsert(rows, opts = {}) {
    this.op = 'upsert'
    this.payload = rows
    this.upsertOpts = opts
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }
  eq(k, v) {
    this.filters.push((r) => r[k] === v)
    return this
  }
  gt(k, v) {
    this.filters.push((r) => r[k] > v)
    return this
  }
  not(k, op, v) {
    if (op === 'is') this.filters.push((r) => (v === null ? r[k] != null : r[k] !== v))
    return this
  }
  lte(k, v) {
    this.filters.push((r) => r[k] <= v)
    return this
  }
  gte(k, v) {
    this.filters.push((r) => r[k] >= v)
    return this
  }
  is(k, v) {
    this.filters.push((r) => (v === null ? r[k] == null : r[k] === v))
    return this
  }
  ilike(k, pattern) {
    const re = likeToRegex(pattern)
    this.filters.push((r) => typeof r[k] === 'string' && re.test(r[k]))
    return this
  }
  order() {
    return this
  }
  limit(n) {
    this.max = n
    return this
  }
  maybeSingle() {
    this.mode = 'maybe'
    return this
  }
  single() {
    this.mode = 'single'
    return this
  }
  then(resolve, reject) {
    return Promise.resolve()
      .then(() => this.run())
      .then(resolve, reject)
  }

  match(row) {
    return this.filters.every((f) => f(row))
  }

  shape(rows) {
    const out = rows.map((r) => {
      const copy = { ...r }
      if (typeof this.cols === 'string' && this.cols.includes('users(')) copy.users = table('users').find((u) => u.id === r.user_id) ?? null
      if (typeof this.cols === 'string' && this.cols.includes('courses(')) copy.courses = table('courses').find((c) => c.id === r.course_id) ?? null
      if (typeof this.cols === 'string' && this.cols.includes('advent_rewards(')) copy.advent_rewards = table('advent_rewards').find((x) => x.id === r.reward_id) ?? null
      if (typeof this.cols === 'string' && this.cols.includes('advent_points(')) copy.advent_points = table('advent_points').find((x) => x.id === r.point_id) ?? null
      return copy
    })
    if (this.mode === 'maybe') return out.length > 1 ? { data: null, error: { code: 'PGRST116' } } : { data: out[0] ?? null, error: null }
    if (this.mode === 'single') return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { code: 'PGRST116' } }
    return { data: this.max ? out.slice(0, this.max) : out, error: null, count: out.length }
  }

  run() {
    const t = table(this.name)
    const fail = state.failNext
    if (fail && fail.table === this.name && fail.op === this.op) {
      state.failNext = null
      return { data: null, error: { code: 'XX000', message: 'injected' } }
    }
    switch (this.op) {
      case 'select': {
        const rows = t.filter((r) => this.match(r))
        if (this.opts.head) return { data: null, error: null, count: rows.length }
        return this.shape(rows)
      }
      case 'insert': {
        const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r) => ({ ...r }))
        for (const row of rows) {
          for (const k of UNIQUE[this.name] ?? []) if (t.some((x) => x[k] === row[k])) return { data: null, error: { code: '23505' } }
          const pk = KEYS[this.name]
          if (pk && t.some((x) => pk.every((k) => x[k] === row[k]))) return { data: null, error: { code: '23505' } }
          if (AUTO_ID.includes(this.name) && row.id == null) row.id = t.reduce((n, x) => Math.max(n, x.id ?? 0), 0) + 1
          if (this.name === 'payments') row.refunded_at ??= null
          t.push(row)
        }
        return this.shape(rows)
      }
      case 'upsert': {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload]
        const pk = KEYS[this.name]
        const touched = []
        for (const row of rows) {
          const found = t.find((x) => pk.every((k) => x[k] === row[k]))
          if (found) {
            if (!this.upsertOpts.ignoreDuplicates) Object.assign(found, row)
            touched.push(found)
          } else {
            const fresh = { ...row }
            t.push(fresh)
            touched.push(fresh)
          }
        }
        return this.shape(touched)
      }
      case 'update': {
        const rows = t.filter((r) => this.match(r))
        for (const r of rows) Object.assign(r, this.payload)
        return this.shape(rows)
      }
      case 'delete': {
        const keep = t.filter((r) => !this.match(r))
        const removed = t.length - keep.length
        state.tables[this.name === 'feed_cards' ? 'lessons' : this.name] = keep
        return { data: null, error: null, count: removed }
      }
    }
  }
}

let codeSeq = 0
function grant(user, rewardId) {
  const r = table('advent_rewards').find((x) => x.id === rewardId)
  if (!r) return null
  const codes = table('reward_codes')
  if (codes.some((c) => c.user_id === user && c.reward_id === rewardId)) return null
  if (r.stock != null && codes.filter((c) => c.reward_id === rewardId).length >= r.stock) return null
  codeSeq++
  const code = `T${String(codeSeq).padStart(3, '0')}-ABCD`.slice(0, 4) + '-' + String(codeSeq).padStart(4, 'A')
  codes.push({ code, user_id: user, reward_id: rewardId, status: 'issued' })
  if (r.kind === 'lesson' && r.payload?.lesson_id) table('lesson_access').push({ user_id: user, lesson_id: Number(r.payload.lesson_id), source: 'advent' })
  if (r.kind === 'course' && r.payload?.course_id && !table('course_access').some((a) => a.user_id === user && a.course_id === Number(r.payload.course_id))) {
    table('course_access').push({ user_id: user, course_id: Number(r.payload.course_id), source: 'advent' })
  }
  return code
}

export function createClient() {
  return {
    from: (name) => new Query(name),
    // Функции базы здесь не проверяются: их логика живёт в миграциях.
    rpc: async (name, args) => {
      if (name === 'academy_action') {
        state.academyCalls.push(structuredClone(args))
        return state.academyReply ?? { data: { courses: [], directions: [], total: 0 }, error: null }
      }
      // Persisted quiz model mirrors the SQL lock/sequence/immutable receipt contract.
      if (['start_lesson_quiz', 'answer_lesson_quiz', 'complete_lesson'].includes(name)) {
        const attempts = table('lesson_quiz_attempts')
        const user = table('users').find(u => u.id === args.p_user)
        const err = message => ({ data: null, error: { code: 'P0001', message } })
        const failOp = name === 'start_lesson_quiz' ? 'start' : name === 'answer_lesson_quiz' ? 'answer' : 'complete'
        if (state.failNext?.table === 'lesson_quiz_attempts' && state.failNext.op === failOp) {
          state.failNext = null
          return err('injected database error')
        }
        if (name === 'start_lesson_quiz') {
          const lesson = table('lessons').find(l => l.id === args.p_lesson)
          if (!user || !lesson?.quiz?.length || lesson.quiz.length > 10) return err('quiz_not_found')
          const practice = table('progress').some(p => p.user_id === args.p_user && p.lesson_id === args.p_lesson)
          let attempt = attempts.find(a => a.user_id === args.p_user && a.lesson_id === args.p_lesson && a.practice === practice && (!practice || !a.completed_at))
          if (!attempt) {
            attempt = { id: crypto.randomUUID(), user_id: args.p_user, lesson_id: args.p_lesson, practice, quiz: structuredClone(lesson.quiz), answers: [], feedback: [], score: 0, bonus: 0, combo: 0, completed_at: null }
            attempts.push(attempt)
          }
          return { data: structuredClone(attempt), error: null }
        }
        if (name === 'answer_lesson_quiz') {
          const attempt = attempts.find(a => a.id === args.p_attempt && a.user_id === args.p_user)
          if (!attempt) return err('quiz_not_found')
          const index = args.p_index, answer = args.p_answer
          const question = attempt.quiz[index]
          if (!Number.isInteger(index) || !Number.isInteger(answer) || !question || answer < 0 || answer >= question.options.length) return err('quiz_answer_invalid')
          if (index < attempt.answers.length) return attempt.answers[index] === answer ? { data: structuredClone(attempt.feedback[index]), error: null } : err('quiz_answer_locked')
          if (index !== attempt.answers.length) return err('quiz_sequence')
          const correct = answer === question.correct
          attempt.combo = correct ? attempt.combo + 1 : 0
          const gained = correct ? 10 + 5 * Math.min(attempt.combo - 1, 2) : 0
          attempt.score += correct ? 1 : 0
          attempt.bonus += gained
          attempt.answers.push(answer)
          if (attempt.answers.length === attempt.quiz.length) attempt.completed_at = new Date().toISOString()
          const receipt = { attemptId: attempt.id, index, answer, correct, correctIndex: question.correct, explain: question.explain ?? '', done: !!attempt.completed_at, score: attempt.score, bonus: attempt.bonus, combo: attempt.combo, gained }
          attempt.feedback.push(receipt)
          return { data: structuredClone(receipt), error: null }
        }
        const lesson = table('lessons').find(l => l.id === args.p_lesson)
        if (!lesson || !user) return err('quiz_not_found')
        const attempt = attempts.find(a => a.user_id === args.p_user && a.lesson_id === args.p_lesson && !a.practice)
        if (attempt && !attempt.completed_at || !attempt && lesson.quiz?.length) return err('quiz_required')
        const score = attempt?.score ?? 0, total = attempt?.quiz.length ?? 0, xp = lesson.xp + (attempt?.bonus ?? 0)
        if (args.p_score !== score || args.p_total !== total || args.p_xp !== xp) return err('quiz_answers_mismatch')
        if (table('progress').some(p => p.user_id === args.p_user && p.lesson_id === args.p_lesson)) return { data: false, error: null }
        table('progress').push({ user_id: args.p_user, lesson_id: args.p_lesson, score, total, xp_earned: xp, completed_at: new Date().toISOString() })
        user.xp = (user.xp ?? 0) + xp
        user.lessons_done = (user.lessons_done ?? 0) + (lesson.kind === 'lesson' ? 1 : 0)
        return { data: true, error: null }
      }
      if (name === 'grant_achievements') {
        const user = table('users').find(u => u.id === args.p_user)
        if (user) user.achievements = [...new Set([...(user.achievements ?? []), ...args.p_codes])]
        return { data: null, error: null }
      }
      // Выдача приза: лимит, повтор, код, доступ к уроку или курсу — как в SQL-функции advent_grant.
      if (name === 'advent_grant') return { data: grant(args.p_user, args.p_reward), error: null }
      // Розыгрыш: взвешенно по числу открытых дверей окна, без повторов — как advent_draw.
      if (name === 'advent_draw') {
        const r = table('advent_rewards').find((x) => x.id === args.p_reward)
        if (!r || r.mode !== 'draw' || r.drawn_at) return { data: [], error: null }
        const counts = new Map()
        for (const o of table('advent_opens')) {
          if (o.day < (r.day_from ?? 1) || o.day > (r.day_to ?? 60)) continue
          if (table('reward_codes').some((c) => c.reward_id === r.id && c.user_id === o.user_id)) continue
          counts.set(o.user_id, (counts.get(o.user_id) ?? 0) + 1)
        }
        const slots = (r.stock ?? 1) - table('reward_codes').filter((c) => c.reward_id === r.id).length
        const order = [...counts].map(([uid, n]) => [uid, Math.random() ** (1 / n)]).sort((a, b) => b[1] - a[1]).slice(0, Math.max(slots, 0))
        const winners = []
        for (const [uid] of order) {
          const code = grant(uid, r.id)
          if (code) winners.push({ winner_id: uid, winner_code: code })
        }
        r.drawn_at = new Date().toISOString()
        return { data: winners, error: null }
      }
      // Двери календаря: та же логика, что в SQL-функциях advent_open и advent_open_late.
      if (name === 'advent_open' || name === 'advent_open_late') {
        const opens = table('advent_opens')
        const count = () => table('advent_opens').filter((o) => o.user_id === args.p_user).length
        if (opens.some((o) => o.user_id === args.p_user && o.day === args.p_day)) return { data: [{ inserted: false, opened: count(), ticket: true }], error: null }
        if (name === 'advent_open_late') {
          const t = table('advent_tickets').find((x) => x.user_id === args.p_user && !x.used_at && !x.revoked_at)
          if (!t) return { data: [{ inserted: false, opened: count(), ticket: false }], error: null }
          t.used_at = new Date().toISOString()
          t.used_day = args.p_day
        }
        opens.push({ user_id: args.p_user, day: args.p_day, score: args.p_score, total: args.p_total, xp: args.p_xp, late: name === 'advent_open_late' })
        const u = table('users').find((x) => x.id === args.p_user)
        if (u) u.xp = (u.xp ?? 0) + args.p_xp
        return { data: [{ inserted: true, opened: count(), ticket: true }], error: null }
      }
      if (!['apply_star_payment', 'apply_star_refund'].includes(name)) return { data: null, error: null }
      // Модель атомарного контракта RPC: ошибки не оставляют частичных изменений таблиц.
      const before = structuredClone(state.tables)
      const run = async (query) => {
        const result = await query
        if (result.error) throw result.error
        return result.data
      }
      try {
        if (name === 'apply_star_payment') {
          const { p_user: user, p_course: course, p_stars: stars, p_charge: charge } = args
          const prior = table('payments').find((p) => p.charge_id === charge)
          if (prior && (prior.user_id !== user || prior.course_id !== course || prior.stars !== stars)) throw { code: 'P0001' }
          if (prior?.refunded_at) return { data: { duplicate: true, refunded: true }, error: null }
          if (!prior) await run(new Query('payments').insert({ user_id: user, course_id: course, stars, charge_id: charge }))
          await run(new Query('course_access').upsert({ user_id: user, course_id: course, source: 'stars' }, { ignoreDuplicates: true }))
          return { data: { duplicate: !!prior, refunded: false }, error: null }
        }
        const p = table('payments').find((p) => p.charge_id === args.p_charge)
        if (!p) throw { code: 'P0002' }
        const fresh = !p.refunded_at
        await run(new Query('payments').update({ refunded_at: p.refunded_at ?? new Date().toISOString() }).eq('charge_id', args.p_charge))
        if (!table('payments').some((x) => x.user_id === p.user_id && x.course_id === p.course_id && !x.refunded_at)) {
          await run(new Query('course_access').delete().eq('user_id', p.user_id).eq('course_id', p.course_id).eq('source', 'stars'))
        }
        return { data: { ...p, new_refund: fresh }, error: null }
      } catch (error) {
        state.tables = before
        return { data: null, error }
      }
    },
    storage: {
      from: (bucket) => ({
        upload: async (path, bytes) => {
          state.uploads.push({ bucket, path, size: bytes.length })
          return { error: null }
        },
      }),
    },
  }
}
