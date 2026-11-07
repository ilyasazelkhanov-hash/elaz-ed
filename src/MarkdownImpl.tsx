import { Check, Copy } from 'lucide-react'
import { Children, isValidElement, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { copyText, haptic, openLink } from './lib/tg'
import { Tap } from './ui'
import { MarkdownTable } from './MarkdownTable'
import { MarkdownImage } from './MarkdownImage'
import { LessonAnimation } from './LessonAnimation'
import { lessonAnimations } from './lib/lesson-animations'

function MarkdownPre({children}:{children?:ReactNode}) {
  const code=Children.toArray(children)[0]
  if(isValidElement<{className?:string;children?:ReactNode}>(code)&&code.props.className==='language-lesson-animation'){
    const id=typeof code.props.children==='string'?code.props.children.trim():''
    if(Object.hasOwn(lessonAnimations,id))return <LessonAnimation id={id}/>
  }
  const language=isValidElement<{className?:string}>(code)?code.props.className?.match(/\blanguage-([\w-]+)/)?.[1]:undefined
  return <Pre language={language}>{children}</Pre>
}

function Pre({ children, language }: { children?: ReactNode; language?: string }) {
  const ref = useRef<HTMLPreElement>(null)
  const [done, setDone] = useState(false)
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
     <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line bg-card2 pl-4 pr-1">
      <span className="min-w-0 truncate text-[11px] font-semibold text-mute">{language ? ({text:'Текст',markdown:'Markdown',md:'Markdown',javascript:'JavaScript',js:'JavaScript',typescript:'TypeScript',ts:'TypeScript',json:'JSON',html:'HTML',css:'CSS',python:'Python',py:'Python',bash:'Команда',sh:'Команда'} as Record<string,string>)[language] ?? language : 'Пример для копирования'}</span>
      <Tap
        aria-label={done ? 'Скопировано' : 'Скопировать пример'}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-violet"
        onClick={async () => {
          if (!(await copyText(ref.current?.innerText ?? ''))) return
          haptic.success()
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        }}
      >
        {done ? <Check size={16} className="text-mint" /> : <Copy size={16} />}
        <span>{done ? 'Скопировано' : 'Копировать'}</span>
      </Tap>
     </div>
      <pre ref={ref} className="selectable">
        {children}
      </pre>
    </div>
  )
}

export default function MarkdownImpl({ text, className = 'prose-ed' }: { text: string; className?: string }) {
  return (
    <div className={`${className} selectable`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: MarkdownPre,
          table: ({ children }) => <MarkdownTable>{children}</MarkdownTable>,
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault()
                if (href) openLink(href)
              }}
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => <MarkdownImage src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
