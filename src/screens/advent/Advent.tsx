import { Check, ChevronLeft, Copy, Lock } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { dayMonth, formatCode, KIND_LABEL } from '../../lib/advent'
import { api } from '../../lib/api'
import { GRADIENTS } from '../../lib/game'
import { copyText, haptic, inTelegram } from '../../lib/tg'
import type { AdventCell, AdventReward, AdventState } from '../../lib/types'
import { useStore } from '../../store'
import { Bar, Emoji, Pattern, Tap } from '../../ui'
import { doorsWord, Snow } from './Banner'

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

  const tapDoor = (cell: AdventCell) => {
    if (!data) return
    if (cell.state === 'locked') {
      haptic.error()
      return toast(`Откроется ${doorDate(data.start, cell.day)}`, '🔒')
    }
    if (cell.state === 'missed') return toast('Календарь закрыт — эту дверь уже не открыть')
    push({ type: 'door', day: cell.day })
  }

  const g = GRADIENTS.ocean
  return (
    <motion.div {...slide}>
      <div className="scroll h-full" style={{ paddingBottom: 'calc(48px + var(--bottom))' }}>
        <div className="relative overflow-hidden px-5 pb-12" style={{ background: g.css, color: g.ink, paddingTop: 'calc(var(--top) + 58px)' }}>
          <Pattern name="ocean" full />
          <Snow />
          <div className="relative">
            <p className="w-fit rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
              {!data ? 'Календарь' : data.today < 1 ? `Старт ${dayMonth(data.start)}` : data.today > data.days ? 'Финал' : `День ${data.today} из ${data.days}`}
            </p>
            <h1 className="mt-3 font-display text-[27px] font-semibold leading-[1.1]">{data?.title ?? 'Адвент-календарь'}</h1>
            {data && (
              <div className="mt-4 flex flex-wrap gap-2 text-[13px] font-semibold">
                <span className="flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1.5">
                  <Emoji char="🔥" size={16} /> серия {data.streak}
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1.5">
                  <Emoji char="🚪" size={16} /> открыто {data.opened} из {data.days}
                </span>
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
                  <DoorCell key={cell.day} cell={cell} index={i} onTap={() => tapDoor(cell)} />
                ))}
              </div>
              <p className="mt-3 text-center text-[12.5px] leading-snug text-faint">Пропущенную дверь можно догнать — за половину XP. Серия растёт, только если открывать в свой день.</p>

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

      {!inTelegram && (
        <Tap onClick={pop} aria-label="Назад" className="absolute left-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md" style={{ top: 'calc(var(--top) + 10px)' }}>
          <ChevronLeft size={22} />
        </Tap>
      )}
    </motion.div>
  )
}

function DoorCell({ cell, index, onTap }: { cell: AdventCell; index: number; onTap: () => void }) {
  const base = 'relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-[20px] border'
  const style: Record<AdventCell['state'], string> = {
    today: 'border-transparent text-white shadow-[0_10px_30px_rgb(124_107_255_/_0.45)]',
    open: 'border-line bg-card',
    late: 'border-dashed border-amber/60 bg-card',
    locked: 'border-line bg-card/50 text-faint',
    missed: 'border-line bg-card/40 opacity-45',
  }
  return (
    <Tap
      feedback={cell.state === 'locked' ? 'none' : 'tap'}
      onClick={onTap}
      aria-label={`Дверь ${cell.day}`}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index, 24) * 0.018, type: 'spring', stiffness: 380, damping: 26 }}
      className={`${base} ${style[cell.state]}`}
      style={cell.state === 'today' ? { background: 'var(--aurora)' } : undefined}
    >
      {cell.state === 'today' && <motion.span className="absolute inset-0 rounded-[20px] border-2 border-white/70" animate={{ opacity: [0.9, 0.2, 0.9] }} transition={{ duration: 1.8, repeat: Infinity }} />}
      {/* У закрытой двери номер и так крупно по центру — в углу его не дублируем. */}
      {cell.state !== 'locked' && <span className={`absolute left-2 top-1.5 font-display text-[11px] font-bold ${cell.state === 'today' ? 'text-white/85' : 'text-faint'}`}>{cell.day}</span>}
      {cell.state === 'locked' ? (
        <>
          <span className="font-display text-[22px] font-semibold opacity-60">{cell.day}</span>
          <Lock size={12} className="mt-0.5 opacity-60" />
        </>
      ) : (
        <>
          <Emoji char={cell.emoji ?? '🎁'} size={30} animated={cell.state === 'today'} />
          <span className={`mt-1 text-[10px] font-bold uppercase tracking-wide ${cell.state === 'today' ? 'text-white' : cell.state === 'late' ? 'text-amber' : 'text-mute'}`}>
            {cell.state === 'today' ? 'Сегодня' : cell.state === 'late' ? 'Догнать' : cell.state === 'open' ? `+${cell.xp ?? 0}` : KIND_LABEL[cell.kind]}
          </span>
        </>
      )}
      {cell.state === 'open' && (
        <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-mint text-on-mint">
          <Check size={10} strokeWidth={4} />
        </span>
      )}
    </Tap>
  )
}

function RewardRow({ reward, opened }: { reward: AdventReward; opened: number }) {
  const toast = useStore((s) => s.toast)
  const left = Math.max(0, reward.doors - opened)
  const copy = async () => {
    if (reward.code && (await copyText(reward.code))) {
      haptic.success()
      toast('Код скопирован', '📋')
    }
  }
  return (
    <div className={`rounded-[22px] border p-4 ${reward.code && !reward.redeemed ? 'border-violet/40 bg-violet/10' : 'border-line bg-card'}`}>
      <div className="flex items-center gap-3">
        <Emoji char={reward.emoji} size={34} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-semibold leading-tight">{reward.title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-mute">
            {reward.description || `За ${reward.doors} ${doorsWord(reward.doors)}`}
            {reward.stock != null && !reward.code ? ' · количество ограничено' : ''}
          </p>
        </div>
        {!reward.code && <span className="tabular shrink-0 text-[12.5px] font-semibold text-mute">{left > 0 ? `${opened}/${reward.doors}` : '…'}</span>}
      </div>
      {!reward.code && left > 0 && <Bar progress={opened / reward.doors} className="mt-3" />}
      {!reward.code && left === 0 && <p className="mt-2 text-[12.5px] text-faint">Награды этой ступени закончились.</p>}
      {reward.code && (
        <div className="mt-3 flex items-center gap-2">
          <div className={`flex-1 rounded-[16px] border border-line bg-bg px-4 py-3 text-center font-mono text-[22px] font-bold tracking-[0.18em] ${reward.redeemed ? 'text-faint line-through' : ''}`}>
            {formatCode(reward.code)}
          </div>
          {reward.redeemed ? (
            <span className="rounded-full bg-veil/8 px-3 py-2 text-[12px] font-semibold text-mute">Погашен</span>
          ) : (
            <Tap onClick={copy} aria-label="Скопировать код" className="grid h-[52px] w-[52px] place-items-center rounded-[16px] border border-line bg-card">
              <Copy size={18} />
            </Tap>
          )}
        </div>
      )}
      {reward.code && !reward.redeemed && <p className="mt-2 text-[12.5px] text-mute">Покажи код на кассе. Он одноразовый и продублирован в чате с ботом.</p>}
    </div>
  )
}
