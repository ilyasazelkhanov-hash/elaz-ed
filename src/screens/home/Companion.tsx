import { ArrowUpRight, ChevronDown, ChevronUp, Pause, Play, Shuffle } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useReadPosts } from '../../lib/blog-read'
import { companionCues, COMPANION_AUTO_LIMIT, COMPANION_INTERVAL_MS, nextCompanionCue, readCompanionSession, saveCompanionSession } from '../../lib/home-companion'
import { useDocumentVisible, useElementVisible, usePrefersReducedMotion } from '../../lib/visibility'
import { useStore } from '../../store'
import './companion.css'

/** A lightweight, authored guide. No network calls, chat UI, audio or reward claims. */
export function Companion({ userId }: { userId: number }) {
  const feed = useStore(s => s.feed)
  const advent = useStore(s => s.advent)
  const covered = useStore(s => s.stack.length > 0 || !!s.reward || !!s.share)
  const push = useStore(s => s.push)
  const read = useReadPosts(userId)
  const cues = companionCues(feed, advent, read)
  const [session, setSession] = useState(() => readCompanionSession(userId))
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const region = useRef<HTMLElement>(null)
  const contentId = useId()
  const reduce = usePrefersReducedMotion()
  const visible = useElementVisible(region)
  const documentVisible = useDocumentVisible()
  const cue = cues.find(item => item.id === session.cueId) ?? cues[0]
  const cueKey = cues.map(item => item.id).join('|')
  const moving = !reduce && !session.paused && !session.collapsed && visible && documentVisible && !covered && !hovered && !focused

  useEffect(() => { saveCompanionSession(userId, session) }, [session, userId])
  useEffect(() => {
    if (!moving || cues.length < 2 || session.autoChanges >= COMPANION_AUTO_LIMIT) return
    const timer = window.setTimeout(() => setSession(current => ({ ...current,
      cueId: nextCompanionCue(cues, cue.id), autoChanges: current.autoChanges + 1,
    })), COMPANION_INTERVAL_MS)
    return () => window.clearTimeout(timer)
    // The key captures every navigation target, without restarting the timer for read snapshots.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, cueKey, cue.id, session.autoChanges])

  const next = () => {
    const id = nextCompanionCue(cues, cue.id)
    const selected = cues.find(item => item.id === id)!
    // Manual interaction ends automatic rotation for this tab session.
    setSession(current => ({ ...current, cueId: id, autoChanges: COMPANION_AUTO_LIMIT }))
    setAnnouncement(`${selected.line} ${selected.detail} Действие: ${selected.action}.`)
  }

  return <section ref={region} className="og-companion mx-5" aria-label="OG-спутник: идеи для тебя"
    data-tone={cue.tone} data-moving={moving} data-collapsed={session.collapsed}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onPointerDownCapture={() => setSession(current => current.autoChanges >= COMPANION_AUTO_LIMIT ? current : { ...current, autoChanges: COMPANION_AUTO_LIMIT })}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <div className="og-companion-main" id={contentId} hidden={session.collapsed}>
      <div className="og-companion-stage" aria-hidden="true">
        <div className="og-companion-halo"/>
        <span className="og-companion-spark og-companion-spark-one">✦</span>
        <span className="og-companion-spark og-companion-spark-two"/>
        <div className="og-companion-orbit"/>
        <div className="og-companion-float"><div className="og-companion-body">
          <div className="og-companion-shine"/>
          <div className="og-companion-face"><i/><i/><span/></div>
          <span className="og-companion-cheek"/>
        </div></div>
        <div className="og-companion-shadow"/>
      </div>
      <div className="og-companion-copy">
        <p className="og-companion-label"><span aria-hidden="true"/>OG-СПУТНИК</p>
        <div className="og-companion-message" key={cue.id}>
          <h2>{cue.line}</h2>
          <p title={cue.detail}>{cue.detail}</p>
        </div>
      </div>
    </div>
    <div className="og-companion-controls">
      {session.collapsed ? <span className="og-companion-resting"><span className="og-companion-mini" aria-hidden="true">··</span><span>Есть идея. Показать?</span></span> : <>
        <button type="button" className="og-companion-action" onClick={() => { setSession(current => ({ ...current, autoChanges: COMPANION_AUTO_LIMIT })); push(cue.target) }}><span>{cue.action}</span><ArrowUpRight size={17} aria-hidden="true"/></button>
        {cues.length > 1 && <button type="button" className="og-companion-icon" onClick={next} aria-label="Другая идея" title="Другая идея"><Shuffle size={17} aria-hidden="true"/></button>}
        {!reduce && <button type="button" className="og-companion-icon" onClick={() => setSession(current => ({ ...current, paused: !current.paused, autoChanges: COMPANION_AUTO_LIMIT }))} aria-label={session.paused ? 'Включить анимацию спутника' : 'Приостановить анимацию и подсказки'} aria-pressed={session.paused} title={session.paused ? 'Продолжить' : 'Пауза'}>{session.paused ? <Play size={16} aria-hidden="true"/> : <Pause size={16} aria-hidden="true"/>}</button>}
      </>}
      <button type="button" className="og-companion-icon og-companion-collapse" onClick={() => setSession(current => ({ ...current, collapsed: !current.collapsed, autoChanges: COMPANION_AUTO_LIMIT }))} aria-expanded={!session.collapsed} aria-controls={contentId} aria-label={session.collapsed ? 'Показать подсказку спутника' : 'Свернуть подсказку спутника'} title={session.collapsed ? 'Показать подсказку' : 'Свернуть'}>{session.collapsed ? <ChevronDown size={18} aria-hidden="true"/> : <ChevronUp size={18} aria-hidden="true"/>}</button>
    </div>
    {/* Only an explicit request is announced. Automatic copy changes stay quiet. */}
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
  </section>
}
