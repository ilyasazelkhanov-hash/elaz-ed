import { useState } from 'react'
import { usePlatform } from '../platform/store.ts'
import { demoMode } from '../platform/client.ts'
import { Button, PageHeader, SectionTitle, Art } from '../components/ui.tsx'
import { EntityCard, MemberCard } from './Home.tsx'
import { useBrand } from '../platform/brand-context.ts'
import { industries, resolveIndustryKey } from '../platform/industries.ts'
import { companyJourney, expertGoals, fittingAppointments } from '../platform/industry-scenarios.ts'
export { industries } from '../platform/industries.ts'
export function IndustryPicker() {
  const { push } = usePlatform()
  return (
    <>
      <PageHeader title="Отраслевые сценарии" subtitle="Пять способов использовать ваше пространство." />
      <div className="az-page-body az-expansion">
        {Object.entries(industries).map(([id, [name, body, cover]]) => (
          <button
            className="az-exp-tile az-industry-pick"
            key={id}
            onClick={() => {
              const url = new URL(location.href)
              url.searchParams.set('industry', id)
              history.replaceState(null, '', url)
              push({ type: 'industry', id })
            }}
          >
            <Art kind={cover} />
            <strong>{name}</strong>
            <span>{body}</span>
          </button>
        ))}
      </div>
    </>
  )
}
export default function Industry({ id }: { id: string }) {
  const { snapshot: s, push, act, busy, message } = usePlatform()
  const brand = useBrand()
  const [top, setTop] = useState(s?.preferences?.sizes.top ?? '')
  const [bottom, setBottom] = useState(s?.preferences?.sizes.bottom ?? '')
  const [shoe, setShoe] = useState(s?.preferences?.sizes.shoe ?? '')
  const [style, setStyle] = useState(s?.preferences?.style ?? '')
  const [pickup, setPickup] = useState('Через 15 минут')
  const [area, setArea] = useState(60)
  const [finish, setFinish] = useState(0)
  const [brief, setBrief] = useState({ project: '', goal: '', contact: '', time: '' })
  const [request, setRequest] = useState(crypto.randomUUID())
  if (!s) return null
  const key = resolveIndustryKey(id)
  const [title, sub, cover] = industries[key]
  const has = (m: string) => s.config.modules.includes(m as never)
  const entities = s.entities.filter((e) => e.published && has(e.module))
  const products = entities.filter((e) => e.kind === 'product' && e.data.industry === key)
  const services = entities.filter((e) => e.kind === 'service' && e.data.industry === key)
  const rates=(services[0]?.data.estimateRates??[]) as {label:string;price:number}[]
  const estimatePrice=finish||rates[0]?.price||0
  const events = entities.filter((e) => ['event', 'slot'].includes(e.kind))
  const lessons = entities.filter((e) => e.kind === 'lesson')
  const fittings = fittingAppointments(entities)
  const onboarding = companyJourney(s)
  const selectedGoal = expertGoals.find((goal) => goal.id === s.journey?.entityId)
  const practiceQuiz = lessons.find((lesson) => lesson.data.hasQuiz === true && lesson.data.locked !== true)
  const courses = entities.filter((e) => e.kind === 'course')
  const activeMembership = (s.membership ?? []).some(
    (m) => m.status === 'active' && Date.parse(m.expiresAt) > Date.now(),
  )
  const open = (type: string) => push({ type })
  const order = async (entityId: string, note: string, fields?: Record<string, string>) => {
    const result = await act('order.create', {
      requestId: request,
      items: [
        {
          entityId,
          quantity: 1,
          variant: String(
            (s.entities.find((e) => e.id === entityId)?.data.variants as { name: string }[] | undefined)?.[0]?.name ??
              '',
          ),
        },
      ],
      note,
      ...(fields ? { brief: { [entityId]: fields } } : {}),
    })
    if (result) {
      setRequest(crypto.randomUUID())
      message('Заявка сохранена. Статус — в профиле.')
    }
  }
  return (
    <>
      <PageHeader title={title} subtitle={sub} />
      <div className="az-page-body az-expansion">
        <section className="az-industry-intro">
          <Art kind={cover} />
          <div>
            <span className="az-eyebrow">{demoMode() ? 'ДЕМОНСТРАЦИОННЫЙ СЦЕНАРИЙ' : 'ВАШЕ ПРОСТРАНСТВО'}</span>
            <h2>{title}</h2>
            <p>{sub}</p>
          </div>
        </section>
        {key === 'coffee' && (
          <>
            {has('loyalty') && <MemberCard brand={brand} />}
            <SectionTitle title="Заказать к вашему приходу" />
            {has('commerce') ? (
              <>
                <label>
                  Когда заберёте
                  <input maxLength={100} value={pickup} onChange={(e) => setPickup(e.target.value)} />
                </label>
                <p>Предзаказ подтверждает сотрудник. Оплата и готовность — по статусу заказа.</p>
                {products.map((e) => (
                  <section className="az-exp-panel" key={e.id}>
                    <Art kind={e.cover} />
                    <h3>{e.title}</h3>
                    <p>{e.subtitle}</p>
                    <Button disabled={busy || !pickup.trim()} onClick={() => void order(e.id, `Самовывоз: ${pickup}`)}>
                      Заказать к приходу · {e.price} {s.config.currency}
                    </Button>
                  </section>
                ))}
              </>
            ) : (
              <p>Предзаказы отключены организатором.</p>
            )}
            {has('loyalty') && (
              <Button tone="soft" onClick={() => open('gifts')}>
                Угостить друга
              </Button>
            )}
            {has('progress') && (
              <Button tone="soft" onClick={() => open('passport')}>
                Коллекция вкусов и открытий
              </Button>
            )}
          </>
        )}
        {key === 'fashion' && (
          <>
            <SectionTitle title="Ваш размер. Ваш стиль." />
            {has('commerce') && (
              <form
                className="az-exp-panel"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (await act('profile.preferences', { sizes: { top, bottom, shoe }, style }))
                    message('Размеры и стиль сохранены')
                }}
              >
                {[
                  ['Верх', top, setTop],
                  ['Низ', bottom, setBottom],
                  ['Обувь', shoe, setShoe],
                ].map(([label, value, set]) => (
                  <label key={String(label)}>
                    {String(label)}
                    <input
                      maxLength={30}
                      value={String(value)}
                      onChange={(e) => (set as (v: string) => void)(e.target.value)}
                    />
                  </label>
                ))}
                <label>
                  Предпочтения по стилю
                  <textarea maxLength={100} value={style} onChange={(e) => setStyle(e.target.value)} />
                </label>
                <Button disabled={busy}>Сохранить размеры и стиль</Button>
              </form>
            )}
            <SectionTitle title="Подборка для вашего гардероба" />
            <p>Сохранённые предпочтения помогают консультации со стилистом. Подборка составлена редакцией.</p>
            {products
              .filter((e) => e.audience !== 'members' || activeMembership)
              .map((e) => (
                <EntityCard key={e.id} entity={e} />
              ))}
            {!activeMembership && (
              <p>Ранний доступ к клубной подборке откроется с действующей подпиской.</p>
            )}
            <section aria-label="Примерка со стилистом">
              <SectionTitle title="Примерка со стилистом" />
              {fittings.length ? fittings.map((e) => (
                <EntityCard key={e.id} entity={e} />
              )) : (
                <p>Слоты примерки пока не опубликованы. Общие встречи клуба не являются записью к стилисту.</p>
              )}
            </section>
            {courses
              .filter((e) => e.data.subscription)
              .map((e) => (
                <EntityCard key={e.id} entity={e} />
              ))}
          </>
        )}
        {key === 'construction' && (
          <>
            <SectionTitle title="Предварительная оценка" />
            <section className="az-exp-panel">
              <label>
                Площадь, м²
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={area}
                  onChange={(e) => setArea(Math.max(1, Number(e.target.value)))}
                />
              </label>
              <label>
                Ориентир за м²
                <select value={estimatePrice} onChange={(e) => setFinish(Number(e.target.value))}>
                  {rates.map(rate=><option key={rate.price} value={rate.price}>{rate.label} · {rate.price.toLocaleString('ru')}</option>)}
                </select>
              </label>
              <h2>
                {(area * estimatePrice).toLocaleString('ru')} {s.config.currency}
              </h2>
              <p>
                Пример расчёта, не оферта и не смета. Точную стоимость подтвердит специалист после замера.
              </p>
            </section>
            {has('commerce') && services[0] && (
              <form
                className="az-exp-panel"
                onSubmit={(e) => {
                  e.preventDefault()
                  void order(
                    services[0].id,
                    `Предварительный расчёт: ${area} м² × ${estimatePrice}. Не является сметой.`,
                    brief,
                  )
                }}
              >
                <h3>Расскажите об объекте</h3>
                {Object.entries({
                  project: 'Объект и адрес',
                  goal: 'Какие работы нужны',
                  contact: 'Контакт для связи',
                  time: 'Сроки и удобное время',
                }).map(([k, label]) => (
                  <label key={k}>
                    {label}
                    <input
                      required={k !== 'time'}
                      maxLength={1000}
                      value={brief[k as keyof typeof brief]}
                      onChange={(e) => setBrief({ ...brief, [k]: e.target.value })}
                    />
                  </label>
                ))}
                <Button disabled={busy}>Отправить заявку на консультацию</Button>
              </form>
            )}
            {has('commerce') && (
              <Button tone="soft" onClick={() => open('projects')}>
                Мой объект · этапы и согласования
              </Button>
            )}
          </>
        )}
        {key === 'company' && (
          <>
            <SectionTitle title="Маршрут первых 30 дней" />
            <p>
              Здесь один общий маршрут: знакомство, рабочие привычки и самостоятельная практика.
              Это не индивидуальное назначение по должности. Отметки появляются только после выполненных действий.
            </p>
            <p role="status">Пройдено шагов: {onboarding.completed} из {onboarding.steps.length}</p>
            {!onboarding.steps.length && <p>Материалы адаптации пока не опубликованы.</p>}
            {onboarding.steps.length > 0 && !onboarding.next && <p>Все опубликованные шаги пройдены.</p>}
            {has('progress') && onboarding.next && (
              <Button
                tone="soft"
                disabled={busy}
                onClick={async () => {
                  const origin = usePlatform.getState().stack.at(-1)
                  if (!onboarding.started && !(await act('journey.choose', { entityId: onboarding.steps[0].id }))) return
                  if (usePlatform.getState().stack.at(-1) === origin) push({ type: 'entity', id: onboarding.next!.id })
                }}
              >
                {onboarding.started ? 'Продолжить адаптацию' : 'Начать адаптацию'}
              </Button>
            )}
            {onboarding.steps.map((e, i) => (
              <section className="az-exp-panel" key={e.id}>
                <span className="az-eyebrow">{['ДНИ 1–7', 'ДНИ 8–14', 'ДНИ 15–30'][i]}</span>
                <EntityCard entity={e} />
                <p>
                  {s.progress.some((v) => v.userId === s.me.id && v.entityId === e.id)
                    ? 'Пройдено ✓'
                    : 'Прочитайте материал и завершите шаг'}
                </p>
              </section>
            ))}
            {has('team') && <Button onClick={() => open('team')}>Коллеги и благодарности</Button>}
            {has('community') && (
              <Button tone="soft" onClick={() => open('community')}>
                Познакомиться с командой
              </Button>
            )}
            <SectionTitle title="Общие встречи" />
            {events.map((e) => (
              <EntityCard key={e.id} entity={e} />
            ))}
            <p>Здесь нет подключения к HR-системе: действия сохраняются в этом пространстве.</p>
          </>
        )}
        {key === 'expert' && (
          <>
            <SectionTitle title="Найдите свой следующий шаг" />
            <p>Выберите интересующую цель. Это сохранённый интерес, а не диагностика уровня или автоматический подбор программы.</p>
            {practiceQuiz && (
              <section className="az-exp-panel">
                <h3>Учебный квиз</h3>
                <p>Вопросы к уроку «{practiceQuiz.title}» помогают повторить материал. Ответы не меняют вашу цель и список курсов.</p>
                <Button onClick={() => push({ type: 'quiz', id: practiceQuiz.id })}>
                  Открыть учебный квиз
                </Button>
              </section>
            )}
            {has('progress') && (
              <div className="az-exp-grid">
                {expertGoals.map((goal) => (
                  <Button
                    tone={selectedGoal?.id === goal.id ? 'primary' : 'soft'}
                    aria-pressed={selectedGoal?.id === goal.id}
                    disabled={busy}
                    key={goal.id}
                    onClick={async () => {
                      if (await act('journey.choose', { entityId: goal.id })) message('Цель сохранена')
                    }}
                  >
                    {goal.title}
                  </Button>
                ))}
              </div>
            )}
            {has('progress') && selectedGoal && (
              <section className="az-exp-panel" aria-label="Выбранная цель" role="status">
                <h3>Ваша цель: {selectedGoal.title}</h3>
                <p>{selectedGoal.nextStep}</p>
                <p>Это общий совет по выбранной цели. Каталог ниже одинаков для всех целей.</p>
              </section>
            )}
            <SectionTitle title="Обучение и клуб" />
            {courses.map((e) => (
              <EntityCard key={e.id} entity={e} />
            ))}
            <SectionTitle title="Практика с обратной связью" />
            {lessons.slice(0, 3).map((e) => (
              <EntityCard key={e.id} entity={e} />
            ))}
            <p>
              Откройте урок, выполните задание и отправьте работу наставнику. Решение о проверке сохраняется сервером.
            </p>
            {events.map((e) => (
              <EntityCard key={e.id} entity={e} />
            ))}
          </>
        )}
      </div>
    </>
  )
}
