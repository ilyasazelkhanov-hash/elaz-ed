import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api, errorText } from '../lib/api'
import { beginnerGuides } from '../lib/beginner-content'
import { coursePaymentTotals, discoveryRate, discoveryTimestamp, type DiscoveryReport } from '../lib/discovery-analytics'
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
            <DiscoveryAnalytics report={data.discovery} />
            <div className="mt-9 border-t border-line pt-6">
              <h2 className="font-display text-[17px] font-semibold">Активность и архивная XP-воронка</h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-mute">Прежние показатели приложения, уроков и стриков. Бесплатная польза измеряется отдельно выше.</p>
            </div>
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

            <Section title="Архивная XP-воронка" hint="За всё время · уроки и стрики">
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

const DISCOVERY_SOURCE: Record<string,string> = {
  direct:'Прямой вход',home:'Главная',free_start:'Бесплатный старт',guide_next:'Следующее упражнение',
  telegram_guide:'Telegram: упражнение',blog:'Блог',post:'Публикация',course:'Курс',
  telegram_post:'Telegram: публикация',telegram_course:'Telegram: курс',
}

/** Pure presentation: no legacy values or demo conversions stand in for missing telemetry. */
export function DiscoveryAnalytics({report}:{report?:DiscoveryReport}) {
  if (!report?.available) return <section aria-label="Бесплатная польза" className="mt-5 rounded-[22px] border border-line bg-card p-4">
    <h2 className="font-display text-[18px] font-semibold">Бесплатная польза</h2>
    <p className="mt-3 text-sm font-semibold">Пока недоступно</p>
    <p className="mt-1 text-[13px] leading-relaxed text-mute">Сервер ещё не прислал новый отчёт. В демо и на старом сервере эти показатели отсутствуют. После запуска измерений понадобится время для накопления данных и завершения окон наблюдения.</p>
  </section>

  const payments = coursePaymentTotals(report.courses)
  return <section aria-label="Бесплатная польза" className="mt-5">
    <div className="rounded-[22px] border border-violet/25 bg-violet/8 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-violet">Новая аналитика</p>
      <h2 className="mt-1 font-display text-[20px] font-semibold">Бесплатная польза</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-mute">Помогают ли упражнения начать и вернуться к чтению. Последние {report.window_days} суток, UTC.</p>
      <p className="mt-3 text-[11.5px] leading-relaxed text-mute">События собираются с {discoveryTimestamp(report.started_at)}.<br/>Срез: {discoveryTimestamp(report.as_of)}. История до начала измерений не восстановлена.</p>
    </div>

    <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
      <DiscoveryRate label="Попробовали за 7 суток" part={report.activation.attempted} whole={report.activation.eligible} waiting={report.activation.waiting}
        hint="Самооценка: нажали «Попробовал». Новые участники за 30 суток с полными 7 сутками наблюдения; попытка в первые 168 часов после регистрации." />
      <DiscoveryRate label="Вернулись на второй неделе" part={report.return14.returned} whole={report.return14.eligible} waiting={report.return14.waiting}
        hint="Чтение упражнения или бесплатной статьи через 168–336 часов после первой отметки «Попробовал». В знаменателе только участники с полными 14 сутками; первая отметка — за 30 суток." />
      <DiscoveryRate label="Повторное чтение за 7 суток" part={report.repeat7.repeated} whole={report.repeat7.readers} empty="Нет читателей за 7 суток"
        hint="Читали в 2 и более разные даты UTC за последние 7 × 24 часа. В знаменателе читатели упражнений и бесплатных статей; закрытые уроки исключены." />
      <DiscoveryRate label="Упражнение помогло" part={report.feedback.positive} whole={report.feedback.responses} empty="Нет ответов"
        hint="Самооценка за 30 суток. Последняя оценка каждой пары «участник + упражнение»; один участник может оценить несколько упражнений." />
    </div>

    <Section title="Бесплатные упражнения" hint="Уникальные участники за 30 суток в каждом действии. «Попробовал» — самооценка, а не проверка навыка.">
      {report.guides.length === 0 ? <Empty>Открытий упражнений пока нет.</Empty> : <div className="space-y-2">
        {report.guides.map(guide => <article key={guide.id ?? 'unknown'} className="rounded-[18px] border border-line bg-card p-4">
          <h3 className="text-[14px] font-semibold leading-snug">{beginnerGuides.find(item => item.id === guide.id)?.title ?? guide.id ?? 'Неизвестное упражнение'}</h3>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            <Count label="Открыли" value={guide.opened}/><Count label="Скопировали" value={guide.copied}/><Count label="Попробовали" value={guide.tried}/>
          </dl>
        </article>)}
      </div>}
    </Section>

    <Section title="Откуда пришли новички" hint="Первый зафиксированный вход в разделы у новых участников за 30 суток. Участники без такого события в список не входят.">
      {report.sources.length === 0 ? <Empty>Источники новых участников пока не зафиксированы.</Empty> : <dl className="overflow-hidden rounded-[18px] border border-line bg-card">
        {report.sources.map(source => <div key={source.source} className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
          <dt className="min-w-0 break-words text-[13px]">{DISCOVERY_SOURCE[source.source] ?? source.source}</dt><dd className="shrink-0 font-display text-[15px] font-semibold">{source.users}</dd>
        </div>)}
      </dl>}
    </Section>

    <Section title="Интерес к курсам" hint="За 30 суток. Просмотры, бесплатные уроки и начало оплаты — независимые количества уникальных участников, без обязательной последовательности.">
      {report.courses.length === 0 ? <Empty>Курсов для отчёта пока нет.</Empty> : <div className="space-y-3">
        {report.courses.map(course => <article key={course.id} className="rounded-[20px] border border-line bg-card p-4">
          <h3 className="text-[15px] font-semibold leading-snug">{course.title}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 min-[440px]:grid-cols-3">
            <Count label="Смотрели курс" value={course.viewed}/><Count label="Открыли бесплатный урок" value={course.previewed}/>
            <Count label="Начали оплату" value={course.checkout_users}/><Count label="Покупателей без возврата" value={course.buyers}/>
          </dl>
          <div className="mt-4 rounded-[14px] bg-veil/5 p-3">
            <p className="text-[12px] text-mute">Покупка в течение 7 суток от начала оплаты</p>
            <p className="mt-1 font-display text-[24px] font-semibold">{discoveryRate(course.converted,course.mature_checkout_users)}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-mute">{course.converted} из {course.mature_checkout_users} с полными 7 сутками наблюдения. Ожидают полного окна: {course.checkout_users-course.mature_checkout_users}.</p>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-mute">Покупок без возврата: {course.purchases} · звёзд: {course.stars}.<br/>Возвращено: {course.refunded} покупок на {course.refunded_stars} звёзд. Ожидают возврата: {course.refund_pending}.</p>
        </article>)}
      </div>}
    </Section>

    <Section title="Оплаты курсов в Telegram Stars" hint="Только покупки, подтверждённые сервером, за последние 30 суток. Статус возврата — на момент среза.">
      <div className="rounded-[20px] border border-line bg-card p-4">
        <p className="text-[12px] text-mute">Звёзды без возвратов и ожидающих возврата</p>
        <p className="mt-2 font-display text-[28px] font-semibold">{payments.stars} <span className="text-[15px]">Stars</span></p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-mute">Покупок без возврата: {payments.purchases}.<br/>Возвращено: {payments.refunded} покупок на {payments.refunded_stars} звёзд.<br/>Ожидают возврата: {payments.refund_pending} покупок; исключены из суммы выше.</p>
        <p className="mt-3 border-t border-line pt-3 text-[11.5px] leading-relaxed text-mute">Это остаток звёзд по покупкам периода с учётом текущих возвратов, а не денежная выручка. Отметка клиента об успешной оплате не подтверждает покупку. Возвращённые и ожидающие возврата покупки также исключены из конверсии.</p>
      </div>
    </Section>
  </section>
}

function DiscoveryRate({label,part,whole,waiting,hint,empty='Нет завершённых наблюдений'}:{label:string;part:number;whole:number;waiting?:number;hint:string;empty?:string}) {
  return <div className="min-w-0 rounded-[20px] border border-line bg-card p-4">
    <h3 className="text-[13px] font-semibold leading-snug">{label}</h3>
    <p className="mt-3 font-display text-[28px] font-semibold leading-none">{discoveryRate(part,whole)}</p>
    <p className="mt-2 text-[12px] text-mute">{whole > 0 ? `${part} из ${whole}` : empty}</p>
    {waiting !== undefined && <p className="mt-1 text-[11.5px] text-mute">Ожидают полного окна: {waiting}</p>}
    <p className="mt-3 text-[11.5px] leading-relaxed text-mute">{hint}</p>
  </div>
}

function Count({label,value}:{label:string;value:number}) {
  return <div className="flex min-w-0 flex-col"><dt className="mt-1 break-words text-[11.5px] leading-snug text-mute">{label}</dt><dd className="order-first font-display text-[20px] font-semibold">{value}</dd></div>
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
