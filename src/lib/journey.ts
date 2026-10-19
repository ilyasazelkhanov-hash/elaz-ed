import type { Card, Course, Me } from './types.ts'

export const GOALS = [
  { id: 'goal:tools', title: 'Освоить инструменты', caption: 'Разобраться и попробовать на практике', emoji: '🧠', pattern: /инструмент|нейросет|промпт|chatgpt|claude|основ/i },
  { id: 'goal:content', title: 'Создавать контент', caption: 'Тексты, изображения и видео', emoji: '🎬', pattern: /контент|текст|видео|изображ|дизайн|картин|фото/i },
  { id: 'goal:apps', title: 'Собрать мини-аппку', caption: 'От идеи до своего приложения', emoji: '🛠️', pattern: /мини.?апп|прилож|вайбкод|код|telegram|vite/i },
  { id: 'goal:services', title: 'Развивать свои услуги', caption: 'Упаковать предложение и найти клиентов', emoji: '🚀', pattern: /клиент|продаж|услуг|бизнес|упаков|заработ|бренд/i },
] as const
export function routeLessons(feed: Card[], courses: Course[], goalId: string): Card[] {
  const goal = GOALS.find((g) => g.id === goalId) ?? GOALS[0]
  const available = feed.filter((c) => c.kind === 'lesson' && c.published && (!c.course_id || c.free_preview || courses.some((p) => p.id === c.course_id && p.access)))
  const relevant = available.filter((c) => goal.pattern.test(`${c.title} ${c.subtitle} ${c.category}`))
  return (relevant.length ? relevant : available).slice().sort((a, b) => a.position - b.position || a.id - b.id).slice(0, 4)
}
/** Read model only: original and platform ledgers are never rewritten or compounded. */
export function projectProgress(me: Me, platformXp: number): Me {
  const base = me.base_xp ?? me.xp
  const extra = Number.isSafeInteger(platformXp) && platformXp > 0 ? platformXp : 0
  return { ...me, base_xp: base, platform_xp: extra, xp: base + extra }
}
