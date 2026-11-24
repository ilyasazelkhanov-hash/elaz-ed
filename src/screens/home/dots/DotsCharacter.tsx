import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { renderAvatarSvg } from 'open-bot-avatar'
import { mountAvatar, type MountedAvatar } from 'open-bot-avatar/dom'
import { useDocumentVisible, useElementVisible, usePrefersReducedMotion } from '../../../lib/visibility'
import type { CompanionPreferences } from '../../../lib/home-companion'
import { avatarColors, companionAvatar } from './open-avatar'
import { dotsGaze, type DotsGaze } from './open-bot-avatar'

/** The upstream renderer owns its canvas. React owns the host and a local SVG fallback. */
export function DotsCharacter({ look, mood, active, motion, reaction = 0, lantern = false, gazeTarget }: {
  look: CompanionPreferences; mood: string; active: boolean; motion: boolean; reaction?: number; lantern?: boolean; gazeTarget?: RefObject<((value: DotsGaze) => void) | null>
}) {
  const host = useRef<HTMLSpanElement>(null), surface = useRef<HTMLSpanElement>(null)
  const avatar = useRef<MountedAvatar | null>(null)
  const visible = useElementVisible(host), documentVisible = useDocumentVisible(), reduce = usePrefersReducedMotion()
  const [failed, setFailed] = useState(false)
  const activeNow = active && visible && documentVisible, moving = activeNow && motion && !reduce && !failed
  const definition = companionAvatar(look), color = avatarColors[look.color]
  const happy = mood === 'happy' || mood === 'wink'
  const state = reaction > 0 && ['happy', 'wink', 'surprised'].includes(mood) ? 'done' : mood === 'curious' ? 'thinking' : 'idle'
  const options = { definition, color, material: look.material ?? 'fluffy' as const, state, mood: happy ? 'happy' as const : 'neutral' as const,
    still: !moving, reducedMotion: !moving, followPointer: moving && !gazeTarget, label: '' } as const
  const latest = useRef(options); latest.current = options
  const poster = useMemo(() => renderAvatarSvg(definition, { color, size: 160 }), [definition, color])
  useEffect(() => {
    const element = surface.current
    if (!element) return
    const fail = () => { avatar.current?.destroy(); avatar.current = null; element.replaceChildren(); setFailed(true) }
    element.addEventListener('contextlost', fail, true)
    try { avatar.current = mountAvatar(element, latest.current) }
    catch { fail() }
    return () => { element.removeEventListener('contextlost', fail, true); avatar.current?.destroy(); avatar.current = null }
  }, [])
  useEffect(() => { avatar.current?.update(options) }, [definition, color, look.material, moving, state, happy, reaction, gazeTarget])
  // Preserve main's event-driven pointer/device bridge, with no second animation loop.
  useEffect(() => {
    if (!moving || !gazeTarget) { avatar.current?.update({ lookAt: null }); return }
    const receive = (value: DotsGaze) => avatar.current?.update({ lookAt: dotsGaze(value) })
    gazeTarget.current = receive
    return () => { if (gazeTarget.current === receive) gazeTarget.current = null }
  }, [moving, gazeTarget])
  return <span ref={host} className="og-dots-character" data-renderer="open-bot-avatar" data-avatar={definition.id} data-active={activeNow} data-motion={moving} data-lantern={lantern} aria-hidden="true">
    <span className="og-dots-avatar-poster" dangerouslySetInnerHTML={{ __html: poster }}/>
    <span ref={surface} className="og-dots-avatar-surface"/>
  </span>
}
