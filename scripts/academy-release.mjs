import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { composeLearningCatalog, contentSql, loadAuthoredPacks } from './academy-content.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const defaultProject = 'dcdepwdxvadhludnubis'
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`

/** Uses existing Academy validators; never pushes or repairs the migration history. */
export function academyReleasePlan(base, packs, actor, course) {
  if (!/^[1-9]\d*$/.test(actor || '') || BigInt(actor) > 9223372036854775807n) throw new Error('--actor must be the existing administrator Telegram ID')
  const selected = course ? packs.filter(pack => pack.course_code === course) : packs
  if (!selected.length) throw new Error('Unknown authored course')
  const catalog = composeLearningCatalog(base, packs)
  // Preserve the initial two-course receipt format used by earlier releases.
  const initial = course ? [] : packs.filter(pack => ['CORE-000','VC-101'].includes(pack.course_code))
  const grouped = initial.length === 2 ? initial : []
  return [
    { name: 'curriculum', sql: `begin;\nselect public.academy_action(${actor},'admin_import',${literal({ ...base, dry_run: false })});\ncommit;\n` },
    ...(grouped.length ? [{ name: 'CORE-000-VC-101', sql: contentSql(composeLearningCatalog(base, grouped), actor) }] : []),
    ...selected.filter(pack => !grouped.includes(pack)).map(pack => ({ name: pack.course_code, sql: contentSql(catalog, actor, pack.course_code) })),
  ]
}

export async function managementQuery(project, token, sql, fetcher = fetch) {
  if (!/^[a-z]{20}$/.test(project)) throw new Error('Invalid Supabase project ref')
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required in secure environment settings')
  const response = await fetcher(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }), signal: AbortSignal.timeout(60_000),
  }).catch(() => { throw new Error('Supabase Management API is unreachable; check the environment network settings') })
  // Do not echo database errors, source SQL, auth headers or provider response bodies.
  if (!response.ok) throw new Error(`Supabase query rejected (HTTP ${response.status}); no automatic migration retry`)
  return response.json()
}

async function main(args) {
  const option = name => args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1)
  const allowed = /^(?:--check|--publish|--actor=[1-9]\d*|--course=[A-Z]+-\d{3}|--project=[a-z]{20})$/
  if (args.some(arg => !allowed.test(arg))) throw new Error('Usage: academy:release -- --check OR --actor=TELEGRAM_ID [--course=CODE] [--publish] [--project=REF]')
  const project = option('--project') || defaultProject
  const query = sql => managementQuery(project, process.env.SUPABASE_ACCESS_TOKEN, sql)
  if (args.includes('--check')) {
    const rows = await query("select to_regprocedure('public.academy_action(bigint,text,jsonb)') is not null as api_ready,to_regclass('public.aa_nodes') is not null as schema_ready")
    console.log(JSON.stringify(rows))
    if (!rows[0]?.api_ready || !rows[0]?.schema_ready) throw new Error('Academy schema is not ready; inspect the recorded migration history before deploying')
    const counts = await query("select kind,state,count(*)::integer as count from public.aa_nodes group by kind,state order by kind,state")
    console.log(JSON.stringify(counts))
    return
  }
  const actor = option('--actor')
  const base = JSON.parse(await readFile(path.join(root, 'content/ai-academy/catalog.normalized.json'), 'utf8'))
  const plan = academyReleasePlan(base, await loadAuthoredPacks(), actor, option('--course'))
  const directory = path.join(root, 'content/ai-academy/generated/release')
  await mkdir(directory, { recursive: true })
  for (let i = 0; i < plan.length; i++) await writeFile(path.join(directory, `${String(i).padStart(2, '0')}-${plan[i].name}.sql`), plan[i].sql)
  console.log(`Exported ${plan.length} SQL files to content/ai-academy/generated/release. No database writes during export.`)
  if (!args.includes('--publish')) return
  const status = await query(`select to_regprocedure('public.academy_action(bigint,text,jsonb)') is not null as api_ready, exists(select 1 from public.settings,jsonb_each(settings.value) v where settings.key='admins' and jsonb_typeof(v.value)='number' and v.value=to_jsonb(${actor}::bigint)) as actor_is_admin`)
  if (!status[0]?.api_ready || !status[0]?.actor_is_admin) throw new Error('Preflight rejected: Academy RPC or administrator is unavailable')
  await query(`select public.academy_action(${actor},'admin_import',${literal({ ...base, dry_run: true })})`)
  for (const step of plan) {
    await query(step.sql)
    console.log(`Applied ${step.name} through Academy validators.`)
  }
  console.log('Publication queries completed. Verify signed Telegram access and lesson delivery before declaring the main app ready.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1 })
}
