import { Check, ChevronLeft, ChevronRight, Lock, Send, Star, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { api, errorText, isDemo } from '../lib/api'
import { GRADIENTS, lessonsWord, plural } from '../lib/game'
import { appLink } from '../lib/links'
import { sfx } from '../lib/sfx'
import { canPayStars, haptic, inTelegram, openInvoice, shareLink } from '../lib/tg'
import { Markdown } from '../Markdown'
import { insetOf, useStore, type Inset } from '../store'
import { Bar, celebrate, Cta, Emoji, Pattern, Tap } from '../ui'

const clip = (i: Inset, radius: number) => `inset(${i.top}px ${i.right}px ${i.bottom}px ${i.left}px round ${radius}px)`
const OPEN = { top: 0, right: 0, bottom: 0, left: 0 }
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Страница закрытого курса: программа, цена и способы открыть доступ. */
export function CourseScreen({ id, from }: { id: number; from?: Inset }) {
  const course = useStore((s) => s.courses.find((c) => c.id === id))
  const feed = useStore((s) => s.feed)
  const me = useStore((s) => s.me)!
  const { pop, push, toast, boot, guard } = useStore.getState()
  const [busy, setBusy] = useState<string | null>(null)
  const [nudge, setNudge] = useState(0)
  const lessons = useMemo(() => feed.filter((c) => c.course_id === id).sort((a, b) => a.position - b.position || a.id - b.id), [feed, id])

  if (!course) return null
  const g = GRADIENTS[course.gradient] ?? GRADIENTS.ocean
  const next = lessons.find((l) => !l.completed)
  const finished = course.access && lessons.length > 0 && !next
  const friendsLeft = Math.max(0, course.invite_unlock - me.invited)

  const open = (lessonId: number, el: Element) => push({ type: 'lesson', id: lessonId, from: insetOf(el) })

  const opened = async () => {
    celebrate()
    sfx.levelUp()
    haptic.success()
    toast('Курс открыт', '🔓')
  }

  // Доступ выдаёт сервер, когда Telegram подтвердит оплату, — это занимает пару секунд.
  const waitForAccess = async () => {
    for (let i = 0; i < 8; i++) {
      await boot()
      if (useStore.getState().courses.find((c) => c.id === id)?.access) return true
      await wait(1200)
    }
    return false
  }

  const buy = async () => {
    if (busy) return
    if (!isDemo && !canPayStars) return toast('Оплата звёздами работает в приложении Telegram')
    setBusy('buy')
    try {
      const link = await api.courseInvoice(id)
      if (!link) {
        await boot()
        toast('В демо оплата условная: звёзды не списаны')
        await opened()
        return
      }
      const status = await openInvoice(link)
      if (status === 'paid') {
        if (await waitForAccess()) await opened()
        else toast('Оплата прошла. Курс откроется через минуту — обнови приложение')
      } else if (status === 'failed') {
        toast('Оплата не прошла. Звёзды не списаны')
      }
    } catch (e) {
      guard(e)
      toast(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const request = async () => {
    if (busy) return
    setBusy('request')
    try {
      await api.courseRequest(id)
      await boot()
      haptic.success()
      toast('Заявка отправлена. Ответ придёт в чат с ботом', '📨')
    } catch (e) {
      guard(e)
      toast(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const invite = () => {
    const link = appLink()
    if (!link) return toast('Ссылка появится, когда бот будет настроен')
    shareLink(link, `Зову в Elaz Ed. Если придёшь, у меня откроется курс «${course.title}».`)
  }

  return (
    <motion.div
      className="absolute inset-0 z-30 bg-bg"
      initial={from ? { clipPath: clip(from, 26), opacity: 0.6 } : { y: '100%' }}
      animate={from ? { clipPath: clip(OPEN, 0), opacity: 1 } : { y: 0 }}
      exit={from ? { clipPath: clip(from, 26), opacity: 0 } : { y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 34, mass: 0.9 }}
    >
      <div className="scroll h-full" style={{ paddingBottom: course.access ? 'calc(120px + var(--bottom))' : 'calc(210px + var(--bottom))' }}>
        <div className="relative overflow-hidden px-5 pb-14" style={{ background: g.css, color: g.ink, paddingTop: 'calc(var(--top) + 62px)' }}>
          <Pattern name={course.gradient} full />
          <div className="relative flex items-end gap-4">
            <div className="min-w-0 flex-1">
              <p className="w-fit rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">Курс · {course.lessons} {lessonsWord(course.lessons)}</p>
              <h1 className="mt-3 font-display text-[27px] font-semibold leading-[1.1]">{course.title}</h1>
              {course.subtitle && <p className="mt-2 text-[15px] font-medium leading-snug opacity-85">{course.subtitle}</p>}
            </div>
            <div className="floaty -mb-2 shrink-0">
              <Emoji char={course.emoji} size={96} animated />
            </div>
          </div>
        </div>

        <div className="relative -mt-7 rounded-t-[30px] bg-bg px-5 pt-6">
          {course.access ? (
            <div className="rounded-[20px] border border-line bg-card p-4">
              <div className="flex items-baseline justify-between text-[13.5px]">
                <span className="font-semibold">{finished ? 'Курс пройден' : 'Твой прогресс'}</span>
                <span className="tabular text-mute">
                  {course.done} из {course.lessons}
                </span>
              </div>
              <Bar progress={course.lessons ? course.done / course.lessons : 0} className="mt-2.5" />
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-[20px] border border-line bg-card p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-veil/8 text-mute">
                <Lock size={18} />
              </span>
              <p className="text-[14px] leading-snug text-mute">
                {course.request === 'pending' ? 'Заявка у автора. Как только он ответит, бот напишет тебе.' : 'Курс закрыт. Открой его звёздами, по заявке или вместе с друзьями.'}
              </p>
            </div>
          )}

          {course.description && (
            <div className="mt-6">
              <Markdown text={course.description} />
            </div>
          )}

          <h2 className="mb-3 mt-7 font-display text-[15px] font-semibold">Программа</h2>
          <div className="overflow-hidden rounded-[22px] border border-line bg-card/80">
            {lessons.map((l, i) => {
              const available = course.access || l.free_preview
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={(e) => {
                    if (available) {
                      haptic.tap()
                      open(l.id, e.currentTarget)
                    } else {
                      haptic.error()
                      setNudge((n) => n + 1)
                    }
                  }}
                  className="flex w-full items-center gap-3.5 border-b border-line px-4 py-3.5 text-left last:border-b-0 active:bg-veil/5"
                >
                  <span className={`tabular grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-[12px] font-semibold ${l.completed ? 'bg-mint/15 text-mint' : 'bg-veil/8 text-mute'}`}>
                    {l.completed ? <Check size={15} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[15px] font-semibold leading-snug ${available ? '' : 'text-mute'}`}>{l.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-mute">
                      {l.minutes} мин · +{l.xp} XP
                      {l.free_preview && !course.access && <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-semibold text-mint">открыт</span>}
                    </span>
                  </span>
                  {available ? <ChevronRight size={18} className="shrink-0 text-faint" /> : <Lock size={16} className="shrink-0 text-faint" />}
                </button>
              )
            })}
            {lessons.length === 0 && <p className="px-4 py-6 text-center text-[14px] text-mute">Уроки появятся здесь, как только автор их опубликует.</p>}
          </div>
        </div>
      </div>

      {!inTelegram && (
        <Tap onClick={pop} aria-label="Назад" className="absolute left-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md" style={{ top: 'calc(var(--top) + 10px)' }}>
          <ChevronLeft size={22} />
        </Tap>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pt-10" style={{ paddingBottom: 'calc(12px + var(--bottom))', background: 'linear-gradient(to top, var(--color-bg) 68%, transparent)' }}>
        {course.access ? (
          finished ? (
            <div className="flex h-[54px] items-center justify-center gap-2 rounded-[18px] border border-mint/25 bg-mint/10 font-display text-[14px] font-semibold text-mint">
              <Check size={18} strokeWidth={3} /> Все уроки пройдены
            </div>
          ) : (
            <Cta className="w-full" disabled={!next} onClick={(e) => next && open(next.id, e.currentTarget)}>
              {course.done > 0 ? 'Продолжить' : 'Начать курс'}
            </Cta>
          )
        ) : (
          <motion.div key={nudge} animate={nudge ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.38 }} className="space-y-2">
            {course.price_stars > 0 && (
              <Cta className="w-full" busy={busy === 'buy'} onClick={buy}>
                Открыть за <Star size={17} fill="currentColor" strokeWidth={0} /> <span className="tabular">{course.price_stars}</span>
              </Cta>
            )}
            <div className="flex gap-2">
              <Tap
                onClick={request}
                disabled={course.request === 'pending' || !!busy}
                className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-[18px] border border-line bg-card2 text-[14px] font-semibold disabled:text-mute"
              >
                <Send size={16} /> {course.request === 'pending' ? 'Заявка отправлена' : 'Запросить доступ'}
              </Tap>
              {course.invite_unlock > 0 && (
                <Tap onClick={invite} className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-[18px] border border-line bg-card2 text-[14px] font-semibold">
                  <Users size={16} /> Ещё {friendsLeft} {plural(friendsLeft, ['друг', 'друга', 'друзей'])}
                </Tap>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
