// Собирает SQL для наполнения адвента из src/lib/adventSeed.json — того же файла, что питает демо-режим.
// Запуск: node content/advent/build.mjs > content/advent/seed.sql
// Результат идемпотентен: двери перезаписываются по номеру дня, награды — по числу дверей.
import { readFileSync } from 'node:fs'

const seed = JSON.parse(readFileSync(new URL('../../src/lib/adventSeed.json', import.meta.url), 'utf8'))

const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const j = (v) => `${q(JSON.stringify(v ?? []))}::jsonb`

const problems = []
for (const d of seed.doors) {
  if (!['quiz', 'scratch', 'arcade', 'story'].includes(d.kind)) problems.push(`день ${d.day}: неизвестный kind ${d.kind}`)
  for (const [i, x] of (d.quiz ?? []).entries()) {
    if (!(x.correct >= 0 && x.correct < x.options.length)) problems.push(`день ${d.day}, вопрос ${i + 1}: correct вне вариантов`)
  }
  if (d.kind === 'quiz' && !(d.quiz ?? []).length) problems.push(`день ${d.day}: квиз без вопросов`)
  if (d.kind === 'scratch' && !d.prize) problems.push(`день ${d.day}: скретч без приза`)
}
const days = seed.doors.map((d) => d.day)
if (new Set(days).size !== days.length) problems.push('номера дней повторяются')
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const doors = seed.doors
  .map(
    (d) =>
      `  (${d.day}, ${q(d.kind)}, ${q(d.title)}, ${q(d.subtitle ?? '')}, ${q(d.emoji ?? '🎁')}, ${q(d.body ?? '')}, ${j(d.quiz)}, ${q(d.prize ?? '')}, ${q(JSON.stringify(d.arcade ?? {}))}::jsonb, ${d.xp ?? 30})`,
  )
  .join(',\n')

const rewards = seed.rewards
  .map((r, i) => `  (${r.doors}, ${q(r.title)}, ${q(r.description ?? '')}, ${q(r.emoji ?? '🎁')}, ${r.stock ?? 'null'}, ${i})`)
  .join(',\n')

console.log(`-- Сгенерировано content/advent/build.mjs из src/lib/adventSeed.json. Не править руками.
begin;

insert into public.advent_doors (day, kind, title, subtitle, emoji, body, quiz, prize, arcade, xp) values
${doors}
on conflict (day) do update set
  kind = excluded.kind, title = excluded.title, subtitle = excluded.subtitle, emoji = excluded.emoji, body = excluded.body,
  quiz = excluded.quiz, prize = excluded.prize, arcade = excluded.arcade, xp = excluded.xp, updated_at = now();

-- Награды заменяются целиком, только пока не выдано ни одного кода: иначе выданные коды потеряли бы ступень.
do $$
begin
  if not exists (select 1 from public.reward_codes) then
    delete from public.advent_rewards;
    insert into public.advent_rewards (doors, title, description, emoji, stock, position) values
${rewards.replace(/^/gm, '    ')};
  else
    raise notice 'Коды уже выдавались — награды не тронуты. Меняй их точечно через update.';
  end if;
end $$;

commit;`)
