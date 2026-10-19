import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Coffee,
  Gem,
  Gift,
  Heart,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Ticket,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { usePlatform } from '../platform/store.ts'
import { Art, Button, Empty, Meter, PageHeader, Scene } from '../components/ui.tsx'
import type { QuizQuestion } from '../platform/contracts.ts'
import { useBrand } from '../platform/brand-context.ts'
import { scratchCoverage, wheelSector, wheelStop } from '../platform/game-geometry.ts'

export function Quiz({ id }: { id: string }) {
  const { snapshot: s, act, back, celebrate } = usePlatform(),
    [attemptId, setAttempt] = useState(''),
    [questions, setQuestions] = useState<QuizQuestion[]>([]),
    [index, setIndex] = useState(0),
    [picked, setPicked] = useState<number | null>(null),
    [correct, setCorrect] = useState<number | null>(null),
    [explain, setExplain] = useState(''),
    [score, setScore] = useState(0),
    [done, setDone] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void act('quiz.start', { entityId: id }).then(async (result) => {
      if (!active) return
      if (result) {
        setAttempt(String(result.attemptId))
        setQuestions(result.questions as unknown as QuizQuestion[])
        const answers = (result.answers ?? []) as number[]
        const total = (result.questions as unknown[]).length
        setIndex(Math.min(answers.length, Math.max(0, total - 1)))
        setScore(Number(result.score ?? 0))
        if (answers.length === total && total > 0) {
          setPicked(answers[total - 1])
          setDone(true)
          const feedback = await act('quiz.answer', {
            attemptId: result.attemptId,
            index: total - 1,
            answer: answers[total - 1],
          })
          if (active && feedback) {
            setCorrect(Number(feedback.correctIndex))
            setExplain(String(feedback.explain ?? ''))
          }
        }
      } else setError('Не удалось начать квиз. Попробуйте ещё раз.')
    })
    return () => {
      active = false
    }
  }, [id])
  const e = s?.entities.find((v) => v.id === id),
    q = questions[index]
  const answer = async (option: number) => {
    if (picked !== null) return
    setPicked(option)
    const r = await act('quiz.answer', { attemptId, index, answer: option })
    if (!r) {
      setPicked(null)
      return
    }
    setPicked(Number(r.answer ?? option))
    setCorrect(Number(r.correctIndex))
    setExplain(String(r.explain ?? ''))
    setScore(Number(r.score))
    if (r.done) setDone(true)
  }
  return (
    <>
      <PageHeader title="Минута для нового" subtitle={e?.title} />
      <div className="az-game-page az-quiz-page">
        {error ? (
          <Empty title={error} body="Вернитесь к заданию и откройте его снова." />
        ) : !q ? (
          <div className="az-loading-small">
            Готовим хороший вопрос<span>✳</span>
          </div>
        ) : (
          <>
            <div className="az-game-meta">
              <span>
                ВОПРОС {String(index + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
              </span>
              <span>
                <Zap size={14} /> Знания в копилку
              </span>
            </div>
            <Meter value={index + Number(picked !== null)} max={questions.length} />
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="az-question"
              >
                <span className="az-question-symbol">✳</span>
                <h2>{q.question}</h2>
                <div className="az-answers">
                  {q.options.map((option, i) => (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      key={option}
                      disabled={picked !== null}
                      className={correct === i ? 'is-correct' : picked === i ? 'is-wrong' : ''}
                      onClick={() => void answer(i)}
                    >
                      <span>{String.fromCharCode(65 + i)}</span>
                      {option}
                      {correct === i && <Check size={20} />}
                    </motion.button>
                  ))}
                </div>
                {picked !== null && correct !== null && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="az-explanation">
                    <strong>{picked === correct ? 'Хорошая интуиция!' : 'Теперь вы знаете чуть больше.'}</strong>
                    <p>{explain}</p>
                    <Button
                      onClick={() => {
                        if (done) {
                          celebrate(`Новая идея в копилке · ${score} из ${questions.length}`)
                          back()
                        } else {
                          setIndex(index + 1)
                          setPicked(null)
                          setCorrect(null)
                          setExplain('')
                        }
                      }}
                    >
                      {done ? 'Забрать результат' : 'Следующий вопрос'}
                      <ArrowRight size={17} />
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
    </>
  )
}
export function Game({ id }: { id: string }) {
  const resultRef = useRef<HTMLDivElement>(null),
    brand = useBrand()
  const { snapshot: s, act, celebrate, back } = usePlatform(),
    [sessionId, setSession] = useState(''),
    [outcome, setOutcome] = useState(''),
    [finished, setFinished] = useState(false),
    [score, setScore] = useState(0),
    [error, setError] = useState(''),
    [wait, setWait] = useState(0)
  const e = s?.entities.find((v) => v.id === id),
    kind = String(e?.data.game ?? 'scratch')
  useEffect(() => {
    if (finished && kind !== 'scratch')
      resultRef.current?.scrollIntoView({
        block: 'nearest',
        behavior:
          brand.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      })
  }, [finished, kind, brand.motion])
  useEffect(() => {
    let active = true
    void act('game.start', { entityId: id, campaignId: String(e?.data.campaignId ?? ''), game: kind }).then((r) => {
      if (r && active) {
        setSession(String(r.sessionId))
        setWait(Number(r.minSeconds ?? 0))
        setOutcome(typeof r.outcome === 'number' ? `+${r.outcome} баллов` : String(r.outcome ?? 'Хороший момент — ваш'))
      } else if (active) setError('Не удалось открыть игру. Вернитесь к заданию и попробуйте ещё раз.')
    })
    return () => {
      active = false
    }
  }, [id])
  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((v) => Math.max(0, v - 1)), 1000)
    return () => clearTimeout(timer)
  }, [wait])
  const finish = async () => {
    const r = await act('campaign.open', {
      entityId: id,
      campaignId: String(e?.data.campaignId ?? ''),
      day: Number(e?.data.day ?? 1),
      game: kind,
      sessionId,
      score,
    })
    if (r) {
      celebrate(
        Number(r.gainedXp ?? 0) > 0
          ? `Ваш момент · +${r.gainedXp} XP и +${r.gainedPoints} баллов`
          : 'Ещё один хороший момент',
      )
      back()
    }
  }
  return (
    <>
      <PageHeader title={e?.title ?? 'Игра'} subtitle={e?.subtitle} />
      <div className={`az-game-page az-game-${kind}`}>
        <div className="az-game-meta">
          <span>Игра дня</span>
          <span>
            <Zap size={14} /> XP за участие
          </span>
        </div>
        {error ? (
          <Empty title="Игра пока недоступна" body={error} />
        ) : !sessionId ? (
          <div className="az-loading-small">
            Готовим ваше открытие<span>✳</span>
          </div>
        ) : (
          <>
            {kind === 'scratch' ? (
              <Scratch outcome={outcome} onFinish={() => setFinished(true)} />
            ) : kind === 'wheel' ? (
              <Wheel outcome={outcome} onFinish={() => setFinished(true)} />
            ) : kind === 'memory' ? (
              <Memory
                onFinish={(n) => {
                  setScore(n)
                  setFinished(true)
                }}
              />
            ) : kind === 'reaction' ? (
              <Reaction
                onFinish={(n) => {
                  setScore(n)
                  setFinished(true)
                }}
              />
            ) : (
              <Arcade
                onFinish={(n) => {
                  setScore(n)
                  setFinished(true)
                }}
              />
            )}
            <AnimatePresence>
              {finished && (
                <motion.div
                  ref={resultRef}
                  className="az-game-result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="az-eyebrow">ВАШ РЕЗУЛЬТАТ</span>
                  <h2>
                    {kind === 'reaction'
                      ? `${score} мс. Впечатляет!`
                      : kind === 'memory'
                        ? 'Вы нашли все пары!'
                        : kind === 'arcade'
                          ? `${score} искр в копилке!`
                          : outcome}
                  </h2>
                  <Button tone="dark" disabled={wait > 0} onClick={() => void finish()}>
                    {wait > 0 ? `Фиксируем результат · ${wait} c` : 'Забрать результат'}
                    <Sparkles size={17} />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </>
  )
}
function Scratch({ outcome, onFinish }: { outcome: string; onFinish: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    last = useRef<{ x: number; y: number } | null>(null),
    cells = useRef(new Set<number>()),
    [done, setDone] = useState(false),
    [coverage, setCoverage] = useState(0)
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    c.width = 640
    c.height = 560
    const gradient = ctx.createLinearGradient(0, 0, 640, 560)
    gradient.addColorStop(0, '#b5c9fa')
    gradient.addColorStop(0.38, '#e6ecfa')
    gradient.addColorStop(0.5, '#8799c9')
    gradient.addColorStop(0.72, '#f1f5ff')
    gradient.addColorStop(1, '#8ca0dc')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 640, 560)
    ctx.fillStyle = getComputedStyle(c).getPropertyValue('--az-primary').trim()
    ctx.textAlign = 'center'
    ctx.lineWidth = 7
    ctx.strokeStyle = ctx.fillStyle
    ctx.strokeRect(260, 225, 120, 100)
    ctx.strokeRect(248, 205, 144, 28)
    ctx.beginPath()
    ctx.moveTo(320, 205)
    ctx.lineTo(320, 325)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(297, 189, 25, 14, 0.5, 0, Math.PI * 2)
    ctx.ellipse(343, 189, 25, 14, -0.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.font = 'bold 26px sans-serif'
    ctx.fillText('СОТРИТЕ СЛОЙ', 320, 385)
    ctx.font = '20px sans-serif'
    ctx.fillText('Проведите пальцем по карточке', 320, 425)
  }, [])
  const move = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    if (!last.current || done) return
    const c = ev.currentTarget,
      r = c.getBoundingClientRect(),
      x = ((ev.clientX - r.left) / r.width) * c.width,
      y = ((ev.clientY - r.top) / r.height) * c.height,
      ctx = c.getContext('2d')!
    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineWidth = 75
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(x, y)
    ctx.stroke()
    const from = last.current,
      steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / 15))
    let next = coverage
    for (let i = 0; i <= steps; i++)
      next = scratchCoverage(
        cells.current,
        (from.x + ((x - from.x) * i) / steps) / c.width,
        (from.y + ((y - from.y) * i) / steps) / c.height,
      )
    setCoverage(next)
    last.current = { x, y }
    if (next >= 0.43) {
      setDone(true)
      onFinish()
    }
  }
  return (
    <div className="az-scratch-wrap">
      <div className="az-scratch">
        <div className="az-scratch-prize">
          <Gift size={49} strokeWidth={1.4} />
          <h2>{outcome}</h2>
          <p>Ваш бонус на сегодня</p>
        </div>
        <canvas
          className={done ? 'is-scratched' : ''}
          ref={canvas}
          aria-label="Сотрите защитный слой"
          onPointerDown={(ev) => {
            const r = ev.currentTarget.getBoundingClientRect()
            last.current = {
              x: ((ev.clientX - r.left) / r.width) * ev.currentTarget.width,
              y: ((ev.clientY - r.top) / r.height) * ev.currentTarget.height,
            }
            ev.currentTarget.setPointerCapture(ev.pointerId)
          }}
          onPointerMove={move}
          onPointerUp={() => (last.current = null)}
          onPointerCancel={() => (last.current = null)}
        />
      </div>
      <p className="az-game-instruction" aria-live="polite">
        {done
          ? 'Готово! Заберите результат ниже.'
          : `Открыто ${Math.min(100, Math.round((coverage / 0.43) * 100))}% · стирайте в разных местах`}
      </p>
      {!done && (
        <Button
          tone="soft"
          onClick={() => {
            setDone(true)
            onFinish()
          }}
        >
          Открыть без жеста
          <ArrowRight size={16} />
        </Button>
      )}
    </div>
  )
}
function Wheel({ outcome, onFinish }: { outcome: string; onFinish: () => void }) {
  const brand = useBrand(),
    reduced = useReducedMotion(),
    stop = wheelStop(outcome)
  const [spin, setSpin] = useState(false),
    [done, setDone] = useState(false)
  const completed = useRef(false)
  const icons = [Gift, Zap, Gem, Trophy, Coffee, Ticket, Heart, Target]
  const fills = ['var(--az-primary)', 'var(--az-accent)', 'var(--az-lilac)', 'var(--az-peach)']
  return (
    <div className="az-wheel-wrap">
      <div className="az-wheel-stage" data-winning-sector={done ? stop.index : undefined}>
        <span className="az-wheel-pointer" aria-hidden="true">
          <svg viewBox="0 0 30 41">
            <path
              d="M4 4Q15 -2 26 4L20 25L15 38L10 25Z"
              fill="currentColor"
              stroke="var(--az-surface)"
              strokeWidth="3"
            />
          </svg>
        </span>
        <motion.svg
          className="az-wheel"
          viewBox="0 0 320 320"
          role="img"
          aria-label={done ? `Колесо остановилось: ${outcome}` : 'Колесо бонусов: восемь секторов'}
          animate={{ rotate: spin ? stop.rotation : 0 }}
          transition={{ duration: reduced || brand.motion === 'reduced' ? 0.2 : 4.6, ease: [0.12, 0.78, 0.14, 1] }}
          onAnimationComplete={() => {
            if (spin && !completed.current) {
              completed.current = true
              setDone(true)
              onFinish()
            }
          }}
        >
          {icons.map((Icon, i) => {
            const sector = wheelSector(i),
              ink = i % 4 === 0 ? 'var(--az-on-primary)' : '#17213a'
            return (
              <g key={i}>
                <path d={sector.path} fill={fills[i % 4]} className="az-wheel-sector" />
                <g transform={`translate(${sector.x} ${sector.y}) rotate(${i * 45})`} color={ink}>
                  <Icon x={-13} y={-20} size={26} strokeWidth={1.6} />
                  <text y={24} fill={ink} className="az-wheel-label">
                    {String(i + 1).padStart(2, '0')}
                  </text>
                </g>
              </g>
            )
          })}
          <circle cx="160" cy="160" r="147" fill="none" stroke="var(--az-line)" strokeWidth="2" />
        </motion.svg>
        <div className="az-wheel-hub">
          <img src={brand.monogram} alt="" />
        </div>
      </div>
      <p aria-live="polite">
        {done
          ? `Сектор ${String(stop.index + 1).padStart(2, '0')} · ${outcome}`
          : spin
            ? 'Колесо вращается…'
            : 'Нажмите на кнопку. Ваш бонус откроется после остановки.'}
      </p>
      <Button tone="dark" disabled={spin} onClick={() => setSpin(true)}>
        {done ? 'Бонус открыт' : spin ? 'Вращаем…' : 'Крутить колесо'}
        <RotateCcw size={17} />
      </Button>
    </div>
  )
}
function Memory({ onFinish }: { onFinish: (score: number) => void }) {
  const brand = useBrand()
  const symbols = [Gift, Coffee, Heart, Gem, Ticket, Zap]
  const [cards] = useState(() =>
      ['✳', '✦', '✷', '◈', '✧', '◉']
        .flatMap((v) => [v, v])
        .map((v, i) => ({ v, n: crypto.getRandomValues(new Uint32Array(1))[0], i }))
        .sort((a, b) => a.n - b.n)
        .map((v) => v.v),
    ),
    [open, setOpen] = useState<number[]>([]),
    [matched, setMatched] = useState<number[]>([]),
    [moves, setMoves] = useState(0)
  useEffect(() => {
    if (open.length !== 2) return
    const timer = setTimeout(() => {
      if (cards[open[0]] === cards[open[1]]) {
        const next = [...matched, ...open]
        setMatched(next)
        if (next.length === cards.length) onFinish(moves)
      }
      setOpen([])
    }, 650)
    return () => clearTimeout(timer)
  }, [open])
  return (
    <div className="az-memory-wrap">
      <p>Откройте две карточки. Совпали? Пара остаётся с вами.</p>
      <div className="az-memory">
        {cards.map((v, i) => {
          const shown = open.includes(i) || matched.includes(i)
          const Icon = symbols[['✳', '✦', '✷', '◈', '✧', '◉'].indexOf(v)]
          return (
            <motion.button
              key={i}
              className={matched.includes(i) ? 'is-matched' : shown ? 'is-shown' : ''}
              aria-label={
                shown
                  ? ['Подарок', 'Кофе', 'Сердце', 'Кристалл', 'Билет', 'Молния'][
                      ['✳', '✦', '✷', '◈', '✧', '◉'].indexOf(v)
                    ]
                  : `Открыть карточку ${i + 1}`
              }
              aria-pressed={shown}
              data-card-symbol={shown ? v : undefined}
              animate={{
                rotateY: shown ? 180 : 0,
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={() => {
                if (open.length >= 2 || shown) return
                setOpen([...open, i])
                setMoves(moves + 1)
              }}
            >
              <span className="az-memory-back" aria-hidden="true">
                <img src={brand.monogram} alt="" />
              </span>
              <span className="az-memory-front" aria-hidden="true">
                <Icon size={32} strokeWidth={1.6} />
                {matched.includes(i) && <Check size={13} style={{ position: 'absolute', right: 8, bottom: 8 }} />}
              </span>
            </motion.button>
          )
        })}
      </div>
      <span className="az-eyebrow">
        {matched.length / 2} / 6 ПАР · {Math.ceil(moves / 2)} ХОДОВ
      </span>
    </div>
  )
}
function Reaction({ onFinish }: { onFinish: (score: number) => void }) {
  const [phase, setPhase] = useState<'start' | 'wait' | 'ready' | 'early' | 'done'>('start'),
    ready = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const start = () => {
    setPhase('wait')
    timer.current = setTimeout(
      () => {
        ready.current = performance.now()
        setPhase('ready')
      },
      1500 + Math.random() * 2000,
    )
  }
  const tap = () => {
    if (phase === 'start' || phase === 'early') start()
    else if (phase === 'wait') {
      clearTimeout(timer.current)
      setPhase('early')
    } else if (phase === 'ready') {
      setPhase('done')
      onFinish(Math.round(performance.now() - ready.current))
    }
  }
  return (
    <div className="az-reaction-wrap">
      <button
        className={`az-reaction az-reaction-${phase}`}
        onPointerDown={(e) => {
          if (e.button === 0) tap()
        }}
        onClick={(e) => {
          if (e.detail === 0) tap()
        }}
      >
        <span className="az-reaction-lights" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <h2>
          {phase === 'start'
            ? 'Проверьте реакцию'
            : phase === 'wait'
              ? 'Чуть-чуть терпения…'
              : phase === 'ready'
                ? 'Сейчас!'
                : phase === 'early'
                  ? 'Рано! Попробуем ещё?'
                  : 'Готово!'}
        </h2>
        <p>
          {phase === 'start'
            ? 'Коснитесь, чтобы начать'
            : phase === 'wait'
              ? 'Дождитесь зелёного сигнала'
              : phase === 'ready'
                ? 'Коснитесь скорее'
                : phase === 'early'
                  ? 'Дождитесь смены цвета'
                  : ''}
        </p>
      </button>
    </div>
  )
}
function Arcade({ onFinish }: { onFinish: (score: number) => void }) {
  const [started, setStarted] = useState(false),
    [seconds, setSeconds] = useState(10),
    [score, setScore] = useState(0),
    [spot, setSpot] = useState(0)
  const scoreRef = useRef(0)
  useEffect(() => {
    if (!started) return
    const timer = setInterval(() => setSeconds((n) => Math.max(0, n - 1)), 1000)
    return () => clearInterval(timer)
  }, [started])
  useEffect(() => {
    if (started && seconds === 0) onFinish(scoreRef.current)
  }, [seconds])
  return (
    <div className="az-arcade-wrap">
      <div className="az-arcade-score">
        <strong>
          {score}
          <small>ИСКРЫ</small>
        </strong>
        <strong>
          {seconds}
          <small>СЕКУНД</small>
        </strong>
      </div>
      {!started ? (
        <div className="az-arcade-intro">
          <Scene variant="gift" />
          <h2>Ловите бонусы</h2>
          <p>Нажимайте на подсвеченную ячейку. У вас 10 секунд.</p>
          <Button onClick={() => setStarted(true)}>
            Поехали
            <Play size={17} />
          </Button>
        </div>
      ) : (
        <div className="az-arcade-field">
          {Array.from({ length: 9 }, (_, i) => (
            <button
              aria-label={i === spot ? 'Поймать искру' : `Ячейка ${i + 1}`}
              key={i}
              className={i === spot && seconds > 0 ? 'is-target' : ''}
              disabled={seconds === 0}
              onClick={() => {
                if (i !== spot) return
                scoreRef.current++
                setScore(scoreRef.current)
                setSpot((spot + 1 + Math.floor(Math.random() * 8)) % 9)
              }}
            >
              {i === spot && seconds > 0 && (
                <motion.span key={score} initial={{ scale: 0.3, rotate: -45 }} animate={{ scale: 1, rotate: 0 }}>
                  <Zap size={37} fill="currentColor" strokeWidth={1.2} />
                </motion.span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
export function Story({ id }: { id: string }) {
  const brand = useBrand(),
    touch = useRef(0)
  const { snapshot: s, act, back } = usePlatform(),
    [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false)
  const e = s?.entities.find((v) => v.id === id),
    slides = (e?.data.slides ?? []) as { title: string; body: string; art: string }[]
  const next = () => {
    if (index < slides.length - 1) setIndex(index + 1)
    else {
      void act('content.complete', { entityId: id })
      back()
    }
  }
  useEffect(() => {
    if (paused) return
    const timer = setTimeout(next, 8000)
    return () => clearTimeout(timer)
  }, [index, paused])
  const slide = slides[index]
  if (!slide) return <Empty title="История готовится" body="Загляните чуть позже." />
  return (
    <div
      className={`az-story-screen az-story-screen-${index % 3}`}
      onTouchStart={(e) => {
        touch.current = e.touches[0].clientX
        setPaused(true)
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touch.current
        if (dx < -50) next()
        else if (dx > 50) setIndex((i) => Math.max(0, i - 1))
        setPaused(false)
      }}
    >
      <div className="az-story-progress">
        {slides.map((_, i) => (
          <span key={i}>
            <motion.i
              key={`${i}-${index}`}
              initial={{ width: i < index ? '100%' : '0%' }}
              animate={{ width: i <= index ? '100%' : '0%' }}
              transition={{ duration: i === index && !paused ? 8 : 0, ease: 'linear' }}
            />
          </span>
        ))}
      </div>
      <div className="az-story-header">
        <span>{brand.name.toUpperCase()} STORIES</span>
        <button aria-label="Пауза истории" onClick={() => setPaused(!paused)}>
          {paused ? '▶' : 'Ⅱ'}
        </button>
        <button aria-label="Закрыть историю" onClick={back}>
          <X size={24} />
        </button>
      </div>
      <div className="az-story-visual">
        <Scene variant={slide.art === 'gift' ? 'gift' : 'orbit'} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          className="az-story-text"
          key={index}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <span className="az-eyebrow">ВАША НОВАЯ ГЛАВА / {index + 1}</span>
          <h1>{slide.title}</h1>
          <p>{slide.body}</p>
        </motion.div>
      </AnimatePresence>
      <div className="az-story-controls">
        <button aria-label="Предыдущий слайд" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          <ArrowLeft size={22} />
        </button>
        <Button tone="lime" onClick={next}>
          {index === slides.length - 1 ? 'Начать свою историю' : 'Дальше'}
          <ArrowRight size={18} />
        </Button>
      </div>
    </div>
  )
}
