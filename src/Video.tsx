import { Play } from 'lucide-react'
import { openLink } from './lib/tg'
import { Tap } from './ui'

export function Video({ url }: { url: string }) {
  const yt = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([\w-]{11})/.exec(url)?.[1]
  const rt = /rutube\.ru\/video\/([a-f0-9]{32})/.exec(url)?.[1]
  const vk = /vk(?:video)?\.(?:com|ru)\/video(-?\d+)_(\d+)/.exec(url)
  const src = yt ? `https://www.youtube.com/embed/${yt}?playsinline=1&rel=0` : rt ? `https://rutube.ru/play/embed/${rt}` : vk ? `https://vk.com/video_ext.php?oid=${vk[1]}&id=${vk[2]}&hd=2` : null

  if (src) {
    return (
      <div className="aspect-video overflow-hidden rounded-[22px] border border-line bg-black">
        <iframe src={src} title="Видео" className="h-full w-full" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      </div>
    )
  }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return <video src={url} controls playsInline preload="metadata" className="aspect-video w-full rounded-[22px] border border-line bg-black" />
  }
  return (
    <Tap onClick={() => openLink(url)} className="flex w-full items-center gap-3.5 rounded-[22px] border border-line bg-card p-4 text-left">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white" style={{ background: 'var(--aurora)' }}>
        <Play size={18} fill="currentColor" />
      </span>
      <span className="text-[15px] font-semibold">Смотреть видео</span>
    </Tap>
  )
}

