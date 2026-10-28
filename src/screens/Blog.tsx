import { useStore } from '../store'
import { Feed } from './home/Feed'
export function Blog(){
 const feed=useStore(s=>s.feed)
 return <div className="scroll h-full px-5" data-tab-scroll style={{paddingTop:'calc(var(--top) + 20px)',paddingBottom:'calc(110px + var(--bottom))'}}><h1 className="font-display text-[28px] font-semibold">Блог</h1><p className="mb-5 mt-2 text-sm leading-relaxed text-mute">Новости и заметки об ИИ. Выбирай интересное и читай.</p><Feed lessons={feed}/></div>
}
