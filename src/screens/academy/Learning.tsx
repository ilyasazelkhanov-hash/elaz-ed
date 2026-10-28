import { LessonGuidance } from './Guidance'
import { LessonTrail, LessonNavigation } from './LessonJourney'
import { academyLessonPosition, orderedAcademyLessons, isAcademyLessonComplete } from '../../lib/academy-sequence'
import { isDemo } from '../../lib/api'
import { useAcademyLocale, useAcademyTranslation } from '../../lib/academy-i18n'
import { AcademyFiles, AcademyAttachmentLinks } from './Files'
import { Quiz } from './Quiz'
import { Check, ChevronRight, FileText } from 'lucide-react'
import { useState } from 'react'
import { LessonReading } from './LessonReading'
import { LessonVisuals } from './LessonVisuals'
import { LessonStudyNav,StudyHeading,StudyExample,LessonTask,LessonChecks,LessonResources,studySections,type StudyCase } from './LessonStudy'
import { Bar, Cta, Tap } from '../../ui'
import { Empty, External, FetchState, Sources, Status, formatLabel, panel, text, useAcademy, useAction, type Entity, type Navigate } from './shared'



function Assignment({ code, submissions, refresh, embedded = false }: { code: string; submissions: any[]; refresh: () => void; embedded?: boolean }) {
  const t=useAcademyTranslation()
  const latest = submissions[submissions.length - 1], [body, setBody] = useState(text(latest?.artifact?.text || latest?.text)), [url, setUrl] = useState(text(latest?.artifact?.url || latest?.artifact_url)), action = useAction(refresh)
  const [fileIds,setFileIds] = useState<string[]>(Array.isArray(latest?.artifact?.file_ids) ? latest.artifact.file_ids.filter((id:unknown)=>typeof id==='string') : [])
  const canSubmit = !!body.trim() || !!url.trim() || fileIds.length>0
  async function submit() { const saved = await action.run('submission_save', { code, artifact: { text: body, url: url || undefined, file_ids: fileIds } }, 'Черновик сохранён'); if (saved) await action.run('submission_submit', { submission_id: saved.id }, 'Работа отправлена на проверку') }
  return <section className={embedded ? "academy-submission-form" : panel}><h3 className="text-base font-semibold">Сохрани решение</h3><p className="mt-3 text-sm leading-relaxed text-mute">{t("Добавь ссылку на артефакт и объясни решение. Не отправляй секреты и персональные данные. Каждая отправка сохраняется отдельной версией.")}</p><label className="academy-label mt-5" htmlFor="assignment-text">{t("Описание решения")}</label><textarea disabled={action.busy} id="assignment-text" className="academy-field min-h-36" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Что получилось, как проверялось, какие есть ограничения…"/><label className="academy-label mt-4" htmlFor="assignment-url">{t("Ссылка на результат (HTTPS)")}</label><input disabled={action.busy} id="assignment-url" type="url" className="academy-field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…"/><fieldset disabled={action.busy}><AcademyFiles lessonCode={code} initialFileIds={fileIds} onChange={setFileIds}/></fieldset><div className="mt-4 flex flex-wrap gap-2"><Tap className="academy-chip" disabled={action.busy || !canSubmit} onClick={() => void action.run('submission_save', { code, artifact: { text: body, url: url || undefined, file_ids: fileIds } }, 'Черновик сохранён')}>{t("Сохранить черновик")}</Tap><Tap className="academy-chip text-violet" disabled={action.busy || !canSubmit} onClick={() => void submit()}>{t("Отправить на проверку →")}</Tap></div>{action.feedback}{submissions.length > 0 && <div className="mt-6 border-t border-line pt-5"><h3 className="text-sm font-semibold">{t("Версии и обратная связь")}</h3>{submissions.map((s, i) => <article key={s.id || i} className="mt-4 rounded-2xl bg-card2 p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs text-mute">Версия {s.version || submissions.length - i}</span><Status state={s.status || s.state}/></div>{(s.artifact?.text || s.text) && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{text(s.artifact?.text || s.text)}</p>}{(s.artifact?.url || s.artifact_url) && <div className="mt-3"><External url={s.artifact?.url || s.artifact_url}>{t("Результат работы")}</External></div>}<AcademyAttachmentLinks fileIds={s.artifact?.file_ids}/>{(s.review || s.feedback) && <div className="mt-4 border-t border-line pt-3"><p className="text-xs text-violet">Обратная связь {s.rubric_version ? `· рубрика v${s.rubric_version}` : ''}</p><p className="mt-2 text-sm leading-relaxed">{text(s.feedback || s.review?.feedback)}</p>{s.score !== undefined && <p className="mt-2 text-xs text-mute">Оценка: {s.score}/100</p>}</div>}{s.reviews?.map((r: any, j: number) => <div key={r.id || j} className="mt-3 text-sm"><Status state={r.decision}/><p className="mt-2">{text(r.feedback)}</p><p className="mt-2 text-xs text-mute">Рубрика v{r.rubric_version || '—'}</p></div>)}</article>)}</div>}</section>
}

export function Lesson({ code, go }: { code: string; go: Navigate }) {
  const t=useAcademyTranslation(), locale=useAcademyLocale()
  const resource=useAcademy('lesson',{code}),action=useAction(resource.refresh)
  const [lessonQuery,setLessonQuery]=useState('')
  const courseCode=resource.data?.lesson?.data?.course_code||code.match(/^(.+)-M\d+-L\d+$/)?.[1]
  const curriculum=useAcademy('course',{code:courseCode},!!courseCode)
  const courseLessons:Entity[]=orderedAcademyLessons(curriculum.data?.lessons||[],curriculum.data?.modules||[])
  const plannedLesson:Entity|undefined=courseLessons.find(item=>item.code===code&&item.state==='outline')
  if(!resource.data&&plannedLesson)return <>
    <LessonTrail lesson={plannedLesson} lessons={courseLessons} modules={curriculum.data?.modules||[]} courseCode={courseCode||''} go={go}/>
    <header className="academy-study-hero"><p className="academy-kicker">Программа занятия</p><h1>{plannedLesson.title}</h1></header>
    <Empty title="Материал ещё готовится">Здесь показана тема будущего занятия. Практика и зачёт станут доступны после публикации.</Empty>
    <LessonGuidance key={plannedLesson.code} lesson={plannedLesson}/>
    <LessonNavigation lesson={plannedLesson} lessons={courseLessons} modules={curriculum.data?.modules||[]} courseCode={courseCode||''} go={go}/>
  </>
  if(!resource.data)return <FetchState {...resource}/>
  const {lesson,sources=[],assessment,submissions=[],progress}=resource.data as {lesson:Entity;sources:any[];assessment:any;submissions:any[];progress:any}
  if(!lesson)return <Empty title="Занятие пока недоступно">Вернись к программе курса.</Empty>
  const d=lesson.data,blocks:any[]=Array.isArray(resource.data.localized_blocks?.[locale])?resource.data.localized_blocks[locale]:resource.data.blocks||[]
  const quiz=!!assessment&&(assessment.kind==='quiz'||assessment.data?.type==='quiz'||assessment.data?.questions?.length||assessment.type==='quiz')
  const assignment=!!assessment&&!quiz||['lab','assignment','project','practice'].includes(d.lesson_type)||/лаборатор|практик|задани|защита/i.test(text(d.format))
  const ready=lesson.state==='published',completed=isAcademyLessonComplete(progress)
  const artifact=text(d.deliverable||d.artifact),criteria=(Array.isArray(d.acceptance)?d.acceptance:text(d.criteria).split('\n')).filter((item:any)=>typeof item==='string'&&item.trim()) as string[]
  const beginner=blocks.find(block=>block.learning_role==='beginner')?.study as StudyCase|undefined
  const moduleExample=blocks.find(block=>block.learning_role==='module_example')?.study as StudyCase|undefined
  const explanation=beginner||moduleExample,readingBlocks=blocks.filter(block=>!['beginner','module_example'].includes(block.learning_role))
  const ids=studySections(code),isLesson=lesson.kind==='lesson'
  return <>
    {isLesson&&<LessonTrail lesson={lesson} lessons={courseLessons} modules={curriculum.data?.modules||[]} courseCode={courseCode||''} go={go}/>}
    <header className="academy-study-hero"><p className="academy-kicker">{formatLabel(d.format||d.lesson_type)}</p><h1>{lesson.title}</h1>
      {artifact&&<p className="academy-study-goal"><b>Результат урока:</b> {artifact}</p>}
      <div className="academy-study-meta">{d.minutes&&<span>Ориентир: {d.minutes} мин</span>}{completed&&<Status state="completed"/>}{!ready&&<Status state={lesson.state}/>}</div>
    </header>
    {ready?<>
      <LessonStudyNav code={code}/>
      <section id={ids[0]} className="academy-study-stage" aria-label="Разбор темы"><StudyHeading number="01" title="Разберись в теме"/>
        {explanation?.concept&&<p className="academy-study-plain">{explanation.concept}</p>}
        {readingBlocks.length?<LessonReading blocks={readingBlocks} section="reading"/>:<Empty title="Материалы недоступны">Автор ещё не добавил объяснение.</Empty>}
      </section>
      <section id={ids[1]} className="academy-study-stage" aria-label="Пример и иллюстрации"><StudyHeading number="02" title="Посмотри на примере" description="Сравни исходные данные, действие и результат. Найди, где его можно проверить."/>
        {explanation&&<StudyExample data={explanation} showConcept={false}/>}
        {beginner&&moduleExample&&<details className={`${panel} academy-study-sources`}><summary>Ещё один пример для всего модуля</summary><StudyExample data={moduleExample}/></details>}
        {isLesson&&<LessonVisuals code={code}/>}
      </section>
      <section id={ids[2]} className="academy-study-stage" aria-label="Самостоятельная практика"><StudyHeading number="03" title={quiz?'Подготовься к проверке':'Выполни практику'} description={quiz?'Попробуй объяснить правило на своём примере. Затем переходи к квизу.':'Сделай свою версию, а не копию учебного примера.'}/>
        <LessonReading blocks={readingBlocks} section="practice"/>
        <LessonResources blocks={blocks}/>
        <LessonTask artifact={artifact||text(assessment?.instructions)} criteria={criteria}>
          {assignment&&<Assignment code={assessment?.code||code} submissions={submissions} refresh={resource.refresh} embedded/>}
        </LessonTask>
        <details className={`${panel} academy-study-sources`}><summary>Подсказки автора</summary><LessonReading blocks={readingBlocks} section="hint"/></details>
        <LessonGuidance key={lesson.code} lesson={lesson}/>
      </section>
      <section id={ids[3]} className="academy-study-stage" aria-label="Проверка результата"><StudyHeading number="04" title="Проверь результат"/>
        <LessonReading blocks={readingBlocks} section="check"/>
        <LessonChecks key={code} criteria={criteria}/>
        {quiz&&<Quiz key={assessment.code||code} initialResult={resource.data.quiz_result} code={assessment.code||code} lessonCode={isLesson?code:''} refresh={resource.refresh}/>}
        {!quiz&&!assignment&&readingBlocks.length>0&&<section className={panel}><p className="mb-4 text-sm leading-relaxed text-mute">Если можешь объяснить идею и выполнить практику по критериям, отметь урок изученным.</p><Cta busy={action.busy} disabled={completed} onClick={()=>void action.run('complete',{code},'Занятие отмечено изученным')}>{completed?<><Check size={17}/> Изучено</>:'Отметить изученным'}</Cta>{action.feedback}</section>}
        {assignment&&<section className={panel}>{submissions.some((submission:any)=>(submission.state||submission.status)==='passed')?<><p className="mb-4 text-sm leading-relaxed">Работа прошла проверку. Теперь можно завершить урок.</p><Cta busy={action.busy} disabled={completed} onClick={()=>void action.run('complete',{code},'Занятие завершено')}>{completed?'Урок завершён':'Завершить после проверки'}</Cta>{action.feedback}</>:<p className="text-sm leading-relaxed text-mute">Сохрани и отправь решение в разделе «Практика». После проверки здесь появится возможность завершить урок. Переход к следующему материалу не заменяет зачёт.</p>}</section>}
      </section>
    </>:<Empty title="Программа формируется">Полный материал и проверка появятся после публикации.</Empty>}
    {curriculum.data&&<details className={`${panel} academy-study-sources`}><summary>Все уроки и моё место в курсе</summary><Tap className="text-sm text-violet" onClick={()=>go(`/courses/${courseCode}`)}>{curriculum.data.course?.title} →</Tap><input aria-label="Поиск в программе курса" placeholder="Найти занятие" className="academy-field mt-3" value={lessonQuery} onChange={event=>setLessonQuery(event.target.value)}/><div className="mt-3 max-h-72 overflow-y-auto">{courseLessons.filter(item=>item.title.toLowerCase().includes(lessonQuery.toLowerCase())).map(item=><Tap key={item.code} aria-current={item.code===code?'page':undefined} onClick={()=>go(`/lessons/${item.code}`)} className="flex w-full items-start gap-3 border-b border-line py-3 text-left text-xs leading-relaxed"><span className="flex-1"><span className="mb-1 block text-violet">Урок {academyLessonPosition(item.code,courseLessons,curriculum.data.modules)?.number} · {academyLessonPosition(item.code,courseLessons,curriculum.data.modules)?.label}{item.code===code?' · Сейчас':''}</span>{item.title}</span><ChevronRight size={14}/></Tap>)}</div></details>}
    <details className={`${panel} academy-study-sources`}><summary>Источники и дополнительные материалы</summary>{sources.length?<Sources sources={sources}/>:<p className="text-sm text-mute">Автор добавит проверенные материалы.</p>}</details>
    {isLesson&&courseLessons.length>0?<LessonNavigation lesson={lesson} lessons={courseLessons} modules={curriculum.data?.modules||[]} courseCode={courseCode||''} go={go}/>:<nav className="flex flex-wrap gap-2" aria-label="Соседние материалы">{resource.data.previous?.code&&<Tap className="academy-chip" onClick={()=>go(`/lessons/${resource.data.previous.code}`)}>← {resource.data.previous.title||t('Предыдущее')}</Tap>}{resource.data.next?.code&&<Tap className="academy-chip" onClick={()=>go(`/lessons/${resource.data.next.code}`)}>{resource.data.next.title||t('Следующее')} →</Tap>}</nav>}
  </>
}

export function MyLearning({ go, projectId }: { go: Navigate; projectId?: string }) {
  const t=useAcademyTranslation()
  const resource = useAcademy('my'), portfolios=useAcademy('portfolio_list'), d = resource.data
  return <><div><p className="academy-kicker">{t("Твой личный маршрут")}</p><h1 className="mt-3 font-display text-[27px] font-semibold">{t("Моё обучение")}</h1><p className="mt-3 text-sm leading-relaxed text-mute">{t("Курсы, практика и подтверждённые результаты — в одном месте.")}</p></div><FetchState {...resource}/>{d && <><section><h2 className="mb-4 font-display text-[18px]">{t("Мои программы")}</h2>{d.enrollments?.length ? d.enrollments.map((e: any, i: number) => <Tap key={e.id || i} className={`${panel} mb-3 block w-full text-left`} onClick={() => go(`/courses/${e.course_code || e.code || e.course?.code}`)}><div className="flex items-center justify-between gap-3"><h3 className="flex-1 text-sm font-semibold">{e.course?.title || e.title || e.course_code || e.code}</h3><ChevronRight size={17}/></div><div className="mt-3"><Status state={e.status || e.state}/></div>{(e.status || e.state) !== 'waiting' && <><Bar className="mt-4" progress={typeof e.progress === 'object' ? Number(e.progress.ratio || (e.progress.total ? e.progress.completed / e.progress.total : 0)) : Number(e.progress || 0) > 1 ? Number(e.progress) / 100 : Number(e.progress || 0)}/><p className="mt-2 text-xs text-mute">{e.progress?.completed || e.completed_count || 0} из {e.progress?.total || e.lesson_count || e.total_lessons || '—'} занятий</p></>}</Tap>) : <Empty title={t("Твой первый проект впереди")}>{t("Выбери курс в каталоге и начни с AI Core.")}<Tap className="mt-4 academy-chip text-violet" onClick={() => go('')}>{t("Выбрать программу →")}</Tap></Empty>}</section><section><h2 className="mb-4 font-display text-[18px]">{t("Мои работы")}</h2><FetchState {...portfolios}/>{d.submissions?.length ? d.submissions.filter((s: any) => !projectId || String(s.id) === projectId).map((s: any, i: number) => <article key={s.id || i} className={`${panel} mb-3`}><div className="flex items-start gap-3"><FileText size={20} className="shrink-0 text-violet"/><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{s.title || s.lesson_title || s.lesson_code || s.assessment_code || 'Практическая работа'}</p><p className="mt-1 text-xs text-mute">Версия {s.version || 1}</p></div><Status state={s.status || s.state}/></div>{(s.artifact?.url || s.artifact_url) && <div className="mt-3"><External url={s.artifact?.url || s.artifact_url}>{t("Открыть результат")}</External></div>}<AcademyAttachmentLinks fileIds={s.artifact?.file_ids}/>{s.feedback && <p className="mt-3 text-sm text-mute">{text(s.feedback)}</p>}{s.reviews?.map((r: any, j: number) => <p className="mt-3 text-sm text-mute" key={j}>{text(r.feedback)} · рубрика v{r.rubric_version || '—'}</p>)}<PortfolioControls submission={s} entry={portfolios.data?.entries?.find((entry:any)=>String(entry.submission_id)===String(s.id))} refresh={portfolios.refresh}/></article>) : <Empty title={t("Практика появится здесь")}>{t("Сохрани черновик или отправь первую работу из занятия.")}</Empty>}</section><section className={panel}><h2 className="font-display text-[17px]">{t("Подтверждения уровня")}</h2>{d.certificates?.length ? d.certificates.map((c: any, i: number) => <p key={c.id || i} className="mt-3 text-sm">{text(c.title || c.course_code)} · {text(c.issued_at).slice(0, 10)}{(c.code||c.verify_code) && <a className="mt-2 block break-all text-violet underline" href={`/academy/verify/${encodeURIComponent(c.code||c.verify_code)}${isDemo?'?demo':''}`} target="_blank" rel="noopener noreferrer">{t('Публичная проверка подтверждения')}</a>}</p>) : <p className="mt-3 text-sm leading-relaxed text-mute">{t("Здесь будут результаты аттестаций. Уровень подтверждается практикой и проверкой по рубрике.")}</p>}</section></>}</>
}







function PortfolioControls({submission,entry,refresh}:{submission:any;entry:any;refresh:()=>void}) {
 const t=useAcademyTranslation(), action=useAction(refresh), [consent,setConsent]=useState(false)
 const published=!!entry&&!entry.revoked_at, passed=(submission.state||submission.status)==='passed'
 if(!published&&!passed)return null
 return <section className="mt-4 border-t border-line pt-4"><h3 className="text-sm font-semibold">{t('Публичное портфолио')}</h3>{published?<><a className="mt-3 block break-all text-xs text-violet underline" href={`/academy/portfolio/${encodeURIComponent(entry.slug)}${isDemo?'?demo':''}`} target="_blank" rel="noopener noreferrer">{t('Открыть публичную работу')}</a><Tap className="academy-chip mt-3" disabled={action.busy} onClick={()=>void action.run('portfolio_revoke',{submission_id:submission.id},t('Публикация отозвана'))}>{t('Отозвать публикацию')}</Tap></>:<><p className="mt-3 text-xs leading-relaxed text-mute">{t('Будут опубликованы текст и постоянная HTTPS-ссылка работы. Приватные вложения и отзывы остаются закрытыми. Прочитанный другими текст нельзя отозвать.')}</p><label className="mt-3 flex items-start gap-3 text-xs leading-relaxed"><input className="mt-1 accent-violet" type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{t('Я согласен опубликовать эту работу по общедоступной ссылке.')}</label><Tap className="academy-chip mt-3" disabled={!consent||action.busy} onClick={async()=>{const result=await action.run('portfolio_publish',{submission_id:submission.id,consent:true},t('Работа опубликована'));if(result)setConsent(false)}}>{t('Опубликовать работу')}</Tap></>}{action.feedback}</section>
}
