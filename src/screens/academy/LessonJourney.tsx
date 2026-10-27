import { ArrowLeft, ArrowRight } from 'lucide-react'
import { academyLessonPosition, orderedAcademyModules } from '../../lib/academy-sequence'
import { Tap } from '../../ui'
import { panel, type Entity, type Navigate } from './shared'
import './journey.css'

type JourneyProps = { lesson: Entity; lessons: Entity[]; modules: Entity[]; courseCode: string; go: Navigate }

export function LessonTrail({ lesson, lessons, modules, courseCode, go }: JourneyProps) {
  const position = academyLessonPosition(lesson.code, lessons, modules)
  if (!position) return null
  const module = modules.find(item => item.code === lesson.parent_code)
  return <nav className={`${panel} academy-lesson-trail`} aria-label="Место урока в курсе">
    <Tap className="academy-journey-course" onClick={() => go(`/courses/${courseCode}`)}>← Все уроки курса</Tap>
    <div className="academy-journey-location"><b>Урок {position.number} из {position.total}</b><span>Модуль {position.moduleNumber} из {position.moduleTotal} · {position.label}</span></div>
    {module && <p className="academy-journey-module-title">{module.title}</p>}
    <ol className="academy-journey-module-steps" aria-label="Порядок модулей">{orderedAcademyModules(modules).map((item, index) => <li key={item.code} aria-current={item.code === lesson.parent_code ? 'step' : undefined}><span>Модуль {index + 1}</span></li>)}</ol>
    <p className="academy-journey-note">Внутри модуля: урок {position.localNumber} из {position.localTotal}. Иди по порядку; к предыдущему материалу можно вернуться.</p>
    {position.next && <p className="academy-journey-note"><b>Следом:</b> урок {position.number + 1} · {position.next.title}</p>}
  </nav>
}

export function LessonNavigation({ lesson, lessons, modules, courseCode, go }: JourneyProps) {
  const position = academyLessonPosition(lesson.code, lessons, modules)
  if (!position) return null
  return <nav className={`${panel} academy-lesson-navigation`} aria-label="Предыдущий и следующий урок">
    <p className="academy-kicker">Дальше по курсу</p>
    <p className="academy-journey-note">Переход открывает материал. Зачёт сохраняется после выполнения условий урока.</p>
    <div className="academy-journey-neighbours">
      {position.previous && <Tap className="academy-journey-link" onClick={() => go(`/lessons/${position.previous.code}`)}><ArrowLeft size={17} aria-hidden="true"/><span><small>Предыдущий · урок {position.number - 1}</small><b>{position.previous.title}</b></span></Tap>}
      {position.next ? <Tap className="academy-journey-link is-next" onClick={() => go(`/lessons/${position.next.code}`)}><span><small>Следующий · урок {position.number + 1}</small><b>{position.next.title}</b>{position.next.parent_code !== lesson.parent_code && <em>Начало следующего модуля</em>}{position.next.state !== 'published' && <em>Материал ещё готовится</em>}</span><ArrowRight size={17} aria-hidden="true"/></Tap> : <div className="academy-journey-finish"><b>Это последний урок курса</b><p>Проверь условия итоговой работы и статус её проверки в программе курса.</p></div>}
    </div>
    <Tap className="academy-chip mt-4" onClick={() => go(`/courses/${courseCode}`)}>К программе курса</Tap>
  </nav>
}
