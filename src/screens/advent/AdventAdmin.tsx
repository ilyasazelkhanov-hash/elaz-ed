import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { KIND_LABEL } from '../../lib/advent'
import { api, errorText } from '../../lib/api'
import { haptic } from '../../lib/tg'
import type { AdventAdmin, AdventThemeId } from '../../lib/types'
import { useStore } from '../../store'
import { Spinner, Tap } from '../../ui'
import { Header, sheet } from '../Admin'
import { PointsPanel, PulsePanel, WinnersPanel } from './AdventOps'
import { DoorsEditor, RewardsEditor, SettingsForm } from './AdventSetup'
import { THEME_IDS, themeOf, ThemeScene } from './themes'

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

/** Статистика адвента для админа: сколько людей открывают двери и сколько кодов дошло до кассы. */
export function AdventAdminScreen() {
  const { guard, toast, setAdvent } = useStore.getState()
  const [data, setData] = useState<AdventAdmin | null>(null)
  const [saving, setSaving] = useState<AdventThemeId | null>(null)
  // Перечитываем сводку после правки настроек или призов.
  const [version, setVersion] = useState(0)
  const refresh = () => setVersion((v) => v + 1)

  // Оформление меняется у всех участников сразу — поэтому с подтверждающим тостом.
  const pickTheme = async (id: AdventThemeId) => {
    if (saving || data?.theme === id) return
    setSaving(id)
    try {
      await api.adminAdventTheme(id)
      haptic.success()
      setData((d) => (d ? { ...d, theme: id } : d))
      const summary = useStore.getState().advent
      if (summary) setAdvent({ ...summary, theme: id })
      toast(`Оформление: ${themeOf(id).label}`, themeOf(id).emoji)
    } catch (e) {
      toast(errorText(e))
    } finally {
      setSaving(null)
    }
  }

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
  }, [guard, toast, version])

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
            <h2 className="mt-5 font-display text-[16px] font-semibold">Ход календаря</h2>
            <PulsePanel key={version} />

            <h2 className="mt-7 font-display text-[16px] font-semibold">Оформление</h2>
            <p className="mt-1 text-[12.5px] leading-snug text-mute">Меняется сразу у всех участников: шапка, двери, карточка на главной.</p>
            <div className="mt-3 space-y-2">
              {THEME_IDS.map((id) => {
                const t = themeOf(id)
                const on = (data.theme ?? 'standard') === id
                return (
                  <Tap
                    key={id}
                    feedback="none"
                    onClick={() => pickTheme(id)}
                    aria-pressed={on}
                    className="relative flex h-[76px] w-full items-center gap-3 overflow-hidden rounded-[20px] px-4 text-left"
                    style={{ background: t.hero, color: t.ink, outline: on ? '2px solid var(--color-ink)' : '1px solid var(--color-line)', outlineOffset: on ? 2 : 0 }}
                  >
                    <ThemeScene theme={id} compact />
                    <span className="relative text-[28px] leading-none">{t.emoji}</span>
                    <span className="relative min-w-0 flex-1 rounded-[12px] px-2 py-1" style={{ background: 'rgb(0 0 0 / 0.35)' }}>
                      <span className="block font-display text-[15px] font-semibold">{t.label}</span>
                      <span className="block truncate text-[12px] opacity-85">{t.tagline}</span>
                    </span>
                    {saving === id ? <Spinner size={18} /> : on && <span className="relative rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-[#14101f]">Сейчас</span>}
                  </Tap>
                )
              })}
            </div>

            {data.settings && (
              <>
                <h2 className="mt-7 font-display text-[16px] font-semibold">Календарь</h2>
                <SettingsForm key={version} initial={data.settings} doorsDefined={data.doors_defined ?? 0} onSaved={refresh} />
              </>
            )}

            {data.settings && (
              <>
                <h2 className="mt-7 font-display text-[16px] font-semibold">Двери</h2>
                <DoorsEditor days={data.settings.days} />
              </>
            )}

            {data.reward_list && (
              <>
                <h2 className="mt-7 font-display text-[16px] font-semibold">Призы</h2>
                <p className="mt-1 text-[12.5px] leading-snug text-mute">Промокод, сообщение, ссылка, видео, урок или курс. Выдаётся за N дверей, в выбранные дни, случайно или розыгрышем.</p>
                <RewardsEditor list={data.reward_list} onChanged={refresh} />
              </>
            )}

            {data.reward_list && (
              <>
                <h2 className="mt-7 font-display text-[16px] font-semibold">Кто что получил</h2>
                <WinnersPanel key={version} rewards={data.reward_list} />
              </>
            )}

            <h2 className="mt-7 font-display text-[16px] font-semibold">Точки погашения</h2>
            <PointsPanel />

            <div className="mt-7 grid grid-cols-2 gap-2">
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
