import { courseGuide, nextAcademyLesson } from '../../lib/academy-guidance'
import { CourseGuidance } from './Guidance'
import { ArrowRight, ChevronRight, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, isDemo } from '../../lib/api'
import { academyRequest } from '../../lib/academy'
import { canPayStars, openInvoice } from '../../lib/tg'
import { localizedEntity, useAcademyLocale, useAcademyTranslation } from '../../lib/academy-i18n'
import { Cta, Tap } from '../../ui'
import { Cover } from './Visual'
import { CourseCard, Empty, FetchState, More, Pager, Sources, Status, formatLabel, list, panel, text, useAcademy, useAction, type Entity, type Navigate } from './shared'

export function Catalog({ go, directionCode }: { go: Navigate; directionCode?: string }) {
  const t = useAcademyTranslation(), locale = useAcademyLocale()
  const [q, setQ] = useState(''), [level, setLevel] = useState(''), [limit, setLimit] = useState(12)
  const resource = useAcademy('catalog', { q, level, direction: directionCode || '', limit, offset: 0 })
  const directions: Entity[] = (resource.data?.directions || []).map((e: Entity)=>localizedEntity(e,locale)), courses: Entity[] = (resource.data?.courses || []).map((e: Entity)=>localizedEntity(e,locale))
  const direction = directions.find((d) => d.code === directionCode)
  return <><section className="academy-intro"><p className="academy-kicker">OG CRE8R² / AI Academy</p><h1 className="mt-3 font-display text-[28px] font-semibold leading-tight">{direction ? direction.title : t('AI Academy')}</h1><p className="mt-3 text-sm leading-relaxed text-mute">{direction ? text(direction.data.description || direction.data.outcome || direction.data.goal) : t('Начни с AI Core или выбери направление.')}</p>{direction && <div className="mt-5"><Cover code={direction.code}/></div>}</section>    <section><div className="mb-4 mt-7 flex items-center justify-between gap-3"><h2 className="font-display text-[19px] font-semibold">{t(directionCode ? 'Твой маршрут' : 'Найди свой вектор')}</h2><span className="text-xs text-mute">{t("AI Core + 9 направлений")}</span></div><label className="relative block"><Search className="absolute left-4 top-3.5 text-mute" size={18}/><input className="academy-field pl-11" value={q} onChange={(e) => { setQ(e.target.value); setLimit(12) }} placeholder={t('Курс, навык или результат')} aria-label={t('Поиск курсов')}/></label><div className="no-bar mt-3 flex gap-2 overflow-x-auto pb-2">{['', 'Core', 'Junior', 'Middle', 'Senior'].map((l) => <Tap key={l} className="academy-chip" aria-pressed={level === l} onClick={() => { setLevel(l); setLimit(12) }}>{l || t('Все уровни')}</Tap>)}</div></section>
    <FetchState {...resource}/>
    {!resource.loading && !resource.error && <>{!directionCode && !q && !level && courses.some(c => c.state === 'published') && <section><h2 className="mb-4 font-display text-[19px] font-semibold">{t('Можно начать сейчас')}</h2><div className="academy-grid">{courses.filter(c => c.state === 'published').map(c => <CourseCard key={c.code} course={c} go={go}/>)}</div></section>}{!directionCode && !q && !level && <section className="academy-grid mt-5">{directions.map((d) => <Tap key={d.code} className="academy-direction" onClick={() => go(`/directions/${d.code}`)}><Cover code={d.code} compact/><span className="academy-direction-copy"><b className="block font-display text-[16px] leading-snug">{d.title}</b><span className="mt-2 block text-[13px] leading-relaxed text-mute">{text(d.data.goal || d.data.description || d.data.outcome)}</span><span className="mt-3 flex items-center justify-between gap-2 text-xs text-violet">Junior → Middle → Senior <ChevronRight size={16}/></span></span></Tap>)}</section>}
      <details open={directionCode || q || level ? true : undefined} className="academy-program-list"><summary className="mb-4 mt-7 flex items-center justify-between gap-3"><h2 className="font-display text-[19px] font-semibold">{q ? t('Результаты поиска') : level ? `${t('Уровень')} ${level}` : t(directionCode ? 'Курсы направления' : 'Все программы')}</h2><ChevronRight className="academy-chevron shrink-0 text-mute" size={18}/></summary>      {courses.length ? <div className="academy-grid">{courses.map((c) => <CourseCard key={c.code} course={c} go={go}/>)}</div> : <Empty title="Пока ничего не нашлось">{t("Попробуй другой запрос или выбери все уровни.")}</Empty>}<More count={courses.length} total={resource.data?.total || 0} onClick={() => setLimit((v) => v + 12)}/>
      </details>
      {directionCode && <p className="mt-5 text-xs leading-relaxed text-mute">{t("Маршрут: Junior → Middle → Senior. Подтверди предыдущий уровень или отправь опыт на входную аттестацию в выбранном курсе.")}</p>}</>}
  </>
}

export function Course({ code, go }: { code: string; go: Navigate }) {
  const t = useAcademyTranslation(), locale = useAcademyLocale()
  const [paying, setPaying] = useState(false), [paymentMessage,setPaymentMessage] = useState('')
  const resource = useAcademy('course', { code }), action = useAction(resource.refresh)
  const [evidence, setEvidence] = useState(''), [certificate, setCertificate] = useState<any>(null)
  const learning = useAcademy('my', {}, !!resource.data?.enrollment)
  if (!resource.data) return <FetchState {...resource}/>
  const { course: rawCourse, modules: rawModules = [], lessons: rawLessons = [], sources = [], enrollment, progress } = resource.data as { course: Entity; modules: Entity[]; lessons: Entity[]; sources: any[]; enrollment: any; progress: any }
  const course = rawCourse ? localizedEntity(rawCourse,locale) : null, modules = rawModules.map(m=>localizedEntity(m,locale)), lessons = rawLessons.map(l=>localizedEntity(l,locale))
  if (!course) return <Empty title="Курс недоступен">{t("Возможно, автор ещё готовит программу.")}</Empty>
  const offer = resource.data.offer
  async function buy() {
    if (paying || !offer?.legacy_course_id) return
    setPaymentMessage('')
    if (isDemo) { setPaymentMessage('Покупка доступна в Telegram после подключения сервера.'); return }
    if (!canPayStars) { setPaymentMessage('Оплата звёздами работает в приложении Telegram.'); return }
    setPaying(true)
    try {
      const invoice = await api.courseInvoice(offer.legacy_course_id)
      if (!invoice) throw new Error('Счёт не создан. Повторите позже.')
      const status = await openInvoice(invoice)
      if (status === 'failed') throw new Error('Оплата не прошла. Повторите попытку.')
      if (status !== 'paid') { setPaymentMessage(status === 'pending' ? 'Платёж обрабатывается. Обновите статус доступа позже.' : 'Оплата отменена.'); return }
      let confirmed = false
      for (let attempt=0;attempt<6;attempt++) {
        const fresh=await academyRequest<any>('course',{code})
        if(fresh.offer?.has_access) {confirmed=true;break}
        await new Promise(resolve=>setTimeout(resolve,1000))
      }
      if(confirmed) await action.run('enroll',{code},'Оплата подтверждена сервером. Вы зачислены.')
      else setPaymentMessage('Платёж отправлен. Доступ появится после подтверждения сервером. Обновите статус позже.')
      resource.refresh()
    } catch(error) { setPaymentMessage(error instanceof Error ? error.message : 'Не удалось проверить оплату.') } finally { setPaying(false) }
  }
  const d = course.data, ready = course.state === 'published', active = enrollment && ['active', 'enrolled', 'completed'].includes((enrollment.status || enrollment.state))
  const completed = Array.isArray(progress) ? progress.filter((p: any) => p.status === 'completed' || p.completed).length : progress?.completed || 0
  const nextLesson = nextAcademyLesson(lessons, learning.data?.progress || [])
  const resumeLesson = nextLesson || lessons.find(lesson => lesson.state === 'published')
  return <><section className="academy-hero academy-course-hero"><Cover code={course.code}/><div className="academy-course-hero-copy"><div className="flex flex-wrap items-center gap-2"><p className="academy-kicker">{course.code} / {text(d.level) || 'Core'}</p><Status state={course.state}/></div><h1 className="mt-5 font-display text-[28px] font-semibold leading-tight">{course.title}</h1><p className="mt-4 text-[14px] leading-relaxed text-mute">{courseGuide(course.code)?.summary || text(d.outcome || d.outcomes)}</p>{d.hours && <p className="mt-4 text-xs text-violet">~{text(d.hours)} {t('часов · теория + практика + защита')}</p>}<div className="academy-course-action mt-6">{ready && !active && resource.data.eligible === false ? <Cta onClick={() => go('/courses/CORE-000')}>{t('Сначала AI Core')}<ArrowRight size={17}/></Cta> : ready && offer && !offer.has_access ? <Cta busy={paying} disabled={!offer.purchasable} onClick={()=>void buy()}>{offer.purchasable ? `${t('Открыть за')} ${offer.price_stars} ★` : t('Доступ пока не продаётся')}</Cta> : active && ready ? <Cta busy={learning.loading} disabled={!!learning.error || !resumeLesson} onClick={() => resumeLesson && go(`/lessons/${resumeLesson.code}`)}>{t(nextLesson ? 'Продолжить обучение ' : 'Повторить курс ')}<ArrowRight size={17}/></Cta> : <Cta busy={action.busy} disabled={!ready && (enrollment?.status || enrollment?.state) === 'waiting'} onClick={() => void action.run('enroll', { code }, ready ? 'Заявка на зачисление сохранена' : 'Вы в листе ожидания. Здесь появится статус открытия.')}>{t((enrollment?.status || enrollment?.state) === 'waiting' ? ready ? 'Начать обучение' : 'Вы в листе ожидания' : ready ? 'Записаться на курс' : 'В лист ожидания')}</Cta>}</div>{!ready && <p className="mt-3 text-xs leading-relaxed text-mute">{t("Программа описана. Учебный контент ещё не опубликован; просмотр плана не засчитывается как обучение.")}</p>}{active && learning.error && <Tap className="academy-chip mt-3" onClick={learning.refresh}>Повторить загрузку прогресса</Tap>}{paymentMessage && <p role="status" className="academy-notice">{paymentMessage}</p>}{ready && offer && !offer.has_access && <Tap className="academy-chip mt-3" disabled={paying} onClick={resource.refresh}>{t("Обновить статус доступа")}</Tap>}{action.feedback}</div></section>
    <CourseGuidance course={course} modules={modules} lessons={lessons}/>
    {Number(progress?.percent) === 100 && <section className={panel}><h2 className="font-display text-[17px]">{t("Подтверждение результата")}</h2><p className="mt-3 text-sm leading-relaxed text-mute">{t("После завершения обязательных занятий и успешной защиты итогового проекта можно получить подтверждение.")}</p><Cta className="mt-4" busy={action.busy} onClick={async () => { const result = await action.run('certificate', { code }, 'Запрос обработан'); if (result) setCertificate(result) }}>{t("Получить подтверждение")}</Cta>{certificate && <p role="status" className="academy-notice">Подтверждение: {text(certificate.verify_code || certificate.code || certificate.id)}</p>}</section>}<section className={panel}><p className="academy-kicker">{t('Твой результат')}</p><h2 className="mt-3 font-display text-[18px]">{t('Проект в портфолио')}</h2><p className="mt-3 text-sm leading-relaxed">{text(d.capstone) || 'Итоговый проект уточняется автором.'}</p>{list(d.outcomes).length > 1 && <ul className="mt-4 space-y-2 text-sm text-mute">{list(d.outcomes).map((v) => <li key={v}>↗ {v}</li>)}</ul>}</section>
    <section className={panel}><h2 className="font-display text-[17px]">{t('Перед стартом')}</h2><p className="mt-3 text-sm leading-relaxed text-mute">{text(d.prerequisites) || 'Специальная подготовка не требуется.'}</p>{d.audience && <p className="mt-3 text-sm text-mute">Для кого: {text(d.audience)}</p>}<details className="mt-4"><summary className="text-sm text-violet">{t("Уже есть опыт? Подтвердить входной уровень →")}</summary><div className="mt-4"><label className="academy-label" htmlFor="placement-link">{t("Ссылка на проект или подтверждение опыта")}</label><input id="placement-link" type="url" className="academy-field" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="https://…"/><Tap disabled={!evidence.trim() || action.busy} className="academy-chip mt-3" onClick={() => void action.run('placement', { code, evidence_url: evidence }, 'Запрос на входную аттестацию отправлен')}>{t("Отправить на аттестацию")}</Tap></div></details></section>
    <section><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-[20px] font-semibold">{t('Программа')}</h2><span className="text-xs text-mute">{modules.length} {t('модулей')} · {lessons.length} {t('занятий')}</span></div>{active && <div className="academy-progress"><p className="mb-2 text-xs text-mute">{t('Пройдено')}: {completed} {t('из')} {lessons.length}</p><progress max={Math.max(1, lessons.length)} value={completed} aria-label={t('Пройдено')}/></div>}<div className="space-y-3">{modules.map((m, index) => <details key={m.code} className={panel}><summary className="flex items-center gap-3"><span className="academy-kicker">{String(index + 1).padStart(2, '0')}</span><span className="flex-1 font-semibold text-[14px]">{m.title}</span><ChevronRight className="academy-chevron shrink-0 text-mute" size={17}/></summary><p className="mt-4 text-sm leading-relaxed text-mute">{text(m.data.outcome || m.data.outcomes)}</p><div className="mt-3">{lessons.filter((l) => l.parent_code === m.code).map((l, i) => <Tap key={l.code} onClick={() => go(`/lessons/${l.code}`)} className="flex w-full items-start gap-3 border-t border-line py-4 text-left"><span className="mt-0.5 text-xs text-faint">{i + 1}</span><span className="flex-1"><span className="block text-[13px] leading-relaxed">{l.title}</span><span className="mt-1 block text-[11px] text-mute">{formatLabel(l.data.format || l.data.lesson_type)}{l.data.minutes ? ` · ${l.data.minutes} ${t('мин')}` : ''}</span>{l.state !== 'published' && <span className="mt-2 block text-[10px] text-mute">{t("Программа формируется · материал готовится")}</span>}</span><ChevronRight size={15} className="mt-1 shrink-0 text-faint"/></Tap>)}</div></details>)}</div>{!modules.length && <Empty title="Программа формируется">{t("Автор добавит модули и занятия.")}</Empty>}</section>
    {resource.data.assessments?.length > 0 && <section className={panel}><h2 className="mb-3 font-display text-[17px]">{t("Проверки и итоговый проект")}</h2>{resource.data.assessments.map((a: Entity) => <Tap key={a.code} className="flex w-full items-center gap-3 border-t border-line py-4 text-left" onClick={() => go(`/assessments/${a.code}`)}><span className="flex-1"><span className="block text-sm">{a.title}</span><span className="mt-2 block"><Status state={a.state}/></span></span><ChevronRight size={16}/></Tap>)}</section>}<section className={panel}><h2 className="font-display text-[17px]">{t('Как проходит оценка')}</h2><p className="mt-3 text-sm leading-relaxed text-mute">{text(d.assessment || d.assessment_policy) || 'Практический результат, объяснение решения и проверка по рубрике. Проходной порог — 70/100 с выполнением всех критических критериев. Просмотр материалов не подтверждает уровень.'}</p></section>
    <section className={panel}><h2 className="font-display text-[17px]">{t('Инструменты и расходы')}</h2><p className="mt-3 text-sm leading-relaxed text-mute">{text(d.tools || d.costs) || 'Инструменты и обязательные расходы будут уточнены до старта. Подписки и API внешних сервисов не включены автоматически.'}</p></section>
    <section className={panel}><h2 className="mb-4 font-display text-[17px]">{t('Первоисточники')}</h2>{sources.length ? <Sources sources={sources}/> : <p className="text-sm text-mute">{t("Ссылки будут добавлены после проверки автором.")}</p>}</section>
    <section className={panel}><h2 className="font-display text-[17px]">{t('Частые вопросы')}</h2><details className="mt-4 text-sm"><summary>{ready ? t("Что нужно для практики?") : t("Когда откроется обучение?")}</summary><p className="mt-3 leading-relaxed text-mute">{ready ? t("Компьютер для кода и учебных файлов, браузер и выбранный AI-инструмент. Задания и критерии находятся внутри каждого занятия; используй вымышленные данные.") : t("Дата появится после публикации контента. Лист ожидания сохраняет ваш интерес к программе.")}</p></details><details className="mt-4 text-sm"><summary>{t("Можно ли перейти сразу на следующий уровень?")}</summary><p className="mt-3 leading-relaxed text-mute">{t("Да, после подтверждения опыта на входной аттестации. Отправь ссылку в разделе «Перед стартом».")}</p></details></section>
  </>
}

export function Library() {
  const t = useAcademyTranslation(), locale = useAcademyLocale()
  const [q, setQ] = useState(''), [limit, setLimit] = useState(20), [offset, setOffset] = useState(0), [language, setLanguage] = useState(''), [kind, setKind] = useState('')
  useEffect(() => setOffset(0), [q, language, kind])
  const resource = useAcademy('library', { q, language, source_type: kind, limit: 20, offset })
  const sources: Entity[] = (resource.data?.sources || []).map((e:Entity)=>localizedEntity(e,locale))
  return <><div><p className="academy-kicker">{t("Проверяй по первоисточникам")}</p><h1 className="mt-3 font-display text-[28px] font-semibold">{t('Библиотека')}</h1><p className="mt-3 text-sm leading-relaxed text-mute">{t("Официальные документы, исследования и учебные материалы. Ссылки открываются на сайтах авторов.")}</p></div><label className="relative block"><Search className="absolute left-4 top-3.5 text-mute" size={18}/><input value={q} onChange={(e) => { setQ(e.target.value); setLimit(20) }} className="academy-field pl-11" placeholder={t('Тема, автор, источник')} aria-label={t('Поиск источников')}/></label><div className="grid grid-cols-2 gap-3"><label><span className="academy-label">{t('Язык')}</span><select className="academy-field" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="">{t('Все языки')}</option><option value="RU">{t("Русский")}</option><option value="EN">English</option><option value="KK">{t("Қазақша")}</option></select></label><label><span className="academy-label">{t('Тип')}</span><select className="academy-field" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">{t('Все материалы')}</option><option value="documentation">{t('Документация')}</option><option value="course">{t('Курс')}</option><option value="video">{t('Видео')}</option><option value="research">{t('Исследование')}</option></select></label></div><FetchState {...resource}/>{!resource.loading && !resource.error && <>{sources.length ? <div className={panel}><Sources sources={sources}/></div> : <Empty title="Источников не найдено">{t("Попробуй другой запрос или язык.")}</Empty>}<Pager offset={offset} count={sources.length} total={resource.data?.total || 0} setOffset={setOffset}/></>}</>
}










