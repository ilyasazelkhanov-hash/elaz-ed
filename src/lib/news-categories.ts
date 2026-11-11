/** Display/filter aliases only. Never rewrite persisted categories or classify a post from its title. */
export const newsCategoryGroups = [
  { label: 'Видео и контент', aliases: ['Видео', 'Видео и монтаж'] },
  { label: 'Картинки и дизайн', aliases: ['Дизайн'] },
  { label: 'Исследования и обучение', aliases: ['Исследования', 'Исследования ИИ', 'ИИ и обучение'] },
] as const

const clean = (category: string) => category.trim().replace(/\s+/g, ' ')
const key = (category: string) => clean(category).toLocaleLowerCase('ru')
const aliases = new Map<string, string>(newsCategoryGroups.flatMap(group =>
  [group.label, ...group.aliases].map(label => [key(label), group.label] as const)
))

/** New, unrecognized categories remain visible instead of falling into an unrelated catch-all. */
export function newsCategory(category: string | null | undefined): string {
  const label = clean(category ?? '')
  return aliases.get(key(label)) ?? label
}

/** Retain a selected archive category even when it is absent from the currently loaded page. */
export function newsCategories(categories: readonly (string | null | undefined)[], selected = 'Все'): string[] {
  return [...new Set([...categories, ...(selected === 'Все' ? [] : [selected])].map(newsCategory).filter(Boolean))]
}

/** Legacy in-memory filters and canonical labels both match the complete family. */
export function matchesNewsCategory(category: string | null | undefined, selected: string): boolean {
  return selected === 'Все' || newsCategory(category) === newsCategory(selected)
}
