import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api, errorText } from '../lib/api'
import type { Analytics } from '../lib/types'
import { useStore } from '../store'
import { EmojiTile, Tap } from '../ui'
import { Header, sheet } from './Admin'

type Metric = 'active' | 'fresh' | 'done'

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'active', label: 'Активные', unit: 'заходили в приложение' },
  { id: 'fresh', label: 'Новые', unit: 'пришли впервые' },
  { id: 'done', label: 'Уроки', unit: 'уроков пройдено' },
]

const SHARE_KIND: Record<string, string> = { level: 'Уровень', lesson: 'Урок', streak: 'Стрик', achievement: 'Ачивка' }
const SHARE_CHANNEL: Record<string, string> = { native: 'системное «Поделиться»', tg_story: 'сторис Telegram', save: 'сохранили картинку', link: 'ссылка в Telegram' }

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

export function AnalyticsScreen() {
  const { guard, toast } = useStore.getState()
  const [data, setData] = useState<Analytics | null>(null)
  const [metric, setMetric] = useState<Metric>('active')

  useEffect(() => {
    let alive = true
    api
      .adminAnalytics()
      .then((d) => alive && setData(d))
      .catch((e) => {
        guard(e)
        toast(errorText(e))
      })
    return () => {
      alive = false
    }
  }, [guard, toast])

  return (
    <motion.div {...sheet} className="absolute inset-0 z-[31] bg-bg">
      <div className="scroll h-full" style={{ paddingTop: 'calc(var(--top) + 16px)', paddingBottom: 'calc(40px + var(--bottom))' }}>
        <Header title="Аналитика" />

        {!data ? (
          <div className="mt-5 space-y-2.5 px-5">
            {[84, 220, 150, 240].map((h) => (
              <div key={h} className="skeleton rounded-[22px]" style={{ height: h }} />
            ))}
          </div>
        ) : (
          <div className="px-5">
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Tile value={data.totals.dau} label="Заходили сегодня" />
              <Tile value={data.totals.wau} label="За 7 дней" />
              <Tile value={data.totals.mau} label="За 30 дней" />
              <Tile value={data.totals.new7} label="Новых за 7 дней" />
            </div>

            <Section title="По дням">
              <div className="mb-4 grid grid-cols-3 gap-1 rounded-[14px] bg-veil/8 p-1">
                {METRICS.map((m) => (
                  <Tap key={m.id} feedback="select" onClick={() => setMetric(m.id)} className={`relative h-9 rounded-[10px] text-[13px] font-semibold ${metric === m.id ? 'text-on-inverse' : 'text-mute'}`}>
                    {metric === m.id && <motion.span layoutId="metric-pill" className="absolute inset-0 rounded-[10px] bg-inverse" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <span className="relative">{m.label}</span>
                  </Tap>
                ))}
              </div>
              <Bars key={metric} points={data.series.map((p) => ({ d: p.d, v: p[metric] }))} unit={METRICS.find((m) => m.id === metric)!.unit} />
            </Section>

            <Section title="Возврат" hint="Доля новичков, которые открыли приложение снова">
              <div className="grid grid-cols-2 gap-2">
                <Rate label="На следующий день" back={data.retention.d1} cohort={data.retention.d1n} />
                <Rate label="Через неделю" back={data.retention.d7} cohort={data.retention.d7n} />
              </div>
            </Section>

            <Section title="Воронка" hint="За всё время">
              <Funnel
                steps={[
                  ['Открыли приложение', data.funnel.opened],
                  ['Подписаны на канал', data.funnel.subscribed],
                  ['Прошли урок', data.funnel.done1],
                  ['Прошли три урока', data.funnel.done3],
                  ['Держали стрик три дня', data.funnel.streak3],
                ]}
              />
            </Section>

            <Section title="Уроки и сторис" hint="Сколько человек открыли и сколько дошли до конца">
              <div className="space-y-2">
                {data.lessons.map((l) => {
                  const rate = Math.min(100, percent(l.done, l.opens))
                  return (
                    <div key={l.id} className="rounded-[18px] border border-line bg-card p-3">
                      <div className="flex items-center gap-3">
                        <EmojiTile emoji={l.emoji} gradient="aurora" size={40} radius={13} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14.5px] font-semibold">{l.title}</p>
                          <p className="mt-0.5 text-[12px] leading-snug text-mute">
                            Открыли {l.opens} · дошли {l.done}
                            {l.quiz != null ? ` · квиз ${l.quiz}%` : ''}
                            <br />
                            Лайков {l.likes} · поделились {l.shares}
                          </p>
                        </div>
                        <span className="font-display text-[14px] font-semibold">{l.opens > 0 ? `${rate}%` : '—'}</span>
                      </div>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--track)' }}>
                        <div className="h-full rounded-full bg-violet" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  )
                })}
                {data.lessons.length === 0 && <Empty>Опубликуй первый урок — здесь появится его статистика.</Empty>}
              </div>
            </Section>

            <Section title="Чем делятся" hint="За 30 дней">
              {data.shares.length === 0 ? (
                <Empty>Пока никто не делился.</Empty>
              ) : (
                <div className="overflow-hidden rounded-[18px] border border-line bg-card">
                  {data.shares.map((s) => (
                    <div key={`${s.kind}-${s.channel}`} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                      <p className="min-w-0 flex-1 truncate text-[14px]">
                        <span className="font-semibold">{SHARE_KIND[s.kind] ?? s.kind}</span>
                        <span className="text-mute"> · {SHARE_CHANNEL[s.channel] ?? s.channel}</span>
                      </p>
                      <span className="font-display text-[14px] font-semibold">{s.n}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="tabular mt-3 text-[13px] text-mute">
                Пришли по приглашениям: {data.invited} · куплено курсов: {data.stars?.count ?? 0} на {data.stars?.total ?? 0} звёзд
              </p>
            </Section>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display text-[15px] font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-[12.5px] text-mute">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[20px] border border-line bg-card p-4">
      <p className="font-display text-[26px] font-semibold leading-none">{value}</p>
      <p className="mt-2 text-[12.5px] text-mute">{label}</p>
    </div>
  )
}

function Rate({ label, back, cohort }: { label: string; back: number; cohort: number }) {
  return (
    <div className="rounded-[20px] border border-line bg-card p-4">
      <p className="font-display text-[26px] font-semibold leading-none">{cohort > 0 ? `${percent(back, cohort)}%` : '—'}</p>
      <p className="mt-2 text-[12.5px] text-mute">{label}</p>
      <p className="mt-0.5 text-[11.5px] text-faint">{cohort > 0 ? `${back} из ${cohort}` : 'пока мало данных'}</p>
    </div>
  )
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-[18px] border border-dashed border-veil/15 px-4 py-6 text-center text-[13.5px] text-mute">{children}</p>
}

/** Столбики по дням: один ряд — один цвет, значение выбранного дня выносится наверх текстом. */
function Bars({ points, unit }: { points: { d: string; v: number }[]; unit: string }) {
  const [selected, setSelected] = useState(points.length - 1)
  const max = Math.max(1, ...points.map((p) => p.v))
  const current = points[selected]
  if (!current) return <Empty>Данных пока нет.</Empty>
  return (
    <div className="rounded-[20px] border border-line bg-card p-4">
      <p className="text-[13px] text-mute">
        <span className="font-display text-[24px] font-semibold text-ink">{current.v}</span> {unit} · {dayLabel(current.d)}
      </p>
      <div className="mt-4 flex h-[132px] items-end gap-[2px] border-b border-line" role="group" aria-label="Значения по дням">
        {points.map((p, i) => (
          <button
            key={p.d}
            type="button"
            aria-label={`${dayLabel(p.d)}: ${p.v}`}
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setSelected(i)}
            className="flex h-full flex-1 items-end"
          >
            <motion.span
              initial={{ height: 0 }}
              animate={{ height: `${p.v > 0 ? Math.max(3, (p.v / max) * 100) : 1}%` }}
              transition={{ duration: 0.5, delay: i * 0.02, ease: [0.16, 1, 0.3, 1] }}
              className="w-full rounded-t-[4px] bg-violet"
            />
          </button>
        ))}
      </div>
      {/* Выбранный день отмечен точкой, а не цветом столбика: так его видно и без различения оттенков. */}
      <div className="mt-1.5 flex gap-[2px]">
        {points.map((p, i) => (
          <span key={p.d} className="flex flex-1 justify-center">
            <span className={`h-1.5 w-1.5 rounded-full ${i === selected ? 'bg-ink' : 'bg-transparent'}`} />
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-faint">
        <span>{dayLabel(points[0].d)}</span>
        <span>{dayLabel(points[points.length - 1].d)}</span>
      </div>
    </div>
  )
}

function Funnel({ steps }: { steps: [label: string, value: number][] }) {
  const first = steps[0]?.[1] ?? 0
  return (
    <div className="space-y-3 rounded-[20px] border border-line bg-card p-4">
      {steps.map(([label, value], i) => (
        <div key={label}>
          <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="min-w-0 truncate">{label}</span>
            <span className="shrink-0 font-semibold">
              {value}
              <span className="font-normal text-mute"> · {percent(value, first)}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: 'var(--track)' }}>
            <motion.div className="h-full rounded-full bg-violet" initial={{ width: 0 }} animate={{ width: `${percent(value, first)}%` }} transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }} />
          </div>
        </div>
      ))}
    </div>
  )
}
