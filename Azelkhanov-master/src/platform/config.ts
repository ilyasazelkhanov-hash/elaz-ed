import type { AppConfig, BrandConfig, ModuleDefinition, ModuleId, PresetId } from './contracts.ts'

export const modules: ModuleDefinition[] = [
  {
    id: 'content',
    title: 'Журнал',
    description: 'Статьи, истории и полезные находки',
    icon: 'BookOpen',
    dependencies: [],
    entities: ['article', 'story', 'video', 'file'],
    roles: ['editor'],
  },
  {
    id: 'progress',
    title: 'Мой прогресс',
    description: 'Уровни, достижения и новые цели',
    icon: 'Sparkles',
    dependencies: [],
    entities: [],
    roles: [],
  },
  {
    id: 'learning',
    title: 'Академия',
    description: 'Знания, которые меняют привычки',
    icon: 'GraduationCap',
    dependencies: ['content', 'progress'],
    entities: ['course', 'lesson'],
    roles: ['mentor', 'editor'],
  },
  {
    id: 'campaigns',
    title: 'Активности',
    description: 'Каждый день что-то интересное',
    icon: 'Gamepad2',
    dependencies: ['progress'],
    entities: ['campaign', 'mission'],
    roles: ['campaign_manager'],
  },
  {
    id: 'loyalty',
    title: 'Привилегии',
    description: 'Маленькие радости за ваши действия',
    icon: 'Gift',
    dependencies: ['progress'],
    entities: ['reward'],
    roles: ['cashier', 'campaign_manager'],
  },
  {
    id: 'commerce',
    title: 'Коллекция',
    description: 'Вещи и услуги с характером',
    icon: 'ShoppingBag',
    dependencies: [],
    entities: ['product', 'service'],
    roles: ['editor', 'cashier'],
  },
  {
    id: 'events',
    title: 'Встречи',
    description: 'Ближе к людям и новым впечатлениям',
    icon: 'CalendarDays',
    dependencies: [],
    entities: ['event', 'slot'],
    roles: ['campaign_manager', 'cashier'],
  },
  {
    id: 'community',
    title: 'Сообщество',
    description: 'Люди, с которыми вы на одной волне',
    icon: 'MessagesSquare',
    dependencies: [],
    entities: [],
    roles: ['moderator'],
  },
  {
    id: 'team',
    title: 'Команда',
    description: 'Общие идеи. Большие результаты.',
    icon: 'Users',
    dependencies: ['community', 'learning'],
    entities: ['team', 'poll', 'program'],
    roles: ['admin'],
  },
  {
    id: 'retention',
    title: 'Уведомления',
    description: 'Важное приходит вовремя',
    icon: 'Bell',
    dependencies: [],
    entities: [],
    roles: ['campaign_manager'],
  },
  {
    id: 'analytics',
    title: 'Аналитика',
    description: 'Понятные результаты каждого действия',
    icon: 'ChartNoAxesCombined',
    dependencies: [],
    entities: [],
    roles: ['analyst'],
  },
]
export const defaultBrand: BrandConfig = {
  id: 'azelkhanov',
  name: 'Azelkhanov',
  tagline: 'Больше, чем просто быть вместе.',
  logo: '/brand/Azelkhanov-full-logo-transparent.png',
  monogram: '/brand/Azelkhanov-monogram-AZ-transparent.png',
  wordmark: '/brand/Azelkhanov-wordmark-transparent.png',
  colors: {
    primary: '#6A4DF0',
    ink: '#16122B',
    background: '#EFECF8',
    accent: '#DC3D96',
    surface: '#FFFFFF',
    muted: '#5D5878',
    peach: '#FFB58A',
    lilac: '#B9A8FF',
    onPrimary: '#FFFFFF',
    onAccent: '#FFFFFF',
    card: '#211536',
    heroHighlight: '#FFD9EE',
    gradientFrom: '#7C6BFF',
    gradientVia: '#B26BFF',
    gradientTo: '#FF85C0',
  },
  fonts: {
    body: 'Onest Variable',
    display: 'Unbounded Variable',
  },
  dark: {
    background: '#0B0A12',
    surface: '#15141F',
    ink: '#F3F1FF',
    muted: '#A39FBF',
    primary: '#A58BFF',
    accent: '#FF8AC9',
    onPrimary: '#14101F',
    onAccent: '#2A1020',
  },
  defaultTheme: 'dark',
  radius: 24,
  motion: 'full',
}
const all = modules.map((m) => m.id)
const base: AppConfig = {
  id: 'azelkhanov',
  name: 'Azelkhanov',
  preset: 'club',
  modules: all,
  navigation: ['home', 'campaigns', 'loyalty', 'community', 'profile'],
  homeBlocks: ['wallet', 'stories', 'hero', 'missions', 'events', 'content'],
  locale: 'ru',
  timezone: 'Asia/Qyzylorda',
  currency: 'KZT',
  access: 'telegram',
  version: '1.0.0',
}
export const presets: Record<PresetId, AppConfig> = {
  club: { ...base },
  team: {
    ...base,
    preset: 'team',
    navigation: ['home', 'team', 'campaigns', 'community', 'profile'],
    homeBlocks: ['stories', 'hero', 'missions', 'team', 'events', 'content'],
    access: 'employee',
  },
  academy: {
    ...base,
    preset: 'academy',
    navigation: ['home', 'learning', 'campaigns', 'community', 'profile'],
    homeBlocks: ['stories', 'hero', 'learning', 'missions', 'content'],
  },
  services: {
    ...base,
    preset: 'services',
    navigation: ['home', 'commerce', 'events', 'community', 'profile'],
    homeBlocks: ['hero', 'commerce', 'events', 'content'],
  },
}
export function resolveModules(ids: string[]): ModuleId[] {
  const result = new Set<ModuleId>()
  const visit = (id: string) => {
    const definition = modules.find((m) => m.id === id)
    if (!definition) throw new Error(`Unknown module: ${id}`)
    if (result.has(definition.id)) return
    result.add(definition.id)
    definition.dependencies.forEach(visit)
  }
  ids.forEach(visit)
  return [...result]
}
export function validateConfig(config: AppConfig, brand: BrandConfig) {
  resolveModules(config.modules)
  if (!presets[config.preset]) throw new Error('Unknown preset')
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(config.id)) throw new Error('Invalid app id')
  if (
    config.navigation.length > 5 ||
    !config.navigation.length ||
    new Set(config.navigation).size !== config.navigation.length ||
    config.navigation.some((id) => !['home', 'profile', ...config.modules].includes(id))
  )
    throw new Error('Invalid navigation')
  if (!brand.name.trim() || !brand.monogram || brand.radius < 0 || brand.radius > 48) throw new Error('Invalid brand')
  if (
    ['primary', 'ink', 'background', 'accent', 'surface', 'muted'].some(
      (key) => !/^#[a-f0-9]{6}$/i.test(String(brand.colors[key as keyof typeof brand.colors])),
    ) ||
    Object.values(brand.colors).some((value) => !/^#[a-f0-9]{6}$/i.test(value))
  )
    throw new Error('Invalid brand color')
  new Intl.DateTimeFormat(config.locale, { timeZone: config.timezone }).format()
  if (
    config.progression &&
    (!Number.isInteger(config.progression.xpPerLevel) ||
      config.progression.xpPerLevel < 1 ||
      !config.progression.levels.length ||
      !Number.isInteger(config.progression.stampsPerReward) ||
      config.progression.stampsPerReward < 1)
  )
    throw new Error('Invalid progression display')
  if (brand.dark && Object.values(brand.dark).some((value) => !/^#[a-f0-9]{6}$/i.test(value)))
    throw new Error('Invalid dark theme')
  if (brand.defaultTheme && !['light', 'dark'].includes(brand.defaultTheme)) throw new Error('Invalid default theme')
  if (
    config.progression?.weeklyGoal &&
    (!Number.isInteger(config.progression.weeklyGoal.target) ||
      config.progression.weeklyGoal.target < 1 ||
      !config.progression.weeklyGoal.title.trim())
  )
    throw new Error('Invalid weekly goal')
  return { config: { ...config, modules: resolveModules(config.modules) }, brand }
}
