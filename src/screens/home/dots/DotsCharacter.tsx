import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { renderAvatarSvg } from 'open-bot-avatar'
import { mountAvatar, type MountedAvatar } from 'open-bot-avatar/dom'
import { useDocumentVisible, useElementVisible, usePrefersReducedMotion } from '../../../lib/visibility'
import type { CompanionPreferences } from '../../../lib/home-companion'
import { avatarColors, companionAvatar } from './open-avatar'
import { startPuppetLoop } from './puppet-motion'

/** The upstream renderer owns its canvas. React owns the host and a local SVG fallback. */
export function DotsCharacter({ look, mood, active, motion, reaction = 0, lantern = false, gaze }: {
  look: CompanionPreferences; mood: string; active: boolean; motion: boolean; reaction?: number; lantern?: boolean; gaze?: RefObject<{ x: number; y: number }>
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
    still: !moving, reducedMotion: !moving, followPointer: moving && !gaze, label: '' } as const
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
  useEffect(() => { avatar.current?.update(options) }, [definition, color, look.material, moving, state, happy, reaction, gaze])
  // The existing interaction hook writes gaze from touch/pointer/device inputs to a ref.
  // Sample without React renders, and release the loop on pause, overlays and unmount.
  useEffect(() => {
    if (!moving || !gaze) { avatar.current?.update({ lookAt: null }); return }
    let x = NaN, y = NaN
    return startPuppetLoop(() => {
      const current = gaze.current
      if (current.x === x && current.y === y) return
      x = current.x; y = current.y
      avatar.current?.update({ lookAt: { x, y } })
    })
  }, [moving, gaze])
  return <span ref={host} className="og-dots-character" data-renderer="open-bot-avatar" data-avatar={definition.id} data-active={activeNow} data-motion={moving} data-lantern={lantern} aria-hidden="true">
    <span className="og-dots-avatar-poster" dangerouslySetInnerHTML={{ __html: poster }}/>
    <span ref={surface} className="og-dots-avatar-surface"/>
  </span>
}
