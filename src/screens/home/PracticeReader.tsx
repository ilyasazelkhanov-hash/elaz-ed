import { ArrowLeft, ArrowRight, ChevronDown, Clock3, ListChecks } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Markdown } from '../../Markdown'
import { practiceSections } from '../../lib/og-practice'
import { practiceReaderStorageKey, readPracticeReaderDraft, splitPracticeCheck, type PracticeReaderView } from '../../lib/practice-reader'
import { Tap } from '../../ui'
import './practice.css'

export type PracticeReaderProps = {
 course: {key: string; title: string}
 lesson: {key: string; title: string; minutes: number; subtitle?: string; body: string}
 index: number
 total: number
 userId?: string | number
 onBack: () => void
 onPrevious?: () => void
 onNext?: () => void
 children?: ReactNode
}

const sections = [
 {key: 'reading', label: 'Объяснение', short: 'Читать'},
 {key: 'practice', label: 'Практика', short: 'Практика'},
 {key: 'check', label: 'Самопроверка', short: 'Проверить'},
 {key: 'resources', label: 'Инструменты и файлы', short: 'Инструменты и файлы'},
 {key: 'all', label: 'Весь урок', short: 'Весь урок'},
] as const

/** Receives an authorized lesson body. This component never imports the paid books. */
export function PracticeReader(props: PracticeReaderProps) {
 return <Reader key={`${props.userId ?? 'session'}:${props.course.key}:${props.lesson.key}`} {...props}/>
}

function Reader({course, lesson, index, total, userId, onBack, onPrevious, onNext, children}: PracticeReaderProps) {
 const content = useMemo(() => practiceSections(lesson.body), [lesson.body])
 const check = useMemo(() => splitPracticeCheck(content.check), [content.check])
 const storageKey = practiceReaderStorageKey(userId, course.key, lesson.key)
 const [draft, setDraft] = useState(() => readPracticeReaderDraft(storageKey))
 const [saveState, setSaveState] = useState<'saved' | 'unavailable'>(storageKey ? 'saved' : 'unavailable')
 const [showAnswer, setShowAnswer] = useState(false)
 const menu = useRef<HTMLDetailsElement>(null), contentRef = useRef<HTMLDivElement>(null)
 const answerId = useId(), draftId = useId(), contentId = useId()
 const view = draft.view === 'all' || content[draft.view] ? draft.view : 'all'
 const activeSection = sections.find(section => section.key === view)!
 useEffect(() => {
  const closeOutside = (event: PointerEvent) => {
   if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false
  }
  document.addEventListener('pointerdown', closeOutside)
  return () => document.removeEventListener('pointerdown', closeOutside)
 }, [])
 const updateDraft = (next: typeof draft) => {
  setDraft(next)
  if (!storageKey) return
  try {
   localStorage.setItem(storageKey, JSON.stringify(next))
   setSaveState('saved')
  } catch { setSaveState('unavailable') }
 }
 const select = (next: PracticeReaderView, focusContent = false) => {
  updateDraft({...draft, view: next})
  if (menu.current?.open) {
   menu.current.open = false
   menu.current.querySelector('summary')?.focus({preventScroll: true})
  }
  // Keep the newly selected section visible below the sticky navigation, including
  // when the learner moves to practice from the bottom of a long explanation.
  requestAnimationFrame(() => {
   contentRef.current?.scrollIntoView({block: 'start', behavior: 'instant'})
   if (focusContent) contentRef.current?.focus({preventScroll: true})
  })
 }
 return <article className="og-reader" data-og-lesson>
  <Tap onClick={onBack} className="og-reader-back"><ArrowLeft size={17}/>К программе</Tap>
  <header className="og-reader-heading">
   <p className="og-reader-eyebrow">{course.title}</p>
   <h1>{lesson.title.replace(/^\d+\.\s*/, '')}</h1>
   <div className="og-reader-meta"><span>Урок {index + 1} из {total}</span><span><Clock3 size={14}/>{lesson.minutes} мин с практикой</span></div>
   {lesson.subtitle && <p className="og-reader-outcome"><span>Твой результат</span>{lesson.subtitle}</p>}
  </header>
  <nav className="og-reader-nav" aria-label="Разделы урока">
   {sections.slice(0, 3).filter(section => section.key !== 'all' && content[section.key]).map(({key, label, short}) => <Tap key={key} aria-label={short === label ? label : `${short}: ${label}`} aria-controls={contentId} aria-pressed={view === key} onClick={() => select(key)} className="og-reader-section">{short}</Tap>)}
   <details ref={menu} className="og-reader-more" onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false}} onKeyDown={event => {if (event.key === 'Escape' && menu.current?.open) {event.preventDefault(); event.stopPropagation(); menu.current.open = false; menu.current.querySelector('summary')?.focus()}}}>
    <summary aria-label={view === 'resources' || view === 'all' ? `Ещё, выбран раздел: ${activeSection.label}` : 'Ещё разделы'} className={'og-reader-section' + (view === 'resources' || view === 'all' ? ' is-active' : '')}>Ещё<ChevronDown size={14}/></summary>
    <div className="og-reader-menu">
     {sections.slice(3).filter(section => section.key === 'all' || content[section.key]).map(({key, label}) => <Tap key={key} aria-controls={contentId} aria-pressed={view === key} onClick={() => select(key)}>{label}</Tap>)}
    </div>
   </details>
  </nav>
  <div ref={contentRef} id={contentId} tabIndex={-1} className="og-reader-content" data-og-content data-section={view}>
   <p className="og-reader-section-label">{activeSection.label}</p>
   {view === 'check' ? <>
    <Markdown text={check.question}/>
    <div className="og-reader-draft">
     <label htmlFor={draftId}>Твой ответ</label>
     <p>Объясни своими словами, затем сравни с разбором.</p>
     <textarea id={draftId} value={draft.answer} placeholder="Что ты думаешь и почему?" rows={5} onChange={event => updateDraft({...draft, answer: event.target.value})}/>
     <span role="status" className="og-reader-save">{saveState === 'saved' ? 'Черновик сохраняется в этом браузере' : 'Черновик доступен на этом экране. Браузер не сохраняет его.'}</span>
    </div>
    {check.answer && <div className="og-reader-answer">
     <Tap aria-expanded={showAnswer} aria-controls={answerId} onClick={() => setShowAnswer(current => !current)}><ListChecks size={18}/><span>{showAnswer ? 'Скрыть разбор' : 'Показать разбор'}</span><ChevronDown size={17} className={showAnswer ? 'is-open' : ''}/></Tap>
     <div id={answerId} hidden={!showAnswer}>{showAnswer && <Markdown text={check.answer}/>}</div>
    </div>}
   </> : <Markdown key={view} text={view === 'all' ? lesson.body : content[view]}/>}
  </div>
  {view === 'reading' && content.practice && <Tap onClick={() => select('practice', true)} className="og-reader-to-practice"><span><span>Теперь попробуй сам</span><b>Перейти к практике</b></span><ArrowRight size={19}/></Tap>}
  {children && <div className="og-reader-completion">{children}</div>}
  <footer className="og-reader-footer">
   {onPrevious && <Tap onClick={onPrevious}><ArrowLeft size={16}/><span>Предыдущий</span></Tap>}
   {onNext ? <Tap onClick={onNext} className="is-next"><span>Следующий урок</span><ArrowRight size={16}/></Tap> : <Tap onClick={onBack} className="is-next"><span>К программе</span><ArrowRight size={16}/></Tap>}
  </footer>
 </article>
}
