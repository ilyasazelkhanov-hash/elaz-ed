import { Check, Plus, Star, Trash2, Undo2, UserPlus, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api, ApiError, errorText } from '../lib/api'
import { GRADIENT_NAMES, GRADIENTS, plural } from '../lib/game'
import { confirmDialog, haptic } from '../lib/tg'
import type { AccessRequest, AdminCourse, CourseDraft, GradientName, Payment } from '../lib/types'
import { useStore } from '../store'
import { Cta, EmojiTile, Spinner, Tap } from '../ui'
import { Header, sheet } from './Admin'

const field = 'w-full rounded-[16px] border border-line bg-card px-4 py-3.5 text-[16px] text-ink outline-none placeholder:text-faint focus:border-violet/60'

function Label({ children, hint }: { children: string; hint?: string }) {
  return (
    <p className="mb-2 mt-5 flex items-baseline gap-2 text-[13px] font-semibold text-mute">
      {children}
      {hint && <span className="font-normal text-faint">{hint}</span>}
    </p>
  )
}

/** Курсы и заявки на доступ. */
export function CoursesAdminScreen() {
  const push = useStore((s) => s.push)
  const stackSize = useStore((s) => s.stack.length)
  const { guard, toast, boot } = useStore.getState()
  const [courses, setCourses] = useState<AdminCourse[] | null>(null)
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [deciding, setDeciding] = useState<string | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [refunding, setRefunding] = useState<number | null>(null)

  const load = () => {
    // Покупки грузятся отдельно: если сервер ещё старой версии и не знает этого запроса, экран курсов всё равно работает.
    api
      .adminPayments()
      .then(setPayments)
      .catch(() => setPayments([]))
    return api
      .adminCourses()
      .then((d) => {
        setCourses(d.courses)
        setRequests(d.requests)
      })
      .catch((e) => {
        guard(e)
        toast(errorText(e))
      })
  }

  const refund = async (p: Payment) => {
    if (!(await confirmDialog(`Вернуть ${p.stars} ${plural(p.stars, ['звезду', 'звезды', 'звёзд'])} — ${p.name}? Доступ к курсу «${p.course}» закроется.`))) return
    setRefunding(p.id)
    try {
      await api.adminRefund(p.id)
      haptic.success()
      toast('Звёзды возвращены, доступ закрыт')
      setPayments((list) => list.map((x) => (x.id === p.id ? { ...x, refunded: true } : x)))
      void boot()
    } catch (e) {
      haptic.error()
      toast(e instanceof ApiError && e.code === 'telegram' ? 'Telegram отклонил возврат. Попробуй позже' : errorText(e))
    } finally {
      setRefunding(null)
    }
  }

  // Перечитываем, когда редактор курса закрылся и этот экран снова сверху.
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackSize])

  const decide = async (r: AccessRequest, approve: boolean) => {
    const key = `${r.user_id}-${r.course_id}`
    setDeciding(key)
    try {
      await api.adminRequest(r.user_id, r.course_id, approve)
      haptic.success()
      toast(approve ? `Доступ открыт: ${r.name}` : 'Заявка отклонена')
      setRequests((list) => list.filter((x) => x !== r))
      void boot()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setDeciding(null)
    }
  }

  const title = (id: number) => courses?.find((c) => c.id === id)?.title ?? 'Курс'

  return (
    <motion.div {...sheet} className="absolute inset-0 z-[31] bg-bg">
      <div className="scroll h-full" style={{ paddingTop: 'calc(var(--top) + 16px)', paddingBottom: 'calc(40px + var(--bottom))' }}>
        <Header title="Курсы" />

        <div className="px-5">
          {requests.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 font-display text-[15px] font-semibold">Заявки</h2>
              <div className="space-y-2">
                {requests.map((r) => {
                  const key = `${r.user_id}-${r.course_id}`
                  return (
                    <div key={key} className="rounded-[20px] border border-line bg-card p-3.5">
                      <p className="text-[15px] font-semibold">
                        {r.name}
                        {r.username && <span className="font-normal text-mute"> @{r.username}</span>}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-mute">Просит доступ к курсу «{title(r.course_id)}»</p>
                      <div className="mt-3 flex gap-2">
                        <Tap onClick={() => decide(r, true)} disabled={deciding === key} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-inverse text-[14px] font-semibold text-on-inverse">
                          {deciding === key ? <Spinner size={17} /> : <Check size={16} strokeWidth={3} />} Открыть доступ
                        </Tap>
                        <Tap onClick={() => decide(r, false)} disabled={deciding === key} className="flex h-11 items-center justify-center gap-1.5 rounded-[14px] border border-line px-4 text-[14px] font-semibold text-mute">
                          <X size={16} /> Отклонить
                        </Tap>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <Cta className="mt-6 w-full" onClick={() => push({ type: 'course-editor', course: null })}>
            <Plus size={18} /> Новый курс
          </Cta>

          <div className="mt-4 space-y-2">
            {!courses && Array.from({ length: 2 }, (_, i) => <div key={i} className="skeleton h-[76px] rounded-[20px]" />)}
            {courses?.map((c) => (
              <Tap key={c.id} onClick={() => push({ type: 'course-editor', course: c })} className="flex w-full items-center gap-3 rounded-[20px] border border-line bg-card p-3 text-left">
                <EmojiTile emoji={c.emoji} gradient={c.gradient} size={50} radius={16} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{c.title}</p>
                  <p className="mt-1 flex items-center gap-2 text-[12px] text-mute">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${c.published ? 'bg-mint/15 text-mint' : 'bg-amber/15 text-amber'}`}>{c.published ? 'Опубликован' : 'Черновик'}</span>
                    <span className="tabular flex items-center gap-0.5">
                      <Star size={12} /> {c.price_stars || '—'}
                    </span>
                    <span className="tabular">учеников {c.students}</span>
                  </p>
                </div>
              </Tap>
            ))}
            {courses?.length === 0 && <p className="py-8 text-center text-[14px] text-mute">Курсов пока нет. Создай первый и добавь в него уроки в редакторе урока.</p>}
          </div>

          {payments.length > 0 && (
            <>
              <h2 className="mb-3 mt-7 font-display text-[15px] font-semibold">Покупки</h2>
              <div className="overflow-hidden rounded-[20px] border border-line bg-card">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 border-b border-line p-3.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">
                        {p.name}
                        {p.username && <span className="font-normal text-mute"> @{p.username}</span>}
                      </p>
                      <p className="tabular mt-0.5 flex items-center gap-1 text-[12.5px] text-mute">
                        <Star size={12} className="shrink-0" />
                        <span className="truncate">
                          {p.stars} · {new Date(p.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · {p.course}
                        </span>
                      </p>
                    </div>
                    {p.refunded ? (
                      <span className="shrink-0 rounded-full bg-veil/8 px-2.5 py-1 text-[12px] font-semibold text-mute">Возвращено</span>
                    ) : (
                      <Tap onClick={() => refund(p)} disabled={refunding !== null} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] font-semibold text-mute disabled:opacity-50">
                        {refunding === p.id ? <Spinner size={15} /> : <Undo2 size={14} />} Вернуть
                      </Tap>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[12.5px] leading-snug text-faint">Возврат делает Telegram: звёзды уходят обратно покупателю, доступ к курсу закрывается.</p>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function blank(): CourseDraft {
  return { title: '', subtitle: '', description: '', emoji: '🎓', gradient: 'ocean', price_stars: 0, invite_unlock: 0, position: 0, published: false }
}

export function CourseEditorScreen({ course }: { course: AdminCourse | null }) {
  const { pop, toast, guard, boot } = useStore.getState()
  const [d, setD] = useState<CourseDraft>(() => (course ? { ...course } : blank()))
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const set = <K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) => setD((prev) => ({ ...prev, [key]: value }))

  const save = async (published: boolean) => {
    if (!d.title.trim()) {
      haptic.error()
      return toast('Нужно название')
    }
    setBusy('save')
    try {
      const saved = await api.adminCourseSave({ ...d, published })
      setD({ ...saved })
      haptic.success()
      toast(saved.published ? 'Курс опубликован' : 'Курс сохранён как черновик')
      void boot()
    } catch (e) {
      guard(e)
      toast(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const grant = async () => {
    if (!d.id || !username.trim()) return
    setBusy('grant')
    try {
      const name = await api.adminGrant(d.id, username.trim())
      haptic.success()
      toast(`Доступ открыт: ${name}`)
      setUsername('')
    } catch (e) {
      haptic.error()
      toast(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!d.id || !(await confirmDialog(`Удалить курс «${d.title}»? Уроки останутся, но выйдут из курса, а доступы пропадут.`))) return
    setBusy('delete')
    try {
      await api.adminCourseDelete(d.id)
      toast('Курс удалён')
      void boot()
      pop()
    } catch (e) {
      toast(errorText(e))
      setBusy(null)
    }
  }

  return (
    <motion.div {...sheet} className="absolute inset-0 z-[32] bg-bg">
      <div className="scroll h-full" style={{ paddingTop: 'calc(var(--top) + 16px)', paddingBottom: 'calc(130px + var(--bottom))' }}>
        <Header
          title={d.id ? 'Курс' : 'Новый курс'}
          right={
            d.id ? (
              <Tap onClick={remove} aria-label="Удалить курс" className="grid h-10 w-10 place-items-center rounded-full border border-line bg-card text-rose">
                {busy === 'delete' ? <Spinner size={18} /> : <Trash2 size={18} />}
              </Tap>
            ) : undefined
          }
        />

        <div className="px-5">
          <div className="mt-5 flex items-center gap-3.5">
            <EmojiTile emoji={d.emoji || '🎓'} gradient={d.gradient} size={68} radius={22} />
            <div className="min-w-0 flex-1">
              <input id="course-emoji" value={d.emoji} onChange={(e) => set('emoji', e.target.value)} placeholder="Эмодзи" maxLength={8} className={`${field} mb-2 py-2.5`} />
              <div className="flex gap-2">
                {GRADIENT_NAMES.map((name: GradientName) => (
                  <Tap key={name} feedback="select" onClick={() => set('gradient', name)} aria-label={GRADIENTS[name].label} className="h-8 flex-1 rounded-full" style={{ background: GRADIENTS[name].css, outline: d.gradient === name ? '2px solid var(--color-ink)' : 'none', outlineOffset: 2 }} />
                ))}
              </div>
            </div>
          </div>

          <Label>Название</Label>
          <input id="course-title" value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="Мини-апп за выходные" maxLength={80} className={field} />

          <Label>Подзаголовок</Label>
          <input id="course-subtitle" value={d.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Одна строка: что человек получит" maxLength={160} className={field} />

          <Label hint="Markdown">Описание</Label>
          <textarea id="course-description" value={d.description} onChange={(e) => set('description', e.target.value)} placeholder="Для кого курс и что внутри" rows={5} className={`${field} resize-y`} />

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div>
              <p className="mb-2 text-[13px] font-semibold text-mute">Цена в звёздах</p>
              <input id="course-price" type="number" inputMode="numeric" value={d.price_stars} onChange={(e) => set('price_stars', Math.max(0, Number(e.target.value)))} min={0} className={field} />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold text-mute">Открыть за друзей</p>
              <input id="course-invites" type="number" inputMode="numeric" value={d.invite_unlock} onChange={(e) => set('invite_unlock', Math.max(0, Number(e.target.value)))} min={0} className={field} />
            </div>
          </div>
          <p className="mt-2 text-[12.5px] leading-snug text-faint">С ценой курс продаётся за звёзды, и кнопки «Запросить доступ» у него нет. Ноль в цене — курс не продаётся, доступ по заявке. Ноль в «друзьях» — открыть приглашениями нельзя.</p>

          <Label hint="меньше — выше в списке">Порядок</Label>
          <input id="course-position" type="number" inputMode="numeric" value={d.position} onChange={(e) => set('position', Math.max(0, Number(e.target.value)))} min={0} className={field} />

          {d.id && (
            <>
              <Label hint="человек должен хотя бы раз открыть приложение">Выдать доступ</Label>
              <div className="flex gap-2">
                <input id="course-grant" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" autoCapitalize="none" autoCorrect="off" className={field} />
                <Tap onClick={grant} disabled={!username.trim() || !!busy} aria-label="Выдать доступ" className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[16px] bg-inverse text-on-inverse disabled:opacity-50">
                  {busy === 'grant' ? <Spinner size={18} /> : <UserPlus size={19} />}
                </Tap>
              </div>
              <p className="mt-4 text-[12.5px] leading-snug text-faint">Уроки добавляются в курс из редактора урока: поле «Курс».</p>
            </>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex gap-2 px-4 pt-8" style={{ paddingBottom: 'calc(12px + var(--bottom))', background: 'linear-gradient(to top, var(--color-bg) 65%, transparent)' }}>
        {d.published ? (
          <>
            <Cta tone="quiet" className="px-5" disabled={!!busy} onClick={() => save(false)}>
              Снять
            </Cta>
            <Cta className="flex-1" busy={busy === 'save'} onClick={() => save(true)}>
              Сохранить
            </Cta>
          </>
        ) : (
          <>
            <Cta tone="quiet" className="px-5" disabled={!!busy} onClick={() => save(false)}>
              Черновик
            </Cta>
            <Cta className="flex-1" busy={busy === 'save'} onClick={() => save(true)}>
              Опубликовать
            </Cta>
          </>
        )}
      </div>
    </motion.div>
  )
}
