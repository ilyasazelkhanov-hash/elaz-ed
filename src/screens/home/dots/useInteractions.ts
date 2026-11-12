import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { telegram } from '../../../lib/tg'
import { startCompanionMotion } from '../../../lib/companion-motion'
import { companionMotionStatus, createCompanionSpeaker, readCompanionDevice, registerCompanionMotion, setCompanionMotionStatus, subscribeCompanionDevice, type VoiceState } from '../../../lib/companion-device'

export function useDotsInteractions({ userId, active, motion, gaze, region, onReaction }: {
  userId: number; active: boolean; motion: boolean; gaze: RefObject<{x: number;y: number}>; region: RefObject<HTMLElement | null>; onReaction(mood: string): void
}) {
  const [preferences, setPreferences] = useState(() => readCompanionDevice(userId))
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [moment, setMoment] = useState('')
  const motionStatus = useSyncExternalStore(subscribeCompanionDevice, () => companionMotionStatus(userId), () => 'off')
  const latest = useRef({ active, motion, onReaction }); latest.current = { active, motion, onReaction }
  const abort = useRef<AbortController | null>(null)
  const stopHandle = useRef<(() => void) | null>(null)
  const momentTimer = useRef<number>(0)
  const speaker = useRef<ReturnType<typeof createCompanionSpeaker> | null>(null)
  const stop = useCallback((suspended = false) => {
    abort.current?.abort(); abort.current = null; stopHandle.current?.(); stopHandle.current = null
    gaze.current.x = 0; gaze.current.y = 0
    region.current?.style.setProperty('--dots-tilt-x', '0deg'); region.current?.style.setProperty('--dots-tilt-y', '0deg')
    setCompanionMotionStatus(userId, suspended ? 'suspended' : 'off')
  }, [userId, gaze, region])
  useEffect(() => {
    setPreferences(readCompanionDevice(userId))
    return subscribeCompanionDevice(() => setPreferences(readCompanionDevice(userId)))
  }, [userId])
  useEffect(() => {
    let alive = true
    const ownSpeaker = createCompanionSpeaker(state => { if (alive) setVoiceState(state) }); speaker.current = ownSpeaker
    return () => { alive = false; speaker.current = null; ownSpeaker.stop() }
  }, [])
  useEffect(() => {
    const control = {
      start() {
        if (['requesting', 'active'].includes(companionMotionStatus(userId))) return
        stop()
        if (!latest.current.motion) { setCompanionMotionStatus(userId, 'suspended'); return }
        const own = new AbortController(); abort.current = own
        setCompanionMotionStatus(userId, 'requesting')
        // No await before this call: browser motion permission needs the original user gesture.
        void startCompanionMotion({ telegram, signal: own.signal,
          onStatus(status) { if (!own.signal.aborted) setCompanionMotionStatus(userId, status) },
          onTilt(value) { if (!own.signal.aborted && latest.current.active && latest.current.motion) { gaze.current.x = value.x * .8; gaze.current.y = value.y * .8; region.current?.style.setProperty('--dots-tilt-x', `${-value.y * 7}deg`); region.current?.style.setProperty('--dots-tilt-y', `${value.x * 9}deg`) } },
          onShake() {
            if (own.signal.aborted || !latest.current.active || !latest.current.motion) return
            latest.current.onReaction('surprised'); setMoment('Ого, встряхнуло! Я на месте.')
            clearTimeout(momentTimer.current); momentTimer.current = window.setTimeout(() => setMoment(''), 3000)
          },
        }).then(handle => { if (own.signal.aborted) handle.stop(); else stopHandle.current = () => handle.stop() })
          .catch(() => { if (!own.signal.aborted) setCompanionMotionStatus(userId, 'unsupported') })
      },
      stop() { stop() },
    }
    const unregister = registerCompanionMotion(userId, control)
    return () => { stop(); unregister(); clearTimeout(momentTimer.current) }
  }, [userId, gaze, region, stop])
  useEffect(() => {
    if (active && motion) return
    if (motionStatus !== 'active' && motionStatus !== 'requesting') return
    if (!motion) { stop(true); return }
    // The opt-in button closes settings synchronously; allow that normal navigation to finish.
    const timer = window.setTimeout(() => { if (!latest.current.active || !latest.current.motion) stop(true) }, 250)
    return () => window.clearTimeout(timer)
  }, [active, motion, motionStatus, stop])
  useEffect(() => { if (!active || !preferences.voice) speaker.current?.stop() }, [active, preferences.voice])
  const readAloud = (text: string) => {
    if (!preferences.voice) return
    if (voiceState === 'speaking' || voiceState === 'starting') speaker.current?.stop()
    else speaker.current?.speak(text)
  }
  return { preferences, motionStatus, voiceState, moment, readAloud }
}
