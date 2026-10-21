/** Public v1 contracts. Never put credentials or production answer keys here. */
export type ModuleId =
  | 'content'
  | 'learning'
  | 'campaigns'
  | 'progress'
  | 'loyalty'
  | 'commerce'
  | 'events'
  | 'community'
  | 'team'
  | 'retention'
  | 'analytics'
export type Role =
  'owner' | 'admin' | 'editor' | 'campaign_manager' | 'moderator' | 'mentor' | 'analyst' | 'cashier' | 'member'
export type PresetId = 'club' | 'team' | 'academy' | 'services'
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
export type Data = Record<string, Json>
export interface BrandConfig {
  id: string
  name: string
  tagline: string
  logo: string
  monogram: string
  wordmark: string
  colors: {
    primary: string
    ink: string
    background: string
    accent: string
    surface: string
    muted: string
    peach?: string
    lilac?: string
    onPrimary?: string
    onAccent?: string
    card?: string
    heroHighlight?: string
    /** Фирменный градиент (аврора): главная кнопка, активная вкладка, обложки. Без него строится из primary и accent. */
    gradientFrom?: string
    gradientVia?: string
    gradientTo?: string
  }
  /** Тёмная тема. primary/accent/onPrimary/onAccent нужны, когда светлые оттенки бренда не читаются на тёмном фоне. */
  dark?: {
    background: string
    ink: string
    surface: string
    muted: string
    primary?: string
    accent?: string
    onPrimary?: string
    onAccent?: string
  }
  shadow?: string
  defaultTheme?: 'light' | 'dark'
  illustration?: 'sculpture' | 'flat'
  fonts: { body: string; display: string }
  radius: number
  motion: 'full' | 'reduced'
}
export interface AppConfig {
  id: string
  name: string
  preset: PresetId
  modules: ModuleId[]
  navigation: string[]
  homeBlocks: string[]
  locale: string
  timezone: string
  currency: string
  access: 'telegram' | 'channel' | 'invite' | 'employee'
  version: string
  botUsername?: string
  apiPublicPath?: string
  progression?: {
    xpPerLevel: number
    levels: string[]
    stampsPerReward: number
    weeklyGoal?: { title: string; target: number }
  }
}
export interface ModuleDefinition {
  id: ModuleId
  title: string
  description: string
  icon: string
  dependencies: ModuleId[]
  entities: EntityKind[]
  roles: Role[]
}
export type EntityKind =
  | 'article'
  | 'story'
  | 'video'
  | 'file'
  | 'course'
  | 'lesson'
  | 'campaign'
  | 'mission'
  | 'reward'
  | 'product'
  | 'service'
  | 'event'
  | 'slot'
  | 'team'
  | 'poll'
  | 'program'
export interface Entity {
  id: string
  kind: EntityKind
  module: ModuleId
  title: string
  subtitle: string
  body: string
  tag: string
  cover: string
  published: boolean
  publishAt: string | null
  audience: 'all' | 'employees' | 'members'
  teamId?: string | null
  price: number
  capacity: number | null
  data: Data
}
export interface Member {
  baseXp?: number
  platformXp?: number
  id: string
  name: string
  username: string
  role: Role
  teamId: string | null
  approved: boolean
  xp: number
  points: number
  streak: number
  freezes: number
  lastDaily: string | null
  stamps: number
  notificationOptIn: boolean
  quietFrom: number
  quietTo: number
  timezone: string
  achievements: string[]
}
export interface Progress {
  entityId: string
  userId: string
  campaignId: string | null
  score: number
  completedAt: string
}
export interface LedgerEntry {
  id: string
  userId: string
  delta: number
  reason: string
  ref: string
  createdAt: string
}
export interface Coupon {
  id: string
  userId: string
  rewardId: string
  title: string
  code: string
  status: 'issued' | 'redeemed' | 'expired'
  expiresAt: string
  pointId: string | null
  campaignId: string | null
}
export interface Booking {
  id: string
  entityId: string
  userId: string
  status: 'confirmed' | 'waitlist' | 'cancelled' | 'checked_in'
  code: string
  createdAt: string
}
export interface Order {
  requestId?: string
  id: string
  userId: string
  items: { entityId: string; quantity: number; variant: string; price: number }[]
  total: number
  status: 'new' | 'accepted' | 'ready' | 'completed' | 'cancelled'
  note: string
  createdAt: string
}
export interface Post {
  audience?: 'all' | 'employees'
  teamId?: string | null
  id: string
  userId: string
  name: string
  body: string
  topic: string
  status: 'published' | 'pending' | 'hidden'
  likes: string[]
  createdAt: string
}
export interface Comment {
  id: string
  postId: string
  userId: string
  name: string
  body: string
  createdAt: string
}
export interface Homework {
  id: string
  userId: string
  lessonId: string
  body: string
  file: string
  status: 'submitted' | 'revision' | 'approved'
  feedback: string
  createdAt: string
}
export interface Notice {
  id: string
  userId: string
  title: string
  body: string
  read: boolean
  createdAt: string
}
export interface AuditEntry {
  id: string
  actorId: string
  action: string
  targetId: string
  createdAt: string
}
export interface Gift { id: string; senderId: string; recipientId: string | null; rewardId: string; title: string; status: 'sent' | 'claimed' | 'cancelled'; expiresAt: string; createdAt: string }
export interface PassportStamp { entityId: string; title: string; earnedAt: string }
export interface ProjectMilestone { id: string; title: string; status: 'pending' | 'review' | 'approved'; body: string; media: string[]; documents: {title: string; url: string}[] }
export interface ClientProject { id: string; userId: string; managerId: string; title: string; status: string; milestones: ProjectMilestone[]; updatedAt: string }
export interface Membership { entityId: string; expiresAt: string; status: 'active' | 'expired' }
export interface Snapshot {
  preferences?: {sizes: {top?: string; bottom?: string; shoe?: string}; style?: string} | null
  gifts?: Gift[]
  passport?: PassportStamp[]
  projects?: ClientProject[]
  membership?: Membership[]
  journey?: { entityId: string; chosenAt: string } | null
  leaderboard?: { id: string; name: string; xp: number; teamId?: string | null }[]
  teamLeaderboard?: { id: string; name: string; xp: number }[]
  seasonLeaderboards?: Record<string, { id: string; name: string; xp: number }[]>
  me: Member
  entities: Entity[]
  progress: Progress[]
  ledger: LedgerEntry[]
  coupons: Coupon[]
  bookings: Booking[]
  orders: Order[]
  posts: Post[]
  comments: Comment[]
  homework: Homework[]
  notifications: Notice[]
  audit: AuditEntry[]
  members: Member[]
  config: AppConfig
  favorites: string[]
  reactions: string[]
  votes: Record<string, number>
  recognitions: { id: string; from: string; to: string; body: string }[]
  analytics?: {
    members: number
    approvedMembers: number
    active1d: number
    active7d: number
    completions: number
    orders: number
    bookings: number
    paidStars: number
    retention: {
      day1: { eligible: number; returned: number; rate: number | null }
      day7: { eligible: number; returned: number; rate: number | null }
    }
    funnel: { stage: string; count: number }[]
    campaigns: {
      id: string
      title: string
      participants: number
      completions: number
      pointsIssued: number
      couponsIssued: number
      couponsRedeemed: number
    }[]
  }
}
export interface QuizQuestion {
  question: string
  options: string[]
}
export interface QuizAttempt {
  id: string
  entityId: string
  questions: QuizQuestion[]
  index: number
  answers: number[]
}
export interface ActionReply {
  snapshot: Snapshot
  result?: Data
}
export interface PlatformApi {
  bootstrap(): Promise<Snapshot>
  dispatch(action: string, payload?: Data): Promise<ActionReply>
}
export const API_VERSION = '1' as const
