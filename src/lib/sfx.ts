// Звуки синтезируются на лету через WebAudio — без файлов и загрузок.

const KEY = 'elaz-ed-sound'
let enabled = true
try {
  enabled = localStorage.getItem(KEY) !== '0'
} catch {
  /* приватный режим */
}

let ctx: AudioContext | null = null

function audio() {
  if (!enabled) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number } = {}) {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + at
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t)
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.06, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(ac.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

export const sfx = {
  get enabled() {
    return enabled
  },
  setEnabled(value: boolean) {
    enabled = value
    try {
      localStorage.setItem(KEY, value ? '1' : '0')
    } catch {
      /* приватный режим */
    }
    if (value) sfx.pop()
  },
  pop: () => tone(520, 0, 0.09, { type: 'triangle', to: 880, gain: 0.05 }),
  /** Верный ответ: чем длиннее серия, тем выше нота. */
  good: (combo = 1) => {
    const base = 523.25 * Math.pow(2, Math.min(combo - 1, 4) / 6)
    tone(base, 0, 0.12, { type: 'triangle' })
    tone(base * 1.5, 0.08, 0.18, { type: 'triangle' })
  },
  bad: () => tone(220, 0, 0.22, { type: 'sawtooth', to: 130, gain: 0.035 }),
  /** Зарядка бонуса: тон поднимается вместе с прогрессом 0..1. */
  charge: (p: number) => tone(260 + p * 520, 0, 0.07, { type: 'sine', gain: 0.03 }),
  coin: () => {
    tone(988, 0, 0.08, { type: 'square', gain: 0.03 })
    tone(1319, 0.07, 0.24, { type: 'square', gain: 0.03 })
  },
  win: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.26, { type: 'triangle', gain: 0.055 })),
  levelUp: () => [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.08, 0.3, { type: 'triangle', gain: 0.055 })),
}
