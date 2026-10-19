import { useEffect, useRef } from 'react'
import { telegram } from '../platform/client.ts'
import { motion } from 'motion/react'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Flame,
  Gift,
  Layers3,
  Users,
  Zap,
} from 'lucide-react'
import { usePlatform } from '../platform/store.ts'
import { Art, Button, Meter, Scene, SectionTitle } from '../components/ui.tsx'
import type { BrandConfig, Entity } from '../platform/contracts.ts'

export function EntityCard({ entity, small = false }: { entity: Entity; small?: boolean }) {
  const push = usePlatform((s) => s.push)
  return (
    <motion.button
      className={`az-entity-card ${small ? 'az-small-card' : ''}`}
      whileTap={{ scale: 0.98 }}
      onClick={(event) => {
        const art = event.currentTarget.querySelector('.az-art')
        if (art && entity.kind !== 'story')
          window.dispatchEvent(
            new CustomEvent('az:art-transition', { detail: { kind: entity.cover, rect: art.getBoundingClientRect() } }),
          )
        push({ type: entity.kind === 'story' ? 'story' : 'entity', id: entity.id })
      }}
    >
      <Art kind={entity.cover} />
      <div className="az-entity-card-copy">
        {entity.tag && <span className="az-eyebrow">{entity.tag}</span>}
        <h3>{entity.title}</h3>
        <p>{entity.subtitle}</p>
        <span className="az-card-arrow">
          <ArrowUpRight size={18} />
        </span>
      </div>
    </motion.button>
  )
}

export function MemberCard({ brand, compact = false }: { brand: BrandConfig; compact?: boolean }) {
  const cardRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (brand.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const element = cardRef.current
    const tilt = (x: number, y: number) => {
      if (element) {
        element.style.transform = 'perspective(800px) rotateX(' + y + 'deg) rotateY(' + x + 'deg)'
        element.style.setProperty('--foil-x', 50 + x * 5 + '%')
      }
    }
    const pointer = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const r = element!.getBoundingClientRect()
      tilt(((e.clientX - r.left) / r.width) * 12 - 6, 6 - ((e.clientY - r.top) / r.height) * 12)
    }
    const reset = () => tilt(0, 0)
    const sensor = telegram()?.DeviceOrientation
    let neutralBeta: number | undefined
    const orientation = () => {
      if (sensor) {
        const beta = sensor.beta ?? 0
        neutralBeta ??= beta
        tilt(Math.max(-7, Math.min(7, (sensor.gamma ?? 0) * 16)), Math.max(-7, Math.min(7, (beta-neutralBeta) * 16)))
      }
    }
    element?.addEventListener('pointermove', pointer)
    element?.addEventListener('pointerleave', reset)
    try {
      telegram()?.onEvent?.('deviceOrientationChanged', orientation)
      sensor?.start({ refresh_rate: 60, need_absolute: false })
    } catch {}
    return () => {
      element?.removeEventListener('pointermove', pointer)
      element?.removeEventListener('pointerleave', reset)
      try {
        telegram()?.offEvent?.('deviceOrientationChanged', orientation)
        sensor?.stop()
      } catch {}
      reset()
    }
  }, [brand.motion])
  const me = usePlatform((s) => s.snapshot!.me),
    push = usePlatform((s) => s.push)
  return (
    <motion.button
      ref={cardRef}
      className={`az-member-card ${compact ? 'az-member-compact' : ''}`}
      onClick={() => push({ type: 'wallet' })}
      whileTap={{ scale: 0.98 }}
    >
      <div className="az-member-top">
        <span>КАРТА УЧАСТНИКА</span>
        <ArrowUpRight size={19} />
      </div>
      <div className="az-member-middle">
        <Gift size={28} strokeWidth={1.5} />
        <div>
          <small>БОНУСНЫЙ БАЛАНС</small>
          <strong>
            {me.points.toLocaleString('ru')}
            <span> баллов</span>
          </strong>
        </div>
      </div>
      <div className="az-member-bottom">
        <span>
          {me.name}
          <small>№ {String(me.id.replace(/\D/g, '') || '1').padStart(6, '0')}</small>
        </span>
        <span className="az-member-brand">
          {brand.name}
          <i>CLUB</i>
        </span>
      </div>
    </motion.button>
  )
}

export default function Home({ brand }: { brand: BrandConfig }) {
  const { snapshot: s, push, act, celebrate } = usePlatform()
  if (!s) return null
  const team = s.config.preset === 'team',
    academy = s.config.preset === 'academy',
    services = s.config.preset === 'services'
  const has = (id: string) => s.config.modules.includes(id as never)
  const block = (id: string) => s.config.homeBlocks.includes(id)
  const order = (id: string) => ({ order: s.config.homeBlocks.indexOf(id) })
  const published = s.entities.filter((e) => e.published && (!e.publishAt || new Date(e.publishAt) <= new Date()))
  const stories = published.filter((e) => e.kind === 'story'),
    missions = published.filter((e) => e.kind === 'mission'),
    events = published.filter((e) => e.kind === 'event')
  const claimed =
    s.me.lastDaily === new Intl.DateTimeFormat('en-CA', { timeZone: s.config.timezone }).format(new Date())
  const xpStep = s.config.progression?.xpPerLevel ?? 300,
    level = Math.floor(s.me.xp / xpStep)
  const levelTitle =
    s.config.progression?.levels?.[Math.min(level, s.config.progression.levels.length - 1)] ??
    ['Участник', 'Исследователь', 'Свой человек', 'Амбассадор'][Math.min(level, 3)]
  const hero = team
    ? ['Ваша команда.', 'Общие идеи.']
    : academy
      ? ['От идеи', 'к навыку.']
      : services
        ? ['От запроса', 'к результату.']
        : ['Новый сезон.', 'Ваш ход.']
  const heroAction = () => {
    const campaign = published.find((e) => e.kind === 'campaign')
    push(
      services && has('commerce')
        ? { type: 'commerce' }
        : academy && has('learning')
          ? { type: 'learning' }
          : has('campaigns') && campaign
            ? { type: 'entity', id: campaign.id }
            : { type: 'all' },
    )
  }
  return (
    <div className="az-home" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="az-greeting" style={{ order: -3 }}>
        <button
          className="az-welcome-avatar"
          aria-label="Открыть мой профиль"
          onClick={() => push({ type: 'profile' })}
        >
          {s.me.name[0]}
        </button>
        <div>
          <span>Рады видеть,</span>
          <h1>{s.me.name.split(' ')[0]}</h1>
        </div>
        {has('progress') && (
          <button className="az-level-chip" onClick={() => push({ type: 'progress' })}>
            <Flame size={16} />
            {s.me.streak}
            <span className="az-chip-divider" />
            <Zap size={15} />
            {s.me.xp}
          </button>
        )}
      </div>
      {has('progress') && (
        <button className="az-home-progress" style={{ order: -2 }} onClick={() => push({ type: 'progress' })}>
          <div className="az-progress-orbit">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="28" />
              <circle
                cx="32"
                cy="32"
                r="28"
                pathLength="100"
                strokeDasharray={`${Math.max(3, ((s.me.xp % xpStep) / xpStep) * 100)} 100`}
              />
            </svg>
            <span>{level + 1}</span>
          </div>
          <div>
            <span className="az-eyebrow">Уровень {level + 1}</span>
            <h2>{levelTitle}</h2>
            <Meter value={s.me.xp % xpStep} max={xpStep} />
            <p>Ещё {xpStep - (s.me.xp % xpStep)} XP до следующего уровня</p>
          </div>
          <ChevronRight size={18} />
        </button>
      )}
      {block('wallet') && (has('progress') || has('loyalty')) && (
        <div className="az-home-duo" style={order('wallet')}>
          {has('progress') && (
            <motion.button
              className={`az-daily-card ${claimed ? 'is-claimed' : ''}`}
              aria-label={claimed ? 'Посмотреть мой стрик' : 'Забрать бонус дня'}
              whileTap={{ scale: 0.985 }}
              onClick={async () => {
                if (claimed) {
                  push({ type: 'progress' })
                  return
                }
                const result = await act('daily.claim')
                if (result) celebrate(`Бонус получен · +${result.gainedXp} XP и +${result.gainedPoints} баллов`)
              }}
            >
              <div>
                <span className="az-eyebrow">БОНУС ДНЯ</span>
                <h3>{claimed ? 'Бонус уже ваш' : 'Заглянули? Забирайте.'}</h3>
                <p>{claimed ? `Вы с нами ${s.me.streak} дн. подряд` : 'Ежедневный бонус за то, что вы здесь'}</p>
              </div>
              <span className="az-daily-gift">
                {claimed ? <Check size={30} /> : <Gift size={31} strokeWidth={1.7} />}
              </span>
            </motion.button>
          )}
          {has('loyalty') && (
            <button className="az-balance-strip" onClick={() => push({ type: 'wallet' })}>
              <Gift size={17} />
              <span>Ваши баллы</span>
              <strong>{s.me.points.toLocaleString('ru')}</strong>
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}
      {block('stories') && has('content') && stories.length > 0 && (
        <div className="az-stories" style={order('stories')}>
          {stories.map((story, i) => (
            <button key={story.id} onClick={() => push({ type: 'story', id: story.id })}>
              <div className={`az-story-ring ${i === 0 ? 'az-story-new' : ''}`}>
                <Art kind={story.cover} />
              </div>
              <span>{story.title === 'Место, где вы — свои' ? 'Знакомство' : story.title}</span>
            </button>
          ))}
        </div>
      )}
      {block('hero') && (
        <section className="az-focus-section" style={order('hero')}>
          <SectionTitle title={academy ? 'Начните здесь' : team ? 'В команде' : 'В фокусе'} />
          <motion.div className="az-hero" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="az-hero-copy">
              <span className="az-hero-label">
                {team ? 'КОМАНДА' : academy ? 'АКАДЕМИЯ' : services ? 'ВАШ ПРОЕКТ' : 'СЕЗОН 01'}
              </span>
              <h2>
                {hero[0]}
                <br />
                <em>{hero[1]}</em>
              </h2>
              <p>
                {team
                  ? 'Встречи, челленджи и идеи ваших коллег.'
                  : academy
                    ? 'Короткие уроки. Практика. Реальный результат.'
                    : services
                      ? 'Расскажите о задаче. Подберём решение.'
                      : '24 задания, встречи и бонусы. Начните с первого.'}
              </p>
              <Button tone="dark" onClick={heroAction}>
                {academy ? 'К урокам' : services ? 'Оставить заявку' : 'Открыть сезон'}
                <ArrowRight size={16} />
              </Button>
            </div>
            <Scene variant={academy ? 'gift' : 'orbit'} />
          </motion.div>
        </section>
      )}
      {block('missions') && has('campaigns') && (
        <section data-home-block="missions" style={order('missions')}>
          <SectionTitle title="Попробуйте сегодня" action="Все" onClick={() => push({ type: 'campaigns' })} />
          <div className="az-mission-row">
            {missions.slice(0, 3).map((m, i) => {
              const done = s.progress.some((p) => p.entityId === m.id && p.userId === s.me.id),
                Icon = i === 0 ? BookOpen : i === 1 ? Gift : Zap
              return (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  key={m.id}
                  className={`az-mission-preview az-mission-${i}`}
                  onClick={() => push({ type: m.data.game === 'quiz' ? 'quiz' : 'game', id: m.id })}
                >
                  <span className="az-mission-icon">
                    <Icon size={23} strokeWidth={1.7} />
                  </span>
                  <div>
                    <h3>{m.title}</h3>
                    <p>{done ? 'Выполнено' : '1 минута · XP за участие'}</p>
                  </div>
                  {done ? <Check size={18} /> : <ChevronRight size={18} />}
                </motion.button>
              )
            })}
          </div>
        </section>
      )}
      {block('learning') && has('learning') && (
        <section data-home-block="learning" style={order('learning')}>
          <SectionTitle
            title={team ? 'Для команды' : 'Курсы'}
            action="Все курсы"
            onClick={() => push({ type: 'learning' })}
          />
          <div className="az-card-grid">
            {published
              .filter((e) => e.kind === 'course')
              .map((e) => (
                <EntityCard key={e.id} entity={e} />
              ))}
          </div>
        </section>
      )}
      {block('events') && has('events') && events.length > 0 && (
        <section data-home-block="events" style={order('events')}>
          <SectionTitle title="Скоро встречаемся" action="Афиша" onClick={() => push({ type: 'events' })} />
          <button className="az-event-feature" onClick={() => push({ type: 'entity', id: events[0].id })}>
            <div className="az-event-date">
              <strong>
                {new Date(String(events[0].data.startsAt)).toLocaleDateString('ru', {
                  day: 'numeric',
                  timeZone: s.config.timezone,
                })}
              </strong>
              <span>
                {new Date(String(events[0].data.startsAt)).toLocaleDateString('ru', {
                  month: 'short',
                  timeZone: s.config.timezone,
                })}
              </span>
            </div>
            <div className="az-event-info">
              <h3>{events[0].title}</h3>
              <p>
                <CalendarDays size={13} />
                {String(events[0].data.location)}
              </p>
            </div>
            <ChevronRight size={19} />
          </button>
        </section>
      )}
      {block('content') && has('content') && (
        <section data-home-block="content" style={order('content')}>
          <SectionTitle title="Почитать" action="Журнал" onClick={() => push({ type: 'content' })} />
          <div className="az-card-grid">
            {published
              .filter((e) => e.kind === 'article')
              .slice(0, 2)
              .map((e) => (
                <EntityCard key={e.id} entity={e} />
              ))}
          </div>
        </section>
      )}
      {block('commerce') && has('commerce') && (
        <section data-home-block="commerce" style={order('commerce')}>
          <SectionTitle title="Каталог" action="Весь" onClick={() => push({ type: 'commerce' })} />
          <div className="az-card-grid">
            {published
              .filter((e) => ['product', 'service'].includes(e.kind))
              .slice(0, 2)
              .map((e) => (
                <EntityCard key={e.id} entity={e} />
              ))}
          </div>
        </section>
      )}
      {block('team') && has('team') && (
        <section data-home-block="team" style={order('team')}>
          <SectionTitle title="Ваша команда" />
          <button className="az-discover" onClick={() => push({ type: 'team' })}>
            <Users size={24} />
            <div>
              <h3>Люди и общие дела</h3>
              <p>Опросы, благодарности, первые шаги.</p>
            </div>
            <ChevronRight size={18} />
          </button>
        </section>
      )}
      <button className="az-discover" style={{ order: 1000 }} onClick={() => push({ type: 'all' })}>
        <Layers3 size={23} />
        <div>
          <h3>Все разделы</h3>
          <p>Всё, что есть в вашем приложении</p>
        </div>
        <ChevronRight size={18} />
      </button>
      <div className="az-exp-shortcuts" style={{ order: 1000 }} aria-label="Ваше пространство">
        {has('loyalty') && <button onClick={() => push({ type: 'gifts' })}>Подарить своим ↗</button>}
        {has('progress') && <button onClick={() => push({ type: 'passport' })}>Паспорт впечатлений</button>}
        {has('commerce') && <button onClick={() => push({ type: 'projects' })}>Кабинет клиента</button>}
        {new URLSearchParams(location.search).has('industry') && (
          <button
            onClick={() =>
              push({ type: 'industry', id: new URLSearchParams(location.search).get('industry') ?? 'coffee' })
            }
          >
            Мой сценарий ↗
          </button>
        )}
      </div>
      <footer className="az-home-footer" style={{ order: 1001 }}>
        <span>{brand.name}</span>
        <p>Ваше клубное приложение</p>
      </footer>
    </div>
  )
}
