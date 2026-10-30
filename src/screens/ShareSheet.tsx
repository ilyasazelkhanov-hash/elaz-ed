import { Download, Link2, MessageCircle, Share2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, errorText, isDemo } from '../lib/api'
import { appLink } from '../lib/links'
import { newsShareText } from '../../supabase/functions/_shared/news'
import { blobToBase64, renderCard, type ShareCard } from '../lib/shareCard'
import { canDownload, canShareMessage, canShareStory, downloadFile, haptic, shareLink, shareMessage, shareToStory } from '../lib/tg'
import { track } from '../lib/track'
import { useStore } from '../store'
import { Sheet, Spinner, Tap } from '../ui'

const FILE_NAME = 'elaz-ed.jpg'

/** Шторка «Поделиться»: собирает картинку для сторис и предлагает способы её отправить. */
export function ShareSheet() {
  const card = useStore((s) => s.share)
  // Во время анимации закрытия карточки в сторе уже нет — показываем последнюю.
  const last = useRef(card)
  if (card) last.current = card
  return (
    <Sheet open={!!card} focusManaged onClose={() => useStore.setState({ share: null })}>
      {last.current && <Body key={`${last.current.kind}-${last.current.lessonId ?? ''}-${last.current.title}`} card={last.current} />}
    </Sheet>
  )
}

function Body({ card }: { card: ShareCard }) {
  const me = useStore((s) => s.me)
  const bot = useStore((s) => s.meta.bot.username)
  const toast = useStore((s) => s.toast)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [captionReady, setCaptionReady] = useState(card.kind !== 'lesson' || !card.lessonId)
  const hosted = useRef<string | null>(null)
  const captionCache = useRef<Promise<string> | null>(null)
  const link = card.link ?? appLink(card.lessonId)

  useEffect(() => {
    let alive = true
    let url: string | null = null
    renderCard(card, me?.name ?? '', bot)
      .then((b) => {
        if (!alive) return
        url = URL.createObjectURL(b)
        setBlob(b)
        setPreview(url)
      })
      .catch(() => toast('Картинка не собралась. Попробуй ещё раз'))
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
    // Карточка у шторки одна на всё время жизни — пересобирать незачем.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const file = useMemo(() => (blob ? new File([blob], FILE_NAME, { type: 'image/jpeg' }) : null), [blob])
  const canNative = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  const canStory = canShareStory && !isDemo
  const sent = (channel: string) => track('share', { kind: card.kind, channel }, card.lessonId)
  const shareCaption = () => {
    if (card.kind !== 'lesson' || !card.lessonId) return Promise.resolve(card.caption)
    captionCache.current ??= api.lesson(card.lessonId).then(lesson => newsShareText(lesson))
    return captionCache.current.catch(error => { captionCache.current = null; throw error })
  }
  // Prepare the excerpt before a click: native share sheets need user activation.
  useEffect(() => {
    let alive = true
    shareCaption().then(() => { if (alive) setCaptionReady(true) }).catch(() => {
      if (alive) toast('Не удалось подготовить текст. Открой «Поделиться» ещё раз')
    })
    return () => { alive = false }
    // This component is keyed by the shared card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Telegram публикует и сохраняет картинку только по ссылке — загружаем её один раз.
  const hostedUrl = async () => {
    if (hosted.current || !blob) return hosted.current
    hosted.current = await api.shareUpload(await blobToBase64(blob), card.kind)
    return hosted.current
  }

  const run = async (name: string, action: () => Promise<void>) => {
    if (busy) return
    setBusy(name)
    try {
      await action()
    } catch (e) {
      // Человек закрыл системное окно «Поделиться» — это не ошибка.
      if (!(e instanceof DOMException && e.name === 'AbortError')) toast(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const native = () =>
    run('native', async () => {
      const caption = await shareCaption()
      await navigator.share({ files: [file!], text: link ? `${caption}\n\n${link}` : caption })
      sent('native')
    })

  // Сообщение с картинкой и кнопкой «Открыть»: Telegram сам покажет выбор чата.
  const toChat = () =>
    run('chat', async () => {
      if (!(await hostedUrl())) return
      const id = await api.shareMessage(card.kind, card.lessonId)
      if (id && (await shareMessage(id))) {
        haptic.success()
        sent('tg_chat')
      }
    })

  const story = () =>
    run('story', async () => {
      const url = await hostedUrl()
      if (!url) return
      shareToStory(url, await shareCaption(), link)
      sent('tg_story')
    })

  const save = () =>
    run('save', async () => {
      if (canDownload && !isDemo) {
        const url = await hostedUrl()
        if (!url) return
        downloadFile(url, FILE_NAME)
      } else if (preview) {
        const a = document.createElement('a')
        a.href = preview
        a.download = FILE_NAME
        a.click()
        haptic.success()
        toast('Картинка сохранена. Добавь её в сторис', '📸')
      }
      sent('save')
    })

  const sendLink = () => run('link', async () => {
    if (!link) return toast('Ссылка появится, когда бот будет настроен')
    shareLink(link, await shareCaption())
    sent('link')
  })

  return (
    <div>
      <p className="text-center font-display text-[18px] font-semibold">Поделиться</p>
      <p className="mt-1 text-center text-[13.5px] text-mute">{canNative ? 'Картинка под сторис: Instagram, Telegram, куда угодно' : 'Сохрани картинку и добавь её в сторис Instagram'}</p>

      <div className="mt-4 flex justify-center">
        <div className="relative aspect-[9/16] h-[40vh] max-h-[380px] overflow-hidden rounded-[22px] border border-line bg-card shadow-[var(--shadow-float)]">
          {preview ? (
            <motion.img src={preview} alt="Картинка для сторис" draggable={false} initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} className="h-full w-full object-cover" />
          ) : (
            <div className="skeleton h-full w-full" />
          )}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {canShareMessage && !isDemo && (
          <Tap onClick={toChat} disabled={!file || !!busy} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[18px] bg-inverse text-[14.5px] font-semibold text-on-inverse disabled:opacity-60">
            {busy === 'chat' ? <Spinner size={18} /> : <MessageCircle size={18} />} Отправить в чат
          </Tap>
        )}
        {canNative && (
          <Tap onClick={native} disabled={!file || !captionReady || !!busy} className="shine flex h-[54px] w-full items-center justify-center gap-2 rounded-[20px] font-display text-[14px] font-semibold text-white disabled:opacity-60" style={{ background: 'var(--aurora)' }}>
            {busy === 'native' ? <Spinner size={20} /> : <Share2 size={18} />} Поделиться картинкой
          </Tap>
        )}
        <div className="flex gap-2">
          {canStory && (
            <Tap onClick={story} disabled={!file || !captionReady || !!busy} className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[18px] border border-line bg-card text-[14px] font-semibold disabled:opacity-60">
              {busy === 'story' && <Spinner size={18} />} В сторис Telegram
            </Tap>
          )}
          <Tap
            onClick={save}
            disabled={!file || !!busy}
            className={`flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[18px] text-[14px] font-semibold disabled:opacity-60 ${canNative ? 'border border-line bg-card' : 'font-display text-white'}`}
            style={canNative ? undefined : { background: 'var(--aurora)' }}
          >
            {busy === 'save' ? <Spinner size={18} /> : <Download size={17} />} Сохранить
          </Tap>
        </div>
        <Tap onClick={sendLink} disabled={!captionReady || !!busy} className="flex h-[48px] w-full items-center justify-center gap-2 rounded-[18px] text-[14px] font-semibold text-mute disabled:opacity-60">
          <Link2 size={17} /> Отправить ссылку
        </Tap>
      </div>
    </div>
  )
}
