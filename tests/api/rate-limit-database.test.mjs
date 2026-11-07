// Isolated PostgreSQL/WASM check of the existing limiter used by the main API.
// No production connection, migrations applied to managed services, or paid content.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('existing PostgreSQL rate limiter enforces key isolation, boundary and expiry', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  const sql = await readFile(new URL('../../supabase/migrations/20261016195015_az_master.sql', import.meta.url), 'utf8')
  const definition = sql.match(/create function public\.az_rate_limit\([\s\S]*?end \$\$;/)?.[0]
  assert.ok(definition, 'Use the existing migration implementation, not a reimplemented limiter')
  await db.exec('create table public.az_rate_limits (key text primary key, window_at timestamptz not null, count integer not null);')
  await db.exec(definition)
  const limit = async key => (await db.query('select public.az_rate_limit($1, 120, 60) as allowed', [key])).rows[0].allowed
  // PGlite serializes execution; this is not a multi-connection concurrency/load test.
  const results = await Promise.all(Array.from({ length: 121 }, () => limit('api:user:2')))
  assert.equal(results.filter(Boolean).length, 120)
  assert.equal(results.at(-1), false)
  assert.equal(await limit('api:user:3'), true)
  assert.equal(await limit('api:anon:redeem'), true)
  await db.exec("update public.az_rate_limits set window_at = now() - interval '61 seconds' where key = 'api:user:2'")
  assert.equal(await limit('api:user:2'), true)
  assert.equal((await db.query("select count from public.az_rate_limits where key = 'api:user:2'")).rows[0].count, 1)
  await db.exec("insert into public.az_rate_limits values ('expired-fixture', now() - interval '3 days', 1)")
  await limit('api:user:2')
  assert.equal((await db.query("select count(*)::integer as n from public.az_rate_limits where key = 'expired-fixture'")).rows[0].n, 0)
})
