import { ChartNoAxesColumn, ChevronLeft, ChevronRight, Eye, Gift, GraduationCap, Heart, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api, errorText } from '../lib/api'
import { inTelegram } from '../lib/tg'
import type { AdminStats, Lesson } from '../lib/types'
import { useStore } from '../store'
import { EmojiTile, Tap } from '../ui'

export const sheet = {
  className: 'absolute inset-0 z-30 bg-bg',
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
  transition: { type: 'spring' as const, stiffness: 340, damping: 36 },
}

export function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  const pop = useStore((s) => s.pop)
  return (
    <div className="flex items-center gap-3 px-5">
      {!inTelegram && (
        <Tap onClick={pop} aria-label="Назад" className="grid h-10 w-10 place-items-center rounded-full border border-line bg-card">
          <ChevronLeft size={21} />
        </Tap>
      )}
      <h1 className="flex-1 font-display text-[22px] font-semibold">{title}</h1>
      {right}
    </div>
  )
}

// ---------- Список ----------

export function AdminScreen() {
  const push = useStore((s) => s.push)
  const stackSize = useStore((s) => s.stack.length)
  const { guard, toast } = useStore.getState()
  const [lessons, setLessons] = useState<Lesson[] | null>(null)
  const [stats, setStats] = useState<AdminStats | null>(null)

  // Перечитываем список каждый раз, когда редактор закрылся и мы снова сверху.
  useEffect(() => {
    let alive = true
    api
      .adminList()
      .then((d) => {
        if (!alive) return
        setLessons(d.lessons)
        setStats(d.stats)
      })
      .catch((e) => {
        guard(e)
        toast(errorText(e))
      })
    return () => {
      alive = false
    }
  }, [stackSize, guard, toast])

  return (
    <motion.div {...sheet}>
      <div className="scroll h-full" style={{ paddingTop: 'calc(var(--top) + 16px)', paddingBottom: 'calc(40px + var(--bottom))' }}>
        <Header title="Админка" />

        <div className="mt-5 grid grid-cols-4 gap-2 px-5">
          {[
            ['Всего', stats?.users],
            ['Подписаны', stats?.subscribed],
            ['За сутки', stats?.active],
            ['Пройдено', stats?.completions],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-[18px] border border-line bg-card p-3">
              <p className="font-display text-[17px] font-semibold leading-none">{value ?? '—'}</p>
              <p className="mt-1.5 text-[11px] text-mute">{label}</p>
            </div>
          ))}
        </div>

        <Tap onClick={() => push({ type: 'analytics' })} className="mx-5 mt-2 flex w-[calc(100%-40px)] items-center gap-3 rounded-[18px] border border-line bg-card p-3.5 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-violet/15 text-violet">
            <ChartNoAxesColumn size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Аналитика</span>
            <span className="block text-[12.5px] text-mute">Активность, публикации и обучение</span>
          </span>
          <ChevronRight size={18} className="text-faint" />
        </Tap>

        <Tap onClick={() => push({ type: 'advent-admin' })} className="mx-5 mt-2 flex w-[calc(100%-40px)] items-center gap-3 rounded-[18px] border border-line bg-card p-3.5 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-violet/15 text-violet">
            <Gift size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Адвент</span>
            <span className="block text-[12.5px] text-mute">Двери по дням, коды и погашения</span>
          </span>
          <ChevronRight size={18} className="text-faint" />
        </Tap>

        <Tap onClick={()=>push({type:'learning',path:'/courses/admin'})} className="mx-5 mt-2 flex min-h-16 w-[calc(100%-40px)] items-center gap-3 rounded-[18px] border border-line bg-card p-4 text-left"><GraduationCap size={22} className="shrink-0 text-violet"/><span className="min-w-0 flex-1"><b className="block text-sm">Материалы курсов</b><span className="mt-1 block text-xs text-mute">Программы, уроки, задания и проверка работ</span></span><ChevronRight size={18}/></Tap>
        <Tap onClick={() => push({ type: 'courses-admin' })} className="mx-5 mt-2 flex w-[calc(100%-40px)] items-center gap-3 rounded-[18px] border border-line bg-card p-3.5 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-violet/15 text-violet">
            <GraduationCap size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Архив курсов и заявки</span>
            <span className="block text-[12.5px] text-mute">Старые курсы, оплаты и выданные доступы</span>
          </span>
          <ChevronRight size={18} className="text-faint" />
        </Tap>

        <div className="mt-4 grid grid-cols-2 gap-2 px-5">
          <Tap onClick={() => push({ type: 'editor', lesson: null, kind: 'lesson' })} className="flex h-[52px] items-center justify-center gap-2 rounded-[18px] font-display text-[13.5px] font-semibold text-white" style={{ background: 'var(--aurora)' }}>
            <Plus size={18} /> Публикация
          </Tap>
          <Tap onClick={() => push({ type: 'editor', lesson: null, kind: 'story' })} className="flex h-[52px] items-center justify-center gap-2 rounded-[18px] border border-line bg-card2 font-display text-[13.5px] font-semibold">
            <Plus size={18} /> Сторис
          </Tap>
        </div>

        <div className="mt-5 space-y-2 px-5">
          {!lessons && Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-[74px] rounded-[20px]" />)}
          {lessons?.map((l) => (
            <Tap key={l.id} onClick={() => push({ type: 'editor', lesson: l, kind: l.kind })} className="flex w-full items-center gap-3 rounded-[20px] border border-line bg-card p-3 text-left">
              <EmojiTile emoji={l.emoji} gradient={l.gradient} size={50} radius={16} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{l.title}</p>
                <p className="mt-1 flex items-center gap-2 text-[12px] text-mute">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${l.published ? 'bg-mint/15 text-mint' : 'bg-amber/15 text-amber'}`}>{l.published ? 'Опубликован' : 'Черновик'}</span>
                  <span>{l.kind === 'story' ? 'Сторис' : l.category}</span>
                  {l.kind==='lesson'&&!l.course_id&&l.pinned&&<span className="font-semibold text-violet">Продвигается</span>}
                  <span className="flex items-center gap-0.5">
                    <Eye size={12} /> {l.views}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Heart size={12} /> {l.likes}
                  </span>
                </p>
              </div>
            </Tap>
          ))}
          {lessons?.length === 0 && <p className="py-8 text-center text-[14px] text-mute">Пока пусто. Добавь первую публикацию.</p>}
        </div>
      </div>
    </motion.div>
  )
}
