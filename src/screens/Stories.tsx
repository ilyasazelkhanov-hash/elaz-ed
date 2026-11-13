import { activeStories, storySlideDuration } from '../lib/highlights'
import { useStoryPlayback } from '../lib/use-story-playback'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { GRADIENTS, slidesOf } from '../lib/game'
import { sfx } from '../lib/sfx'
import { haptic } from '../lib/tg'
import { track } from '../lib/track'
import { Markdown } from '../Markdown'
import { useStore } from '../store'
import { Emoji, Pattern, Tap } from '../ui'

const HOLD_MS = 190

export function Stories({ startId }: { startId: number }) {
  // Список фиксируем на момент открытия, чтобы отметки «пройдено» не тасовали сторис под пальцем.
  const stories = useMemo(() => activeStories(useStore.getState().feed), [])
  const pop = useStore((s) => s.pop)
  const [si, setSi] = useState(() => stories.findIndex((s) => s.id === startId))
  const [pi, setPi] = useState(0)
  const story = stories[si]
  const slides = useMemo(() => slidesOf(story?.body ?? ''), [story])
  const dragControls = useDragControls()
  const contentRef = useRef<HTMLDivElement>(null)
  const downAt = useRef(0)
  const rewarded = useRef(new Set<number>())

  const finish = useCallback((id: number) => {
    const { feed, setMe, patchCard, toast, markSeen, guard } = useStore.getState()
    markSeen(id)
    if (rewarded.current.has(id) || feed.find((c) => c.id === id)?.completed) return
    rewarded.current.add(id)
    api
      .complete(id, [])
      .then((res) => {
        setMe(res.me)
        patchCard(id, { completed: true })
        if (res.gained > 0) {
          sfx.pop()
          toast(`+${res.gained} XP`, '⚡')
        }
      })
      .catch(guard)
  }, [])

  const next = useCallback(() => {
    if (!story) return
    if (pi < slides.length - 1) return setPi(pi + 1)
    finish(story.id)
    if (si < stories.length - 1) {
      setSi(si + 1)
      setPi(0)
    } else {
      pop()
    }
  }, [story, pi, slides.length, si, stories.length, finish, pop])

  const { progress, paused, setPaused, setHolding, restart } = useStoryPlayback(`${si}:${pi}`, storySlideDuration(slides[pi] ?? ''), next, !!story)
  const width = `${progress * 100}%`

  const prev = () => {
    if (pi > 0) return setPi(pi - 1)
    if (si > 0) {
      setSi(si - 1)
      setPi(0)
    } else {
      restart()
    }
  }

  useEffect(() => {
    if (!story) return
    useStore.getState().markSeen(story.id)
    track('story_open', undefined, story.id)
  }, [story])

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [si, pi])

  if (!story) return <section className="absolute inset-0 z-40 grid place-content-center gap-4 bg-bg p-6 text-center" aria-label="История недоступна"><h2 className="text-xl font-semibold">Эта история больше не доступна</h2><p className="text-mute">Условия могли измениться. Вернись к актуальной подборке.</p><Tap onClick={pop} className="min-h-11 rounded-xl bg-violet px-4 text-on-violet">Закрыть</Tap></section>
  const g = GRADIENTS[story.gradient] ?? GRADIENTS.aurora

  return (
    <motion.div
      className="absolute inset-0 z-40 overflow-hidden"
      style={{ background: g.css, color: g.ink }}
      initial={{ opacity: 0, scale: 0.9, borderRadius: 40 }}
      animate={{ opacity: 1, scale: 1, borderRadius: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 80 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 110 || info.velocity.y > 600) pop()
      }}
    >
      <Pattern name={story.gradient} full />

      <div
        className="absolute inset-0"
        style={{ touchAction: 'pan-y', WebkitTouchCallout: 'none' }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          dragControls.start(e)
          downAt.current = performance.now()
          setHolding(true)
        }}
        onPointerCancel={() => (setHolding(false))}
        onPointerUp={(e) => {
          setHolding(false)
          if (performance.now() - downAt.current > HOLD_MS) return
          haptic.select()
          const r = e.currentTarget.getBoundingClientRect()
          if ((e.clientX - r.left) / r.width < 0.3) prev()
          else next()
        }}
      />

      <div className="pointer-events-none relative flex h-full flex-col px-5" style={{ paddingTop: 'calc(var(--top) + 12px)', paddingBottom: 'calc(28px + var(--bottom))' }}>
        <div className="flex gap-1">
          {slides.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-black/20">
              {i < pi && <div className="h-full w-full rounded-full bg-current" />}
              {i === pi && <motion.div className="h-full rounded-full bg-current" style={{ width }} />}
            </div>
          ))}
        </div>

        <div className="mt-3.5 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-black/15">
            <Emoji char={story.emoji} size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold leading-tight">{story.title}</p>
            <p className="text-[12px] font-medium opacity-70">OG CRE8R² · {story.category}</p>
          </div>
          <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Продолжить историю' : 'Приостановить историю'} aria-pressed={paused} className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-black/15">
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <Tap onClick={pop} aria-label="Закрыть" className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-black/15">
            <X size={18} />
          </Tap>
        </div>

        <div ref={contentRef} data-navigation-scroll className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-y-auto py-4" style={{ touchAction: 'pan-y' }} onPointerDown={(event) => { event.stopPropagation(); setHolding(true) }} onPointerUp={() => setHolding(false)} onPointerCancel={() => setHolding(false)} onPointerLeave={() => setHolding(false)} onFocusCapture={() => setHolding(true)} onBlurCapture={() => setHolding(false)}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${si}-${pi}`}
              className="my-auto"
              initial={{ opacity: 0, y: 22, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-4 w-fit">
                <Emoji char={story.emoji} size={pi === 0 ? 68 : 48} animated />
              </div>
              <Markdown text={slides[pi] ?? ''} className="prose-ed prose-story" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Явные кнопки: не всем очевидно, что листать можно тапом по краям. */}
        <div className="flex items-center gap-3">
          <Tap onClick={prev} aria-label="Назад" className="pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-full bg-black/15">
            <ChevronLeft size={22} />
          </Tap>
          <p className="flex-1 text-center text-[12px] font-semibold opacity-70">
            {pi + 1} из {slides.length}
            {stories.length > 1 ? ` · новость ${si + 1} из ${stories.length}` : ''}
          </p>
          <Tap onClick={next} aria-label="Дальше" className="pointer-events-auto grid h-12 w-12 shrink-0 place-items-center rounded-full bg-black/25">
            <ChevronRight size={22} />
          </Tap>
        </div>
      </div>
    </motion.div>
  )
}
