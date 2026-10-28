import { Eye, Megaphone, Plus, Trash2, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, errorText } from '../lib/api'
import { GRADIENT_NAMES, GRADIENTS, readMinutes, slidesOf } from '../lib/game'
import { confirmDialog, haptic } from '../lib/tg'
import type { AdminCourse, GradientName, Kind, Lesson, LessonDraft, QuizQuestion } from '../lib/types'
import { useStore } from '../store'
import { EmojiTile, Spinner, Tap } from '../ui'
import { Header, sheet } from './Admin'

// Редактор урока и сторис. Грузится отдельно от списка: открывают его реже.

const field = 'w-full rounded-[16px] border border-line bg-card px-4 py-3.5 text-[16px] text-ink outline-none placeholder:text-faint focus:border-violet/60'

function Label({ children, hint }: { children: string; hint?: string }) {
  return (
    <p className="mb-2 mt-5 flex items-baseline gap-2 text-[13px] font-semibold text-mute">
      {children}
      {hint && <span className="font-normal text-faint">{hint}</span>}
    </p>
  )
}

function blank(kind: Kind): LessonDraft {
  return {
    kind,
    title: '',
    subtitle: '',
    category: kind === 'story' ? 'Новости' : 'Блог',
    emoji: kind === 'story' ? '📣' : '✨',
    gradient: 'aurora',
    cover_url: null,
    body: '',
    video_url: null,
    copy_text: null,
    quiz: [],
    minutes: 3,
    xp: kind === 'story' ? 5 : 0,
    pinned: false,
    published: false,
    course_id: null,
    position: 0,
    free_preview: false,
  }
}

const TOOLS: { label: string; wrap: [string, string] }[] = [
  { label: 'Заголовок', wrap: ['\n## ', '\n'] },
  { label: 'Жирный', wrap: ['**', '**'] },
  { label: 'Список', wrap: ['\n- ', ''] },
  { label: 'Цитата', wrap: ['\n> ', ''] },
  { label: 'Код', wrap: ['\n```\n', '\n```\n'] },
]

export function EditorScreen({ lesson, kind }: { lesson: Lesson | null; kind: Kind }) {
  const { pop, push, toast, guard, boot } = useStore.getState()
  const feed = useStore((s) => s.feed)
  const categories = useMemo(() => [...new Set(feed.filter((c) => c.kind === 'lesson' && (lesson?.course_id?c.course_id!=null:c.course_id==null)).map((c) => c.category))], [feed,lesson?.course_id])
  const [d, setD] = useState<LessonDraft>(() => (lesson ? { ...lesson } : blank(kind)))
  const [autoMinutes, setAutoMinutes] = useState(!lesson)
  const [courses, setCourses] = useState<AdminCourse[]>([])

  useEffect(() => {
    if(!lesson?.course_id)return
    api
      .adminCourses()
      .then((r) => setCourses(r.courses))
      .catch(() => {})
  }, [lesson?.course_id])
  const [busy, setBusy] = useState<string | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const story = d.kind === 'story'
  const post = !story && !d.course_id
  const set = <K extends keyof LessonDraft>(key: K, value: LessonDraft[K]) => setD((prev) => ({ ...prev, [key]: value }))

  const insert = ([before, after]: [string, string]) => {
    const el = area.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b, value } = el
    const next = value.slice(0, a) + before + value.slice(a, b) + after + value.slice(b)
    set('body', next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + before.length, b + before.length)
    })
  }

  const save = async (publish?: boolean) => {
    if (!d.title.trim()) {
      haptic.error()
      toast('Нужен заголовок')
      return null
    }
    setBusy('save')
    try {
      // Пустые варианты выкидываем, а номер верного ответа пересчитываем под оставшиеся.
      const quiz = d.quiz
        .map((q) => {
          const kept = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o)
          return { ...q, options: kept.map((x) => x.o), correct: Math.max(0, kept.findIndex((x) => x.i === q.correct)) }
        })
        .filter((q) => q.q.trim() && q.options.length >= 2)
      const draft = { ...d, quiz, published: publish ?? d.published, minutes: autoMinutes ? readMinutes(d.body) : d.minutes }
      const saved = await api.adminSave(draft)
      setD({ ...saved })
      haptic.success()
      toast(saved.published ? 'Сохранено и опубликовано' : 'Черновик сохранён', saved.published ? '🚀' : '📝')
      void boot()
      return saved
    } catch (e) {
      guard(e)
      toast(errorText(e))
      return null
    } finally {
      setBusy(null)
    }
  }

  const preview = async () => {
    const saved = await save()
    if (saved) push(saved.kind === 'story' && saved.published ? { type: 'stories', id: saved.id } : { type: 'lesson', id: saved.id })
  }

  const announce = async () => {
    if (!d.id || !(await confirmDialog(`Отправить анонс «${d.title}» в канал?`))) return
    setBusy('announce')
    try {
      const result = await api.adminAnnounce(d.id)
      haptic.success()
      toast(result?.queued ? 'Материал публикуется автоматически через очередь' : 'Анонс ушёл в канал', '📣')
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!d.id || !(await confirmDialog(`Удалить «${d.title}»? ${post?'Публикация исчезнет из блога.':story?'Сторис исчезнет из подборки.':'Прогресс подписчиков по нему тоже пропадёт.'}`))) return
    setBusy('delete')
    try {
      await api.adminDelete(d.id)
      toast('Удалено')
      void boot()
      pop()
    } catch (e) {
      toast(errorText(e))
      setBusy(null)
    }
  }

  const setQuiz = (i: number, patch: Partial<QuizQuestion>) =>
    set(
      'quiz',
      d.quiz.map((q, j) => (j === i ? { ...q, ...patch } : q)),
    )

  return (
    <motion.div {...sheet} className="absolute inset-0 z-[31] bg-bg">
      <div className="scroll h-full" style={{ paddingTop: 'calc(var(--top) + 16px)', paddingBottom: 'calc(130px + var(--bottom))' }}>
        <Header
          title={story ? (d.id?'Редактирование сторис':'Новая сторис') : post ? (d.id?'Редактирование публикации':'Новая публикация') : 'Архивный урок'}
          right={
            d.id ? (
              <Tap onClick={remove} aria-label="Удалить" className="grid h-10 w-10 place-items-center rounded-full border border-line bg-card text-rose">
                {busy === 'delete' ? <Spinner size={18} /> : <Trash2 size={18} />}
              </Tap>
            ) : undefined
          }
        />

        <div className="px-5">
          <p className="mt-4 text-sm leading-relaxed text-mute">{story?'Настройки сторис: слайды, оформление и награда за просмотр.':post?'Настройки блога: текст статьи, обложка, категория и продвижение.':'Материал старого курса. Актуальные программы и задания редактируются в разделе «Материалы курсов».'}</p>
          <div className="mt-5 flex items-center gap-3.5">
            <EmojiTile emoji={d.emoji || '✨'} gradient={d.gradient} size={68} radius={22} />
            <div className="min-w-0 flex-1">
              <input value={d.emoji} onChange={(e) => set('emoji', e.target.value)} placeholder="Эмодзи" maxLength={8} className={`${field} mb-2 py-2.5`} />
              <div className="flex gap-2">
                {GRADIENT_NAMES.map((name: GradientName) => (
                  <Tap key={name} feedback="select" onClick={() => set('gradient', name)} aria-label={GRADIENTS[name].label} className="h-8 flex-1 rounded-full" style={{ background: GRADIENTS[name].css, outline: d.gradient === name ? '2px solid #fff' : 'none', outlineOffset: 2 }} />
                ))}
              </div>
            </div>
          </div>

          <Label>Заголовок</Label>
          <input value={d.title} onChange={(e) => set('title', e.target.value)} placeholder={story ? 'Вышло обновление' : 'Как собрать бота за вечер'} maxLength={120} className={field} />

          {!story && (
            <>
              <Label>Подзаголовок</Label>
              <input value={d.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder={post?'Одна строка: о чём публикация':'Одна строка: о чём урок'} maxLength={200} className={field} />

              <Label>Категория</Label>
              <input value={d.category} onChange={(e) => set('category', e.target.value)} placeholder="Блог" maxLength={30} className={field} />
              <div className="no-bar mt-2 flex gap-1.5 overflow-x-auto">
                {[...new Set([...categories, 'Блог', 'Туториалы', 'Промпты', 'Разборы'])].map((c) => (
                  <Tap key={c} feedback="select" onClick={() => set('category', c)} className={`h-8 shrink-0 rounded-full border px-3 text-[12.5px] font-semibold ${d.category === c ? 'border-violet/60 bg-violet/15 text-ink' : 'border-line text-mute'}`}>
                    {c}
                  </Tap>
                ))}
              </div>
            </>
          )}

          <Label hint={story ? `слайдов: ${slidesOf(d.body).length}` : 'Markdown'}>{story ? 'Слайды' : 'Текст'}</Label>
          <div className="no-bar mb-2 flex gap-1.5 overflow-x-auto">
            {(story ? [{ label: 'Новый слайд', wrap: ['\n\n---\n\n## ', ''] as [string, string] }, TOOLS[0], TOOLS[1]] : TOOLS).map((t) => (
              <Tap key={t.label} feedback="select" onClick={() => insert(t.wrap)} className="h-8 shrink-0 rounded-full border border-line bg-card px-3 text-[12.5px] font-semibold text-mute">
                {t.label}
              </Tap>
            ))}
          </div>
          <textarea
            ref={area}
            value={d.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder={story ? '# Первый слайд\n\nКороткая мысль.\n\n---\n\n## Второй слайд' : 'Текст материала. Заголовки — через ##, код — в тройных кавычках.'}
            rows={story ? 8 : 12}
            className={`${field} resize-y font-mono text-[14.5px] leading-relaxed`}
          />

          {!story && (
            <>
              <Label hint="YouTube, Rutube, VK или mp4">Видео</Label>
              <input value={d.video_url ?? ''} onChange={(e) => set('video_url', e.target.value || null)} placeholder="https://" inputMode="url" className={field} />

              <Label hint="ссылка на картинку: обложка публикации или урока">Обложка</Label>
              <input value={d.cover_url ?? ''} onChange={(e) => set('cover_url', e.target.value || null)} placeholder="https://" inputMode="url" className={field} />

              {!post&&<>
              <Label hint="если пусто — копируется весь урок">Текст для «Скопировать для нейронки»</Label>
              <textarea value={d.copy_text ?? ''} onChange={(e) => set('copy_text', e.target.value || null)} placeholder="Готовый промпт" rows={3} className={`${field} resize-y font-mono text-[14.5px]`} />
              </>}
            </>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            {!post&&<div>
              <p className="mb-2 text-[13px] font-semibold text-mute">XP за {story ? 'просмотр' : 'урок'}</p>
              <input type="number" inputMode="numeric" value={d.xp} onChange={(e) => set('xp', Number(e.target.value))} min={0} max={500} className={field} />
            </div>}
            {!story && (
              <div>
                <p className="mb-2 text-[13px] font-semibold text-mute">Минут {autoMinutes && <span className="font-normal text-faint">авто</span>}</p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={autoMinutes ? readMinutes(d.body) : d.minutes}
                  onChange={(e) => {
                    setAutoMinutes(false)
                    set('minutes', Number(e.target.value))
                  }}
                  min={1}
                  max={180}
                  className={field}
                />
              </div>
            )}
          </div>

          {post && <Check label="Продвигать" hint="Показывать в начале блога и ленты на главной. Среди продвигаемых сначала новые." on={d.pinned} onChange={(v) => set('pinned', v)} />}

          {!story && !post && (
            <>
              <Label hint="до 10 вопросов">Квиз</Label>
              <div className="space-y-3">
                {d.quiz.map((q, i) => (
                  <div key={i} className="rounded-[20px] border border-line bg-card/60 p-3">
                    <div className="flex items-center gap-2">
                      <input value={q.q} onChange={(e) => setQuiz(i, { q: e.target.value })} placeholder={`Вопрос ${i + 1}`} maxLength={300} className={`${field} py-3`} />
                      <Tap
                        onClick={() =>
                          set(
                            'quiz',
                            d.quiz.filter((_, j) => j !== i),
                          )
                        }
                        aria-label="Убрать вопрос"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-veil/8 text-mute"
                      >
                        <X size={17} />
                      </Tap>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {[0, 1, 2, 3].map((j) => (
                        <div key={j} className="flex items-center gap-2">
                          <Tap
                            feedback="select"
                            onClick={() => setQuiz(i, { correct: j })}
                            aria-label="Верный ответ"
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border font-display text-[11px] font-bold ${q.correct === j ? 'border-mint bg-mint text-on-mint' : 'border-line text-faint'}`}
                          >
                            {'АБВГ'[j]}
                          </Tap>
                          <input
                            value={q.options[j] ?? ''}
                            onChange={(e) => {
                              const options = [...q.options]
                              options[j] = e.target.value
                              setQuiz(i, { options })
                            }}
                            placeholder={j < 2 ? 'Вариант' : 'Вариант (необязательно)'}
                            maxLength={160}
                            className={`${field} py-2.5 text-[15px]`}
                          />
                        </div>
                      ))}
                    </div>
                    <input value={q.explain ?? ''} onChange={(e) => setQuiz(i, { explain: e.target.value })} placeholder="Пояснение после ответа" maxLength={400} className={`${field} mt-2 py-2.5 text-[15px]`} />
                  </div>
                ))}
              </div>
              {d.quiz.length < 10 && (
                <Tap onClick={() => set('quiz', [...d.quiz, { q: '', options: ['', ''], correct: 0, explain: '' }])} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-veil/15 text-[14px] font-semibold text-mute">
                  <Plus size={16} /> Вопрос
                </Tap>
              )}

              <Check label="В фокусе" hint="Большая карточка наверху главной" on={d.pinned} onChange={(v) => set('pinned', v)} />

              {courses.length > 0 && (
                <>
                  <Label hint="назначение в архиве старых курсов">Курс</Label>
                  <div className="no-bar flex gap-1.5 overflow-x-auto">
                    {courses.map((c) => (
                      <Tap key={c.id ?? 'none'} feedback="select" onClick={() => set('course_id', c.id)} className={`h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold ${d.course_id === c.id ? 'border-violet/60 bg-violet/15 text-ink' : 'border-line text-mute'}`}>
                        {c.title}
                      </Tap>
                    ))}
                  </div>
                  {d.course_id && (
                    <>
                      <Label hint="номер урока в программе">Порядок в курсе</Label>
                      <input id="lesson-position" type="number" inputMode="numeric" value={d.position} onChange={(e) => set('position', Math.max(0, Number(e.target.value)))} min={0} className={field} />
                      <Check label="Открыт всем" hint="Пробный урок: доступен без покупки курса" on={d.free_preview} onChange={(v) => set('free_preview', v)} />
                    </>
                  )}
                </>
              )}
            </>
          )}

          {d.id && d.published && !d.course_id && d.kind === 'lesson' && (
            <Tap onClick={announce} disabled={!!busy} className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-[18px] border border-line bg-card2 text-[14.5px] font-semibold">
              {busy === 'announce' ? <Spinner size={18} /> : <Megaphone size={18} />} Анонсировать в канале
            </Tap>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex gap-2 px-4 pt-8" style={{ paddingBottom: 'calc(14px + var(--bottom))', background: 'linear-gradient(to top, var(--color-bg) 65%, transparent)' }}>
        <Tap onClick={preview} disabled={!!busy} aria-label="Сохранить и посмотреть" className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[20px] border border-line bg-card2">
          <Eye size={20} />
        </Tap>
        {d.published ? (
          <>
            <Tap onClick={() => save(false)} disabled={!!busy} className="h-[54px] shrink-0 rounded-[20px] border border-line bg-card2 px-4 text-[14px] font-semibold text-mute">
              Снять
            </Tap>
            <Tap onClick={() => save()} disabled={!!busy} className="flex h-[54px] flex-1 items-center justify-center rounded-[20px] font-display text-[14px] font-semibold text-white" style={{ background: 'var(--aurora)' }}>
              {busy === 'save' ? <Spinner size={20} /> : 'Сохранить'}
            </Tap>
          </>
        ) : (
          <>
            <Tap onClick={() => save()} disabled={!!busy} className="h-[54px] shrink-0 rounded-[20px] border border-line bg-card2 px-4 text-[14px] font-semibold">
              Черновик
            </Tap>
            <Tap onClick={() => save(true)} disabled={!!busy} className="flex h-[54px] flex-1 items-center justify-center rounded-[20px] font-display text-[14px] font-semibold text-white" style={{ background: 'var(--aurora)' }}>
              {busy === 'save' ? <Spinner size={20} /> : 'Опубликовать'}
            </Tap>
          </>
        )}
      </div>
    </motion.div>
  )
}

function Check({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Tap role="switch" aria-label={label} aria-checked={on} feedback="select" onClick={() => onChange(!on)} className="mt-5 flex w-full items-center gap-3 rounded-[18px] border border-line bg-card p-4 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="mt-0.5 block text-[12.5px] text-mute">{hint}</span>
      </span>
      <span className="flex h-7 w-12 items-center rounded-full p-0.5 transition-colors" style={{ background: on ? '#8e7bff' : 'var(--track-strong)' }}>
        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 34 }} className="h-6 w-6 rounded-full bg-white" style={{ marginLeft: on ? 20 : 0 }} />
      </span>
    </Tap>
  )
}
