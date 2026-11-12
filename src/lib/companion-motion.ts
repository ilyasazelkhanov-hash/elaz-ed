/** Optional, explicitly initiated motion input. No storage, telemetry or automatic permission prompts. */
export type MotionStatus = 'requesting' | 'active' | 'unsupported' | 'denied' | 'suspended' | 'off'
export type MotionHandle = { stop(): void }
type Permission = 'granted' | 'denied' | 'prompt'
type SensorConstructor = { requestPermission?: (absolute?: boolean) => Promise<Permission> }
export type MotionWindow = {
  isSecureContext: boolean
  DeviceOrientationEvent?: SensorConstructor
  DeviceMotionEvent?: SensorConstructor
  addEventListener(type: string, listener: (event: any) => void): void
  removeEventListener(type: string, listener: (event: any) => void): void
  setTimeout(callback: () => void, ms: number): number
  clearTimeout(id: number): void
  performance?: { now(): number }
}
type NativeSensor = {
  start(params: { refresh_rate: number; need_absolute?: boolean }, callback: (started: boolean) => void): unknown
  stop(callback?: (stopped: boolean) => void): unknown
  beta?: number | null; gamma?: number | null; x?: number | null; y?: number | null; z?: number | null
}
export type MotionTelegram = {
  isVersionAtLeast?: (version: string) => boolean
  DeviceOrientation?: NativeSensor
  Accelerometer?: NativeSensor
  onEvent(name: string, listener: (event?: unknown) => void): unknown
  offEvent(name: string, listener: (event?: unknown) => void): unknown
}
export type MotionOptions = {
  telegram?: MotionTelegram | null
  window?: MotionWindow
  signal?: AbortSignal
  onTilt(value: { x: number; y: number }): void
  onShake(): void
  onStatus(status: MotionStatus): void
}
const nativeOwners = new WeakMap<object, object>()
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const bound = (n: number) => Math.max(-1, Math.min(1, n))
const relativeAngle = (value: number, initial: number) => ((value - initial + 540) % 360) - 180
const quiet = (operation: () => unknown) => { try { operation() } catch { /* Cleanup is best effort and independent. */ } }

/** Call directly in the user's click handler: both iOS permission requests start before the first await. */
export async function startCompanionMotion(options: MotionOptions): Promise<MotionHandle> {
  const env = options.window ?? (typeof window === 'undefined' ? undefined : window as unknown as MotionWindow)
  let stopped = false, status: MotionStatus | undefined, timeout: number | undefined
  const cleanup: Array<() => void> = [], reading = new Set<string>(), available = new Set<string>()
  const token = {}, now = () => env?.performance?.now() ?? Date.now()
  const notify = (next: MotionStatus) => { if (status !== next) { status = next; options.onStatus(next) } }
  const detach = () => {
    if (stopped) return
    stopped = true
    if (timeout !== undefined) env?.clearTimeout(timeout)
    cleanup.reverse().forEach(fn => quiet(fn))
    quiet(() => options.onTilt({ x: 0, y: 0 }))
  }
  const finish = (next: MotionStatus) => { if (!stopped) { detach(); notify(next) } }
  const handle: MotionHandle = { stop: () => finish('off') }
  if (options.signal?.aborted) { finish('off'); return handle }
  if (!env) { finish('unsupported'); return handle }
  const abort = () => finish('off')
  options.signal?.addEventListener('abort', abort, { once: true })
  cleanup.push(() => options.signal?.removeEventListener('abort', abort))
  notify('requesting')
  const waitForReading = () => {
    if (timeout !== undefined) env.clearTimeout(timeout)
    timeout = env.setTimeout(() => { if (!reading.size) finish('unsupported') }, 2200)
  }
  const markReading = (channel: string) => {
    if (stopped || !available.has(channel)) return false
    reading.add(channel)
    if (timeout !== undefined) { env.clearTimeout(timeout); timeout = undefined }
    notify('active')
    return true
  }
  const failChannel = (channel: string) => {
    if (stopped) return
    available.delete(channel); reading.delete(channel)
    if (!available.size) finish('unsupported')
    else if (!reading.size) { notify('requesting'); waitForReading() }
  }
  let baseline: { beta: number; gamma: number } | undefined, lastTilt = -Infinity
  const tilt = (beta: unknown, gamma: unknown, radians = false) => {
    if (!finite(beta) || !finite(gamma) || !markReading('tilt')) return
    const b = radians ? beta * 180 / Math.PI : beta, g = radians ? gamma * 180 / Math.PI : gamma
    if (!baseline) baseline = { beta: b, gamma: g }
    const time = now()
    if (time - lastTilt < 100) return
    lastTilt = time
    options.onTilt({ x: bound(relativeAngle(g, baseline.gamma) / 25), y: bound(relativeAngle(b, baseline.beta) / 30) })
  }
  let previous: { x: number; y: number; z: number; time: number } | undefined
  let warmUntil = 0, peak = -Infinity, lastShake = -Infinity
  const acceleration = (x: unknown, y: unknown, z: unknown) => {
    if (!finite(x) || !finite(y) || !finite(z) || !markReading('shake')) return
    const time = now()
    if (!previous) { previous = { x, y, z, time }; warmUntil = time + 400; return }
    const dt = time - previous.time
    if (dt < 80) return
    // Change in the vector rejects constant gravity. Long gaps restart, not manufacture a shake.
    const change = Math.hypot(x - previous.x, y - previous.y, z - previous.z)
    previous = { x, y, z, time }
    if (dt > 500) { peak = -Infinity; warmUntil = time + 400; return }
    if (time < warmUntil || time - lastShake < 3000) return
    // Deliberately conservative product thresholds, not a clinical or device-certified measurement.
    if (change >= 12) {
      if (time - peak >= 100 && time - peak <= 650) {
        lastShake = time; peak = -Infinity; options.onShake()
      } else if (time - peak > 650) peak = time
    }
  }
  const tg = options.telegram
  let nativeVersion = true
  try { nativeVersion = tg?.isVersionAtLeast ? tg.isVersionAtLeast('8.0') : true } catch { nativeVersion = false }
  const native = nativeVersion && tg && typeof tg.onEvent === 'function' && typeof tg.offEvent === 'function'
  const orientation = native && typeof tg.DeviceOrientation?.start === 'function' && typeof tg.DeviceOrientation?.stop === 'function' ? tg.DeviceOrientation : undefined
  const accelerometer = native && typeof tg.Accelerometer?.start === 'function' && typeof tg.Accelerometer?.stop === 'function' ? tg.Accelerometer : undefined
  if (orientation || accelerometer) {
    const connect = (sensor: NativeSensor, channel: string, changed: string, failed: string, read: () => void, params: { refresh_rate: number; need_absolute?: boolean }) => {
      available.add(channel); nativeOwners.set(sensor, token)
      const owns = () => nativeOwners.get(sensor) === token
      const stop = () => { if (owns()) quiet(() => sensor.stop()) }
      const change = () => { if (!stopped && owns()) read() }
      const failure = () => { if (!stopped && owns()) { stop(); failChannel(channel) } }
      cleanup.push(stop, () => tg!.offEvent(changed, change), () => tg!.offEvent(failed, failure))
      try {
        tg!.onEvent(changed, change); tg!.onEvent(failed, failure)
        sensor.start(params, started => {
          if (!owns()) return
          if (stopped) { if (started) stop(); return }
          if (!started) failChannel(channel)
        })
      } catch { stop(); failChannel(channel) }
    }
    // Register both channel identities before a synchronous failed callback can end the session.
    if (orientation) available.add('tilt')
    if (accelerometer) available.add('shake')
    if (orientation) connect(orientation, 'tilt', 'deviceOrientationChanged', 'deviceOrientationFailed', () => tilt(orientation.beta, orientation.gamma, true), { refresh_rate: 100, need_absolute: false })
    if (accelerometer && !stopped) connect(accelerometer, 'shake', 'accelerometerChanged', 'accelerometerFailed', () => acceleration(accelerometer.x, accelerometer.y, accelerometer.z), { refresh_rate: 100 })
    if (!stopped && !reading.size) waitForReading()
    return handle
  }
  if (!env.isSecureContext) { finish('unsupported'); return handle }
  const candidates: Array<{ channel: 'tilt' | 'shake'; constructor: SensorConstructor; permission: Promise<Permission> }> = []
  // Do not move these calls behind await: Safari needs the original transient user activation.
  for (const [channel, constructor] of [['tilt', env.DeviceOrientationEvent], ['shake', env.DeviceMotionEvent]] as const) {
    if (!constructor) continue
    let permission: Promise<Permission>
    try { permission = constructor.requestPermission ? Promise.resolve(channel === 'tilt' ? constructor.requestPermission(false) : constructor.requestPermission()) : Promise.resolve('granted') }
    catch { permission = Promise.resolve('denied') }
    candidates.push({ channel, constructor, permission: permission.catch(() => 'denied') })
  }
  if (!candidates.length) { finish('unsupported'); return handle }
  const decisions = await Promise.all(candidates.map(async candidate => ({ channel: candidate.channel, granted: await candidate.permission === 'granted' })))
  if (stopped || options.signal?.aborted) { handle.stop(); return handle }
  const listen = (name: string, handler: (event: any) => void) => {
    try { env.addEventListener(name, handler); cleanup.push(() => env.removeEventListener(name, handler)); return true }
    catch { return false }
  }
  for (const decision of decisions) {
    if (!decision.granted) continue
    available.add(decision.channel)
    const attached = decision.channel === 'tilt' ? listen('deviceorientation', event => { if (!stopped) tilt(event.beta, event.gamma) })
    : listen('devicemotion', event => {
      if (stopped) return
      const a = event.acceleration, b = event.accelerationIncludingGravity
      const value = a && finite(a.x) && finite(a.y) && finite(a.z) ? a : b
      if (value) acceleration(value.x, value.y, value.z)
    })
    if (!attached) available.delete(decision.channel)
  }
  if (!available.size) finish(decisions.some(item => item.granted) ? 'unsupported' : 'denied')
  else waitForReading()
  return handle
}
