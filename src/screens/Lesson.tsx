import { Check, ChevronLeft, Copy, Eye, Heart, Play, Send, X } from 'lucide-react'
import { AnimatePresence, motion, useMotionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { api, ApiError, errorText } from '../lib/api'
import { comboPoints, GRADIENTS, iconFor, quizScore } from '../lib/game'
import { appLink } from '../lib/links'
import { sfx } from '../lib/sfx'
import { copyText, haptic, inTelegram, openLink, shareLink } from '../lib/tg'
import { track } from '../lib/track'
import type { Lesson, QuizQuestion } from '../lib/types'
import { Markdown } from '../Markdown'
import { useStore, type Inset } from '../store'
import { Cta, Emoji, Pattern, Tap } from '../ui'

const clip = (i: Inset, radius: number) => `inset(${i.top}px ${i.right}px ${i.bottom}px ${i.left}px round ${radius}px)`
const OPEN = { top: 0, right: 0, bottom: 0, left: 0 }

export function LessonScreen({ id, from }: { id: number; from?: Inset }) {
  const card = useStore((s) => s.feed.find((c) => c.id === id))
  const me = useStore((s) => s.me)!
  const pop = useStore((s) => s.pop)
  const { setMe, patchCard, setReward, toast, guard } = useStore.getState()
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [failed, setFailed] = useState<false | 'load' | 'locked'>(false)
  const [answers, setAnswers] = useState<number[] | null>(null)
  const [busy, setBusy] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const quizRef = useRef<HTMLDivElement>(null)
  const read = useMotionValue(0)

  useEffect(() => {
    let alive = true
    api
      .lesson(id)
      .then((l) => alive && setLesson(l))
      .catch((e) => {
        guard(e)
        if (alive) setFailed(e instanceof ApiError && e.code === 'course_locked' ? 'locked' : 'load')
      })
    return () => {
      alive = false
    }
  }, [id, guard])

  const view = lesson ?? card
  const g = GRADIENTS[view?.gradient ?? 'aurora'] ?? GRADIENTS.aurora
  const completed = lesson?.completed ?? card?.completed ?? false
  const liked = lesson?.liked ?? card?.liked ?? false
  const likes = lesson?.likes ?? card?.likes ?? 0
  const quiz = lesson?.quiz ?? []
  const quizPending = !completed && quiz.length > 0 && !answers
  const bonus = answers ? quizScore(quiz.map((q) => q.correct), answers).bonus : 0

  const onScroll = () => {
    const el = scroller.current
    if (el) read.set(Math.min(1, el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)))
  }

  const finish = async () => {
    if (!lesson || busy) return
    setBusy(true)
    try {
      const fromXp = me.xp
      const res = await api.complete(id, answers ?? [])
      setMe(res.me)
      patchCard(id, { completed: true })
      setLesson({ ...lesson, completed: true })
      if (!res.already) setReward({ result: res, fromXp, lessonId: id })
    } catch (e) {
      guard(e)
      toast(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const toggleLike = async () => {
    if (!lesson) return
    const next = !liked
    if (next) sfx.pop()
    setLesson({ ...lesson, liked: next, likes: Math.max(0, likes + (next ? 1 : -1)) })
    try {
      const res = await api.like(id)
      setLesson((l) => (l ? { ...l, ...res } : l))
      patchCard(id, res)
    } catch (e) {
      guard(e)
    }
  }

  const copyForAi = async () => {
    if (!lesson) return
    const text = lesson.copy_text?.trim() || `# ${lesson.title}\n\n${lesson.body}`
    if (await copyText(text)) {
      haptic.success()
      toast('Скопировано. Вставь в нейронку', '📋')
      track('copy', undefined, id)
    }
  }

  const share = () => {
    const link = appLink(id)
    if (!link || !view) return toast('Ссылка появится, когда бот будет настроен')
    shareLink(link, `${view.title} — урок в OG CRE8R²`)
    track('share', { kind: 'lesson', channel: 'link' }, id)
  }

  return (
    <motion.div
      className="absolute inset-0 z-30 bg-bg"
      initial={from ? { clipPath: clip(from, 26), opacity: 0.6 } : { y: '100%' }}
      animate={from ? { clipPath: clip(OPEN, 0), opacity: 1 } : { y: 0 }}
      exit={from ? { clipPath: clip(from, 26), opacity: 0 } : { y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 34, mass: 0.9 }}
    >
      <div ref={scroller} onScroll={onScroll} className="scroll h-full" style={{ paddingBottom: 'calc(120px + var(--bottom))' }}>
        <div className="relative overflow-hidden" style={{ background: g.css, color: g.ink, paddingTop: 'calc(var(--top) + 54px)' }}>
          <Pattern name={view?.gradient ?? 'aurora'} full />
          {view?.cover_url ? (
            <img src={view.cover_url} alt="" className="relative mx-auto mb-12 h-[190px] w-[calc(100%-40px)] rounded-[24px] object-cover" />
          ) : (
            <div className="relative flex justify-center pb-14">
              <motion.div initial={{ scale: 0.5, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.12 }}>
                <div className="floaty">
                  <Emoji char={view ? iconFor(view) : '✨'} size={132} animated />
                </div>
              </motion.div>
            </div>
          )}
        </div>

        <div className="relative -mt-7 rounded-t-[30px] bg-bg px-5 pt-6">
          {view && (
            <>
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
                <span className="rounded-full bg-violet/15 px-2.5 py-1 text-violet">{view.category}</span>
                <span className="rounded-full bg-veil/8 px-2.5 py-1 text-mute">{view.minutes} мин</span>
                <span className="rounded-full bg-veil/8 px-2.5 py-1 text-mute">+{view.xp} XP</span>
                <span className="flex items-center gap-1 rounded-full bg-veil/8 px-2.5 py-1 text-mute">
                  <Eye size={12} /> {view.views}
                </span>
              </div>
              <h1 className="selectable mt-3.5 font-display text-[25px] font-semibold leading-[1.15]">{view.title}</h1>
              {view.subtitle && <p className="selectable mt-2.5 text-[16px] leading-snug text-mute">{view.subtitle}</p>}
            </>
          )}

          {!lesson && !failed && (
            <div className="mt-7 space-y-3">
              {[92, 100, 78, 96, 60].map((w, i) => (
                <div key={i} className="skeleton h-4 rounded-full" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {failed && (
            <div className="mt-8 rounded-[22px] border border-line bg-card p-5 text-center">
              <p className="font-semibold">{failed === 'locked' ? 'Этот урок из закрытого курса' : 'Урок не загрузился'}</p>
              <p className="mt-1 text-[14px] text-mute">{failed === 'locked' ? 'Он откроется вместе с курсом.' : 'Проверь связь и открой его ещё раз.'}</p>
              {failed === 'locked' && card?.course_id && (
                <Cta
                  className="mt-4 w-full"
                  onClick={() => {
                    const courseId = card.course_id!
                    pop()
                    useStore.getState().push({ type: 'course', id: courseId })
                  }}
                >
                  Открыть курс
                </Cta>
              )}
            </div>
          )}

          {lesson && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              {lesson.video_url && (
                <div className="mb-6">
                  <Video url={lesson.video_url} />
                </div>
              )}

              {/* Подзаголовок часто повторяет первую фразу текста — второй раз её не показываем. */}
              <Markdown text={lesson.subtitle && lesson.body.startsWith(lesson.subtitle) ? lesson.body.slice(lesson.subtitle.length).trimStart() : lesson.body} />

              <Tap onClick={copyForAi} className="mt-8 flex w-full items-center gap-3.5 rounded-[22px] border border-line bg-card p-4 text-left">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet/15 text-violet">
                  <Copy size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">Скопировать для нейронки</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-mute">{lesson.copy_text ? 'Готовый промпт из урока' : 'Текст урока целиком — разбери на своём примере'}</span>
                </span>
              </Tap>

              {quiz.length > 0 && (
                <div ref={quizRef} className="mt-8 scroll-mt-6">
                  <Quiz quiz={quiz} practice={completed && !answers} onDone={setAnswers} />
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {!inTelegram && (
        <Tap onClick={pop} aria-label="Назад" className="absolute left-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md" style={{ top: 'calc(var(--top) + 10px)' }}>
          <ChevronLeft size={22} />
        </Tap>
      )}
      <Tap onClick={share} aria-label="Поделиться" className="absolute right-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md" style={{ top: 'calc(var(--top) + 10px)' }}>
        <Send size={18} />
      </Tap>

      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pt-10" style={{ paddingBottom: 'calc(14px + var(--bottom))', background: 'linear-gradient(to top, var(--color-bg) 62%, transparent)' }}>
        <div className="mb-3 h-[3px] overflow-hidden rounded-full bg-veil/8">
          <motion.div className="h-full origin-left rounded-full" style={{ scaleX: read, background: 'var(--aurora)' }} />
        </div>
        <div className="flex items-center gap-2.5">
          <Tap onClick={toggleLike} feedback="soft" aria-label="Нравится" className="flex h-[54px] min-w-[54px] items-center justify-center gap-1.5 rounded-[20px] border border-line bg-card2 px-3.5">
            <motion.span key={String(liked)} initial={{ scale: liked ? 0.4 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 12 }}>
              <Heart size={21} className={liked ? 'text-pink' : 'text-mute'} fill={liked ? 'currentColor' : 'none'} />
            </motion.span>
            {likes > 0 && <span className="text-[13px] font-semibold text-mute">{likes}</span>}
          </Tap>
          {completed ? (
            <div className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-[20px] border border-mint/25 bg-mint/10 font-display text-[14px] font-semibold text-mint">
              <Check size={18} strokeWidth={3} /> Пройдено
            </div>
          ) : quizPending ? (
            <Tap
              onClick={() => quizRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="h-[54px] flex-1 rounded-[20px] border border-violet/40 bg-violet/15 font-display text-[14px] font-semibold text-ink"
            >
              К квизу · {quiz.length} {quiz.length === 1 ? 'вопрос' : quiz.length < 5 ? 'вопроса' : 'вопросов'}
            </Tap>
          ) : (
            <Cta className="tabular flex-1" onClick={finish} disabled={!lesson} busy={busy}>
              Забрать +{(view?.xp ?? 0) + bonus} XP
            </Cta>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ---------- Видео ----------

export function Video({ url }: { url: string }) {
  const yt = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([\w-]{11})/.exec(url)?.[1]
  const rt = /rutube\.ru\/video\/([a-f0-9]{32})/.exec(url)?.[1]
  const vk = /vk(?:video)?\.(?:com|ru)\/video(-?\d+)_(\d+)/.exec(url)
  const src = yt ? `https://www.youtube.com/embed/${yt}?playsinline=1&rel=0` : rt ? `https://rutube.ru/play/embed/${rt}` : vk ? `https://vk.com/video_ext.php?oid=${vk[1]}&id=${vk[2]}&hd=2` : null

  if (src) {
    return (
      <div className="aspect-video overflow-hidden rounded-[22px] border border-line bg-black">
        <iframe src={src} title="Видео" className="h-full w-full" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      </div>
    )
  }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return <video src={url} controls playsInline preload="metadata" className="aspect-video w-full rounded-[22px] border border-line bg-black" />
  }
  return (
    <Tap onClick={() => openLink(url)} className="flex w-full items-center gap-3.5 rounded-[22px] border border-line bg-card p-4 text-left">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white" style={{ background: 'var(--aurora)' }}>
        <Play size={18} fill="currentColor" />
      </span>
      <span className="text-[15px] font-semibold">Смотреть видео</span>
    </Tap>
  )
}

// ---------- Квиз: по одному вопросу, серия верных ответов поднимает награду ----------

function Quiz({ quiz, practice, onDone }: { quiz: QuizQuestion[]; practice: boolean; onDone: (answers: number[]) => void }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [combo, setCombo] = useState(0)
  const [points, setPoints] = useState(0)
  const [pop, setPop] = useState<{ id: number; text: string } | null>(null)
  const [shake, setShake] = useState(0)
  const reveal = useRef<HTMLDivElement>(null)
  const done = step >= quiz.length
  const q = quiz[Math.min(step, quiz.length - 1)]
  const picked = answers[step]
  const answered = picked !== undefined
  const score = answers.filter((a, i) => a === quiz[i]?.correct).length

  const pick = (i: number) => {
    if (answered) return
    setAnswers([...answers, i])
    if (i === q.correct) {
      const next = combo + 1
      const gain = comboPoints(next)
      setCombo(next)
      setPoints((p) => p + gain)
      setPop({ id: Date.now(), text: `+${gain}` })
      haptic.success()
      sfx.good(next)
    } else {
      setCombo(0)
      setShake((s) => s + 1)
      haptic.error()
      sfx.bad()
    }
  }

  const next = () => {
    const last = step === quiz.length - 1
    setStep(step + 1)
    if (last) onDone(answers)
  }

  return (
    <div className="rounded-[26px] border border-line bg-card p-4">
      <div className="flex items-center gap-2.5">
        <Emoji char="🕹️" size={22} />
        <p className="font-display text-[15px] font-semibold">Квиз</p>
        {practice && <span className="rounded-full bg-veil/8 px-2 py-0.5 text-[11px] font-semibold text-mute">тренировка</span>}
        <div className="ml-auto flex items-center gap-2">
          <AnimatePresence>
            {combo >= 2 && !done && (
              <motion.span
                key={combo}
                initial={{ scale: 0.4, rotate: -10, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 520, damping: 14 }}
                className="rounded-full px-2.5 py-1 font-display text-[11px] font-bold text-[#2a1020]"
                style={{ background: GRADIENTS.candy.css }}
              >
                серия ×{combo}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="relative font-display text-[13px] font-semibold text-mint">
            +{points}
            <AnimatePresence>
              {pop && (
                <motion.span
                  key={pop.id}
                  initial={{ opacity: 1, y: 0, scale: 1 }}
                  animate={{ opacity: 0, y: -34, scale: 1.5 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  onAnimationComplete={() => setPop(null)}
                  className="pointer-events-none absolute -top-1 right-0"
                >
                  {pop.text}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </div>
      </div>

      <div className="mt-3.5 flex gap-1.5">
        {quiz.map((item, i) => {
          const a = answers[i]
          const color = a === undefined ? 'var(--track)' : a === item.correct ? 'var(--color-mint)' : 'var(--color-rose)'
          return <motion.div key={i} animate={{ scaleY: i === step ? 1.6 : 1 }} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: color }} />
        })}
      </div>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
            <Emoji char={score === quiz.length ? '🏆' : score > 0 ? '👏' : '🫠'} size={64} animated className="mx-auto" />
            <p className="mt-3 font-display text-[19px] font-semibold">
              {score} из {quiz.length}
            </p>
            <p className="mt-1 text-[14px] text-mute">
              {practice ? 'Тренировка без XP — урок уже засчитан.' : score === quiz.length ? `Чисто. Бонус +${points} XP` : score > 0 ? `Бонус +${points} XP` : 'Бывает. XP за урок всё равно твои.'}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -26 }}
            transition={{ duration: 0.2 }}
            className="mt-5"
          >
            <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">
              Вопрос {step + 1} из {quiz.length}
            </p>
            <p className="selectable mt-1.5 text-[17px] font-semibold leading-snug">{q.q}</p>
            <motion.div key={shake} animate={shake ? { x: [0, -9, 9, -6, 6, 0] } : {}} transition={{ duration: 0.36 }} className="mt-4 space-y-2">
              {q.options.map((opt, i) => {
                const right = answered && i === q.correct
                const wrong = answered && i === picked && i !== q.correct
                return (
                  <Tap
                    key={i}
                    feedback="none"
                    onClick={() => pick(i)}
                    disabled={answered}
                    className={`flex w-full items-center gap-3 rounded-[18px] border p-3.5 text-left text-[15px] font-medium transition-colors ${
                      right ? 'border-mint/50 bg-mint/12 text-ink' : wrong ? 'border-rose/50 bg-rose/12 text-ink' : answered ? 'border-line bg-card2/50 text-faint' : 'border-line bg-card2 text-ink'
                    }`}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-[11px] font-bold ${
                        right ? 'bg-mint text-on-mint' : wrong ? 'bg-rose text-on-rose' : 'bg-veil/8 text-mute'
                      }`}
                    >
                      {right ? <Check size={14} strokeWidth={3.5} /> : wrong ? <X size={14} strokeWidth={3.5} /> : 'АБВГ'[i]}
                    </span>
                    <span className="flex-1">{opt}</span>
                  </Tap>
                )
              })}
            </motion.div>

            <AnimatePresence>
              {answered && (
                <motion.div
                  ref={reveal}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  // Пояснение и кнопка «Дальше» вырастают под вариантами — когда доросли, подкручиваем, чтобы их не закрыла нижняя панель.
                  onAnimationComplete={() => reveal.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                  className="scroll-mb-36 overflow-hidden"
                >
                  {q.explain && <p className="mt-3.5 rounded-[16px] bg-veil/5 p-3.5 text-[14px] leading-snug text-mute">{q.explain}</p>}
                  <Tap onClick={next} className="mt-3.5 h-12 w-full rounded-[18px] bg-inverse font-display text-[13.5px] font-semibold text-on-inverse">
                    {step === quiz.length - 1 ? 'Готово' : 'Дальше'}
                  </Tap>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
