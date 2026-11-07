export interface DiscoveryCourseStats {
 id: number
 title: string
 viewed: number
 previewed: number
 checkout_users: number
 mature_checkout_users: number
 converted: number
 buyers: number
 purchases: number
 /** Confirmed purchases in the period, excluding refunded and pending refunds. */
 stars: number
 refunded: number
 refunded_stars: number
 refund_pending: number
}

/** Additive service report. An older or unavailable server supplies no invented values. */
export type DiscoveryReport = {available:false} | {
 available: true
 as_of: string
 started_at: string
 window_days: 30
 activation: {eligible:number;attempted:number;waiting:number}
 return14: {eligible:number;returned:number;waiting:number}
 repeat7: {readers:number;repeated:number}
 feedback: {positive:number;responses:number}
 guides: {id:string|null;opened:number;copied:number;tried:number}[]
 sources: {source:string;users:number}[]
 courses: DiscoveryCourseStats[]
}

export function discoveryRate(part:number, whole:number):string {
 return whole > 0 ? `${Math.round(part / whole * 100)}%` : '—'
}

/** Explicit UTC avoids relabelling an observation with the administrator's local day. */
export function discoveryTimestamp(value:string):string {
 const timestamp = Date.parse(value)
 if (!Number.isFinite(timestamp)) return 'дата неизвестна'
 const iso = new Date(timestamp).toISOString()
 return `${iso.slice(8,10)}.${iso.slice(5,7)}.${iso.slice(0,4)}, ${iso.slice(11,16)} UTC`
}

export function coursePaymentTotals(courses:Pick<DiscoveryCourseStats,'purchases'|'stars'|'refunded'|'refunded_stars'|'refund_pending'>[]) {
 // buyers cannot be summed: one person may have paid for multiple courses.
 return courses.reduce((total,course) => ({
  purchases:total.purchases+course.purchases, stars:total.stars+course.stars,
  refunded:total.refunded+course.refunded, refunded_stars:total.refunded_stars+course.refunded_stars,
  refund_pending:total.refund_pending+course.refund_pending,
 }),{purchases:0,stars:0,refunded:0,refunded_stars:0,refund_pending:0})
}
