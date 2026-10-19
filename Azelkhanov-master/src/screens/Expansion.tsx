import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Gift, Check, ArrowUpRight, Sparkles } from 'lucide-react'
import { usePlatform } from '../platform/store.ts'
import { useBrand } from '../platform/brand-context.ts'
import type { ClientProject, Data } from '../platform/contracts.ts'
import { encodeGift, incomingGift } from '../platform/gift-links.ts'
import { Art, Button, Empty, PageHeader, SectionTitle } from '../components/ui.tsx'
import { demoMode } from '../platform/client.ts'

function ProjectMedia({ value, title = 'Материал проекта' }: { value: string; title?: string }) {
  const { act } = usePlatform()
  const [url, setUrl] = useState(value.startsWith('file:') ? '' : value)
  return value.startsWith('file:') ? (
    <div>
      {url ? (
        <img src={url} alt={title} />
      ) : (
        <Button
          tone="soft"
          onClick={async () => {
            const r = await act('file.download-url', { fileId: value.slice(5) })
            if (r) setUrl(String(r.url ?? r.signedURL ?? ''))
          }}
        >
          Открыть защищённое изображение
        </Button>
      )}
    </div>
  ) : (
    <img src={value} alt={title} loading="lazy" />
  )
}
function ProjectDocument({ value, title }: { value: string; title: string }) {
  const { act } = usePlatform()
  return value.startsWith('file:') ? (
    <Button
      tone="soft"
      onClick={async () => {
        const r = await act('file.download-url', { fileId: value.slice(5) })
        if (r?.url || r?.signedURL) window.open(String(r.url ?? r.signedURL), '_blank', 'noopener')
      }}
    >
      {title} ↗
    </Button>
  ) : (
    <a href={value} target="_blank" rel="noreferrer">
      {title} ↗
    </a>
  )
}
const date = (v: string) => new Date(v).toLocaleDateString('ru-RU')
export function Gifts() {
  const { snapshot: s, act, busy, message } = usePlatform()
  const reduced = useReducedMotion()
  const brand = useBrand()
  const [text, setText] = useState('Для тебя — маленькая радость.')
  const [link, setLink] = useState('')
  const [request, setRequest] = useState(crypto.randomUUID())
  const [selected, setSelected] = useState('')
  const [opened, setOpened] = useState(false)
  const token = incomingGift()
  if (!s) return null
  const claim = async () => {
    if (busy || opened || !token) return
    if (await act('gift.claim', {token})) {
      setOpened(true)
      message('Подарок принят')
    }
  }
  const send = async () => {
    const r = await act('gift.send', { entityId: selected, requestId: request })
    if (!r?.token) return
    const secret = String(r.token)
    const url = new URL(location.href)
    url.searchParams.delete('gift')
    if (s.config.botUsername) {
      setLink(`https://t.me/${s.config.botUsername.replace(/^@/, '')}?startapp=gift_${encodeGift(secret)}`)
    } else {
      url.searchParams.set('gift', secret)
      setLink(url.href)
    }
    setRequest(crypto.randomUUID())
  }
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text, url: link })
      else {
        await navigator.clipboard.writeText(`${text}\n${link}`)
        message('Ссылка и послание скопированы')
      }
    } catch {
      message('Скопируйте ссылку из поля ниже')
    }
  }
  return (
    <>
      <PageHeader title="Подарки своим" subtitle="Бонусы становятся маленькой радостью для другого." />
      <div className="az-page-body az-expansion">
        {token && (
          <section className="az-gift-unbox">
            <svg className="az-parcel" viewBox="0 0 240 180" width="240" height="180" aria-hidden="true">
              <ellipse cx="120" cy="161" rx="83" ry="10" fill="currentColor" opacity=".08"/>
              <rect x="39" y="65" width="162" height="87" rx="14" fill="var(--az-primary)"/>
              <rect x="106" y="65" width="28" height="87" fill="var(--az-accent)"/>
              <motion.g animate={opened && !reduced && brand.motion !== 'reduced' ? {y:-32,rotate:-9,opacity:.25} : {y:0,rotate:0,opacity:1}} style={{transformOrigin:'120px 60px'}} transition={{type:'spring',stiffness:160,damping:15}}>
                <rect x="31" y="48" width="178" height="30" rx="10" fill="var(--az-primary)"/>
                <rect x="105" y="48" width="30" height="30" fill="var(--az-accent)"/>
                <path d="M120 49C61 49 70 3 98 19c15 9 22 30 22 30Zm0 0c59 0 50-46 22-30-15 9-22 30-22 30Z" fill="none" stroke="var(--az-accent)" strokeWidth="9" strokeLinecap="round"/>
              </motion.g>
            </svg>
            <h2>{opened ? 'Подарок получен' : 'Вам оставили подарок'}</h2>
            <p>
              {opened
                ? 'Купон сохранён в кошельке.'
                : 'Потяните ленту вниз или нажмите на неё. Купон появится после проверки подарка.'}
            </p>
            <motion.button
              className="az-button az-button-primary"
              drag={!reduced && brand.motion !== 'reduced' && !opened && !busy ? 'y' : false}
              dragConstraints={{top:0,bottom:80}}
              dragSnapToOrigin
              dragElastic={.1}
              style={{touchAction:'none'}}
              onDragEnd={(_,info) => {if(info.offset.y>=45)void claim()}}
              disabled={busy || opened}
              onClick={() => void claim()}
            >
              {opened ? <Check /> : '↓ Потянуть за ленту'}
            </motion.button>
          </section>
        )}
        <SectionTitle title="Выберите радость" />
        <p>Баланс: {s.me.points} баллов. Подарок резервируется на 7 дней. Неполученный можно вернуть.</p>
        <div className="az-exp-grid">
          {s.entities
            .filter(
              (e) => e.kind === 'reward' && e.published && e.data.digital !== true && Number(e.data.pointsCost) > 0,
            )
            .map((e) => (
              <button
                key={e.id}
                aria-pressed={selected === e.id}
                className={`az-exp-tile ${selected === e.id ? 'is-selected' : ''}`}
                onClick={() => setSelected(e.id)}
              >
                <Art kind={e.cover} />
                <strong>{e.title}</strong>
                <span>
                  {String(e.data.pointsCost)} баллов · {e.capacity === null ? 'без лимита' : `${e.capacity} доступно`}
                </span>
              </button>
            ))}
        </div>
        <label>
          Ваше послание
          <textarea maxLength={300} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <Button disabled={!selected || busy} onClick={() => void send()}>
          Зарезервировать за баллы <Gift size={18} />
        </Button>
        {link && (
          <section className="az-exp-panel">
            <h3>Передайте лично</h3>
            <p>Ссылка секретная: её получатель сможет принять подарок. Послание передаётся вместе со ссылкой.</p>
            <input aria-label="Ссылка подарка" readOnly value={link} />
            <Button onClick={() => void share()}>Поделиться подарком</Button>
          </section>
        )}
        <SectionTitle title="История подарков" />
        {(s.gifts ?? []).map((g) => (
          <section className="az-exp-panel" key={g.id}>
            <strong>{g.title}</strong>
            <p>
              {g.senderId === s.me.id ? 'Отправлен' : 'Получен'} ·{' '}
              {g.status === 'claimed'
                ? 'Принят'
                : g.status === 'cancelled'
                  ? 'Возвращён'
                  : `Ожидает до ${date(g.expiresAt)}`}
            </p>
            {g.senderId === s.me.id && g.status === 'sent' && (
              <Button
                tone="soft"
                disabled={busy}
                onClick={async () => {
                  if (await act('gift.cancel', { giftId: g.id })) {
                    setLink('')
                    message('Баллы и резерв возвращены')
                  }
                }}
              >
                Отменить и вернуть баллы
              </Button>
            )}
          </section>
        ))}
      </div>
    </>
  )
}
export function Passport() {
  const { snapshot: s, act, busy, push } = usePlatform()
  const [flying, setFlying] = useState('')
  if (!s) return null
  const eligible = s.entities.filter(
    (e) => e.published && ['article', 'lesson', 'mission', 'video', 'file'].includes(e.kind),
  )
  const earned = s.passport ?? []
  return (
    <>
      <PageHeader title="Паспорт впечатлений" subtitle={`${earned.length} отметок в вашей коллекции`} />
      <div className="az-page-body az-expansion">
        <div className="az-passport-collection" aria-label="Коллекция">
          <Sparkles />
          <strong>{earned.length}</strong>
          <span>сохранённых открытий</span>
        </div>
        {flying && (
          <motion.div
            className="az-flying-stamp"
            initial={{ y: 80, scale: 1.4, opacity: 1 }}
            animate={{ y: -60, scale: 0.3, opacity: 0 }}
            transition={{ duration: 0.7 }}
            onAnimationComplete={() => setFlying('')}
          >
            ✳
          </motion.div>
        )}
        <div className="az-exp-grid">
          {eligible.map((e) => {
            const stamp = earned.find((v) => v.entityId === e.id)
            const complete = s.progress.some((p) => p.userId === s.me.id && p.entityId === e.id)
            return (
              <section className={`az-exp-tile ${stamp ? 'is-earned' : ''}`} key={e.id}>
                <Art kind={e.cover} />
                <h3>{e.title}</h3>
                <p>
                  {stamp ? `Получено ${date(stamp.earnedAt)}` : complete ? 'Действие подтверждено' : 'Ожидает открытия'}
                </p>
                {!stamp &&
                  (complete ? (
                    <Button
                      disabled={busy}
                      onClick={async () => {
                        if (await act('passport.claim', { entityId: e.id })) setFlying(e.id)
                      }}
                    >
                      В коллекцию
                    </Button>
                  ) : (
                    <Button tone="soft" onClick={() => push({ type: 'entity', id: e.id })}>
                      Открыть
                    </Button>
                  ))}
              </section>
            )
          })}
        </div>
      </div>
    </>
  )
}
export function Projects({ manage = false }: { manage?: boolean }) {
  const { snapshot: s, push, act, busy, message, stack } = usePlatform()
  const id = stack.at(-1)?.id
  const [edit, setEdit] = useState<ClientProject | null>(null)
  if (!s) return null
  const owner = ['owner', 'admin'].includes(s.me.role)
  const manager = owner || s.me.role === 'editor'
  const projects = (s.projects ?? []).filter((p) => (manage ? manager : p.userId === s.me.id))
  const chosen = projects.find((p) => p.id === id)
  const start = (p?: ClientProject) =>
    setEdit(
      p
        ? structuredClone(p)
        : {
            id: crypto.randomUUID(),
            userId: s.me.id,
            managerId: s.me.id,
            title: 'Новый проект',
            status: 'В работе',
            updatedAt: new Date().toISOString(),
            milestones: [
              { id: crypto.randomUUID(), title: 'Концепция', status: 'pending', body: '', media: [], documents: [] },
            ],
          },
    )
  return (
    <>
      <PageHeader
        title={manage ? 'Управление проектами' : (chosen?.title ?? 'Кабинет клиента')}
        subtitle="Этапы, материалы и решения в одном месте."
      />
      <div className="az-page-body az-expansion">
        {manage && owner && <Button onClick={() => start()}>Создать проект</Button>}
        {!projects.length && (
          <Empty title="Пока нет проектов" body="После подтверждения заявки менеджер добавит сюда этапы и документы." />
        )}
        {(chosen ? [chosen] : projects).map((p) => (
          <section className="az-exp-panel" key={p.id}>
            <span className="az-eyebrow">
              {p.status} · {date(p.updatedAt)}
            </span>
            <h2>{p.title}</h2>
            {!chosen && !manage ? (
              <Button tone="soft" onClick={() => push({ type: 'projects', id: p.id })}>
                Открыть кабинет <ArrowUpRight size={18} />
              </Button>
            ) : (
              p.milestones.map((m) => (
                <article className="az-project-stage" key={m.id}>
                  <span className={`az-stage-status is-${m.status}`}>
                    {m.status === 'approved' ? 'Согласовано' : m.status === 'review' ? 'На согласовании' : 'Впереди'}
                  </span>
                  <h3>{m.title}</h3>
                  <p>{m.body}</p>
                  {m.media.map((url) => (
                    <ProjectMedia value={url} key={url} title={`Материал этапа ${m.title}`} />
                  ))}
                  {m.documents.map((d) => (
                    <ProjectDocument key={d.url} value={d.url} title={d.title} />
                  ))}
                  {p.userId === s.me.id && m.status === 'review' && !manage && (
                    <Button
                      disabled={busy}
                      onClick={async () => {
                        if (await act('project.approve', { projectId: p.id, milestoneId: m.id }))
                          message('Этап согласован')
                      }}
                    >
                      Согласовать этап
                    </Button>
                  )}
                </article>
              ))
            )}
            {manage && manager && (
              <Button tone="soft" onClick={() => start(p)}>
                Редактировать проект
              </Button>
            )}
          </section>
        ))}
        {edit && (
          <form
            className="az-exp-panel"
            onSubmit={async (e) => {
              e.preventDefault()
              if (
                await act(
                  (s.projects ?? []).some((p) => p.id === edit.id) ? 'admin.project.update' : 'admin.project.save',
                  { project: edit as unknown as Data },
                )
              ) {
                message('Проект сохранён')
                setEdit(null)
              }
            }}
          >
            <h2>Редактор проекта</h2>
            <label>
              Название
              <input required value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </label>
            <label>
              Статус
              <input required value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} />
            </label>
            {owner &&
              (['userId', 'managerId'] as const).map((k) => (
                <label key={k}>
                  {k === 'userId' ? 'Клиент' : 'Менеджер'}
                  <select value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}>
                    {s.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            {edit.milestones.map((m, i) => {
              const update = (v: Partial<typeof m>) =>
                setEdit({ ...edit, milestones: edit.milestones.map((a, j) => (i === j ? { ...a, ...v } : a)) })
              return (
                <fieldset key={m.id}>
                  <legend>Этап {i + 1}</legend>
                  <label>
                    Название этапа
                    <input value={m.title} required onChange={(e) => update({ title: e.target.value })} />
                  </label>
                  <label>
                    Состояние
                    <select value={m.status} onChange={(e) => update({ status: e.target.value as typeof m.status })}>
                      <option value="pending">Впереди</option>
                      <option value="review">На согласовании</option>
                      {m.status === 'approved' && <option value="approved">Согласовано клиентом</option>}
                    </select>
                  </label>
                  <p>Для изменения согласованных материалов сначала верните этап на согласование.</p>
                  <label>
                    Описание
                    <textarea
                      disabled={m.status === 'approved'}
                      value={m.body}
                      onChange={(e) => update({ body: e.target.value })}
                    />
                  </label>
                  <label>
                    Изображения HTTPS, по одному на строке
                    <textarea
                      disabled={m.status === 'approved'}
                      value={m.media.join('\n')}
                      onChange={(e) => update({ media: e.target.value.split('\n').filter(Boolean) })}
                    />
                  </label>
                  {!demoMode() && (s.projects ?? []).some((p) => p.id === edit.id) && (
                    <label>
                      Добавить защищённый файл
                      <input
                        type="file"
                        disabled={m.status === 'approved' || busy}
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (file.size > 5 * 1024 * 1024) return message('Файл должен быть меньше 5 МБ')
                          try {
                            const r = await act('file.upload-url', {
                              filename: file.name,
                              contentType: file.type,
                              purpose: 'project:' + edit.id,
                            })
                            if (!r?.url || !r.fileId) return
                            const response = await fetch(String(r.url), {
                              method: 'PUT',
                              body: file,
                              headers: { 'Content-Type': file.type },
                            })
                            if (!response.ok) throw new Error('Не удалось загрузить файл')
                            const ref = 'file:' + r.fileId
                            if (file.type.startsWith('image/')) update({ media: [...m.media, ref] })
                            else update({ documents: [...m.documents, { title: file.name, url: ref }] })
                            message('Файл загружен. Сохраните проект, чтобы прикрепить его к этапу.')
                          } catch (error) {
                            message(error instanceof Error ? error.message : 'Ошибка загрузки')
                          }
                        }}
                      />
                    </label>
                  )}
                  {demoMode() && <p>Демо: реальные файлы не загружаются. Можно указать публичный HTTPS адрес.</p>}
                  <label>
                    Документы: название | HTTPS адрес
                    <textarea
                      disabled={m.status === 'approved'}
                      value={m.documents.map((d) => `${d.title} | ${d.url}`).join('\n')}
                      onChange={(e) =>
                        update({
                          documents: e.target.value
                            .split('\n')
                            .filter(Boolean)
                            .map((v) => {
                              const [title, ...url] = v.split('|')
                              return { title: title.trim(), url: url.join('|').trim() }
                            }),
                        })
                      }
                    />
                  </label>
                </fieldset>
              )
            })}
            <Button
              type="button"
              tone="soft"
              onClick={() =>
                setEdit({
                  ...edit,
                  milestones: [
                    ...edit.milestones,
                    {
                      id: crypto.randomUUID(),
                      title: 'Новый этап',
                      status: 'pending',
                      body: '',
                      media: [],
                      documents: [],
                    },
                  ],
                })
              }
            >
              Добавить этап
            </Button>
            <Button disabled={busy}>Сохранить проект</Button>
            <Button type="button" tone="ghost" onClick={() => setEdit(null)}>
              Закрыть редактор
            </Button>
          </form>
        )}
      </div>
    </>
  )
}
export function Recap() {
  const { snapshot: s, message } = usePlatform()
  const brand = useBrand()
  const [period, setPeriod] = useState(7)
  if (!s) return null
  const end = new Date()
  const start = new Date(end.getTime() - period * 86400000)
  const within = (v: string) => Date.parse(v) >= start.getTime() && Date.parse(v) <= end.getTime()
  const progress = s.progress.filter((v) => v.userId === s.me.id && within(v.completedAt))
  const bookings = s.bookings.filter((v) => v.userId === s.me.id && v.status !== 'cancelled' && within(v.createdAt))
  const orders = s.orders.filter((v) => v.userId === s.me.id && v.status !== 'cancelled' && within(v.createdAt))
  const range = `${date(start.toISOString())} — ${date(end.toISOString())}`
  const save = async () => {
    const c = document.createElement('canvas')
    c.width = 1080
    c.height = 1350
    const ctx = c.getContext('2d')!
    ctx.fillStyle = brand.colors.primary
    ctx.fillRect(0, 0, 1080, 1350)
    ctx.fillStyle = brand.colors.accent
    ctx.beginPath()
    ctx.arc(950, 250, 420, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = brand.colors.onPrimary ?? '#ffffff'
    ctx.font = `bold 55px "${brand.fonts.display}"`
    ctx.fillText(brand.name, 70, 110)
    ctx.font = '44px sans-serif'
    ;[
      s.me.name,
      range,
      `${progress.length} завершённых шагов`,
      `${bookings.length} записей на встречи`,
      `${orders.length} заказов`,
    ].forEach((t, i) => ctx.fillText(t.slice(0, 42), 70, 650 + i * 110))
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r))
    if (!blob) return
    const file = new File([blob], `${brand.id}-recap.png`, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] })
      else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      }
    } catch {
      message('Не удалось поделиться итогом')
    }
  }
  return (
    <>
      <PageHeader title="Моя глава" subtitle="Ваши реальные действия за выбранный период." />
      <div className="az-page-body az-expansion">
        <label>
          Период
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            <option value={7}>Неделя · 7 дней</option>
            <option value={90}>Сезон · 90 дней</option>
          </select>
        </label>
        <section className="az-recap">
          <Sparkles />
          <p>{range}</p>
          <h2>{s.me.name}</h2>
          <strong>{progress.length}</strong>
          <p>завершённых шагов</p>
          <p>
            {bookings.length} записей · {orders.length} заказов
          </p>
        </section>
        <Button onClick={() => void save()}>Поделиться итогом</Button>
        {demoMode() && <p>Демонстрационные действия этого браузера.</p>}
      </div>
    </>
  )
}
