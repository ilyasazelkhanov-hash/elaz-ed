import { Check, ChevronLeft, Lock } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { dayMonth, KIND_LABEL } from '../../lib/advent'
import { api, isDemo } from '../../lib/api'
import { plural } from '../../lib/game'
import { haptic, inTelegram } from '../../lib/tg'
import type { AdventCell, AdventReward, AdventState, AdventThemeId } from '../../lib/types'
import { useStore } from '../../store'
import { Bar, Emoji, Tap } from '../../ui'
import { doorsWord } from './Banner'
import { CatchupSheet, KIND_NAME, PromoCode, RewardBody } from './Catchup'
import { DoorSkin, doorInk, doorShape, OpeningLeaf, THEME_IDS, themeOf, ThemeScene } from './themes'

/** Дата двери: старт кампании + (день − 1). */
export function doorDate(start: string, day: number) {
  const d = new Date(`${start}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + day - 1)
  return dayMonth(d.toISOString().slice(0, 10))
}

export const slide = {
  className: 'absolute inset-0 z-30 bg-bg',
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%' },
  transition: { type: 'spring' as const, stiffness: 300, damping: 34, mass: 0.9 },
}

/** Календарь: сетка дверей, серия, путь до следующей награды и выданные коды. */
export function AdventScreen() {
  const { pop, push, guard, toast, setAdvent } = useStore.getState()
  // Перечитываем календарь, когда снова оказываемся сверху — например, после закрытия двери.
  const onTop = useStore((s) => s.stack.at(-1)?.type === 'advent')
  const [data, setData] = useState<AdventState | null>(null)
  const [failed, setFailed] = useState(false)
  const [catchup, setCatchup] = useState(false)

  const apply = (d: AdventState) => {
    setData(d)
    setFailed(false)
    setAdvent({
      title: d.title,
      theme: d.theme,
      start: d.start,
      days: d.days,
      today: d.today,
      opened: d.opened,
      today_open: d.doors.some((c) => c.day === d.today && c.state === 'open'),
      streak: d.streak,
    })
  }
  // Перечитать после покупки билета: шторка ждёт, пока сервер его выдаст.
  const reload = () =>
    api
      .advent()
      .then((d) => {
        apply(d)
        return d
      })
      .catch(() => null)

  useEffect(() => {
    if (!onTop) return
    let alive = true
    api
      .advent()
      .then((d) => {
        if (!alive) return
        setData(d)
        setFailed(false)
        setAdvent({
          title: d.title,
          theme: d.theme,
          start: d.start,
          days: d.days,
          today: d.today,
          opened: d.opened,
          today_open: d.doors.some((c) => c.day === d.today && c.state === 'open'),
          streak: d.streak,
        })
      })
      .catch((e) => {
        guard(e)
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [onTop, guard, setAdvent])

  const next = useMemo(() => data?.rewards.find((r) => !r.code && r.doors > data.opened) ?? null, [data])

  const locked = (cell: AdventCell) => {
    if (!data) return
    haptic.error()
    if (cell.state === 'missed') return toast('Календарь закрыт — эту дверь уже не открыть')
    toast(`Откроется ${doorDate(data.start, cell.day)}`, '🔒')
  }

  // В демо тему можно примерить прямо здесь. На проде её меняет автор в админке — сразу у всех.
  const [preview, setPreview] = useState<AdventThemeId | null>(null)
  const themeId = preview ?? data?.theme ?? 'standard'
  const theme = themeOf(themeId)
  const pick = (id: AdventThemeId) => {
    haptic.select()
    setPreview(id)
    void api.adminAdventTheme(id).catch(() => {})
    const summary = useStore.getState().advent
    if (summary) setAdvent({ ...summary, theme: id })
  }

  return (
    <motion.div {...slide} className={`${slide.className} ${theme.className}`}>
      <div className="scroll h-full" style={{ paddingBottom: 'calc(48px + var(--bottom))' }}>
        <div className={`relative overflow-hidden px-5 ${themeId === 'standard' ? 'pb-12' : 'pb-20'}`} style={{ background: theme.hero, color: theme.ink, paddingTop: 'calc(var(--top) + 58px)' }}>
          <ThemeScene key={themeId} theme={themeId} />
          <div className="relative">
            <p className="w-fit rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: theme.chip }}>
              {!data ? 'Календарь' : data.today < 1 ? `Старт ${dayMonth(data.start)}` : data.today > data.days ? 'Финал' : `День ${data.today} из ${data.days}`}
            </p>
            <h1 className="mt-3 max-w-[70%] font-display text-[27px] font-semibold leading-[1.1] drop-shadow-[0_2px_10px_rgb(0_0_0_/_0.35)]">{data?.title ?? 'Адвент-календарь'}</h1>
            {data && (
              <div className="mt-4 flex flex-wrap gap-2 text-[13px] font-semibold">
                <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur-sm" style={{ background: theme.chip }}>
                  <Emoji char={themeId === 'halloween' ? '🕯️' : '🔥'} size={16} /> серия {data.streak}
                </span>
                <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur-sm" style={{ background: theme.chip }}>
                  <Emoji char={themeId === 'newyear' ? '🎁' : themeId === 'halloween' ? '🦇' : '🚪'} size={16} /> открыто {data.opened} из {data.days}
                </span>
                {data.catchup && data.catchup.methods.length > 0 && (
                  <Tap feedback="soft" onClick={() => setCatchup(true)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur-sm" style={{ background: theme.chip }}>
                    <Emoji char="🎟" size={16} /> билетов {data.catchup.tickets}
                  </Tap>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="relative -mt-7 rounded-t-[30px] bg-bg px-5 pt-6">
          {failed && !data && <p className="py-10 text-center text-[15px] text-mute">Календарь не загрузился. Закрой и открой ещё раз.</p>}
          {!data && !failed && (
            <div className="grid grid-cols-4 gap-2.5">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="skeleton aspect-square rounded-[20px]" />
              ))}
            </div>
          )}

          {data && (
            <>
              {isDemo && <ThemePicker value={themeId} onPick={pick} />}
              {next && (
                <div className="mb-5 rounded-[22px] border border-line bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Emoji char={next.emoji} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold uppercase tracking-wider text-mute">Следующая награда</p>
                      <p className="truncate font-display text-[15px] font-semibold">{next.title}</p>
                    </div>
                    <p className="tabular text-right text-[13px] font-semibold text-mute">
                      ещё {next.doors - data.opened}
                      <br />
                      {doorsWord(next.doors - data.opened)}
                    </p>
                  </div>
                  <Bar progress={data.opened / next.doors} className="mt-3" />
                </div>
              )}

              <div className="grid grid-cols-4 gap-2.5">
                {data.doors.map((cell, i) => (
                  <DoorCell
                    key={`${themeId}-${cell.day}`}
                    cell={cell}
                    index={i}
                    theme={themeId}
                    needTicket={cell.state === 'late' && (data.catchup?.tickets ?? 0) < 1}
                    onNeedTicket={() => {
                      haptic.error()
                      setCatchup(true)
                    }}
                    onOpen={() => push({ type: 'door', day: cell.day })}
                    onLocked={() => locked(cell)}
                  />
                ))}
              </div>
              <p className="mt-3 text-center text-[12.5px] leading-snug text-faint">
                Пропущенную дверь можно догнать за билет — за половину XP. Серия растёт, только если открывать в свой день.{' '}
                {data.catchup && data.catchup.methods.length > 0 && (
                  <button type="button" onClick={() => setCatchup(true)} className="font-semibold text-ink underline underline-offset-2">
                    Как получить билет
                  </button>
                )}
              </p>

              {data.rewards.length > 0 && (
                <>
                  <h2 className="mt-8 font-display text-[18px] font-semibold">Награды</h2>
                  <div className="mt-3 space-y-2.5">
                    {data.rewards.map((r) => (
                      <RewardRow key={r.id} reward={r} opened={data.opened} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {data && <CatchupSheet open={catchup} onClose={() => setCatchup(false)} data={data} reload={reload} />}

      {!inTelegram && (
        <Tap onClick={pop} aria-label="Назад" className="absolute left-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md" style={{ top: 'calc(var(--top) + 10px)' }}>
          <ChevronLeft size={22} />
        </Tap>
      )}
    </motion.div>
  )
}

function ThemePicker({ value, onPick }: { value: AdventThemeId; onPick: (id: AdventThemeId) => void }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-mute">Оформление · демо</p>
      <div className="grid grid-cols-3 gap-2">
        {THEME_IDS.map((id) => {
          const t = themeOf(id)
          const on = id === value
          return (
            <Tap
              key={id}
              feedback="none"
              onClick={() => onPick(id)}
              aria-pressed={on}
              className="relative h-[68px] overflow-hidden rounded-[18px] p-2.5 text-left"
              style={{ background: t.hero, color: t.ink, outline: on ? '2px solid var(--color-ink)' : '1px solid var(--color-line)', outlineOffset: on ? 2 : 0 }}
            >
              <ThemeScene theme={id} compact />
              <span className="relative block text-[20px] leading-none">{t.emoji}</span>
              <span className="relative mt-1.5 inline-block rounded-full px-1.5 py-0.5 text-[12px] font-bold" style={{ background: 'rgb(0 0 0 / 0.45)' }}>{t.label}</span>
            </Tap>
          )
        })}
      </div>
    </div>
  )
}

/** Дверь в календаре. Открытие — короткая анимация (створка или крышка), потом экран двери. */
interface DoorCellProps {
  cell: AdventCell
  index: number
  theme: AdventThemeId
  /** Пропущенная дверь, а билетов нет — вместо открытия показываем, как их получить. */
  needTicket: boolean
  onNeedTicket: () => void
  onOpen: () => void
  onLocked: () => void
}

function DoorCell({ cell, index, theme, needTicket, onNeedTicket, onOpen, onLocked }: DoorCellProps) {
  const [opening, setOpening] = useState(false)
  const [nudge, setNudge] = useState(0)
  const t = themeOf(theme)
  const ink = doorInk(theme, cell.state)
  const closed = cell.state === 'locked' || cell.state === 'missed'

  const tap = () => {
    if (closed) {
      setNudge((n) => n + 1)
      return onLocked()
    }
    // Уже открытую дверь показываем сразу, новую — после анимации.
    if (cell.state === 'open') {
      haptic.tap()
      return onOpen()
    }
    if (needTicket) {
      setNudge((n) => n + 1)
      return onNeedTicket()
    }
    if (opening) return
    haptic.heavy()
    setOpening(true)
    setTimeout(() => {
      onOpen()
      setOpening(false)
    }, 560)
  }

  return (
    <motion.button
      type="button"
      onClick={tap}
      aria-label={`Дверь ${cell.day}`}
      initial={{ opacity: 0, scale: 0.8, y: 8 }}
      animate={nudge ? { opacity: 1, scale: 1, y: 0, x: [0, -5, 5, -3, 3, 0] } : { opacity: 1, scale: 1, y: 0 }}
      transition={nudge ? { duration: 0.35 } : { delay: Math.min(index, 24) * 0.02, type: 'spring', stiffness: 380, damping: 24 }}
      whileTap={{ scale: 0.94 }}
      className={`relative flex aspect-square flex-col items-center justify-center ${cell.state === 'today' && theme === 'newyear' ? 'fx-gift' : ''}`}
      style={{
        ...doorShape(theme),
        perspective: 500,
        color: ink,
        boxShadow:
          cell.state === 'today'
            ? theme === 'halloween'
              ? '0 0 26px 2px rgb(255 122 26 / 0.55)'
              : theme === 'newyear'
                ? '0 0 24px 2px rgb(255 209 102 / 0.5)'
                : '0 10px 30px rgb(124 107 255 / 0.45)'
            : undefined,
        border: theme === 'standard' && cell.state !== 'today' ? `1px ${cell.state === 'late' ? 'dashed' : 'solid'} var(--color-line)` : theme === 'halloween' && cell.state === 'late' ? '1px dashed #a3ff4f' : 'none',
      }}
    >
      <DoorSkin theme={theme} state={cell.state} day={cell.day} />
      {/* Свет из-за открывающейся двери */}
      {opening && <motion.span className="absolute inset-0" style={{ borderRadius: 'inherit', background: 'radial-gradient(circle, rgb(255 255 255 / 0.95), rgb(255 230 150 / 0.4) 50%, transparent 75%)' }} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1.25 }} transition={{ duration: 0.5 }} />}

      {cell.state === 'today' && theme === 'standard' && <motion.span className="absolute inset-0 border-2 border-white/70" style={{ borderRadius: 'inherit' }} animate={{ opacity: [0.9, 0.2, 0.9] }} transition={{ duration: 1.8, repeat: Infinity }} />}

      {!closed && <span className="absolute left-2 top-1.5 z-[1] font-display text-[11px] font-bold opacity-80">{cell.day}</span>}
      {closed ? (
        theme === 'newyear' ? (
          <span className="relative z-[1] mt-[30%] rounded-md bg-white/95 px-1.5 py-0.5 font-display text-[13px] font-bold text-[#8c1c2c] shadow">{cell.day}</span>
        ) : (
          <>
            <span className="relative z-[1] font-display text-[22px] font-semibold opacity-70" style={theme === 'halloween' ? { color: '#ffb36b', textShadow: '0 0 10px rgb(255 122 26 / 0.45)' } : undefined}>
              {cell.day}
            </span>
            <Lock size={12} className="relative z-[1] mt-0.5 opacity-60" />
          </>
        )
      ) : (
        <span className="relative z-[1] flex flex-col items-center">
          <Emoji char={cell.emoji ?? (theme === 'halloween' ? '🎃' : '🎁')} size={30} animated={cell.state === 'today'} />
          <span className={`mt-1 text-[10px] font-extrabold uppercase tracking-wide ${theme === 'newyear' && cell.state !== 'today' ? 'rounded-full bg-black/35 px-1.5' : ''}`} style={{ color: ink ?? (cell.state === 'late' ? 'var(--color-amber)' : 'var(--color-mute)') }}>
            {cell.state === 'today' ? t.todayLabel : cell.state === 'late' ? 'Догнать' : cell.state === 'open' ? `+${cell.xp ?? 0}` : KIND_LABEL[cell.kind]}
          </span>
        </span>
      )}
      {cell.state === 'open' && (
        <span className="absolute right-1.5 top-1.5 z-[1] grid h-4 w-4 place-items-center rounded-full bg-mint text-on-mint">
          <Check size={10} strokeWidth={4} />
        </span>
      )}

      {/* Створка на петлях или крышка коробки — поверх двери, пока она открывается */}
      {opening &&
        (t.opening === 'lid' ? (
          <motion.span className="absolute inset-0 z-[2]" style={{ borderRadius: 'inherit' }} initial={{ y: 0, rotate: 0, opacity: 1 }} animate={{ y: -46, rotate: -24, opacity: 0 }} transition={{ duration: 0.55, ease: [0.3, 0.7, 0.2, 1] }}>
            <OpeningLeaf theme={theme} />
          </motion.span>
        ) : (
          <motion.span className="absolute inset-0 z-[2]" style={{ borderRadius: 'inherit', transformOrigin: 'left center' }} initial={{ rotateY: 0 }} animate={{ rotateY: -115 }} transition={{ duration: 0.55, ease: [0.3, 0.7, 0.2, 1] }}>
            <OpeningLeaf theme={theme} />
          </motion.span>
        ))}
    </motion.button>
  )
}

/** Как получить приз — одной строкой под названием. */
function modeLine(r: AdventReward) {
  const range = r.day_from && r.day_to ? (r.day_from === r.day_to ? `дня ${r.day_from}` : `дней ${r.day_from}–${r.day_to}`) : ''
  const left = r.left != null && r.stock != null ? ` · осталось ${r.left} из ${r.stock}` : ''
  if (r.mode === 'day') return `Подарок за дверь ${range}${left}`
  if (r.mode === 'instant') return `Может выпасть при открытии двери ${range}${left}`
  if (r.mode === 'draw') return r.drawn ? 'Розыгрыш прошёл' : `Розыгрыш после дня ${r.day_to} среди открывших двери ${range}${r.stock ? ` · призов ${r.stock}` : ''}`
  return null
}

function RewardRow({ reward, opened }: { reward: AdventReward; opened: number }) {
  const kind = reward.kind ?? 'promo'
  const mode = reward.mode ?? 'threshold'
  const line = modeLine(reward)
  // Старый сервер не присылает issued — тогда выданным считаем приз с кодом.
  const issued = reward.issued ?? !!reward.code
  const left = Math.max(0, reward.doors - opened)
  return (
    <div className={`rounded-[22px] border p-4 ${issued && !reward.redeemed ? 'border-violet/40 bg-violet/10' : 'border-line bg-card'}`}>
      <div className="flex items-center gap-3">
        <Emoji char={reward.emoji} size={34} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-semibold leading-tight">{reward.title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-mute">
            {reward.description || `За ${reward.doors} ${doorsWord(reward.doors)}`}
            {mode === 'threshold' && reward.stock != null && !issued ? ' · количество ограничено' : ''}
          </p>
          {line && !issued && <p className="mt-1 text-[12px] font-semibold leading-snug text-violet">{line}</p>}
        </div>
        {issued ? (
          <span className="shrink-0 rounded-full bg-veil/8 px-2.5 py-1 text-[11.5px] font-semibold text-mute">{reward.redeemed ? 'Погашен' : KIND_NAME[kind]}</span>
        ) : mode === 'draw' && !reward.drawn ? (
          <span className="tabular shrink-0 text-right text-[12px] font-semibold leading-tight text-mute">
            {reward.entries ?? 0}
            <br />
            {plural(reward.entries ?? 0, ['шанс', 'шанса', 'шансов'])}
          </span>
        ) : mode === 'threshold' ? (
          <span className="tabular shrink-0 text-[12.5px] font-semibold text-mute">{left > 0 ? `${opened}/${reward.doors}` : '…'}</span>
        ) : null}
      </div>
      {mode === 'threshold' && !issued && left > 0 && <Bar progress={opened / reward.doors} className="mt-3" />}
      {mode === 'threshold' && !issued && left === 0 && <p className="mt-2 text-[12.5px] text-faint">Награды этой ступени закончились.</p>}
      {mode === 'draw' && !issued && !reward.drawn && <p className="mt-2 text-[12px] leading-snug text-faint">Каждая открытая дверь окна — ещё один шанс. Победителей выберет сервер случайно, им придёт сообщение в бот.</p>}
      {issued && kind === 'promo' && reward.code && (
        <>
          <PromoCode code={reward.code} redeemed={reward.redeemed} />
          {!reward.redeemed && <p className="mt-2 text-[12.5px] text-mute">Покажи код на кассе. Он одноразовый и продублирован в чате с ботом.</p>}
        </>
      )}
      {issued && kind !== 'promo' && <RewardBody kind={kind} content={reward.content} />}
    </div>
  )
}
