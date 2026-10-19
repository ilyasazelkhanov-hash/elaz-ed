export function encodeGift(token: string) {
  if (!/^[a-f0-9]{64}$/i.test(token)) throw new Error('Invalid gift token')
  return btoa(String.fromCharCode(...token.match(/../g)!.map((v) => parseInt(v, 16))))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}
export function decodeGift(value: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null
  try {
    const raw = atob(value.replaceAll('-', '+').replaceAll('_', '/') + '=')
    const hex = Array.from(raw, (v) => v.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    return encodeGift(hex) === value ? hex : null
  } catch {
    return null
  }
}
export function incomingGift() {
  const query = new URLSearchParams(location.search)
  const direct = query.get('gift')
  if (direct && /^[a-f0-9]{64}$/i.test(direct)) return direct.toLowerCase()
  const app =
    (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: string } } } }).Telegram?.WebApp
      ?.initDataUnsafe?.start_param ?? query.get('tgWebAppStartParam')
  return app?.startsWith('gift_') ? decodeGift(app.slice(5)) : null
}
