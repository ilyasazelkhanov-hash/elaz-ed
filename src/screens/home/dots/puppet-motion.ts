/** Continuous authored puppet rig. No image frames, DOM, sensors or React state. */
export type PuppetInput = { mood?: string; reaction?: number; gaze?: { x: number; y: number }; priority?: number }
export type PuppetPose = {
  bodyX: number; bodyY: number; bodyRotation: number; bodyScaleX: number; bodyScaleY: number
  headX: number; headY: number; headRotation: number; armLeft: number; armRight: number
  footLeft: number; footRight: number; eyeLeft: number; eyeRight: number
  smile: number; open: number; gazeX: number; gazeY: number; accessoryRotation: number
}
export type PuppetRig = { pose: PuppetPose; velocity: PuppetPose; target: PuppetPose; elapsed: number; reactionAge: number; reaction: number; priority: number }
const safe = (n: number | undefined, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const neutral = (): PuppetPose => ({ bodyX: 0, bodyY: 0, bodyRotation: 0, bodyScaleX: 1, bodyScaleY: 1, headX: 0, headY: 0, headRotation: 0, armLeft: 0, armRight: 0, footLeft: 0, footRight: 0, eyeLeft: 1, eyeRight: 1, smile: .35, open: 0, gazeX: 0, gazeY: 0, accessoryRotation: 0 })
const POSE_KEYS = Object.keys(neutral()) as Array<keyof PuppetPose>
const NEUTRAL = neutral()
export function createPuppetRig(initial: PuppetInput = {}): PuppetRig {
  const pose = neutral(), velocity = neutral()
  for (const key of POSE_KEYS) velocity[key] = 0
  return { pose, velocity, target: neutral(), elapsed: 0, reactionAge: 2, reaction: safe(initial.reaction), priority: 0 }
}
const pulse = (time: number, start: number, duration: number) => time <= start || time >= start + duration ? 0 : Math.sin(Math.PI * (time - start) / duration)
/** dt is seconds; translations use a 100×100 design space, rotations radians. Mutates/reuses pose. */
export function stepPuppetRig(rig: PuppetRig, dtSeconds: number, input: PuppetInput = {}): PuppetPose {
  const dt = clamp(safe(dtSeconds), 0, .05)
  rig.elapsed += dt; rig.reactionAge += dt
  const incoming = safe(input.reaction), priority = clamp(safe(input.priority, 1), 0, 10)
  if (incoming !== rig.reaction) {
    rig.reaction = incoming // Consume every event, including rejected ones: never queue stale actions.
    if (rig.reactionAge >= 1.3 || priority >= rig.priority) { rig.reactionAge = 0; rig.priority = priority }
  }
  const t = rig.elapsed, a = rig.reactionAge, mood = input.mood ?? 'calm'
  const target = rig.target
  for (const key of POSE_KEYS) target[key] = NEUTRAL[key]
  const anticipation = pulse(a, 0, .19), hop = pulse(a, .16, .52)
  const wave = pulse(a, .24, .85) * Math.sin((a - .24) * 20)
  const greet = pulse(a, .18, 1.08)
  const breath = Math.sin(t * 1.28), weight = Math.sin(t * .63)
  // Idle weight and breath are local deformations, not a whole-sticker bob.
  target.bodyX = weight * .45; target.bodyY = anticipation * 1.5 - hop * 4.8
  target.bodyRotation = weight * .016
  target.bodyScaleX = 1 + breath * .008 + anticipation * .045 - hop * .018
  target.bodyScaleY = 1 - breath * .006 - anticipation * .045 + hop * .025
  const glancePhase = t % 11.7
  const glance = pulse(glancePhase, 7.7, 1.6)
  const gx = clamp(safe(input.gaze?.x) + glance * .55, -1, 1), gy = clamp(safe(input.gaze?.y), -1, 1)
  target.gazeX = gx; target.gazeY = gy
  target.headX = gx * 1.8; target.headY = gy * 1.2 - breath * .2
  target.headRotation = gx * .07 + (mood === 'curious' ? -.08 : 0)
  target.armLeft = -.08 - greet * .24 + breath * .015 + Math.sin(t * .91 + .7) * .025
  target.armRight = .08 + greet * 1.35 + wave * .18 + Math.sin(t * .79 + 2.1) * .025
  target.footLeft = hop * 1.2 + weight * .2; target.footRight = hop * .8 - weight * .2
  // Soft eyelid envelopes, staggered slightly, never a raster/frame switch.
  const blinkPhase = t % 5.9
  target.eyeLeft = 1 - pulse(blinkPhase, 4.5, .19)
  target.eyeRight = 1 - pulse(blinkPhase, 4.515, .19)
  if (mood === 'wink') target.eyeLeft *= .12
  if (mood === 'happy') { target.eyeLeft *= .7; target.eyeRight *= .7; target.smile = 1 }
  if (mood === 'surprised') { target.open = .88; target.smile = .1 }
  if (mood === 'curious') target.open = .12
  target.smile = Math.max(target.smile, greet * .85)
  target.accessoryRotation = -rig.pose.headRotation * .65 + wave * .05
  // Analytic critically damped springs stay finite and stable even after throttled tabs.
  for (const key of POSE_KEYS) {
    const omega = key.startsWith('eye') ? 65 : key.startsWith('gaze') ? 28 : key.startsWith('head') ? 18 : key === 'accessoryRotation' ? 10 : 15
    const position = safe(rig.pose[key], target[key]), velocity = safe(rig.velocity[key])
    const displacement = position - target[key], c = velocity + omega * displacement, decay = Math.exp(-omega * dt)
    rig.pose[key] = target[key] + (displacement + c * dt) * decay
    rig.velocity[key] = (velocity - omega * c * dt) * decay
  }
  for (const key of ['eyeLeft', 'eyeRight', 'smile', 'open'] as const) rig.pose[key] = clamp(rig.pose[key], 0, 1)
  return rig.pose
}
export type PuppetClock = { requestAnimationFrame(callback: (time: number) => void): number; cancelAnimationFrame(id: number): void }
/** Owner starts only while visible/allowed and calls stop on pause/reduced-motion/hidden/unmount. */
export function startPuppetLoop(render: (dtSeconds: number) => void, clock: PuppetClock = window): () => void {
  let stopped = false, id: number | undefined, last: number | undefined
  const tick = (timestamp: number) => {
    if (stopped) return
    const time = safe(timestamp)
    if (last === undefined || time - last >= 1000 / 30 - .01 || time < last) {
      const dt = last === undefined ? 0 : clamp((time - last) / 1000, 0, .05)
      last = time
      try { render(dt) } catch (error) { stopped = true; throw error }
    }
    if (!stopped) id = clock.requestAnimationFrame(tick)
  }
  id = clock.requestAnimationFrame(tick)
  return () => { stopped = true; if (id !== undefined) clock.cancelAnimationFrame(id) }
}
