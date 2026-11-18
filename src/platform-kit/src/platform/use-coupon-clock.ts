import { useEffect, useState } from 'react'
import type { Coupon } from './contracts.ts'

/** Refresh display at expiry and after returning to a suspended tab. No data mutation. */
export function useCouponClock(coupons: Coupon[]) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const current = Date.now()
      setNow(current)
      const next = coupons.reduce((earliest, coupon) => {
        const expiry = coupon.status === 'issued' ? Date.parse(coupon.expiresAt) : NaN
        return expiry > current ? Math.min(earliest, expiry) : earliest
      }, Infinity)
      if (Number.isFinite(next)) timer = setTimeout(refresh, Math.min(next - current + 1, 2_147_483_647))
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [coupons])
  return now
}
