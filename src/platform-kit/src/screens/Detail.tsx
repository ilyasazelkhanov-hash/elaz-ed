import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Check,
  Download,
  Heart,
  LockKeyhole,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Ticket,
  Upload,
  Users,
} from 'lucide-react'
import { usePlatform } from '../platform/store.ts'
import { demoMode, telegram } from '../platform/client.ts'
import { Art, Button, Empty, Meter, Modal, PageHeader, QR, SectionTitle, money } from '../components/ui.tsx'
import type { Data, Entity } from '../platform/contracts.ts'
import { useBrand } from '../platform/brand-context.ts'

export default function EntityDetail({ id }: { id: string }) {
  const brand = useBrand()
  const { snapshot: s, push, act, celebrate, addCart, message } = usePlatform(),
    [confirmPurchase, setConfirmPurchase] = useState(false),
    [variant, setVariant] = useState(''),
    [body, setBody] = useState(''),
    [file, setFile] = useState(''),
    [certificate, setCertificate] = useState(''),
    [uploading, setUploading] = useState(false),
    [brief, setBrief] = useState<Record<string, string>>({}),
    [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const e = s?.entities.find((v) => v.id === id)
  useEffect(() => {
    setVariant('')
    setBody('')
    setFile('')
    setCertificate('')
    setBrief({})
    setRequestId(crypto.randomUUID())
  }, [id])
  if (!s || !e)
    return (
      <>
        <PageHeader title="Материал недоступен" />
        <Empty title="Немного терпения" body="Возможно, материал ещё не опубликован или у вас нет доступа." />
      </>
    )
  const done = s.progress.some((p) => p.entityId === e.id && p.userId === s.me.id),
    variants = (e.data.variants ?? []) as { name: string; price: number }[],
    selected = variant || variants[0]?.name || '',
    booking = s.bookings.find((b) => b.entityId === id && b.userId === s.me.id && b.status !== 'cancelled'),
    lessons = s.entities
      .filter((l) => l.kind === 'lesson' && l.data.courseId === e.id)
      .sort((a, b) => Number(a.data.order) - Number(b.data.order)),
    completed = lessons.filter((l) => s.progress.some((p) => p.entityId === l.id && p.userId === s.me.id)).length,
    homeworks = s.homework.filter((h) => h.lessonId === e.id && h.userId === s.me.id)
  const isProduct = e.kind === 'product' || e.kind === 'service',
    isEvent = e.kind === 'event' || e.kind === 'slot',
    locked = !!e.data.locked
  const briefFields = (e.data.briefFields ??
    ((e.data.form ?? []) as string[]).map((label, i) => ({
      id: `field-${i}`,
      label,
      required: i < 2,
      type: 'text',
    }))) as { id: string; label: string; required?: boolean; type?: string; options?: string[] }[]
  const purchase = async () => {
    const result = await act('stars.invoice', { entityId: e.id })
    if (!result) return
    const link = String(result.link)
    if (link.startsWith('demo:')) {
      setConfirmPurchase(true)
    } else if (telegram()?.openInvoice)
      telegram()!.openInvoice!(link, (status) => {
        if (status === 'paid') {
          message('Оплата принята. Обновляем доступ.')
          let attempt = 0
          const refresh = () => {
            void act('bootstrap').then(() => {
              attempt++
              if (
                attempt < 5 &&
                !usePlatform
                  .getState()
                  .snapshot?.membership?.some(
                    (m) => m.entityId === e.id && m.status === 'active' && Date.parse(m.expiresAt) > Date.now(),
                  )
              )
                setTimeout(refresh, 1500)
            })
          }
          refresh()
        }
      })
    else message('Оплата открывается внутри Telegram')
  }
  const upload = async (f: File) => {
    if (f.size > 5 * 1024 * 1024) return message('Файл должен быть не больше 5 МБ')
    setUploading(true)
    try {
      if (demoMode()) {
        setFile(`Демо-файл: ${f.name}`)
        message('Название файла сохранено в демонстрации. В рабочем режиме файл загружается в закрытое хранилище.')
      } else {
        const result = await act('file.upload-url', {
          filename: f.name,
          contentType: f.type || 'application/octet-stream',
          purpose: 'homework',
        })
        if (!result) return
        const res = await fetch(String(result.uploadUrl ?? result.url), {
          method: 'PUT',
          headers: { 'Content-Type': f.type || 'application/octet-stream' },
          body: f,
        })
        if (!res.ok) throw new Error('Не удалось загрузить файл')
        setFile(String(result.fileId))
        message('Файл загружен')
      }
    } catch (error) {
      message(error instanceof Error ? error.message : 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }
  return (
    <>
      {confirmPurchase && (
        <Modal title="Демонстрационная покупка" onClose={() => setConfirmPurchase(false)}>
          <p>
            Это локальная демонстрация. Реальные Stars не списываются.{' '}
            {e.data.subscription === true ? 'Доступ откроется на 30 дней.' : 'Будет открыт демонстрационный доступ.'}
          </p>
          <Button
            onClick={async () => {
              if (await act('demo.purchase', { entityId: e.id })) {
                setConfirmPurchase(false)
                celebrate('Демонстрационный доступ открыт')
              }
            }}
          >
            Подтвердить демо-покупку
          </Button>
        </Modal>
      )}
      <PageHeader
        title={
          e.kind === 'lesson'
            ? 'Ваша новая глава'
            : e.kind === 'reward'
              ? 'Привилегия клуба'
              : e.kind === 'campaign'
                ? 'Хороший повод вернуться'
                : isProduct
                  ? 'Вещи с характером'
                  : isEvent
                    ? 'Встретимся здесь'
                    : 'Журнал клуба'
        }
      />
      <div className="az-detail">
        <Art kind={e.cover} className="az-detail-art" />
        <div className="az-detail-copy">
          <div className="az-detail-meta">
            <span className="az-eyebrow">{e.tag}</span>
            <div>
              <button
                aria-label="В избранное"
                className={s.favorites.includes(id) ? 'is-liked' : ''}
                onClick={() => void act('favorite.toggle', { entityId: id })}
              >
                <Bookmark size={20} fill={s.favorites.includes(id) ? 'currentColor' : 'none'} />
              </button>
              <button
                aria-label="Нравится"
                className={s.reactions.includes(id) ? 'is-liked' : ''}
                onClick={() => void act('reaction.toggle', { entityId: id })}
              >
                <Heart size={20} fill={s.reactions.includes(id) ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
          <h1>{e.title}</h1>
          <p className="az-detail-subtitle">{e.subtitle}</p>
          {locked ? (
            <div className="az-locked">
              <LockKeyhole size={32} />
              <h3>Продолжение — в закрытом курсе</h3>
              <Button onClick={() => push({ type: 'entity', id: String(e.data.courseId) })}>
                Посмотреть программу
                <ArrowUpRight size={17} />
              </Button>
            </div>
          ) : (
            <div className="az-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{e.body}</ReactMarkdown>
            </div>
          )}
          {(e.kind === 'article' || e.kind === 'video' || e.kind === 'file') && (
            <Button
              tone={done ? 'soft' : 'dark'}
              disabled={done}
              onClick={async () => {
                const r = await act('content.complete', { entityId: id })
                if (r) celebrate('Новая идея — в вашей копилке')
              }}
            >
              {done ? (
                <>
                  <Check size={17} />
                  Прочитано и сохранено
                </>
              ) : (
                <>
                  Отметить прочитанным
                  <Check size={17} />
                </>
              )}
            </Button>
          )}
          {['video', 'lesson'].includes(e.kind) &&
            typeof e.data.url === 'string' &&
            /^https:\/\//.test(e.data.url) &&
            (/\.(mp4|webm|m4v)(\?|$)/i.test(e.data.url) ? (
              <video
                controls
                playsInline
                preload="metadata"
                src={e.data.url}
                className="az-video"
                aria-label={e.title}
              />
            ) : (
              <a className="az-button az-button-primary" href={e.data.url} target="_blank" rel="noopener noreferrer">
                Смотреть видео
                <ArrowUpRight size={18} />
              </a>
            ))}
          {e.kind === 'file' && (
            <Button
              onClick={async () => {
                if (demoMode() && e.data.fileLabel) return message(String(e.data.fileLabel))
                const result = await act('file.download-url', { fileId: String(e.data.fileId ?? '') })
                if (result?.url) window.open(String(result.url), '_blank', 'noopener')
              }}
            >
              Получить материал
              <Download size={18} />
            </Button>
          )}
          {e.kind === 'course' && (
            <div className="az-course-program">
              <Meter
                value={completed}
                max={Math.max(lessons.length, 1)}
                label={`${completed} из ${lessons.length} уроков пройдено`}
              />
              {e.data.subscription === true && (
                <p>
                  Подписка на 30 дней · {e.price} Stars за период. Продлевается автоматически в Telegram. Доступ
                  подтверждается сервером после оплаты; управление продлением — в Telegram.
                </p>
              )}
              {e.price > 0 && (e.data.subscription === true || lessons.some((l) => l.data.locked)) && (
                <Button onClick={() => void purchase()}>
                  {e.data.subscription === true ? 'Подписаться · ' : 'Открыть за '}
                  {e.price} Stars ✦
                </Button>
              )}
              <SectionTitle title="Ваш маршрут" />
              {lessons.map((l, i) => {
                const prevDone =
                  i === 0 || s.progress.some((p) => p.entityId === lessons[i - 1].id && p.userId === s.me.id)
                const isDone = s.progress.some((p) => p.entityId === l.id && p.userId === s.me.id)
                return (
                  <button
                    key={l.id}
                    className={`az-lesson-link ${!prevDone ? 'is-locked' : ''}`}
                    disabled={!prevDone}
                    onClick={() => push({ type: 'entity', id: l.id })}
                  >
                    <span>{isDone ? <Check size={20} /> : String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <h3>{l.title}</h3>
                      <p>{isDone ? 'Урок пройден' : prevDone ? l.subtitle : 'Сначала завершите предыдущий урок'}</p>
                    </div>
                    {l.data.locked ? <LockKeyhole size={18} /> : <ArrowRight size={18} />}
                  </button>
                )
              })}
              {completed === lessons.length && lessons.length > 0 && (
                <Button
                  tone="lime"
                  onClick={async () => {
                    const result = await act('certificate.issue', { courseId: id })
                    if (result?.code) {
                      setCertificate(String(result.code))
                      celebrate('У вас получилось. Это ваш сертификат!')
                    }
                  }}
                >
                  Получить сертификат
                  <Download size={18} />
                </Button>
              )}
              {certificate && (
                <div className="az-certificate">
                  <span>{brand.name.toUpperCase()} ACADEMY</span>
                  <h2>
                    Сертификат
                    <br />
                    новой главы
                  </h2>
                  <strong>{s.me.name}</strong>
                  <p>успешно завершил программу «{e.title}»</p>
                  <QR value={`${location.origin}${s.config.apiPublicPath ?? '/api'}/v1/certificates/${certificate}`} />
                  <code>{certificate}</code>
                  <Button tone="soft" onClick={() => window.print()}>
                    Распечатать или сохранить PDF
                  </Button>
                </div>
              )}
            </div>
          )}
          {e.kind === 'lesson' && !locked && (
            <>
              <div className="az-note-strip">
                <span>✦</span>
                <p>Закрепите идею практикой — и она станет вашим навыком.</p>
              </div>
              <Button
                disabled={done}
                tone={done ? 'soft' : 'primary'}
                onClick={async () => {
                  if (e.data.hasQuiz) push({ type: 'quiz', id })
                  else if (await act('content.complete', { entityId: id })) celebrate('Ещё один урок позади')
                }}
              >
                {done ? (
                  <>
                    <Check size={18} />
                    Урок пройден
                  </>
                ) : (
                  <>
                    Проверить себя · +{String(e.data.xp ?? 25)} XP
                    <ArrowRight size={18} />
                  </>
                )}
              </Button>
              <SectionTitle title="Из идеи — в практику" />
              <div className="az-panel">
                <p>Поделитесь результатом с наставником. Расскажите, что попробовали и что получилось.</p>
                <textarea
                  value={body}
                  onChange={(ev) => setBody(ev.target.value)}
                  placeholder="Моя идея и первый результат…"
                  aria-label="Домашнее задание"
                />
                <label className="az-file-label">
                  <Upload size={17} />
                  {uploading ? 'Загружаем…' : file || 'Прикрепить работу · до 5 МБ'}
                  <input
                    type="file"
                    disabled={uploading}
                    onChange={(ev) => {
                      const f = ev.target.files?.[0]
                      if (f) void upload(f)
                    }}
                  />
                </label>
                <Button
                  disabled={body.trim().length < 3 || uploading}
                  onClick={async () => {
                    if (await act('homework.submit', { lessonId: id, body, file })) {
                      setBody('')
                      setFile('')
                      message('Работа отправлена наставнику')
                    }
                  }}
                >
                  Отправить на проверку
                  <ArrowUpRight size={17} />
                </Button>
                {homeworks.map((h) => (
                  <div className="az-homework" key={h.id}>
                    <span className="az-eyebrow">
                      {h.status === 'approved'
                        ? 'ПРИНЯТО'
                        : h.status === 'revision'
                          ? 'ЕЩЁ НЕМНОГО ПРАКТИКИ'
                          : 'У НАСТАВНИКА'}
                    </span>
                    <p>{h.body}</p>
                    {h.file && <small>{h.file}</small>}
                    {h.feedback && <blockquote>{h.feedback}</blockquote>}
                  </div>
                ))}
              </div>
            </>
          )}
          {e.kind === 'campaign' && (
            <>
              <div className="az-note-strip">
                <span>✳</span>
                <p>Открывайте задания в своём ритме до окончания сезона. Результат сохраняется в вашем профиле.</p>
              </div>
              <SectionTitle title="Ваша коллекция открытий" />
              <div className="az-advent-grid">
                {Array.from({ length: Number(e.data.days ?? 24) }, (_, i) => {
                  const mission = s.entities.find(
                    (m) => m.kind === 'mission' && m.data.campaignId === id && Number(m.data.day) === i + 1,
                  )
                  const isDone = mission && s.progress.some((p) => p.entityId === mission.id && p.userId === s.me.id)
                  return (
                    <button
                      key={i}
                      className={isDone ? 'is-open' : i === 0 ? 'is-today' : ''}
                      onClick={() => {
                        if (mission) push({ type: mission.data.game === 'quiz' ? 'quiz' : 'game', id: mission.id })
                        else message('В этой кампании пока нет опубликованных заданий')
                      }}
                    >
                      <small>{String(i + 1).padStart(2, '0')}</small>
                      <span>{isDone ? <Check size={23} /> : ['✦', '✳', '✷', '◈', '✧', '◉'][i % 6]}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
          {e.kind === 'reward' && (
            <div className="az-reward-action">
              <div>
                <strong>
                  {String(e.data.pointsCost ?? e.price)}
                  <small> баллов</small>
                </strong>
                <p>Ваш баланс: {s.me.points} баллов</p>
              </div>
              <Button
                disabled={s.me.points < Number(e.data.pointsCost ?? e.price)}
                onClick={async () => {
                  if (await act('reward.claim', { entityId: id })) {
                    celebrate('Ваш подарок уже в кошельке')
                    push({ type: 'wallet' })
                  }
                }}
              >
                Это моё
                <GiftIcon />
              </Button>
              <small>
                Код появится в кошельке. Срок действия — {String(e.data.expiresDays ?? 30)} дней. Получение на точке
                клуба.
              </small>
            </div>
          )}
          {isProduct && !(e.kind === 'service' && briefFields.length) && (
            <div className="az-product-actions">
              <strong>{money(variants.find((v) => v.name === selected)?.price ?? e.price, s.config.currency)}</strong>
              <div className="az-filter-row">
                {variants.map((v) => (
                  <button
                    className={`az-pill ${selected === v.name ? 'is-active' : ''}`}
                    onClick={() => setVariant(v.name)}
                    key={v.name}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
              <Button
                onClick={() => {
                  addCart(id, selected)
                  message(e.kind === 'service' ? 'Услуга добавлена в заявку' : 'Хороший выбор! Уже в корзине')
                }}
              >
                {e.kind === 'service' ? 'Добавить в заявку' : 'Хочу себе'}
                <ShoppingBag size={18} />
              </Button>
              <Button tone="soft" onClick={() => push({ type: 'cart' })}>
                Перейти к оформлению
                <ArrowRight size={17} />
              </Button>
              <small>
                {e.kind === 'service'
                  ? 'Оставьте пожелания при оформлении, и менеджер свяжется с вами.'
                  : 'Оплата при получении. Менеджер подтвердит наличие и детали заказа.'}
              </small>
            </div>
          )}
          {e.kind === 'service' && briefFields.length > 0 && (
            <form
              className="az-service-brief az-panel"
              onSubmit={async (ev) => {
                ev.preventDefault()
                if (
                  await act('order.create', {
                    requestId,
                    items: [{ entityId: id, quantity: 1, variant: selected }],
                    brief: { [id]: brief },
                    note: '',
                  })
                ) {
                  celebrate('Заявка отправлена. Скоро обсудим ваш следующий шаг.')
                  push({ type: 'profile' })
                }
              }}
            >
              <h3>Расскажите о вашей задаче</h3>
              <p>
                Стоимость: {money(variants.find((v) => v.name === selected)?.price ?? e.price, s.config.currency)}.
                Менеджер подтвердит детали.
              </p>
              {briefFields.map((field) => (
                <label key={field.id}>
                  {field.label}
                  {field.required ? ' *' : ''}
                  {field.type === 'textarea' ? (
                    <textarea
                      aria-label={field.label}
                      required={field.required}
                      maxLength={2000}
                      value={brief[field.id] ?? ''}
                      onChange={(ev) => setBrief({ ...brief, [field.id]: ev.target.value })}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      aria-label={field.label}
                      required={field.required}
                      value={brief[field.id] ?? ''}
                      onChange={(ev) => setBrief({ ...brief, [field.id]: ev.target.value })}
                    >
                      <option value="">Выберите вариант</option>
                      {field.options?.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label={field.label}
                      required={field.required}
                      maxLength={2000}
                      type={field.type === 'email' ? 'email' : 'text'}
                      value={brief[field.id] ?? ''}
                      onChange={(ev) => setBrief({ ...brief, [field.id]: ev.target.value })}
                    />
                  )}
                </label>
              ))}
              <Button type="submit">
                Отправить заявку
                <ArrowRight size={17} />
              </Button>
            </form>
          )}
          {isEvent && (
            <div className="az-event-booking">
              <div className="az-event-facts">
                <p>
                  <CalendarDays size={20} />
                  {new Date(String(e.data.startsAt)).toLocaleString('ru', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                    timeZone: s.config.timezone,
                  })}
                </p>
                <p>
                  <MapPin size={20} />
                  {String(e.data.location ?? 'Место сообщим участникам')}
                </p>
                <p>
                  <Users size={20} />
                  До {e.capacity ?? '∞'} участников
                </p>
              </div>
              {Array.isArray(e.data.agenda) && (
                <div className="az-agenda">
                  {(e.data.agenda as string[]).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              )}
              {booking ? (
                <div className="az-ticket">
                  <Ticket size={30} />
                  <h3>
                    {booking.status === 'waitlist'
                      ? 'Вы в листе ожидания'
                      : booking.status === 'checked_in'
                        ? 'Рады, что вы с нами!'
                        : 'Место — ваше!'}
                  </h3>
                  <p>{booking.status === 'waitlist' ? 'Сообщим, когда освободится место.' : 'Покажите QR на входе.'}</p>
                  {booking.status !== 'waitlist' && <QR value={booking.code} />}
                  <code>{booking.code}</code>
                  {booking.status !== 'checked_in' && (
                    <Button tone="soft" onClick={() => void act('event.cancel', { entityId: id })}>
                      Отменить регистрацию
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  onClick={async () => {
                    if (await act('event.book', { entityId: id })) celebrate('Ещё один хороший план в вашем календаре')
                  }}
                >
                  Я с вами
                  <Ticket size={18} />
                </Button>
              )}
            </div>
          )}
          {e.kind === 'program' && (
            <>
              <div className="az-program-steps">
                {((e.data.steps as string[]) ?? []).map((v, i) => (
                  <div key={v}>
                    <span>{i + 1}</span>
                    <p>{v}</p>
                  </div>
                ))}
              </div>
              <Button onClick={() => push({ type: 'entity', id: String(e.data.courseId ?? 'course-first') })}>
                Начать знакомство
                <ArrowRight size={17} />
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
function GiftIcon() {
  return <span aria-hidden="true">✦</span>
}
export function Cart() {
  const { cart, snapshot: s, addCart, removeCart, clearCart, act, push, celebrate } = usePlatform(),
    [note, setNote] = useState(''),
    [requestId] = useState(() => crypto.randomUUID())
  if (!s) return null
  const total = cart.reduce((sum, row) => {
    const e = s.entities.find((e) => e.id === row.entityId)
    const v = (e?.data.variants as { name: string; price: number }[] | undefined)?.find((v) => v.name === row.variant)
    return sum + (v?.price ?? e?.price ?? 0) * row.quantity
  }, 0)
  return (
    <>
      <PageHeader title="Ваш хороший выбор" subtitle="До новых впечатлений — один шаг." />
      <div className="az-page-body">
        {!cart.length ? (
          <Empty
            title="Здесь ещё немного свободного места"
            body="Загляните в коллекцию — возможно, там вас уже что-то ждёт."
            icon={ShoppingBag}
          />
        ) : (
          <>
            {cart.map((row) => {
              const e = s.entities.find((e) => e.id === row.entityId)
              if (!e) return null
              return (
                <div className="az-cart-row" key={row.entityId + row.variant}>
                  <Art kind={e.cover} />
                  <div>
                    <h3>{e.title}</h3>
                    <p>{row.variant}</p>
                    <strong>
                      {money(
                        ((e.data.variants ?? []) as { name: string; price: number }[]).find(
                          (v) => v.name === row.variant,
                        )?.price ?? e.price,
                        s.config.currency,
                      )}
                    </strong>
                  </div>
                  <div className="az-quantity">
                    <button aria-label="Уменьшить количество" onClick={() => removeCart(row.entityId, row.variant)}>
                      <Minus size={15} />
                    </button>
                    <span>{row.quantity}</span>
                    <button aria-label="Увеличить количество" onClick={() => addCart(row.entityId, row.variant)}>
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
            <div className="az-panel">
              <label>
                Пожелания к заказу
                <textarea
                  aria-label="Комментарий к заказу"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Что нам стоит знать?"
                />
              </label>
              <div className="az-total">
                <span>Итого</span>
                <strong>{money(total, s.config.currency)}</strong>
              </div>
              <Button
                onClick={async () => {
                  if (await act('order.create', { requestId, items: cart, note })) {
                    clearCart()
                    celebrate('Заявка принята. Мы скоро свяжемся!')
                    push({ type: 'profile' })
                  }
                }}
              >
                Оформить · оплата при получении
                <ArrowRight size={18} />
              </Button>
            </div>
          </>
        )}
        <Button tone="soft" onClick={() => push({ type: 'commerce' })}>
          Продолжить выбирать
        </Button>
      </div>
    </>
  )
}
