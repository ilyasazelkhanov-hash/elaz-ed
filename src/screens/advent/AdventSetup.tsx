import { Dices, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, errorText } from '../../lib/api'
import { confirmDialog, haptic } from '../../lib/tg'
import type { AdminDoor, AdminReward, AdventSettings, CatchupMethod, DoorKind, RewardKind, RewardMode } from '../../lib/types'
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

const MODES: { id: RewardMode; label: string; hint: string }[] = [
  { id: 'threshold', label: 'За N дверей', hint: 'Получает каждый, кто открыл нужное число дверей, пока есть лимит.' },
  { id: 'day', label: 'Подарок дней', hint: 'Получает тот, кто открыл дверь одного из выбранных дней, пока есть лимит.' },
  { id: 'instant', label: 'Случайный', hint: 'Выпадает случайно при открытии двери в окне. Шанс подстраивается под темп, чтобы весь лимит разошёлся к концу окна, а не в первый день. Одному человеку — не больше одного.' },
  { id: 'draw', label: 'Розыгрыш', hint: 'После последнего дня окна сервер выберет победителей. Каждая открытая дверь окна — один шанс: открыл 7 дверей — 7 шансов. Победителям придёт сообщение.' },
]

const blank = (): AdminReward => ({ title: '', description: '', emoji: '🎁', doors: 3, stock: null, position: 0, kind: 'promo', payload: {}, mode: 'threshold', day_from: null, day_to: null })

const modeLabel = (r: AdminReward) => {
  const range = r.day_from && r.day_to ? `дни ${r.day_from}–${r.day_to}` : ''
  if (r.mode === 'day') return `подарок, ${range}`
  if (r.mode === 'instant') return `случайный, ${range}`
  if (r.mode === 'draw') return r.drawn_at ? 'разыгран' : `розыгрыш, ${range}`
  return `за ${r.doors}`
}

export function RewardsEditor({ list, onChanged }: { list: AdminReward[]; onChanged: () => void }) {
  const toast = useStore((s) => s.toast)
  const [edit, setEdit] = useState<AdminReward | null>(null)
  const [drawing, setDrawing] = useState<number | null>(null)

  // Розыгрыш раньше конца окна — по кнопке, с подтверждением: повторить его нельзя.
  const draw = async (r: AdminReward) => {
    if (!r.id || !(await confirmDialog(`Разыграть «${r.title}» сейчас? Победителей выберет сервер среди открывших двери ${r.day_from}–${r.day_to}. Повторить розыгрыш нельзя.`))) return
    setDrawing(r.id)
    try {
      const n = await api.adminAdventDraw(r.id)
      haptic.success()
      toast(n ? `Победителей: ${n}. Им пришло сообщение` : 'Участников в окне не было')
      onChanged()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setDrawing(null)
    }
  }
  return (
    <>
      <div className="mt-3 overflow-hidden rounded-[20px] border border-line bg-card">
        {list.map((r) => (
          <Tap key={r.id} onClick={() => setEdit({ ...r, payload: { ...r.payload } })} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0">
            <Emoji char={r.emoji} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-semibold">{r.title}</span>
              <span className="block text-[12px] text-mute">
                {KIND_NAME[r.kind]} · {modeLabel(r)} · {r.stock == null ? 'без лимита' : `всего ${r.stock}`}
              </span>
            </span>
            {r.mode === 'draw' && !r.drawn_at && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  void draw(r)
                }}
                className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-line px-3 text-[12.5px] font-semibold text-mute"
              >
                {drawing === r.id ? <Spinner size={14} /> : <Dices size={14} />} Разыграть
              </span>
            )}
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

      <p className="mb-1.5 mt-4 text-[12.5px] font-semibold text-mute">Как выдаётся</p>
      <div className="grid grid-cols-2 gap-1.5">
        {MODES.map((m) => (
          <Tap
            key={m.id}
            feedback="select"
            onClick={() => setR((p) => ({ ...p, mode: m.id, day_from: m.id === 'threshold' ? null : (p.day_from ?? 1), day_to: m.id === 'threshold' ? null : (p.day_to ?? 24) }))}
            className={`h-10 rounded-[12px] text-[13px] font-semibold ${r.mode === m.id ? 'bg-inverse text-on-inverse' : 'border border-line bg-card text-mute'}`}
          >
            {m.label}
          </Tap>
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-faint">{MODES.find((m) => m.id === r.mode)?.hint}</p>

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
        {r.mode === 'threshold' ? (
          <label>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">За сколько дверей</span>
            <input type="number" inputMode="numeric" min={1} max={60} value={r.doors} onChange={(e) => set('doors', Math.max(1, Number(e.target.value) || 1))} className={field} />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            <label>
              <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">С дня</span>
              <input type="number" inputMode="numeric" min={1} max={60} value={r.day_from ?? 1} onChange={(e) => set('day_from', Math.max(1, Number(e.target.value) || 1))} className={field} />
            </label>
            <label>
              <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">по</span>
              <input type="number" inputMode="numeric" min={1} max={60} value={r.day_to ?? 1} onChange={(e) => set('day_to', Math.max(1, Number(e.target.value) || 1))} className={field} />
            </label>
          </div>
        )}
        <label>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">Сколько всего</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={r.stock ?? ''}
            placeholder={r.mode === 'instant' || r.mode === 'draw' ? 'обязательно' : 'без лимита'}
            onChange={(e) => set('stock', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
            className={field}
          />
        </label>
      </div>
      {r.mode === 'draw' && r.drawn_at && <p className="mt-2 text-[12px] text-amber">Розыгрыш уже прошёл — окно и лимит менять бессмысленно.</p>}
      <Cta className="mt-4 w-full" busy={busy === 'save'} onClick={save}>
        Сохранить приз
      </Cta>
    </div>
  )
}

// ---------- Двери ----------

const DOOR_KINDS: { id: DoorKind; label: string; hint: string }[] = [
  { id: 'quiz', label: 'Квиз', hint: 'Вопросы с вариантами. Правильные ответы проверяет сервер, до открытия их не видно.' },
  { id: 'scratch', label: 'Скретч', hint: 'Стираешь слой — под ним приз-текст.' },
  { id: 'arcade', label: 'Аркада', hint: 'Мини-игра на время. Очки сверх потолка XP не дают.' },
  { id: 'story', label: 'История', hint: 'Просто текст: совет, история, анонс.' },
]

const blankDoor = (day: number): AdminDoor => ({ day, kind: 'quiz', title: '', subtitle: '', emoji: '🎁', body: '', quiz: [{ q: '', options: ['', ''], correct: 0 }], prize: '', arcade: { seconds: 30, cap: 40 }, xp: 30 })

/** Сетка дней календаря: заведённые двери с иконкой, пустые — с плюсом. */
export function DoorsEditor({ days }: { days: number }) {
  const { toast, guard } = useStore.getState()
  const [doors, setDoors] = useState<AdminDoor[] | null>(null)
  const [edit, setEdit] = useState<AdminDoor | null>(null)
  const load = () =>
    api
      .adminAdventDoors()
      .then(setDoors)
      .catch((e) => {
        guard(e)
        toast(errorText(e))
      })
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const byDay = new Map((doors ?? []).map((d) => [d.day, d]))
  const total = Math.max(days, ...(doors ?? []).map((d) => d.day))
  return (
    <>
      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {!doors && Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton aspect-square rounded-[12px]" />)}
        {doors &&
          Array.from({ length: total }, (_, i) => i + 1).map((day) => {
            const d = byDay.get(day)
            return (
              <Tap
                key={day}
                onClick={() => setEdit(d ? { ...d, quiz: d.quiz.map((q) => ({ ...q, options: [...q.options] })), arcade: { ...d.arcade } } : blankDoor(day))}
                className={`relative grid aspect-square place-items-center rounded-[12px] border ${d ? 'border-line bg-card' : 'border-dashed border-veil/20 text-faint'} ${day > days ? 'opacity-50' : ''}`}
              >
                <span className="absolute left-1 top-0.5 text-[9px] font-bold text-faint">{day}</span>
                {d ? <Emoji char={d.emoji} size={22} /> : <Plus size={14} />}
              </Tap>
            )
          })}
      </div>
      <p className="mt-2 text-[12px] text-faint">Нажми на день, чтобы настроить дверь. Бледные дни — за пределами календаря.</p>
      <Sheet open={!!edit} onClose={() => setEdit(null)}>
        {edit && (
          <DoorForm
            key={edit.day}
            initial={edit}
            exists={byDay.has(edit.day)}
            onDone={() => {
              setEdit(null)
              void load()
            }}
          />
        )}
      </Sheet>
    </>
  )
}

function DoorForm({ initial, exists, onDone }: { initial: AdminDoor; exists: boolean; onDone: () => void }) {
  const toast = useStore((s) => s.toast)
  const [d, setD] = useState<AdminDoor>(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const set = <K extends keyof AdminDoor>(k: K, v: AdminDoor[K]) => setD((p) => ({ ...p, [k]: v }))
  const setQ = (i: number, patch: Partial<AdminDoor['quiz'][number]>) => set('quiz', d.quiz.map((q, j) => (j === i ? { ...q, ...patch } : q)))

  const save = async () => {
    if (!d.title.trim()) return toast('Нужно название')
    setBusy('save')
    try {
      await api.adminAdventDoorSave({ ...d, quiz: d.quiz.map((q) => ({ ...q, options: q.options.filter((o) => o.trim()) })) })
      haptic.success()
      toast(`Дверь ${d.day} сохранена`)
      onDone()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(null)
    }
  }
  const remove = async () => {
    if (!(await confirmDialog(`Удалить дверь ${d.day}?`))) return
    setBusy('delete')
    try {
      await api.adminAdventDoorDelete(d.day)
      toast('Дверь удалена')
      onDone()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="scroll max-h-[72vh] pb-2">
      <div className="flex items-center justify-between">
        <p className="font-display text-[18px] font-semibold">Дверь {d.day}</p>
        {exists && (
          <Tap onClick={remove} aria-label="Удалить дверь" className="grid h-9 w-9 place-items-center rounded-full border border-line text-rose">
            {busy === 'delete' ? <Spinner size={16} /> : <Trash2 size={16} />}
          </Tap>
        )}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {DOOR_KINDS.map((k) => (
          <Tap key={k.id} feedback="select" onClick={() => set('kind', k.id)} className={`h-10 rounded-[12px] text-[13px] font-semibold ${d.kind === k.id ? 'bg-inverse text-on-inverse' : 'border border-line bg-card text-mute'}`}>
            {k.label}
          </Tap>
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-faint">{DOOR_KINDS.find((k) => k.id === d.kind)?.hint}</p>

      <div className="mt-3 flex gap-2">
        <input value={d.emoji} onChange={(e) => set('emoji', e.target.value)} maxLength={8} className={`${field.replace('w-full', 'w-16 shrink-0')} text-center`} aria-label="Эмодзи" />
        <input value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="Название" maxLength={80} className={field} />
      </div>
      <input value={d.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Подзаголовок" maxLength={160} className={`${field} mt-2`} />
      <textarea value={d.body} onChange={(e) => set('body', e.target.value)} rows={3} placeholder="Текст после открытия (Markdown)" className={`${field} mt-2 resize-y`} />

      {d.kind === 'quiz' && (
        <div className="mt-3 space-y-3">
          {d.quiz.map((q, i) => (
            <div key={i} className="rounded-[14px] border border-line bg-bg p-3">
              <div className="flex items-center gap-2">
                <input value={q.q} onChange={(e) => setQ(i, { q: e.target.value })} placeholder={`Вопрос ${i + 1}`} className={field} />
                <Tap onClick={() => set('quiz', d.quiz.filter((_, j) => j !== i))} aria-label="Убрать вопрос" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-faint">
                  <Trash2 size={15} />
                </Tap>
              </div>
              {q.options.map((o, j) => (
                <div key={j} className="mt-1.5 flex items-center gap-2">
                  <Tap feedback="select" onClick={() => setQ(i, { correct: j })} aria-label="Правильный ответ" className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[12px] font-bold ${q.correct === j ? 'border-mint bg-mint text-on-mint' : 'border-line text-faint'}`}>
                    {'АБВГ'[j]}
                  </Tap>
                  <input value={o} onChange={(e) => setQ(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} placeholder="Вариант" className={field} />
                </div>
              ))}
              {q.options.length < 4 && (
                <Tap onClick={() => setQ(i, { options: [...q.options, ''] })} className="mt-1.5 text-[12.5px] font-semibold text-violet">
                  + вариант
                </Tap>
              )}
              <input value={q.explain ?? ''} onChange={(e) => setQ(i, { explain: e.target.value })} placeholder="Пояснение после ответа" className={`${field} mt-1.5`} />
            </div>
          ))}
          {d.quiz.length < 10 && (
            <Tap onClick={() => set('quiz', [...d.quiz, { q: '', options: ['', ''], correct: 0 }])} className="text-[13px] font-semibold text-violet">
              + вопрос
            </Tap>
          )}
          <p className="text-[12px] text-faint">Зелёная буква — правильный ответ.</p>
        </div>
      )}
      {d.kind === 'scratch' && <textarea value={d.prize} onChange={(e) => set('prize', e.target.value)} rows={2} placeholder="Что под защитным слоем" className={`${field} mt-3 resize-y`} />}
      {d.kind === 'arcade' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">Секунд в раунде</span>
            <input type="number" inputMode="numeric" min={10} max={120} value={d.arcade.seconds ?? 30} onChange={(e) => set('arcade', { ...d.arcade, seconds: Number(e.target.value) })} className={field} />
          </label>
          <label>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">Потолок очков</span>
            <input type="number" inputMode="numeric" min={1} max={1000} value={d.arcade.cap ?? 40} onChange={(e) => set('arcade', { ...d.arcade, cap: Number(e.target.value) })} className={field} />
          </label>
        </div>
      )}
      <label className="mt-3 block">
        <span className="mb-1.5 block text-[12.5px] font-semibold text-mute">XP за дверь</span>
        <input type="number" inputMode="numeric" min={0} max={500} value={d.xp} onChange={(e) => set('xp', Math.max(0, Number(e.target.value) || 0))} className={field} />
      </label>
      <Cta className="mt-4 w-full" busy={busy === 'save'} onClick={save}>
        Сохранить дверь
      </Cta>
    </div>
  )
}
