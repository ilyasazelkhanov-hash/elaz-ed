/** Explicitly loaded local showcase adapter. This file is never a production backend. */
import { buildCatalog } from '../../content/catalog.ts'
import { presets, resolveModules } from './config.ts'
import type {
  ActionReply,
  AppConfig,
  Data,
  Entity,
  Member,
  PresetId,
  QuizAttempt,
  Role,
  Snapshot,
} from './contracts.ts'
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
interface State extends Snapshot {
  giftSecrets?: Record<string, {token:string; requestId:string; cost:number}>

  attempts: (QuizAttempt & { correct: number[]; explanations: string[]; practice?: boolean })[]
  catalogVersion?: number
  payments?: Data[]
  jobs?: Data[]
  sessions: { id: string; entityId: string; game: string; used: boolean; outcome: string }[]
  unlocked: string[]
  certificates: Record<string, string>
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const id = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const day = (timezone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
export class DemoApi {
  key: string
  config: AppConfig
  storage: StoragePort
  constructor(preset: PresetId, storage: StoragePort, config?: AppConfig) {
    this.config = config ?? clone(presets[preset])
    this.storage = storage
    this.key = `az-master:v1:${this.config.id}:${preset}`
  }
  private initial(): State {
    const me: Member = {
      id: 'demo-me',
      name: 'Александр',
      username: 'your_next_chapter',
      role: 'owner',
      teamId: 'team-creators',
      approved: true,
      xp: 460,
      points: 720,
      streak: 4,
      freezes: 1,
      lastDaily: null,
      stamps: 3,
      notificationOptIn: true,
      quietFrom: 22,
      quietTo: 9,
      timezone: this.config.timezone,
      achievements: ['first_step'],
    }
    const people: Member[] = [
      me,
      {
        ...me,
        id: 'demo-alina',
        name: 'Алина',
        username: 'alina',
        role: 'member',
        xp: 860,
        points: 340,
        teamId: 'team-explorers',
      },
      { ...me, id: 'demo-max', name: 'Максим', username: 'max', role: 'mentor', xp: 620, points: 260 },
      {
        ...me,
        id: 'demo-dana',
        name: 'Дана',
        username: 'dana',
        role: 'member',
        xp: 540,
        points: 180,
        teamId: 'team-explorers',
      },
    ]
    return {
      me,
      config: this.config,
      entities: buildCatalog(this.config.preset, this.config.name),
      members: people,
      progress: [],
      ledger: [
        {
          id: id(),
          userId: me.id,
          delta: 720,
          reason: 'Стартовый баланс демонстрации',
          ref: 'demo-welcome',
          createdAt: now(),
        },
      ],
      coupons: [],
      bookings: [],
      orders: [],
      posts: [
        {
          id: 'post-welcome',
          userId: 'demo-alina',
          name: 'Алина',
          body: 'Люблю места, где можно просто быть собой. Расскажите: какое небольшое открытие сделало вашу неделю лучше? ✨',
          topic: 'Знакомство',
          status: 'published',
          likes: ['demo-max', 'demo-dana'],
          createdAt: now(),
        },
        {
          id: 'post-ideas',
          userId: 'demo-max',
          name: 'Максим',
          body: 'Идея недели: обменяться навыками. Я могу помочь с первой презентацией проекта. А что умеете вы?',
          topic: 'Идеи',
          status: 'published',
          likes: ['demo-alina'],
          createdAt: now(),
        },
      ],
      comments: [],
      homework: [],
      notifications: [
        {
          id: 'notice-welcome',
          userId: me.id,
          title: 'Ваша новая глава начинается здесь',
          body: 'Знакомьтесь, пробуйте и собирайте впечатления. Начните с задания дня.',
          read: false,
          createdAt: now(),
        },
      ],
      audit: [],
      favorites: [],
      reactions: [],
      votes: {},
      gifts: [], passport: [], membership: [], journey: null,
      projects: [{id:'demo-project',userId:me.id,managerId:me.id,title:'Ваш проект · демо',status:'active',updatedAt:now(),milestones:[{id:'brief',title:'Бриф и задача',status:'review',body:'Демонстрационный этап. Проверьте задачу и подтвердите согласование.',media:[],documents:[]},{id:'delivery',title:'Подготовка результата',status:'pending',body:'Следующий этап после согласования.',media:[],documents:[]}]}],
      recognitions: [{ id: 'thanks-1', from: 'Алина', to: 'Максим', body: 'Спасибо за помощь с первой идеей!' }],
      catalogVersion: 5,
      attempts: [],
      sessions: [],
      unlocked: ['course-first'],
      certificates: {},
    }
  }
  private load(): State {
    try {
      const stored = this.storage.getItem(this.key)
      if (stored) {
        const state = JSON.parse(stored) as State
        state.config = this.config
        if ((state.catalogVersion ?? 1) < 5) {
          const known = new Set(state.entities.map((e) => e.id))
          state.entities.push(...buildCatalog(this.config.preset, this.config.name).filter((e) => !known.has(e.id)))
          state.catalogVersion = 5
        }
        return state
      }
    } catch {
      /* broken showcase state resets, no live records involved */
    }
    return this.initial()
  }
  private save(s: State) {
    this.storage.setItem(this.key, JSON.stringify(s))
  }
  private snapshot(s: State): Snapshot {
    const {
      giftSecrets: _giftSecrets,
      attempts: _a,
      sessions: _s,
      unlocked: _u,
      certificates: _c,
      payments: _payments,
      jobs: _jobs,
      ...view
    } = clone(s)
    view.gifts=(view.gifts??[]).filter(g=>g.senderId===s.me.id||g.recipientId===s.me.id)
    view.projects=(view.projects??[]).filter(v=>v.userId===s.me.id||v.managerId===s.me.id||['owner','admin'].includes(s.me.role))
    view.membership=(view.membership??[]).map(v=>({...v,status:Date.parse(v.expiresAt)>Date.now()?'active':'expired'}))
    const enabled = resolveModules(this.config.modules)
    if (['owner', 'admin', 'analyst'].includes(s.me.role)) {
      view.analytics = {
        members: s.members.length,
        approvedMembers: s.members.filter((m) => m.approved).length,
        active1d: 1,
        active7d: 1,
        completions: s.progress.length,
        orders: s.orders.length,
        bookings: s.bookings.filter((b) => b.status !== 'cancelled').length,
        paidStars: (s.payments ?? []).filter((p) => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0),
        retention: { day1: { eligible: 0, returned: 0, rate: null }, day7: { eligible: 0, returned: 0, rate: null } },
        funnel: [
          { stage: 'verified', count: s.members.length },
          { stage: 'completed', count: new Set(s.progress.map((p) => p.userId)).size },
          { stage: 'reward_claimed', count: new Set(s.coupons.map((c) => c.userId)).size },
          { stage: 'ordered', count: new Set(s.orders.map((o) => o.userId)).size },
        ],
        campaigns: s.entities
          .filter((e) => e.kind === 'campaign')
          .map((e) => ({
            id: e.id,
            title: e.title,
            participants: new Set(s.progress.filter((p) => p.campaignId === e.id).map((p) => p.userId)).size,
            completions: s.progress.filter((p) => p.campaignId === e.id).length,
            pointsIssued: 0,
            couponsIssued: s.coupons.filter((c) => c.campaignId === e.id).length,
            couponsRedeemed: s.coupons.filter((c) => c.campaignId === e.id && c.status === 'redeemed').length,
          })),
      }
    }
    view.entities = view.entities
      .filter((e) => enabled.includes(e.module))
      .map((e) => {
        const { questions: _questions, ...data } = e.data
        const subscription=s.entities.find(v=>v.id===e.data.courseId)?.data.subscription===true
        const locked = e.kind === 'lesson' && (!s.unlocked.includes(String(e.data.courseId))||subscription&&!s.membership?.some(v=>v.entityId===e.data.courseId&&Date.parse(v.expiresAt)>Date.now()))
        return {
          ...e,
          body: locked ? '' : e.body,
          data: {
            ...data,
            hasQuiz: Array.isArray(_questions) && _questions.length > 0,
            ...(locked ? { locked: true } : {}),
          },
        }
      })
    if (!['owner', 'admin', 'analyst'].includes(s.me.role)) {
      view.audit = []
      view.members = view.members.map((m) => ({ ...m, points: 0, username: '', quietFrom: 0, quietTo: 0 }))
    }
    return view
  }
  async bootstrap() {
    const s = this.load()
    this.save(s)
    return this.snapshot(s)
  }
  async dispatch(action: string, p: Data = {}): Promise<ActionReply> {
    let s = this.load()
    const me = s.me
    let result: Data = {}
    const extensionModule = action.startsWith('gift.') ? 'loyalty' : action==='passport.claim'||action==='journey.choose' ? 'progress' : action.includes('project.')||action==='profile.preferences' ? 'commerce' : null
    if(extensionModule&&!this.config.modules.includes(extensionModule))throw new Error('module_disabled')
    const entity = () => {
      const e = s.entities.find((e) => e.id === p.entityId)
      if (!e) throw new Error('Материал не найден')
      if (!resolveModules(this.config.modules).includes(e.module)) throw new Error('Модуль выключен')
      return e
    }
    const allow = (roles: Role[]) => {
      if (!['owner', 'admin', ...roles].includes(me.role)) throw new Error('Нет доступа к этому действию')
    }
    const credit = (delta: number, reason: string, ref: string) => {
      if (s.ledger.some((l) => l.ref === ref && l.userId === me.id)) return
      if (me.points + delta < 0) throw new Error('Не хватает баллов')
      me.points += delta
      s.ledger.unshift({ id: id(), userId: me.id, delta, reason, ref, createdAt: now() })
    }
    const complete = (e: Entity, score = 0) => {
      if (s.progress.some((v) => v.entityId === e.id && v.userId === me.id)) return 0
      const xp = Number(e.data.xp ?? 25)
      me.xp += xp
      s.progress.push({
        entityId: e.id,
        userId: me.id,
        campaignId: String(e.data.campaignId ?? '') || null,
        score,
        completedAt: now(),
      })
      credit(20, 'Задание выполнено', `complete:${e.id}`)
      if (!me.achievements.includes('first_step')) me.achievements.push('first_step')
      return xp
    }
    if (action.startsWith('admin.'))
      allow(
        action === 'admin.analytics'
          ? ['analyst']
          : action === 'admin.notification.enqueue' || action.startsWith('admin.queue.')
            ? ['campaign_manager']
            : action === 'admin.post.moderate'
              ? ['moderator']
              : action === 'admin.order.update' || action === 'admin.visit'
                ? ['cashier']
                : action.startsWith('admin.project.')
                  ? ['editor']
                : action.startsWith('admin.entity.')
                  ? ['editor', 'campaign_manager']
                  : [],
      )
    switch (action) {
      case 'profile.preferences': {
        const sizes=p.sizes as Record<string,string>
        if(!sizes||typeof sizes!=='object'||Array.isArray(sizes)||Object.entries(sizes).some(([k,v])=>!['top','bottom','shoe'].includes(k)||typeof v!=='string'||v.length>30)||p.style!==undefined&&(typeof p.style!=='string'||p.style.length>100))throw new Error('invalid_preferences')
        s.preferences={sizes,style:String(p.style??'')};break
      }
      case 'journey.choose': {
        if(!['goal:tools','goal:content','goal:apps','goal:services'].includes(String(p.entityId)))entity()
        s.journey={entityId:String(p.entityId),chosenAt:now()};break
      }
      case 'gift.send': {
        if(!this.config.modules.includes('loyalty'))throw new Error('module_disabled')
        if(!/^[a-f0-9-]{36}$/i.test(String(p.requestId)))throw new Error('invalid_request_id')
        s.gifts??=[];s.giftSecrets??={}
        let g=s.gifts.find(v=>v.senderId===me.id&&s.giftSecrets?.[v.id]?.requestId===p.requestId)
        if(g&&g.rewardId!==p.entityId)throw new Error('request_conflict')
        if(!g){const e=entity(),cost=Number(e.data.pointsCost)
          if(e.kind!=='reward'||!e.published||e.data.digital===true||!Number.isInteger(cost)||cost<=0)throw new Error('invalid_reward')
          if(me.points<cost)throw new Error('insufficient_points')
          if(e.capacity!==null&&e.capacity<=0)throw new Error('out_of_stock')
          g={id:id(),senderId:me.id,recipientId:null,rewardId:e.id,title:e.title,status:'sent',createdAt:now(),expiresAt:new Date(Date.now()+7*86400000).toISOString()}
          credit(-cost,'Подарок','gift:'+g.id);if(e.capacity!==null)e.capacity--
          s.gifts.push(g);s.giftSecrets[g.id]={token:id().replaceAll('-','')+id().replaceAll('-',''),requestId:String(p.requestId),cost}}
        const token=s.giftSecrets[g.id].token;result={giftId:g.id,token,link:'?gift='+token};break
      }
      case 'gift.claim': {
        const g=s.gifts?.find(v=>s.giftSecrets?.[v.id]?.token===p.token)
        if(!g||g.senderId===me.id)throw new Error('invalid_gift')
        if(g.status==='claimed'&&g.recipientId===me.id)break
        if(g.status!=='sent'||Date.parse(g.expiresAt)<=Date.now())throw new Error('gift_unavailable')
        g.status='claimed';g.recipientId=me.id;s.coupons.push({id:id(),userId:me.id,rewardId:g.rewardId,title:g.title,code:'DEMO-'+id(),status:'issued',expiresAt:new Date(Date.now()+30*86400000).toISOString(),pointId:null,campaignId:null});break
      }
      case 'gift.cancel': {
        const g=s.gifts?.find(v=>v.id===p.giftId)
        if(!g||g.senderId!==me.id)throw new Error('forbidden')
        if(g.status==='claimed')throw new Error('gift_already_claimed')
        if(g.status==='sent'){g.status='cancelled';credit(s.giftSecrets![g.id].cost,'Возврат','gift_refund:'+g.id);const e=s.entities.find(v=>v.id===g.rewardId);if(e&&e.capacity!==null)e.capacity++}break
      }
      case 'passport.claim': {
        const e=entity();if(!s.progress.some(v=>v.entityId===e.id&&v.userId===me.id))throw new Error('verified_action_required')
        s.passport??=[];if(!s.passport.some(v=>v.entityId===e.id))s.passport.push({entityId:e.id,title:e.title,earnedAt:now()});break
      }
      case 'admin.project.save': case 'admin.project.update': {
        const project=clone(p.project) as unknown as import('./contracts.ts').ClientProject, prior=s.projects?.find(v=>v.id===project.id)
        if(!['owner','admin'].includes(me.role)&&!(me.role==='editor'&&prior?.managerId===me.id&&project.managerId===me.id&&prior.userId===project.userId))throw new Error('forbidden')
        if(!project.id||!project.title?.trim()||!Array.isArray(project.milestones)||!s.members.some(v=>v.id===project.userId)||!s.members.some(v=>v.id===project.managerId))throw new Error('invalid_project')
        if(project.milestones.some(v=>v.status==='approved'&&!prior?.milestones.some(old=>JSON.stringify(old)===JSON.stringify(v))))throw new Error('client_approval_required')
        project.updatedAt=now();s.projects??=[];s.projects=s.projects.filter(v=>v.id!==project.id);s.projects.push(project);break
      }
      case 'project.approve': {
        const project=s.projects?.find(v=>v.id===p.projectId&&v.userId===me.id),m=project?.milestones.find(v=>v.id===p.milestoneId)
        if(!m||!['review','approved'].includes(m.status))throw new Error('forbidden')
        m.status='approved';project!.updatedAt=now();break
      }
      case 'bootstrap':
        break
      case 'demo.reset':
        this.storage.removeItem(this.key)
        s = this.initial()
        break
      case 'demo.role': {
        const roles: Role[] = [
          'owner',
          'admin',
          'editor',
          'campaign_manager',
          'moderator',
          'mentor',
          'analyst',
          'cashier',
          'member',
        ]
        if (!roles.includes(p.role as Role)) throw new Error('Неизвестная роль')
        me.role = p.role as Role
        break
      }
      case 'daily.claim': {
        const today = day(this.config.timezone)
        if (me.lastDaily !== today) {
          me.lastDaily = today
          me.streak++
          me.xp += 30
          credit(25, 'Ежедневный бонус', `daily:${today}`)
          if (me.streak % 7 === 0) me.freezes = Math.min(2, me.freezes + 1)
        }
        result = { gained: 30 }
        break
      }
      case 'content.complete':
        result = { gained: complete(entity()) }
        break
      case 'favorite.toggle':
      case 'reaction.toggle': {
        const e = entity()
        const list = action.startsWith('favorite') ? s.favorites : s.reactions
        const i = list.indexOf(e.id)
        if (i >= 0) list.splice(i, 1)
        else list.push(e.id)
        break
      }
      case 'quiz.start': {
        const e = entity()
        if (e.kind === 'lesson' && (!s.unlocked.includes(String(e.data.courseId)) || s.entities.find(v=>v.id===e.data.courseId)?.data.subscription===true&&!s.membership?.some(v=>v.entityId===e.data.courseId&&Date.parse(v.expiresAt)>Date.now())))
          throw new Error('Сначала откройте курс')
        const questions = (e.data.questions ?? []) as {
          question: string
          options: string[]
          correct: number
          explain: string
        }[]
        if (!questions.length) throw new Error('В этом материале нет квиза')
        let attempt = !s.progress.some((v) => v.entityId === e.id && v.userId === me.id)
          ? s.attempts.find((a) => a.entityId === e.id && !a.practice)
          : undefined
        if (!attempt) {
          attempt = {
            id: id(),
            entityId: e.id,
            questions: questions.map((q) => ({ question: q.question, options: q.options })),
            index: 0,
            answers: [],
            correct: questions.map((q) => q.correct),
            explanations: questions.map((q) => q.explain),
            practice: s.progress.some((v) => v.entityId === e.id && v.userId === me.id),
          }
          s.attempts.push(attempt)
        }
        result = {
          attemptId: attempt.id,
          questions: attempt.questions as unknown as Data[],
          answers: attempt.answers,
          index: attempt.answers.length,
          score: attempt.answers.filter((v, i) => v === attempt!.correct[i]).length,
          done: attempt.answers.length === attempt.questions.length,
        }
        break
      }
      case 'quiz.answer': {
        const a = s.attempts.find((a) => a.id === p.attemptId)
        if (!a) throw new Error('Попытка не найдена')
        const index = Number(p.index),
          answer = Number(p.answer)
        if (!Number.isInteger(index) || index < 0 || index > a.index || index >= a.questions.length)
          throw new Error('Неверный порядок ответов')
        if (!Number.isInteger(answer) || answer < 0 || answer >= a.questions[index].options.length)
          throw new Error('Выберите ответ')
        if (index === a.index) {
          a.answers.push(answer)
          a.index++
        }
        const done = a.index === a.questions.length
        const score = a.answers.filter((v, i) => v === a.correct[i]).length
        result = {
          answer: a.answers[index],
          correct: a.answers[index] === a.correct[index],
          correctIndex: a.correct[index],
          explain: a.explanations[index] ?? '',
          done,
          score,
          gained: done
            ? complete(
                s.entities.find((e) => e.id === a.entityId)!,
                score,
              )
            : 0,
        }
        break
      }
      case 'game.start': {
        const e = entity()
        const session = {
          id: id(),
          entityId: e.id,
          game: String(p.game ?? e.data.game ?? 'scratch'),
          used: false,
          outcome: s.progress.some((item) => item.entityId === e.id && item.userId === me.id)
            ? 'Тренировка'
            : '+20 баллов',
        }
        s.sessions.push(session)
        result = { sessionId: session.id, outcome: session.outcome, gained: 25 }
        break
      }
      case 'campaign.open': {
        const e = entity()
        const session = s.sessions.find((g) => g.id === p.sessionId && g.entityId === e.id)
        if (!session || session.used) throw new Error('Начните новую игровую сессию')
        session.used = true
        const gained = complete(e, Number(p.score ?? 0))
        result = { gained, gainedXp: gained, gainedPoints: gained ? 20 : 0, outcome: session.outcome }
        break
      }
      case 'reward.claim': {
        const e = entity()
        if (e.kind !== 'reward') throw new Error('Подарок не найден')
        const issued = s.coupons.filter((c) => c.rewardId === e.id).length
        if (e.capacity !== null && issued >= e.capacity) throw new Error('Все подарки уже разобрали')
        const couponId = id()
        credit(-Number(e.data.pointsCost ?? e.price), `Обмен: ${e.title}`, `reward:${couponId}`)
        s.coupons.unshift({
          id: couponId,
          userId: me.id,
          rewardId: e.id,
          title: e.title,
          code: `AZ-${id().slice(0, 8).toUpperCase()}`,
          status: 'issued',
          expiresAt: new Date(Date.now() + Number(e.data.expiresDays ?? 30) * 86400000).toISOString(),
          pointId: null,
          campaignId: null,
        })
        result = { gained: 0 }
        break
      }
      case 'coupon.redeem': {
        allow(['cashier'])
        const c = s.coupons.find((c) => c.code === p.code)
        if (!c) throw new Error('Код не найден')
        if (c.status !== 'issued') throw new Error('Код уже погашен')
        if (new Date(c.expiresAt).getTime() < Date.now()) throw new Error('Срок кода истёк')
        if (p.pointId !== 'main') throw new Error('Точка недоступна')
        c.status = 'redeemed'
        c.pointId = 'main'
        break
      }
      case 'order.create': {
        const existing = p.requestId
          ? s.orders.find((o) => o.userId === me.id && o.requestId === p.requestId)
          : undefined
        if (existing) {
          result = { orderId: existing.id }
          break
        }
        const rows = p.items as { entityId: string; quantity: number; variant: string }[]
        if (!Array.isArray(rows) || !rows.length) throw new Error('Корзина пуста')
        const items = rows.map((row) => {
          const e = s.entities.find((e) => e.id === row.entityId)
          if (!e || !['product', 'service'].includes(e.kind)) throw new Error('Товар не найден')
          if (!Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 20)
            throw new Error('Неверное количество')
          const variants = e.data.variants as { name: string; price: number }[]
          const variant = variants?.find((v) => v.name === row.variant)
          if (variants?.length && !variant) throw new Error('Выберите вариант')
          return { ...row, price: variant?.price ?? e.price }
        })
        s.orders.unshift({
          id: id(),
          requestId: p.requestId ? String(p.requestId) : undefined,
          userId: me.id,
          items,
          total: items.reduce((n, i) => n + i.price * i.quantity, 0),
          status: 'new',
          note:
            String(p.note ?? '').slice(0, 2000) +
            rows
              .map((row) => {
                const entity = s.entities.find((e) => e.id === row.entityId),
                  answers = (p.brief as Record<string, Record<string, string>> | undefined)?.[row.entityId]
                const fields = (entity?.data.briefFields ??
                  ((entity?.data.form ?? []) as string[]).map((label, i) => ({ id: `field-${i}`, label }))) as {
                  id: string
                  label: string
                }[]
                return answers
                  ? '\n' +
                      fields
                        .filter((f) => answers[f.id])
                        .map((f) => `${f.label}: ${answers[f.id]}`)
                        .join('\n')
                  : ''
              })
              .join(''),
          createdAt: now(),
        })
        break
      }
      case 'admin.order.update': {
        const order = s.orders.find((v) => v.id === p.orderId)
        if (!order) throw new Error('Заказ не найден')
        if (!['new', 'accepted', 'ready', 'completed', 'cancelled'].includes(String(p.status)))
          throw new Error('Неверный статус')
        order.status = p.status as typeof order.status
        break
      }
      case 'event.book': {
        const e = entity()
        if (s.bookings.some((b) => b.entityId === e.id && b.userId === me.id && b.status !== 'cancelled')) break
        const count = s.bookings.filter(
          (b) => b.entityId === e.id && ['confirmed', 'checked_in'].includes(b.status),
        ).length
        s.bookings.unshift({
          id: id(),
          entityId: e.id,
          userId: me.id,
          status: e.capacity !== null && count >= e.capacity ? 'waitlist' : 'confirmed',
          code: `EV-${id().slice(0, 8).toUpperCase()}`,
          createdAt: now(),
        })
        break
      }
      case 'event.cancel': {
        const e = entity()
        s.bookings
          .filter((b) => b.entityId === e.id && b.userId === me.id && b.status !== 'checked_in')
          .forEach((b) => (b.status = 'cancelled'))
        const next = s.bookings.find((b) => b.entityId === e.id && b.status === 'waitlist')
        if (next) next.status = 'confirmed'
        break
      }
      case 'event.checkin': {
        allow(['cashier', 'campaign_manager'])
        const b = s.bookings.find((b) => b.code === p.code)
        if (!b || b.status !== 'confirmed') throw new Error('Билет не готов к регистрации')
        b.status = 'checked_in'
        break
      }
      case 'post.create': {
        const body = String(p.body ?? '').trim()
        if (body.length < 3 || body.length > 4000) throw new Error('Напишите от 3 до 4000 символов')
        s.posts.unshift({
          id: id(),
          userId: me.id,
          name: me.name,
          body,
          topic: String(p.topic ?? 'Общее'),
          audience: p.audience === 'employees' ? 'employees' : 'all',
          teamId: p.teamId ? String(p.teamId) : null,
          status: 'published',
          likes: [],
          createdAt: now(),
        })
        break
      }
      case 'comment.create': {
        const post = s.posts.find((v) => v.id === p.postId && v.status === 'published')
        const body = String(p.body ?? '').trim()
        if (!post || !body || body.length > 2000) throw new Error('Проверьте комментарий')
        s.comments.push({ id: id(), postId: post.id, userId: me.id, name: me.name, body, createdAt: now() })
        break
      }
      case 'post.like': {
        const post = s.posts.find((v) => v.id === p.postId)
        if (!post) throw new Error('Пост не найден')
        post.likes = post.likes.includes(me.id) ? post.likes.filter((v) => v !== me.id) : [...post.likes, me.id]
        break
      }
      case 'post.report': {
        s.audit.unshift({
          id: id(),
          actorId: me.id,
          action: 'post.report',
          targetId: String(p.postId),
          createdAt: now(),
        })
        break
      }
      case 'admin.post.moderate': {
        const post = s.posts.find((v) => v.id === p.postId)
        if (post && ['published', 'pending', 'hidden'].includes(String(p.status)))
          post.status = p.status as typeof post.status
        break
      }
      case 'homework.submit': {
        const body = String(p.body ?? '').trim()
        if (body.length < 3) throw new Error('Добавьте описание работы')
        s.homework.unshift({
          id: id(),
          userId: me.id,
          lessonId: String(p.lessonId),
          body,
          file: String(p.file ?? ''),
          status: 'submitted',
          feedback: '',
          createdAt: now(),
        })
        break
      }
      case 'homework.review': {
        allow(['mentor'])
        const h = s.homework.find((v) => v.id === p.homeworkId)
        if (!h) throw new Error('Работа не найдена')
        if (!['approved', 'revision'].includes(String(p.status))) throw new Error('Выберите решение')
        h.status = p.status as typeof h.status
        h.feedback = String(p.feedback ?? '')
        break
      }
      case 'certificate.issue': {
        const lessons = s.entities.filter((e) => e.kind === 'lesson' && e.data.courseId === p.courseId)
        if (!lessons.length || lessons.some((e) => !s.progress.some((v) => v.entityId === e.id && v.userId === me.id)))
          throw new Error('Сначала завершите все уроки курса')
        const code = s.certificates[String(p.courseId)] ?? `AZ-CERT-${id().slice(0, 8).toUpperCase()}`
        s.certificates[String(p.courseId)] = code
        result = { code }
        break
      }
      case 'poll.vote': {
        const e = entity()
        const options = e.data.options as string[]
        const option = Number(p.option)
        if (!Number.isInteger(option) || !options?.[option]) throw new Error('Выберите вариант')
        if (s.votes[e.id] !== undefined) throw new Error('Ваш голос уже учтён')
        s.votes[e.id] = option
        break
      }
      case 'recognition.send': {
        const to = s.members.find((m) => m.id === p.userId)
        if (!to || to.id === me.id || String(p.body ?? '').trim().length < 3)
          throw new Error('Выберите коллегу и напишите благодарность')
        s.recognitions.unshift({ id: id(), from: me.name, to: to.name, body: String(p.body) })
        break
      }
      case 'profile.update': {
        for (const k of ['notificationOptIn', 'quietFrom', 'quietTo', 'timezone'] as const)
          if (p[k] !== undefined) (me as unknown as Record<string, unknown>)[k] = p[k]
        break
      }
      case 'notification.read': {
        const n = s.notifications.find((n) => n.id === p.noticeId && n.userId === me.id)
        if (n) n.read = true
        break
      }
      case 'referral.claim': {
        if (p.code === me.id) throw new Error('Нельзя пригласить себя')
        credit(50, 'Подтверждённое приглашение (демо)', `ref:${String(p.code)}`)
        break
      }
      case 'demo.purchase': {
        const e = entity()
        s.payments ??= []
        if (!s.unlocked.includes(e.id))
          s.payments.push({
            invoiceId: id(),
            userId: me.id,
            name: me.name,
            entityId: e.id,
            title: e.title,
            amount: e.price,
            currency: 'XTR',
            status: 'paid',
            createdAt: now(),
          })
        if(e.data.subscription===true){s.membership??=[];s.membership=s.membership.filter(v=>v.entityId!==e.id);s.membership.push({entityId:e.id,expiresAt:new Date(Date.now()+30*86400000).toISOString(),status:'active'})}
        s.unlocked.push(String(p.entityId))
        break
      }
      case 'admin.analytics':
        result = { analytics: this.snapshot(s).analytics as unknown as Data }
        break
      case 'admin.payments':
        result = { payments: s.payments ?? [] }
        break
      case 'admin.refund': {
        const payment = s.payments?.find((v) => v.invoiceId === p.invoiceId)
        if (!payment) throw new Error('Платёж не найден')
        payment.status = 'refunded'
        payment.refund = { id: id(), status: 'succeeded', attempts: 1, createdAt: now() }
        s.membership=(s.membership??[]).filter(v=>v.entityId!==payment.entityId)
        s.unlocked = s.unlocked.filter((v) => v !== payment.entityId)
        result = { refund: payment.refund }
        break
      }
      case 'queue.list':
      case 'admin.queue.list': {
        allow(p.kind === 'refund' ? [] : ['campaign_manager'])
        result = {
          jobs: p.kind === 'refund' ? (s.payments ?? []).filter((v) => v.refund).map((v) => v.refund) : (s.jobs ?? []),
        }
        break
      }
      case 'queue.retry':
      case 'admin.queue.retry': {
        allow(p.kind === 'refund' ? [] : ['campaign_manager'])
        const job = s.jobs?.find((v) => v.id === p.jobId)
        if (job) job.status = 'pending'
        result = { jobs: s.jobs ?? [] }
        break
      }
      case 'stars.invoice': {
        const e = entity()
        result = { link: `demo:${e.id}` }
        break
      }
      case 'admin.entity.save': {
        const e = p.entity as unknown as Entity
        if (!e?.title?.trim() || !e.module) throw new Error('Заполните название и модуль')
        const index = s.entities.findIndex((v) => v.id === e.id)
        if (index < 0) s.entities.unshift({ ...e, id: e.id || id() })
        else s.entities[index] = e
        break
      }
      case 'admin.entity.get': {
        const e = entity()
        result = { entity: e as unknown as Data }
        break
      }
      case 'admin.entity.delete': {
        const e = entity()
        if (s.progress.some((v) => v.entityId === e.id) || s.coupons.some((v) => v.rewardId === e.id))
          throw new Error('Есть история использования. Снимите с публикации.')
        s.entities = s.entities.filter((v) => v.id !== e.id)
        break
      }
      case 'admin.member.update': {
        const m = s.members.find((v) => v.id === p.userId)
        if (!m) throw new Error('Участник не найден')
        for (const k of ['role', 'teamId', 'approved'] as const)
          if (p[k] !== undefined) (m as unknown as Record<string, unknown>)[k] = p[k]
        if (m.id === me.id) s.me = m
        break
      }
      case 'admin.points.adjust': {
        if (!Number.isInteger(p.delta) || !p.reason || !p.ref)
          throw new Error('Нужны сумма, основание и уникальная ссылка')
        const target = s.members.find((m) => m.id === p.userId)
        if (!target) throw new Error('Участник не найден')
        if (s.ledger.some((v) => v.ref === p.ref && v.userId === target.id)) break
        if (target.points + Number(p.delta) < 0) throw new Error('Не хватает баллов')
        target.points += Number(p.delta)
        if (target.id === me.id) me.points = target.points
        s.ledger.unshift({
          id: id(),
          userId: target.id,
          delta: Number(p.delta),
          reason: String(p.reason),
          ref: String(p.ref),
          createdAt: now(),
        })
        break
      }
      case 'admin.visit': {
        const target = s.members.find((m) => m.id === p.userId)
        if (!target) throw new Error('Участник не найден')
        target.stamps++
        if (target.id === me.id) me.stamps = target.stamps
        break
      }
      case 'admin.notification.enqueue': {
        s.jobs ??= []
        for (const m of s.members.filter((m) => m.notificationOptIn)) {
          s.notifications.unshift({
            id: id(),
            userId: m.id,
            title: String(p.title ?? ''),
            body: String(p.body ?? ''),
            read: false,
            createdAt: now(),
          })
          s.jobs.push({
            id: id(),
            userId: m.id,
            title: String(p.title ?? ''),
            source: 'broadcast',
            status: 'pending',
            attempts: 0,
            createdAt: now(),
          })
        }
        break
      }
      default:
        throw new Error('Действие недоступно в демонстрации')
    }
    if (action.startsWith('admin.') || action === 'homework.review')
      s.audit.unshift({
        id: id(),
        actorId: me.id,
        action,
        targetId: String(p.entityId ?? p.userId ?? p.orderId ?? ''),
        createdAt: now(),
      })
    const i = s.members.findIndex((m) => m.id === s.me.id)
    if (i >= 0) s.members[i] = s.me
    this.save(s)
    return { snapshot: this.snapshot(s), result }
  }
}
