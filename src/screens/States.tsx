import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { errorText } from '../lib/api'
import { INSTAGRAM } from '../lib/install'
import { haptic, openLink } from '../lib/tg'
import { useStore } from '../store'
import { Cta, Emoji, Spinner, Tap } from '../ui'

const BOT = 'elazart_bot'

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <p className="font-display font-bold leading-none tracking-tight" style={{ fontSize: size }}>
      Elaz{' '}
      <span className="inline-block rounded-[0.3em] px-[0.22em] py-[0.08em] text-white" style={{ background: 'var(--aurora)' }}>
        Ed
      </span>
    </p>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="relative z-10 flex h-full flex-col items-center justify-center px-7 text-center"
      style={{ paddingTop: 'var(--top)', paddingBottom: 'calc(24px + var(--bottom))' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  )
}

const primary = 'cta cta-aurora w-full'
const secondary = 'flex h-[52px] w-full items-center justify-center gap-2 rounded-[20px] border border-line bg-card/80 text-[14.5px] font-semibold'

export function Splash() {
  return (
    <Frame>
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
        <Logo size={44} />
      </motion.div>
      <div className="mt-8 h-1 w-28 overflow-hidden rounded-full bg-veil/10">
        <motion.div className="h-full w-1/2 rounded-full" style={{ background: 'var(--aurora)' }} animate={{ x: ['-100%', '200%'] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }} />
      </div>
    </Frame>
  )
}

/** Подпись автора со ссылкой на его Instagram. */
function Author() {
  return (
    <button type="button" onClick={() => openLink(INSTAGRAM.url)} className="mt-6 text-[13px] text-mute underline underline-offset-4">
      Автор в Instagram: {INSTAGRAM.handle}
    </button>
  )
}

const PERKS: [string, string][] = [
  ['⚡', 'XP и уровни за каждый урок'],
  ['🔥', 'Стрик и бонус каждый день'],
  ['🏆', 'Рейтинг подписчиков'],
]

/** Ворота: приложение открыто только подписчикам канала. */
export function Gate() {
  const meta = useStore((s) => s.meta)
  const { boot, toast } = useStore.getState()
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)

  const check = async (silent = false) => {
    if (busy) return
    setBusy(true)
    const status = await boot(true)
    setBusy(false)
    if (status === 'locked' && !silent) {
      haptic.error()
      setShake((s) => s + 1)
      toast('Подписку пока не вижу. Заявку могли ещё не одобрить')
    }
  }

  // Вернулся из канала в приложение — проверяем сами, без кнопки.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void check(true)
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Frame>
      <motion.div key={shake} animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : {}} transition={{ duration: 0.4 }} className="relative">
        <div className="absolute inset-0 scale-[1.9] rounded-full" style={{ background: 'radial-gradient(circle, rgb(165 139 255 / 0.4), transparent 62%)' }} />
        <div className="floaty relative">
          <Emoji char="🔐" size={120} animated />
        </div>
      </motion.div>

      <div className="mt-7">
        <Logo size={22} />
      </div>
      <h1 className="mt-4 font-display text-[26px] font-semibold leading-[1.15]">Открыто для&nbsp;подписчиков</h1>
      <p className="mt-3 max-w-[300px] text-[15.5px] leading-snug text-mute">Уроки, туториалы и разборы доступны тем, кто подписан на канал{meta.channel.title ? ` «${meta.channel.title}»` : ''}.</p>

      <div className="mt-6 w-full max-w-[320px] space-y-2">
        {PERKS.map(([emoji, text], i) => (
          <motion.div key={text} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="flex items-center gap-3 rounded-[18px] border border-line bg-card/70 px-4 py-3 text-left">
            <Emoji char={emoji} size={24} />
            <span className="text-[14.5px] font-medium">{text}</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-7 w-full max-w-[320px] space-y-2.5">
        <Cta className="w-full" onClick={() => meta.channel.invite && openLink(meta.channel.invite)}>
          Подписаться на канал
        </Cta>
        <Tap onClick={() => check()} disabled={busy} className={secondary}>
          {busy ? <Spinner size={18} /> : 'Я подписался'}
        </Tap>
      </div>
      <Author />
    </Frame>
  )
}

/** Канал ещё не привязан: бот не добавлен администратором. */
export function Setup() {
  const meta = useStore((s) => s.meta)
  const boot = useStore((s) => s.boot)
  const [busy, setBusy] = useState(false)
  return (
    <Frame>
      <Emoji char="🛠️" size={96} animated />
      <h1 className="mt-6 font-display text-[23px] font-semibold leading-tight">Остался один шаг</h1>
      <p className="mt-3 max-w-[310px] text-[15.5px] leading-snug text-mute">
        Добавь бота{meta.bot.username ? ` @${meta.bot.username}` : ''} администратором в канал. Приложение подхватит канал само и начнёт проверять подписку.
      </p>
      <Tap
        onClick={async () => {
          setBusy(true)
          await boot(true)
          setBusy(false)
        }}
        disabled={busy}
        className={`${secondary} mt-7 max-w-[320px]`}
      >
        {busy ? <Spinner size={18} /> : 'Проверить ещё раз'}
      </Tap>
    </Frame>
  )
}

/** Открыли ссылку в обычном браузере. */
export function Outside() {
  return (
    <Frame>
      <Logo size={40} />
      <p className="mt-5 max-w-[300px] text-[16px] leading-snug text-mute">Уроки, туториалы и новости с XP, стриком и рейтингом. Работает внутри Telegram.</p>
      <div className="mt-8 w-full max-w-[320px] space-y-2.5">
        <a href={`https://t.me/${BOT}`} className={primary}>
          Открыть в Telegram
        </a>
        <a href="?demo" className={secondary}>
          Посмотреть демо
        </a>
      </div>
      <Author />
    </Frame>
  )
}

export function ErrorScreen() {
  const code = useStore((s) => s.errorCode)
  const boot = useStore((s) => s.boot)
  const setPhase = useStore((s) => s.setPhase)
  const notReady = code === 'no_token'
  return (
    <Frame>
      <Emoji char={notReady ? '🛠️' : '🫠'} size={92} animated />
      <h1 className="mt-6 font-display text-[23px] font-semibold leading-tight">{notReady ? 'Бот ещё настраивается' : 'Не загрузилось'}</h1>
      <p className="mt-3 max-w-[300px] text-[15.5px] leading-snug text-mute">{notReady ? 'Приложение почти готово. Загляни чуть позже.' : errorText(code ?? '')}</p>
      <Tap
        onClick={() => {
          setPhase('loading')
          void boot()
        }}
        className={`${secondary} mt-7 max-w-[320px]`}
      >
        Попробовать ещё раз
      </Tap>
    </Frame>
  )
}
