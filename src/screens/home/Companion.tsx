import { ArrowUpRight, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useReadPosts } from '../../lib/blog-read'
import { companionCues, companionName, companionColors, companionShapes, companionAccessories, COMPANION_AUTO_LIMIT, COMPANION_INTERVAL_MS, nextCompanionCue, readCompanionSession, saveCompanionSession, readCompanionPreferences, saveCompanionPreferences, type CompanionPreferences } from '../../lib/home-companion'
import { useDocumentVisible, useElementVisible, usePrefersReducedMotion } from '../../lib/visibility'
import { useStore } from '../../store'
import './companion.css'

const colorLabels = { violet: 'Лаванда', mint: 'Мята', peach: 'Персик', sky: 'Небо' }
const shapeLabels = { soft: 'Облачко', round: 'Кругляш', spark: 'Искра' }
const accessoryLabels = { none: 'Без аксессуара', glasses: 'Очки', sprout: 'Росток', headphones: 'Наушники' }

function Creature({ look }: { look: CompanionPreferences }) {
  return <span className="og-dots-creature" data-color={look.color} data-shape={look.shape} data-accessory={look.accessory} aria-hidden="true">
    <span className="og-dots-shadow"/>
    <span className="og-dots-float"><span className="og-dots-body"/><span className="og-dots-face"><i/><i/><b/></span><span className="og-dots-accessory"/></span>
    <svg className="og-dots-cursor og-dots-cursor-one" viewBox="0 0 16 18"><path d="m2 1 11 9-6 1-3 5Z"/></svg>
    <svg className="og-dots-cursor og-dots-cursor-two" viewBox="0 0 16 18"><path d="m2 1 11 9-6 1-3 5Z"/></svg>
  </span>
}

/** A compact authored companion. Only explicit navigation; never claims a reward or runs an AI task. */
export function Companion({ userId }: { userId: number }) {
  const feed = useStore(s => s.feed)
  const advent = useStore(s => s.advent)
  const me = useStore(s => s.me)
  const courses = useStore(s => s.courses)
  const fresh = useStore(s => !s.refreshErrorCode && !s.refreshing)
  const covered = useStore(s => s.stack.length > 0 || !!s.reward || !!s.share)
  const push = useStore(s => s.push)
  const read = useReadPosts(userId)
  const cues = companionCues(feed, advent, read, Date.now(), { me, courses, fresh })
  const [session, setSession] = useState(() => readCompanionSession(userId))
  const [look, setLook] = useState(() => readCompanionPreferences(userId))
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [reaction, setReaction] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const region = useRef<HTMLElement>(null)
  const reactTimer = useRef<number>(0)
  const touches = useRef(0)
  const previousClaim = useRef(me?.daily_claimed)
  const previousDoor = useRef(advent?.today_open)
  const reduce = usePrefersReducedMotion()
  const visible = useElementVisible(region)
  const documentVisible = useDocumentVisible()
  const cue = cues.find(item => item.id === session.cueId) ?? cues[0]
  const cueKey = cues.map(item => item.id).join('|')
  const moving = !reduce && !session.paused && visible && documentVisible && !covered
  const rotating = moving && !hovered && !focused
  const stopRotation = () => setSession(current => ({ ...current, autoChanges: COMPANION_AUTO_LIMIT }))
  const react = useCallback((mood: string) => {
    window.clearTimeout(reactTimer.current)
    setReaction(mood)
    reactTimer.current = window.setTimeout(() => setReaction(''), 1800)
  }, [])

  useEffect(() => () => window.clearTimeout(reactTimer.current), [])
  useEffect(() => { saveCompanionSession(userId, session) }, [session, userId])
  useEffect(() => {
    const refresh = () => { setLook(readCompanionPreferences(userId)); setSession(readCompanionSession(userId)) }
    window.addEventListener('og:companion-change', refresh)
    return () => window.removeEventListener('og:companion-change', refresh)
  }, [userId])
  useEffect(() => {
    // Celebrate only a confirmed state transition. No optimistic points or fabricated result.
    if (previousClaim.current === false && me?.daily_claimed === true) {
      setSession(current => ({ ...current, cueId: 'daily:done', autoChanges: COMPANION_AUTO_LIMIT }))
      react('happy')
    }
    if (previousDoor.current === false && advent?.today_open === true) react('happy')
    previousClaim.current = me?.daily_claimed
    previousDoor.current = advent?.today_open
  }, [me?.daily_claimed, advent?.today_open, react])
  useEffect(() => {
    if (!rotating || cues.length < 2 || session.autoChanges >= COMPANION_AUTO_LIMIT) return
    const timer = window.setTimeout(() => setSession(current => ({ ...current,
      cueId: nextCompanionCue(cues, cue.id), autoChanges: current.autoChanges + 1,
    })), COMPANION_INTERVAL_MS)
    return () => window.clearTimeout(timer)
    // Each key represents a real navigation target; don't reset for read snapshots.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotating, cueKey, cue.id, session.autoChanges])

  const next = () => {
    const id = nextCompanionCue(cues, cue.id)
    const selected = cues.find(item => item.id === id)!
    setSession(current => ({ ...current, cueId: id, autoChanges: COMPANION_AUTO_LIMIT }))
    react(['happy', 'wink', 'curious'][touches.current++ % 3])
    setAnnouncement(`${look.name}: ${selected.line} ${selected.detail} ${selected.action}.`)
  }
  const navigate = () => {
    stopRotation()
    if (cue.target.type === 'daily') {
      const daily = document.getElementById('daily-check-in')
      daily?.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'nearest' })
      ;(daily?.querySelector<HTMLButtonElement>('button[aria-label="Забрать бонус дня"]') ?? daily)?.focus({ preventScroll: true })
    } else push(cue.target)
  }

  return <>
    <section ref={region} className="og-companion mx-5" aria-label="Твой Dots" data-tone={cue.tone}
      data-moving={moving} data-reacting={moving && reaction ? reaction : undefined} data-mood={reaction || (cue.tone === 'celebrate' ? 'happy' : cue.tone === 'read' ? 'curious' : 'calm')}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onPointerDownCapture={stopRotation}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      <button type="button" className="og-dots-pet" aria-label={`${look.name}: погладить и показать другую идею`} onClick={next}
        onPointerMove={event => {
          if (reduce || session.paused || event.pointerType !== 'mouse') return
          const box = event.currentTarget.getBoundingClientRect()
          event.currentTarget.style.setProperty('--look-x', `${Math.max(-3, Math.min(3, (event.clientX - box.x - box.width / 2) / 9))}px`)
          event.currentTarget.style.setProperty('--look-y', `${Math.max(-2, Math.min(2, (event.clientY - box.y - box.height / 2) / 12))}px`)
        }} onPointerLeave={event => { event.currentTarget.style.setProperty('--look-x', '0px'); event.currentTarget.style.setProperty('--look-y', '0px') }}>
        <Creature look={look}/>
      </button>
      <button type="button" className="og-dots-speech" onClick={navigate} aria-label={`${cue.action}: ${cue.detail}`}>
        <span className="og-dots-name">{look.name} <span>твой спутник</span></span>
        <span className="og-dots-line">{cue.line}</span>
        <span className="og-dots-detail" title={cue.detail}>{cue.detail}</span>
        <span className="og-dots-action">{cue.action}<ArrowUpRight size={13} aria-hidden="true"/></span>
      </button>
      <button type="button" className="og-dots-settings" onClick={() => push({ type: 'companion-settings' })} aria-label="Настроить Dots" title="Имя, образ и анимации"><SlidersHorizontal size={17} aria-hidden="true"/></button>
      {/* Only user-requested changes are spoken; automatic copy changes stay quiet. */}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </section>
  </>
}

/** A real application overlay: Browser/Telegram Back and focus restoration share the app's navigation. */
export function CompanionSettings() {
  const userId = useStore(s => s.me!.id)
  return <CompanionSettingsForm key={userId} userId={userId}/>
}

function CompanionSettingsForm({ userId }: { userId: number }) {
  const closeSettings = useStore(s => s.pop)
  const toast = useStore(s => s.toast)
  const [draft, setDraft] = useState(() => readCompanionPreferences(userId))
  const [session, setSession] = useState(() => readCompanionSession(userId))
  const reduce = usePrefersReducedMotion()
  const inputId = useId()
  const changed = () => window.dispatchEvent(new Event('og:companion-change'))
  const changeMotion = (paused: boolean) => {
    const value = { ...session, paused, autoChanges: COMPANION_AUTO_LIMIT }
    saveCompanionSession(userId, value); setSession(value); changed()
  }
  const save = () => {
    const value = { ...draft, name: companionName(draft.name) }
    const persisted = saveCompanionPreferences(userId, value)
    changed(); closeSettings()
    toast(persisted ? `${value.name}: образ сохранён в этом браузере` : 'Образ изменён до перезагрузки: браузер не разрешил сохранение')
  }
  return <div className="og-dots-modal">
      <div className="og-dots-backdrop" onClick={closeSettings}/>
      <form className="og-dots-editor" onSubmit={event => { event.preventDefault(); save() }}>
        <div className="og-dots-editor-heading"><div><p>МАЛЕНЬКИЙ, НО ТВОЙ</p><h2>Знакомься, {companionName(draft.name)}</h2></div><button type="button" onClick={closeSettings} aria-label="Закрыть настройки Dots"><X size={21}/></button></div>
        <div className="og-dots-preview" data-mood="happy" data-moving="false"><Creature look={draft}/><p>Коснись меня на главной.<br/>Покажу другую идею.</p></div>
        <div className="og-dots-field"><label htmlFor={inputId}>Имя</label><input id={inputId} aria-describedby={`${inputId}-hint`} value={draft.name} maxLength={48} placeholder="Dots" autoComplete="off" onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}/><small id={`${inputId}-hint`}>До 24 символов. Без личных данных.</small></div>
        <fieldset><legend>Цвет</legend><div className="og-dots-options">{companionColors.map(color => <label key={color} className="og-dots-option"><input type="radio" name="dots-color" value={color} checked={draft.color === color} onChange={() => setDraft(current => ({ ...current, color }))}/><span><i className="og-dots-swatch" data-color={color}/>{colorLabels[color]}</span></label>)}</div></fieldset>
        <fieldset><legend>Форма</legend><div className="og-dots-options">{companionShapes.map(shape => <label key={shape} className="og-dots-option"><input type="radio" name="dots-shape" value={shape} checked={draft.shape === shape} onChange={() => setDraft(current => ({ ...current, shape }))}/><span>{shapeLabels[shape]}</span></label>)}</div></fieldset>
        <fieldset><legend>Деталь характера</legend><div className="og-dots-options">{companionAccessories.map(accessory => <label key={accessory} className="og-dots-option"><input type="radio" name="dots-accessory" value={accessory} checked={draft.accessory === accessory} onChange={() => setDraft(current => ({ ...current, accessory }))}/><span>{accessoryLabels[accessory]}</span></label>)}</div></fieldset>
        <label className="og-dots-motion"><span>Живые анимации<small>{reduce ? 'Система просит меньше движения: анимации отключены.' : 'Моргание, эмоции и декоративные курсоры.'}</small></span><input type="checkbox" checked={!session.paused} disabled={reduce} onChange={event => changeMotion(!event.target.checked)}/></label>
        <p className="og-dots-privacy">Имя и образ хранятся только в этом браузере для твоего аккаунта. Dots показывает подготовленные подсказки, не читает переписку и не выполняет задачи за тебя.</p>
        <button type="submit" className="og-dots-save">Это мой Dots<ArrowUpRight size={18}/></button>
      </form>
  </div>
}
