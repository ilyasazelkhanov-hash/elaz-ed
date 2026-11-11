// The same RPC sequences run against the API fake and real PostgreSQL (PGlite).
export const accessFixtures = [
  {
    name: 'payment then Advent prize survives refund',
    steps: [
      ['apply_star_payment', { p_user: 1, p_course: 1, p_stars: 100, p_charge: 'paid-first' }],
      ['advent_grant', { p_user: 1, p_reward: 1 }],
      ['apply_star_refund', { p_charge: 'paid-first' }],
    ],
    access: [{ user_id: 1, source: 'advent', manual_source: 'advent' }],
  },
  {
    name: 'Advent prize then late payment keeps prize after automatic refund',
    steps: [
      ['advent_grant', { p_user: 2, p_reward: 1 }],
      ['apply_star_payment', { p_user: 2, p_course: 1, p_stars: 100, p_charge: 'prize-first' }],
      ['apply_star_payment', { p_user: 2, p_course: 1, p_stars: 100, p_charge: 'prize-first' }],
      ['apply_star_refund', { p_charge: 'prize-first' }],
    ],
    access: [{ user_id: 2, source: 'advent', manual_source: 'advent' }],
  },
  {
    name: 'manual and invite grants remain independent of payment and Advent',
    steps: [
      ['apply_star_payment', { p_user: 3, p_course: 1, p_stars: 100, p_charge: 'manual' }],
      ['grant_course_access', { p_user: 3, p_course: 1, p_source: 'admin' }],
      ['grant_course_access', { p_user: 3, p_course: 1, p_source: 'invites' }],
      ['advent_grant', { p_user: 3, p_reward: 1 }],
      ['apply_star_refund', { p_charge: 'manual' }],
    ],
    access: [{ user_id: 3, source: 'admin', manual_source: 'admin' }],
  },
  {
    name: 'unbacked access is removed after final paid refund',
    steps: [
      ['apply_star_payment', { p_user: 4, p_course: 1, p_stars: 100, p_charge: 'only-payment' }],
      ['apply_star_refund', { p_charge: 'only-payment' }],
      ['apply_star_payment', { p_user: 4, p_course: 1, p_stars: 100, p_charge: 'only-payment' }],
    ],
    access: [],
  },
  {
    name: 'pending manual refund keeps primary access while duplicate refund completes',
    steps: [
      ['apply_star_payment', { p_user: 5, p_course: 1, p_stars: 100, p_charge: 'pending-primary' }],
      ['apply_star_payment', { p_user: 5, p_course: 1, p_stars: 100, p_charge: 'pending-extra' }],
      ['queue_payment_refund', { p_payment: 5 }],
      ['apply_star_refund', { p_charge: 'pending-extra' }],
    ],
    access: [{ user_id: 5, source: 'stars', manual_source: null }],
  },
]
