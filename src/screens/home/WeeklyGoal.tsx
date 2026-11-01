import { ArrowRight, BookOpen, Target } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { LearningGoalState } from '../../lib/types'
import { useStore } from '../../store'
import { Tap } from '../../ui'

export function WeeklyGoal() {
  const [state, setState] = useState<LearningGoalState | null>(null)
  const setTab = useStore((s) => s.setTab)
  useEffect(() => { let live = true; void api.learningGoal().then((value) => { if (live) setState(value) }).catch(() => {}); return () => { live = false } }, [])
  if (!state) return null
  const done = Math.min(state.completed, state.goal)
  return <Tap onClick={() => setTab('profile')} className="mx-5 mt-3 flex w-[calc(100%-40px)] items-center gap-3 rounded-[22px] border border-line bg-card/80 p-4 text-left">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-mint/10 text-mint"><Target size={20}/></span>
    <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><b className="text-[13.5px]">Цель недели</b><span className="text-[11px] font-semibold tabular text-mute">{done}/{state.goal} занятий</span></span><span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-veil/8"><span className="block h-full rounded-full bg-mint transition-all" style={{width:`${Math.min(100, done / state.goal * 100)}%`}}/></span><span className="mt-1.5 flex items-center gap-1 text-[11px] text-mute">{state.enabled ? state.nextLesson ? <><BookOpen size={12}/>Дальше: {state.nextLesson.title}</> : 'Все доступные уроки пройдены' : 'Настроить цель и напоминание'}</span></span>
    <ArrowRight size={16} className="shrink-0 text-faint"/>
  </Tap>
}
