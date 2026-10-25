interface Gift { kind?: string; title?: string; emoji?: string; code?: string | null; content?: {text?: string; url?: string} }
const escape = (value: string) => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')

/** Telegram is the receipt; large packs remain readable and copyable in the calendar. */
export function rewardNotifications(gifts: Gift[], heading = '🎉 <b>Поздравляем! Награда получена:</b>') {
  const blocks = gifts.map(gift => {
    let detail = 'Уже открыт в приложении.'
    if (gift.kind === 'promo') detail = `🎟 Код: <code>${escape(String(gift.code ?? '').slice(0,32))}</code>\n<i>Покажи одноразовый код на кассе.</i>`
    if (gift.kind === 'message') {
      const text = String(gift.content?.text ?? '')
      detail = escape(text).length <= 1400 ? escape(text) : `${escape(text.slice(0,300))}…\n\nПолный набор с кнопками копирования — в календаре.`
    }
    if (gift.kind === 'link' || gift.kind === 'video') detail = escape(String(gift.content?.url ?? '').slice(0,400))
    if (gift.kind === 'course') detail = '🎓 Доступ к курсу уже открыт в твоём профиле!'
    if (gift.kind === 'lesson') detail = '📖 Урок уже разблокирован в приложении.'
    return `${escape(String(gift.emoji ?? '🎁').slice(0,8))} <b>${escape(String(gift.title ?? '').slice(0,120))}</b>\n${detail}`
  })
  const messages: string[] = []
  let current = heading
  for (const block of blocks) {
    if (current.length + block.length + 40 > 3800) { messages.push(current); current = heading }
    current += `\n\n${block}`
  }
  if (blocks.length) messages.push(current)
  return messages
}
