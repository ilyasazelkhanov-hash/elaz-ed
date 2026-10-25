export interface NewsArticle { id?: number; title?: string; subtitle?: string; body?: string; emoji?: string }

function plain(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`~]/g, '')
    .replace(/^[\s>#-]+/gm, '')
    .replace(/\s+/g, ' ').trim()
}

export function newsExcerpt(article: NewsArticle, max = 480) {
  const paragraphs = String(article.body ?? '').split(/\r?\n\s*\r?\n/)
    .filter(p => p.trim() && !/^\s*(?:#{1,6}\s|---|>\s*Модуль|\*\*Статус:|Статус:|\[Изображение)/i.test(p))
    .map(plain).filter(Boolean)
  const text = paragraphs.join(' ') || plain(article.subtitle ?? '')
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${cut.slice(0, space > max * .65 ? space : cut.length).trimEnd()}…`
}

export function newsShareText(article: NewsArticle) {
  return [plain(article.title ?? '').slice(0, 120), newsExcerpt(article), 'Читать полностью — по ссылке.'].filter(Boolean).join('\n\n')
}

const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

export function newsTelegramPost(article: NewsArticle, bot: {username: string; main_app?: boolean}, referral?: number) {
  if (!/^[a-zA-Z0-9_]+$/.test(bot.username) || !Number.isSafeInteger(article.id) || Number(article.id) <= 0) throw new Error('invalid_news_link')
  const link = `https://t.me/${bot.username}?${bot.main_app ? 'startapp' : 'start'}=l${article.id}${referral ? `_r${referral}` : ''}`
  const header = `${escape((article.emoji ?? '📰').slice(0, 8))} <b>${escape((article.title ?? '').slice(0, 120))}</b>`
  let limit = 480
  let text = ''
  do {
    text = `${header}\n\n${escape(newsExcerpt(article, limit))}\n\nЧитать полностью:\n${link}`
    limit -= 20
  } while (text.length > 1024 && limit >= 20)
  return { text, link }
}
