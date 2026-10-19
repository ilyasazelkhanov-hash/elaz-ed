// SQL verification on local WASM PostgreSQL. No network or managed DB operations.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const { PGlite } = require('@electric-sql/pglite')

test('ordinary quiz migration enforces persisted ordering and reward integrity in PostgreSQL', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  await db.exec(await readFile(path.join(root, 'supabase/migrations/001_init.sql'), 'utf8'))
  await db.exec(await readFile(path.join(root, 'supabase/migrations/20261016201213_ordinary_quiz_attempts.sql'), 'utf8'))
  await db.exec('grant all on public.users, public.lessons, public.progress to service_role;')
  await db.exec(`insert into users(id) values(1),(2);`)
  const quiz = [{ q: 'One?', options: ['No', 'Yes'], correct: 1, explain: 'One explanation' }, { q: 'Two?', options: ['Yes', 'No'], correct: 0, explain: 'Two explanation' }, { q: 'Three?', options: ['No', 'Yes'], correct: 1, explain: 'Three explanation' }]
  await db.query('insert into lessons(title,xp,quiz) values($1,50,$2::jsonb)', ['Quiz', JSON.stringify(quiz)])
  const rpc = async (name, args) => (await db.query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as value`, args)).rows[0].value
  const start = user => rpc('start_lesson_quiz', [user, 1])
  const answer = (user, id, index, value) => rpc('answer_lesson_quiz', [user, id, index, value])

  await t.test('direct fabricated completion rejected before attempt', async () => {
    await assert.rejects(rpc('complete_lesson', [1, 1, 3, 3, 95]), /quiz_required/)
    assert.equal((await db.query('select count(*)::integer as n from progress')).rows[0].n, 0)
  })
  let attempt
  await t.test('start resumes first attempt and ignores practice before progress', async () => {
    const [a, b] = await Promise.all([start(1), start(1)])
    attempt = a
    assert.equal(a.id, b.id)
    assert.equal(a.practice, false)
    assert.deepEqual(a.answers, [])
  })
  await t.test('answer commit is sequential, actor-bound, immutable and replayable', async () => {
    await assert.rejects(answer(2, attempt.id, 0, 1), /quiz_not_found/)
    await assert.rejects(answer(1, attempt.id, 1, 0), /quiz_sequence/)
    await assert.rejects(answer(1, attempt.id, 0, 3), /quiz_answer_invalid/)
    const [first, changed] = await Promise.allSettled([answer(1, attempt.id, 0, 0), answer(1, attempt.id, 0, 1)])
    assert.equal(first.status, 'fulfilled')
    assert.equal(first.value.correct, false)
    assert.equal(first.value.correctIndex, 1)
    assert.equal(changed.status, 'rejected')
    assert.match(changed.reason.message, /quiz_answer_locked/)
    assert.deepEqual(await answer(1, attempt.id, 0, 0), first.value)
    await assert.rejects(rpc('complete_lesson', [1, 1, 3, 3, 95]), /quiz_required/)
  })
  await t.test('complete uses immutable result, original combo, and rewards once', async () => {
    await answer(1, attempt.id, 1, 0)
    const last = await answer(1, attempt.id, 2, 1)
    assert.equal(last.score, 2)
    assert.equal(last.bonus, 25)
    assert.equal(last.done, true)
    await assert.rejects(rpc('complete_lesson', [1, 1, 3, 3, 95]), /quiz_answers_mismatch/)
    assert.equal(await rpc('complete_lesson', [1, 1, 2, 3, 75]), true)
    assert.equal(await rpc('complete_lesson', [1, 1, 2, 3, 75]), false)
    assert.deepEqual((await db.query('select xp,lessons_done from users where id=1')).rows[0], { xp: 75, lessons_done: 1 })
  })
  await t.test('practice only after completed lesson cannot upgrade stored score or rewards', async () => {
    const practice = await start(1)
    assert.equal(practice.practice, true)
    assert.notEqual(practice.id, attempt.id)
    for (const [i, value] of [1, 0, 1].entries()) await answer(1, practice.id, i, value)
    await assert.rejects(rpc('complete_lesson', [1, 1, 3, 3, 95]), /quiz_answers_mismatch/)
    assert.equal((await db.query('select score from progress where user_id=1')).rows[0].score, 2)
  })
  await t.test('question snapshot survives editor changes and original keys never regrade', async () => {
    const second = await start(2)
    await db.query(`update lessons set quiz=jsonb_set(quiz,'{0,correct}','0') where id=1`)
    const feedback = await answer(2, second.id, 0, 1)
    assert.equal(feedback.correct, true)
    assert.equal(feedback.correctIndex, 1)
  })
  await t.test('anonymous/authenticated clients cannot read keys or call private RPCs', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await assert.rejects(db.query('select * from lesson_quiz_attempts'), /permission denied/)
      await assert.rejects(start(1), /permission denied/)
      await assert.rejects(answer(1, attempt.id, 0, 1), /permission denied/)
      await db.exec('reset role')
    }
  })
})
