import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api, errorText } from '../../lib/api'
import { confirmDialog, haptic } from '../../lib/tg'
import type { AdminReward, AdventSettings, CatchupMethod, RewardKind } from '../../lib/types'
import { useStore } from '../../store'
import { Cta, Emoji, Sheet, Spinner, Tap } from '../../ui'
import { KIND_NAME } from './Catchup'

// Админка календаря: число дней и способы догнать, редактор призов.

const field = 'w-full rounded-[14px] border border-line bg-card px-3.5 py-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-violet/60'

const METHODS: { id: CatchupMethod; label: string }[] = [
  { id: 'quiz', label: 'Урок с квизом без ошибок' },
  { id: 'invite', label: 'Приглашённый друг' },
  { id: 'story', label: 'Переход по ссылке из сторис' },
  { id: 'stars', label: 'Оплата звёздами' },
]

const KINDS: RewardKind[] = ['promo', 'message', 'link', 'video', 'lesson', 'course']
const KIND_HINT: Record<RewardKind, string> = {
  promo: 'Каждому — свой одноразовый код. Погашение на странице кассира /?redeem, видно, кто и где использовал.',
  message: 'Текст откроется в календаре и придёт в чат с ботом.',
  link: 'Кнопка со ссылкой: подарок, файл, форма записи.',
  video: 'YouTube, Rutube, VK или ссылка на mp4 — откроется прямо в календаре.',
  lesson: 'Откроет один урок закрытого курса, без всего курса.',
  course: 'Откроет курс целиком.',
}

export function SettingsForm({ initial, doorsDefined, onSaved }: { initial: AdventSettings; doorsDefined: number; onSaved: () => void }) {
  const toast = useStore((s) => s.toast)
  const [d, setD] = useState<AdventSettings>(initial)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof AdventSettings>(k: K, v: AdventSettings[K]) => setD((p) => ({ ...p, [k]: v }))
  const toggle = (m: CatchupMethod) => set('catchup', { ...d.catchup, methods: d.catchup.methods.includes(m) ? d.catchup.methods.filter((x) => x !== m) : [...d.catchup.methods, m] })

  const save = async () => {
    setBusy(true)
    try {
      await api.adminAdventSave(d)
      haptic.success()
      toast('Календарь сохранён')
      onSaved()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 rounded-[20px] border border-line bg-card p-4">
      <Tap feedback="select" onClick={() => set('enabled', !d.enabled)} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="block text-[15px] font-semibold">Календарь включён</span>
          <span className="block text-[12px] text-mute">Выключенный не виден участникам</span>
        </span>
        <Switch on={d.enabled} />
      </Tap>
      <p className="mb-1.5 mt-4 text-[12.5px] font-semibold text-mute">Название</p>
      <input value={d.title} onChange={(e) => set('title', e.target.value)} maxLength={60} className={field} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">Первый день</span>
          <input type="date" value={d.start} onChange={(e) => set('start', e.target.value)} className={field} />
        </label>
        <label>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">Дней</span>
          <input type="number" inputMode="numeric" min={1} max={60} value={d.days} onChange={(e) => set('days', Math.max(1, Math.min(60, Number(e.target.value) || 1)))} className={field} />
        </label>
      </div>
      {d.days > doorsDefined && <p className="mt-2 text-[12px] text-amber">Дверей заведено {doorsDefined}: дни без двери в календаре не появятся.</p>}

      <p className="mb-1.5 mt-5 text-[12.5px] font-semibold text-mute">Чем можно получить билет «догнать»</p>
      <div className="space-y-1.5">
        {METHODS.map((m) => (
          <Tap key={m.id} feedback="select" onClick={() => toggle(m.id)} className="flex w-full items-center justify-between rounded-[14px] border border-line bg-bg px-3.5 py-2.5 text-left text-[14px]">
            {m.label}
            <Switch on={d.catchup.methods.includes(m.id)} />
          </Tap>
        ))}
      </div>
      {d.catchup.methods.includes('stars') && (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">Цена билета, звёзд (50 ≈ 1 $)</span>
          <input type="number" inputMode="numeric" min={1} value={d.catchup.stars} onChange={(e) => set('catchup', { ...d.catchup, stars: Math.max(1, Number(e.target.value) || 1) })} className={field} />
        </label>
      )}
      <Cta className="mt-4 w-full" busy={busy} onClick={save}>
        Сохранить
      </Cta>
    </div>
  )
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className="flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors" style={{ background: on ? 'var(--color-violet)' : 'var(--track-strong)' }}>
      <span className="h-6 w-6 rounded-full bg-white transition-transform" style={{ transform: on ? 'translateX(20px)' : 'none' }} />
    </span>
  )
}

const blank = (): AdminReward => ({ title: '', description: '', emoji: '🎁', doors: 3, stock: null, position: 0, kind: 'promo', payload: {} })

export function RewardsEditor({ list, onChanged }: { list: AdminReward[]; onChanged: () => void }) {
  const [edit, setEdit] = useState<AdminReward | null>(null)
  return (
    <>
      <div className="mt-3 overflow-hidden rounded-[20px] border border-line bg-card">
        {list.map((r) => (
          <Tap key={r.id} onClick={() => setEdit({ ...r, payload: { ...r.payload } })} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0">
            <Emoji char={r.emoji} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-semibold">{r.title}</span>
              <span className="block text-[12px] text-mute">
                {KIND_NAME[r.kind]} · за {r.doors} · {r.stock == null ? 'без лимита' : `лимит ${r.stock}`}
              </span>
            </span>
          </Tap>
        ))}
        {list.length === 0 && <p className="px-4 py-6 text-center text-[13.5px] text-mute">Призов пока нет.</p>}
      </div>
      <Cta tone="quiet" className="mt-3 w-full" onClick={() => setEdit(blank())}>
        <Plus size={17} /> Новый приз
      </Cta>
      <Sheet open={!!edit} onClose={() => setEdit(null)}>
        {edit && (
          <RewardForm
            key={edit.id ?? 'new'}
            initial={edit}
            onDone={() => {
              setEdit(null)
              onChanged()
            }}
          />
        )}
      </Sheet>
    </>
  )
}

function RewardForm({ initial, onDone }: { initial: AdminReward; onDone: () => void }) {
  const { toast, courses, feed } = useStore.getState()
  const [r, setR] = useState<AdminReward>(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const set = <K extends keyof AdminReward>(k: K, v: AdminReward[K]) => setR((p) => ({ ...p, [k]: v }))
  const pay = (k: keyof AdminReward['payload'], v: string | number | undefined) => setR((p) => ({ ...p, payload: { ...p.payload, [k]: v } }))
  // Урок — только из закрытого курса: уроки ленты и так открыты всем.
  const lessons = feed.filter((l) => l.kind === 'lesson' && l.course_id)

  const save = async () => {
    if (!r.title.trim()) return toast('Нужно название')
    setBusy('save')
    try {
      await api.adminAdventRewardSave(r)
      haptic.success()
      toast('Приз сохранён')
      onDone()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(null)
    }
  }
  const remove = async () => {
    if (!r.id || !(await confirmDialog(`Удалить приз «${r.title}»?`))) return
    setBusy('delete')
    try {
      await api.adminAdventRewardDelete(r.id)
      toast('Приз удалён')
      onDone()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="scroll max-h-[70vh] pb-2">
      <div className="flex items-center justify-between">
        <p className="font-display text-[18px] font-semibold">{r.id ? 'Приз' : 'Новый приз'}</p>
        {r.id && (
          <Tap onClick={remove} aria-label="Удалить приз" className="grid h-9 w-9 place-items-center rounded-full border border-line text-rose">
            {busy === 'delete' ? <Spinner size={16} /> : <Trash2 size={16} />}
          </Tap>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {KINDS.map((k) => (
          <Tap key={k} feedback="select" onClick={() => setR((p) => ({ ...p, kind: k, payload: {} }))} className={`h-10 rounded-[12px] text-[13px] font-semibold ${r.kind === k ? 'bg-inverse text-on-inverse' : 'border border-line bg-card text-mute'}`}>
            {KIND_NAME[k]}
          </Tap>
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-faint">{KIND_HINT[r.kind]}</p>

      <div className="mt-3 flex gap-2">
        <input value={r.emoji} onChange={(e) => set('emoji', e.target.value)} maxLength={8} className={`${field.replace('w-full', 'w-16 shrink-0')} text-center`} aria-label="Эмодзи" />
        <input value={r.title} onChange={(e) => set('title', e.target.value)} placeholder="Название" maxLength={80} className={field} />
      </div>
      <input value={r.description} onChange={(e) => set('description', e.target.value)} placeholder="Описание — видно до получения" maxLength={300} className={`${field} mt-2`} />

      {r.kind === 'message' && <textarea value={r.payload.text ?? ''} onChange={(e) => pay('text', e.target.value)} rows={4} placeholder="Текст приза: секрет, промпт, инструкция" className={`${field} mt-2 resize-y`} />}
      {(r.kind === 'link' || r.kind === 'video') && (
        <>
          <input value={r.payload.url ?? ''} onChange={(e) => pay('url', e.target.value)} placeholder="https://" inputMode="url" className={`${field} mt-2`} />
          {r.kind === 'link' && <input value={r.payload.label ?? ''} onChange={(e) => pay('label', e.target.value)} placeholder="Текст кнопки" maxLength={40} className={`${field} mt-2`} />}
        </>
      )}
      {r.kind === 'lesson' && (
        <select value={r.payload.lesson_id ?? ''} onChange={(e) => pay('lesson_id', Number(e.target.value) || undefined)} className={`${field} mt-2`}>
          <option value="">Выбери урок курса</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      )}
      {r.kind === 'course' && (
        <select value={r.payload.course_id ?? ''} onChange={(e) => pay('course_id', Number(e.target.value) || undefined)} className={`${field} mt-2`}>
          <option value="">Выбери курс</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">За сколько дверей</span>
          <input type="number" inputMode="numeric" min={1} max={60} value={r.doors} onChange={(e) => set('doors', Math.max(1, Number(e.target.value) || 1))} className={field} />
        </label>
        <label>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">Сколько всего</span>
          <input type="number" inputMode="numeric" min={0} value={r.stock ?? ''} placeholder="без лимита" onChange={(e) => set('stock', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} className={field} />
        </label>
      </div>
      <Cta className="mt-4 w-full" busy={busy === 'save'} onClick={save}>
        Сохранить приз
      </Cta>
    </div>
  )
}
