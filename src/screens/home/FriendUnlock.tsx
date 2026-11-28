import {RefreshCw, Users} from 'lucide-react'
import {useState} from 'react'
import {WARMUP_ID} from '../../lib/discovery-events'
import {plural} from '../../lib/game'
import {appLink, freeStartLink} from '../../lib/links'
import {accessTiers, friendUnlock} from '../../lib/og-course-access'
import {shareLink} from '../../lib/tg'
import type {Course} from '../../lib/types'
import {useStore} from '../../store'
import {Tap} from '../../ui'

const friends = (n: number) => `${n} ${plural(n, ['друг', 'друга', 'друзей'])}`
const cameWord = (n: number) => n % 10 === 1 && n % 100 !== 11 ? 'придёт' : 'придут'

/** The invitation leads to the free warm-up, so a friend gets something useful before any offer. */
function invite(title: string) {
 const link = freeStartLink(WARMUP_ID) ?? appLink()
 if (!link) return useStore.getState().toast('Ссылка появится, когда бот будет настроен')
 shareLink(link, `Зову в OG CRE8R²: тут учат работать с ИИ на практике. Начни с бесплатной разминки на 2 минуты. Если зайдёшь по ссылке, у меня откроется курс «${title}».`)
}

/** Server-verified way to open a course without Stars. Hidden when the course has no such option. */
export function FriendUnlockCard({course}: {course: Course}) {
 const invited = useStore(state => state.me?.invited ?? 0)
 const [checking, setChecking] = useState(false)
 const unlock = friendUnlock(course, invited)
 if (!unlock) return null
 const check = async () => {
  if (checking) return
  setChecking(true)
  try {
   await useStore.getState().boot()
   const live = useStore.getState().courses.find(item => item.id === course.id)
   useStore.getState().toast(live?.access ? 'Курс открыт' : 'Пока не открыт. Друг засчитается, когда зайдёт по твоей ссылке')
  } finally { setChecking(false) }
 }
 return <div className="mt-3 rounded-2xl border border-line bg-bg/60 p-4" data-friend-unlock={unlock.ready ? 'ready' : 'open'}>
  <p className="flex items-center gap-2 text-sm font-semibold"><Users size={16} className="shrink-0 text-violet" aria-hidden="true"/>{course.price_stars > 0 ? 'Или открой бесплатно с друзьями' : 'Открой бесплатно с друзьями'}</p>
  <p className="mt-2 text-xs leading-relaxed text-mute">Курс откроется сам, когда по твоей ссылке {cameWord(unlock.need)} {friends(unlock.need)}. Засчитывается новый человек, который открыл приложение и подписан на канал.</p>
  <div className="mt-3 flex items-center gap-3"><progress aria-label="Друзья по твоей ссылке" max={unlock.need} value={unlock.have} className="friend-unlock-meter min-w-0 flex-1"/><span className="tabular shrink-0 text-xs font-semibold">{unlock.have} из {unlock.need}</span></div>
  {unlock.ready
   ? <Tap disabled={checking} onClick={() => void check()} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-violet/35 px-3 text-sm font-semibold text-violet disabled:opacity-60"><RefreshCw size={16} className={checking ? 'animate-spin' : ''} aria-hidden="true"/>{checking ? 'Проверяем…' : 'Друзья пришли. Открыть курс'}</Tap>
   : <Tap onClick={() => invite(course.title)} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-violet/35 bg-violet/8 px-3 text-sm font-semibold text-violet">Позвать друга · осталось {unlock.left}</Tap>}
 </div>
}

/** Catalog footer: the three ways materials open, built from what the server reports right now. */
export function AccessTiersNote({courses}: {courses: Course[]}) {
 const invited = useStore(state => state.me?.invited ?? 0)
 const tiers = accessTiers(courses, invited)
 return <section aria-label="Что бесплатно, а что нет" className="mt-5 rounded-2xl border border-line p-4" data-access-tiers>
  <h2 className="text-sm font-semibold">Что бесплатно, а что нет</h2>
  <dl className="mt-3 space-y-3 text-xs leading-relaxed">
   <div><dt className="font-semibold text-success">Бесплатно</dt><dd className="mt-0.5 text-mute">Пять разборов с тренировкой, разминка, атлас и новости{tiers.previews ? `. В курсах открыто пробных уроков: ${tiers.previews}` : ''}.</dd></div>
   {tiers.friends.length > 0 && <div><dt className="font-semibold text-violet">За друзей</dt><dd className="mt-0.5 text-mute">{tiers.friends.map(item => `«${item.title}»: ${friends(item.need)} по твоей ссылке, осталось ${item.left}`).join('. ')}. Друзей считает сервер.</dd></div>}
   {tiers.stars && <div><dt className="font-semibold">За звёзды Telegram</dt><dd className="mt-0.5 text-mute">Курсы покупаются по одному: {tiers.stars.from === tiers.stars.to ? `${tiers.stars.from} ⭐` : `от ${tiers.stars.from} до ${tiers.stars.to} ⭐`}. Доступ и прогресс остаются в аккаунте.</dd></div>}
  </dl>
  <p className="mt-3 text-xs leading-relaxed text-mute">Перед покупкой посмотри программу и пробный урок. Вопрос по оплате: команда /paysupport в чате с ботом.</p>
 </section>
}
