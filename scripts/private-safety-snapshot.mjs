// Explicit operator action only. Captures private app data into an ignored directory.
// No production writes, no automatic restore, no credentials or rows in console output.
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdir,writeFile,readFile,chmod} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {fileURLToPath,pathToFileURL} from 'node:url'
import path from 'node:path'
const execute=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url))
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex')
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
export function snapshotSummary(snapshot) {
  if(snapshot?.format!=='application-safety-snapshot-v1'||!snapshot.tables||typeof snapshot.tables!=='object')throw Error('Invalid snapshot')
  const tables=Object.entries(snapshot.tables).sort(([a],[b])=>a.localeCompare(b)).map(([name,rows])=>{
    if(!Array.isArray(rows)||rows.length!==snapshot.row_counts?.[name])throw Error('Snapshot row count mismatch')
    return {name,rows:rows.length,sha256:sha256(JSON.stringify(rows.map(row=>JSON.stringify(canonical(row))).sort()))}
  })
  return {format:snapshot.format,tables,table_count:tables.length,total_rows:tables.reduce((sum,table)=>sum+table.rows,0),metadata_sha256:sha256(JSON.stringify(canonical(snapshot.metadata))),storage_inventory_sha256:sha256(JSON.stringify(canonical(snapshot.storage_inventory))),full_restore_proven:false,storage_bytes_captured:false}
}
export async function privateSafetySnapshot({cli,projectRef}) {
  if(!cli||!/^[a-z]{20}$/.test(projectRef??''))throw Error('Explicit CLI and project ref required')
  const relative=`test-results/recovery/${new Date().toISOString().replaceAll(':','-')}`
  const output=path.join(root,relative)
  // Refuse to create sensitive material unless this path is actually ignored by Git.
  await execute('git',['check-ignore','--quiet',`${relative}/application-snapshot.json`],{cwd:root,windowsHide:true})
  await mkdir(output,{recursive:true,mode:0o700})
  const run=async(name,sql)=>{
    const file=path.join(output,`${name}.sql`)
    await writeFile(file,sql,{mode:0o600})
    const {stdout}=await execute(cli,['db','query','--linked','--project-ref',projectRef,'--file',file,'--output','json'],{cwd:root,windowsHide:true,maxBuffer:256*1024*1024,timeout:180000})
    // Never forward CLI output; data stays in private files and process memory.
    const envelope=JSON.parse(stdout)
    if(!Array.isArray(envelope.rows)||envelope.rows.length!==1)throw Error('Unexpected query envelope')
    return envelope.rows[0]
  }
  const {tables}=await run('table-inventory',"select coalesce(jsonb_agg(c.relname order by c.relname),'[]'::jsonb) as tables from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relispartition;")
  if(!Array.isArray(tables)||!tables.length||tables.some(name=>!/^[a-zA-Z0-9_]+$/.test(name)))throw Error('Unexpected table inventory')
  const tableData=tables.map(name=>`select '${name}'::text as name,coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) as rows from public."${name}" t`).join('\nunion all\n')
  const sql=`with app_rows as (${tableData})
select jsonb_build_object(
 'format','application-safety-snapshot-v1','taken_at',transaction_timestamp(),'project_ref','${projectRef}',
 'tables',(select jsonb_object_agg(name,rows) from app_rows),
 'row_counts',(select jsonb_object_agg(name,jsonb_array_length(rows)) from app_rows),
 'metadata',jsonb_build_object(
  'columns',(select coalesce(jsonb_agg(to_jsonb(c) order by table_name,ordinal_position),'[]'::jsonb) from information_schema.columns c where table_schema='public'),
  'functions',(select coalesce(jsonb_agg(jsonb_build_object('identity',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid)) order by p.oid::regprocedure::text),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p')),
  'views',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'definition',pg_get_viewdef(c.oid,true)) order by c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('v','m')),
  'constraints',(select coalesce(jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid,true)) order by c.conrelid::regclass::text,c.conname),'[]'::jsonb) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'),
  'indexes',(select coalesce(jsonb_agg(to_jsonb(i) order by tablename,indexname),'[]'::jsonb) from pg_indexes i where schemaname='public'),
  'triggers',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true)) order by c.relname,t.tgname),'[]'::jsonb) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal),
  'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by tablename,policyname),'[]'::jsonb) from pg_policies p where schemaname='public'),
  'table_security',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl) order by c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m')),
  'sequences',(select coalesce(jsonb_agg(to_jsonb(s) order by sequencename),'[]'::jsonb) from pg_sequences s where schemaname='public'),
  'enum_types',(select coalesce(jsonb_agg(jsonb_build_object('type',t.typname,'label',e.enumlabel,'order',e.enumsortorder) order by t.typname,e.enumsortorder),'[]'::jsonb) from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname='public')
 ),
 'storage_inventory',jsonb_build_object('buckets',(select coalesce(jsonb_agg(to_jsonb(b) order by id),'[]'::jsonb) from storage.buckets b),'objects',(select coalesce(jsonb_agg(to_jsonb(o) order by bucket_id,name),'[]'::jsonb) from storage.objects o))
) as snapshot;`
  const {snapshot}=await run('capture',sql)
  const bytes=JSON.stringify(snapshot)
  const file=path.join(output,'application-snapshot.json')
  await writeFile(file,bytes,{mode:0o600});await chmod(file,0o600).catch(()=>{})
  const first=snapshotSummary(snapshot),second=snapshotSummary(JSON.parse(await readFile(file,'utf8')))
  if(JSON.stringify(first)!==JSON.stringify(second))throw Error('Local file roundtrip failed')
  const report={created_at:new Date().toISOString(),project_ref:projectRef,private_file:'application-snapshot.json',bytes:Buffer.byteLength(bytes),snapshot_sha256:sha256(bytes),...second,local_json_roundtrip:true,limits:['Application data and schema metadata only; not a Supabase platform backup','No auth schema, database roles, Edge secrets, function deployment archives or storage file bytes','No database restoration was executed; JSON serialization roundtrip only','No measured recovery time or loss boundary; RTO/RPO remain unverified']}
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600})
  return {directory:relative,...report}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const result=await privateSafetySnapshot({cli:process.env.SUPABASE_CLI,projectRef:process.env.RELEASE_PROJECT_REF});console.log(JSON.stringify({directory:result.directory,table_count:result.table_count,total_rows:result.total_rows,bytes:result.bytes,snapshot_sha256:result.snapshot_sha256,local_json_roundtrip:result.local_json_roundtrip,full_restore_proven:false},null,2))}
  catch{console.error('Private snapshot failed. Check explicit SUPABASE_CLI, RELEASE_PROJECT_REF, CLI access and ignored output path. No query results were logged.');process.exitCode=1}
}
