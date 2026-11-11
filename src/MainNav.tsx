import { BookOpen, House, Newspaper, User } from 'lucide-react'
import { motion } from 'motion/react'
import { useStore, type Tab } from './store'
import { Tap } from './ui'

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: 'home', label: 'Главная', icon: House },
  { id: 'blog', label: 'Новости', icon: Newspaper },
  { id: 'courses', label: 'Курсы', icon: BookOpen },
  { id: 'profile', label: 'Профиль', icon: User },
]

/** A reader owns its navigation inside its focus scope, below the scroll area. */
export function MainNav({ inPost = false }: { inPost?: boolean }) {
  const tab = useStore(s => s.tab)
  const navigateTab = useStore(s => s.navigateTab)
  const current = inPost ? 'blog' : tab
  const select = (id: Tab) => {
    // Even the highlighted tab exits a post. On a tab, a repeated tap scrolls up.
    if (!inPost && tab === id) document.querySelector('[data-tab-scroll]')?.scrollTo({ top: 0, behavior: 'smooth' })
    else navigateTab(id)
  }
  return (
    <div className={`pointer-events-none z-20 flex justify-center ${inPost ? 'relative shrink-0 pt-2' : 'absolute inset-x-0 bottom-0'}`} style={{ paddingBottom: inPost ? 'calc(14px + max(var(--bottom), env(safe-area-inset-bottom, 0px)))' : 'calc(14px + var(--bottom))' }}>
      <nav aria-label="Основные разделы" className="pointer-events-auto mx-4 flex w-full max-w-[420px] gap-1 rounded-[24px] border border-line bg-float/95 p-1.5 shadow-[var(--shadow-float)] backdrop-blur-xl">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = current === id || id === 'profile' && current === 'top'
          return (
            <Tap key={id} feedback="select" onClick={() => select(id)} aria-label={label} aria-current={active ? 'page' : undefined} className={`relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[18px] px-1 ${active ? 'text-on-violet' : 'text-mute'}`}>
              {active && <motion.span layoutId={inPost ? 'post-nav-pill' : 'nav-pill'} className="absolute inset-0 rounded-[18px] bg-violet" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <Icon size={19} strokeWidth={2} className="relative" aria-hidden="true" />
              <span className="relative whitespace-nowrap text-[11px] font-semibold">{label}</span>
            </Tap>
          )
        })}
      </nav>
    </div>
  )
}
