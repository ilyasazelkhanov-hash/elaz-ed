import { useEffect, useRef, useState } from 'react'
import { GRADIENTS } from '../../lib/game'
import type { GradientName } from '../../lib/types'
import { useDocumentVisible, useElementVisible, usePrefersReducedMotion } from '../../lib/visibility'
import { Emoji, Pattern } from '../../ui'
import { courseGuide } from '../../lib/academy-guidance'

// The same cover materials as the OG home carousel, with a stable identity per direction.
const identities: Record<string, { gradient: GradientName; emoji: string }> = {
  CORE: { gradient: 'aurora', emoji: '🧠' }, VC: { gradient: 'mint', emoji: '⚡' },
  ENG: { gradient: 'ocean', emoji: '🛠️' }, AU: { gradient: 'lime', emoji: '⚙️' },
  AG: { gradient: 'aurora', emoji: '🤖' }, CR: { gradient: 'sunset', emoji: '🎬' },
  DS: { gradient: 'candy', emoji: '🎨' }, MK: { gradient: 'sunset', emoji: '📣' },
  DT: { gradient: 'ocean', emoji: '🔎' }, BI: { gradient: 'lime', emoji: '🚀' },
}
export function academyIdentity(code = 'CORE') {
  return identities[code.replace(/^DIR-/, '').match(/^[A-Z]+/)?.[0] || 'CORE'] || identities.CORE
}
export function Cover({ code, compact = false }: { code?: string; compact?: boolean }) {
  const reduce = usePrefersReducedMotion(), identity = academyIdentity(code), g = GRADIENTS[identity.gradient]
  const coverRef = useRef<HTMLDivElement>(null)
  const visible = useElementVisible(coverRef, !reduce)
  const documentVisible = useDocumentVisible(!reduce)
  const animationPlayState = visible && documentVisible && !reduce ? 'running' : 'paused'
  const [imageLoaded, setImageLoaded] = useState(false)
  const size = compact ? 84 : 124
  useEffect(() => setImageLoaded(false), [identity.emoji])
  if (code && courseGuide(code)) return <div className={`academy-cover academy-illustrated-cover ${compact ? 'is-compact' : ''}`} aria-hidden="true">
    <img src={`/learning/academy/${code.split('-')[0].toLowerCase()}.svg`} alt="" width="720" height="360" loading="lazy"/>
    <span className="academy-cover-sticker">{code} / AI ACADEMY</span>
  </div>
  return <div ref={coverRef} className={`academy-cover ${compact ? 'is-compact' : ''}`} style={{ background: g.css, color: g.ink }} aria-hidden="true">
    <Pattern name={identity.gradient} full />
    <span className="academy-cover-word">{code?.replace(/^DIR-/, '').split('-')[0] || 'AI'}</span>
    <div className="academy-cover-emoji" style={{ width:size, height:size }}>
      <span className="academy-cover-emoji-fallback floaty" style={{ fontSize:size * .84, opacity:imageLoaded ? 0 : 1, animationPlayState }}>{identity.emoji}</span>
      <span className="academy-cover-emoji-image floaty" style={{ opacity:imageLoaded ? 1 : 0, animationPlayState }} onLoadCapture={() => setImageLoaded(true)} onErrorCapture={() => setImageLoaded(false)}><Emoji char={identity.emoji} size={size} animated={!reduce}/></span>
    </div>
    <span className="academy-cover-sticker">OG CRE8R²</span>
  </div>
}
