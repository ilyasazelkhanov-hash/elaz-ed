import { useId, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Markdown } from '../../Markdown'
import { readingParts, belongsToReadingSection,type ReadingSectionName,type ReadingPart } from '../../lib/academy-reading'
import { copyText } from '../../lib/tg'
import { Tap } from '../../ui'
import { External, list, panel, text } from './shared'
import './lesson-reading.css'

const labels = { text: '', practice: 'Сделай самостоятельно', check: 'Проверь себя', hint: 'Подсказка', example: 'Разберём пример', result: 'Что должно получиться' }

function ReadingCode({ part }: { part: Extract<ReadingPart, { kind: 'code' }> }) {
  const [copied, setCopied] = useState<'idle' | 'success' | 'failure'>('idle')
  const commands = /^(?:bash|sh|shell)$/i.test(part.language)
  async function copy() {
    try { setCopied(await copyText(part.text) ? 'success' : 'failure') } catch { setCopied('failure') }
  }
  if (part.language === 'lesson-animation') return <Markdown text={part.source} className="academy-reading-prose"/>
  return <div className="academy-reading-code">
    <div className="academy-reading-code-heading"><span>{commands ? 'Команды для терминала' : part.language ? `Код · ${part.language}` : 'Фрагмент кода или вывода'}</span><Tap className="academy-reading-copy" onClick={() => void copy()}>{copied === 'success' ? <Check size={15} aria-hidden="true"/> : <Copy size={15} aria-hidden="true"/>}{copied === 'success' ? 'Скопировано' : commands ? 'Скопировать команды' : 'Скопировать код'}</Tap></div>
    <pre tabIndex={0}><code>{part.text}</code></pre>
    <p className="academy-reading-copy-status" role="status" aria-live="polite">{copied === 'success' ? 'Код скопирован.' : copied === 'failure' ? 'Не удалось скопировать. Выдели код и скопируй вручную.' : ''}</p>
  </div>
}

function ReadingSection({ part }: { part: Exclude<ReadingPart, { kind: 'code' }> }) {
  const id = useId()
  return <section className={`academy-reading-section is-${part.kind}`} aria-labelledby={part.heading ? id : undefined}>
    {part.kind !== 'text' && <p className="academy-reading-section-label">{labels[part.kind]}</p>}
    {part.heading && <h3 id={id}>{part.heading}</h3>}
    {part.text && <Markdown text={part.text} className="academy-reading-prose"/>}
  </section>
}

/** Only the supplied student-visible blocks are rendered; no grading fields are read. */
export function LessonReading({ blocks,section="all" }: { blocks: any[];section?:ReadingSectionName }) {
  return <div className="academy-lesson-reading">{blocks.map((block, index) => {
    const body = block.data || block, kind = block.type || block.kind || body.type || 'markdown'
    const content = text(body.text || body.body || body.content || body.markdown)
    const title = text(body.title)
    if (kind === 'code' && !['all','reading'].includes(section)) return null
    if (kind === 'code') return <ReadingCode key={block.id || index} part={{ kind: 'code', text: text(body.code || content), language: text(body.language || body.lang), source: '' }}/>
    if(kind==='checklist'&&!['all','check'].includes(section))return null
    if (kind === 'checklist') return <section key={block.id || index} className={`${panel} academy-reading-checklist`}><fieldset><legend>{title || 'Самопроверка'}</legend>{list(body.items || content).map((item, itemIndex) => <label key={itemIndex}><input type="checkbox"/><span>{item}</span></label>)}</fieldset></section>
    if(['video','embed','link','file'].includes(kind)&&!['all','reading'].includes(section))return null
    if (['video', 'embed', 'link', 'file'].includes(kind)) return <section key={block.id || index} className={`${panel} academy-reading-resource`}><h3>{title || text(body.label) || (kind === 'file' ? 'Файл для практики' : kind === 'video' ? 'Видео к теме' : 'Материал по теме')}</h3><External url={body.url || body.src}>{text(body.label || body.title) || 'Открыть материал'}</External>{content && <Markdown text={content} className="academy-reading-prose"/>}</section>
    if(['quiz','assessment','assignment'].includes(kind)&&!['all','practice'].includes(section))return null
    if (['quiz', 'assessment', 'assignment'].includes(kind)) return <section key={block.id || index} className={`${panel} academy-reading-resource`}><p>Задание и проверка находятся в разделе практики ниже.</p></section>
    const parts = readingParts(content).filter(part=>belongsToReadingSection(part,section))
    if(!parts.length)return null
    return <article key={block.id || index} className={`${panel} academy-reading-article`}>{title && <h2>{title}</h2>}{parts.map((part, partIndex) => part.kind === 'code' ? <ReadingCode key={partIndex} part={part}/> : <ReadingSection key={partIndex} part={part}/>)}</article>
  })}</div>
}
