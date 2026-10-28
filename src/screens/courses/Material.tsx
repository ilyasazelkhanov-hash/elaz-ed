import {ArrowLeft,ArrowRight} from 'lucide-react'
import {useCourseMaterials} from '../../lib/course-materials'
import {Cta,Tap} from '../../ui'
import {LessonReading} from '../academy/LessonReading'
import {LessonVisuals} from '../academy/LessonVisuals'
import {LessonStudyNav,StudyHeading,StudyExample,LessonTask,LessonChecks,LessonResources,studySections,type StudyCase} from '../academy/LessonStudy'
import {Empty} from '../academy/shared'

/** The public teaching edition is actual material, never a fake enrollment or grade. */
export function CourseMaterial({code,go}:{code:string;go:(path:string)=>void}){
 const course=code.match(/^(.+)-M\d+-L\d+$/)?.[1]||'',resource=useCourseMaterials(course)
 if(resource.error)return <section role="alert" className="rounded-2xl border border-line bg-card p-5"><p>{resource.error}</p><Cta className="mt-4" onClick={resource.retry}>Повторить загрузку</Cta></section>
 if(!resource.data)return <p role="status" className="p-5 text-sm text-mute">Загружаем материал урока…</p>
 const book=resource.data,index=book.lessons.findIndex(l=>l.code===code),lesson=book.lessons[index]
 if(!lesson)return <Empty title="Урок не найден">Вернись к программе курса.</Empty>
 const blocks=lesson.data.content_blocks,examples=blocks.filter(b=>b.study),example=(examples.find(b=>b.learning_role==='beginner')||examples[0])?.study as StudyCase|undefined
 const reading=blocks.filter(b=>!b.study),ids=studySections(code),moduleIndex=book.modules.findIndex(m=>m.code===lesson.parent_code)
 return <div data-public-course-material>
  <Tap className="mb-4 min-h-11 text-left text-sm text-violet" onClick={()=>go(`/courses/${course}`)}>← {book.course.title}</Tap>
  <p className="text-xs text-mute">Урок {index+1} из {book.lessons.length} · Модуль {moduleIndex+1} из {book.modules.length}</p>
  <h1 className="mb-4 mt-3 font-display text-[25px] font-semibold leading-tight">{lesson.title}</h1><p className="mb-5 text-sm leading-relaxed text-mute">{lesson.data.artifact}</p>
  <LessonStudyNav code={code}/>
  <section id={ids[0]} className="academy-study-stage"><StudyHeading number="01" title="Разберись в теме"/>{example?.concept&&<p className="academy-study-plain">{example.concept}</p>}<LessonReading blocks={reading} section="reading"/></section>
  <section id={ids[1]} className="academy-study-stage"><StudyHeading number="02" title="Посмотри на примере"/>{example&&<StudyExample data={example} showConcept={false}/>}<LessonVisuals code={code}/></section>
  <section id={ids[2]} className="academy-study-stage"><StudyHeading number="03" title="Выполни практику"/><LessonReading blocks={reading} section="practice"/><LessonResources blocks={blocks}/><LessonTask artifact={lesson.data.artifact} criteria={lesson.data.acceptance}/><details className="academy-panel mt-4"><summary>Подсказки</summary><LessonReading blocks={reading} section="hint"/></details></section>
  <section id={ids[3]} className="academy-study-stage"><StudyHeading number="04" title="Проверь результат"/><LessonReading blocks={reading} section="check"/><LessonChecks criteria={lesson.data.acceptance}/><p className="mt-4 text-sm leading-relaxed text-mute">Самопроверка помогает разобраться с заданием. Зачёт и проверка работы сохраняются отдельно в обучении.</p></section>
  <nav className="mt-6 flex flex-wrap gap-3" aria-label="Соседние уроки">{index>0&&<Tap className="academy-chip min-h-11" onClick={()=>go(`/read/${book.lessons[index-1].code}`)}><ArrowLeft size={16}/>Предыдущий урок</Tap>}{index+1<book.lessons.length&&<Cta className="flex-1" onClick={()=>go(`/read/${book.lessons[index+1].code}`)}>Следующий урок<ArrowRight size={16}/></Cta>}</nav>
  <Tap className="mt-5 min-h-11 text-sm text-violet" onClick={()=>go(`/courses/${course}`)}>Все уроки и результаты курса →</Tap>
 </div>
}
