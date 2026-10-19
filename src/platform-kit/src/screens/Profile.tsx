import {
  ArrowUpRight,
  Bell,
  Check,
  Copy,
  Download,
  Gift,
  LogOut,
  Moon,
  QrCode,
  Settings2,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Ticket,
  Users,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePlatform } from '../platform/store.ts'
import { demoMode } from '../platform/client.ts'
import type { BrandConfig } from '../platform/contracts.ts'
import { ArrowLink, Button, Modal, PageHeader, QR, SectionTitle, money } from '../components/ui.tsx'
import { MemberCard } from './Home.tsx'

export default function Profile({
  brand,
  dark,
  toggleTheme,
}: {
  brand: BrandConfig
  dark: boolean
  toggleTheme: () => void
}) {
  const { snapshot: s, push, act, message, celebrate } = usePlatform(),
    [qr, setQr] = useState(false),
    [sharing, setSharing] = useState(false)
  useEffect(() => {
    if (s && s.me.role !== 'member') void import('./Admin.tsx').catch(() => {})
  }, [s?.me.role])
  if (!s) return null
  const has = (id: string) => s.config.modules.includes(id as never)
  const share = async () => {
    const url = s.config.botUsername
      ? new URL(`https://t.me/${s.config.botUsername.replace(/^@/, '')}?startapp=ref_${s.me.id}`)
      : new URL(location.origin)
    if (!s.config.botUsername) {
      if (!demoMode()) return message('Организатор скоро добавит ссылку приглашения')
      url.searchParams.set('ref', s.me.id)
      url.searchParams.set('demo', '')
    }
    const text = `${brand.name}: хорошее начинается с людей. Присоединяйтесь к нашему кругу.`
    try {
      if (navigator.share) await navigator.share({ title: brand.name, text, url: url.toString() })
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        message('Приглашение скопировано')
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        message('Не удалось открыть меню. Скопируйте адрес приложения.')
    }
  }
  const card = async () => {
    setSharing(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1920
      const c = canvas.getContext('2d')!
      c.fillStyle = brand.colors.primary
      c.fillRect(0, 0, 1080, 1920)
      c.fillStyle = brand.colors.accent
      c.beginPath()
      c.arc(950, 600, 600, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = brand.colors.onPrimary ?? '#fff'
      c.font = 'bold 55px sans-serif'
      c.fillText(brand.name, 80, 140)
      c.fillStyle = brand.colors.ink
      c.font = 'bold 230px sans-serif'
      c.fillText('✳', 290, 760)
      c.fillStyle = '#fff'
      c.font = 'bold 88px sans-serif'
      c.fillText('Моя новая', 80, 1100)
      c.fillText('глава.', 80, 1200)
      c.font = 'bold 150px sans-serif'
      c.fillText(`${s.me.xp} XP`, 80, 1450)
      c.font = '38px sans-serif'
      c.fillText(s.me.name, 80, 1550)
      c.font = '28px sans-serif'
      c.fillText('GOOD THINGS ARE COMING.', 80, 1800)
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('image'))), 'image/png'),
      )
      const file = new File([blob], `${brand.id}-my-chapter.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Моя новая глава' })
      else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) message('Не удалось создать карточку')
    } finally {
      setSharing(false)
    }
  }
  return (
    <>
      <PageHeader title="Профиль" subtitle="Ваш прогресс, бонусы и настройки." />
      <div className="az-page-body">
        {has('loyalty') && <MemberCard brand={brand} />}
        <div className="az-profile-quick">
          {has('progress') && (
            <button onClick={() => push({ type: 'progress' })}>
              <Zap size={22} />
              <strong>{s.me.xp}</strong>
              <small>ваш прогресс</small>
            </button>
          )}
          {has('loyalty') && (
            <button onClick={() => push({ type: 'wallet' })}>
              <Gift size={22} />
              <strong>{s.coupons.filter((c) => c.userId === s.me.id).length}</strong>
              <small>подарки и купоны</small>
            </button>
          )}
          {has('loyalty') && (
            <button onClick={() => setQr(true)}>
              <QrCode size={22} />
              <strong>Карта</strong>
              <small>показать QR</small>
            </button>
          )}
        </div>
        <div className="az-profile-links">
          {has('loyalty') && (
            <ArrowLink onClick={() => push({ type: 'gifts' })}>
              <span>
                <Gift size={20} />
                Подарить своим
              </span>
            </ArrowLink>
          )}
          {has('progress') && (
            <ArrowLink onClick={() => push({ type: 'passport' })}>
              <span>
                <Sparkles size={20} />
                Паспорт впечатлений
              </span>
            </ArrowLink>
          )}
          {has('commerce') && (
            <ArrowLink onClick={() => push({ type: 'projects' })}>
              <span>
                <ShoppingBag size={20} />
                Кабинет клиента
              </span>
            </ArrowLink>
          )}
          {has('progress') && (
            <ArrowLink onClick={() => push({ type: 'recap' })}>
              <span>
                <Share2 size={20} />
                Итоги недели и сезона
              </span>
            </ArrowLink>
          )}
          {demoMode() && (
            <ArrowLink onClick={() => push({ type: 'industries' })}>
              <span>
                <Users size={20} />
                Отраслевые сценарии
              </span>
            </ArrowLink>
          )}

          {has('progress') && (
            <ArrowLink onClick={() => push({ type: 'progress' })}>
              <span>
                <Sparkles size={20} />
                Прогресс и достижения
              </span>
            </ArrowLink>
          )}
          {has('loyalty') && (
            <ArrowLink onClick={() => push({ type: 'wallet' })}>
              <span>
                <Gift size={20} />
                Кошелёк привилегий
              </span>
            </ArrowLink>
          )}
          {has('retention') && (
            <ArrowLink onClick={() => push({ type: 'retention' })}>
              <span>
                <Bell size={20} />
                Мои уведомления
              </span>
            </ArrowLink>
          )}
          {has('retention') && (
            <ArrowLink onClick={() => void share()}>
              <span>
                <Users size={20} />
                Пригласить своих людей
              </span>
            </ArrowLink>
          )}
          <ArrowLink onClick={() => void card()}>
            <span>
              <Share2 size={20} />
              {sharing ? 'Создаём вашу историю…' : 'Поделиться своей главой'}
            </span>
          </ArrowLink>
        </div>
        {s.orders.some((o) => o.userId === s.me.id) && (
          <>
            <SectionTitle title="Ваши хорошие покупки" />
            {s.orders
              .filter((o) => o.userId === s.me.id)
              .filter((o) => o.userId === s.me.id)
              .map((o) => (
                <div className="az-order" key={o.id}>
                  <div>
                    <span className="az-eyebrow">ЗАКАЗ {o.id.slice(0, 6).toUpperCase()}</span>
                    <strong>{money(o.total, s.config.currency)}</strong>
                  </div>
                  <span className="az-status">
                    {
                      {
                        new: 'Принят',
                        accepted: 'Подтверждён',
                        ready: 'Готов к получению',
                        completed: 'Получен',
                        cancelled: 'Отменён',
                      }[o.status]
                    }
                  </span>
                  <p>{o.items.map((i) => s.entities.find((e) => e.id === i.entityId)?.title ?? 'Товар').join(', ')}</p>
                </div>
              ))}
          </>
        )}
        {s.bookings.some((b) => b.userId === s.me.id && b.status !== 'cancelled') && (
          <>
            <SectionTitle title="Хорошие планы" />
            {s.bookings
              .filter((b) => b.userId === s.me.id && b.status !== 'cancelled')
              .map((b) => (
                <ArrowLink key={b.id} onClick={() => push({ type: 'entity', id: b.entityId })}>
                  <span>
                    <Ticket size={20} />
                    {s.entities.find((e) => e.id === b.entityId)?.title ?? 'Ваша встреча'}
                  </span>
                </ArrowLink>
              ))}
          </>
        )}
        <SectionTitle title="Настройки" />
        <div className="az-preferences">
          <button onClick={toggleTheme} aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}>
            <span>{dark ? <Moon size={20} /> : <Sun size={20} />}Оформление</span>
            <b>{dark ? 'Тёмная тема' : 'Светлая тема'}</b>
          </button>
          <label>
            <span>
              <Bell size={20} />
              Хорошие новости от клуба
            </span>
            <input
              aria-label="Получать уведомления"
              type="checkbox"
              checked={s.me.notificationOptIn}
              onChange={(e) => void act('profile.update', { notificationOptIn: e.target.checked })}
            />
          </label>
          <div className="az-quiet-hours">
            <span>Тихие часы</span>
            <select
              aria-label="Начало тихих часов"
              value={s.me.quietFrom}
              onChange={(e) => void act('profile.update', { quietFrom: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <span>—</span>
            <select
              aria-label="Конец тихих часов"
              value={s.me.quietTo}
              onChange={(e) => void act('profile.update', { quietTo: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
        </div>
        {s.me.role !== 'member' && (
          <Button tone="dark" onClick={() => push({ type: 'admin' })}>
            Управлять пространством
            <Settings2 size={18} />
          </Button>
        )}
        {demoMode() && (
          <div className="az-demo-settings">
            <span className="az-eyebrow">ДЕМОНСТРАЦИОННОЕ ПРОСТРАНСТВО</span>
            <p>Здесь можно пробовать, ошибаться и начинать заново. Действия сохраняются только в этом браузере.</p>
            <Button
              tone="soft"
              onClick={async () => {
                if (await act('demo.reset')) message('Демонстрация началась с чистого листа')
              }}
            >
              Начать историю заново
            </Button>
          </div>
        )}
        <div className="az-profile-footer">
          <ShieldCheck size={17} />
          <span>Ваше пространство под защитой</span>
          <small>
            {brand.name} · {s.config.version}
          </small>
        </div>
      </div>
      {qr && (
        <Modal title="Ваша клубная карта" onClose={() => setQr(false)}>
          <div className="az-member-qr">
            <QR value={`AZ-MEMBER:${s.me.id}`} />
            <h3>{s.me.name}</h3>
            <p>Покажите сотруднику, чтобы отметить визит.</p>
          </div>
        </Modal>
      )}
    </>
  )
}
