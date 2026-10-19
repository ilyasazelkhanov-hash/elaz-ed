/** Native local PostgreSQL, separate connections. Never connects to a remote database. */
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { Pool } from 'pg'
import assert from 'node:assert/strict'
const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'darwin' : 'linux'
const { initdb, pg_ctl } = await import(`@embedded-postgres/${platform}-${process.arch}`)
const dir = await mkdtemp(path.join(tmpdir(), 'az-native-pg-')),
  data = path.join(dir, 'data'),
  password = randomBytes(24).toString('hex'),
  port = 55437
const run = (bin, args) =>
  new Promise((resolve, reject) => {
    let log = ''
    const child = spawn(bin, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (v) => (log += v))
    child.stderr.on('data', (v) => (log += v))
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve(log) : reject(new Error(`Local PostgreSQL command failed: ${log}`)),
    )
  })
const pw = path.join(dir, 'password.txt')
await writeFile(pw, password)
let pool,
  started = false
const report = { checks: [], server: '', dataDirectory: dir }
try {
  await run(initdb, [
    '-D',
    data,
    '-U',
    'az_test',
    '--pwfile',
    pw,
    '-A',
    'scram-sha-256',
    '--encoding=UTF8',
    '--locale=C',
  ])
  console.log('Native PostgreSQL cluster initialised')
  await run(pg_ctl, ['-D', data, '-l', path.join(dir, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start'])
  started = true
  pool = new Pool({ host: '127.0.0.1', port, user: 'az_test', password, database: 'postgres', max: 8,connectionTimeoutMillis:10000,statement_timeout:30000 })
  report.server = (await pool.query('select version()')).rows[0].version
  await pool.query('create role anon;create role authenticated;create role service_role bypassrls')
  const migrations = new URL('../supabase/migrations/', import.meta.url)
  for (const file of (await readdir(migrations)).sort())
    await pool.query(await readFile(new URL(file, migrations), 'utf8'))
  const rpc = async (name, args = []) =>
    (await pool.query(`select ${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) value`, args.map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v))).rows[0].value
  const dispatch = (id, action, payload = {}) => rpc('az_dispatch', [id, action, payload])
  const config = JSON.parse(await readFile(new URL('../app.config.json', import.meta.url))),
    brand = JSON.parse(await readFile(new URL('../brand.config.json', import.meta.url)))
  config.access = 'telegram'
  await rpc('az_authenticate', [{ id: '1', name: 'Owner' }, true])
  await rpc('az_provision', [1, config, brand, [], {}])
  for (const id of [2, 3, 4]) await rpc('az_authenticate', [{ id: String(id), name: 'Member ' + id }, false])
  const entity = (id, kind, module, data = {}, extra = {}) => ({
    id,
    kind,
    module,
    title: id,
    subtitle: '',
    body: '',
    tag: '',
    cover: '',
    published: true,
    publishAt: null,
    audience: 'all',
    price: 0,
    capacity: null,
    data,
    ...extra,
  })
  await dispatch(1, 'admin.entity.save', {
    entity: entity('last-prize', 'reward', 'loyalty', { pointsCost: 60 }, { capacity: 1 }),
  })
  await pool.query('update az_members set points=100 where id in (2,3,4)')
  const prizes = await Promise.allSettled([
    dispatch(2, 'reward.claim', { entityId: 'last-prize' }),
    dispatch(3, 'reward.claim', { entityId: 'last-prize' }),
  ])
  assert.equal(prizes.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(Number((await pool.query('select sum(points) n from az_members where id in (2,3)')).rows[0].n), 140)
  report.checks.push('Two connections race for final prize: one coupon, one debit, stock zero')
  for (const id of ['reward-a', 'reward-b'])
    await dispatch(1, 'admin.entity.save', {
      entity: entity(id, 'reward', 'loyalty', { pointsCost: 60 }, { capacity: 10 }),
    })
  const debit = await Promise.allSettled(
    ['reward-a', 'reward-b'].map((entityId) => dispatch(4, 'reward.claim', { entityId })),
  )
  assert.equal(debit.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal((await pool.query('select points from az_members where id=4')).rows[0].points, 40)
  report.checks.push('Concurrent different rewards cannot overdraw one balance')
  await dispatch(1, 'admin.entity.save', {
    entity: entity('last-seat', 'event', 'events', { startsAt: '2099-01-01T12:00:00Z' }, { capacity: 1 }),
  })
  await Promise.all([
    dispatch(2, 'event.book', { entityId: 'last-seat' }),
    dispatch(3, 'event.book', { entityId: 'last-seat' }),
  ])
  assert.equal((await pool.query("select count(*)::integer n from az_bookings where status='confirmed'")).rows[0].n, 1)
  assert.equal((await pool.query("select count(*)::integer n from az_bookings where status='waitlist'")).rows[0].n, 1)
  report.checks.push('Concurrent booking produces one confirmed seat and one waitlist')
  const code = (await pool.query('select code from az_coupons limit 1')).rows[0].code
  const redemption = await Promise.allSettled([
    dispatch(1, 'coupon.redeem', { code, pointId: 'main' }),
    dispatch(1, 'coupon.redeem', { code, pointId: 'main' }),
  ])
  assert.equal(redemption.filter((r) => r.status === 'fulfilled').length, 1)
  report.checks.push('Concurrent redemption commits exactly once')
  await dispatch(1,'admin.entity.save',{entity:entity('order-item','product','commerce',{}, {price:10,capacity:5})})
  const intent={requestId:crypto.randomUUID(),items:[{entityId:'order-item',quantity:1,variant:''}],note:'one order'}
  const orders=await Promise.all([dispatch(2,'order.create',intent),dispatch(2,'order.create',intent)])
  assert.equal(orders[0].result.orderId,orders[1].result.orderId)
  assert.equal((await pool.query("select capacity from az_entities where id='order-item'")).rows[0].capacity,4)
  report.checks.push('Concurrent retries of one order reserve inventory once')
  if(process.argv.includes('--og-root')) {
    const ogRoot=path.resolve(process.argv[process.argv.indexOf('--og-root')+1])
    await pool.query('create database og_upgrade')
    const upgrade=new Pool({host:'127.0.0.1',port,user:'az_test',password,database:'og_upgrade',connectionTimeoutMillis:10000})
    try{
      // Supabase platform catalog fixture; no cloud storage operation is simulated.
      await upgrade.query('create schema extensions;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])')
      const folder=path.join(ogRoot,'supabase','migrations'),files=(await readdir(folder)).sort()
      for(const file of files.filter(f=>/^\d{3}_/.test(f)))await upgrade.query(await readFile(path.join(folder,file),'utf8'))
      await upgrade.query('insert into users(id,xp) values(777,123)')
      for(const file of files.filter(f=>/^20261016/.test(f)))await upgrade.query(await readFile(path.join(folder,file),'utf8'))
      assert.equal((await upgrade.query('select xp from users where id=777')).rows[0].xp,123)
      assert.equal((await upgrade.query("select count(*)::integer n from pg_tables where schemaname='public' and tablename='az_quiz_attempts'")).rows[0].n,1)
      report.checks.push('All 11 original OG migrations and both new migrations apply; existing OG XP preserved')
    }finally{await upgrade.end()}
  }
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/concurrency-report.json', JSON.stringify(report, null, 2))
  console.log('PASS ' + report.checks.join('\nPASS '))
} finally {
  await pool?.end()
  if (started) await run(pg_ctl, ['-D', data, '-m', 'fast', '-w', 'stop'])
}
