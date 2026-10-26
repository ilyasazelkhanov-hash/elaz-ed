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
  return <Pre>{children}</Pre>
}

function Pre({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null)
  const [done, setDone] = useState(false)
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-card">
      <pre ref={ref} className="selectable">
        {children}
      </pre>
      <Tap
        aria-label="Скопировать"
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-xl bg-veil/10 text-mute"
        onClick={async () => {
          if (!(await copyText(ref.current?.innerText ?? ''))) return
          haptic.success()
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        }}
      >
        {done ? <Check size={16} className="text-mint" /> : <Copy size={16} />}
      </Tap>
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
