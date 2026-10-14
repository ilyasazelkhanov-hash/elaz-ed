import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { KIND_LABEL } from '../../lib/advent'
import { api, errorText } from '../../lib/api'
import type { AdventAdmin } from '../../lib/types'
import { useStore } from '../../store'
import { Header, sheet } from '../Admin'

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

/** Статистика адвента для админа: сколько людей открывают двери и сколько кодов дошло до кассы. */
export function AdventAdminScreen() {
  const { guard, toast } = useStore.getState()
  const [data, setData] = useState<AdventAdmin | null>(null)

  useEffect(() => {
    let alive = true
    api
      .adminAdvent()
      .then((d) => alive && setData(d))
      .catch((e) => {
        guard(e)
        toast(errorText(e))
      })
    return () => {
      alive = false
    }
  }, [guard, toast])

  const peak = Math.max(1, ...(data?.by_day.map((d) => d.opens) ?? [1]))

  return (
    <motion.div {...sheet} className="absolute inset-0 z-[31] bg-bg">
      <div className="scroll h-full" style={{ paddingTop: 'calc(var(--top) + 16px)', paddingBottom: 'calc(40px + var(--bottom))' }}>
        <Header title="Адвент" />
        {!data ? (
          <div className="mt-5 space-y-2.5 px-5">
            {[84, 220, 150].map((h) => (
              <div key={h} className="skeleton rounded-[22px]" style={{ height: h }} />
            ))}
          </div>
        ) : (
          <div className="px-5">
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Tile value={data.participants} label="Участников" />
              <Tile value={data.opens} label="Открыто дверей" />
            </div>

            <h2 className="mt-7 font-display text-[16px] font-semibold">Двери по дням</h2>
            <div className="mt-3 space-y-1.5">
              {data.by_day.map((d) => (
                <div key={d.day} className="flex items-center gap-3 text-[13px]">
                  <span className="w-6 text-right font-display font-semibold text-mute">{d.day}</span>
                  <div className="relative h-7 flex-1 overflow-hidden rounded-[10px] bg-veil/5">
                    <div className="absolute inset-y-0 left-0 rounded-[10px] bg-violet/30" style={{ width: `${(d.opens / peak) * 100}%` }} />
                    <span className="relative flex h-full items-center px-2.5 font-medium">
                      {d.title} <span className="ml-1.5 text-faint">· {KIND_LABEL[d.kind]}</span>
                    </span>
                  </div>
                  <span className="tabular w-16 text-right font-semibold">
                    {d.opens}
                    {d.late > 0 && <span className="block text-[11px] font-medium text-faint">догнали {d.late}</span>}
                  </span>
                </div>
              ))}
            </div>

            <h2 className="mt-7 font-display text-[16px] font-semibold">Награды</h2>
            <div className="mt-3 overflow-hidden rounded-[20px] border border-line bg-card">
              {data.rewards.map((r) => (
                <div key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold">{r.title}</p>
                    <p className="text-[12px] text-mute">
                      за {r.doors} · выдано {r.issued}
                      {r.stock != null ? ` из ${r.stock}` : ''}
                    </p>
                  </div>
                  <span className="tabular text-right text-[13px] font-semibold">
                    {r.redeemed}
                    <span className="block text-[11px] font-medium text-faint">погашено · {percent(r.redeemed, r.issued)}%</span>
                  </span>
                </div>
              ))}
            </div>

            {data.points.length > 0 && (
              <>
                <h2 className="mt-7 font-display text-[16px] font-semibold">Точки</h2>
                <div className="mt-3 overflow-hidden rounded-[20px] border border-line bg-card">
                  {data.points.map((p) => (
                    <div key={p.name} className="flex items-center justify-between border-b border-line px-4 py-3 text-[14px] last:border-b-0">
                      <span>{p.name}</span>
                      <span className="tabular font-semibold">{p.redeemed}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <p className="mt-6 text-[12.5px] leading-snug text-faint">Двери, награды и точки пока правятся через SQL — шаблоны в content/advent/.</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-card p-3.5">
      <p className="font-display text-[22px] font-semibold leading-none">{value}</p>
      <p className="mt-1.5 text-[12px] text-mute">{label}</p>
    </div>
  )
}
