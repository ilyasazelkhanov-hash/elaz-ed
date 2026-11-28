import {learningScope} from '../../lib/learning-next'
import {ArrowLeft, ArrowRight, BookOpen, Check, Clock3, ChevronDown, LockKeyhole, Search, X} from 'lucide-react'
import {useEffect, useMemo, useRef, useState} from 'react'
import {api, ApiError, errorText, isDemo} from '../../lib/api'
import {canOpenPracticeLesson, practiceOffer, resolvePracticeCourse, resolvePracticeLesson} from '../../lib/og-course-access'
import {getPracticeResume, ogPracticeCourses, practiceMatches, practicePath, practiceTopics, practiceProgressStorageKey, practiceProjectLesson, readPracticeProgress, subscribePracticeProgress, writePracticeProgress, visiblePracticeCourses, type PracticeCourse} from '../../lib/og-practice'
import type {Lesson} from '../../lib/types'
import {useStore} from '../../store'
import {track} from '../../lib/track'
import {useCourseViewTelemetry} from '../Course'
import {Tap} from '../../ui'
import {CoursePaymentAction, useCoursePaymentRecovery} from './CoursePayment'
import {AccessTiersNote, FriendUnlockCard} from './FriendUnlock'
import {PracticeArtwork} from './PracticeArtwork'
import {EditorialCards, LearningScene} from './LearningMotion'
import {PracticeReader} from './PracticeReader'
import {CoursePathway} from '../courses/CoursePathway'

type Route = (path: string) => void
const minutes = (n: number) => n >= 60 ? Math.floor(n / 60) + ' ч' + (n % 60 ? ' ' + n % 60 + ' мин' : '') : n + ' мин'
const chip = (active: boolean) => 'min-h-11 shrink-0 rounded-full border px-4 text-xs font-semibold ' + (active ? 'border-violet bg-violet/10 text-violet' : 'border-line bg-card text-mute')
export function OGPractice({path, go}: {path: string; go: Route}) {
 useCoursePaymentRecovery()
 const parts = path.split('/').filter(Boolean), course = ogPracticeCourses.find(c => c.key === parts[1]), lesson = course?.lessons.find(l => l.key === parts[2])
 const liveCourses = useStore(state => state.courses), feed = useStore(state => state.feed), user = useStore(state => state.me?.id ?? 0)
 const [filter, setFilter] = useState('Все'), [query, setQuery] = useState('')
 const scope = useMemo(() => ({userId: user || undefined, mode: isDemo ? 'demo' as const : 'live' as const}), [user, isDemo])
 const scopeKey = practiceProgressStorageKey(scope)
 const [savedProgress, setProgress] = useState(() => ({key: scopeKey, value: readPracticeProgress(scope)}))
 const courses = useMemo(() => visiblePracticeCourses(liveCourses, isDemo).filter(c => practiceMatches(c, filter, query)), [filter, query, liveCourses])
 useEffect(() => {
  const refresh = () => setProgress({key: scopeKey, value: readPracticeProgress(scope)})
  refresh(); return subscribePracticeProgress(scope, refresh)
 }, [scope, scopeKey])
 const progress = savedProgress.key === scopeKey ? savedProgress.value : readPracticeProgress(scope)
 const resume = useMemo(() => {
  if (course) return null
  const serverDone = ogPracticeCourses.flatMap(item => {
   const live = resolvePracticeCourse(item, liveCourses)
   return item.lessons.filter(lesson => resolvePracticeLesson(live, lesson, feed)?.completed).map(lesson => lesson.key)
  })
  return getPracticeResume({...progress, done: serverDone}, (item, lesson) => {
   const live = resolvePracticeCourse(item, liveCourses)
   return canOpenPracticeLesson(live, resolvePracticeLesson(live, lesson, feed))
  })
 }, [course, progress, liveCourses, feed])
 if ((parts[1] && !course) || (parts[2] && !lesson) || parts.length > 3) return <section className="rounded-3xl border border-line bg-card p-5">
  <h1 className="font-display text-xl font-semibold">Этот урок не найден</h1><p className="mt-2 text-sm text-mute">Открой программу и выбери урок из списка.</p>
  <Tap onClick={() => go(course ? practicePath(course.key) : '/og-practice')} className="mt-4 flex min-h-11 items-center gap-2 font-semibold text-violet"><ArrowLeft size={17}/>{course ? 'К программе' : 'Все курсы'}</Tap>
 </section>
 if (course && lesson) return <SecurePracticeLesson key={`${scopeKey}:${course.key}/${lesson.key}`} course={course} lesson={lesson} go={go}/>
 if (course) return <PracticeProgram course={course} go={go}/>
 return <section aria-label="Платные курсы OG Cre8r">
  <h1 className="sr-only">Курсы с практикой</h1>
  <LearningScene/>
  {isDemo && <p role="note" className="mt-2 text-xs leading-relaxed text-mute">Демо: короткие примеры, без списания звёзд. Настоящие цены доступны в Telegram.</p>}
  {resume && <Tap onClick={() => go(practicePath(resume.course.key, resume.lesson.key))} className="mt-4 flex min-h-20 w-full items-center gap-3 rounded-2xl border border-violet/20 bg-violet/8 p-4 text-left"><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-violet">Продолжить обучение</span><b className="mt-1 block text-sm leading-snug">{resume.lesson.title}</b><span className="mt-1 block text-xs text-mute">{resume.course.title}{isDemo ? ' · место чтения на этом устройстве' : ''}</span></span><ArrowRight size={18} className="shrink-0 text-violet"/></Tap>}
  <details className="course-discovery group my-3">
   <summary tabIndex={0} className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm text-mute [&::-webkit-details-marker]:hidden"><span>Подобрать курс{query || filter !== 'Все' ? ' · фильтры выбраны' : ''}</span><ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true"/></summary>
   <div className="pb-2">
  <label className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-card pl-4 pr-1"><Search size={17} className="shrink-0 text-mute"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти курс, инструмент или урок" aria-label="Найти учебную тему" className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"/>{query && <Tap aria-label="Очистить поиск" onClick={() => setQuery('')} className="grid h-11 w-11 shrink-0 place-items-center text-mute"><X size={17}/></Tap>}</label>
  <div className="no-bar my-4 flex gap-2 overflow-x-auto pb-1" aria-label="Темы обучения">{practiceTopics.map(item => <Tap key={item} aria-pressed={filter === item} onClick={() => setFilter(item)} className={chip(filter === item)}>{item}</Tap>)}</div>
    <Tap onClick={() => go('/start')} className="flex min-h-11 items-center gap-1 text-sm font-semibold text-violet">Начать бесплатно<ArrowRight size={14}/></Tap>
    <details className="border-t border-line">
     <summary tabIndex={0} className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-violet">Помочь с маршрутом</summary>
     <CoursePathway key={learningScope(user, isDemo)} scope={learningScope(user, isDemo)} mode="practice" go={go}/>
    </details>
   </div>
  </details>
  <div className={query || filter !== 'Все' ? "mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1" : "sr-only"}>
   <p role="status" className="min-w-0 break-words text-xs text-mute">{query || filter !== 'Все' ? `Найдено: ${courses.length}${filter !== 'Все' ? ' · ' + filter : ''}${query ? ' · «' + query + '»' : ''}` : `${courses.length} программ`}</p>
   {query || filter !== 'Все' ? <Tap onClick={() => {setFilter('Все'); setQuery('')}} className="min-h-11 text-xs font-semibold text-violet">Сбросить фильтры</Tap> : null}
  </div>
  <EditorialCards revision={courses.map(item => item.key).join(',')}>{courses.map(item => {
   const live = resolvePracticeCourse(item, liveCourses), offer = practiceOffer(live), duration = item.lessons.reduce((sum, current) => sum + current.minutes, 0)
   const count = item.lessons.filter(current => resolvePracticeLesson(live, current, feed)?.completed).length
   const matching = query.trim() ? item.lessons.find(current => current.title.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))) : null
   return <article key={item.key} className="editorial-card overflow-hidden rounded-[25px] border border-line bg-card" data-editorial-card data-og-course={item.key}>
    <Tap onClick={() => go(practicePath(item.key))} className="block w-full text-left" aria-label={`Программа курса: ${item.title}`}><PracticeArtwork courseKey={item.key} compact/><span className="block p-4 pb-2"><span className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider"><span className="text-violet">Платный курс</span><span className={live?.access ? 'text-success' : 'text-mute'}>{offer.label}</span></span><b className="mt-2 block font-display text-[18px] font-semibold leading-snug">{item.title}</b><span className="mt-2 block text-sm leading-relaxed text-mute">{item.goal}</span><span className="mt-3 block rounded-xl bg-bg/70 p-3 text-xs leading-relaxed"><b className="font-semibold text-violet">На выходе: </b>{item.project}</span><span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-mute"><span>{item.lessons.length} уроков</span><span>{minutes(duration)}</span><span>{live?.access && count ? `${count} отмечено` : 'Практика и проект'}</span></span>{matching && <span className="mt-2 block text-xs leading-relaxed text-violet">В программе: {matching.title}</span>}</span></Tap>
    <div className="flex items-center gap-3 px-4 pb-4 pt-2"><Tap onClick={() => go(practicePath(item.key))} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-violet px-3 text-sm font-semibold text-on-violet">Смотреть программу<ArrowRight size={16}/></Tap></div>{live && !live.access && <CoursePaymentAction course={live} compact/>}
   </article>
  })}{!courses.length && <div className="rounded-2xl border border-dashed border-line p-5 text-center"><p className="text-sm text-mute">По этому запросу курсов нет.</p><Tap onClick={() => {setFilter('Все'); setQuery('')}} className="mt-3 min-h-11 text-sm font-semibold text-violet">Сбросить поиск и фильтры</Tap></div>}</EditorialCards>
  <AccessTiersNote courses={liveCourses.filter(item => ogPracticeCourses.some(outline => resolvePracticeCourse(outline, liveCourses)?.id === item.id))}/>
 </section>
}

function PracticeProgram({course, go}: {course: PracticeCourse; go: Route}) {
 const liveCourses = useStore(state => state.courses), feed = useStore(state => state.feed)
 const live = resolvePracticeCourse(course, liveCourses), offer = practiceOffer(live)
 useCourseViewTelemetry(live?.id)
 const outline = course.lessons.map(lesson => ({lesson, remote: resolvePracticeLesson(live, lesson, feed)}))
 const preview = outline.find(item => item.remote?.free_preview), next = outline.find(item => item.remote && !item.remote.completed), count = outline.filter(item => item.remote?.completed).length
 const duration = course.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0), projectLesson = practiceProjectLesson(course)
 const projectIndex = projectLesson ? course.lessons.indexOf(projectLesson) : -1
 return <section>
  <Tap onClick={() => go('/og-practice')} className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet"><ArrowLeft size={17}/>Все курсы</Tap>
  <div className="overflow-hidden rounded-[26px] border border-line bg-card"><PracticeArtwork courseKey={course.key}/><div className="p-5"><p className="text-[11px] font-bold uppercase tracking-[.15em] text-violet">Курс · {offer.label}</p><h1 className="mt-2 font-display text-[27px] font-semibold leading-tight">{course.title}</h1><p className="mt-3 text-sm leading-relaxed text-mute">{course.goal}</p><p className="mt-4 flex items-center gap-2 text-xs text-mute"><Clock3 size={14}/>{course.lessons.length} уроков · {minutes(duration)} · в своём темпе</p></div></div>
  <div className="mt-4 rounded-[23px] border border-violet/20 bg-violet/8 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-violet">Твой итоговый проект</p><p className="mt-2 text-sm leading-relaxed">{course.project}</p><p className="mt-3 text-xs leading-relaxed text-mute">В каждом уроке: объяснение, разобранный пример, своя работа и критерии готовности.</p><p className="mt-2 text-xs leading-relaxed text-mute">Счётчик уроков показывает прочитанное, а не качество проекта: работу здесь никто не проверяет.</p>{projectLesson && <Tap onClick={() => go(practicePath(course.key, projectLesson.key))} className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-violet">Задание итогового проекта<ArrowRight size={16}/></Tap>}</div>
  {course === ogPracticeCourses[0] && <details className="mt-4 rounded-2xl border border-line bg-card p-4">
   <summary className="min-h-11 cursor-pointer py-2 font-semibold">Пример итоговой работы и инструменты</summary>
   <p className="text-sm leading-relaxed">Например, пакет для подготовки короткого анонса: исходный бриф, сохранённая инструкция для ИИ, черновик и чек-лист проверки даты, времени и ссылки. На неполном брифе инструкция должна запросить недостающее время.</p>
   <p className="mt-2 text-sm text-mute">Основную работу можно сделать в доступном тебе чате и текстовом редакторе. Нативные навыки и подключения зависят от сервиса и тарифа. Упражнения можно пройти вручную, если функция недоступна.</p>
  </details>}
  <div className="mt-4 rounded-[23px] border border-line bg-card p-4" data-course-access>
   {live?.access ? <><p className="flex items-center gap-2 text-sm font-semibold text-success"><Check size={17}/>Доступ к курсу открыт</p><p className="mt-2 text-xs text-mute">Отмечено {count} из {course.lessons.length} уроков</p><div role="progressbar" aria-label="Отмеченные уроки" aria-valuemin={0} aria-valuemax={course.lessons.length} aria-valuenow={count} className="mt-2 h-1.5 overflow-hidden rounded-full bg-card2"><div className="h-full rounded-full bg-violet" style={{width: count / course.lessons.length * 100 + '%'}}/></div>{next && <Tap onClick={() => go(practicePath(course.key, next.lesson.key))} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet px-4 text-sm font-semibold text-on-violet">{count ? 'Продолжить курс' : 'Начать курс'}<ArrowRight size={17}/></Tap>}{!next && count === course.lessons.length && <p role="status" className="mt-3 text-sm text-success">Все уроки отмечены. Проверь свою работу по критериям итогового проекта выше. Качество проекта пока не подтверждено.</p>}</>
   : <><p className="text-sm font-semibold">{live ? 'Полная программа - после открытия доступа' : 'Продажи курса пока не открыты'}</p><p className="mt-2 text-xs leading-relaxed text-mute">{live ? `${preview ? 'Посмотри пробный урок' : 'Посмотри программу'} и реши, подходит ли тебе формат. Доступ открывается отдельно к этому курсу.` : 'Программа уже доступна для знакомства. Условия доступа появятся после публикации курса.'}</p>{preview && <Tap onClick={() => go(practicePath(course.key, preview.lesson.key))} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-violet/35 bg-violet/8 px-3 text-sm font-semibold text-violet"><BookOpen size={17}/>Бесплатный пробный урок</Tap>}{live && <CoursePaymentAction course={live}/>}{live && <FriendUnlockCard course={live}/>}</>}
   {isDemo && <p className="mt-3 text-xs leading-relaxed text-mute">Демо с короткими примерами. Условная оплата без списания звёзд.</p>}
  </div>
  <h2 className="mb-2 mt-7 font-display text-lg font-semibold">Программа курса</h2><p className="mb-3 text-xs leading-relaxed text-mute">{live?.access ? 'Выбирай урок и сохраняй результат практики.' : preview ? 'Пробный урок открыт бесплатно. Остальные уроки - после получения доступа к курсу.' : live ? 'Уроки полной программы открываются после получения доступа к курсу.' : 'Материалы появятся после публикации курса.'}</p>
  <div className="overflow-hidden rounded-[23px] border border-line bg-card">{outline.map(({lesson, remote}, index) => {
   const available = canOpenPracticeLesson(live, remote)
   return <Tap key={lesson.key} onClick={() => go(practicePath(course.key, lesson.key))} className="flex min-h-[82px] w-full items-center gap-3 border-b border-line px-4 py-4 text-left last:border-b-0" data-practice-lesson={lesson.key}>
    <span className={'grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold ' + (remote?.completed ? 'bg-mint/15 text-success' : 'bg-bg text-mute')}>{remote?.completed ? <Check size={16}/> : String(index + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1"><b className="block text-sm leading-snug">{lesson.title.replace(/^\d+\.\s*/, '')}</b><span className="mt-1 block text-xs text-mute">{minutes(lesson.minutes)}{projectIndex >= 0 && index > projectIndex ? ' · дополнительная практика' : ''}{remote?.completed ? ' · отмечено' : remote?.free_preview ? ' · бесплатно' : ' · в платном курсе'}</span></span>{available ? <ArrowRight size={16} className="shrink-0 text-violet"/> : <LockKeyhole size={15} className="shrink-0 text-mute"/>}
   </Tap>
  })}</div>
  <Tap onClick={() => go('/start')} className="mt-4 flex min-h-12 items-center gap-2 text-sm font-semibold text-violet">Пока изучаю ИИ - начать бесплатно<ArrowRight size={16}/></Tap>
 </section>
}

function SecurePracticeLesson({course, lesson, go}: {course: PracticeCourse; lesson: PracticeCourse['lessons'][number]; go: Route}) {
 const liveCourses = useStore(state => state.courses), feed = useStore(state => state.feed), me = useStore(state => state.me)
 const live = resolvePracticeCourse(course, liveCourses), remote = resolvePracticeLesson(live, lesson, feed), allowed = canOpenPracticeLesson(live, remote)
 const [result, setResult] = useState<{id: number; courseId: number; owner: string | null; lesson: Lesson | null; error?: string} | null>(null), [retry, setRetry] = useState(0)
 const [busy, setBusy] = useState(false), finishing = useRef(false)
 const account = me?.id, scope = useMemo(() => ({userId: account, mode: isDemo ? 'demo' as const : 'live' as const}), [account, isDemo])
 const owner = practiceProgressStorageKey(scope), session = useRef<{active: boolean} | null>(null)
 const previewed = useRef<string | null>(null)
 const id = remote?.id, courseId = live?.id
 useEffect(() => {
  const token = {active: true}; session.current = token; finishing.current = false; setBusy(false)
  return () => {token.active = false}
 }, [id, courseId, owner, allowed])
 useEffect(() => {
  if (!allowed || !id || !courseId) return
  let active = true
  setResult({id, courseId, owner, lesson: null})
  api.lesson(id).then(value => {
   if (!active || useStore.getState().me?.id !== account) return
   if (value.id !== id || value.course_id !== courseId || value.kind !== 'lesson' || !value.published) {setResult({id, courseId, owner, lesson: null, error: 'not_found'}); return}
   setResult({id, courseId, owner, lesson: value})
   const progress = readPracticeProgress(scope); writePracticeProgress(scope, {...progress, lastLesson: lesson.key})
  }).catch(error => {if (active && useStore.getState().me?.id === account) {useStore.getState().guard(error); setResult({id, courseId, owner, lesson: null, error: error instanceof ApiError ? error.code : 'network'})}})
  return () => {active = false}
 }, [id, courseId, allowed, retry, lesson.key, account, scope, owner])
 // Owner tags make render safety independent of the parent's keyed remount and effect timing.
 const currentResult = result?.id === id && result?.courseId === courseId && result?.owner === owner ? result : null
 const loaded = currentResult?.lesson ?? null, error = currentResult?.error
 useEffect(() => {
  if (!me?.id || !courseId || !loaded || !loaded.free_preview || live?.access || loaded.course_id !== courseId) return
  const key = `${me.id}:${courseId}:${loaded.id}`
  if (previewed.current === key) return
  previewed.current = key
  track('course_preview', {course_id: courseId, source: 'course'}, loaded.id)
 }, [loaded, courseId, live?.access, me?.id])
 const back = () => go(practicePath(course.key))
 if (!allowed || error === 'course_locked') return <section className="rounded-[25px] border border-line bg-card p-5" data-paid-lesson-locked><Tap onClick={back} className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet"><ArrowLeft size={17}/>К программе</Tap><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-violet/10 text-violet"><LockKeyhole size={22}/></div><p className="text-xs font-semibold uppercase tracking-wide text-violet">Платный курс</p><h1 className="mt-2 font-display text-[24px] font-semibold leading-tight">{lesson.title}</h1><p className="mt-3 text-sm leading-relaxed text-mute">{live && remote ? 'Этот урок входит в полную программу. Открой курс, чтобы перейти к материалам и практике.' : 'Урок пока недоступен. Открой программу, чтобы посмотреть опубликованные материалы.'}</p>{live && <CoursePaymentAction course={live}/>}<Tap onClick={back} className="mt-2 flex min-h-11 w-full items-center justify-center text-sm font-semibold text-violet">Программа курса</Tap></section>
 if (!loaded) return <section className="rounded-[25px] border border-line bg-card p-5" aria-busy={!error}><Tap onClick={back} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet"><ArrowLeft size={17}/>К программе</Tap><h1 className="mt-3 font-display text-xl font-semibold">{lesson.title}</h1><p role="status" className="mt-3 text-sm text-mute">{error ? 'Не удалось загрузить урок. Проверь соединение и попробуй ещё раз.' : 'Открываем урок…'}</p>{error && <Tap onClick={() => setRetry(value => value + 1)} className="mt-4 min-h-11 font-semibold text-violet">Повторить загрузку</Tap>}</section>
 const index = course.lessons.findIndex(item => item.key === lesson.key), previous = course.lessons[index - 1], next = course.lessons[index + 1]
 const finish = async () => {
  const token = session.current
  const current = () => !!token?.active && session.current === token && useStore.getState().me?.id === account
  if (!current() || finishing.current || loaded.completed) return
  finishing.current = true; setBusy(true)
  try {
   const store = useStore.getState(), response = await api.complete(loaded.id, [])
   if (!current()) return
   store.setMe(response.me); store.patchCard(loaded.id, {completed: true}); setResult({id: loaded.id, courseId: loaded.course_id!, owner, lesson: {...loaded, completed: true}})
   const progress = readPracticeProgress(scope); writePracticeProgress(scope, {lastLesson: lesson.key, done: [...progress.done, lesson.key]})
   if (!response.already) store.toast('Ознакомление отмечено' + (response.gained ? ` · +${response.gained} XP за участие` : ''))
   await store.boot()
  } catch (error) {if (current()) {useStore.getState().guard(error); useStore.getState().toast(errorText(error))}}
  finally {if (current()) {finishing.current = false; setBusy(false)}}
 }
 return <PracticeReader course={course} lesson={{key: lesson.key, title: loaded.title, minutes: loaded.minutes, subtitle: loaded.subtitle, body: loaded.body}} index={index} total={course.lessons.length} userId={account === undefined ? undefined : `${scope.mode}:${account}`} onBack={back} onPrevious={previous ? () => go(practicePath(course.key, previous.key)) : undefined} onNext={next ? () => go(practicePath(course.key, next.key)) : undefined}>
  <div className="mt-5 rounded-[22px] border border-line bg-card p-4"><p className="text-sm font-semibold">{loaded.quiz.length ? 'Проверка понимания' : loaded.completed ? 'Ознакомление отмечено' : 'Отметить ознакомление'}</p><p className="mt-2 text-xs leading-relaxed text-mute">{loaded.quiz.length ? 'Квиз проверяет ответы по уроку. Он не проверяет твою практическую работу или итоговый проект.' : 'Это твоя отметка о знакомстве с материалом, без проверки работы. Сохрани свой результат отдельно и сверь его с критериями практики.'} {isDemo ? 'Демо: отметка относится только к этому режиму.' : 'Отметка сохраняется в аккаунте.'}</p>{loaded.quiz.length > 0 ? <Tap onClick={() => useStore.getState().push({type: 'lesson', id: loaded.id})} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet px-3 text-sm font-semibold text-on-violet">{loaded.completed ? 'Повторить проверку' : 'Проверить понимание'}<ArrowRight size={17}/></Tap> : <Tap onClick={finish} disabled={busy || loaded.completed} className={'mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold ' + (loaded.completed ? 'border-mint/30 bg-mint/10 text-success' : 'border-violet bg-violet text-on-violet')}>{loaded.completed ? <><Check size={17}/>Ознакомление отмечено</> : busy ? 'Сохраняем…' : <>Я ознакомился<Check size={17}/></>}</Tap>}</div>
  {!live?.access && <div className="mt-4 rounded-[22px] border border-violet/20 bg-violet/8 p-4"><p className="text-sm font-semibold">Это бесплатный пробный урок</p><p className="mt-2 text-xs leading-relaxed text-mute">Продолжение и итоговый проект входят в полную программу.</p>{live && <CoursePaymentAction course={live}/>}</div>}
 </PracticeReader>
}
