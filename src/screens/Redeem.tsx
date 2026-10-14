import { useEffect, useState } from 'react'
import { formatCode } from '../lib/advent'
import { api, errorText, isDemo } from '../lib/api'
import type { RedeemCheck, RedeemPoint } from '../lib/types'
import { Cta, Emoji, Spinner, Tap } from '../ui'

const SESSION = 'elaz-ed-cashier'

/**
 * Страница кассира: открывается по ссылке …/?redeem в обычном браузере, без Telegram.
 * Кассир выбирает точку и вводит PIN один раз за смену (хранится до закрытия вкладки), дальше — только коды.
 */
export function RedeemScreen() {
  const [points, setPoints] = useState<RedeemPoint[] | null>(null)
  const [point, setPoint] = useState<number>(0)
  const [pin, setPin] = useState('')
  const [code, setCode] = useState('')
  const [check, setCheck] = useState<RedeemCheck | null>(null)
  const [done, setDone] = useState<{ title: string; emoji: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION) ?? 'null')
      if (saved?.point) {
        setPoint(saved.point)
        setPin(saved.pin ?? '')
      }
    } catch {
      /* нет сохранённой смены */
    }
    api
      .redeemPoints()
      .then((p) => {
        setPoints(p)
        setPoint((cur) => cur || p[0]?.id || 0)
      })
      .catch(() => setPoints([]))
  }, [])

  const remember = () => {
    try {
      sessionStorage.setItem(SESSION, JSON.stringify({ point, pin }))
    } catch {
      /* приватный режим */
    }
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const verify = () =>
    run(async () => {
      setCheck(await api.redeemCheck(point, pin, code))
      remember()
    })

  const redeem = () =>
    run(async () => {
      setDone(await api.redeem(point, pin, code))
      setCheck(null)
    })

  const next = () => {
    setDone(null)
    setCheck(null)
    setCode('')
    setError(null)
  }

  const ready = point > 0 && pin.length >= 4 && code.replace('-', '').length === 8

  return (
    <div className="scroll relative z-10 h-full px-5" style={{ paddingTop: 'calc(var(--top) + 28px)', paddingBottom: 'calc(40px + var(--bottom))' }}>
      <p className="text-[12px] font-semibold uppercase tracking-wider text-mute">Погашение кодов{isDemo ? ' · демо: PIN 1234' : ''}</p>
      <h1 className="mt-1 font-display text-[26px] font-semibold leading-tight">Касса</h1>

      {done ? (
        <div className="mt-8 rounded-[28px] border border-mint/40 bg-mint/10 p-6 text-center">
          <Emoji char={done.emoji} size={84} animated className="mx-auto" />
          <p className="mt-4 font-display text-[22px] font-semibold">Погашено</p>
          <p className="mt-1 text-[17px]">{done.title}</p>
          <p className="mt-2 text-[14px] text-mute">Выдай награду. Повторно этот код не сработает.</p>
          <Cta className="mt-6 w-full" onClick={next}>
            Следующий код
          </Cta>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            <label className="block">
              <span className="text-[13px] font-semibold text-mute">Точка</span>
              {points === null ? (
                <div className="mt-1.5 grid h-12 place-items-center rounded-[16px] border border-line bg-card">
                  <Spinner size={18} />
                </div>
              ) : (
                <select
                  value={point}
                  onChange={(e) => setPoint(Number(e.target.value))}
                  className="mt-1.5 h-12 w-full rounded-[16px] border border-line bg-card px-3 text-[16px] text-ink"
                >
                  {points.length === 0 && <option value={0}>Точки не настроены</option>}
                  {points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-mute">PIN точки</span>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                inputMode="numeric"
                type="password"
                autoComplete="off"
                className="mt-1.5 h-12 w-full rounded-[16px] border border-line bg-card px-4 text-[18px] tracking-[0.3em] text-ink"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-mute">Код гостя</span>
              <input
                value={code}
                onChange={(e) => {
                  setCode(formatCode(e.target.value))
                  setCheck(null)
                }}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="ABCD-EF23"
                className="mt-1.5 h-16 w-full rounded-[18px] border border-line bg-card px-4 text-center font-mono text-[28px] font-bold tracking-[0.2em] text-ink placeholder:text-faint"
              />
            </label>
          </div>

          {error && <p className="mt-4 rounded-[16px] bg-rose/12 p-3.5 text-center text-[14.5px] font-semibold text-rose">{error}</p>}

          {check && (
            <div className={`mt-4 rounded-[22px] border p-4 ${check.status === 'issued' ? 'border-violet/40 bg-violet/10' : 'border-line bg-card'}`}>
              <div className="flex items-center gap-3">
                <Emoji char={check.emoji} size={40} />
                <div>
                  <p className="font-display text-[17px] font-semibold">{check.title}</p>
                  <p className={`text-[14px] font-semibold ${check.status === 'issued' ? 'text-mint' : 'text-rose'}`}>
                    {check.status === 'issued' ? 'Код действует' : `Уже погашен${check.redeemed_at ? ` ${new Date(check.redeemed_at).toLocaleString('ru-RU')}` : ''}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-2.5">
            {check?.status === 'issued' ? (
              <Cta className="w-full" busy={busy} onClick={redeem}>
                Погасить и выдать
              </Cta>
            ) : (
              <Cta className="w-full" busy={busy} disabled={!ready} onClick={verify}>
                Проверить код
              </Cta>
            )}
            {check && (
              <Tap onClick={next} className="h-12 w-full rounded-[18px] border border-line bg-card font-display text-[14px] font-semibold">
                Другой код
              </Tap>
            )}
          </div>
          <p className="mt-6 text-center text-[12.5px] leading-snug text-faint">Сначала проверь код, потом погаси. После 8 неверных PIN точка блокируется на 15 минут.</p>
        </>
      )}
    </div>
  )
}
