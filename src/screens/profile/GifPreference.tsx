import { useGifAutoplay, setGifAutoplayEnabled } from '../../lib/gif-preference'
import { usePrefersReducedMotion } from '../../lib/visibility'

/** One discoverable control replaces repeated controls over every cover. */
export function GifPreference() {
  const enabled = useGifAutoplay()
  const reduce = usePrefersReducedMotion()
  return <div className="mx-5 mt-3 rounded-[24px] border border-line bg-card/80 p-4">
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-[15px] font-medium">
      GIF-анимация
      <input type="checkbox" checked={enabled} onChange={event => setGifAutoplayEnabled(event.currentTarget.checked)} aria-describedby="gif-preference-hint" className="h-6 w-6 shrink-0 accent-violet"/>
    </label>
    <p id="gif-preference-hint" className="mt-1 text-xs leading-relaxed text-mute">{reduce ? 'На устройстве включено уменьшение движения: обложки остаются неподвижными.' : 'Для всех обложек в этом браузере. Если выключить, останется неподвижный кадр.'}</p>
  </div>
}
