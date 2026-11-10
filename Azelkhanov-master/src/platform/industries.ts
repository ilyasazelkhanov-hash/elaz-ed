export const industries = {
  coffee: ['Кофейня', 'Ваш привычный вкус. Новые поводы зайти.', 'cup'],
  fashion: ['Fashion', 'Вещи с вашим характером.', 'bag'],
  construction: ['Строительство', 'От первого замера до согласованного результата.', 'notebook'],
  company: ['Компания', 'Первые 30 дней в кругу команды.', 'orbit'],
  expert: ['Эксперт', 'Знания превращаются в практику.', 'lilac'],
} as const

export function resolveIndustryKey(id: unknown): keyof typeof industries {
  return typeof id === 'string' && Object.hasOwn(industries, id) ? id as keyof typeof industries : 'coffee'
}
