import { AnimatePresence } from 'motion/react'
import { useMemo, useRef } from 'react'
import { levelOf } from '../lib/game'
import { academyEnabled } from '../lib/academy'
import { useStore } from '../store'
import { Avatar, Bar, Counter, Emoji, Odometer, Ring, Tap } from '../ui'
import { AdventBanner } from './advent/Banner'
import { DailyCard, StreakCard } from './home/Daily'
import { Feed } from './home/Feed'
import { HeroCarousel } from './home/Hero'
import { CourseCard, SectionTitle, StoryBubble } from './home/parts'
import { Award, ChevronRight } from 'lucide-react'

export function Home() {
  const me = useStore((s) => s.me)!
  const feed = useStore((s) => s.feed)
  const courses = useStore((s) => s.courses)
  const setTab = useStore((s) => s.setTab)
  const scroller = useRef<HTMLDivElement>(null)

  const stories = useMemo(() => feed.filter((c) => c.kind === 'story'), [feed])
  // Уроки закрытых курсов живут на странице курса, а не в общей ленте.
  const lessons = useMemo(() => feed.filter((c) => c.kind === 'lesson' && !c.course_id), [feed])
  const hero = useMemo(() => {
    const pinned = lessons.filter((c) => c.pinned)
    if (pinned.length) return pinned
    // Ничего не закреплено — берём три непройденных материала, каждый день новые.
    // Самые свежие пропускаем: они и так стоят первыми в ленте прямо под каруселью.
    const pool = lessons.slice(3).filter((c) => !c.completed)
    if (pool.length < 3) return lessons.slice(0, 3)
    const start = (Math.floor(Date.now() / 86_400_000) * 3) % pool.length
    return [0, 1, 2].map((i) => pool[(start + i) % pool.length])
  }, [lessons])
  const lvl = levelOf(me.xp)

  return (
    // Верхний отступ живёт в шапке, а не в контейнере: иначе прилипающие фильтры отсчитывают его дважды.
    <div ref={scroller} data-tab-scroll className="scroll h-full" style={{ paddingBottom: 'calc(120px + var(--bottom))' }}>
      <header className="flex items-center gap-3 px-5" style={{ paddingTop: 'calc(var(--top) + 14px)' }}>
        <Tap feedback="soft" onClick={() => setTab('profile')} aria-label="Профиль">
          <Avatar name={me.name} photo={me.photo} id={me.id} size={44} />
        </Tap>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-tight text-mute">Привет,</p>
          <p className="truncate font-display text-[17px] font-semibold leading-tight">{me.name}</p>
        </div>
        <div className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-card/80 pl-2 pr-3">
          <Emoji char="🔥" size={18} animated={me.streak > 0} className={me.streak > 0 ? '' : 'opacity-40 grayscale'} />
          <Counter value={me.streak} className="tabular font-display text-[13px] font-semibold" />
        </div>
        <div id="xp-pill" className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-card/80 pl-2 pr-3">
          <Emoji char="⚡" size={18} />
          <Odometer value={me.xp} className="font-display text-[13px] font-semibold" />
        </div>
      </header>

      <AdventBanner />
      <Tap onClick={() => useStore.getState().push({type:'certifications'})} className="mx-5 mt-3 flex w-[calc(100%-40px)] items-center gap-4 overflow-hidden rounded-[26px] border border-violet/25 bg-violet/10 p-5 text-left">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-violet/15 text-violet"><Award size={32} strokeWidth={1.7}/></span>
        <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-violet">Паспорт достижений</span><span className="mt-1 block font-display text-[17px] font-semibold leading-tight">ИИ-сертификации</span><span className="mt-1 block text-[12px] leading-snug text-mute">{me.streak>=10?'Серия 10+ · каталог открыт':'Собери стрик 10 дней · открой каталог'}</span></span>
        <ChevronRight className="shrink-0 text-violet" size={20}/>
      </Tap>
      {academyEnabled && <Tap onClick={() => useStore.getState().push({type:'academy'})} className="mx-5 mt-3 flex w-[calc(100%-40px)] items-center gap-4 rounded-[26px] border border-violet/25 bg-violet/10 p-5 text-left"><Emoji char="🪐" size={38}/><span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-violet">От идеи к своему проекту</span><b className="mt-2 block font-display text-[17px]">AI Academy</b><span className="mt-1.5 block text-[12px] leading-relaxed text-mute">Выбери направление и посмотри программу</span></span><span aria-hidden="true" className="text-xl text-violet">↗</span></Tap>}
      <Tap onClick={() => useStore.getState().push({type:'journey'})} className="mx-5 mt-3 flex w-[calc(100%-40px)] items-center gap-3 rounded-[24px] border border-line bg-card/80 p-4 text-left"><Emoji char="🧭" size={30}/><span className="flex-1"><b className="block text-[14px]">Мой следующий шаг</b><span className="mt-1 block text-[12px] text-mute">Короткий маршрут к твоей цели</span></span><span aria-hidden="true">→</span></Tap>

      <Tap
        feedback="soft"
        onClick={() => setTab('profile')}
        className="mx-5 mt-5 flex w-[calc(100%-40px)] items-center gap-4 rounded-[26px] border border-line bg-card/80 p-4 text-left"
      >
        <Ring size={68} progress={lvl.progress}>
          <Emoji char={lvl.emoji} size={34} animated />
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-wider text-mute">Уровень {lvl.index}</p>
          <p className="font-display text-[18px] font-semibold leading-tight">{lvl.title}</p>
          <Bar progress={lvl.progress} className="mt-2.5" />
          <p className="tabular mt-1.5 text-[12px] text-mute">{lvl.next ? `Ещё ${lvl.left} XP до уровня «${lvl.next.title}»` : 'Максимальный уровень'}</p>
        </div>
      </Tap>

      <div className="mx-5 mt-3">
        <AnimatePresence mode="wait" initial={false}>
          {me.daily_claimed ? <StreakCard key="streak" /> : <DailyCard key="daily" />}
        </AnimatePresence>
      </div>

      {stories.length > 0 && (
        <div className="no-bar mt-6 flex gap-3.5 overflow-x-auto px-5">
          {stories.map((s, i) => (
            <StoryBubble key={s.id} card={s} index={i} />
          ))}
        </div>
      )}

      {hero.length > 0 && (
        <>
          <SectionTitle>В фокусе</SectionTitle>
          <HeroCarousel cards={hero} />
        </>
      )}

      {courses.length > 0 && (
        <>
          <SectionTitle count={courses.length > 1 ? courses.length : undefined}>Курсы</SectionTitle>
          <div className="no-bar -mb-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-10">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} single={courses.length === 1} />
            ))}
          </div>
        </>
      )}

      <Feed lessons={lessons} scroller={scroller} />
    </div>
  )
}
