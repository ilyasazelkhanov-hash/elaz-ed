import { haptic } from '../../lib/tg'
import { sfx } from '../../lib/sfx'
import { sparksEnabled } from '../../lib/practice-sparks'
import { burst, celebrate } from '../../ui'

/**
 * Feedback for the learner's own action in a formative exercise. Nothing here runs on a timer.
 * Sound follows the existing app setting; `burst` and `celebrate` skip confetti for reduced motion.
 * A mistake gets a soft tap and no buzzer: retrying is part of the exercise.
 */
export function answerEffect(correct: boolean, combo: number) {
  // Without the sparks layer the check button keeps its plain tap, as before.
  if (!sparksEnabled()) { haptic.tap(); return }
  if (correct) { haptic.success(); sfx.good(Math.max(1, combo)) }
  else haptic.soft()
}
/** Every task of one exercise set is answered. */
export function finishEffect(origin?: Element | null) {
  if (!sparksEnabled()) return
  sfx.win()
  burst(origin)
}
/** The learner marked the whole free guide as tried. */
export function guideDoneEffect() {
  if (!sparksEnabled()) { haptic.tap(); return }
  haptic.success()
  sfx.win()
  celebrate()
}
