import type { AppConfig, Coupon } from './contracts.ts'

/** Presentation only. Redemption and reward issuance remain server-authoritative. */
export function couponDisplayStatus(coupon: Coupon, now = Date.now()): Coupon['status'] | 'unavailable' {
  if (coupon.status === 'redeemed' || coupon.status === 'expired') return coupon.status
  if (coupon.status !== 'issued') return 'unavailable'
  const expires = Date.parse(coupon.expiresAt)
  if (!Number.isFinite(expires)) return 'unavailable'
  return expires > now ? 'issued' : 'expired'
}

export function availableCoupons(coupons: Coupon[], userId: string, now = Date.now()) {
  return coupons.filter((coupon) => coupon.userId === userId && couponDisplayStatus(coupon, now) === 'issued')
}

export function stampProgress(stamps: number, config: AppConfig) {
  const configured = config.progression?.stampsPerReward
  const target = Number.isSafeInteger(configured) && configured! > 0 ? configured! : 6
  const total = Number.isSafeInteger(stamps) && stamps >= 0 ? stamps : 0
  const completed = Math.floor(total / target)
  const remainder = total % target
  // A just-completed cycle must not look like zero visits.
  const filled = total > 0 && remainder === 0 ? target : remainder
  return { target, total, completed, filled }
}
