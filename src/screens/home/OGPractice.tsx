import {ArrowLeft, ArrowRight, BookOpen, Check, Clock3, LockKeyhole, Search, ShieldCheck, Sparkles, X} from 'lucide-react'
import {useEffect, useMemo, useRef, useState} from 'react'
import {api, ApiError, errorText, isDemo} from '../../lib/api'
import {canOpenPracticeLesson, practiceOffer, resolvePracticeCourse, resolvePracticeLesson} from '../../lib/og-course-access'
import {getPracticeResume, ogPracticeCourses, practiceMatches, practicePath, practiceTopics, readPracticeProgress, subscribePracticeProgress, writePracticeProgress, type PracticeCourse} from '../../lib/og-practice'
import type {Course, Lesson} from '../../lib/types'
import {useStore} from '../../store'
import {track} from '../../lib/track'
import {useCourseViewTelemetry} from '../Course'
import {Tap} from '../../ui'
import {PracticeArtwork} from './PracticeArtwork'
import {PracticeReader} from './PracticeReader'

type Route = (path: string) => void
const minutes = (n: number) => n >= 60 ? Math.floor(n / 60) + ' ч' + (n % 60 ? ' ' + n % 60 + ' мин' : '') : n + ' мин'
const chip = (active: boolean) => 'min-h-11 shrink-0 rounded-full border px-4 text-xs font-semibold ' + (active ? 'border-violet bg-violet/10 text-violet' : 'border-line bg-card text-mute')
const purchase = (course: Course) => useStore.getState().push({type: 'course', id: course.id})

export function OGPractice({path, go}: {path: string; go: Route}) {
 const parts = path.split('/').filter(Boolean), course = ogPracticeCourses.find(c => c.key === parts[1]), lesson = course?.lessons.find(l => l.key === parts[2])
 const liveCourses = useStore(state => state.courses), feed = useStore(state => state.feed)
 const [filter, setFilter] = useState('Все'), [query, setQuery] = useState('')
 const [progress, setProgress] = useState(readPracticeProgress)
 const courses = useMemo(() => ogPracticeCourses.filter(c => practiceMatches(c, filter, query)), [filter, query])
 useEffect(() => subscribePracticeProgress(() => setProgress(readPracticeProgress())), [])
 const resume = getPracticeResume(progress), resumeCourse = resume && resolvePracticeCourse(resume.course, liveCourses)
 const resumeLesson = resume && resolvePracticeLesson(resumeCourse, resume.lesson, feed)
 if ((parts[1] && !course) || (parts[2] && !lesson) || parts.length > 3) return <section className="rounded-3xl border border-line bg-card p-5">
  <h1 className="font-display text-xl font-semibold">Этот урок не найден</h1><p className="mt-2 text-sm text-mute">Открой программу и выбери урок из списка.</p>
  <Tap onClick={() => go(course ? practicePath(course.key) : '/og-practice')} className="mt-4 flex min-h-11 items-center gap-2 font-semibold text-violet"><ArrowLeft size={17}/>{course ? 'К программе' : 'Все курсы'}</Tap>
 </section>
 if (course && lesson) return <SecurePracticeLesson key={`${course.key}/${lesson.key}`} course={course} lesson={lesson} go={go}/>
 if (course) return <PracticeProgram course={course} go={go}/>
 return <section aria-label="Платные курсы OG Cre8r">
  <div className="overflow-hidden rounded-[28px] border border-violet/20 bg-gradient-to-br from-violet/15 via-card to-mint/10 p-5">
   <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-violet"><Sparkles size={15}/>OG CRE8R² · Курсы с практикой</p>
   <h1 className="mt-3 max-w-[15ch] font-display text-[29px] font-semibold leading-[1.16]">От интереса к ИИ — к своему проекту</h1>
   <p className="mt-3 text-sm leading-relaxed text-mute">Выбери навык и пройди понятный маршрут: объяснение, пример, практика и готовая работа.</p>
   <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold"><span className="rounded-full border border-line bg-card/80 px-3 py-2">5 платных программ</span><span className="rounded-full border border-line bg-card/80 px-3 py-2">33 урока с практикой</span><span className="rounded-full border border-line bg-card/80 px-3 py-2">В своём темпе</span></div>
  </div>
  <Tap onClick={() => go('/start')} className="mt-4 flex min-h-20 w-full items-center gap-3 rounded-[22px] border border-mint/25 bg-mint/8 p-4 text-left"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint/15 text-success"><BookOpen size={20}/></span><span className="min-w-0 flex-1"><b className="block text-sm">Впервые с ИИ? Начни бесплатно</b><span className="mt-1 block text-xs leading-relaxed text-mute">Короткий старт: первый запрос, проверка ответа и выбор задачи.</span></span><ArrowRight size={17} className="shrink-0 text-success"/></Tap>
  {isDemo && <p role="note" className="mt-4 rounded-2xl border border-line bg-card px-4 py-3 text-xs leading-relaxed text-mute">Демо: в курсах показаны отдельные короткие примеры. Покупки условные, звёзды не списываются. Цены настоящих курсов доступны в Telegram.</p>}
  {resume && canOpenPracticeLesson(resumeCourse, resumeLesson) && <Tap onClick={() => go(practicePath(resume.course.key, resume.lesson.key))} className="mt-4 flex min-h-20 w-full items-center gap-3 rounded-2xl border border-violet/20 bg-violet/8 p-4 text-left"><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-violet">Продолжить обучение</span><b className="mt-1 block text-sm leading-snug">{resume.lesson.title}</b><span className="mt-1 block text-xs text-mute">{resume.course.title}</span></span><ArrowRight size={18} className="shrink-0 text-violet"/></Tap>}
  <label className="mt-5 flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-card pl-4 pr-1"><Search size={17} className="shrink-0 text-mute"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти курс, инструмент или урок" aria-label="Найти учебную тему" className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"/>{query && <Tap aria-label="Очистить поиск" onClick={() => setQuery('')} className="grid h-11 w-11 shrink-0 place-items-center text-mute"><X size={17}/></Tap>}</label>
  <div className="no-bar my-4 flex gap-2 overflow-x-auto pb-1" aria-label="Темы обучения">{practiceTopics.map(item => <Tap key={item} aria-pressed={filter === item} onClick={() => setFilter(item)} className={chip(filter === item)}>{item}</Tap>)}</div>
  <p role="status" className="mb-3 text-xs text-mute">{query || filter !== 'Все' ? 'Найдено курсов: ' + courses.length : 'Выбери результат, который хочешь получить'}</p>
  <div className="grid gap-4">{courses.map(item => {
   const live = resolvePracticeCourse(item, liveCourses), offer = practiceOffer(live), duration = item.lessons.reduce((sum, current) => sum + current.minutes, 0)
   const count = item.lessons.filter(current => resolvePracticeLesson(live, current, feed)?.completed).length
   const matching = query.trim() ? item.lessons.find(current => current.title.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))) : null
   return <article key={item.key} className="overflow-hidden rounded-[25px] border border-line bg-card" data-og-course={item.key}>
    <Tap onClick={() => go(practicePath(item.key))} className="block w-full text-left" aria-label={`Программа курса: ${item.title}`}><PracticeArtwork courseKey={item.key} compact/><span className="block p-4 pb-2"><span className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider"><span className="text-violet">Платный курс</span><span className={live?.access ? 'text-success' : 'text-mute'}>{offer.label}</span></span><b className="mt-2 block font-display text-[18px] font-semibold leading-snug">{item.title}</b><span className="mt-2 block text-sm leading-relaxed text-mute">{item.goal}</span><span className="mt-3 block rounded-xl bg-bg/70 p-3 text-xs leading-relaxed"><b className="font-semibold text-violet">На выходе: </b>{item.project}</span><span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-mute"><span>{item.lessons.length} уроков</span><span>{minutes(duration)}</span><span>{live?.access && count ? `${count} пройдено` : 'Практика и проект'}</span></span>{matching && <span className="mt-2 block text-xs leading-relaxed text-violet">В программе: {matching.title}</span>}</span></Tap>
    <div className="flex items-center gap-3 px-4 pb-4 pt-2"><Tap onClick={() => go(practicePath(item.key))} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-violet px-3 text-sm font-semibold text-on-violet">Смотреть программу<ArrowRight size={16}/></Tap>{live && !live.access && <Tap onClick={() => purchase(live)} aria-label={`Условия доступа: ${item.title}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line text-violet"><LockKeyhole size={18}/></Tap>}</div>
   </article>
  })}{!courses.length && <div className="rounded-2xl border border-dashed border-line p-5 text-center"><p className="text-sm text-mute">По этому запросу курсов нет.</p><Tap onClick={() => {setFilter('Все'); setQuery('')}} className="mt-3 min-h-11 text-sm font-semibold text-violet">Сбросить поиск и фильтры</Tap></div>}</div>
  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-line p-4"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-violet"/><p className="text-xs leading-relaxed text-mute">Каждый курс открывается отдельно. Перед покупкой посмотри программу и бесплатный пробный урок. Оплата — звёздами Telegram; доступ и прогресс сохраняются в аккаунте.</p></div>
 </section>
}

function PracticeProgram({course, go}: {course: PracticeCourse; go: Route}) {
 const liveCourses = useStore(state => state.courses), feed = useStore(state => state.feed)
 const live = resolvePracticeCourse(course, liveCourses), offer = practiceOffer(live)
 useCourseViewTelemetry(live?.id)
 const outline = course.lessons.map(lesson => ({lesson, remote: resolvePracticeLesson(live, lesson, feed)}))
 const preview = outline.find(item => item.remote?.free_preview), next = outline.find(item => item.remote && !item.remote.completed), count = outline.filter(item => item.remote?.completed).length
 const duration = course.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0)
 return <section>
  <Tap onClick={() => go('/og-practice')} className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet"><ArrowLeft size={17}/>Все курсы</Tap>
  <div className="overflow-hidden rounded-[26px] border border-line bg-card"><PracticeArtwork courseKey={course.key}/><div className="p-5"><p className="text-[11px] font-bold uppercase tracking-[.15em] text-violet">Курс · {offer.label}</p><h1 className="mt-2 font-display text-[27px] font-semibold leading-tight">{course.title}</h1><p className="mt-3 text-sm leading-relaxed text-mute">{course.goal}</p><p className="mt-4 flex items-center gap-2 text-xs text-mute"><Clock3 size={14}/>{course.lessons.length} уроков · {minutes(duration)} · в своём темпе</p></div></div>
  <div className="mt-4 rounded-[23px] border border-violet/20 bg-violet/8 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-violet">Твой итоговый проект</p><p className="mt-2 text-sm leading-relaxed">{course.project}</p><p className="mt-3 text-xs leading-relaxed text-mute">В каждом уроке: понятное объяснение, разобранный пример, самостоятельная работа и критерии готовности.</p></div>
  <div className="mt-4 rounded-[23px] border border-line bg-card p-4" data-course-access>
   {live?.access ? <><p className="flex items-center gap-2 text-sm font-semibold text-success"><Check size={17}/>Доступ к курсу открыт</p><p className="mt-2 text-xs text-mute">Пройдено {count} из {course.lessons.length} уроков</p><div role="progressbar" aria-label="Прогресс курса" aria-valuemin={0} aria-valuemax={course.lessons.length} aria-valuenow={count} className="mt-2 h-1.5 overflow-hidden rounded-full bg-card2"><div className="h-full rounded-full bg-violet" style={{width: count / course.lessons.length * 100 + '%'}}/></div>{next && <Tap onClick={() => go(practicePath(course.key, next.lesson.key))} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet px-4 text-sm font-semibold text-on-violet">{count ? 'Продолжить курс' : 'Начать курс'}<ArrowRight size={17}/></Tap>}{!next && count === course.lessons.length && <p role="status" className="mt-3 text-sm text-success">Курс пройден. Проверь итоговый проект по критериям последнего урока.</p>}</>
   : <><p className="text-sm font-semibold">{live ? 'Полная программа — после открытия доступа' : 'Продажи курса пока не открыты'}</p><p className="mt-2 text-xs leading-relaxed text-mute">{live ? `${preview ? 'Посмотри пробный урок' : 'Посмотри программу'} и реши, подходит ли тебе формат. Доступ открывается отдельно к этому курсу.` : 'Программа уже доступна для знакомства. Условия доступа появятся после публикации курса.'}</p>{preview && <Tap onClick={() => go(practicePath(course.key, preview.lesson.key))} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-violet/35 bg-violet/8 px-3 text-sm font-semibold text-violet"><BookOpen size={17}/>Бесплатный пробный урок</Tap>}{live && <Tap onClick={() => purchase(live)} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet px-3 text-sm font-semibold text-on-violet">{offer.action}<ArrowRight size={17}/></Tap>}</>}
   {isDemo && <p className="mt-3 text-xs leading-relaxed text-mute">Демо с короткими примерами. Условная оплата без списания звёзд.</p>}
  </div>
  <h2 className="mb-2 mt-7 font-display text-lg font-semibold">Программа курса</h2><p className="mb-3 text-xs leading-relaxed text-mute">{live?.access ? 'Выбирай урок и сохраняй результат практики.' : preview ? 'Пробный урок открыт бесплатно. Остальные уроки — после получения доступа к курсу.' : live ? 'Уроки полной программы открываются после получения доступа к курсу.' : 'Материалы появятся после публикации курса.'}</p>
  <div className="overflow-hidden rounded-[23px] border border-line bg-card">{outline.map(({lesson, remote}, index) => {
   const available = canOpenPracticeLesson(live, remote)
   return <Tap key={lesson.key} onClick={() => go(practicePath(course.key, lesson.key))} className="flex min-h-[82px] w-full items-center gap-3 border-b border-line px-4 py-4 text-left last:border-b-0" data-practice-lesson={lesson.key}>
    <span className={'grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold ' + (remote?.completed ? 'bg-mint/15 text-success' : 'bg-bg text-mute')}>{remote?.completed ? <Check size={16}/> : String(index + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1"><b className="block text-sm leading-snug">{lesson.title.replace(/^\d+\.\s*/, '')}</b><span className="mt-1 block text-xs text-mute">{minutes(lesson.minutes)}{remote?.completed ? ' · пройдено' : remote?.free_preview ? ' · бесплатно' : ' · в платном курсе'}</span></span>{available ? <ArrowRight size={16} className="shrink-0 text-violet"/> : <LockKeyhole size={15} className="shrink-0 text-mute"/>}
   </Tap>
  })}</div>
  <Tap onClick={() => go('/start')} className="mt-4 flex min-h-12 items-center gap-2 text-sm font-semibold text-violet">Пока изучаю ИИ — начать бесплатно<ArrowRight size={16}/></Tap>
 </section>
}

function SecurePracticeLesson({course, lesson, go}: {course: PracticeCourse; lesson: PracticeCourse['lessons'][number]; go: Route}) {
 const liveCourses = useStore(state => state.courses), feed = useStore(state => state.feed), me = useStore(state => state.me)
 const live = resolvePracticeCourse(course, liveCourses), remote = resolvePracticeLesson(live, lesson, feed), allowed = canOpenPracticeLesson(live, remote)
 const [result, setResult] = useState<{id: number; lesson: Lesson | null; error?: string} | null>(null), [retry, setRetry] = useState(0)
 const [busy, setBusy] = useState(false)
 const previewed = useRef<string | null>(null)
 const id = remote?.id, courseId = live?.id
 useEffect(() => {
  if (!allowed || !id || !courseId) return
  let active = true
  setResult({id, lesson: null})
  api.lesson(id).then(value => {
   if (!active) return
   if (value.id !== id || value.course_id !== courseId || value.kind !== 'lesson' || !value.published) {setResult({id, lesson: null, error: 'not_found'}); return}
   setResult({id, lesson: value})
   const progress = readPracticeProgress(); writePracticeProgress({...progress, lastLesson: lesson.key})
  }).catch(error => {if (active) {useStore.getState().guard(error); setResult({id, lesson: null, error: error instanceof ApiError ? error.code : 'network'})}})
  return () => {active = false}
 }, [id, courseId, allowed, retry, lesson.key])
 const loaded = result?.id === id ? result?.lesson : null, error = result?.id === id ? result?.error : null
 useEffect(() => {
  if (!me?.id || !courseId || !loaded || !loaded.free_preview || live?.access || loaded.course_id !== courseId) return
  const key = `${me.id}:${courseId}:${loaded.id}`
  if (previewed.current === key) return
  previewed.current = key
  track('course_preview', {course_id: courseId, source: 'course'}, loaded.id)
 }, [loaded, courseId, live?.access, me?.id])
 const back = () => go(practicePath(course.key))
 if (!allowed || error === 'course_locked') return <section className="rounded-[25px] border border-line bg-card p-5" data-paid-lesson-locked><Tap onClick={back} className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet"><ArrowLeft size={17}/>К программе</Tap><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-violet/10 text-violet"><LockKeyhole size={22}/></div><p className="text-xs font-semibold uppercase tracking-wide text-violet">Платный курс</p><h1 className="mt-2 font-display text-[24px] font-semibold leading-tight">{lesson.title}</h1><p className="mt-3 text-sm leading-relaxed text-mute">{live && remote ? 'Этот урок входит в полную программу. Открой курс, чтобы перейти к материалам и практике.' : 'Урок пока недоступен. Открой программу, чтобы посмотреть опубликованные материалы.'}</p>{live && <Tap onClick={() => purchase(live)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet px-3 text-sm font-semibold text-on-violet">{practiceOffer(live).action}<ArrowRight size={16}/></Tap>}<Tap onClick={back} className="mt-2 flex min-h-11 w-full items-center justify-center text-sm font-semibold text-violet">Программа и бесплатный пробный урок</Tap></section>
 if (!loaded) return <section className="rounded-[25px] border border-line bg-card p-5" aria-busy={!error}><Tap onClick={back} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet"><ArrowLeft size={17}/>К программе</Tap><h1 className="mt-3 font-display text-xl font-semibold">{lesson.title}</h1><p role="status" className="mt-3 text-sm text-mute">{error ? 'Не удалось загрузить урок. Проверь соединение и попробуй ещё раз.' : 'Открываем урок…'}</p>{error && <Tap onClick={() => setRetry(value => value + 1)} className="mt-4 min-h-11 font-semibold text-violet">Повторить загрузку</Tap>}</section>
 const index = course.lessons.findIndex(item => item.key === lesson.key), previous = course.lessons[index - 1], next = course.lessons[index + 1]
 const finish = async () => {
  if (busy || loaded.completed) return
  setBusy(true)
  try {
   const store = useStore.getState(), fromXp = store.me?.xp ?? 0, response = await api.complete(loaded.id, [])
   store.setMe(response.me); store.patchCard(loaded.id, {completed: true}); setResult({id: loaded.id, lesson: {...loaded, completed: true}})
   const progress = readPracticeProgress(); writePracticeProgress({lastLesson: lesson.key, done: [...progress.done, lesson.key]})
   if (!response.already) store.setReward({result: response, fromXp, lessonId: loaded.id})
   await store.boot()
  } catch (error) {useStore.getState().guard(error); useStore.getState().toast(errorText(error))}
  finally {setBusy(false)}
 }
 return <PracticeReader course={course} lesson={{key: lesson.key, title: loaded.title, minutes: loaded.minutes, subtitle: loaded.subtitle, body: loaded.body}} index={index} total={course.lessons.length} userId={me?.id} onBack={back} onPrevious={previous ? () => go(practicePath(course.key, previous.key)) : undefined} onNext={next ? () => go(practicePath(course.key, next.key)) : undefined}>
  <div className="mt-5 rounded-[22px] border border-line bg-card p-4"><p className="text-sm font-semibold">{loaded.completed ? 'Урок пройден' : 'Готово на практике?'}</p><p className="mt-2 text-xs leading-relaxed text-mute">{loaded.completed ? 'Прогресс сохранён в аккаунте. Можно вернуться к материалу или идти дальше.' : 'Сохрани результат и проверь критерии готовности. Отметка и прогресс сохранятся в аккаунте.'}</p>{loaded.quiz.length > 0 ? <Tap onClick={() => useStore.getState().push({type: 'lesson', id: loaded.id})} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet px-3 text-sm font-semibold text-on-violet">{loaded.completed ? 'Повторить проверку' : 'Пройти проверку и завершить'}<ArrowRight size={17}/></Tap> : <Tap onClick={finish} disabled={busy || loaded.completed} className={'mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold ' + (loaded.completed ? 'border-mint/30 bg-mint/10 text-success' : 'border-violet bg-violet text-on-violet')}>{loaded.completed ? <><Check size={17}/>Пройдено</> : busy ? 'Сохраняем…' : <>Завершить урок<Check size={17}/></>}</Tap>}</div>
  {!live?.access && <div className="mt-4 rounded-[22px] border border-violet/20 bg-violet/8 p-4"><p className="text-sm font-semibold">Это бесплатный пробный урок</p><p className="mt-2 text-xs leading-relaxed text-mute">Продолжение и итоговый проект входят в полную программу.</p><Tap onClick={() => live && purchase(live)} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet px-3 text-sm font-semibold text-on-violet">{practiceOffer(live).action}<ArrowRight size={17}/></Tap></div>}
 </PracticeReader>
}
