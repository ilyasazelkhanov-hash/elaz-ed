import { KeyRound, Plus, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatCode } from '../../lib/advent'
import { api, errorText } from '../../lib/api'
import { plural } from '../../lib/game'
import { confirmDialog, haptic } from '../../lib/tg'
import type { AdminPoint, AdventPulse, AdventWinner, CatchupMethod } from '../../lib/types'
import { useStore } from '../../store'
import { Cta, Emoji, Sheet, Spinner, Tap } from '../../ui'

// Админка календаря в ходе кампании: темп призов, билеты «догнать», журнал призов и кассы.

const field = 'w-full rounded-[14px] border border-line bg-card px-3.5 py-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-violet/60'

const METHOD_NAME: Record<string, string> = { quiz: 'Квиз без ошибок', invite: 'Друг', story: 'Сторис', stars: 'Звёзды', admin: 'Выдал автор' }
const day = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const { guard, toast } = useStore.getState()
  const [data, setData] = useState<T | null>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let alive = true
    load()
      .then((d) => alive && setData(d))
      .catch((e) => {
        guard(e)
        toast(errorText(e))
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps])
  return [data, () => setVersion((v) => v + 1)] as const
}

/** Ход календаря: какой сегодня день, как расходятся призы и как люди догоняют пропущенное. */
export function PulsePanel() {
  const [p, reload] = useLoad<AdventPulse>(() => api.adminAdventPulse())
  if (!p) return <div className="skeleton mt-3 h-40 rounded-[20px]" />
  const sources = Object.entries(p.catchup.sources)
  const earned = sources.reduce((n, [, s]) => n + s.earned, 0)
  const used = sources.reduce((n, [, s]) => n + s.used, 0)
  const tries = Object.entries(p.catchup.tries) as [CatchupMethod, number][]
  return (
    <div className="mt-3 space-y-2.5">
      <div className="rounded-[20px] border border-line bg-card p-4">
        <p className="font-display text-[22px] font-semibold leading-none">{p.today < 1 ? 'До старта' : p.today > p.days ? 'Календарь закончился' : `День ${p.today} из ${p.days}`}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-veil/10">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, (p.today / p.days) * 100))}%`, background: 'var(--aurora)' }} />
        </div>
      </div>

      <div className="rounded-[20px] border border-line bg-card p-4">
        <p className="text-[13px] font-semibold text-mute">Призы с окном — выдано и ожидалось к сегодня</p>
        <div className="mt-2.5 space-y-2.5">
          {p.pacing.filter((r) => r.mode !== 'threshold').length === 0 && <p className="text-[13px] text-faint">Призов с окном дней нет.</p>}
          {p.pacing
            .filter((r) => r.mode !== 'threshold')
            .map((r) => {
              const ahead = r.expected != null && r.issued > r.expected * 1.3 + 1
              const behind = r.expected != null && r.issued < r.expected * 0.7 - 1
              return (
                <div key={r.id}>
                  <div className="flex items-center gap-2 text-[13.5px]">
                    <Emoji char={r.emoji} size={18} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{r.title}</span>
                    <span className="tabular text-mute">
                      {r.issued}
                      {r.stock != null ? ` / ${r.stock}` : ''}
                    </span>
                  </div>
                  <p className={`mt-0.5 text-[12px] ${ahead || behind ? 'text-amber' : 'text-faint'}`}>
                    {r.mode === 'draw'
                      ? r.drawn
                        ? 'Розыгрыш прошёл'
                        : `Розыгрыш после дня ${r.day_to}`
                      : r.mode === 'day'
                        ? `Подарок дней ${r.day_from}–${r.day_to}`
                        : `Ожидалось к сегодня ≈ ${r.expected}. ${ahead ? 'Расходится быстрее — можно поднять лимит или растянуть окно.' : behind ? 'Расходится медленнее — дальше шанс сам вырастет; в последний день окна разыграется остаток.' : 'Идёт по плану.'}`}
                  </p>
                </div>
              )
            })}
        </div>
      </div>

      <div className="rounded-[20px] border border-line bg-card p-4">
        <p className="text-[13px] font-semibold text-mute">Догнать пропущенное</p>
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
          <Stat value={p.catchup.sheet_users} label={plural(p.catchup.sheet_users, ['искал', 'искали', 'искали']) + ' билет'} />
          <Stat value={earned} label="билетов выдано" />
          <Stat value={used} label="потрачено" />
        </div>
        {sources.length > 0 && (
          <div className="mt-3 space-y-1 text-[13px]">
            {sources.map(([src, s]) => (
              <div key={src} className="flex justify-between">
                <span className="text-mute">{METHOD_NAME[src] ?? src}</span>
                <span className="tabular">
                  {s.earned} · потрачено {s.used}
                  {s.revoked ? ` · отозвано ${s.revoked}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
        {tries.length > 0 && (
          <p className="mt-3 text-[12px] leading-snug text-faint">
            Нажимали: {tries.map(([m, n]) => `${METHOD_NAME[m] ?? m} — ${n}`).join(', ')}. Если способ нажимают, а билетов по нему мало — людям что-то мешает его выполнить.
          </p>
        )}
        <GrantTicket onDone={reload} />
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[14px] bg-veil/5 px-2 py-2.5">
      <p className="font-display text-[19px] font-semibold leading-none">{value}</p>
      <p className="mt-1 text-[11px] leading-tight text-mute">{label}</p>
    </div>
  )
}

/** Корректировка вручную: выдать билеты человеку, у которого что-то пошло не так. */
function GrantTicket({ onDone }: { onDone: () => void }) {
  const toast = useStore((s) => s.toast)
  const [username, setUsername] = useState('')
  const [count, setCount] = useState(1)
  const [busy, setBusy] = useState(false)
  const grant = async () => {
    if (!username.trim()) return
    setBusy(true)
    try {
      const name = await api.adminAdventTicketGrant(username.trim(), count)
      haptic.success()
      toast(`${name}: +${count} ${plural(count, ['билет', 'билета', 'билетов'])}`, '🎟')
      setUsername('')
      onDone()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[12.5px] font-semibold text-mute">Выдать билет вручную</p>
      <div className="flex gap-2">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" autoCapitalize="none" autoCorrect="off" className={field} />
        <input type="number" inputMode="numeric" min={1} max={10} value={count} onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className={`${field.replace('w-full', 'w-16 shrink-0')} text-center`} aria-label="Сколько" />
        <Tap onClick={grant} disabled={!username.trim() || busy} aria-label="Выдать" className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-[14px] bg-inverse text-on-inverse disabled:opacity-50">
          {busy ? <Spinner size={17} /> : <UserPlus size={18} />}
        </Tap>
      </div>
    </div>
  )
}

/** Кто что получил: последние 500 выдач, с фильтром по призу. */
export function WinnersPanel({ rewards }: { rewards: { id?: number; title: string }[] }) {
  const [filter, setFilter] = useState(0)
  const [list] = useLoad<AdventWinner[]>(() => api.adminAdventWinners(filter || undefined), [filter])
  return (
    <div className="mt-3">
      <select value={filter} onChange={(e) => setFilter(Number(e.target.value))} className={field}>
        <option value={0}>Все призы</option>
        {rewards.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title}
          </option>
        ))}
      </select>
      <div className="mt-2 overflow-hidden rounded-[20px] border border-line bg-card">
        {!list && <div className="skeleton h-24" />}
        {list?.length === 0 && <p className="px-4 py-6 text-center text-[13.5px] text-mute">Пока никто ничего не получил.</p>}
        {list?.map((w) => (
          <div key={w.code} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
            <Emoji char={w.emoji} size={24} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">
                {w.name}
                {w.username && <span className="font-normal text-mute"> @{w.username}</span>}
              </p>
              <p className="truncate text-[12px] text-mute">
                {w.reward} · {day(w.issued_at)}
                {w.kind === 'promo' ? ` · ${formatCode(w.code)}` : ''}
              </p>
            </div>
            {w.kind === 'promo' && (
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${w.status === 'redeemed' ? 'bg-mint/15 text-mint' : 'bg-veil/8 text-mute'}`}>
                {w.status === 'redeemed' ? `погашен${w.point ? ` · ${w.point}` : ''}` : 'не погашен'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Точки погашения: кассы с PIN. Страница кассира — /?redeem. */
export function PointsPanel() {
  const [points, reload] = useLoad<AdminPoint[]>(() => api.adminAdventPoints())
  const [edit, setEdit] = useState<{ id?: number; name: string } | null>(null)
  const appUrl = typeof location !== 'undefined' ? `${location.origin}/?redeem` : '/?redeem'
  return (
    <>
      <div className="mt-3 overflow-hidden rounded-[20px] border border-line bg-card">
        {!points && <div className="skeleton h-16" />}
        {points?.length === 0 && <p className="px-4 py-6 text-center text-[13.5px] text-mute">Касс пока нет — промокоды гасить негде.</p>}
        {points?.map((p) => (
          <Tap key={p.id} onClick={() => setEdit({ id: p.id, name: p.name })} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0">
            <KeyRound size={18} className="shrink-0 text-mute" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-semibold">{p.name}</span>
              <span className="block text-[12px] text-mute">
                погашено {p.redeemed}
                {p.locked ? ' · заблокирована после неверных PIN' : ''}
              </span>
            </span>
          </Tap>
        ))}
      </div>
      <Cta tone="quiet" className="mt-3 w-full" onClick={() => setEdit({ name: '' })}>
        <Plus size={17} /> Новая касса
      </Cta>
      <p className="mt-2 text-[12px] leading-snug text-faint">Кассир открывает {appUrl}, выбирает точку и вводит PIN. После 8 неверных PIN точка блокируется на 15 минут.</p>
      <Sheet open={!!edit} onClose={() => setEdit(null)}>
        {edit && (
          <PointForm
            key={edit.id ?? 'new'}
            initial={edit}
            onDone={() => {
              setEdit(null)
              reload()
            }}
          />
        )}
      </Sheet>
    </>
  )
}

function PointForm({ initial, onDone }: { initial: { id?: number; name: string }; onDone: () => void }) {
  const toast = useStore((s) => s.toast)
  const [name, setName] = useState(initial.name)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const save = async () => {
    if (!name.trim()) return toast('Нужно название')
    if (!initial.id && !/^\d{4,8}$/.test(pin)) return toast('PIN — от 4 до 8 цифр')
    setBusy('save')
    try {
      await api.adminAdventPointSave({ id: initial.id, name: name.trim(), pin: pin || undefined })
      haptic.success()
      toast(pin ? 'Касса сохранена, PIN обновлён' : 'Касса сохранена')
      onDone()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(null)
    }
  }
  const remove = async () => {
    if (!initial.id || !(await confirmDialog(`Удалить кассу «${initial.name}»?`))) return
    setBusy('delete')
    try {
      await api.adminAdventPointDelete(initial.id)
      toast('Касса удалена')
      onDone()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-display text-[18px] font-semibold">{initial.id ? 'Касса' : 'Новая касса'}</p>
        {initial.id && (
          <Tap onClick={remove} aria-label="Удалить кассу" className="grid h-9 w-9 place-items-center rounded-full border border-line text-rose">
            {busy === 'delete' ? <Spinner size={16} /> : <Trash2 size={16} />}
          </Tap>
        )}
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название: «Кофейня на Абая»" maxLength={60} className={`${field} mt-3`} />
      <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" placeholder={initial.id ? 'Новый PIN — оставь пустым, чтобы не менять' : 'PIN, 4–8 цифр'} className={`${field} mt-2`} />
      <p className="mt-2 text-[12px] leading-snug text-faint">PIN хранится в зашифрованном виде — посмотреть его потом нельзя, только задать новый. Новый PIN снимает блокировку.</p>
      <Cta className="mt-4 w-full" busy={busy === 'save'} onClick={save}>
        Сохранить
      </Cta>
    </div>
  )
}
