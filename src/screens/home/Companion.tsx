import { ArrowUpRight, SlidersHorizontal, Square, Volume2, X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useReadPosts } from '../../lib/blog-read'
import { companionCues, companionName, companionColors, companionShapes, companionAccessories, COMPANION_AUTO_LIMIT, COMPANION_INTERVAL_MS, nextCompanionCue, readCompanionSession, saveCompanionSession, readCompanionPreferences, saveCompanionPreferences, type CompanionPreferences } from '../../lib/home-companion'
import { useDocumentVisible, useElementVisible, usePrefersReducedMotion } from '../../lib/visibility'
import { useStore } from '../../store'
import { companionMotionStatus, companionVoiceAvailable, readCompanionDevice, requestCompanionMotion, saveCompanionDevice, stopCompanionMotion, subscribeCompanionDevice } from '../../lib/companion-device'
import { useDotsInteractions } from './dots/useInteractions'
import { DotsCharacter } from './dots/DotsCharacter'
import './companion.css'

const colorLabels = { violet: 'Лаванда', mint: 'Мята', peach: 'Персик', sky: 'Небо' }
const shapeLabels = { soft: 'Облачко', round: 'Кругляш', spark: 'Искра' }
const accessoryLabels = { none: 'Без аксессуара', glasses: 'Очки', sprout: 'Росток', headphones: 'Наушники' }

/** A compact authored companion. Only explicit navigation; never claims a reward or runs an AI task. */
export function Companion({ userId }: { userId: number }) {
  const feed = useStore(s => s.feed)
  const advent = useStore(s => s.advent)
  const me = useStore(s => s.me)
  const courses = useStore(s => s.courses)
  const fresh = useStore(s => !s.refreshErrorCode && !s.refreshing)
  const covered = useStore(s => s.stack.length > 0 || !!s.reward || !!s.share)
  const push = useStore(s => s.push)
  const toast = useStore(s => s.toast)
  const read = useReadPosts(userId)
  const cues = companionCues(feed, advent, read, Date.now(), { me, courses, fresh })
  const [session, setSession] = useState(() => readCompanionSession(userId))
  const [look, setLook] = useState(() => readCompanionPreferences(userId))
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [reaction, setReaction] = useState('')
  const [reactionId, setReactionId] = useState(0)
  const gaze = useRef({ x: 0, y: 0 })
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
  const mood = reaction || (cue.tone === 'celebrate' ? 'happy' : cue.tone === 'read' || cue.tone === 'advent' ? 'curious' : 'calm')
  const stopRotation = () => setSession(current => ({ ...current, autoChanges: COMPANION_AUTO_LIMIT }))
  const react = useCallback((mood: string) => {
    window.clearTimeout(reactTimer.current)
    setReaction(mood)
    setReactionId(id => id + 1)
    reactTimer.current = window.setTimeout(() => setReaction(''), 1800)
  }, [])

  const interactions = useDotsInteractions({ userId, active: visible && documentVisible && !covered, motion: !reduce && !session.paused, gaze, region, onReaction: react })
  const spoken = interactions.voiceState === 'speaking' || interactions.voiceState === 'starting'
  useEffect(() => {
    if (interactions.voiceState === 'error' || interactions.voiceState === 'unavailable') toast('Голос недоступен. Реплика остаётся текстом.')
  }, [interactions.voiceState, toast])
  useEffect(() => {
    if (interactions.motionStatus === 'unsupported') toast('Датчики не передают движение. Касания работают как раньше.')
    else if (interactions.motionStatus === 'denied') toast('Доступ к движению не разрешён. Касания работают без датчиков.')
    else if (interactions.motionStatus === 'active') toast('Реакции на движение включены для этого просмотра')
  }, [interactions.motionStatus, toast])

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
      data-moving={moving} data-reacting={moving && reaction ? reaction : undefined} data-mood={mood}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onPointerDownCapture={stopRotation}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      <button type="button" className="og-dots-pet" aria-label={`${look.name}: погладить и показать другую идею`} onClick={next}
        onPointerMove={event => {
          if (reduce || session.paused || event.pointerType !== 'mouse') return
          const box = event.currentTarget.getBoundingClientRect()
          gaze.current.x = Math.max(-1, Math.min(1, (event.clientX - box.x) / box.width * 2 - 1))
          gaze.current.y = Math.max(-1, Math.min(1, (event.clientY - box.y) / box.height * 2 - 1))
        }} onPointerLeave={() => { gaze.current.x = 0; gaze.current.y = 0 }}>
        <DotsCharacter look={look} mood={mood} active={visible && documentVisible && !covered} motion={!reduce && !session.paused} reaction={reactionId} gaze={gaze} lantern={interactions.preferences.lantern}/>
      </button>
      <div className="og-dots-conversation">
        <div className="og-dots-heading"><span className="og-dots-name">{look.name} <span>твой спутник</span></span><span className="og-dots-heading-actions">{interactions.preferences.voice && <button type="button" className="og-dots-settings" onClick={() => interactions.readAloud(`${interactions.moment || cue.line} ${cue.detail}`)} aria-label={spoken ? 'Остановить чтение' : 'Прочитать реплику'} aria-pressed={spoken}>{spoken ? <Square size={15} aria-hidden="true"/> : <Volume2 size={17} aria-hidden="true"/>}</button>}<button type="button" className="og-dots-settings" onClick={() => push({ type: 'companion-settings' })} aria-label="Настроить Dots" title="Имя, образ и анимации"><SlidersHorizontal size={17} aria-hidden="true"/></button></span></div>
      <button type="button" className="og-dots-speech" onClick={navigate} aria-label={`${cue.action}: ${cue.detail}`}>
        <span className="og-dots-line">{interactions.moment || cue.line}</span>
        <span className="og-dots-detail" title={cue.detail}>{cue.detail}</span>
        <span className="og-dots-action">{cue.action}<ArrowUpRight size={13} aria-hidden="true"/></span>
      </button>
      </div>
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
  const [device, setDevice] = useState(() => readCompanionDevice(userId))
  const motionStatus = useSyncExternalStore(subscribeCompanionDevice, () => companionMotionStatus(userId), () => 'off')
  const voiceAvailable = companionVoiceAvailable()
  const changeDevice = (patch: Partial<typeof device>) => {
    const value = { ...device, ...patch }; setDevice(value)
    if (!saveCompanionDevice(userId, value)) toast('Режим изменён до перезагрузки: браузер не разрешил сохранение')
  }
  const enableMotion = () => {
    if (requestCompanionMotion(userId)) closeSettings()
    else toast('Персонаж ещё готовится. Попробуй включить движение ещё раз.')
  }
  const documentVisible = useDocumentVisible()
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
        <div className="og-dots-preview" data-mood="happy" data-moving="false"><DotsCharacter look={draft} mood="happy" active={documentVisible} motion={!reduce && !session.paused} lantern={device.lantern}/><p>Коснись меня на главной.<br/>Покажу другую идею.</p></div>

        <div className="og-dots-field"><label htmlFor={inputId}>Имя</label><input id={inputId} aria-describedby={`${inputId}-hint`} value={draft.name} maxLength={48} placeholder="Dots" autoComplete="off" onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}/><small id={`${inputId}-hint`}>До 24 символов. Без личных данных.</small></div>
        <fieldset><legend>Цвет</legend><div className="og-dots-options">{companionColors.map(color => <label key={color} className="og-dots-option"><input type="radio" name="dots-color" value={color} checked={draft.color === color} onChange={() => setDraft(current => ({ ...current, color }))}/><span><i className="og-dots-swatch" data-color={color}/>{colorLabels[color]}</span></label>)}</div></fieldset>
        <fieldset><legend>Форма</legend><div className="og-dots-options">{companionShapes.map(shape => <label key={shape} className="og-dots-option"><input type="radio" name="dots-shape" value={shape} checked={draft.shape === shape} onChange={() => setDraft(current => ({ ...current, shape }))}/><span>{shapeLabels[shape]}</span></label>)}</div></fieldset>
        <fieldset><legend>Деталь характера</legend><div className="og-dots-options">{companionAccessories.map(accessory => <label key={accessory} className="og-dots-option"><input type="radio" name="dots-accessory" value={accessory} checked={draft.accessory === accessory} onChange={() => setDraft(current => ({ ...current, accessory }))}/><span>{accessoryLabels[accessory]}</span></label>)}</div></fieldset>
        <label className="og-dots-motion"><span>Живые анимации<small>{reduce ? 'Система просит меньше движения: анимации отключены.' : 'Взгляд, мимика и живые жесты. Можно отключить.'}</small></span><input type="checkbox" checked={!session.paused} disabled={reduce} onChange={event => changeMotion(!event.target.checked)}/></label>
        <details className="og-dots-interactions">
          <summary>Движение, свет и голос</summary>
          <div className="og-dots-sensors"><strong>Наклон и встряска</strong><p>По твоему согласию Dots реагирует на движение телефона. Данные остаются здесь. Включается на главной и останавливается при уходе с неё или скрытии персонажа.</p>
            <button type="button" onClick={motionStatus === 'active' ? () => stopCompanionMotion(userId) : enableMotion} disabled={reduce || session.paused || motionStatus === 'requesting'}>{motionStatus === 'active' ? 'Отключить движение' : motionStatus === 'requesting' ? 'Ждём разрешение…' : 'Разрешить движение на главной'}</button>
            <small>{reduce ? 'Устройство просит меньше движения. Датчики не включаются.' : session.paused ? 'Сначала включи живые анимации ниже.' : motionStatus === 'denied' ? 'Доступ не разрешён. Касания остаются доступны.' : motionStatus === 'unsupported' ? 'Датчики недоступны в этом браузере. Используй касания.' : motionStatus === 'suspended' ? 'Движение приостановлено. Можно включить снова по кнопке.' : 'Откроется главная. Сначала сохрани изменения имени и образа. Браузер или Telegram могут запросить доступ к датчикам.'}</small>
          </div>
          <label className="og-dots-motion"><span>Светлячок в сцене<small>Декоративный фонарик. Яркость экрана не считывается; камера и фонарь телефона не включаются.</small></span><input type="checkbox" checked={device.lantern} onChange={event => changeDevice({ lantern: event.target.checked })}/></label>
          <label className="og-dots-motion"><span>Голос только по кнопке<small>{voiceAvailable ? 'Браузер может использовать сетевой голос. Звук и беззвучный режим телефона определить нельзя. Текст остаётся всегда.' : 'Озвучивание недоступно в этом браузере. Все реплики есть текстом.'}</small></span><input type="checkbox" disabled={!voiceAvailable} checked={device.voice} onChange={event => changeDevice({ voice: event.target.checked })}/></label>
          <p className="og-dots-privacy">Эти переключатели действуют сразу. Никаких микрофона, камеры или автоматической озвучки.</p>
        </details>
        <p className="og-dots-privacy">Имя и образ хранятся только в этом браузере для твоего аккаунта. Dots показывает подготовленные подсказки, не читает переписку и не выполняет задачи за тебя.</p>
        <button type="submit" className="og-dots-save">Это мой Dots<ArrowUpRight size={18}/></button>
      </form>
  </div>
}
