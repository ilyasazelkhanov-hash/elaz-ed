/** Bounded CSV transport. Domain validation and role checks belong to the server. */
export const CSV_LIMITS = { bytes: 2_000_000, rows: 10_000, columns: 64, cellCharacters: 65_536 } as const
const reserved = new Set(['__proto__', 'prototype', 'constructor'])
const bytes = (value: string) => new TextEncoder().encode(value).byteLength

function validateHeader(headers: string[]) {
  if (headers.length > CSV_LIMITS.columns) throw new Error('CSV: too many columns')
  if (headers.some((header) => !header || reserved.has(header) || /[\u0000-\u001f\u007f]/.test(header)))
    throw new Error('CSV: invalid column name')
  if (new Set(headers).size !== headers.length) throw new Error('CSV: duplicate column name')
}

/** UTF-8 text, comma separator, doubled quotes, CRLF/LF/CR record boundaries. */
export function parseCsv(text: string): Record<string, string>[] {
  if (typeof text !== 'string') throw new Error('CSV: text is required')
  if (text.length > CSV_LIMITS.bytes || bytes(text) > CSV_LIMITS.bytes) throw new Error('CSV: input exceeds byte limit')
  if (text.includes('\0')) throw new Error('CSV: null character is not allowed')
  if (text.startsWith('\uFEFF')) text = text.slice(1)
  const records: string[][] = []
  let row: string[] = []
  let field = ''
  let state: 'start' | 'plain' | 'quoted' | 'closed' = 'start'
  const append = (character: string) => {
    field += character
    if (field.length > CSV_LIMITS.cellCharacters) throw new Error('CSV: cell exceeds character limit')
  }
  const finishField = () => {
    row.push(field)
    if (row.length > CSV_LIMITS.columns) throw new Error('CSV: too many columns')
    field = ''
    state = 'start'
  }
  const finishRow = () => {
    const hasRecord = row.length > 0 || field.length > 0 || state !== 'start'
    finishField()
    if (hasRecord) {
      records.push(row)
      if (records.length > CSV_LIMITS.rows + 1) throw new Error('CSV: too many rows')
    }
    row = []
  }
  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (state === 'quoted') {
      if (character === '"') {
        if (text[index + 1] === '"') {
          append('"')
          index++
        } else state = 'closed'
      } else append(character)
      continue
    }
    if (character === ',') {
      finishField()
      continue
    }
    if (character === '\r' || character === '\n') {
      finishRow()
      if (character === '\r' && text[index + 1] === '\n') index++
      continue
    }
    if (state === 'closed') throw new Error('CSV: unexpected character after closing quote')
    if (character === '"') {
      if (state !== 'start') throw new Error('CSV: unexpected quote in unquoted field')
      state = 'quoted'
    } else {
      state = 'plain'
      append(character)
    }
  }
  if (state === 'quoted') throw new Error('CSV: unterminated quoted field')
  if (field || row.length || state !== 'start') finishRow()
  if (!records.length) return []
  const headers = records.shift()!.map((header) => header.trim())
  validateHeader(headers)
  return records.map((record, index) => {
    if (record.length !== headers.length)
      throw new Error(`CSV: row ${index + 2} has ${record.length} columns; expected ${headers.length}`)
    return Object.fromEntries(headers.map((header, column) => [header, record[column]]))
  })
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value) ?? ''
    } catch {
      throw new Error('CSV: value is not JSON serializable')
    }
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return String(value)
  throw new Error('CSV: unsupported cell value')
}
function encodeField(value: unknown): string {
  let field = stringify(value)
  if (field.includes('\0')) throw new Error('CSV: null character is not allowed')
  if (field.length > CSV_LIMITS.cellCharacters) throw new Error('CSV: cell exceeds character limit')
  // CSV quoting alone does not stop spreadsheet formulas. Prefix a literal apostrophe.
  if (/^[\t\r\n]/.test(field) || /^\s*[=+\-@]/.test(field)) field = "'" + field
  return /[",\r\n]/.test(field) ? '"' + field.replaceAll('"', '""') + '"' : field
}

/** Union of row keys; object/array fields (e.g. entity.data) become JSON cells. */
export function encodeCsv(rows: Record<string, unknown>[]): string {
  if (!Array.isArray(rows)) throw new Error('CSV: rows array is required')
  if (rows.length > CSV_LIMITS.rows) throw new Error('CSV: too many rows')
  if (!rows.length) return ''
  if (rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row)))
    throw new Error('CSV: each row must be an object')
  const keys = new Set<string>()
  for (const row of rows)
    for (const key of Object.keys(row)) {
      keys.add(key)
      if (keys.size > CSV_LIMITS.columns) throw new Error('CSV: too many columns')
    }
  const headers = [...keys]
  validateHeader(headers)
  if (!headers.length) throw new Error('CSV: at least one column is required')
  const lines = [headers.map(encodeField).join(',')]
  let total = bytes('\uFEFF' + lines[0] + '\r\n')
  for (const row of rows) {
    const line = headers.map((header) => encodeField(Object.hasOwn(row, header) ? row[header] : '')).join(',')
    total += bytes(line + '\r\n')
    if (total > CSV_LIMITS.bytes) throw new Error('CSV: output exceeds byte limit')
    lines.push(line)
  }
  // BOM preserves Cyrillic names when opened directly in common spreadsheet software.
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}
