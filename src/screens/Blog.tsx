import { useRef } from 'react'
import { useStore } from '../store'
import { Feed } from './home/Feed'
import './home/free-first.css'

export function Blog() {
  const feed = useStore(s => s.feed)
  const scroller = useRef<HTMLDivElement>(null)
  return <div ref={scroller} className="scroll h-full px-5" data-tab-scroll style={{ paddingTop: 'calc(var(--top) + 23px)', paddingBottom: 'calc(110px + var(--bottom))' }}>
    <header className="mb-1"><h1 className="font-display text-[24px] font-semibold tracking-tight">Новости</h1></header>
    <Feed lessons={feed} scroller={scroller}/>
  </div>
}
