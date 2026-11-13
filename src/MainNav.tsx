import { BookOpen, House, Newspaper, User } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef, type RefObject } from 'react'
import { useStore, type Tab } from './store'
import { Tap } from './ui'
import { confirmDialog } from './lib/tg'
import { mayDiscardEditor } from './lib/navigation-context'

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: 'home', label: 'Главная', icon: House },
  { id: 'blog', label: 'Новости', icon: Newspaper },
  { id: 'courses', label: 'Курсы', icon: BookOpen },
  { id: 'profile', label: 'Профиль', icon: User },
]

/** Shared by root tabs and all app screens; modal sheets remain above this dock. */
export function MainNav({ currentTab, overlay = false, scope }: { currentTab?: Tab; overlay?: boolean; scope?: RefObject<HTMLElement | null> }) {
  const tab = useStore(s => s.tab)
  const navigateTab = useStore(s => s.navigateTab)
  const current = currentTab ?? tab
  const confirming = useRef(false)
  const select = async (id: Tab) => {
    if (confirming.current) return
    const store = useStore.getState(), stack = store.stack
    const root = scope?.current
    // Never abandon a mutation or open another purchase through navigation.
    const busy = () => !!root?.querySelector('[data-navigation-busy="true"], [data-course-payment="opening"]')
    const pendingNotice = () => store.toast('Дождись завершения текущей операции')
    if (busy()) { pendingNotice(); return }
    const dirty = !!root?.querySelector('[data-navigation-dirty="true"]')
    if (dirty || mayDiscardEditor(stack)) {
      confirming.current = true
      let approved = false
      try { approved = await confirmDialog(dirty ? 'Перейти в другой раздел? Несохранённые ответы или изменения будут потеряны.' : 'Выйти из редактора? Несохранённые изменения будут потеряны.') }
      catch { return }
      finally { confirming.current = false }
      // An async answer belongs only to the screen that requested it.
      if (!approved || useStore.getState().stack !== stack || useStore.getState().tab !== tab) return
    }
    // A request may have started while the native confirmation was open.
    if (busy()) { pendingNotice(); return }
    if (!overlay && !stack.length && tab === id) {
      const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      const scroller = root?.querySelector('[data-tab-scroll]') ?? document.querySelector('[data-tab-scroll]')
      scroller?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
    } else navigateTab(id)
  }
  return (
    <div data-main-nav className="pointer-events-none flex justify-center" style={{ paddingBottom: 'calc(14px + var(--navigation-safe-bottom))' }}>
      <nav aria-label="Основные разделы" className="pointer-events-auto mx-4 flex w-full max-w-[420px] gap-1 rounded-[24px] border border-line bg-float/95 p-1.5 shadow-[var(--shadow-float)] backdrop-blur-xl">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = current === id || id === 'profile' && current === 'top'
          return (
            <Tap key={id} feedback="select" onClick={() => select(id)} aria-label={label} aria-current={active ? 'page' : undefined} className={`relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[18px] px-1 ${active ? 'text-on-violet' : 'text-mute'}`}>
              {active && <motion.span className="absolute inset-0 rounded-[18px] bg-violet" />}
              <Icon size={19} strokeWidth={2} className="relative" aria-hidden="true" />
              <span className="relative whitespace-nowrap text-[11px] font-semibold">{label}</span>
            </Tap>
          )
        })}
      </nav>
    </div>
  )
}
