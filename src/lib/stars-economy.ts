/**
 * Reference figures for pricing in Telegram Stars. They are estimates for the admin, not billing data:
 * what the buyer pays depends on where they buy Stars, and Telegram can change its rates.
 * Checked in November 2026; the sources are listed in docs/UNIT-ECONOMICS-2026-11.md.
 */
export const STARS_REFERENCE = {
  checked: 'ноябрь 2026',
  /** What Telegram pays a developer for one Star on withdrawal. */
  payoutUsd: 0.013,
  /** Kazakhstan App Store pack: 500 Stars for 5 890 tenge. */
  buyerKztInApp: 5890 / 500,
  /** Stars bought through Fragment or @PremiumBot cost the buyer less than in the app stores. */
  buyerUsdDirect: 0.015,
  usdKzt: 450,
  /** Telegram lets a developer withdraw from 1 000 Stars, 21 days after the payment. */
  withdrawMinStars: 1000,
  holdDays: 21,
} as const

export type StarsEstimate = { stars: number; buyerKzt: number; buyerKztDirect: number; payoutUsd: number; payoutKzt: number }

const round = (value: number, step: number) => Math.round(value / step) * step

/** Rounded on purpose: the admin needs the order of magnitude, not a quote. */
export function starsEstimate(stars: number): StarsEstimate | null {
  if (!Number.isFinite(stars) || stars <= 0) return null
  const { payoutUsd, buyerKztInApp, buyerUsdDirect, usdKzt } = STARS_REFERENCE
  return {
    stars,
    buyerKzt: round(stars * buyerKztInApp, 10),
    buyerKztDirect: round(stars * buyerUsdDirect * usdKzt, 10),
    payoutUsd: Math.round(stars * payoutUsd * 100) / 100,
    payoutKzt: round(stars * payoutUsd * usdKzt, 10),
  }
}

const money = (value: number) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/** One line for the course editor. */
export function starsEstimateText(stars: number): string {
  const estimate = starsEstimate(stars)
  if (!estimate) return ''
  return `Ориентир на ${STARS_REFERENCE.checked}: покупатель платит около ${money(estimate.buyerKzt)} ₸ в App Store (через бота @PremiumBot дешевле, около ${money(estimate.buyerKztDirect)} ₸), ты получаешь около ${money(estimate.payoutKzt)} ₸ ($${estimate.payoutUsd.toFixed(2)}) при выводе.`
}
