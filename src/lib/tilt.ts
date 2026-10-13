// Наклон телефона → два значения -1..1. Источники: гироскоп Telegram, датчик браузера, указатель на десктопе.
import { useMotionValue, useSpring, type MotionValue } from 'motion/react'
import { useEffect } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
const wa: any = window.Telegram?.WebApp
const clamp = (v: number) => Math.max(-1, Math.min(1, v))

export function useTilt(active = true): { x: MotionValue<number>; y: MotionValue<number>; onPointerMove: (e: React.PointerEvent) => void; onPointerLeave: () => void } {
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const x = useSpring(rawX, { stiffness: 140, damping: 18 })
  const y = useSpring(rawY, { stiffness: 140, damping: 18 })

  useEffect(() => {
    if (!active) return
    let base: number | null = null
    const apply = (beta: number, gamma: number) => {
      base ??= beta
      // База медленно подстраивается под то, как человек держит телефон.
      base += (beta - base) * 0.02
      rawX.set(clamp(gamma / 0.45))
      rawY.set(clamp((beta - base) / 0.45))
    }

    const sensor = wa?.DeviceOrientation
    const viaTelegram = !!sensor?.start && !!wa?.isVersionAtLeast?.('8.0') && ['android', 'ios'].includes(wa.platform)
    const onTg = () => apply(sensor.beta ?? 0, sensor.gamma ?? 0)
    const onWeb = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return
      apply((e.beta * Math.PI) / 180, (e.gamma * Math.PI) / 180)
    }

    if (viaTelegram) {
      try {
        sensor.start({ refresh_rate: 40 })
        wa.onEvent('deviceOrientationChanged', onTg)
      } catch {
        /* датчик недоступен */
      }
    } else {
      window.addEventListener('deviceorientation', onWeb)
    }

    return () => {
      if (viaTelegram) {
        try {
          wa.offEvent('deviceOrientationChanged', onTg)
          sensor.stop()
        } catch {
          /* датчик недоступен */
        }
      } else {
        window.removeEventListener('deviceorientation', onWeb)
      }
      rawX.set(0)
      rawY.set(0)
    }
  }, [active, rawX, rawY])

  return {
    x,
    y,
    onPointerMove: (e) => {
      if (e.pointerType === 'touch') return
      const r = e.currentTarget.getBoundingClientRect()
      rawX.set(clamp(((e.clientX - r.left) / r.width - 0.5) * 2))
      rawY.set(clamp(((e.clientY - r.top) / r.height - 0.5) * 2))
    },
    onPointerLeave: () => {
      rawX.set(0)
      rawY.set(0)
    },
  }
}
