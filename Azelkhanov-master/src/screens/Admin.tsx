import { useState } from 'react'
import {
  BarChart3,
  Check,
  Download,
  Edit3,
  FileDown,
  Gift,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { usePlatform } from '../platform/store.ts'
import { modules } from '../platform/config.ts'
import { encodeCsv, parseCsv } from '../platform/csv.ts'
import type { Data, Entity, EntityKind, Json, ModuleId, Role } from '../platform/contracts.ts'
import { Art, Button, Empty, Modal, PageHeader, SectionTitle, money } from '../components/ui.tsx'
import Operations from './Operations.tsx'
import { demoMode } from '../platform/client.ts'

const roles: Role[] = [
  'owner',
  'admin',
  'editor',
  'campaign_manager',
  'moderator',
  'mentor',
  'analyst',
  'cashier',
  'member',
]
const roleNames: Record<Role, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  editor: 'Редактор',
  campaign_manager: 'Менеджер кампаний',
  moderator: 'Модератор',
  mentor: 'Наставник',
  analyst: 'Аналитик',
  cashier: 'Кассир',
  member: 'Участник',
}
const kindNames: Record<EntityKind, string> = {
  article: 'Статья',
  story: 'История',
  video: 'Видео',
  file: 'Файл',
  course: 'Курс',
  lesson: 'Урок',
  campaign: 'Кампания',
  mission: 'Задание',
  reward: 'Подарок',
  product: 'Товар',
  service: 'Услуга',
  event: 'Событие',
  slot: 'Временной слот',
  team: 'Команда',
  poll: 'Опрос',
  program: 'Программа',
}
function download(text: string, name: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function Admin() {
  const s = usePlatform((v) => v.snapshot!),
    [tab, setTab] = useState('overview')
  const owner = ['owner', 'admin'].includes(s.me.role)
  const available = [
    ['overview', 'Обзор', owner || s.me.role === 'analyst'],
    ['entities', 'Материалы', owner || ['editor', 'campaign_manager'].includes(s.me.role)],
    ['members', 'Участники', owner],
    ['orders', 'Заказы', owner || s.me.role === 'cashier'],
    ['payments', 'Stars', owner && s.config.modules.includes('learning')],
    ['queue', 'Очередь', s.config.modules.includes('retention') && (owner || s.me.role === 'campaign_manager')],
    ['cashier', 'Касса', owner || ['cashier', 'campaign_manager'].includes(s.me.role)],
    ['homework', 'Практика', owner || s.me.role === 'mentor'],
    ['moderation', 'Сообщество', owner || s.me.role === 'moderator'],
    ['notifications', 'Рассылки', owner || s.me.role === 'campaign_manager'],
    ['audit', 'Журнал', owner || s.me.role === 'analyst'],
  ] as const
  const active = available.find((t) => t[0] === tab && t[2])?.[0] ?? available.find((t) => t[2])?.[0]
  return (
    <>
      <PageHeader title="Управление" subtitle={`${roleNames[s.me.role]} · ${s.config.name}`} />
      <div className="az-admin">
        {s.config.modules.includes('commerce') && (owner || s.me.role === 'editor') && (
          <Button tone="soft" onClick={() => usePlatform.getState().push({ type: 'project-admin' })}>
            Проекты клиентов
          </Button>
        )}
        <div className="az-admin-tabs">
          {available
            .filter((t) => t[2])
            .map(([id, label]) => (
              <button key={id} className={active === id ? 'is-active' : ''} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
        </div>
        {!active ? (
          <Empty title="Нет доступа к управлению" body="Обратитесь к владельцу пространства." />
        ) : active === 'overview' ? (
          <Overview />
        ) : active === 'entities' ? (
          <Entities />
        ) : active === 'members' ? (
          <Members />
        ) : active === 'orders' ? (
          <Orders />
        ) : active === 'payments' ? (
          <Operations payments />
        ) : active === 'queue' ? (
          <Operations />
        ) : active === 'cashier' ? (
          <Cashier />
        ) : active === 'homework' ? (
          <Homeworks />
        ) : active === 'moderation' ? (
          <Moderation />
        ) : active === 'notifications' ? (
          <Broadcast />
        ) : (
          <Audit />
        )}
      </div>
    </>
  )
}
function Overview() {
  const s = usePlatform((v) => v.snapshot!)
  const a = s.analytics
  const values = [
    ['Участники', a?.members ?? s.members.length],
    ['Завершения заданий', a?.completions ?? s.progress.length],
    ['Бронирования', a?.bookings ?? s.bookings.length],
    ['Оплачено Stars', a?.paidStars ?? 0],
  ]
  const exportReport = () =>
    download(encodeCsv(values.map(([metric, value]) => ({ metric, value }))), `${s.config.id}-summary.csv`)
  return (
    <>
      <div className="az-admin-kpis">
        {values.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>по доступным данным пространства</small>
          </div>
        ))}
      </div>
      {a && (
        <div className="az-panel">
          <h3>Возвращаются к вам</h3>
          <div className="az-admin-metric">
            <span>Активны за 24 часа / 7 дней</span>
            <b>
              {a.active1d} / {a.active7d}
            </b>
          </div>
          {(['day1', 'day7'] as const).map((key) => (
            <div className="az-admin-metric" key={key}>
              <span>
                Удержание {key === 'day1' ? 'D1' : 'D7'} · {a.retention[key].eligible} участников в когорте
              </span>
              <b>
                {a.retention[key].rate === null
                  ? 'Недостаточно данных'
                  : `${Math.round(a.retention[key].rate! * 100)}%`}
              </b>
            </div>
          ))}
        </div>
      )}
      <div className="az-panel">
        <SectionTitle title="Что объединяет людей" />
        <div className="az-analytics-bars">
          {modules
            .filter((m) => s.config.modules.includes(m.id))
            .map((m) => {
              const count = s.progress.filter(
                (p) => s.entities.find((e) => e.id === p.entityId)?.module === m.id,
              ).length
              return (
                <div key={m.id}>
                  <span>{m.title}</span>
                  <div>
                    <i style={{ width: `${Math.max(2, (count / Math.max(1, s.progress.length)) * 100)}%` }} />
                  </div>
                  <b>{count}</b>
                </div>
              )
            })}
        </div>
        <Button tone="soft" onClick={exportReport}>
          Скачать сводку
          <Download size={17} />
        </Button>
      </div>
      <div className="az-admin-grid">
        <div className="az-panel">
          <h3>Путь участника</h3>
          {(a
            ? a.funnel.map((f) => [
                (
                  {
                    verified: 'Подтвердили вход',
                    completed: 'Выполнили задание',
                    reward_claimed: 'Получили купон',
                    ordered: 'Оформили заказ',
                    paid: 'Оплатили Stars',
                  } as Record<string, string>
                )[f.stage] ?? f.stage,
                f.count,
              ])
            : [
                ['Участники', s.members.length],
                ['Завершения заданий', s.progress.length],
                ['Выданные купоны', s.coupons.length],
                ['Погашенные купоны', s.coupons.filter((c) => c.status === 'redeemed').length],
              ]
          ).map(([label, n]) => (
            <div className="az-admin-metric" key={label}>
              <span>{label}</span>
              <b>{n}</b>
            </div>
          ))}
        </div>
        <div className="az-panel">
          <h3>Кампании</h3>
          {s.entities
            .filter((e) => e.kind === 'campaign')
            .map((e) => (
              <div className="az-admin-metric" key={e.id}>
                <span>{e.title}</span>
                <b>
                  {a?.campaigns.find((c) => c.id === e.id)?.completions ??
                    s.progress.filter((p) => p.campaignId === e.id).length}
                </b>
              </div>
            ))}
        </div>
      </div>
      <p className="az-admin-hint">
        Счётчики рассчитаны по событиям и операциям, доступным вашей роли. Демонстрационные данные не являются
        статистикой действующих клиентов.
      </p>
    </>
  )
}
function Entities() {
  const { snapshot: s, act, message } = usePlatform(),
    [edit, setEdit] = useState<Entity | null>(null),
    [module, setModule] = useState('all'),
    [query, setQuery] = useState('')
  if (!s) return null
  const allowed = modules.filter(
    (m) => s.config.modules.includes(m.id) && (['owner', 'admin'].includes(s.me.role) || m.roles.includes(s.me.role)),
  )
  const list = s.entities.filter(
    (e) =>
      (module === 'all' || e.module === module) &&
      allowed.some((m) => m.id === e.module) &&
      e.title.toLowerCase().includes(query.toLowerCase()),
  )
  const create = () => {
    const m = allowed.find((m) => m.entities.length)
    if (!m) return
    setEdit({
      id: crypto.randomUUID(),
      kind: m.entities[0],
      module: m.id,
      title: '',
      subtitle: '',
      body: '',
      tag: 'НОВОЕ',
      cover: 'orbit',
      published: false,
      publishAt: null,
      audience: 'all',
      price: 0,
      capacity: null,
      data: {},
    })
  }
  const importFile = async (file: File) => {
    try {
      const rows = parseCsv(await file.text())
      let count = 0
      for (const row of rows) {
        const kind = row.kind as EntityKind
        const definition = allowed.find((m) => m.entities.includes(kind))
        if (!definition) throw new Error(`Недоступный вид: ${row.kind}`)
        const entity: Entity = {
          id: row.id || crypto.randomUUID(),
          kind,
          module: definition.id,
          title: row.title ?? '',
          subtitle: row.subtitle ?? '',
          body: row.body ?? '',
          tag: row.tag ?? '',
          cover: row.cover || 'orbit',
          published: row.published === 'true',
          publishAt: row.publishAt || null,
          audience: ['all', 'members', 'employees'].includes(row.audience)
            ? (row.audience as Entity['audience'])
            : 'all',
          price: Number(row.price || 0),
          capacity: row.capacity ? Number(row.capacity) : null,
          data: row.data ? JSON.parse(row.data) : {},
        }
        if (!(await act('admin.entity.save', { entity: entity as unknown as Data })))
          throw new Error(`Остановлено на строке ${count + 1}`)
        count++
      }
      message(`Импортировано: ${count}`)
    } catch (e) {
      message(e instanceof Error ? e.message : 'Проверьте CSV-файл')
    }
  }
  return (
    <>
      <div className="az-admin-toolbar">
        <label className="az-search">
          <Search size={17} />
          <input
            aria-label="Поиск материалов"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти материал"
          />
        </label>
        <select aria-label="Модуль материалов" value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="all">Все модули</option>
          {allowed.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <Button onClick={create}>
          <Plus size={18} />
          Создать
        </Button>
      </div>
      <div className="az-admin-transfer">
        <Button
          tone="soft"
          onClick={() => download(encodeCsv(list.map((e) => ({ ...e, data: e.data }))), `${s.config.id}-materials.csv`)}
        >
          <Download size={15} />
          Экспорт CSV
        </Button>
        <label className="az-file-label">
          <Upload size={15} />
          Импорт CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importFile(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      <div className="az-admin-entities">
        {list.map((e) => (
          <div key={e.id}>
            <Art kind={e.cover} />
            <div>
              <span className="az-eyebrow">{kindNames[e.kind]}</span>
              <h3>{e.title}</h3>
              <span className={`az-status ${e.published ? '' : 'az-status-muted'}`}>
                {e.publishAt && new Date(e.publishAt) > new Date()
                  ? 'По расписанию'
                  : e.published
                    ? 'Опубликован'
                    : 'Черновик'}
              </span>
            </div>
            <button
              aria-label={`Редактировать ${e.title}`}
              onClick={async () => {
                const r = await act('admin.entity.get', { entityId: e.id })
                setEdit((r?.entity as unknown as Entity) || e)
              }}
            >
              <Edit3 size={18} />
            </button>
            <button
              aria-label={`Удалить ${e.title}`}
              onClick={() => {
                if (confirm(`Удалить «${e.title}»? Материалы с историей использования удалены не будут.`))
                  void act('admin.entity.delete', { entityId: e.id })
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
      {edit && (
        <EntityEditor
          entity={edit}
          onClose={() => setEdit(null)}
          onSave={async (entity) => {
            if (await act('admin.entity.save', { entity: entity as unknown as Data })) {
              setEdit(null)
              message('Изменения сохранены')
            }
          }}
        />
      )}
    </>
  )
}
function toLocalInput(value: unknown) {
  const date = new Date(String(value ?? ''))
  return Number.isNaN(date.getTime())
    ? ''
    : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function EntityEditor({
  entity,
  onClose,
  onSave,
}: {
  entity: Entity
  onClose: () => void
  onSave: (e: Entity) => Promise<void>
}) {
  const [e, set] = useState<Entity>(structuredClone(entity)),
    [questions, setQuestions] = useState(
      (entity.data.questions ?? []) as { question: string; options: string[]; correct: number; explain: string }[],
    ),
    [advanced, setAdvanced] = useState(JSON.stringify(entity.data, null, 2)),
    [advancedEdited, setAdvancedEdited] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState('')
  const s = usePlatform((v) => v.snapshot!),
    busy = usePlatform((v) => v.busy),
    act = usePlatform((v) => v.act)
  const uploadContent = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) return setError('Максимальный размер файла — 10 МБ')
    setUploading(true)
    setError('')
    try {
      if (demoMode()) {
        set((prev) => ({ ...prev, data: { ...prev.data, fileLabel: `Демо-файл: ${file.name}` } }))
        return
      }
      const result = await act('file.upload-url', { filename: file.name, contentType: file.type, purpose: 'content' })
      if (!result) return
      const response = await fetch(String(result.url), {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!response.ok) throw new Error('Не удалось загрузить файл')
      set((prev) => ({ ...prev, data: { ...prev.data, fileId: String(result.fileId), fileLabel: file.name } }))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }
  const field = <K extends keyof Entity>(key: K, value: Entity[K]) => set({ ...e, [key]: value })
  const data = (key: string, value: Json) => set({ ...e, data: { ...e.data, [key]: value } })
  const save = async () => {
    try {
      const extra = advancedEdited ? JSON.parse(advanced) : e.data
      const updated = { ...e, data: { ...extra, ...(['lesson', 'mission'].includes(e.kind) ? { questions } : {}) } }
      if (!updated.title.trim()) throw new Error('Введите название')
      if (updated.published && ['campaign', 'event', 'slot'].includes(updated.kind) && !updated.data.startsAt)
        throw new Error('Укажите дату начала')
      await onSave(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Проверьте поля')
    }
  }
  const type = (kind: EntityKind) => {
    const m = modules.find((m) => m.entities.includes(kind))!
    set({ ...e, kind, module: m.id })
  }
  return (
    <Modal title={entity.title ? 'Редактировать материал' : 'Создать материал'} onClose={onClose}>
      <div className="az-editor">
        <p className="az-admin-hint">
          Время в редакторе: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Участники увидят время своего
          пространства.
        </p>
        <label>
          Тип материала
          <select value={e.kind} onChange={(ev) => type(ev.target.value as EntityKind)}>
            {Object.entries(kindNames)
              .filter(([id]) =>
                modules.some(
                  (m) =>
                    s.config.modules.includes(m.id) &&
                    m.entities.includes(id as EntityKind) &&
                    (['owner', 'admin'].includes(s.me.role) || m.roles.includes(s.me.role)),
                ),
              )
              .map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Название
          <input value={e.title} onChange={(ev) => field('title', ev.target.value)} required />
        </label>
        <label>
          Короткое описание
          <input value={e.subtitle} onChange={(ev) => field('subtitle', ev.target.value)} />
        </label>
        <label>
          Метка на карточке
          <input value={e.tag} onChange={(ev) => field('tag', ev.target.value)} />
        </label>
        {['video', 'lesson'].includes(e.kind) && (
          <label>
            Ссылка на видео (HTTPS)
            <input
              type="url"
              value={String(e.data.url ?? '')}
              onChange={(ev) => data('url', ev.target.value)}
              placeholder="https://…/lesson.mp4"
            />
          </label>
        )}
        {e.kind === 'file' && (
          <label>
            Закрытый материал
            <input
              type="file"
              disabled={uploading}
              accept=".pdf,.txt,.jpg,.jpeg,.png,.webp"
              onChange={(ev) => {
                const file = ev.target.files?.[0]
                if (file) void uploadContent(file)
              }}
            />
            <small>
              {uploading ? 'Загружаем…' : String(e.data.fileLabel ?? 'PDF, текст или изображение · до 10 МБ')}
            </small>
          </label>
        )}
        {e.kind === 'product' && (
          <label>
            Варианты — название | цена, каждый с новой строки
            <textarea
              value={((e.data.variants ?? []) as { name: string; price: number }[])
                .map((v) => `${v.name} | ${v.price}`)
                .join('\n')}
              onChange={(ev) =>
                data(
                  'variants',
                  ev.target.value
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                      const [name, price] = line.split('|')
                      return { name: name.trim(), price: Number(price ?? e.price) }
                    }),
                )
              }
            />
          </label>
        )}
        <label>
          Текст материала
          <textarea
            rows={7}
            value={e.body}
            onChange={(ev) => field('body', ev.target.value)}
            placeholder="Поддерживается Markdown"
          />
        </label>
        <div className="az-editor-pair">
          <label>
            Обложка
            <select value={e.cover} onChange={(ev) => field('cover', ev.target.value)}>
              {['orbit', 'cobalt', 'lime', 'peach', 'lilac', 'flower', 'gift', 'cup', 'bag', 'ticket', 'notebook'].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Аудитория
            <select value={e.audience} onChange={(ev) => field('audience', ev.target.value as Entity['audience'])}>
              <option value="all">Все</option>
              <option value="members">Участники</option>
              <option value="employees">Сотрудники</option>
            </select>
          </label>
        </div>
        <label>
          Команда
          <select value={e.teamId ?? ''} onChange={(ev) => field('teamId', ev.target.value || null)}>
            <option value="">Все команды</option>
            {s.entities
              .filter((v) => v.kind === 'team')
              .map((t) => (
                <option value={t.id} key={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
        </label>
        {['course', 'product', 'service', 'reward'].includes(e.kind) && (
          <label>
            {e.kind === 'course' ? 'Цена в Stars' : e.kind === 'reward' ? 'Стоимость в баллах' : 'Цена'}
            <input
              type="number"
              min={0}
              value={e.price}
              onChange={(ev) => {
                const price = Number(ev.target.value)
                set({ ...e, price, data: { ...e.data, ...(e.kind === 'reward' ? { pointsCost: price } : {}) } })
              }}
            />
          </label>
        )}
        {['reward', 'product', 'event', 'slot'].includes(e.kind) && (
          <label>
            Лимит / количество мест
            <input
              type="number"
              min={0}
              value={e.capacity ?? ''}
              placeholder="Без ограничения"
              onChange={(ev) => field('capacity', ev.target.value ? Number(ev.target.value) : null)}
            />
          </label>
        )}
        {e.kind === 'lesson' && (
          <div className="az-editor-pair">
            <label>
              Курс
              <select value={String(e.data.courseId ?? '')} onChange={(ev) => data('courseId', ev.target.value)}>
                <option value="">Выберите курс</option>
                {s.entities
                  .filter((v) => v.kind === 'course')
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Порядок урока
              <input
                type="number"
                min={1}
                value={Number(e.data.order ?? 1)}
                onChange={(ev) => data('order', Number(ev.target.value))}
              />
            </label>
          </div>
        )}
        {e.kind === 'mission' && (
          <>
            <label>
              Кампания
              <select value={String(e.data.campaignId ?? '')} onChange={(ev) => data('campaignId', ev.target.value)}>
                <option value="">Выберите кампанию</option>
                {s.entities
                  .filter((v) => v.kind === 'campaign')
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
              </select>
            </label>
            <div className="az-editor-pair">
              <label>
                Номер дня
                <input
                  type="number"
                  min={1}
                  value={Number(e.data.day ?? 1)}
                  onChange={(ev) => data('day', Number(ev.target.value))}
                />
              </label>
              <label>
                Механика
                <select value={String(e.data.game ?? 'quiz')} onChange={(ev) => data('game', ev.target.value)}>
                  {[
                    ['quiz', 'Квиз'],
                    ['scratch', 'Скретч'],
                    ['wheel', 'Колесо'],
                    ['memory', 'Найди пару'],
                    ['reaction', 'Реакция'],
                    ['arcade', 'Аркада'],
                  ].map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
        {['lesson', 'mission'].includes(e.kind) && (
          <>
            <p className="az-admin-hint">Баллы начисляются по правилам программы.</p>
            <SectionTitle title="Вопросы квиза" />
            {questions.map((q, i) => (
              <div className="az-question-editor" key={i}>
                <label>
                  Вопрос {i + 1}
                  <input
                    value={q.question}
                    onChange={(ev) =>
                      setQuestions(questions.map((v, n) => (n === i ? { ...v, question: ev.target.value } : v)))
                    }
                  />
                </label>
                <label>
                  Ответы — каждый с новой строки
                  <textarea
                    value={q.options.join('\n')}
                    onChange={(ev) =>
                      setQuestions(
                        questions.map((v, n) => (n === i ? { ...v, options: ev.target.value.split('\n') } : v)),
                      )
                    }
                  />
                </label>
                <label>
                  Верный ответ
                  <select
                    value={q.correct}
                    onChange={(ev) =>
                      setQuestions(questions.map((v, n) => (n === i ? { ...v, correct: Number(ev.target.value) } : v)))
                    }
                  >
                    {q.options.map((v, n) => (
                      <option key={n} value={n}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Объяснение
                  <textarea
                    value={q.explain}
                    onChange={(ev) =>
                      setQuestions(questions.map((v, n) => (n === i ? { ...v, explain: ev.target.value } : v)))
                    }
                  />
                </label>
                <Button tone="soft" onClick={() => setQuestions(questions.filter((_, n) => n !== i))}>
                  Удалить вопрос
                </Button>
              </div>
            ))}
            <Button
              tone="soft"
              onClick={() => setQuestions([...questions, { question: '', options: ['', ''], correct: 0, explain: '' }])}
            >
              <Plus size={16} />
              Добавить вопрос
            </Button>
          </>
        )}
        {['event', 'slot'].includes(e.kind) && (
          <>
            <label>
              Дата и время встречи
              <input
                type="datetime-local"
                value={toLocalInput(e.data.startsAt)}
                onChange={(ev) => data('startsAt', ev.target.value ? new Date(ev.target.value).toISOString() : '')}
              />
            </label>
            <label>
              Место
              <input value={String(e.data.location ?? '')} onChange={(ev) => data('location', ev.target.value)} />
            </label>
            <label>
              Программа — по строкам
              <textarea
                value={((e.data.agenda as string[]) ?? []).join('\n')}
                onChange={(ev) => data('agenda', ev.target.value.split('\n'))}
              />
            </label>
          </>
        )}
        {e.kind === 'campaign' && (
          <>
            <label>
              Количество дней
              <input
                type="number"
                min={1}
                max={60}
                value={Number(e.data.days ?? 24)}
                onChange={(ev) => data('days', Number(ev.target.value))}
              />
            </label>
            <label>
              Начало
              <input
                type="datetime-local"
                value={toLocalInput(e.data.startsAt)}
                onChange={(ev) => data('startsAt', ev.target.value ? new Date(ev.target.value).toISOString() : '')}
              />
            </label>
            <label>
              Окончание
              <input
                type="datetime-local"
                value={toLocalInput(e.data.endsAt)}
                onChange={(ev) => data('endsAt', ev.target.value ? new Date(ev.target.value).toISOString() : '')}
              />
            </label>
          </>
        )}
        <label className="az-checkbox">
          <input type="checkbox" checked={e.published} onChange={(ev) => field('published', ev.target.checked)} />
          Опубликовать
        </label>
        <label>
          Дата публикации (пусто — сразу)
          <input
            type="datetime-local"
            value={toLocalInput(e.publishAt)}
            onChange={(ev) => field('publishAt', ev.target.value ? new Date(ev.target.value).toISOString() : null)}
          />
        </label>
        <details>
          <summary>Расширенные параметры материала</summary>
          <p className="az-admin-hint">
            Для подготовки новых шаблонов. Содержимое сохраняется как настройки выбранного материала.
          </p>
          <textarea
            className="az-code-input"
            rows={10}
            value={advanced}
            onChange={(ev) => {
              setAdvanced(ev.target.value)
              setAdvancedEdited(true)
            }}
          />
        </details>
        {error && (
          <p role="alert" className="az-error-text">
            {error}
          </p>
        )}
        <Button disabled={busy || uploading} onClick={() => void save()}>
          Сохранить изменения
          <Check size={17} />
        </Button>
      </div>
    </Modal>
  )
}
function Members() {
  const { snapshot: s, act, message } = usePlatform(),
    [query, setQuery] = useState(''),
    [delta, setDelta] = useState('25'),
    [reason, setReason] = useState('За участие'),
    [user, setUser] = useState('')
  if (!s) return null
  const importMembers = async (file: File) => {
    try {
      const rows = parseCsv(await file.text())
      let count = 0
      for (const row of rows) {
        if (!/^\d+$/.test(row.id ?? '')) throw new Error('Нужен числовой Telegram ID')
        if (
          !(await act('admin.member.update', {
            userId: row.id,
            role: 'member',
            teamId: row.teamId || null,
            approved: row.approved !== 'false',
          }))
        )
          throw new Error(`Остановлено на строке ${count + 1}`)
        count++
      }
      message(`Обработано участников: ${count}`)
    } catch (e) {
      message(e instanceof Error ? e.message : 'Проверьте CSV')
    }
  }
  return (
    <>
      <div className="az-admin-toolbar">
        <label className="az-search">
          <Search size={17} />
          <input
            aria-label="Поиск участника"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Участник или Telegram ID"
          />
        </label>
        <Button
          tone="soft"
          onClick={() => download(encodeCsv(s.members as unknown as Record<string, unknown>[]), 'members.csv')}
        >
          <Download size={16} />
          Экспорт
        </Button>
        <label className="az-file-label">
          <Upload size={16} />
          Импорт сотрудников
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importMembers(f)
            }}
          />
        </label>
      </div>
      <div className="az-members-list">
        {s.members
          .filter((m) => (m.name + ' ' + m.id).toLowerCase().includes(query.toLowerCase()))
          .map((m) => (
            <div key={m.id}>
              <span className="az-avatar">{m.name[0]}</span>
              <div>
                <strong>{m.name}</strong>
                <small>
                  {m.id} · {m.xp} XP · {m.points} баллов
                </small>
              </div>
              <select
                aria-label={`Роль ${m.name}`}
                value={m.role}
                disabled={m.id === s.me.id || s.me.role !== 'owner'}
                onChange={(e) => void act('admin.member.update', { userId: m.id, role: e.target.value })}
              >
                {roles.map((r) => (
                  <option value={r} key={r}>
                    {roleNames[r]}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Команда ${m.name}`}
                value={m.teamId ?? ''}
                onChange={(e) => void act('admin.member.update', { userId: m.id, teamId: e.target.value || null })}
              >
                <option value="">Без команды</option>
                {s.entities
                  .filter((e) => e.kind === 'team')
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
              </select>
              <label className="az-checkbox">
                <input
                  aria-label={`Одобрить ${m.name}`}
                  type="checkbox"
                  checked={m.approved}
                  onChange={(e) => void act('admin.member.update', { userId: m.id, approved: e.target.checked })}
                />
                Одобрен
              </label>
            </div>
          ))}
      </div>
      <div className="az-panel">
        <h3>Начисление и корректировка баллов</h3>
        <label>
          Участник
          <select value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="">Выберите участника</option>
            {s.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <div className="az-editor-pair">
          <label>
            Количество
            <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} />
          </label>
          <label>
            Основание
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        </div>
        <Button
          disabled={!user || !reason.trim()}
          onClick={async () => {
            if (
              await act('admin.points.adjust', { userId: user, delta: Number(delta), reason, ref: crypto.randomUUID() })
            )
              message('Операция записана в журнал')
          }}
        >
          Провести операцию
          <Check size={17} />
        </Button>
      </div>
    </>
  )
}
function Orders() {
  const { snapshot: s, act } = usePlatform()
  if (!s) return null
  return (
    <>
      {!s.orders.length && (
        <Empty title="Первые заказы ещё впереди" body="Как только участник оформит заказ, он появится здесь." />
      )}
      {s.orders.map((o) => (
        <div className="az-panel" key={o.id}>
          <span className="az-eyebrow">ЗАКАЗ {o.id.slice(0, 8)}</span>
          <h3>
            {s.members.find((m) => m.id === o.userId)?.name ?? o.userId} · {money(o.total, s.config.currency)}
          </h3>
          {o.items.map((i, n) => (
            <p key={n}>
              {s.entities.find((e) => e.id === i.entityId)?.title ?? i.entityId} · {i.variant} × {i.quantity}
            </p>
          ))}
          <p>{o.note}</p>
          <select
            aria-label="Статус заказа"
            value={o.status}
            onChange={(e) => void act('admin.order.update', { orderId: o.id, status: e.target.value })}
          >
            {[
              ['new', 'Новый'],
              ['accepted', 'Подтверждён'],
              ['ready', 'Готов к получению'],
              ['completed', 'Завершён'],
              ['cancelled', 'Отменён'],
            ].map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      ))}
    </>
  )
}
export function Cashier() {
  const { act, message } = usePlatform(),
    [code, setCode] = useState(''),
    [point, setPoint] = useState('main'),
    [user, setUser] = useState('')
  return (
    <div className="az-cashier">
      <div className="az-panel">
        <span className="az-eyebrow">ПОЛУЧЕНИЕ ПОДАРКОВ И РЕГИСТРАЦИЯ</span>
        <h2>Хороший момент — здесь.</h2>
        <p>Введите код участника. Операция проверяется сервером и записывается один раз.</p>
        <label>
          Точка
          <input aria-label="Точка погашения" value={point} onChange={(e) => setPoint(e.target.value)} />
        </label>
        <label>
          Код купона или билета
          <input
            aria-label="Код купона или билета"
            className="az-code-entry"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="AZ-XXXXXXXX"
          />
        </label>
        <Button
          disabled={!code.trim() || !point.trim()}
          onClick={async () => {
            const action = code.startsWith('EV-') ? 'event.checkin' : 'coupon.redeem'
            if (await act(action, { code: code.trim(), pointId: point })) {
              setCode('')
              message('Готово. Хорошего дня!')
            }
          }}
        >
          Проверить и подтвердить
          <ShieldCheck size={18} />
        </Button>
      </div>
      <div className="az-panel">
        <h3>Отметить визит участника</h3>
        <label>
          Telegram ID или данные клубной карты
          <input
            aria-label="ID участника для визита"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="AZ-MEMBER:123456789"
          />
        </label>
        <Button
          tone="dark"
          disabled={!user.trim()}
          onClick={async () => {
            if (await act('admin.visit', { userId: user.replace(/^AZ-MEMBER:/, '').trim() })) {
              setUser('')
              message('Визит отмечен')
            }
          }}
        >
          Подтвердить визит
          <Check size={17} />
        </Button>
      </div>
    </div>
  )
}
function Homeworks() {
  const { snapshot: s, act } = usePlatform(),
    [feedback, setFeedback] = useState<Record<string, string>>({})
  if (!s) return null
  return (
    <>
      {!s.homework.length && (
        <Empty title="Здесь появятся первые работы" body="Участники отправляют практику из страницы урока." />
      )}
      {s.homework.map((h) => (
        <div className="az-panel" key={h.id}>
          <span className="az-eyebrow">
            {h.status === 'approved' ? 'ПРИНЯТО' : h.status === 'revision' ? 'НА ДОРАБОТКЕ' : 'ЖДЁТ ПРОВЕРКИ'}
          </span>
          <h3>
            {s.members.find((m) => m.id === h.userId)?.name ?? h.userId} ·{' '}
            {s.entities.find((e) => e.id === h.lessonId)?.title}
          </h3>
          <p>{h.body}</p>
          {h.file && (
            <Button
              tone="soft"
              onClick={async () => {
                if (h.file.startsWith('Демо-файл:')) return usePlatform.getState().message(h.file)
                const r = await act('file.download-url', { fileId: h.file })
                if (r?.url) window.open(String(r.url), '_blank', 'noopener,noreferrer')
              }}
            >
              <Download size={16} />
              Открыть файл работы
            </Button>
          )}
          <textarea
            aria-label="Обратная связь наставника"
            value={feedback[h.id] ?? h.feedback}
            onChange={(e) => setFeedback({ ...feedback, [h.id]: e.target.value })}
            placeholder="Что получилось и какой следующий шаг?"
          />
          <div className="az-editor-pair">
            <Button
              tone="lime"
              onClick={() =>
                void act('homework.review', {
                  homeworkId: h.id,
                  status: 'approved',
                  feedback: feedback[h.id] ?? h.feedback,
                })
              }
            >
              Принять
              <Check size={17} />
            </Button>
            <Button
              tone="soft"
              onClick={() =>
                void act('homework.review', {
                  homeworkId: h.id,
                  status: 'revision',
                  feedback: feedback[h.id] ?? h.feedback,
                })
              }
            >
              На доработку
            </Button>
          </div>
        </div>
      ))}
    </>
  )
}
function Moderation() {
  const { snapshot: s, act } = usePlatform()
  if (!s) return null
  return (
    <>
      {s.posts.map((p) => (
        <div className="az-panel" key={p.id}>
          <span className="az-eyebrow">
            {p.status} · {p.topic}
          </span>
          <h3>{p.name}</h3>
          <p>{p.body}</p>
          <div className="az-editor-pair">
            <Button tone="soft" onClick={() => void act('admin.post.moderate', { postId: p.id, status: 'hidden' })}>
              Скрыть
            </Button>
            <Button onClick={() => void act('admin.post.moderate', { postId: p.id, status: 'published' })}>
              Опубликовать
              <Check size={17} />
            </Button>
          </div>
        </div>
      ))}
    </>
  )
}
function Broadcast() {
  const { act, message } = usePlatform(),
    [title, setTitle] = useState(''),
    [body, setBody] = useState(''),
    [segment, setSegment] = useState('all')
  return (
    <div className="az-panel">
      <span className="az-eyebrow">ХОРОШИЕ НОВОСТИ ВОВРЕМЯ</span>
      <h2>Есть чем поделиться?</h2>
      <label>
        Кому
        <select value={segment} onChange={(e) => setSegment(e.target.value)}>
          <option value="all">Всем с разрешением на уведомления</option>
          <option value="active">Активным участникам</option>
          <option value="inactive">Тем, кто давно не заходил</option>
        </select>
      </label>
      <label>
        Заголовок
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Сообщение
        <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <p className="az-admin-hint">
        Отправка через очередь с учётом согласия и тихих часов. В демонстрации создаются только локальные уведомления.
      </p>
      <Button
        disabled={!title.trim() || !body.trim()}
        onClick={async () => {
          if (await act('admin.notification.enqueue', { title, body, segment })) {
            setTitle('')
            setBody('')
            message('Рассылка добавлена в очередь')
          }
        }}
      >
        Поставить в очередь
        <Send size={17} />
      </Button>
    </div>
  )
}
function Audit() {
  const s = usePlatform((v) => v.snapshot!)
  return (
    <>
      <div className="az-admin-transfer">
        <Button
          tone="soft"
          onClick={() => download(encodeCsv(s.audit as unknown as Record<string, unknown>[]), 'audit.csv')}
        >
          <Download size={16} />
          Скачать журнал
        </Button>
      </div>
      <div className="az-audit">
        {s.audit.map((a) => (
          <div key={a.id}>
            <span>{new Date(a.createdAt).toLocaleString('ru')}</span>
            <strong>{a.action}</strong>
            <code>{a.targetId}</code>
            <small>{a.actorId}</small>
          </div>
        ))}
      </div>
      {!s.audit.length && <Empty title="История ещё впереди" body="Действия менеджеров появятся здесь." />}
    </>
  )
}
