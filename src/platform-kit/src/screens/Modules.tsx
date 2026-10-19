import { useState } from 'react'
import { ArrowRight, ArrowUpRight, Bookmark, Check, Gift, Heart, Search, Sparkles, Users, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import { modules } from '../platform/config.ts'
import type { BrandConfig, Entity, ModuleId } from '../platform/contracts.ts'
import { usePlatform } from '../platform/store.ts'
import { Art, ArrowLink, Button, Empty, Meter, PageHeader, Pill, QR, SectionTitle } from '../components/ui.tsx'
import { EntityCard, MemberCard } from './Home.tsx'

export function ModulePage({ id }: { id: string }) {
  const s = usePlatform((v) => v.snapshot!),
    push = usePlatform((v) => v.push),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('Все')
  const definition = modules.find((m) => m.id === id)
  if (!definition) return <AllModules />
  if (!s.config.modules.includes(id as ModuleId))
    return <Empty title="Раздел выключен" body="Этот модуль не включён в конфигурацию проекта." />
  if (id === 'community') return <Community />
  if (id === 'team') return <Team />
  if (id === 'progress') return <Progress />
  if (id === 'retention') return <Notifications />
  if (id === 'analytics') return <Empty title="Аналитика" body="Статистика доступна в пульте управления." />
  const entities = s.entities
    .filter((e) => e.module === id && !['lesson', 'mission'].includes(e.kind))
    .filter((e) => e.published && (!e.publishAt || new Date(e.publishAt) <= new Date()))
    .filter((e) => filter === 'Все' || (filter === 'Избранное' ? s.favorites.includes(e.id) : e.kind === filter))
    .filter((e) => (e.title + ' ' + e.subtitle).toLowerCase().includes(query.toLowerCase()))
  return (
    <>
      <PageHeader title={definition.title} subtitle={definition.description} />
      <div className="az-page-body">
        <label className="az-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найдите своё вдохновение"
            aria-label="Поиск"
          />
        </label>
        {id === 'content' && (
          <div className="az-filter-row">
            <Pill active={filter === 'Все'} onClick={() => setFilter('Все')}>
              Всё
            </Pill>
            {[
              ['article', 'Статьи'],
              ['story', 'Истории'],
              ['video', 'Видео'],
              ['file', 'Материалы'],
              ['Избранное', 'Избранное'],
            ].map(([value, label]) => (
              <Pill key={value} active={filter === value} onClick={() => setFilter(value)}>
                {label}
              </Pill>
            ))}
          </div>
        )}
        {id === 'campaigns' && (
          <div className="az-note-strip">
            <Sparkles size={19} />
            <p>Выберите кампанию или начните с небольшого задания. У каждого действия — свой результат.</p>
          </div>
        )}
        <div className="az-card-grid">
          {entities.map((e) => (
            <EntityCard key={e.id} entity={e} />
          ))}
        </div>
        {entities.length === 0 && (
          <Empty title="Пока ничего не нашлось" body="Попробуйте другой запрос или вернитесь чуть позже." />
        )}
        {id === 'campaigns' && (
          <>
            <SectionTitle title="Ваши задания" />
            <div className="az-card-grid">
              {s.entities
                .filter((e) => e.kind === 'mission')
                .map((e) => (
                  <button
                    className="az-task-row"
                    key={e.id}
                    onClick={() => push({ type: e.data.game === 'quiz' ? 'quiz' : 'game', id: e.id })}
                  >
                    <Art kind={e.cover} />
                    <div>
                      <span className="az-eyebrow">{e.tag}</span>
                      <h3>{e.title}</h3>
                      <p>{e.subtitle}</p>
                      <span className="az-xp">
                        {s.progress.some((p) => p.entityId === e.id && p.userId === s.me.id)
                          ? 'Выполнено'
                          : 'XP за участие'}
                      </span>
                    </div>
                    <ArrowUpRight size={19} />
                  </button>
                ))}
            </div>
          </>
        )}
        {id === 'loyalty' && (
          <Button tone="dark" onClick={() => push({ type: 'wallet' })}>
            Мои подарки и купоны
            <Gift size={18} />
          </Button>
        )}
      </div>
    </>
  )
}
export function AllModules() {
  const s = usePlatform((v) => v.snapshot!),
    push = usePlatform((v) => v.push)
  return (
    <>
      <PageHeader title="Больше возможностей" subtitle="Ваше пространство. Ваши правила." />
      <div className="az-page-body">
        <div className="az-module-grid">
          {modules
            .filter((m) => s.config.modules.includes(m.id) && m.id !== 'analytics')
            .map((m, i) => (
              <motion.button
                whileHover={{ y: -4 }}
                className="az-module-card"
                key={m.id}
                onClick={() => push({ type: m.id })}
              >
                <span className={`az-module-symbol az-symbol-${i % 4}`}>{['✳', '↗', '✦', '◉', '✷'][i % 5]}</span>
                <h3>{m.title}</h3>
                <p>{m.description}</p>
                <ArrowUpRight size={20} />
              </motion.button>
            ))}
        </div>
      </div>
    </>
  )
}
export function Community() {
  const s = usePlatform((v) => v.snapshot!),
    { act, push } = usePlatform(),
    [body, setBody] = useState(''),
    [topic, setTopic] = useState('Общее'),
    [audience, setAudience] = useState('all'),
    [selected, setSelected] = useState('Все'),
    [comments, setComments] = useState<string | null>(null),
    [comment, setComment] = useState('')
  return (
    <>
      <PageHeader title="Свои люди" subtitle="Хорошие идеи любят компанию." />
      <div className="az-page-body">
        <div className="az-post-composer">
          <div className="az-composer-head">
            <span className="az-avatar">{s.me.name[0]}</span>
            <div>
              <strong>Что вас вдохновляет?</strong>
              <span>Поделитесь мыслью, вопросом или маленькой победой.</span>
            </div>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Здесь можно быть собой…"
            aria-label="Текст публикации"
          />
          <div>
            <select aria-label="Тема публикации" value={topic} onChange={(e) => setTopic(e.target.value)}>
              {['Общее', 'Знакомство', 'Идеи', 'Вопрос эксперту', 'Мои работы'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <Button
              disabled={body.trim().length < 3}
              onClick={async () => {
                if (
                  await act('post.create', {
                    body,
                    topic,
                    audience: audience === 'employees' ? 'employees' : 'all',
                    teamId: audience === 'team' ? s.me.teamId : null,
                  })
                ) {
                  setBody('')
                  usePlatform
                    .getState()
                    .message('Публикация сохранена. Если включена модерация, она появится после проверки.')
                }
              }}
            >
              Поделиться
              <ArrowUpRight size={16} />
            </Button>
          </div>
          <label>
            Кто увидит публикацию
            <select aria-label="Аудитория публикации" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="all">Все участники</option>
              {(s.me.approved || ['owner', 'admin'].includes(s.me.role)) && (
                <option value="employees">Сотрудники</option>
              )}
              {s.me.teamId && <option value="team">Только моя команда</option>}
            </select>
          </label>
        </div>
        <div className="az-filter-row">
          {['Все', 'Знакомство', 'Идеи', 'Вопрос эксперту', 'Мои работы'].map((v) => (
            <Pill key={v} active={selected === v} onClick={() => setSelected(v)}>
              {v}
            </Pill>
          ))}
        </div>
        <div className="az-posts">
          {s.posts
            .filter(
              (p) =>
                (p.status === 'published' || (p.status === 'pending' && p.userId === s.me.id)) &&
                (selected === 'Все' || p.topic === selected),
            )
            .map((p) => (
              <article key={p.id} className="az-post">
                <div className="az-post-head">
                  <span className="az-avatar az-avatar-lilac">{p.name[0]}</span>
                  <div>
                    <strong>{p.name}</strong>
                    <span>
                      {p.topic} ·{' '}
                      {p.status === 'pending'
                        ? 'На проверке'
                        : p.teamId
                          ? 'Для команды'
                          : p.audience === 'employees'
                            ? 'Для сотрудников'
                            : 'в кругу своих'}
                    </span>
                  </div>
                  <button
                    className="az-report"
                    aria-label="Пожаловаться на публикацию"
                    onClick={async () => {
                      if (await act('post.report', { postId: p.id }))
                        usePlatform.getState().message('Жалоба отправлена модератору')
                    }}
                  >
                    ···
                  </button>
                </div>
                <p>{p.body}</p>
                {p.status === 'published' && (
                  <div className="az-post-actions">
                    <button
                      className={p.likes.includes(s.me.id) ? 'is-liked' : ''}
                      onClick={() => void act('post.like', { postId: p.id })}
                    >
                      <Heart size={18} fill={p.likes.includes(s.me.id) ? 'currentColor' : 'none'} />
                      {p.likes.length}
                    </button>
                    <button onClick={() => setComments(comments === p.id ? null : p.id)}>
                      Комментарии · {s.comments.filter((c) => c.postId === p.id).length}
                    </button>
                  </div>
                )}
                {comments === p.id && (
                  <div className="az-comments">
                    {s.comments
                      .filter((c) => c.postId === p.id)
                      .map((c) => (
                        <p key={c.id}>
                          <strong>{c.name}</strong>
                          <br />
                          {c.body}
                        </p>
                      ))}
                    <form
                      className="az-comment-input"
                      onSubmit={async (event) => {
                        event.preventDefault()
                        const input = event.currentTarget.querySelector('input')
                        if (comment.trim() && (await act('comment.create', { postId: p.id, body: comment }))) {
                          setComment('')
                          input?.blur()
                        }
                      }}
                    >
                      <input
                        aria-label="Комментарий"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Продолжите разговор"
                      />
                      <button
                        type="submit"
                        aria-label="Отправить комментарий"
                        disabled={!comment.trim()}
                        onPointerDown={(event) => event.preventDefault()}
                      >
                        <ArrowUpRight size={20} />
                      </button>
                    </form>
                  </div>
                )}
              </article>
            ))}
        </div>
      </div>
    </>
  )
}
export function Team() {
  const s = usePlatform((v) => v.snapshot!),
    { act, push, message } = usePlatform(),
    [to, setTo] = useState(s.members.find((m) => m.id !== s.me.id)?.id ?? ''),
    [thanks, setThanks] = useState('')
  const people = s.members.slice().sort((a, b) => b.xp - a.xp)
  return (
    <>
      <PageHeader title="Команда — это мы" subtitle="Каждый вклад делает нас сильнее." />
      <div className="az-page-body">
        <div className="az-team-banner">
          <span className="az-eyebrow">ОБЩАЯ ЭНЕРГИЯ</span>
          <strong>
            {s.members.reduce((n, m) => n + m.xp, 0).toLocaleString('ru')} <small>XP</small>
          </strong>
          <p>Уже собрали вместе. Дальше — больше.</p>
          <Users size={90} />
        </div>
        <SectionTitle title="Первые шаги" />
        <div className="az-card-grid">
          {s.entities
            .filter((e) => e.kind === 'program')
            .map((e) => (
              <EntityCard key={e.id} entity={e} />
            ))}
        </div>
        <SectionTitle title="Голос команды" />
        {s.entities
          .filter((e) => e.kind === 'poll')
          .map((e) => (
            <div className="az-panel" key={e.id}>
              <span className="az-eyebrow">{e.tag}</span>
              <h3>{e.title}</h3>
              <p>{e.subtitle}</p>
              <div className="az-poll-options">
                {(e.data.options as string[]).map((option, i) => (
                  <button
                    className={s.votes[e.id] === i ? 'is-selected' : ''}
                    key={option}
                    disabled={s.votes[e.id] !== undefined}
                    onClick={() => void act('poll.vote', { entityId: e.id, option: i })}
                  >
                    {option}
                    {s.votes[e.id] === i ? <Check size={18} /> : <span />}
                  </button>
                ))}
              </div>
              {s.votes[e.id] !== undefined && <p className="az-success">Ваш голос учтён. Спасибо!</p>}
            </div>
          ))}
        <SectionTitle title="Люди, с которыми растёшь" />
        <div className="az-ranking">
          {people.map((m, i) => (
            <div key={m.id}>
              <span className="az-rank-number">{String(i + 1).padStart(2, '0')}</span>
              <span className="az-avatar">{m.name[0]}</span>
              <strong>
                {m.name}
                <small>{m.teamId === 'team-explorers' ? 'Исследователи' : 'Создатели'}</small>
              </strong>
              <b>{m.xp} XP</b>
            </div>
          ))}
        </div>
        <SectionTitle title="Хорошие слова важны" />
        <div className="az-panel">
          <p>Поблагодарите коллегу за помощь, идею или просто поддержку.</p>
          <select aria-label="Кого поблагодарить" value={to} onChange={(e) => setTo(e.target.value)}>
            {s.members
              .filter((m) => m.id !== s.me.id)
              .map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
          <textarea
            aria-label="Благодарность"
            value={thanks}
            onChange={(e) => setThanks(e.target.value)}
            placeholder="Спасибо за…"
          />
          <Button
            disabled={!to || thanks.trim().length < 3}
            onClick={async () => {
              if (await act('recognition.send', { userId: to, body: thanks })) {
                setThanks('')
                message('Хорошие слова уже в команде ✦')
              }
            }}
          >
            Отправить благодарность
            <Heart size={17} />
          </Button>
        </div>
        <div className="az-thanks-list">
          {s.recognitions.map((r) => (
            <div key={r.id}>
              <span>✳</span>
              <p>
                <strong>
                  {r.from} → {r.to}
                </strong>
                {r.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
export function Progress() {
  const s = usePlatform((v) => v.snapshot!),
    step = s.config.progression?.xpPerLevel ?? 250,
    level = Math.floor(s.me.xp / step) + 1,
    titles = s.config.progression?.levels ?? ['Новая глава', 'Исследователь', 'Создатель', 'Вдохновитель', 'Легенда'],
    [season, setSeason] = useState('all'),
    [teams, setTeams] = useState(false)
  const ownProgress = s.progress.filter((p) => p.userId === s.me.id)
  const ranking = teams
    ? (s.teamLeaderboard ??
      s.entities
        .filter((e) => e.kind === 'team')
        .map((e) => ({
          id: e.id,
          name: e.title,
          xp: s.members.filter((m) => m.teamId === e.id).reduce((n, m) => n + m.xp, 0),
        })))
    : season === 'all'
      ? (s.leaderboard ?? s.members)
      : (s.seasonLeaderboards?.[season] ??
        s.members.map((m) => ({
          id: m.id,
          name: m.name,
          xp: s.progress.filter((p) => p.userId === m.id && p.campaignId === season).reduce((n, p) => n + p.score, 0),
        })))
  return (
    <>
      <PageHeader title="Каждый шаг — ваш" subtitle="Небольшие действия. Заметный прогресс." />
      <div className="az-page-body">
        <div className="az-progress-hero">
          <span className="az-eyebrow">ВАШ УРОВЕНЬ</span>
          <div>
            {String(level).padStart(2, '0')}
            <i>✳</i>
          </div>
          <h2>{titles[Math.min(level - 1, titles.length - 1)]}</h2>
          <Meter
            value={s.me.xp % step}
            max={step}
            label={`${s.me.xp} XP · до следующего уровня ${step - (s.me.xp % step)} XP`}
          />
        </div>
        <div className="az-stats-grid">
          <div>
            <span>🔥</span>
            <strong>{s.me.streak}</strong>
            <small>дней подряд</small>
          </div>
          <div>
            <span>✦</span>
            <strong>{ownProgress.length}</strong>
            <small>заданий позади</small>
          </div>
          <div>
            <span>❄</span>
            <strong>{s.me.freezes}</strong>
            <small>заморозка стрика</small>
          </div>
        </div>
        <SectionTitle title="Ваши маленькие победы" />
        <div className="az-panel">
          <h3>{s.config.progression?.weeklyGoal?.title ?? 'Семь хороших шагов за неделю'}</h3>
          <p>Каждое завершённое действие приближает к цели.</p>
          <Meter
            value={ownProgress.filter((p) => new Date(p.completedAt).getTime() > Date.now() - 7 * 86400000).length}
            max={s.config.progression?.weeklyGoal?.target ?? 7}
            label="Завершения за последние семь дней"
          />
        </div>
        <div className="az-achievements">
          {[
            ['first_step', 'Первый шаг', 'Начать — уже достижение.'],
            ['five_tasks', 'В потоке', 'Завершите пять заданий.'],
            ['week_streak', 'Своя традиция', 'Заглядывайте семь дней подряд.'],
            ['ambassador', 'Объединяющий', 'Пригласите друзей в клуб.'],
          ].map(([id, title, desc], i) => {
            const earned =
              s.me.achievements.includes(id) ||
              (id === 'five_tasks' && ownProgress.length >= 5) ||
              (id === 'week_streak' && s.me.streak >= 7)
            return (
              <div key={id} className={earned ? 'is-earned' : ''}>
                <span>{['✳', '✦', '✷', '◈'][i]}</span>
                <h3>{title}</h3>
                <p>{desc}</p>
                {earned && <Check size={16} />}
              </div>
            )
          })}
        </div>
        <SectionTitle title="Люди в движении" />
        <div className="az-filter-row">
          <Pill active={!teams} onClick={() => setTeams(false)}>
            Участники
          </Pill>
          <Pill active={teams} onClick={() => setTeams(true)}>
            Команды
          </Pill>
          {!teams && (
            <select aria-label="Сезон рейтинга" value={season} onChange={(e) => setSeason(e.target.value)}>
              <option value="all">За всё время</option>
              {s.entities
                .filter((e) => e.kind === 'campaign')
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
            </select>
          )}
        </div>
        <div className="az-ranking">
          {ranking
            .slice()
            .sort((a, b) => b.xp - a.xp)
            .map((m, i) => (
              <div key={m.id}>
                <span className="az-rank-number">{String(i + 1).padStart(2, '0')}</span>
                <span className="az-avatar">{m.name[0]}</span>
                <strong>{m.name}</strong>
                <b>{m.xp} XP</b>
              </div>
            ))}
        </div>
      </div>
    </>
  )
}
export function Wallet({ brand }: { brand: BrandConfig }) {
  const s = usePlatform((v) => v.snapshot!)
  const [open, setOpen] = useState<string | null>(null)
  return (
    <>
      <PageHeader title="Хорошее возвращается" subtitle="Ваши баллы, подарки и особенные моменты." />
      <div className="az-page-body">
        <MemberCard brand={brand} />
        <SectionTitle title="Ваша хорошая традиция" />
        <div className="az-stamp-card">
          <div>
            <h3>Хорошие встречи складываются.</h3>
            <p>Подтверждённые визиты: {s.me.stamps}. Отметку добавляет сотрудник клуба.</p>
          </div>
          <div className="az-stamps">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={i < s.me.stamps % 6 ? 'is-stamped' : ''}>
                {i === 5 ? <Gift size={24} /> : i < s.me.stamps % 6 ? '✳' : String(i + 1).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>
        <SectionTitle title="Подарки уже ждут" />
        {!s.coupons.filter((c) => c.userId === s.me.id).length ? (
          <Empty
            title="Здесь появится что-то хорошее"
            body="Обменяйте баллы на подарок — и ваш первый купон будет здесь."
            icon={Gift}
          />
        ) : (
          s.coupons
            .filter((c) => c.userId === s.me.id)
            .map((c) => (
              <button
                className={`az-coupon ${c.status !== 'issued' ? 'is-used' : ''}`}
                key={c.id}
                onClick={() => setOpen(open === c.id ? null : c.id)}
              >
                <div>
                  <span className="az-eyebrow">{c.status === 'issued' ? 'ВАШ ПОДАРОК' : 'ИСПОЛЬЗОВАН'}</span>
                  <h3>{c.title}</h3>
                  <code>{c.code}</code>
                  <small>До {new Date(c.expiresAt).toLocaleDateString('ru')}</small>
                </div>
                <Gift size={32} />
                {open === c.id && (
                  <div className="az-qr">
                    <QR value={c.code} />
                    <p>Покажите код сотруднику на точке получения.</p>
                  </div>
                )}
              </button>
            ))
        )}
        <SectionTitle title="История хороших действий" />
        <div className="az-ledger">
          {s.ledger
            .filter((l) => l.userId === s.me.id)
            .map((l) => (
              <div key={l.id}>
                <span className={l.delta > 0 ? 'az-ledger-plus' : 'az-ledger-minus'}>{l.delta > 0 ? '+' : '−'}</span>
                <div>
                  <strong>{l.reason}</strong>
                  <small>{new Date(l.createdAt).toLocaleDateString('ru')}</small>
                </div>
                <b>
                  {l.delta > 0 ? '+' : ''}
                  {l.delta}
                </b>
              </div>
            ))}
        </div>
      </div>
    </>
  )
}
export function Notifications() {
  const s = usePlatform((v) => v.snapshot!),
    act = usePlatform((v) => v.act)
  return (
    <>
      <PageHeader title="Хорошие новости" subtitle="Важное для вас — в одном месте." />
      <div className="az-page-body">
        {s.notifications
          .filter((n) => n.userId === s.me.id)
          .map((n) => (
            <button
              className={`az-notice ${n.read ? '' : 'is-unread'}`}
              key={n.id}
              onClick={() => void act('notification.read', { noticeId: n.id })}
            >
              <span>✦</span>
              <div>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
                <small>{new Date(n.createdAt).toLocaleDateString('ru')}</small>
              </div>
              {!n.read && <i />}
            </button>
          ))}
        {!s.notifications.length && (
          <Empty title="Всё спокойно" body="Когда появится что-то важное, мы расскажем здесь." />
        )}
      </div>
    </>
  )
}
