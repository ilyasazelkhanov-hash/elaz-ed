import { motion, useMotionTemplate, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { isDemo } from '../lib/api'
import { levelCard } from '../lib/shareCard'
import { sfx } from '../lib/sfx'
import { haptic, inTelegram, shareLink, telegram, tgVersion } from '../lib/tg'
import { appLink } from '../lib/links'
import { useTilt } from '../lib/tilt'
import { track } from '../lib/track'
import { useStore } from '../store'
import { Bar, burst, Tap } from '../ui'
import { Header, sheet } from './Admin'

const mobile = inTelegram && ['android', 'ios'].includes(telegram?.platform)
const NEED_PHONE = 'Работает в Telegram на телефоне'
const NEED_TG = 'Работает внутри Telegram'

/** Запускает метод Telegram и не роняет экран, если клиент старый. */
function attempt(fn: () => void) {
  try {
    fn()
  } catch {
    /* возможность недоступна в этом клиенте */
  }
}

/**
 * Лаборатория: живые примеры того, что умеет приложение внутри Telegram.
 * Каждая карточка вызывает настоящую возможность, а не её имитацию.
 */
export function LabScreen() {
  const me = useStore((s) => s.me)!
  const courses = useStore((s) => s.courses)
  const { toast, push } = useStore.getState()
  const [tried, setTried] = useState<string[]>([])
  const paid = courses.find((c) => c.price_stars > 0)

  const mark = (demo: string) => {
    setTried((list) => {
      if (list.includes(demo)) return list
      track('lab', { demo })
      return [...list, demo]
    })
  }

  return (
    <motion.div {...sheet} className="absolute inset-0 z-30 bg-bg">
      <div className="scroll h-full" style={{ paddingTop: 'calc(var(--top) + 16px)', paddingBottom: 'calc(40px + var(--bottom))' }}>
        <Header title="Лаборатория" />
        <div className="px-5">
          <section className="relative mt-3 overflow-hidden rounded-[26px] border border-violet/20 bg-card px-4 py-4 shadow-[var(--shadow-float)]">
            <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-violet/15 blur-3xl" />
            <div className="relative flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-violet/12 text-[22px]">🧪</div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-violet">Telegram внутри OG</p>
                <p className="mt-1 text-[13.5px] leading-snug text-mute">Попробуй возможности мини-аппа — или собери короткую практику для своей группы.</p>
              </div>
              <span className="shrink-0 rounded-full border border-line bg-card2 px-2.5 py-1 text-[11px] font-semibold tabular text-mute">{tried.length}/{TOTAL}</span>
            </div>
            <div className="relative mt-4"><Bar progress={tried.length / TOTAL} className="h-1.5" /></div>
          </section>

          <div className="mt-6">
            <GroupSprint onTry={() => mark('group_sprint')} />
          </div>

          <LabSection title="Отклик и управление" detail="Проверь, как приложение ощущается на устройстве">
            <Haptics onTry={() => mark('haptics')} />
            <Tilt onTry={() => mark('tilt')} />
            <Shake onTry={() => mark('shake')} />
            <QrScanner onTry={() => mark('qr')} />
            <Biometrics onTry={() => mark('biometrics')} />
            <NativePopup onTry={() => mark('popup')} />
            <MainButton onTry={() => mark('main_button')} />
            <Fullscreen onTry={() => mark('fullscreen')} />
            <HomeScreen onTry={() => mark('home_screen')} />
            <Cloud onTry={() => mark('cloud')} />
          </LabSection>

          <LabSection title="Поделиться и поддержать" detail="Отправь результат или посмотри, как работают покупки">
            <Demo title="Картинка в сторис и в чат" text="Приложение рисует картинку и отдаёт её Telegram: в сторис, в чат с кнопкой или в галерею." ok>
              <Action
                onClick={() => {
                  mark('share')
                  useStore.setState({ share: levelCard(me) })
                }}
              >
                Собрать мою карточку
              </Action>
            </Demo>
            <Demo title="Оплата звёздами" text="Счёт открывается поверх приложения, оплата в два тапа. Так здесь продаются закрытые курсы." ok={!!paid} note="Появится, когда выйдет первый платный курс">
              <Action
                onClick={() => {
                  mark('stars')
                  if (paid) push({ type: 'course', id: paid.id })
                }}
              >
                Посмотреть на курсе
              </Action>
            </Demo>
          </LabSection>

          {isDemo && <p className="mt-5 text-center text-[12.5px] text-faint">В браузере часть примеров недоступна — открой приложение в Telegram.</p>}
          {tried.length === TOTAL && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onAnimationComplete={() => toast('Всё попробовал. Теперь ты знаешь, что просить у разработчика', '🧪')} className="mt-5 text-center text-[13.5px] font-semibold">
              Лаборатория пройдена целиком
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

const TOTAL = 13

// ---------- Общие детали ----------

function Demo({ title, text, ok, note = NEED_TG, children }: { title: string; text: string; ok: boolean; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-line bg-card/80 p-4">
      <h2 className="text-[15.5px] font-semibold">{title}</h2>
      <p className="mt-1 text-[13.5px] leading-snug text-mute">{text}</p>
      <div className="mt-3.5">{ok ? children : <p className="rounded-[14px] bg-veil/5 px-3.5 py-2.5 text-[13px] text-faint">{note}</p>}</div>
    </section>
  )
}

function LabSection({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-3 px-0.5">
        <h2 className="text-[17px] font-semibold tracking-[-.02em]">{title}</h2>
        <p className="mt-1 text-[12.5px] leading-snug text-mute">{detail}</p>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

function Action({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Tap onClick={onClick} className="flex h-11 w-full items-center justify-center rounded-[14px] bg-inverse px-4 text-[14px] font-semibold text-on-inverse">
      {children}
    </Tap>
  )
}

function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Tap feedback="none" onClick={onClick} className="h-10 flex-1 rounded-[13px] border border-line bg-card2 text-[13.5px] font-semibold">
      {children}
    </Tap>
  )
}

interface DemoProps {
  onTry: () => void
}

// ---------- Примеры ----------

function Haptics({ onTry }: DemoProps) {
  const rhythm = () => {
    onTry()
    ;[0, 110, 220, 420, 520].forEach((ms, i) => setTimeout(() => (i === 4 ? haptic.success() : haptic.tap()), ms))
  }
  return (
    <Demo title="Вибро-отклик" text="Телефон отвечает на нажатия: лёгкий тик, удар, сигнал успеха." ok={inTelegram && tgVersion('6.1')} note={NEED_PHONE}>
      <div className="flex gap-2">
        <Chip onClick={() => (onTry(), haptic.tap())}>Лёгкий</Chip>
        <Chip onClick={() => (onTry(), haptic.heavy())}>Сильный</Chip>
        <Chip onClick={() => (onTry(), haptic.error())}>Ошибка</Chip>
        <Chip onClick={rhythm}>Ритм</Chip>
      </div>
    </Demo>
  )
}

function Tilt({ onTry }: DemoProps) {
  const tilt = useTilt(true)
  const x = useTransform(tilt.x, [-1, 1], [-42, 42])
  const y = useTransform(tilt.y, [-1, 1], [-18, 18])
  const shine = useTransform(tilt.x, [-1, 1], [0, 100])
  const background = useMotionTemplate`linear-gradient(105deg, transparent ${shine}%, rgb(255 255 255 / 0.18) calc(${shine}% + 12%), transparent calc(${shine}% + 28%))`
  const moved = useRef(false)
  const tried = useRef(onTry)
  tried.current = onTry

  useEffect(
    () =>
      tilt.x.on('change', (v) => {
        if (moved.current || Math.abs(v) < 0.35) return
        moved.current = true
        tried.current()
      }),
    [tilt.x],
  )

  return (
    <Demo title="Гироскоп" text={mobile ? 'Наклони телефон — шарик покатится.' : 'На телефоне шарик катается от наклона. Здесь води курсором.'} ok>
      <div onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave} className="relative grid h-[76px] place-items-center overflow-hidden rounded-[16px] border border-line bg-card2">
        <motion.div className="absolute inset-0" style={{ background }} />
        <motion.div className="h-9 w-9 rounded-full" style={{ x, y, background: 'var(--aurora)', boxShadow: '0 6px 18px -4px #9b7bff' }} />
      </div>
    </Demo>
  )
}

function Shake({ onTry }: DemoProps) {
  const [count, setCount] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const tried = useRef(onTry)
  tried.current = onTry

  useEffect(() => {
    let last = 0
    const hit = (x: number, y: number, z: number) => {
      // В покое датчик показывает только притяжение (~9,8). Резкий рывок даёт заметно больше.
      if (Math.hypot(x, y, z) < 21 || Date.now() - last < 650) return
      last = Date.now()
      setCount((n) => n + 1)
      burst(box.current)
      haptic.heavy()
      sfx.coin()
      tried.current()
    }
    const sensor = telegram?.Accelerometer
    if (mobile && tgVersion('8.0') && sensor?.start) {
      const onChange = () => hit(sensor.x ?? 0, sensor.y ?? 0, sensor.z ?? 0)
      attempt(() => {
        sensor.start({ refresh_rate: 60 })
        telegram.onEvent('accelerometerChanged', onChange)
      })
      return () =>
        attempt(() => {
          telegram.offEvent('accelerometerChanged', onChange)
          sensor.stop()
        })
    }
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity
      if (a) hit(a.x ?? 0, a.y ?? 0, a.z ?? 0)
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [])

  return (
    <Demo title="Встряска" text="Акселерометр ловит резкое движение. Потряси телефон." ok={mobile} note={NEED_PHONE}>
      <div ref={box} className="flex h-[52px] items-center justify-center rounded-[14px] border border-line bg-card2 text-[14px] font-semibold">
        {count === 0 ? 'Жду встряску' : <span className="tabular">Поймал: {count}</span>}
      </div>
    </Demo>
  )
}

function QrScanner({ onTry }: DemoProps) {
  const [result, setResult] = useState<string | null>(null)
  const scan = () =>
    attempt(() =>
      telegram.showScanQrPopup({ text: 'Наведи камеру на любой QR-код' }, (text: string) => {
        setResult(text)
        haptic.success()
        onTry()
        return true
      }),
    )
  return (
    <Demo title="Сканер QR-кодов" text="Камера открывается внутри Telegram, без разрешений и переходов." ok={mobile && tgVersion('6.4')} note={NEED_PHONE}>
      <Action onClick={scan}>Открыть сканер</Action>
      {result && <p className="selectable mt-2.5 break-all rounded-[14px] bg-veil/5 px-3.5 py-2.5 font-mono text-[12.5px] text-mute">{result}</p>}
    </Demo>
  )
}

function Biometrics({ onTry }: DemoProps) {
  const toast = useStore((s) => s.toast)
  const manager = telegram?.BiometricManager
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!manager?.init || !tgVersion('7.2')) return
    attempt(() => manager.init(() => setReady(!!manager.isBiometricAvailable)))
  }, [manager])

  const check = () => {
    const authenticate = () =>
      attempt(() =>
        manager.authenticate({ reason: 'Проверка в лаборатории OG CRE8R²' }, (ok: boolean) => {
          onTry()
          if (ok) haptic.success()
          toast(ok ? 'Это точно ты' : 'Не узнал', ok ? '🔓' : '🔒')
        }),
      )
    if (manager.isAccessGranted) return authenticate()
    attempt(() => manager.requestAccess({ reason: 'Чтобы показать вход по лицу или отпечатку' }, (granted: boolean) => granted && authenticate()))
  }

  return (
    <Demo title="Лицо и отпечаток" text="Вход по Face ID или отпечатку — так защищают платежи и личные разделы." ok={ready} note="На этом устройстве биометрия недоступна">
      <Action onClick={check}>Проверить меня</Action>
    </Demo>
  )
}

function NativePopup({ onTry }: DemoProps) {
  const toast = useStore((s) => s.toast)
  const show = () =>
    attempt(() =>
      telegram.showPopup(
        {
          title: 'Системное окно',
          message: 'Его рисует сам Telegram, поэтому оно выглядит родным на любом телефоне.',
          buttons: [
            { id: 'ok', type: 'default', text: 'Понятно' },
            { id: 'more', type: 'default', text: 'Ещё бы' },
            { type: 'cancel' },
          ],
        },
        (id: string) => {
          onTry()
          if (id) toast(id === 'more' ? 'Листай дальше' : 'Принято')
        },
      ),
    )
  return (
    <Demo title="Системные окна" text="Подтверждения и вопросы показывает сам Telegram." ok={inTelegram && tgVersion('6.2')}>
      <Action onClick={show}>Показать окно</Action>
    </Demo>
  )
}

function MainButton({ onTry }: DemoProps) {
  const [shown, setShown] = useState(false)
  const button = telegram?.MainButton

  useEffect(() => {
    if (!shown || !button) return
    const hide = () => setShown(false)
    attempt(() => {
      button.setParams({ text: 'Это кнопка Telegram. Нажми, чтобы убрать', has_shine_effect: true, is_visible: true })
      button.onClick(hide)
    })
    return () =>
      attempt(() => {
        button.offClick(hide)
        button.hide()
      })
  }, [shown, button])

  return (
    <Demo title="Главная кнопка Telegram" text="Кнопка внизу экрана принадлежит Telegram: с бликом и индикатором загрузки." ok={inTelegram && !!button}>
      <Action
        onClick={() => {
          onTry()
          setShown((v) => !v)
        }}
      >
        {shown ? 'Убрать кнопку' : 'Показать кнопку'}
      </Action>
    </Demo>
  )
}

function Fullscreen({ onTry }: DemoProps) {
  const [full, setFull] = useState(!!telegram?.isFullscreen)

  useEffect(() => {
    if (!telegram?.onEvent) return
    const sync = () => setFull(!!telegram.isFullscreen)
    attempt(() => telegram.onEvent('fullscreenChanged', sync))
    return () => attempt(() => telegram.offEvent('fullscreenChanged', sync))
  }, [])

  return (
    <Demo title="Полный экран" text="Приложение занимает весь экран, как обычное. Шапка Telegram сворачивается в две кнопки." ok={mobile && tgVersion('8.0')} note={NEED_PHONE}>
      <Action
        onClick={() => {
          onTry()
          attempt(() => (full ? telegram.exitFullscreen() : telegram.requestFullscreen()))
        }}
      >
        {full ? 'Вернуть шапку' : 'Развернуть'}
      </Action>
    </Demo>
  )
}

function HomeScreen({ onTry }: DemoProps) {
  return (
    <Demo title="Иконка на экране телефона" text="Мини-апп можно поставить рядом с обычными приложениями." ok={mobile && tgVersion('8.0')} note={NEED_PHONE}>
      <Action
        onClick={() => {
          onTry()
          attempt(() => telegram.addToHomeScreen())
        }}
      >
        Добавить на экран «Домой»
      </Action>
    </Demo>
  )
}

const CLOUD_KEY = 'lab_note'

function Cloud({ onTry }: DemoProps) {
  const toast = useStore((s) => s.toast)
  const storage = telegram?.CloudStorage
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!storage?.getItem || !tgVersion('6.9')) return
    attempt(() => storage.getItem(CLOUD_KEY, (_err: unknown, value: string) => value && setNote(value)))
  }, [storage])

  const save = () =>
    attempt(() =>
      storage.setItem(CLOUD_KEY, note.slice(0, 200), (err: unknown) => {
        onTry()
        if (!err) haptic.success()
        toast(err ? 'Не сохранилось' : 'Сохранено. Открой приложение на другом устройстве — заметка будет там', err ? undefined : '☁️')
      }),
    )

  return (
    <Demo title="Облако Telegram" text="Приложение хранит данные в аккаунте: они переезжают между телефоном и компьютером." ok={inTelegram && tgVersion('6.9') && !!storage}>
      <div className="flex gap-2">
        <input id="lab-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Напиши пару слов" maxLength={200} className="h-11 min-w-0 flex-1 rounded-[14px] border border-line bg-card2 px-3.5 text-[16px] outline-none placeholder:text-faint focus:border-violet/60" />
        <Tap onClick={save} disabled={!note.trim()} className="h-11 shrink-0 rounded-[14px] bg-inverse px-4 text-[14px] font-semibold text-on-inverse disabled:opacity-50">
          Сохранить
        </Tap>
      </div>
    </Demo>
  )
}

const SPRINTS = [
  { id: 'prompt', title: 'Промпт', emoji: '✍️', headline: 'Соберите сильный промпт', task: 'Каждый приносит одну рутинную задачу. Вместе перепишите её в промпт с ролью, контекстом, ограничениями и форматом ответа.' },
  { id: 'verify', title: 'Фактчек', emoji: '🔎', headline: 'Проверьте ответ ИИ', task: 'Возьмите ответ нейросети и найдите в нём три проверяемых утверждения. Сверьте их с источниками и отметьте, что модель упустила.' },
  { id: 'workflow', title: 'Автоматизация', emoji: '⚙️', headline: 'Найдите автоматизацию', task: 'Опишите повторяющийся процесс команды. Разбейте его на шаги и выберите один безопасный шаг, который можно автоматизировать первым.' },
] as const

/** Готовый групповой сценарий: организатор выбирает тему и отправляет приглашение в нужный чат. */
function GroupSprint({ onTry }: DemoProps) {
  const toast = useStore((s) => s.toast)
  const [selected, setSelected] = useState<(typeof SPRINTS)[number]['id']>('prompt')
  const sprint = SPRINTS.find((item) => item.id === selected) ?? SPRINTS[0]

  const launch = () => {
    const link = appLink()
    if (!link) {
      toast('Ссылка на приложение пока не настроена')
      return
    }
    const message = `🚀 Учебный спринт OG CRE8R² · 20 минут\n\n${sprint.emoji} ${sprint.headline}\n${sprint.task}\n\nПлан: 3 минуты — выбрать пример · 12 минут — сделать вместе · 5 минут — поделиться выводом.`
    onTry()
    shareLink(link, message)
  }

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-violet/25 bg-card p-4 shadow-[var(--shadow-float)]">
      <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-pink/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.17em] text-violet">Сделайте вместе</p>
          <h2 className="mt-1.5 font-display text-[19px] font-semibold leading-tight tracking-[-.04em]">Учебный спринт</h2>
        </div>
        <span className="rounded-full border border-line bg-card2 px-2.5 py-1 text-[11px] font-semibold text-mute">20 минут</span>
      </div>
      <p className="relative mt-2 text-[13px] leading-snug text-mute">Выбери тему — Telegram подготовит приглашение в групповой чат.</p>
      <div className="relative mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Тема группового спринта">
        {SPRINTS.map((item) => (
          <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className={`min-h-[58px] rounded-[15px] border px-1.5 py-2 text-center transition-colors ${selected === item.id ? 'border-violet/60 bg-violet/12 text-ink shadow-[inset_0_0_0_1px_rgb(165_139_255_/_0.12)]' : 'border-line bg-card2 text-mute'}`}>
            <span className="block text-[17px] leading-none" aria-hidden="true">{item.emoji}</span>
            <span className="mt-1.5 block text-[11px] font-semibold leading-tight">{item.title}</span>
          </button>
        ))}
      </div>
      <div className="relative mt-3 rounded-[17px] border border-line bg-card2/80 p-3.5">
        <p className="text-[13.5px] font-semibold">{sprint.headline}</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-mute">{sprint.task}</p>
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 text-[10.5px] font-medium text-faint">
          <span>03 мин · старт</span><span className="h-px flex-1 bg-line"/><span>12 мин · практика</span><span className="h-px flex-1 bg-line"/><span>05 мин · итог</span>
        </div>
      </div>
      <Tap onClick={launch} className="relative mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[16px] bg-[var(--aurora)] px-4 text-[14px] font-bold text-[#170f2e] shadow-[0_8px_24px_rgb(124_107_255_/_0.24)]">
        <span>Отправить в группу</span><span aria-hidden="true">↗</span>
      </Tap>
      <p className="relative mt-2.5 text-center text-[10.5px] leading-snug text-faint">Предпросмотр и отправка — под твоим контролем</p>
    </section>
  )
}
