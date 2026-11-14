import { ArrowLeft, ArrowRight, ChevronDown, Clock3, ListChecks } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Markdown } from '../../Markdown'
import { practiceSections } from '../../lib/og-practice'
import { practiceReaderStorageKey, readPracticeReaderDraft, splitPracticeCheck, practiceReadingPages, practiceReaderRevision, readPracticeReaderBookmark, type PracticeReaderView } from '../../lib/practice-reader'
import { Tap } from '../../ui'
import './practice.css'
import { GuideJourney } from './GuideJourney'
import { ogLessonInteraction, type OGLessonInteraction } from '../../lib/og-lesson-interactions'
import { PracticeArtifact } from './PracticeArtifact'

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

const READER_NAV_INSET = 76
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
 const [verified,setVerified]=useState<{body:string;key:string;value:OGLessonInteraction}|null>(null)
 const interactionKey=course.key+'/'+lesson.key
 const interaction=verified?.body===lesson.body&&verified.key===interactionKey?verified.value:undefined
 useEffect(()=>{
  let active=true
  setVerified(null)
  void ogLessonInteraction(course.key,lesson.key,lesson.body).then(value=>{
   if(active&&value)setVerified({body:lesson.body,key:interactionKey,value})
  })
  return ()=>{active=false}
 },[course.key,lesson.key,lesson.body,interactionKey])
 const content = useMemo(() => practiceSections(lesson.body), [lesson.body])
 const pages = useMemo(() => practiceReadingPages(content.reading), [content.reading])
 const storageKey = practiceReaderStorageKey(userId, course.key, lesson.key)
 const revision = useMemo(() => practiceReaderRevision(lesson.body), [lesson.body])
 const [bookmark,setBookmark] = useState(() => readPracticeReaderBookmark(storageKey, revision))
 const currentBookmark = bookmark.revision === revision ? bookmark : {revision, page:0, mode:'reading' as const}
 const page = Math.min(currentBookmark.page,pages.length-1)
 // Verification may offer a training, but must not replace a page the learner is reading.
 const training = currentBookmark.mode === 'training' && !!interaction
 const check = useMemo(() => splitPracticeCheck(content.check), [content.check])
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
 const updateBookmark = (next: typeof bookmark) => {
  setBookmark(next)
  if (!storageKey) return
  try { localStorage.setItem(storageKey + ':bookmark', JSON.stringify(next)) } catch { /* Reading remains usable when storage is blocked. */ }
 }
 const select = (next: PracticeReaderView, focusContent = false) => {
  if(next==='reading')updateBookmark({...currentBookmark, mode:'reading'})
  updateDraft({...draft, view: next})
  if (menu.current?.open) {
   menu.current.open = false
   menu.current.querySelector('summary')?.focus({preventScroll: true})
  }
  // Keep the newly selected section visible below the sticky navigation, including
  // when the learner moves to practice from the bottom of a long explanation.
  requestAnimationFrame(() => {
   const content=contentRef.current,scroller=content?.closest<HTMLElement>('.scroll')
   if(content&&scroller)scroller.scrollTo({top:Math.max(0,scroller.scrollTop+content.getBoundingClientRect().top-scroller.getBoundingClientRect().top-READER_NAV_INSET),behavior:'instant'})
   if (focusContent) contentRef.current?.focus({preventScroll: true})
  })
 }
 const movePage=(next:number)=>{updateBookmark({...currentBookmark,page:Math.max(0,Math.min(next,pages.length-1))});focusReading()}
 const focusReading=()=>requestAnimationFrame(()=>{const content=contentRef.current,scroller=content?.closest<HTMLElement>('.scroll');content?.focus({preventScroll:true});if(content&&scroller)scroller.scrollTo({top:Math.max(0,scroller.scrollTop+content.getBoundingClientRect().top-scroller.getBoundingClientRect().top-READER_NAV_INSET),behavior:'instant'})})
 const startTraining=()=>{updateBookmark({...currentBookmark,mode:'training'});focusReading()}
 return <article className="og-reader" data-og-lesson>
  <Tap onClick={onBack} className="og-reader-back"><ArrowLeft size={17}/>К программе</Tap>
  <header className="og-reader-heading">
   <div className="og-reader-meta"><span>Урок {index + 1} из {total}</span><span><Clock3 size={14}/>{lesson.minutes} мин с практикой</span></div>
   <h1>{lesson.title.replace(/^\d+\.\s*/, '')}</h1>
   {lesson.subtitle && <details className="og-reader-outcome"><summary tabIndex={0}>Что получится в конце урока<ChevronDown size={14} aria-hidden="true"/></summary><p>{lesson.subtitle}</p></details>}
  </header>
  <nav className="og-reader-nav" aria-label="Разделы урока">
   {sections.slice(0, 3).filter(section => section.key !== 'all' && content[section.key]).map(({key, label, short}) => <Tap key={key} aria-label={short === label ? label : `${short}: ${label}`} aria-controls={contentId} aria-pressed={view === key} onClick={() => select(key)} className="og-reader-section">{short}</Tap>)}
   <details ref={menu} className="og-reader-more" onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false}} onKeyDown={event => {if (event.key === 'Escape' && menu.current?.open) {event.preventDefault(); event.stopPropagation(); menu.current.open = false; menu.current.querySelector('summary')?.focus()}}}>
    <summary tabIndex={0} aria-label={view === 'resources' || view === 'all' ? `Ещё, выбран раздел: ${activeSection.label}` : 'Ещё разделы'} className={'og-reader-section' + (view === 'resources' || view === 'all' ? ' is-active' : '')}>Ещё<ChevronDown size={14}/></summary>
    <div className="og-reader-menu">
     {sections.slice(3).filter(section => section.key === 'all' || content[section.key]).map(({key, label}) => <Tap key={key} aria-controls={contentId} aria-pressed={view === key} onClick={() => select(key)}>{label}</Tap>)}
    </div>
   </details>
  </nav>
  <div ref={contentRef} id={contentId} tabIndex={-1} className="og-reader-content" data-og-content data-section={view}>
   <p className="og-reader-section-label">{view==='reading'?training?'Учебный пример':'Читаем и разбираемся':activeSection.label}</p>
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
   </> : view === 'reading' ? training && interaction ? <>
    <GuideJourney scrollInset={READER_NAV_INSET} scope={String(userId ?? 'demo')} guide={interaction} challenges={interaction.challenges}>
     <p className="og-reader-training-note">Теперь выполни самостоятельную работу из урока. Ответы в тренировке не подтверждают навык.</p>
     <Tap className="og-reader-page-primary" onClick={() => select('practice', true)}>Открыть задание и сохранить свою работу<ArrowRight size={17} aria-hidden="true"/></Tap>
    </GuideJourney>
    <details className="og-reader-source"><summary tabIndex={0}>Исходный материал урока</summary><Markdown text={content.reading}/></details>
    <Tap className="og-reader-return" onClick={()=>{updateBookmark({...currentBookmark,mode:'reading'});focusReading()}}>Вернуться к чтению</Tap>
   </> : <>
    <div className="og-reader-page-top"><span>Фрагмент {page+1} из {pages.length}</span><Tap onClick={()=>select('all',true)}>Весь текст</Tap></div>
    <progress className="og-reader-progress" max={pages.length} value={page+1} aria-label="Место в тексте, не оценка навыка"/>
    <div key={page} className="og-reader-page"><Markdown text={pages[page]}/></div>
    <div className="og-reader-page-actions">
     <Tap className="og-reader-page-back" aria-label="Предыдущий фрагмент" disabled={page===0} onClick={()=>movePage(page-1)}><ArrowLeft size={18} aria-hidden="true"/></Tap>
     {page<pages.length-1?<Tap className="og-reader-page-primary" onClick={()=>movePage(page+1)}>Дальше<ArrowRight size={18} aria-hidden="true"/></Tap>:interaction?<Tap className="og-reader-page-primary" onClick={startTraining}>Попробовать на примере<ArrowRight size={18} aria-hidden="true"/></Tap>:content.practice?<Tap className="og-reader-page-primary" onClick={()=>select('practice',true)}>К своей практике<ArrowRight size={18} aria-hidden="true"/></Tap>:content.check?<Tap className="og-reader-page-primary" onClick={()=>select('check',true)}>К самопроверке<ArrowRight size={18} aria-hidden="true"/></Tap>:<Tap className="og-reader-page-primary" onClick={onBack}>К программе<ArrowRight size={18} aria-hidden="true"/></Tap>}
    </div>
    {interaction&&page<pages.length-1&&<Tap className="og-reader-return" onClick={startTraining}>Сразу к учебному примеру</Tap>}
   </> : <Markdown key={view} text={view === 'all' ? lesson.body : content[view]}/>}

  </div>
  {content.practice && <div hidden={view !== 'practice'}><PracticeArtifact scope={userId} course={course.key} lesson={lesson.key} title={lesson.title} task={lesson.subtitle || 'Выполни задание выше. Сохрани результат и объясни способ его проверки.'} criteria={['Результат отвечает заданию и его ограничениям.','Факты и источники проверены, неподтверждённое отмечено.','Я могу объяснить своё решение и повторить его на другом примере.']}/></div>}

  {children && <details className="og-reader-completion"><summary tabIndex={0}>Отметки и доступ к курсу<ChevronDown size={16} aria-hidden="true"/></summary>{children}</details>}
  <footer className="og-reader-footer">
   {onPrevious && <Tap onClick={onPrevious}><ArrowLeft size={16}/><span>Предыдущий</span></Tap>}
   {onNext ? <Tap onClick={onNext} className="is-next"><span>Следующий урок</span><ArrowRight size={16}/></Tap> : <Tap onClick={onBack} className="is-next"><span>К программе</span><ArrowRight size={16}/></Tap>}
  </footer>
 </article>
}
