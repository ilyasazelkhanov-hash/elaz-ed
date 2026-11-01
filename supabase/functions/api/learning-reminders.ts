export function learningLocalParts(timezone: string, date = new Date()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short', hour: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map((p) => [p.type, p.value]))
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const local = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)))
  const monday = new Date(local)
  monday.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7))
  return { day: weekdays[values.weekday] ?? 0, hour: Number(values.hour), week: monday.toISOString().slice(0, 10) }
}

/** UTC instant corresponding to midnight at a local ISO date, including DST offsets. */
export function localMidnightUtc(day: string, timezone: string) {
  const guess = Date.parse(`${day}T00:00:00.000Z`)
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]))
  const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  return new Date(guess - (represented - guess)).toISOString()
}
