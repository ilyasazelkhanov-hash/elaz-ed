import { Check, ChevronRight, CircleAlert, Copy, KeyRound, RotateCcw, Star } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { grantPairs, grantSummary, GRANT_USER_LIMIT, parseUsernames, retryPairs, runGrants, type GrantPair, type GrantResult } from '../lib/access-grant'
import { api, errorText } from '../lib/api'
import { plural } from '../lib/game'
import { appLink } from '../lib/links'
import { confirmDialog, copyText, haptic } from '../lib/tg'
import type { AdminCourse } from '../lib/types'
import { useStore } from '../store'
import { Spinner, Tap } from '../ui'
import { Header, sheet } from './Admin'

const people = (n: number) => `${n} ${plural(n, ['человек', 'человека', 'человек'])}`
const coursesWord = (n: number) => `${n} ${plural(n, ['курс', 'курса', 'курсов'])}`

const STATUS: Record<GrantResult['status'], { label: string; tone: string }> = {
  granted: { label: 'Открыт', tone: 'text-mint' },
  user_not_found: { label: 'Человек не найден', tone: 'text-amber' },
  skipped: { label: 'Пропущено: человек не найден', tone: 'text-mute' },
  course_not_found: { label: 'Курс не найден', tone: 'text-amber' },
  stopped: { label: 'Не отправлено', tone: 'text-mute' },
  error: { label: 'Ошибка', tone: 'text-amber' },
}

/** Open any course for any person by their Telegram username. */
export function AccessAdminScreen() {
  const push = useStore((s) => s.push)
  const { guard, toast, boot } = useStore.getState()
  const [courses, setCourses] = useState<AdminCourse[] | null>(null)
  const [pending, setPending] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [text, setText] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [results, setResults] = useState<GrantResult[]>([])

  useEffect(() => {
    let alive = true
    setLoadError('')
    api
      .adminCourses()
      .then((data) => {
        if (!alive) return
        setCourses(data.courses)
        setPending(data.requests.length)
      })
      .catch((e) => {
        if (!alive) return
        guard(e)
        setLoadError(errorText(e))
      })
    return () => {
      alive = false
    }
  }, [revision, guard])

  const parsed = useMemo(() => parseUsernames(text), [text])
  const pairs = useMemo(() => grantPairs(parsed.valid, picked), [parsed, picked])
  const summary = useMemo(() => grantSummary(results), [results])
  const again = useMemo(() => retryPairs(results), [results])
  const title = (id: number) => courses?.find((c) => c.id === id)?.title ?? `Курс ${id}`
  const toggle = (id: number) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))

  const send = async (batch: GrantPair[]) => {
    if (busy || !batch.length) return
    const names = new Set(batch.map((pair) => pair.username.toLowerCase())).size
    const targets = new Set(batch.map((pair) => pair.courseId)).size
    if (!(await confirmDialog(`Открыть доступ: ${people(names)}, ${coursesWord(targets)}. Бот напишет каждому про каждый открытый курс. Продолжить?`))) return
    setBusy(true)
    setResults([])
    setProgress({ done: 0, total: batch.length })
    try {
      const done = await runGrants(batch, api.adminGrant, { errorText, onResult: (_result, count, total) => setProgress({ done: count, total }) })
      setResults(done)
      const total = grantSummary(done)
      if (total.granted === done.length) haptic.success()
      else haptic.error()
      toast(total.granted === done.length ? `Доступ открыт: ${total.granted}` : `Открыто ${total.granted} из ${done.length}. Проверь список ниже`)
      if (total.granted) void boot()
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const copyInvite = async () => {
    const link = appLink()
    if (!link) return toast('Ссылка появится, когда бот будет настроен')
    toast((await copyText(link)) ? 'Ссылка на приложение скопирована' : 'Не получилось скопировать ссылку')
  }

  return (
    <motion.div {...sheet} className="absolute inset-0 z-[31] bg-bg">
      <div className="scroll h-full" style={{ paddingTop: 'calc(var(--top) + 16px)', paddingBottom: 'calc(40px + var(--bottom))' }}>
        <Header title="Доступы" />
        <div className="px-5">
          <p className="mt-4 text-sm leading-relaxed text-mute">Открой любой курс любому человеку по его логину в Telegram. Оплата и заявка для этого не нужны.</p>

          <section aria-labelledby="access-who" className="mt-6">
            <h2 id="access-who" className="font-display text-[15px] font-semibold">1. Кому</h2>
            <textarea
              aria-label="Логины в Telegram"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="@username"
              rows={3}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-3 w-full resize-y rounded-[16px] border border-line bg-card px-4 py-3.5 text-[16px] text-ink outline-none placeholder:text-faint focus:border-violet/60"
            />
            <p className="mt-2 text-[12.5px] leading-snug text-mute">Можно несколько: через пробел, запятую или с новой строки. Подойдёт и ссылка вида t.me/username.</p>
            <p role="status" aria-live="polite" className="mt-2 text-[13px] leading-snug">
              {parsed.valid.length > 0 && <span className="font-semibold">Распознано: {parsed.valid.map((name) => `@${name}`).join(', ')}. </span>}
              {parsed.invalid.length > 0 && <span className="text-amber">Не похоже на логин: {parsed.invalid.join(', ')}. </span>}
              {parsed.overflow > 0 && <span className="text-amber">За один раз не больше {GRANT_USER_LIMIT}: ещё {parsed.overflow} не войдут.</span>}
            </p>
          </section>

          <section aria-labelledby="access-what" className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id="access-what" className="font-display text-[15px] font-semibold">2. Что открыть</h2>
              {courses && courses.length > 1 && (
                <Tap onClick={() => setPicked(picked.length === courses.length ? [] : courses.map((c) => c.id))} className="min-h-11 px-2 text-[13px] font-semibold text-violet">
                  {picked.length === courses.length ? 'Снять выбор' : 'Выбрать все'}
                </Tap>
              )}
            </div>
            {loadError && (
              <div role="alert" className="mt-3 rounded-2xl border border-line p-3 text-sm">
                <p>Не удалось загрузить курсы. {loadError}</p>
                <Tap onClick={() => setRevision((v) => v + 1)} className="min-h-11 font-semibold text-violet">Повторить загрузку</Tap>
              </div>
            )}
            {!courses && !loadError && <p role="status" className="py-5 text-sm text-mute">Загружаем курсы…</p>}
            {courses?.length === 0 && <p className="py-5 text-sm text-mute">Курсов пока нет. Создай курс в разделе «Архив курсов и заявки».</p>}
            <div className="mt-2 overflow-hidden rounded-[20px] border border-line bg-card">
              {courses?.map((c) => (
                <label key={c.id} className="flex min-h-[60px] cursor-pointer items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} className="h-5 w-5 shrink-0 accent-violet" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-snug">{c.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-mute">
                      <span className={c.published ? 'text-mint' : 'text-amber'}>{c.published ? 'Опубликован' : 'Черновик'}</span>
                      <span className="tabular flex items-center gap-0.5"><Star size={12} /> {c.price_stars || 'без цены'}</span>
                      {c.invite_unlock > 0 && <span className="tabular">или {c.invite_unlock} {plural(c.invite_unlock, ['друг', 'друга', 'друзей'])}</span>}
                      <span className="tabular">учеников {c.students}</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <Tap
            onClick={() => void send(pairs)}
            disabled={busy || !pairs.length}
            className="mt-6 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[18px] bg-violet px-4 text-[15px] font-semibold text-on-violet disabled:opacity-50"
          >
            {busy ? <Spinner size={18} /> : <KeyRound size={18} />}
            {busy && progress ? `Открываем: ${progress.done} из ${progress.total}` : pairs.length ? `Открыть доступ: ${people(parsed.valid.length)}, ${coursesWord(picked.length)}` : 'Открыть доступ'}
          </Tap>
          <p className="mt-2 text-[12.5px] leading-snug text-mute">Человек должен хотя бы раз открыть приложение, иначе сервер его не найдёт. Бот пишет ему про каждый открытый курс, при повторной выдаче тоже.</p>

          {results.length > 0 && (
            <section aria-labelledby="access-result" className="mt-7">
              <h2 id="access-result" className="font-display text-[15px] font-semibold">Результат</h2>
              <p role="status" aria-live="polite" className="mt-2 text-sm font-semibold">Открыто {summary.granted} из {summary.total}</p>
              <ul className="mt-3 overflow-hidden rounded-[20px] border border-line bg-card">
                {results.map((result) => (
                  <li key={`${result.username}-${result.courseId}`} className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <span className={`mt-0.5 shrink-0 ${STATUS[result.status].tone}`}>{result.status === 'granted' ? <Check size={17} strokeWidth={3} /> : <CircleAlert size={17} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold leading-snug">@{result.username}{result.name && result.name.toLowerCase() !== result.username.toLowerCase() ? ` · ${result.name}` : ''}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-mute">{title(result.courseId)}</span>
                      <span className={`mt-0.5 block text-[13px] font-semibold leading-snug ${STATUS[result.status].tone}`}>{STATUS[result.status].label}{result.message ? `. ${result.message}` : ''}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {summary.missing.length > 0 && (
                <div className="mt-3 rounded-2xl border border-line bg-card p-4">
                  <p className="text-sm leading-relaxed">Не нашлись: {summary.missing.map((name) => `@${name}`).join(', ')}. Проверь логин. Если он верный, человек ещё не открывал приложение: отправь ему ссылку и повтори выдачу.</p>
                  <Tap onClick={() => void copyInvite()} className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-violet"><Copy size={16} />Скопировать ссылку на приложение</Tap>
                </div>
              )}
              {again.length > 0 && (
                <Tap onClick={() => void send(again)} disabled={busy} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-violet/35 px-3 text-sm font-semibold text-violet disabled:opacity-50">
                  <RotateCcw size={16} />Повторить для неоткрытых: {again.length}
                </Tap>
              )}
            </section>
          )}

          <section aria-label="Рядом" className="mt-8 space-y-2">
            <Tap onClick={() => push({ type: 'courses-admin' })} className="flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-line bg-card px-4 py-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Заявки на доступ{pending > 0 ? ` · ${pending}` : ''}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-mute">Там же цены курсов, покупки и возвраты</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-faint" />
            </Tap>
            <details className="rounded-2xl border border-line">
              <summary tabIndex={0} className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold">Что отсюда пока нельзя</summary>
              <div className="space-y-2 px-4 pb-4 text-[13px] leading-relaxed text-mute">
                <p>Забрать выданный доступ и посмотреть список людей с доступом: сервер таких операций пока не даёт, видно только число учеников.</p>
                <p>Оплаченный доступ отзывается возвратом звёзд в разделе «Покупки».</p>
                <p>Отдельный урок открыть нельзя: доступ выдаётся на весь курс.</p>
              </div>
            </details>
          </section>
        </div>
      </div>
    </motion.div>
  )
}
