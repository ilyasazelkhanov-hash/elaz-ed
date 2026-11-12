import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useGifAutoplay } from './lib/gif-preference'
import { isGifCoverUrl } from '../supabase/functions/_shared/cover-media'

const motionQuery = '(prefers-reduced-motion: reduce)'
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(motionQuery)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const reducedMotion = () => window.matchMedia(motionQuery).matches

type CoverProps = { src: string; className?: string; loading?: 'lazy' | 'eager'; onOpen?: () => void; openLabel?: string }

/** GIFs remain animated files. A canvas holds a still frame without re-encoding or CORS reads. */
export function CoverImage({ src, className = '', loading = 'lazy', onOpen, openLabel }: CoverProps) {
  return <CoverImageContent key={src} src={src} className={className} loading={loading} onOpen={onOpen} openLabel={openLabel}/>
}

function CoverImageContent({ src, className, loading, onOpen, openLabel }: CoverProps) {
  const reduce = useSyncExternalStore(subscribe, reducedMotion, () => true)
  const autoplay = useGifAutoplay()
  const [poster, setPoster] = useState(false)
  const [failed, setFailed] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const gif = isGifCoverUrl(src)
  const playing = autoplay && !reduce
  const capture = (source: HTMLImageElement) => {
    const target = canvas.current
    if (!target || !source.naturalWidth || !source.naturalHeight) return
    const scale = Math.min(1, 1600 / Math.max(source.naturalWidth, source.naturalHeight))
    target.width = Math.max(1, Math.round(source.naturalWidth * scale))
    target.height = Math.max(1, Math.round(source.naturalHeight * scale))
    const context = target.getContext('2d')
    if (!context) return
    try { context.drawImage(source, 0, 0, target.width, target.height); setPoster(true) } catch { /* Keep the still placeholder. */ }
  }
  useEffect(() => { if (!playing && image.current) capture(image.current) }, [playing])
  if (!gif) {
    const still = <img src={src} alt="" loading={loading} decoding="async" className={className}/>
    return onOpen ? <button type="button" onClick={onOpen} aria-label={openLabel ?? 'Открыть публикацию'} className="block w-full">{still}</button> : still
  }
  return <div className={`relative overflow-hidden bg-card ${className}`} data-gif-cover="true">
    <canvas ref={canvas} role="img" aria-label="Неподвижный кадр обложки" className="h-full max-h-[inherit] w-full object-cover" style={{ display: playing || !poster ? 'none' : 'block' }}/>
    <img ref={image} src={failed ? undefined : src} alt="" loading={loading} decoding="async" onLoad={event => capture(event.currentTarget)} onError={() => setFailed(true)} className="h-full max-h-[inherit] w-full object-cover" style={playing && !failed ? undefined : { visibility: 'hidden', position: 'absolute', inset: 0 }}/>
    {((!playing && !poster) || failed) && <div className="flex aspect-[2/1] items-center justify-center px-4 text-sm text-mute">{failed ? 'Обложка недоступна' : 'Неподвижная обложка'}</div>}
    {onOpen && <button type="button" onClick={onOpen} aria-label={openLabel ?? 'Открыть публикацию'} className="absolute inset-0"/>}
  </div>
}
