import { useRef } from 'react'
import { useStore } from '../store'
import { Feed } from './home/Feed'
import './home/free-first.css'

export function Blog() {
  const feed = useStore(s => s.feed)
  const scroller = useRef<HTMLDivElement>(null)
  return <div ref={scroller} className="scroll h-full px-5" data-tab-scroll style={{ paddingTop: 'calc(var(--top) + 23px)', paddingBottom: 'calc(110px + var(--bottom))' }}>
    <header className="mb-6"><p className="reader-eyebrow text-violet">OG CRE8R² · бесплатно</p><h1 className="mt-3 font-display text-[27px] font-semibold tracking-tight">Обновления</h1><p className="mt-3 text-base leading-relaxed text-mute">Идеи, инструменты и понятные разборы об ИИ. Читай новое, находи своё и сохраняй полезное.</p></header>
    <Feed lessons={feed} scroller={scroller}/>
  </div>
}
