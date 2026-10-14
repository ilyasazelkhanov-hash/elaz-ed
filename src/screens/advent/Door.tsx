import { Check, ChevronLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { KIND_LABEL } from '../../lib/advent'
import { api, ApiError, errorText } from '../../lib/api'
import { GRADIENTS, type Gradient } from '../../lib/game'
import { sfx } from '../../lib/sfx'
import { haptic, inTelegram } from '../../lib/tg'
import type { DoorKind, DoorResult, DoorView } from '../../lib/types'
import { Markdown } from '../../Markdown'
import { useStore } from '../../store'
import { burst, celebrate, Cta, Emoji, Pattern, Spinner, Tap } from '../../ui'
import { Arcade } from './Arcade'
import { slide } from './Advent'
import { Scratch } from './Scratch'
import { themeOf, ThemeScene } from './themes'
import { PromoCode, RewardBody } from './Catchup'

const LOOK: Record<DoorKind, { g: Gradient; name: 'candy' | 'aurora' | 'sunset' | 'mint' }> = {
  quiz: { g: GRADIENTS.aurora, name: 'aurora' },
  scratch: { g: GRADIENTS.candy, name: 'candy' },
  arcade: { g: GRADIENTS.sunset, name: 'sunset' },
  story: { g: GRADIENTS.mint, name: 'mint' },
}

type Input = { answers?: number[]; score?: number }

/** Дверь календаря. Что внутри и сколько XP — решает сервер; экран только показывает и собирает ответы. */
export function DoorScreen({ day }: { day: number }) {
  const { pop, guard, toast, setMe } = useStore.getState()
  const themeId = useStore((s) => s.advent?.theme)
  const [door, setDoor] = useState<DoorView | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [result, setResult] = useState<DoorResult | null>(null)
  const [busy, setBusy] = useState(false)
  // Аркада: «играть» — раунд идёт; practice — повторный раунд после открытия, без XP.
  const [playing, setPlaying] = useState<false | 'real' | 'practice'>(false)
  const [practiceScore, setPracticeScore] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    api
      .adventDoor(day)
      .then((d) => alive && setDoor(d))
      .catch((e) => {
        guard(e)
        if (alive) setFailed(errorText(e))
      })
    return () => {
      alive = false
    }
  }, [day, guard])

  const open = async (input?: Input) => {
    if (busy) return null
    setBusy(true)
    try {
      const r = await api.adventOpen(day, input)
      setDoor(r.door)
      setMe(r.me)
      if (!r.already) {
        setResult(r)
        if (r.new_codes.length) {
          celebrate()
          sfx.levelUp()
        } else {
          sfx.coin()
        }
        haptic.success()
      }
      return r
    } catch (e) {
      guard(e)
      toast(errorText(e))
      if (e instanceof ApiError && (e.code === 'advent_closed' || e.code === 'door_locked' || e.code === 'need_ticket')) pop()
      return null
    } finally {
      setBusy(false)
    }
  }

  const look = LOOK[door?.kind ?? 'quiz']
  // В тематическом календаре шапка двери — та же сцена; в стандартном — цвет по типу двери.
  const theme = themeOf(themeId)
  const themed = theme.id !== 'standard'
  return (
    <motion.div {...slide} className={`absolute inset-0 z-[32] bg-bg ${theme.className}`}>
      <div className="scroll h-full" style={{ paddingBottom: 'calc(48px + var(--bottom))' }}>
        <div className={`relative overflow-hidden px-5 text-center ${themed ? 'pb-16' : 'pb-12'}`} style={{ background: themed ? theme.hero : look.g.css, color: themed ? theme.ink : look.g.ink, paddingTop: 'calc(var(--top) + 54px)' }}>
          {themed ? <ThemeScene theme={theme.id} /> : <Pattern name={look.name} full />}
          <div className="relative">
            <p className="mx-auto w-fit rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
              Дверь №{day}
              {door ? ` · ${KIND_LABEL[door.kind]}` : ''}
            </p>
            <motion.div className="mx-auto mt-4 w-fit" initial={{ scale: 0.4, rotate: -14 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 13 }}>
              <Emoji char={door?.emoji ?? '🎁'} size={104} animated />
            </motion.div>
            <h1 className="mt-3 font-display text-[25px] font-semibold leading-tight">{door?.title ?? ' '}</h1>
            {door?.subtitle && <p className="mt-1.5 text-[15px] font-medium opacity-85">{door.subtitle}</p>}
            {door && !door.opened && (
              <p className="mx-auto mt-3 w-fit rounded-full bg-black/15 px-3 py-1 text-[12.5px] font-semibold">
                {door.late ? 'Догоняешь за билет: XP вполовину, серия не растёт' : `+${door.xp} XP${door.kind === 'quiz' ? ' и по 10 за верный ответ' : door.kind === 'arcade' ? ' и бонус за счёт' : ''}`}
              </p>
            )}
          </div>
        </div>

        <div className="relative -mt-7 rounded-t-[30px] bg-bg px-5 pt-6">
          {failed && <p className="py-10 text-center text-[15px] text-mute">{failed}</p>}
          {!door && !failed && (
            <div className="grid h-40 place-items-center text-mute">
              <Spinner />
            </div>
          )}

          <AnimatePresence>{result && <ResultCard key="result" result={result} />}</AnimatePresence>

          {door?.kind === 'quiz' && (door.opened ? <QuizReview door={door} /> : <QuizForm door={door} busy={busy} onSubmit={(answers) => open({ answers })} />)}

          {/* Уже открытую раньше дверь не заставляем стирать заново — сразу показываем приз. */}
          {door?.kind === 'scratch' &&
            (door.opened && !result ? (
              <div className="rounded-[24px] border border-line bg-card p-6 text-center">
                <p className="selectable font-display text-[17px] font-semibold leading-snug">{door.prize}</p>
              </div>
            ) : (
              <Scratch prize={door.prize} onStart={() => void open()} onRevealed={() => burst(document.getElementById('door-body'))} />
            ))}

          {door?.kind === 'story' && !door.opened && (
            <Cta className="w-full" busy={busy} onClick={() => open()}>
              Открыть дверь
            </Cta>
          )}

          {door?.kind === 'arcade' && door.arcade && (
            <>
              {playing ? (
                <Arcade
                  key={playing}
                  seconds={door.arcade.seconds}
                  onEnd={(score) => {
                    setPlaying(false)
                    if (playing === 'real') void open({ score })
                    else setPracticeScore(score)
                  }}
                />
              ) : (
                <div className="rounded-[24px] border border-line bg-card p-5 text-center">
                  {door.opened ? (
                    <>
                      <p className="font-display text-[19px] font-semibold">Твой счёт: {door.opened.score}</p>
                      <p className="mt-1 text-[14px] text-mute">
                        Засчитано до {door.arcade.cap} очков.{practiceScore != null ? ` Тренировка: ${practiceScore}.` : ''}
                      </p>
                      <Tap onClick={() => setPlaying('practice')} className="mt-4 h-12 w-full rounded-[18px] border border-line bg-card2 font-display text-[14px] font-semibold">
                        Сыграть ещё — без XP
                      </Tap>
                    </>
                  ) : busy ? (
                    <Spinner />
                  ) : (
                    <>
                      <p className="text-[15px] leading-snug text-mute">Раунд {door.arcade.seconds} секунд. Засчитывается первая попытка.</p>
                      <Cta className="mt-4 w-full" onClick={() => setPlaying('real')}>
                        Играть
                      </Cta>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {door?.body && (
            <div id="door-body" className="mt-6">
              <Markdown text={door.body} />
            </div>
          )}
        </div>
      </div>

      {!inTelegram && (
        <Tap onClick={pop} aria-label="Назад" className="absolute left-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md" style={{ top: 'calc(var(--top) + 10px)' }}>
          <ChevronLeft size={22} />
        </Tap>
      )}
    </motion.div>
  )
}

/** Итог открытия: XP и, если перешёл ступень, коды наград. */
function ResultCard({ result }: { result: DoorResult }) {
  return (
    <motion.div initial={{ opacity: 0, y: -10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="mb-5 rounded-[24px] border border-mint/30 bg-mint/10 p-4">
      <div className="flex items-center gap-3">
        <Emoji char="⚡" size={30} />
        <div className="flex-1">
          <p className="font-display text-[18px] font-semibold">+{result.gained} XP</p>
          <p className="text-[13px] text-mute">
            {result.total > 0 ? `Счёт ${result.score} из ${result.total}. ` : ''}
            {result.opened ? `Открыто дверей: ${result.opened}` : ''}
          </p>
        </div>
      </div>
      {result.new_codes.map((c) => (
        <div key={c.reward_id} className="mt-3 rounded-[18px] border border-violet/40 bg-violet/10 p-3.5">
          <p className="flex items-center gap-2 text-[14px] font-semibold">
            <Emoji char={c.emoji} size={20} /> {c.mode === 'instant' ? 'Повезло! Выпал приз' : c.mode === 'day' ? 'Подарок дня' : 'Награда'}: {c.title}
          </p>
          {c.code ? (
            <>
              <PromoCode code={c.code} />
              <p className="mt-2 text-[12.5px] text-mute">Покажи код на кассе. Он есть в календаре и в чате с ботом.</p>
            </>
          ) : (
            <RewardBody kind={c.kind ?? 'message'} content={c.content} />
          )}
        </div>
      ))}
    </motion.div>
  )
}

/** Квиз двери: ответы копятся здесь и уходят на сервер целиком — правильных вариантов у клиента нет. */
function QuizForm({ door, busy, onSubmit }: { door: DoorView; busy: boolean; onSubmit: (answers: number[]) => void }) {
  const [answers, setAnswers] = useState<number[]>([])
  const [step, setStep] = useState(0)
  const q = door.quiz[step]
  const last = step === door.quiz.length - 1
  if (!q) return null
  const pick = (i: number) => {
    haptic.select()
    const next = [...answers]
    next[step] = i
    setAnswers(next)
  }
  return (
    <div className="rounded-[26px] border border-line bg-card p-4">
      <div className="flex gap-1.5">
        {door.quiz.map((_, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < step || answers[i] !== undefined ? 'var(--color-violet)' : 'var(--track)' }} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }} className="mt-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">
            Вопрос {step + 1} из {door.quiz.length}
          </p>
          <p className="selectable mt-1.5 text-[17px] font-semibold leading-snug">{q.q}</p>
          <div className="mt-4 space-y-2">
            {q.options.map((opt, i) => {
              const on = answers[step] === i
              return (
                <Tap
                  key={i}
                  feedback="none"
                  onClick={() => pick(i)}
                  className={`flex w-full items-center gap-3 rounded-[18px] border p-3.5 text-left text-[15px] font-medium ${on ? 'border-violet/60 bg-violet/15' : 'border-line bg-card2'}`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-[11px] font-bold ${on ? 'bg-violet text-white' : 'bg-veil/8 text-mute'}`}>{'АБВГ'[i]}</span>
                  <span className="flex-1">{opt}</span>
                </Tap>
              )
            })}
          </div>
        </motion.div>
      </AnimatePresence>
      <Cta
        className="mt-4 w-full"
        busy={busy}
        disabled={answers[step] === undefined}
        onClick={() => (last ? onSubmit(door.quiz.map((_, i) => answers[i] ?? -1)) : setStep(step + 1))}
      >
        {last ? 'Открыть дверь' : 'Дальше'}
      </Cta>
    </div>
  )
}

/** Разбор после открытия: правильные ответы и пояснения пришли с сервера. */
function QuizReview({ door }: { door: DoorView }) {
  return (
    <div className="space-y-2.5">
      {door.opened && (
        <p className="font-display text-[17px] font-semibold">
          Верно {door.opened.score} из {door.opened.total}
        </p>
      )}
      {door.quiz.map((q, i) => (
        <div key={i} className="rounded-[20px] border border-line bg-card p-4">
          <p className="text-[15px] font-semibold leading-snug">{q.q}</p>
          <p className="mt-2 flex items-start gap-2 text-[14px] text-mint">
            <Check size={16} strokeWidth={3} className="mt-0.5 shrink-0" />
            {q.correct != null ? q.options[q.correct] : '—'}
          </p>
          {q.explain && <p className="mt-2 text-[13.5px] leading-snug text-mute">{q.explain}</p>}
        </div>
      ))}
    </div>
  )
}
