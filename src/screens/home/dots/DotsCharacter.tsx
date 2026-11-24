import { Glasses, Headphones, Sprout } from 'lucide-react'
import { renderAvatarSvg } from 'open-bot-avatar'
import type { MountedAvatar } from 'open-bot-avatar/dom'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useDocumentVisible, useElementVisible, usePrefersReducedMotion } from '../../../lib/visibility'
import type { CompanionPreferences } from '../../../lib/home-companion'
import { dotsDefinitions, dotsExpression, dotsEyeColor, dotsGaze, dotsPalette, type DotsGaze } from './open-bot-avatar'

const badges = { glasses: Glasses, sprout: Sprout, headphones: Headphones }
type GazeTarget = RefObject<((value: DotsGaze) => void) | null>

/** Use the bundled avatar renderer only while visible; its own still SVG stays available without canvas. */
export function DotsCharacter({ look, mood, active, motion, reaction = 0, lantern = false, gazeTarget }: {
  look: CompanionPreferences; mood: string; active: boolean; motion: boolean; reaction?: number; lantern?: boolean; gazeTarget?: GazeTarget
}) {
  const host = useRef<HTMLSpanElement>(null), liveHost = useRef<HTMLSpanElement>(null)
  const visible = useElementVisible(host), documentVisible = useDocumentVisible(), reduce = usePrefersReducedMotion()
  const [failed, setFailed] = useState(false)
  const activeNow = active && visible && documentVisible, moving = activeNow && motion && !reduce && !failed
  const definition = dotsDefinitions[look.shape], color = dotsPalette[look.color]
  const options = useMemo(() => ({ definition, color, eyeColor: dotsEyeColor, ...dotsExpression(mood), label: '' }), [definition, color, mood])
  const latest = useRef(options); latest.current = options
  // Only trusted, bundled definitions and fixed palette values go into the renderer, not profile text or input.
  const still = useMemo(() => renderAvatarSvg(definition, { color, eyeColor: dotsEyeColor, reducedMotion: true, mood: dotsExpression(mood).mood }), [definition, color, mood])
  const driver = useRef<MountedAvatar | null>(null)
  const Badge = look.accessory === 'none' ? null : badges[look.accessory]

  useEffect(() => {
    const element = liveHost.current
    if (!moving || !element) return
    let alive = true
    let own: MountedAvatar | null = null
    const receive = (value: DotsGaze) => { own?.update({ lookAt: dotsGaze(value) }) }
    const lost = () => { if (alive) setFailed(true) }
    // Canvas events do not have to bubble; capture on the isolated mount element.
    element.addEventListener('contextlost', lost, true)
    void import('open-bot-avatar/dom').then(({ mountAvatar }) => {
      if (!alive) return
      own = mountAvatar(element, { ...latest.current, followPointer: false, reducedMotion: false })
      driver.current = own
      if (gazeTarget) gazeTarget.current = receive
    }).catch(() => { if (alive) setFailed(true) })
    return () => {
      alive = false
      if (gazeTarget?.current === receive) gazeTarget.current = null
      element.removeEventListener('contextlost', lost, true)
      own?.destroy()
      if (driver.current === own) driver.current = null
    }
  }, [moving, gazeTarget])

  useEffect(() => { driver.current?.update(options) }, [options])

  return <span ref={host} className="og-dots-character" data-renderer="open-bot-avatar" data-definition={definition.id} data-active={activeNow} data-motion={moving} data-mood={mood} data-color={look.color} data-shape={look.shape} data-accessory={look.accessory} data-lantern={lantern} aria-hidden="true">
    <span className="og-dots-avatar-square">
      <span key={reaction} className="og-dots-avatar-reaction" data-reaction={moving && reaction > 0 && ['wink', 'surprised'].includes(mood) ? mood : undefined}/>
      <span ref={liveHost} className="og-dots-avatar-live"/>
      <span className="og-dots-avatar-still" dangerouslySetInnerHTML={{ __html: still }}/>
      {Badge && <span className="og-dots-avatar-badge"><Badge size={12} aria-hidden="true"/></span>}
    </span>
  </span>
}
