import { AtSign, Award, BookOpen, Trophy, Compass, ChevronRight, FlaskConical, Lock, Megaphone, Moon, RotateCcw, Send, Settings2, Share2, Smartphone, Sun, SunMoon, Volume2, VolumeX } from 'lucide-react'
import { motion, useMotionTemplate, useTransform } from 'motion/react'
import { useState } from 'react'
import { isDemo } from '../lib/api'
import { appLink } from '../lib/links'
import { achievementCard, levelCard } from '../lib/shareCard'
import { track } from '../lib/track'
import { ACHIEVEMENTS, GRADIENTS, LEVELS, levelOf } from '../lib/game'
import { sfx } from '../lib/sfx'
import { addShortcut, INSTAGRAM } from '../lib/install'
import { haptic, inTelegram, openLink, shareLink } from '../lib/tg'
import { getMode, setMode, type ThemeMode } from '../lib/theme'
import { useTilt } from '../lib/tilt'
import type { Me } from '../lib/types'
import { useStore } from '../store'
import { Avatar, Counter, Emoji, Pattern, Sheet, Tap } from '../ui'


const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'auto', label: 'Авто', icon: SunMoon },
  { id: 'light', label: 'Светлая', icon: Sun },
  { id: 'dark', label: 'Тёмная', icon: Moon },
]

export function Profile() {
  const me = useStore((s) => s.me)!
  const meta = useStore((s) => s.meta)
  const push = useStore((s) => s.push)
  const toast = useStore((s) => s.toast)
  const [sound, setSound] = useState(sfx.enabled)
  const [theme, setTheme] = useState<ThemeMode>(getMode)
  const [open, setOpen] = useState<string | null>(null)
  const lvl = levelOf(me.xp)
  const picked = ACHIEVEMENTS.find((a) => a.code === open)
  const earned = ACHIEVEMENTS.filter((a) => me.achievements.includes(a.code)).length

  const invite = () => {
    const link = appLink()
    if (!link) return toast('Ссылка появится, когда бот будет настроен')
    shareLink(link, 'OG CRE8R²: уроки и разборы с XP, стриком и рейтингом. Заходи.')
  }

  return (
    <div data-tab-scroll className="scroll h-full" style={{ paddingTop: 'calc(var(--top) + 18px)', paddingBottom: 'calc(120px + var(--bottom))' }}>
      <div className="px-5">
        <HoloCard me={me} />
      </div>

      <Tap className="mx-5 mt-4 flex w-[calc(100%-40px)] items-center justify-between rounded-2xl border border-line bg-card p-4 text-left" onClick={()=>push({type:'learning',path:'/courses/my-learning'})}><span><b className="block text-sm">Моё обучение</b><span className="mt-1 block text-xs text-mute">Курсы, работы и результаты</span></span><ChevronRight size={18}/></Tap>
      <div className="mx-5 mt-4 grid grid-cols-2 gap-3" aria-label="Дополнительные разделы">
       {[{label:'Рейтинг',icon:Trophy,open:()=>useStore.getState().setTab('top')},{label:'Мой маршрут',icon:Compass,open:()=>push({type:'journey'})},{label:'ИИ-сертификации',icon:Award,open:()=>push({type:'certifications'})},{label:'Демо Академии',icon:BookOpen,open:()=>push({type:'academy',path:'/academy'})}].map(item=><Tap key={item.label} onClick={item.open} className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left text-sm font-semibold"><item.icon size={20} className="shrink-0 text-violet"/>{item.label}</Tap>)}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 px-5">
        <Stat emoji="⚡" value={me.xp} label="XP" />
        <Stat emoji="🔥" value={me.streak} label="стрик" />
        <Stat emoji="👥" value={me.invited} label="приглашено" />
        <Stat emoji="🏆" value={me.rank} label="место" />
      </div>

      <div className="mx-5 mt-4 grid grid-cols-2 gap-2">
        <Tap onClick={() => push({type:'club'})} className="rounded-[22px] border border-line bg-card/80 p-4 text-left"><p className="font-display text-[14px]">Клуб OG ↗</p><p className="mt-2 text-[12px] text-mute">Доступ и подписка</p></Tap>
        <Tap onClick={() => push({type:'services'})} className="rounded-[22px] border border-line bg-card/80 p-4 text-left"><p className="font-display text-[14px]">Для бизнеса ↗</p><p className="mt-2 text-[12px] text-mute">Примеры мини-аппок</p></Tap>
      </div>

      {(isDemo || import.meta.env.VITE_PLATFORM_ENABLED === 'true') && <Tap onClick={() => { const url = new URL(location.href); url.searchParams.set('platform', ''); location.href = url.href }} className="mx-5 mt-6 flex w-[calc(100%-40px)] items-center gap-3 rounded-[24px] border border-line bg-card2 p-5 text-left">
        <FlaskConical size={24} className="text-violet" />
        <div className="min-w-0 flex-1"><p className="font-display text-[15px] font-semibold">Клубное пространство</p><p className="mt-1 text-[13px] text-mute">Материалы, встречи и твой профиль</p></div><ChevronRight size={18}/>
      </Tap>}

      <h2 className="mb-3 mt-7 px-5 font-display text-[15px] font-semibold">Путь</h2>
      <div className="no-bar flex overflow-x-auto px-5 pb-1">
        {LEVELS.map((l, i) => {
          const reached = me.xp >= l.xp
          const current = i + 1 === lvl.index
          return (
            <div key={l.title} className="flex shrink-0 items-start">
              <div className="flex w-[78px] flex-col items-center">
                <div className={`grid h-[54px] w-[54px] place-items-center rounded-full border ${current ? 'border-transparent' : reached ? 'border-veil/15 bg-card2' : 'border-line bg-card/60'}`} style={current ? { background: 'var(--aurora)' } : undefined}>
                  {reached ? <Emoji char={l.emoji} size={28} animated={current} /> : <Lock size={17} className="text-faint" />}
                </div>
                <p className={`mt-2 text-center text-[11.5px] font-semibold leading-tight ${reached ? 'text-ink' : 'text-faint'}`}>{l.title}</p>
                <p className="text-[10.5px] text-faint">{l.xp} XP</p>
              </div>
              {i < LEVELS.length - 1 && <div className="mt-[26px] h-[2px] w-5 rounded-full" style={{ background: me.xp >= LEVELS[i + 1].xp ? 'var(--aurora)' : 'var(--track)' }} />}
            </div>
          )
        })}
      </div>

      <div className="mb-3 mt-7 flex items-center gap-2 px-5">
        <h2 className="font-display text-[15px] font-semibold">Ачивки</h2>
        <span className="rounded-full bg-veil/8 px-2 py-0.5 text-[11.5px] font-semibold text-mute">
          {earned}/{ACHIEVEMENTS.length}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 px-5">
        {ACHIEVEMENTS.map((a, i) => {
          const has = me.achievements.includes(a.code)
          return (
            <Tap
              key={a.code}
              feedback="soft"
              onClick={() => setOpen(a.code)}
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`relative flex flex-col items-center rounded-[22px] border px-2 pb-3 pt-4 ${has ? 'border-veil/12 bg-card2' : 'border-line bg-card/50'}`}
            >
              {has && <div className="absolute inset-x-6 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--color-violet), transparent)' }} />}
              <Emoji char={a.emoji} size={38} className={has ? '' : 'opacity-25 grayscale'} />
              <p className={`mt-2 text-center text-[11.5px] font-semibold leading-tight ${has ? 'text-ink' : 'text-faint'}`}>{a.title}</p>
            </Tap>
          )
        })}
      </div>

      <Tap onClick={invite} className="relative mx-5 mt-7 flex w-[calc(100%-40px)] items-center gap-3 overflow-hidden rounded-[26px] p-4 pl-5 text-left" style={{ background: GRADIENTS.mint.css, color: GRADIENTS.mint.ink }}>
        <Pattern name="mint" />
        <div className="relative min-w-0 flex-1">
          <p className="font-display text-[16px] font-semibold leading-tight">Позови друга</p>
          <p className="mt-1 text-[13px] font-medium leading-snug opacity-80">+100 XP тебе и +50 ему, когда он подпишется на канал{me.invited > 0 ? `. Уже пришло: ${me.invited}` : ''}</p>
        </div>
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#06231c] text-white">
          <Send size={18} />
        </span>
      </Tap>

      <Tap onClick={() => push({ type: 'lab' })} className="mx-5 mt-3 flex w-[calc(100%-40px)] items-center gap-3.5 rounded-[24px] border border-line bg-card/80 p-4 text-left">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-violet/15 text-violet">
          <FlaskConical size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Лаборатория</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-mute">Что умеет мини-апп: гироскоп, сканер, биометрия, звёзды</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-faint" />
      </Tap>

      <div className="mx-5 mt-3 rounded-[24px] border border-line bg-card/80 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-medium">Тема</p>
          <p className="text-[12.5px] text-mute">{theme === 'auto' ? (inTelegram ? 'Как в Telegram' : 'Как на устройстве') : theme === 'light' ? 'Всегда светлая' : 'Всегда тёмная'}</p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-[16px] bg-veil/8 p-1">
          {THEMES.map(({ id, label, icon: Icon }) => (
            <Tap
              key={id}
              feedback="select"
              onClick={() => {
                setMode(id)
                track('theme', { mode: id })
                setTheme(id)
              }}
              className={`relative flex h-10 items-center justify-center gap-1.5 rounded-[12px] text-[13.5px] font-semibold ${theme === id ? 'text-white' : 'text-mute'}`}
            >
              {theme === id && <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-[12px]" style={{ background: 'var(--aurora)' }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <Icon size={16} className="relative" />
              <span className="relative">{label}</span>
            </Tap>
          ))}
        </div>
      </div>

      <div className="mx-5 mt-3 overflow-hidden rounded-[24px] border border-line bg-card/80">
        <Item
          icon={sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
          label="Звуки"
          right={<Toggle on={sound} />}
          onClick={() => {
            sfx.setEnabled(!sound)
            setSound(!sound)
          }}
        />
        <Item
          icon={<Smartphone size={19} />}
          label="Ярлык на экран"
          onClick={async () => {
            const result = await addShortcut()
            if (result === 'hint-telegram') toast('Ярлык ставится с телефона: открой приложение в мобильном Telegram')
            if (result === 'hint-browser') toast('Открой меню браузера и выбери «Установить» или «На экран Домой»')
          }}
        />
        <Item icon={<AtSign size={19} />} label={`Instagram ${INSTAGRAM.handle}`} onClick={() => openLink(INSTAGRAM.url)} />
        {meta.channel.invite && <Item icon={<Megaphone size={19} />} label={meta.channel.title ? `Канал «${meta.channel.title}»` : 'Канал'} onClick={() => openLink(meta.channel.invite!)} />}
        {me.is_admin && <Item icon={<Settings2 size={19} />} label="Админка" onClick={() => push({ type: 'admin' })} />}
        {isDemo && (
          <Item
            icon={<RotateCcw size={19} />}
            label="Сбросить демо"
            onClick={async () => {
              const { resetDemo } = await import('../lib/mock')
              resetDemo()
              location.reload()
            }}
          />
        )}
      </div>

      <p className="mt-6 text-center text-[12px] text-faint">
        OG CRE8R²{isDemo ? ' · демо-режим' : ''} · автор в Instagram {INSTAGRAM.handle}
      </p>

      <Sheet open={!!picked} onClose={() => setOpen(null)}>
        {picked && (
          <div className="text-center">
            <Emoji char={picked.emoji} size={92} animated={me.achievements.includes(picked.code)} className={`mx-auto ${me.achievements.includes(picked.code) ? '' : 'opacity-30 grayscale'}`} />
            <p className="mt-4 font-display text-[20px] font-semibold">{picked.title}</p>
            <p className="mt-1.5 text-[15px] text-mute">{picked.desc}</p>
            <p className={`mx-auto mt-4 w-fit rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${me.achievements.includes(picked.code) ? 'bg-mint/15 text-mint' : 'bg-veil/8 text-mute'}`}>
              {me.achievements.includes(picked.code) ? 'Получена' : 'Ещё не открыта'}
            </p>
            {me.achievements.includes(picked.code) && (
              <Tap
                onClick={() => {
                  setOpen(null)
                  useStore.setState({ share: achievementCard(picked) })
                }}
                className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-[18px] border border-line bg-card text-[14.5px] font-semibold"
              >
                <Share2 size={17} /> Поделиться
              </Tap>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}

// ---------- Голографическая карта участника ----------

function HoloCard({ me }: { me: Me }) {
  const tilt = useTilt(true)
  const lvl = levelOf(me.xp)
  const rotateY = useTransform(tilt.x, [-1, 1], [-15, 15])
  const rotateX = useTransform(tilt.y, [-1, 1], [13, -13])
  const foilX = useTransform(tilt.x, [-1, 1], [0, 100])
  const foilY = useTransform(tilt.y, [-1, 1], [0, 100])
  const glareX = useTransform(tilt.x, [-1, 1], [10, 90])
  const glareY = useTransform(tilt.y, [-1, 1], [5, 95])
  const foilPos = useMotionTemplate`${foilX}% ${foilY}%`
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgb(255 255 255 / 0.34), transparent 52%)`

  return (
    <div style={{ perspective: 1000 }} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave}>
      <motion.div
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d', background: 'linear-gradient(140deg, #241c4d 0%, #17142b 45%, #2b1638 100%)' }}
        className="relative aspect-[1.62] overflow-hidden rounded-[28px] border border-white/15 p-5 shadow-[0_28px_60px_-24px_rgb(140_110_255/0.7)]"
      >
        <motion.div
          className="absolute inset-0 opacity-45 mix-blend-color-dodge"
          style={{
            backgroundImage: 'repeating-linear-gradient(115deg, #ff7ac6 0%, #a58bff 10%, #7bebc0 20%, #86cfff 30%, #ffcf6b 40%, #ff7ac6 50%)',
            backgroundSize: '300% 300%',
            backgroundPosition: foilPos,
          }}
        />
        <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.9) 1px, transparent 1.4px)', backgroundSize: '13px 13px' }} />
        <motion.div className="absolute inset-0 mix-blend-overlay" style={{ background: glare }} />

        <div className="relative flex h-full flex-col text-white" style={{ transform: 'translateZ(28px)' }}>
          <div className="flex items-center justify-between">
            <p className="font-display text-[15px] font-bold tracking-tight">
              OG <span className="rounded-md bg-white px-1.5 py-0.5 text-[#1a1436]">CRE8R²</span>
            </p>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/60">member</p>
          </div>

          <div className="mt-auto flex items-center gap-3.5">
            <div className="rounded-full p-[2.5px]" style={{ background: 'var(--aurora)' }}>
              <Avatar name={me.name} photo={me.photo} id={me.id} size={54} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[19px] font-semibold leading-tight">{me.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-medium text-white/75">
                <Emoji char={lvl.emoji} size={15} /> {lvl.title} · уровень {lvl.index}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between">
            <p className="font-mono text-[11px] tracking-[0.18em] text-white/55">№ {String(me.id).slice(-6).padStart(6, '0')}</p>
            <p className="font-display text-[13px] font-semibold">
              <Counter value={me.xp} /> XP
            </p>
          </div>
        </div>
      </motion.div>
      <Tap onClick={() => useStore.setState({ share: levelCard(me) })} className="mt-3 flex h-[48px] w-full items-center justify-center gap-2 rounded-[18px] border border-line bg-card/80 text-[14px] font-semibold">
        <Share2 size={17} /> Поделиться в сторис
      </Tap>
    </div>
  )
}

function Stat({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-[20px] border border-line bg-card/80 py-3">
      <Emoji char={emoji} size={22} />
      <Counter value={value} className="mt-1.5 font-display text-[15px] font-semibold leading-none" />
      <p className="mt-1 text-[11px] text-mute">{label}</p>
    </div>
  )
}

function Item({ icon, label, right, onClick }: { icon: React.ReactNode; label: string; right?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic.tap()
        onClick()
      }}
      className="flex min-h-[54px] w-full items-center gap-3.5 border-b border-line px-4 text-left last:border-b-0 active:bg-veil/5"
    >
      <span className="text-mute">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{label}</span>
      {right ?? <ChevronRight size={18} className="text-faint" />}
    </button>
  )
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className="flex h-7 w-12 items-center rounded-full p-0.5 transition-colors" style={{ background: on ? '#8e7bff' : 'var(--track-strong)' }}>
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 34 }} className="h-6 w-6 rounded-full bg-white" style={{ marginLeft: on ? 20 : 0 }} />
    </span>
  )
}

