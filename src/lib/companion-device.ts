import type { MotionStatus } from './companion-motion'

export type CompanionDevicePreferences = { lantern: boolean; voice: boolean }
const fallback = new Map<number, CompanionDevicePreferences>()
const listeners = new Set<() => void>()
const controls = new Map<number, { start(): void; stop(): void }>()
const statuses = new Map<number, MotionStatus>()
const notify = () => listeners.forEach(listener => listener())
export const companionDeviceKey = (user: number) => `og:companion:device:v1:${user}`
export const subscribeCompanionDevice = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export function parseCompanionDevice(raw: string | null): CompanionDevicePreferences {
  try { const value = JSON.parse(raw ?? 'null'); return { lantern: value?.lantern === true, voice: value?.voice === true } }
  catch { return { lantern: false, voice: false } }
}
export function readCompanionDevice(user: number): CompanionDevicePreferences {
  try { return fallback.get(user) ?? parseCompanionDevice(localStorage.getItem(companionDeviceKey(user))) }
  catch { return fallback.get(user) ?? { lantern: false, voice: false } }
}
export function saveCompanionDevice(user: number, value: CompanionDevicePreferences): boolean {
  const safe = { lantern: value.lantern === true, voice: value.voice === true }
  fallback.set(user, safe)
  let saved = false
  try { localStorage.setItem(companionDeviceKey(user), JSON.stringify(safe)); fallback.delete(user); saved = true } catch { /* Session-only choice is reported by the caller. */ }
  notify(); return saved
}
export const companionMotionStatus = (user: number): MotionStatus => statuses.get(user) ?? 'off'
export function setCompanionMotionStatus(user: number, status: MotionStatus) {
  if (companionMotionStatus(user) === status) return
  statuses.set(user, status); notify()
}
export function registerCompanionMotion(user: number, control: { start(): void; stop(): void }) {
  controls.set(user, control)
  return () => { if (controls.get(user) === control) controls.delete(user); setCompanionMotionStatus(user, 'off') }
}
/** Must be called directly inside the user's click. It never stores an OS authorization. */
export function requestCompanionMotion(user: number) { const control = controls.get(user); if (!control) return false; control.start(); return true }
export function stopCompanionMotion(user: number) { controls.get(user)?.stop() }

export type VoiceState = 'idle' | 'starting' | 'speaking' | 'unavailable' | 'error'
type SpeechHost = { speechSynthesis?: Pick<SpeechSynthesis, 'speak' | 'cancel' | 'getVoices'>; SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance }
export const companionVoiceAvailable = (host: SpeechHost | undefined = typeof window === 'undefined' ? undefined : window) => !!host?.speechSynthesis && typeof host.SpeechSynthesisUtterance === 'function'
/** User-requested browser speech only. This cannot read device volume or hardware silent mode. */
export function createCompanionSpeaker(onState: (state: VoiceState) => void, host: SpeechHost | undefined = typeof window === 'undefined' ? undefined : window) {
  let generation = 0, owned = false, timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    generation++; clearTimeout(timer)
    if (owned) { owned = false; try { host?.speechSynthesis?.cancel() } catch { /* Already gone. */ } }
    onState('idle')
  }
  const speak = (text: string) => {
    stop()
    if (!companionVoiceAvailable(host)) { onState('unavailable'); return }
    const speech = host!.speechSynthesis!, Utterance = host!.SpeechSynthesisUtterance!
    const token = ++generation
    const finish = (state: VoiceState) => { if (token !== generation) return; clearTimeout(timer); owned = false; onState(state) }
    try {
      const utterance = new Utterance(text.replace(/\s+/g, ' ').trim().slice(0, 600))
      utterance.lang = 'ru-RU'; utterance.rate = 1; utterance.volume = 1
      const voices = speech.getVoices(); const russian = voices.find(v => v.lang.toLowerCase().startsWith('ru') && v.localService) ?? voices.find(v => v.lang.toLowerCase().startsWith('ru'))
      if (russian) utterance.voice = russian
      utterance.onstart = () => { if (token === generation) { clearTimeout(timer); onState('speaking') } }
      utterance.onend = () => finish('idle'); utterance.onerror = () => finish('error')
      owned = true; onState('starting')
      timer = setTimeout(() => { if (token === generation && owned) { stop(); onState('error') } }, 12000)
      speech.speak(utterance)
    } catch { finish('error') }
  }
  return { speak, stop }
}
