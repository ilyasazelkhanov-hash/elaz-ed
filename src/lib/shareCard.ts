// Картинка для сторис 1080×1920. Рисуется на canvas прямо в приложении, без сервера.
import { emojiCode, NOTO } from './emoji'
import { days, GRADIENTS, levelOf, plural } from './game'
import type { CompleteResult, GradientName, Me, ShareKind } from './types'

export interface ShareCard {
  kind: ShareKind
  gradient: GradientName
  /** Короткая метка в углу: «Урок пройден», «Стрик». */
  chip: string
  emoji: string
  title: string
  big?: string
  /** Крупное число идёт перед заголовком: «7 / дней подряд». */
  bigFirst?: boolean
  sub?: string
  /** Подпись, которая уходит вместе с картинкой или ссылкой. */
  caption: string
  lessonId?: number
}

export function levelCard(me: Me): ShareCard {
  const lvl = levelOf(me.xp)
  return {
    kind: 'level',
    gradient: 'aurora',
    chip: 'Мой уровень',
    emoji: lvl.emoji,
    title: lvl.title,
    big: `${me.xp} XP`,
    sub: [`Уровень ${lvl.index}`, me.streak > 0 ? `стрик ${days(me.streak)}` : '', `${me.rank} место`].filter(Boolean).join(' · '),
    caption: `Мой уровень в Elaz Ed — «${lvl.title}». Догоняй.`,
  }
}

export function lessonCard(lesson: { id: number; title: string; emoji: string; gradient: GradientName }, result: CompleteResult): ShareCard {
  return {
    kind: 'lesson',
    gradient: lesson.gradient,
    chip: 'Урок пройден',
    emoji: lesson.emoji,
    title: lesson.title,
    big: `+${result.gained} XP`,
    sub: result.total > 0 ? `Квиз ${result.score} из ${result.total}` : undefined,
    caption: `Прошёл урок «${lesson.title}» в Elaz Ed.`,
    lessonId: lesson.id,
  }
}

export function streakCard(me: Me): ShareCard {
  return {
    kind: 'streak',
    gradient: 'candy',
    chip: 'Стрик',
    emoji: '🔥',
    big: String(me.streak),
    bigFirst: true,
    title: `${plural(me.streak, ['день', 'дня', 'дней'])} подряд`,
    sub: me.best_streak > me.streak ? `Рекорд — ${me.best_streak}` : 'Это мой рекорд',
    caption: `Держу стрик ${days(me.streak)} в Elaz Ed.`,
  }
}

export function achievementCard(a: { title: string; desc: string; emoji: string }): ShareCard {
  return {
    kind: 'achievement',
    gradient: 'ocean',
    chip: 'Ачивка',
    emoji: a.emoji,
    title: a.title,
    sub: a.desc,
    caption: `Открыл ачивку «${a.title}» в Elaz Ed.`,
  }
}

// ---------- Отрисовка ----------

const W = 1080
const H = 1920
// Сверху и снизу Instagram закрывает кадр своими кнопками, поэтому важное держим в середине.
const SAFE_TOP = 280
const FOOTER_TOP = 1450
const DISPLAY = '"Unbounded Variable", system-ui, sans-serif'
const TEXT = '"Onest Variable", system-ui, sans-serif'

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function emojiImage(char: string) {
  const full = emojiCode(char, true)
  const bare = emojiCode(char, false)
  return (await loadImage(`${NOTO}/${full}/512.png`)) ?? (bare !== full ? await loadImage(`${NOTO}/${bare}/512.png`) : null)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    lines.length = maxLines
    let last = lines[maxLines - 1]
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
    lines[maxLines - 1] = `${last.trimEnd()}…`
  }
  return lines
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

export async function renderCard(card: ShareCard, userName: string, botUsername: string | null): Promise<Blob> {
  const g = GRADIENTS[card.gradient] ?? GRADIENTS.aurora
  const ink = g.ink
  const accent = g.stops[Math.min(1, g.stops.length - 1)][0]
  const sample = `${card.title} ${card.big ?? ''} ${card.sub ?? ''} ${card.chip} ${userName} Elaz Ed`

  const [emoji] = await Promise.all([
    emojiImage(card.emoji),
    document.fonts.load(`700 88px ${DISPLAY}`, sample),
    document.fonts.load(`600 44px ${TEXT}`, sample),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Фон: тот же градиент, что у карточки в приложении, и два мягких круга.
  const bg = ctx.createLinearGradient(0, 0, W, H)
  for (const [color, percent] of g.stops) bg.addColorStop(percent / 100, color)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  circle(ctx, W - 40, 250, 470, 'rgb(255 255 255 / 0.2)')
  circle(ctx, 60, H - 260, 520, 'rgb(0 0 0 / 0.1)')
  circle(ctx, 150, 860, 120, 'rgb(255 255 255 / 0.12)')

  // Логотип и метка
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = ink
  ctx.font = `700 60px ${DISPLAY}`
  ctx.fillText('Elaz', 84, SAFE_TOP)
  const elazWidth = ctx.measureText('Elaz').width
  ctx.font = `700 52px ${DISPLAY}`
  const edWidth = ctx.measureText('Ed').width
  pill(ctx, 84 + elazWidth + 18, SAFE_TOP - 42, edWidth + 36, 84, 20)
  ctx.fillStyle = accent
  ctx.fillText('Ed', 84 + elazWidth + 36, SAFE_TOP + 2)

  ctx.font = `700 32px ${TEXT}`
  const chip = card.chip.toUpperCase()
  const chipWidth = ctx.measureText(chip).width + 56
  ctx.fillStyle = 'rgb(0 0 0 / 0.16)'
  pill(ctx, W - 84 - chipWidth, SAFE_TOP - 36, chipWidth, 72, 36)
  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.fillText(chip, W - 84 - chipWidth / 2, SAFE_TOP + 2)

  // Эмодзи с подсветкой
  const emojiY = 690
  const glow = ctx.createRadialGradient(W / 2, emojiY, 40, W / 2, emojiY, 400)
  glow.addColorStop(0, 'rgb(255 255 255 / 0.42)')
  glow.addColorStop(1, 'rgb(255 255 255 / 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, emojiY - 400, W, 800)
  if (emoji) {
    ctx.drawImage(emoji, W / 2 - 220, emojiY - 220, 440, 440)
  } else {
    ctx.font = '360px serif'
    ctx.fillText(card.emoji, W / 2, emojiY + 20)
  }

  // Текстовый блок: высоту считаем заранее и ставим его по центру между эмодзи и подвалом.
  ctx.font = `700 88px ${DISPLAY}`
  const titleLines = wrap(ctx, card.title, 900, 3)
  ctx.font = `500 44px ${TEXT}`
  const subLines = card.sub ? wrap(ctx, card.sub, 880, 2) : []
  const bigSize = card.bigFirst ? 300 : 148
  const blocks = {
    title: titleLines.length * 102,
    big: card.big ? bigSize * 1.04 : 0,
    sub: subLines.length ? subLines.length * 60 + 26 : 0,
  }
  const total = blocks.title + blocks.big + blocks.sub + (card.big ? 22 : 0)
  let y = 950 + Math.max(0, (FOOTER_TOP - 950 - total) / 2)

  const drawTitle = () => {
    ctx.font = `700 88px ${DISPLAY}`
    ctx.fillStyle = ink
    for (const line of titleLines) {
      ctx.fillText(line, W / 2, y + 51)
      y += 102
    }
  }
  const drawBig = () => {
    if (!card.big) return
    ctx.font = `800 ${bigSize}px ${DISPLAY}`
    ctx.fillStyle = ink
    ctx.fillText(card.big, W / 2, y + blocks.big / 2)
    y += blocks.big + 22
  }
  if (card.bigFirst) {
    drawBig()
    drawTitle()
  } else {
    drawTitle()
    y += card.big ? 22 : 0
    drawBig()
  }
  if (subLines.length) {
    y += 26
    ctx.font = `500 44px ${TEXT}`
    ctx.globalAlpha = 0.85
    for (const line of subLines) {
      ctx.fillText(line, W / 2, y + 30)
      y += 60
    }
    ctx.globalAlpha = 1
  }

  // Подвал: кто поделился и куда идти
  ctx.fillStyle = 'rgb(0 0 0 / 0.16)'
  pill(ctx, 84, FOOTER_TOP, W - 168, 176, 48)
  circle(ctx, 84 + 88, FOOTER_TOP + 88, 52, ink)
  ctx.fillStyle = accent
  ctx.font = `700 50px ${DISPLAY}`
  ctx.fillText([...(userName || 'E')][0].toUpperCase(), 84 + 88, FOOTER_TOP + 91)

  ctx.textAlign = 'left'
  ctx.fillStyle = ink
  ctx.font = `700 44px ${TEXT}`
  const nameMax = botUsername ? 380 : 700
  let name = userName || 'Гость'
  while (name.length > 2 && ctx.measureText(name).width > nameMax) name = `${name.slice(0, -2)}…`
  ctx.fillText(name, 84 + 164, FOOTER_TOP + 64)
  ctx.font = `500 34px ${TEXT}`
  ctx.globalAlpha = 0.78
  ctx.fillText('учится в Elaz Ed', 84 + 164, FOOTER_TOP + 116)
  ctx.globalAlpha = 1
  if (botUsername) {
    ctx.textAlign = 'right'
    ctx.font = `700 38px ${TEXT}`
    ctx.fillText(`@${botUsername}`, W - 84 - 40, FOOTER_TOP + 90)
  }

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas'))), 'image/jpeg', 0.92))
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
