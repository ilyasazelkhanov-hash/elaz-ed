import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Clock3, FileText, ListChecks, PencilLine } from 'lucide-react'
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
 {key: 'reading', label: 'Объяснение', icon: BookOpen},
 {key: 'practice', label: 'Практика', icon: PencilLine},
 {key: 'check', label: 'Самопроверка', icon: ListChecks},
 {key: 'resources', label: 'Инструменты и файлы', icon: FileText},
 {key: 'all', label: 'Весь урок', icon: null},
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
 const nav = useRef<HTMLElement>(null), answerId = useId(), draftId = useId()
 const view = draft.view === 'all' || content[draft.view] ? draft.view : 'all'
 const activeSection = sections.find(section => section.key === view)!
 useEffect(() => {
  nav.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({block: 'nearest', inline: 'nearest'})
 }, [view])
 const updateDraft = (next: typeof draft) => {
  setDraft(next)
  if (!storageKey) return
  try {
   localStorage.setItem(storageKey, JSON.stringify(next))
   setSaveState('saved')
  } catch { setSaveState('unavailable') }
 }
 const select = (next: PracticeReaderView) => {
  updateDraft({...draft, view: next})
 }
 return <article className="og-reader" data-og-lesson>
  <Tap onClick={onBack} className="og-reader-back"><ArrowLeft size={17}/>К программе</Tap>
  <header className="og-reader-heading">
   <p className="og-reader-eyebrow">{course.title}</p>
   <h1>{lesson.title.replace(/^\d+\.\s*/, '')}</h1>
   <div className="og-reader-meta"><span>Урок {index + 1} из {total}</span><span><Clock3 size={14}/>{lesson.minutes} мин с практикой</span></div>
   {lesson.subtitle && <p className="og-reader-outcome"><span>Твой результат</span>{lesson.subtitle}</p>}
  </header>
  <nav ref={nav} className="og-reader-nav no-bar" aria-label="Разделы урока">
   {sections.filter(section => section.key === 'all' || content[section.key]).map(({key, label, icon: Icon}) => <Tap key={key} aria-pressed={view === key} onClick={() => select(key)} className="og-reader-section">{Icon && <Icon size={15}/>}<span>{label}</span></Tap>)}
  </nav>
  <div className="og-reader-content" data-og-content data-section={view}>
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
  {view === 'reading' && content.practice && <Tap onClick={() => select('practice')} className="og-reader-to-practice"><span><span>Теперь попробуй сам</span><b>Перейти к практике</b></span><ArrowRight size={19}/></Tap>}
  {children && <div className="og-reader-completion">{children}</div>}
  <footer className="og-reader-footer">
   {onPrevious && <Tap onClick={onPrevious}><ArrowLeft size={16}/><span>Предыдущий</span></Tap>}
   {onNext ? <Tap onClick={onNext} className="is-next"><span>Следующий урок</span><ArrowRight size={16}/></Tap> : <Tap onClick={onBack} className="is-next"><span>К программе</span><ArrowRight size={16}/></Tap>}
  </footer>
 </article>
}
