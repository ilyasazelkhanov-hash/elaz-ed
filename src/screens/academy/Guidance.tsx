import { useState } from 'react'
import { ArrowRight, Check, Copy, Lightbulb } from 'lucide-react'
import { courseGuide, lessonGuide, lessonTerms } from '../../lib/academy-guidance'
import { copyText } from '../../lib/tg'
import { Tap } from '../../ui'
import { panel, text, type Entity } from './shared'

export function CourseGuidance({ course, modules, lessons, preview = false }: { course: Entity; modules: Entity[]; lessons: Entity[]; preview?: boolean }) {
  const guide = courseGuide(course.code)
  if (!guide) return null
  return <section className={`${panel} academy-guidance`} aria-label="Курс простыми словами">
    <p className="academy-kicker">Понятный старт</p>
    <h2 className="mt-3 font-display text-[21px] font-semibold">Что ты научишься делать</h2>
    <p className="mt-3 text-sm leading-relaxed">{guide.summary}</p>
    <p className="mt-3 text-xs leading-relaxed text-mute">{preview ? `Показана программа из ${lessons.length} занятий. Актуальный доступ к обучению можно проверить обновлением страницы курса.` : `Опубликовано занятий: ${lessons.filter(lesson => lesson.state === 'published').length} из ${lessons.length}. Подсказки к планам помогают подготовиться; обучение открывается после публикации материалов.`}</p>
    <figure className="academy-learning-map">
      <img src={`/learning/academy/${course.code.split('-')[0].toLowerCase()}.svg`} alt="" width="720" height="360" loading="lazy"/>
      <figcaption>
        <span className="academy-kicker">Путь к результату</span>
        <ol className="academy-flow">{guide.flow.map((step, index) => <li key={step}><span>{index + 1}</span><b>{step}</b>{index < guide.flow.length - 1 && <ArrowRight size={16} aria-hidden="true"/>}</li>)}</ol>
      </figcaption>
    </figure>
    <h3 className="mt-5 text-sm font-semibold">На каком примере будем разбираться</h3>
    <p className="mt-2 text-sm leading-relaxed text-mute">{guide.scenario}</p>
    <div className="academy-first-step"><Lightbulb size={20} aria-hidden="true"/><div><h3 className="text-sm font-semibold">Первый маленький шаг</h3><p className="mt-2 text-sm leading-relaxed">{guide.start}</p></div></div>
    <details className="academy-help"><summary>Покажи на примере <span aria-hidden="true">+</span></summary><p>{guide.example}</p></details>
    <details className="academy-help"><summary>Как понять, что получилось <span aria-hidden="true">+</span></summary><ul>{guide.checks.map(check => <li key={check}>{check}</li>)}</ul></details>
    <details className="academy-help"><summary>Если застрял <span aria-hidden="true">+</span></summary><p>{guide.pitfall}</p><p>Уменьши задачу до одного примера. Сохрани вход, результат и место, где они разошлись. С этим наблюдением возвращайся к материалу или задай вопрос преподавателю.</p></details>
    {modules.length > 0 && <div className="mt-6"><h3 className="text-sm font-semibold">Что получится после каждого модуля</h3><ol className="academy-module-results">{modules.map((module, index) => <li key={module.code}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{module.title}</b><p>{text(module.data.outcome || module.data.outcomes)}</p></div></li>)}</ol></div>}
    <Glossary title={course.title} code={course.code}/>
  </section>
}

function Glossary({ title, code }: { title: string; code: string }) {
  const terms = lessonTerms(title, code)
  if (!terms.length) return null
  return <details className="academy-help"><summary>Непонятные слова <span aria-hidden="true">+</span></summary><dl className="academy-glossary">{terms.map(([term, meaning]) => <div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl></details>
}

export function LessonGuidance({ lesson }: { lesson: Entity; module?: Entity }) {
  const [copyState,setCopyState]=useState<'idle'|'copied'|'failed'>('idle')
  const guide=lessonGuide(lesson)
  async function copyPrompt(){setCopyState(await copyText(guide.prompt)?'copied':'failed')}
  return <details className={`${panel} academy-guidance academy-study-sources`} aria-label="Помощь с занятием"><summary>Если застрял: подсказки и непонятные слова</summary>
    <details className="academy-help"><summary>Как разобраться <span aria-hidden="true">+</span></summary><p>{guide.hints[0]}</p></details>
    <details className="academy-help"><summary>Как попробовать <span aria-hidden="true">+</span></summary><p>{guide.hints[1]}</p></details>
    <details className="academy-help"><summary>Попросить AI объяснить <span aria-hidden="true">+</span></summary><p>Сначала попробуй сам. Этот запрос помогает разобраться и не заменяет самостоятельную работу.</p><blockquote className="academy-prompt selectable">{guide.prompt}</blockquote><Tap className="academy-chip mt-3" onClick={()=>void copyPrompt()}>{copyState==='copied'?<Check size={15}/>:<Copy size={15}/>}Скопировать запрос</Tap><p role="status" aria-live="polite">{copyState==='copied'?'Запрос скопирован':copyState==='failed'?'Не удалось скопировать. Выдели запрос и скопируй вручную.':''}</p></details>
    <Glossary title={lesson.title} code={lesson.code}/>
  </details>
}
