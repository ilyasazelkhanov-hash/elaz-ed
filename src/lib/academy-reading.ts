export type ReadingKind = 'text' | 'practice' | 'check' | 'hint' | 'example' | 'result'
export type ReadingPart =
  | { kind: ReadingKind; text: string; heading?: string }
  | { kind: 'code'; text: string; language: string; source: string; context?: ReadingKind }

const sectionKind = (heading: string): ReadingKind => {
  const value = heading.replace(/[*_`]/g, '').trim()
  if (/^(?:самопроверка|проверь|проверка понимания|как проверить)/iu.test(value)) return 'check'
  if (/^(?:практика|повтори|сделай|попробуй|учебная задача|тво[яё] задани|задание)/iu.test(value)) return 'practice'
  if (/^(?:подсказка|если застрял|типичная ошибка)/iu.test(value)) return 'hint'
  if (/^(?:пример|на .*примере|разбер[её]м пример|наглядный пример)/iu.test(value)) return 'example'
  if (/^(?:ожидаемый результат|результат|что получится|что нужно сохранить)/iu.test(value)) return 'result'
  return 'text'
}

/** Split authored Markdown without interpreting or executing code or changing its content. */
export function readingParts(markdown: string): ReadingPart[] {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
  const parts: ReadingPart[] = []
  let buffer: string[] = [], kind: ReadingKind = 'text', heading: string | undefined
  const flush = () => {
    const body = buffer.join('\n').trim()
    if (body || heading) parts.push({ kind, text: body, ...(heading ? { heading } : {}) })
    buffer = []; heading = undefined
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/)
    if (opening && !(opening[1][0] === '`' && opening[2].includes('`'))) {
      flush()
      const start = index, marker = opening[1][0], minimum = opening[1].length
      const closing = new RegExp(`^ {0,3}${marker === '`' ? '`' : '~'}{${minimum},}\\s*$`)
      const code: string[] = []
      let closed = false
      while (++index < lines.length) {
        if (closing.test(lines[index])) { closed = true; break }
        code.push(lines[index])
      }
      parts.push({ kind: 'code', context:kind, text: code.join('\n') + (closed && code.length ? '\n' : ''), language: opening[2].trim().split(/\s+/)[0] || '', source: lines.slice(start, Math.min(index + 1, lines.length)).join('\n') })
      continue
    }
    const atx = line.match(/^ {0,3}(#{1,6})[\t ]+(.+?)\s*$/)
    if (atx) {
      const label = atx[2].replace(/[\t ]+#+[\t ]*$/, '')
      const nextKind = sectionKind(label)
      if (nextKind !== 'text') { flush(); kind = nextKind; heading = label; continue }
      // A page already has its own H1. Leave other heading levels and fenced code alone.
      flush(); kind = 'text'
      buffer.push(atx[1].length === 1 ? line.replace('#', '##') : line)
      continue
    }
    const inline = line.match(/^(?:\*\*|__)(Практика|Самопроверка|Подсказка|Пример|Ожидаемый результат|Результат)[.:]?(?:\*\*|__)\s*(.*)$/iu)
      || line.match(/^(Практика|Самопроверка|Подсказка|Пример|Ожидаемый результат|Результат)[.:]\s+(.+)$/iu)
    if (inline) {
      flush(); kind = sectionKind(inline[1]); heading = inline[1]
      if (inline[2]) buffer.push(inline[2])
      continue
    }
    buffer.push(line)
  }
  flush()
  return parts
}

export type ReadingSectionName='all'|'reading'|'practice'|'check'|'hint'
export function belongsToReadingSection(part:ReadingPart,section:ReadingSectionName){
 const kind=part.kind==='code'?part.context||'text':part.kind
 return section==='all'||(section==='reading'?!['practice','check','hint'].includes(kind):kind===section)
}
