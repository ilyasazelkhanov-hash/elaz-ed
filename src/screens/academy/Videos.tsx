import { useEffect, useState } from 'react'
import { openLink } from '../../lib/tg'
import { Tap } from '../../ui'
import { panel } from './shared'

type Clip = { id: string; title: string; category: string; seconds: number; src: string; captions?: string; poster?: string; description: string; lesson_codes?: string[] }
const base = '/learning/academy/videos/'
let pending: Promise<Clip[]> | undefined
function loadVideos() {
  return pending ??= fetch(base + 'manifest.json').then(async response => {
    if (!response.ok) throw Error('unavailable')
    const body = await response.json()
    if (!Array.isArray(body.videos)) throw Error('invalid_manifest')
    return body.videos.filter((clip: Clip) => typeof clip.title === 'string' && typeof clip.id === 'string' && /^[a-z0-9-]+\.mp4$/.test(clip.src)) as Clip[]
  }).catch(error => { pending = undefined; throw error })
}
function useVideos() {
  const [clips, setClips] = useState<Clip[]>([]), [error, setError] = useState(false), [revision, setRevision] = useState(0), [loading, setLoading] = useState(true)
  useEffect(() => { let active = true; setLoading(true); setError(false); loadVideos().then(data => { if (active) setClips(data) }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [revision])
  return { clips, error, loading, retry: () => setRevision(value => value + 1) }
}
function VideoCard({ clip }: { clip: Clip }) {
  const src = base + clip.src
  const poster = clip.poster && /^(?:\.\.\/creative\/)?[a-z0-9-]+\.png$/.test(clip.poster) ? base + clip.poster : undefined
  return <section className={panel}>
    <p className="academy-kicker">{clip.category} · {clip.seconds} сек</p><h2 className="mt-3 font-display text-[19px] font-semibold">{clip.title}</h2>
    <p className="mt-3 text-sm leading-relaxed text-mute">{clip.description}</p>
    <video aria-label={clip.title} controls playsInline preload="metadata" poster={poster} className="mt-5 max-h-[65vh] w-full object-contain rounded-2xl bg-black" src={src}>
      {clip.captions && /^[a-z0-9-]+\.vtt$/.test(clip.captions) && <track kind="captions" src={base + clip.captions} srcLang="ru" label="Русские субтитры" default/>}
    </video>
    <Tap className="academy-chip mt-4" onClick={() => openLink(src)}>Открыть MP4 отдельно</Tap>
  </section>
}
export function Videos() {
  const resource = useVideos()
  return <><div><p className="academy-kicker">Готовые файлы</p><h1 className="mt-3 font-display text-[28px] font-semibold">Видео и демонстрации</h1><p className="mt-3 text-sm leading-relaxed text-mute">Учебные примеры и демонстрации продукта подписаны отдельно. Выбери видео и нажми воспроизведение.</p></div>
    {resource.loading && <p role="status">Загружаем видео…</p>}
    {resource.error && <section role="alert" className={panel}><p>Не удалось загрузить видео.</p><Tap className="academy-chip mt-3" onClick={resource.retry}>Повторить</Tap></section>}
    {resource.clips.map(clip => <VideoCard key={clip.id} clip={clip}/>)}
  </>
}
export function LessonVideos({ code }: { code: string }) {
  const resource = useVideos(), clips = resource.clips.filter(clip => clip.lesson_codes?.includes(code))
  if (!clips.length) return null
  return <div className="space-y-4" aria-label="Видео к занятию">{clips.map(clip => <VideoCard key={clip.id} clip={clip}/>)}</div>
}
