/** Continuous authored puppet rig. No image frames, DOM, sensors or React state. */
export type PuppetInput = { mood?: string; reaction?: number; gaze?: { x: number; y: number }; priority?: number }
export type PuppetPose = {
  bodyX: number; bodyY: number; bodyRotation: number; bodyScaleX: number; bodyScaleY: number
  headX: number; headY: number; headRotation: number; ripple: number; flowPhase: number; coreTwist: number; eyeLeft: number; eyeRight: number
  smile: number; open: number; gazeX: number; gazeY: number; accessoryRotation: number
}
type IdleLife = { seed: number; blinkAt: number; blinkStart: number; double: boolean; glanceAt: number; glanceStart: number; glanceDuration: number; x: number; y: number; expression: number }
export type PuppetRig = { idle: IdleLife; pose: PuppetPose; velocity: PuppetPose; target: PuppetPose; elapsed: number; reactionAge: number; reaction: number; priority: number }
const safe = (n: number | undefined, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const neutral = (): PuppetPose => ({ bodyX: 0, bodyY: 0, bodyRotation: 0, bodyScaleX: 1, bodyScaleY: 1, headX: 0, headY: 0, headRotation: 0, ripple: .35, flowPhase: 0, coreTwist: 0, eyeLeft: 1, eyeRight: 1, smile: .35, open: 0, gazeX: 0, gazeY: 0, accessoryRotation: 0 })
const POSE_KEYS = Object.keys(neutral()) as Array<keyof PuppetPose>
const NEUTRAL = neutral()
export function createPuppetRig(initial: PuppetInput = {}): PuppetRig {
  const pose = neutral(), velocity = neutral()
  for (const key of POSE_KEYS) velocity[key] = 0
  return { idle: { seed: 48271, blinkAt: 3.8, blinkStart: -10, double: false, glanceAt: 2.3, glanceStart: -10, glanceDuration: 2, x: 0, y: 0, expression: 0 }, pose, velocity, target: neutral(), elapsed: 0, reactionAge: 2, reaction: safe(initial.reaction), priority: 0 }
}
const random = (idle: IdleLife) => { idle.seed = (Math.imul(idle.seed, 1664525) + 1013904223) >>> 0; return idle.seed / 4294967296 }
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
  const anticipation = pulse(a, 0, .16)
  const greet = pulse(a, .16, 1.12)
  const wave = pulse(a, .14, 1.12) * Math.sin((a - .14) * 15)
  const breath = Math.sin(t * 1.28), weight = Math.sin(t * .63)
  // Local edge flow and core torsion carry the life; root levitation stays deliberately tiny.
  target.bodyX = weight * .25; target.bodyY = Math.sin(t * .83) * .65 + anticipation * .18
  target.bodyRotation = weight * .009
  target.bodyScaleX = 1 + breath * .008 - anticipation * .035 + wave * .018
  target.bodyScaleY = 1 - breath * .006 - anticipation * .035 - wave * .018
  target.ripple = .35 + greet * 1.6
  target.coreTwist = Math.sin(t * .91) * .015 + wave * .065
  target.flowPhase = t
  const idle = rig.idle
  if (t >= idle.blinkAt) {
    idle.blinkStart = t; idle.double = random(idle) < .2
    idle.blinkAt = t + 3.2 + random(idle) * 4.6
  }
  if (t >= idle.glanceAt) {
    idle.glanceStart = t; idle.glanceDuration = 1.6 + random(idle) * 1.7
    idle.x = (random(idle) * 2 - 1) * .75; idle.y = (random(idle) * 2 - 1) * .45
    idle.expression = random(idle)
    idle.glanceAt = t + idle.glanceDuration + 2.3 + random(idle) * 4.4
  }
  // Real actions and intentional gaze outrank idle life; schedules never queue deferred gestures.
  const idleAllowed = a >= 1.3
  const glance = idleAllowed ? pulse(t, idle.glanceStart, idle.glanceDuration) : 0
  const intentionalGaze = Math.abs(safe(input.gaze?.x)) + Math.abs(safe(input.gaze?.y)) > .08
  const gx = clamp(safe(input.gaze?.x) + (intentionalGaze ? 0 : glance * idle.x), -1, 1)
  const gy = clamp(safe(input.gaze?.y) + (intentionalGaze ? 0 : glance * idle.y), -1, 1)
  target.gazeX = gx; target.gazeY = gy
  target.headX = gx * 1.8; target.headY = gy * 1.2 - breath * .2
  target.headRotation = gx * .07 + (mood === 'curious' ? -.08 : 0)
  const blinkAge = t - idle.blinkStart
  const blinkLeft = Math.max(pulse(blinkAge, 0, .19), idle.double ? pulse(blinkAge, .32, .17) : 0)
  const blinkRight = Math.max(pulse(blinkAge, .015, .19), idle.double ? pulse(blinkAge, .335, .17) : 0)
  target.eyeLeft = 1 - blinkLeft; target.eyeRight = 1 - blinkRight
  if (idleAllowed && (mood === 'calm' || mood === 'neutral' || mood === 'curious')) {
    const expression = glance * (intentionalGaze ? .3 : 1)
    target.smile += expression * .3
    target.eyeLeft *= 1 - expression * .12
    target.eyeRight *= 1 - expression * .06
    target.open = expression * (idle.expression > .65 ? .12 : .025)
    target.headRotation += expression * (idle.expression > .5 ? .025 : -.025)
    target.ripple += expression * .22
    target.coreTwist += expression * idle.x * .018
  }
  if (mood === 'wink') target.eyeLeft *= .12
  if (mood === 'happy') { target.eyeLeft *= .7; target.eyeRight *= .7; target.smile = 1 }
  if (mood === 'surprised') { target.open = .88; target.smile = .1 }
  if (mood === 'curious') target.open = .12
  target.smile = Math.max(target.smile, greet * .85)
  target.accessoryRotation = -rig.pose.headRotation * .65 + wave * .05
  // Analytic critically damped springs stay finite and stable even after throttled tabs.
  for (const key of POSE_KEYS) {
    if (key === 'flowPhase') { rig.pose.flowPhase = t; rig.velocity.flowPhase = 0; continue }
    const omega = key.startsWith('eye') ? 65 : key.startsWith('gaze') ? 28 : key.startsWith('head') ? 18 : key === 'accessoryRotation' ? 10 : 15
    const position = safe(rig.pose[key], target[key]), velocity = safe(rig.velocity[key])
    const displacement = position - target[key], c = velocity + omega * displacement, decay = Math.exp(-omega * dt)
    rig.pose[key] = target[key] + (displacement + c * dt) * decay
    rig.velocity[key] = (velocity - omega * c * dt) * decay
  }
  for (const key of ['eyeLeft', 'eyeRight', 'smile', 'open'] as const) rig.pose[key] = clamp(rig.pose[key], 0, 1)
  rig.pose.ripple = clamp(rig.pose.ripple, 0, 2)
  rig.pose.bodyY = clamp(rig.pose.bodyY, -1.09, 1.09)
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
