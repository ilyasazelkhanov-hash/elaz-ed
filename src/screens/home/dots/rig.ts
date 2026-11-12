/** Deterministic pose math is separate from WebGL so lifecycle and expressions stay testable. */
export type DotsMood = 'calm' | 'happy' | 'wink' | 'curious'
export type DotsPose = { yaw: number; pitch: number; roll: number; lift: number; squash: number; leftEye: number; rightEye: number; brow: number; mouth: number; leftArm: number; rightArm: number; gazeX: number; gazeY: number }
export const DOTS_FPS = 30
export const DOTS_DPR_LIMIT = 1.5
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : 0))
export function safeMood(value: string): DotsMood { return value === 'happy' || value === 'wink' || value === 'curious' ? value : 'calm' }
export function dotsPose(time: number, mood: DotsMood, reaction: number, gaze: { x: number; y: number }, motion: boolean): DotsPose {
  const t = Number.isFinite(time) ? Math.max(time, 0) : 0
  const x = motion ? clamp(gaze.x, -1, 1) : 0, y = motion ? clamp(gaze.y, -1, 1) : 0
  const cycle = t % 6.4
  const blink = !motion || cycle < 4.65 || cycle > 4.94 ? 1 : Math.max(.06, Math.abs(cycle - 4.8) / .15)
  const p = motion && reaction >= 0 && reaction < 1.35 ? reaction : -1
  const bounce = p < 0 ? 0 : Math.sin(p * 10) * Math.exp(-p * 3.5)
  const excited = mood === 'happy'
  return {
    yaw: (mood === 'curious' ? .12 : -.12) + x * .24 + (motion ? Math.sin(t * .6) * .045 : 0),
    pitch: .02 + y * .12, roll: (mood === 'curious' ? -.1 : 0) + (motion ? Math.sin(t * .8) * .035 : 0),
    lift: (motion ? Math.sin(t * 1.4) * .035 : 0) + Math.max(0, bounce) * .2,
    squash: bounce * .07,
    leftEye: blink, rightEye: mood === 'wink' ? .08 : blink,
    brow: mood === 'curious' ? .08 : excited ? .04 : 0,
    mouth: excited ? .11 : mood === 'curious' ? .075 : .035,
    leftArm: -.2 + (motion ? Math.sin(t * 1.4 + .4) * .07 : 0) - bounce * .65,
    rightArm: .2 + (excited && motion && p >= 0 ? (Math.sin(p * 9) * .18 + .55) * (1 - p / 1.35) : 0) + bounce * .8,
    gazeX: (mood === 'curious' ? .025 : 0) + x * .05, gazeY: -y * .035,
  }
}
export function easePose(current: number, target: number, seconds: number, speed = 12): number {
  return current + (target - current) * (1 - Math.exp(-speed * clamp(seconds, 0, .1)))
}
