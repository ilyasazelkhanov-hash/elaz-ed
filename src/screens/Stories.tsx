import { X } from 'lucide-react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { GRADIENTS, slidesOf } from '../lib/game'
import { sfx } from '../lib/sfx'
import { haptic } from '../lib/tg'
import { track } from '../lib/track'
import { Markdown } from '../Markdown'
import { useStore } from '../store'
import { Emoji, Tap } from '../ui'

const SLIDE_MS = 6000
const HOLD_MS = 190

export function Stories({ startId }: { startId: number }) {
  // Список фиксируем на момент открытия, чтобы отметки «пройдено» не тасовали сторис под пальцем.
  const stories = useMemo(() => useStore.getState().feed.filter((c) => c.kind === 'story'), [])
  const pop = useStore((s) => s.pop)
  const [si, setSi] = useState(() => Math.max(0, stories.findIndex((s) => s.id === startId)))
  const [pi, setPi] = useState(0)
  const story = stories[si]
  const slides = useMemo(() => slidesOf(story?.body ?? ''), [story])
  const progress = useMotionValue(0)
  const width = useTransform(progress, (p) => `${p * 100}%`)
  const paused = useRef(false)
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

  const prev = () => {
    if (pi > 0) return setPi(pi - 1)
    if (si > 0) {
      setSi(si - 1)
      setPi(0)
    } else {
      progress.set(0)
    }
  }

  useEffect(() => {
    if (!story) return
    useStore.getState().markSeen(story.id)
    track('story_open', undefined, story.id)
  }, [story])

  // Таймер слайда на requestAnimationFrame: умеет вставать на паузу, пока палец на экране.
  useEffect(() => {
    progress.set(0)
    let raf = 0
    let last = performance.now()
    let elapsed = 0
    const tick = (now: number) => {
      if (!paused.current) elapsed += now - last
      last = now
      progress.set(Math.min(1, elapsed / SLIDE_MS))
      if (elapsed >= SLIDE_MS) return next()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [si, pi, next, progress])

  if (!story) return null
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
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 110 || info.velocity.y > 600) pop()
      }}
    >
      <div className="absolute -right-24 -top-16 h-80 w-80 rounded-full bg-white/20" />
      <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-black/10" />

      <div
        className="absolute inset-0"
        style={{ touchAction: 'pan-y', WebkitTouchCallout: 'none' }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={() => {
          downAt.current = performance.now()
          paused.current = true
        }}
        onPointerCancel={() => (paused.current = false)}
        onPointerUp={(e) => {
          paused.current = false
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
            <p className="text-[12px] font-medium opacity-70">Elaz Ed · {story.category}</p>
          </div>
          <Tap onClick={pop} aria-label="Закрыть" className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/15">
            <X size={18} />
          </Tap>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${si}-${pi}`}
              initial={{ opacity: 0, y: 22, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="floaty mb-6 w-fit">
                <Emoji char={story.emoji} size={pi === 0 ? 104 : 68} animated />
              </div>
              <Markdown text={slides[pi] ?? ''} className="prose-ed prose-story" />
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="text-center text-[12px] font-semibold opacity-60">
          {pi + 1} из {slides.length}
          {stories.length > 1 ? ` · сторис ${si + 1}/${stories.length}` : ''}
        </p>
      </div>
    </motion.div>
  )
}
