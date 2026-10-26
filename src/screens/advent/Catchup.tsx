import { Copy, ExternalLink, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatCode } from '../../lib/advent'
import { api, errorText, isDemo } from '../../lib/api'
import { appLink, storyLink } from '../../lib/links'
import { canPayStars, copyText, haptic, openInvoice, openLink, shareLink } from '../../lib/tg'
import type { AdventCatchup, AdventState, CatchupMethod, RewardContent, RewardKind } from '../../lib/types'
import { track } from '../../lib/track'
import { useStore } from '../../store'
import { Cta, Emoji, Sheet, Spinner, Tap } from '../../ui'
import { Video } from '../Lesson'
import { Markdown } from '../../Markdown'

// Билеты «догнать» и содержимое призов. Всё, что даёт билет, проверяет сервер:
// урок с квизом без ошибок, друг, подписавшийся на канал, переход по ссылке из сторис, оплата звёздами.

const METHOD: Record<CatchupMethod, { emoji: string; title: string; how: string }> = {
  quiz: { emoji: '🧠', title: 'Пройди урок с квизом без ошибок', how: 'Любой урок ленты с квизом, пройденный на все правильные ответы во время календаря.' },
  invite: { emoji: '🤝', title: 'Приведи друга', how: 'Билет придёт, когда друг откроет приложение по твоей ссылке и подпишется на канал.' },
  story: { emoji: '📲', title: 'Выложи сторис', how: 'Билет придёт, когда по ссылке из сторис кто-то зайдёт в приложение. До 5 билетов.' },
  stars: { emoji: '⭐', title: 'Купи билет', how: 'Оплата звёздами Telegram. Вопрос по оплате — /paysupport в чате с ботом.' },
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Шторка «Как догнать»: сколько билетов, чем их заработать и кнопка для каждого способа. */
export function CatchupSheet({ open, onClose, data, reload }: { open: boolean; onClose: () => void; data: AdventState; reload: () => Promise<AdventState | null> }) {
  const { toast, guard } = useStore.getState()
  const me = useStore((s) => s.me)
  const c: AdventCatchup = data.catchup ?? { methods: [], stars: 0, tickets: 0, used: 0, earned: {} }
  const [busy, setBusy] = useState<CatchupMethod | null>(null)

  useEffect(() => {
    if (open) track('catchup', { step: 'open', tickets: c.tickets })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const buy = async () => {
    if (busy) return
    if (!isDemo && !canPayStars) return toast('Оплата звёздами работает в приложении Telegram')
    setBusy('stars')
    try {
      const link = await api.adventTicketInvoice()
      if (!link) {
        await reload()
        haptic.success()
        return toast('В демо билет начислен условно, звёзды не списаны', '🎟')
      }
      const status = await openInvoice(link)
      if (status !== 'paid') {
        if (status === 'failed') toast('Оплата не прошла. Звёзды не списаны')
        return
      }
      // Билет выдаёт сервер, когда Telegram подтвердит оплату, — ждём пару секунд.
      for (let i = 0; i < 8; i++) {
        const fresh = await reload()
        if ((fresh?.catchup?.tickets ?? 0) > c.tickets) {
          haptic.success()
          return toast('Билет получен', '🎟')
        }
        await wait(1200)
      }
      toast('Оплата прошла. Билет появится через минуту')
    } catch (e) {
      guard(e)
      toast(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const invite = () => {
    const link = appLink()
    if (!link) return toast('Ссылка появится, когда бот будет настроен')
    shareLink(link, 'Залетай в OG CRE8R² — там адвент-календарь с призами.')
  }

  // Сторис: та же шторка «Поделиться», но со ссылкой, которая засчитывает переход автору.
  const story = () => {
    const link = storyLink()
    if (!link || !me) return toast('Ссылка появится, когда бот будет настроен')
    onClose()
    useStore.setState({
      share: {
        kind: 'level',
        gradient: 'candy',
        chip: data.title,
        emoji: '🎟',
        title: 'Открываю двери',
        big: `${data.opened} из ${data.days}`,
        bigFirst: true,
        sub: 'Адвент-календарь в OG CRE8R²',
        caption: 'Открываю адвент-календарь в OG CRE8R². Заходи по ссылке — там призы.',
        link,
      },
    })
  }

  const action: Record<CatchupMethod, { label: string; run: () => void }> = {
    quiz: {
      label: 'К урокам',
      run: () => {
        onClose()
        // Закрываем календарь: уроки — на главной.
        const stack = useStore.getState().stack
        if (stack.length) useStore.setState({ stack: [] })
        useStore.getState().setTab('home')
      },
    },
    invite: { label: 'Позвать', run: invite },
    story: { label: 'Выложить', run: story },
    stars: { label: `За ${c.stars}`, run: buy },
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="flex items-center gap-3">
        <Emoji char="🎟" size={40} />
        <div>
          <p className="font-display text-[19px] font-semibold leading-tight">Билеты «догнать»</p>
          <p className="mt-0.5 text-[13.5px] text-mute">Один билет открывает одну пропущенную дверь — за половину XP.</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="flex-1 rounded-[16px] border border-line bg-card p-3 text-center">
          <p className="font-display text-[24px] font-semibold leading-none">{c.tickets}</p>
          <p className="mt-1 text-[12px] text-mute">свободно</p>
        </div>
        <div className="flex-1 rounded-[16px] border border-line bg-card p-3 text-center">
          <p className="font-display text-[24px] font-semibold leading-none">{c.used}</p>
          <p className="mt-1 text-[12px] text-mute">потрачено</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {c.methods.length === 0 && <p className="py-4 text-center text-[14px] text-mute">Автор пока не включил способы догнать.</p>}
        {c.methods.map((m) => (
          <div key={m} className="flex items-center gap-3 rounded-[18px] border border-line bg-card p-3">
            <Emoji char={METHOD[m].emoji} size={28} />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold leading-tight">
                {METHOD[m].title}
                {(c.earned[m] ?? 0) > 0 && <span className="ml-1.5 text-[12px] font-semibold text-mint">+{c.earned[m]}</span>}
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-mute">{METHOD[m].how}</p>
            </div>
            <Tap
              onClick={() => {
                track('catchup', { step: 'try', method: m })
                action[m].run()
              }}
              disabled={!!busy} className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-inverse px-3.5 text-[13px] font-bold text-on-inverse disabled:opacity-50">
              {busy === m ? <Spinner size={16} /> : m === 'stars' ? <Star size={13} fill="currentColor" strokeWidth={0} /> : null}
              {busy === m ? '' : action[m].label}
            </Tap>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] leading-snug text-faint">Билеты проверяет сервер: одно действие даёт один билет. Серия за пропущенные дни не растёт.</p>
    </Sheet>
  )
}

/** Что внутри выданного приза. Промокод показывается отдельно — у него своя плашка с кодом. */
export function RewardBody({ kind, content }: { kind: RewardKind; content: RewardContent | null | undefined }) {
  const push = useStore((s) => s.push)
  const toast = useStore((s) => s.toast)
  if (!content) return null
  if (kind === 'message') return <div className="mt-3 min-w-0 rounded-[16px] border border-line bg-bg p-3.5">
    <Markdown text={content.text ?? ''} />
    <Tap className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line text-[13px] font-semibold" onClick={async () => {
      if (await copyText(content.text ?? '')) { haptic.success(); toast('Набор скопирован', '📋') }
    }}><Copy size={15} /> Скопировать весь набор</Tap>
  </div>
  if (kind === 'video' && content.url) {
    return (
      <div className="mt-3">
        <Video url={content.url} />
      </div>
    )
  }
  if (kind === 'link' && content.url) {
    return (
      <Cta tone="quiet" className="mt-3 w-full" onClick={() => openLink(content.url!)}>
        <ExternalLink size={16} /> {content.label || 'Открыть'}
      </Cta>
    )
  }
  if (kind === 'lesson' && content.lesson_id) {
    return (
      <Cta tone="quiet" className="mt-3 w-full" onClick={() => push({ type: 'lesson', id: content.lesson_id! })}>
        Открыть урок
      </Cta>
    )
  }
  if (kind === 'course' && content.course_id) {
    return (
      <Cta tone="quiet" className="mt-3 w-full" onClick={() => push({ type: 'course', id: content.course_id! })}>
        Открыть курс
      </Cta>
    )
  }
  if (kind === 'certification' && content.certification_id) return <Cta tone="quiet" className="mt-3 w-full" onClick={() => push({type:'certifications',focusId:content.certification_id})}>Открыть маршрут сертификации</Cta>
  return null
}

/** Плашка с промокодом: крупно, нажатие копирует. */
export function PromoCode({ code, redeemed = false }: { code: string; redeemed?: boolean }) {
  const toast = useStore((s) => s.toast)
  const copy = async () => {
    if (await copyText(code)) {
      haptic.success()
      toast('Код скопирован', '📋')
    }
  }
  return (
    <Tap onClick={copy} aria-label="Скопировать код" className={`mt-3 w-full rounded-[16px] border border-line bg-bg px-4 py-3 text-center font-mono text-[22px] font-bold tracking-[0.18em] ${redeemed ? 'text-faint line-through' : ''}`}>
      {formatCode(code)}
    </Tap>
  )
}

export const KIND_NAME: Record<RewardKind, string> = {
  promo: 'Промокод',
  message: 'Сообщение',
  link: 'Ссылка',
  video: 'Видео',
  lesson: 'Урок',
  course: 'Курс',
  certification: 'Сертификация',
}
