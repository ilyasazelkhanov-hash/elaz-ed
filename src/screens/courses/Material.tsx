import {ArrowLeft,ArrowRight} from 'lucide-react'
import {useCourseMaterials} from '../../lib/course-materials'
import {Cta,Tap} from '../../ui'
import {LessonReading} from '../academy/LessonReading'
import {LessonVisuals} from '../academy/LessonVisuals'
import {LessonStudyNav,StudyHeading,StudyExample,LessonTask,LessonChecks,LessonResources,studySections,type StudyCase} from '../academy/LessonStudy'
import {Empty,External} from '../academy/shared'
import {safeAcademyUrl} from '../../lib/academy-types'

/** The public teaching edition is actual material, never a fake enrollment or grade. */
export function CourseMaterial({code,go}:{code:string;go:(path:string)=>void}){
 const course=code.match(/^(.+)-M\d+-L\d+$/)?.[1]||'',resource=useCourseMaterials(course)
 if(resource.error)return <section role="alert" className="rounded-2xl border border-line bg-card p-5"><p>{resource.error}</p><Cta className="mt-4" onClick={resource.retry}>Повторить загрузку</Cta></section>
 if(!resource.data)return <p role="status" className="p-5 text-sm text-mute">Загружаем материал урока…</p>
 const book=resource.data,index=book.lessons.findIndex(l=>l.code===code),lesson=book.lessons[index]
 if(!lesson)return <Empty title="Урок не найден">Вернись к программе курса.</Empty>
 const blocks=lesson.data.content_blocks,examples=blocks.filter(b=>b.study).sort((a,b)=>Number(b.learning_role==='beginner')-Number(a.learning_role==='beginner')),example=examples[0]?.study as StudyCase|undefined
 const sources=[...new Map([...(lesson.sources||[]),...(book.sources||[])].map(source=>[`${source.code}:${source.start_seconds??0}:${source.end_seconds??''}`,source])).values()]
 const reading=blocks.filter(b=>!b.study),ids=studySections(code),moduleIndex=book.modules.findIndex(m=>m.code===lesson.parent_code)
 return <div data-public-course-material>
  <Tap className="mb-4 min-h-11 text-left text-sm text-violet" onClick={()=>go(`/courses/${course}`)}>← {book.course.title}</Tap>
  <p className="text-xs text-mute">Урок {index+1} из {book.lessons.length} · Модуль {moduleIndex+1} из {book.modules.length}</p>
  <h1 className="mb-4 mt-3 font-display text-[25px] font-semibold leading-tight">{lesson.title}</h1><p className="mb-5 text-sm leading-relaxed text-mute">{lesson.data.artifact}</p>
  <LessonStudyNav code={code}/>
  <section id={ids[0]} className="academy-study-stage"><StudyHeading number="01" title="Разберись в теме"/>{example?.concept&&<p className="academy-study-plain">{example.concept}</p>}<LessonReading blocks={reading} section="reading"/></section>
  <section id={ids[1]} className="academy-study-stage"><StudyHeading number="02" title="Посмотри на примере"/>{examples.map((block,index)=><StudyExample key={`${block.learning_role||'example'}-${index}`} data={block.study} showConcept={index>0}/>)}<LessonVisuals code={code}/></section>
  <section id={ids[2]} className="academy-study-stage"><StudyHeading number="03" title="Выполни практику"/><LessonReading blocks={reading} section="practice"/><LessonResources blocks={blocks}/><LessonTask artifact={lesson.data.artifact} criteria={lesson.data.acceptance}/><details className="academy-panel mt-4"><summary>Подсказки</summary><LessonReading blocks={reading} section="hint"/></details></section>
  <section id={ids[3]} className="academy-study-stage"><StudyHeading number="04" title="Проверь результат"/><LessonReading blocks={reading} section="check"/><LessonChecks criteria={lesson.data.acceptance}/><p className="mt-4 text-sm leading-relaxed text-mute">Самопроверка помогает разобраться с заданием. Зачёт и проверка работы сохраняются отдельно в обучении.</p></section>
  {sources.length>0&&<details className="academy-panel academy-study-sources mt-5"><summary>Источники и дополнительные материалы · {sources.length}</summary><div className="mt-4 space-y-4">{sources.map(source=><section key={`${source.code}:${source.start_seconds??0}:${source.end_seconds??''}`} className="academy-source"><External url={safeAcademyUrl(source.url,source.start_seconds)}>{source.title}</External>{(source.author||source.provider||source.language)&&<p className="mt-2 text-xs text-mute">{[source.author||source.provider,source.language].filter(Boolean).join(' · ')}</p>}{source.start_seconds!==undefined&&<p className="mt-2 text-xs text-violet">Фрагмент с {Math.floor(source.start_seconds/60)}:{String(source.start_seconds%60).padStart(2,'0')}{source.end_seconds!==undefined&&` до ${Math.floor(source.end_seconds/60)}:${String(source.end_seconds%60).padStart(2,'0')}`}</p>}<p className="mt-2 text-xs leading-relaxed text-mute">{source.allowed_use||source.usage_rights||source.rights||'Внешний материал открывается у правообладателя.'} Проверен: {source.checked_at.slice(0,10)}.</p></section>)}</div></details>}
  <nav className="mt-6 flex flex-wrap gap-3" aria-label="Соседние уроки">{index>0&&<Tap className="academy-chip min-h-11" onClick={()=>go(`/read/${book.lessons[index-1].code}`)}><ArrowLeft size={16}/>Предыдущий урок</Tap>}{index+1<book.lessons.length&&<Cta className="flex-1" onClick={()=>go(`/read/${book.lessons[index+1].code}`)}>Следующий урок<ArrowRight size={16}/></Cta>}</nav>
  <Tap className="mt-5 min-h-11 text-sm text-violet" onClick={()=>go(`/courses/${course}`)}>Все уроки и результаты курса →</Tap>
 </div>
}
