// Собирает сезон «Новогодний AI-адвент» из материалов (ai-winter-2026.json) и плана дверей (ai-winter-2026.doors.json).
// Материалы заданий не меняются: скрипт только раскладывает их по дверям прежнего календаря.
//   node content/advent/build-season.mjs           проверка: сгенерированные файлы совпадают с источниками
//   node content/advent/build-season.mjs --write   пересобрать src/lib/adventSeasonSeed.json и ai-winter-2026.seed.sql
// XP дверей повторяют правила прежней кампании (src/lib/adventSeed.json): квиз 30, скретч 25, аркада 20, история 15,
// финальная дверь 50. Призы сезона здесь не задаются: их назначает владелец в Админка -> Адвент -> «Призы».
import { readFileSync, writeFileSync } from 'node:fs'

export const SEASON = 'ai-winter-2026'
const XP = { quiz: 30, scratch: 25, arcade: 20, story: 15 }
const FINAL_XP = 50
const ARCADE = { seconds: 30, cap: 40 }
const file = (name) => new URL(name, import.meta.url)
const SEED_JSON = file('../../src/lib/adventSeasonSeed.json')
const SEED_SQL = file('./ai-winter-2026.seed.sql')

function body(m, kind) {
  const parts = [m.teaser, `**Что сделать · ${m.minutes} мин**`, m.body.map((step, i) => `${i + 1}. ${step}`).join('\n')]
  // У скретч-двери промпт лежит под защитным слоем, повторять его в тексте не нужно.
  if (kind !== 'scratch') parts.push('**Промпт в дело**', '```text\n' + m.prompt + '\n```')
  parts.push('**Твой результат**', m.deliverable, '**Проверь себя**', m.check, '**Усложни задачу**', m.advanced)
  return parts.join('\n\n')
}

export function buildDoors() {
  const missions = JSON.parse(readFileSync(file('./ai-winter-2026.json'), 'utf8'))
  const plan = JSON.parse(readFileSync(file('./ai-winter-2026.doors.json'), 'utf8'))
  const problems = []
  if (missions.length !== 53 || plan.length !== 53) problems.push('в сезоне должно быть 53 задания и 53 двери')
  const doors = plan.map((p, i) => {
    const m = missions[i]
    const day = i + 1
    const at = new Date(Date.UTC(2026, 10, 14 + i)).toISOString().slice(0, 10)
    if (p.day !== day) problems.push(`день ${day}: номер в плане ${p.day}`)
    if (m?.date !== at) problems.push(`день ${day}: дата задания ${m?.date}, ожидалась ${at}`)
    if (!(p.kind in XP)) problems.push(`день ${day}: неизвестный вид ${p.kind}`)
    const quiz = p.kind === 'quiz' ? (p.quiz ?? []) : []
    if (p.kind === 'quiz' && quiz.length < 2) problems.push(`день ${day}: в квизе меньше двух вопросов`)
    for (const [n, q] of quiz.entries()) {
      if (!q.q || q.q.length > 300) problems.push(`день ${day}, вопрос ${n + 1}: текст`)
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4 || q.options.some((o) => !o || o.length > 160)) problems.push(`день ${day}, вопрос ${n + 1}: варианты`)
      if (!(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length)) problems.push(`день ${day}, вопрос ${n + 1}: correct вне вариантов`)
      if (!q.explain || q.explain.length > 400) problems.push(`день ${day}, вопрос ${n + 1}: объяснение`)
    }
    const door = {
      day,
      kind: p.kind,
      title: m.title,
      subtitle: m.teaser,
      emoji: p.emoji,
      xp: day === 53 ? FINAL_XP : XP[p.kind],
      body: body(m, p.kind),
      ...(p.kind === 'quiz' ? { quiz } : {}),
      ...(p.kind === 'scratch' ? { prize: m.prompt } : {}),
      ...(p.kind === 'arcade' ? { arcade: ARCADE } : {}),
    }
    if (door.title.length > 80 || door.subtitle.length > 160 || (door.prize ?? '').length > 500 || !door.emoji) problems.push(`день ${day}: поля двери вне пределов редактора`)
    // Короткое тире допустимо только в числовом диапазоне («15–30 секунд»).
    if (/—|(?<!\d)–|–(?!\d)/.test(JSON.stringify(door))) problems.push(`день ${day}: длинное тире`)
    return door
  })
  // Правильный вариант не должен всегда стоять на одном месте: иначе квиз угадывается без чтения.
  const positions = new Set(doors.flatMap((d) => (d.quiz ?? []).map((q) => q.correct)))
  if (positions.size < 3) problems.push('правильные ответы квизов стоят на одной позиции')
  if (problems.length) throw new Error(problems.join('\n'))
  return doors
}

const q = (v) => `'${String(v ?? '').replace(/'/g, "''")}'`
const j = (v) => `${q(JSON.stringify(v))}::jsonb`

export function buildSql(doors) {
  const rows = doors
    .map((d) => `  (${q(SEASON)}, ${d.day}, ${q(d.kind)}, ${q(d.title)}, ${q(d.subtitle)}, ${q(d.emoji)}, ${q(d.body)}, ${j(d.quiz ?? [])}, ${q(d.prize ?? '')}, ${j(d.arcade ?? {})}, ${d.xp})`)
    .join(',\n')
  return `-- Сгенерировано content/advent/build-season.mjs. Не править руками.
-- Двери сезона ${SEASON}. Требует миграцию 20261115120000_advent_seasons.sql и Edge Function api с поддержкой сезонов.
-- Повторный запуск безопасен: уже открытую кем-то дверь скрипт не меняет, двери и открытия прежней кампании не трогает.
-- Сезон этим файлом не включается: см. ai-winter-2026.activate.sql.
begin;

insert into public.advent_seasons (id) values (${q(SEASON)}) on conflict (id) do nothing;

insert into public.advent_doors (season, day, kind, title, subtitle, emoji, body, quiz, prize, arcade, xp) values
${rows}
on conflict (season, day) do update set
  kind = excluded.kind, title = excluded.title, subtitle = excluded.subtitle, emoji = excluded.emoji, body = excluded.body,
  quiz = excluded.quiz, prize = excluded.prize, arcade = excluded.arcade, xp = excluded.xp, updated_at = now()
  where not exists (select 1 from public.advent_opens o where o.season = excluded.season and o.day = excluded.day);

commit;
`
}

export const seedJson = (doors) => JSON.stringify({ _note: 'Сгенерировано content/advent/build-season.mjs из ai-winter-2026.json и ai-winter-2026.doors.json. Не править руками.', season: SEASON, start: '2026-11-14', days: 53, title: 'Новогодний AI-адвент', theme: 'newyear', doors }, null, 2) + '\n'

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop())) {
  const doors = buildDoors()
  if (process.argv.includes('--write')) {
    writeFileSync(SEED_JSON, seedJson(doors))
    writeFileSync(SEED_SQL, buildSql(doors))
    console.log(`Сезон ${SEASON}: ${doors.length} дверей записано.`)
  } else {
    const stale = [[SEED_JSON, seedJson(doors)], [SEED_SQL, buildSql(doors)]].filter(([path, text]) => readFileSync(path, 'utf8') !== text)
    if (stale.length) {
      console.error('Сгенерированные файлы устарели. Запусти: node content/advent/build-season.mjs --write')
      process.exit(1)
    }
    console.log(`Сезон ${SEASON}: ${doors.length} дверей, файлы актуальны.`)
  }
}
