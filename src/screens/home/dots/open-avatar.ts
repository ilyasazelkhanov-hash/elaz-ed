import { examples, validateAvatar, type AvatarDefinition } from 'open-bot-avatar'
import { companionAvatars, type CompanionPreferences } from '../../../lib/home-companion'

// Local, upstream definitions only. Never render user-supplied SVG or remote markup.
const gallery = import.meta.glob('./avatars/*.json', { eager: true, import: 'default' })
const definitions = new Map<string, AvatarDefinition>(examples.map(item => [item.id, item]))
for (const item of Object.values(gallery)) {
  const result = validateAvatar(item)
  if (result.ok) definitions.set(result.value.id, result.value)
}
export const avatarLabels: Record<typeof companionAvatars[number], string> = {
  cloud: 'Облачко', ghost: 'Привидение', cat: 'Кот', bunny: 'Заяц', egg: 'Кругляш', star: 'Звезда', brain: 'Мозг',
  book: 'Книга', rocket: 'Ракета', camera: 'Камера', magnifier: 'Лупа', palette: 'Палитра', 'paint-brush': 'Кисть',
  shield: 'Щит', bull: 'Бык', 'witch-hat': 'Шляпа', controller: 'Геймпад', barbell: 'Гантель', mug: 'Кружка',
  lightbulb: 'Лампочка', chat: 'Сообщение', sprout: 'Росток', 'watering-can': 'Лейка',
}
export const avatarColors = { violet: '#ad8bff', mint: '#83d9b9', peach: '#ffb590', sky: '#8bcaf3' }
export function companionAvatar(look: CompanionPreferences): AvatarDefinition {
  const legacy = { soft: 'cloud', round: 'egg', spark: 'star' }
  return definitions.get(look.avatar ?? legacy[look.shape]) ?? definitions.get('cloud')!
}
