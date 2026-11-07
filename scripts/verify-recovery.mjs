// Local comparison only: no database connection, restore command, secrets or network access.
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {RELEASE} from './release-contract.mjs'

export const DOMAINS=['users','courses','lessons','payments','course_access','lesson_access','progress','settings','assets']
function canonical(value) {
  if(Array.isArray(value))return value.map(canonical)
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]))
  return value
}
function rowsHash(rows) {return createHash('sha256').update(JSON.stringify(rows.map(row=>JSON.stringify(canonical(row))).sort())).digest('hex')}
function validate(snapshot) {
  const failures=[]
  if(snapshot?.schema!==1)failures.push('snapshot_schema')
  for(const domain of DOMAINS)if(!Array.isArray(snapshot?.[domain])||snapshot[domain].some(row=>!row||typeof row!=='object'||Array.isArray(row)))failures.push(`${domain}_shape`)
  if(failures.length)return failures
  const keys={users:['id'],courses:['id'],lessons:['id'],payments:['id'],course_access:['user_id','course_id'],lesson_access:['user_id','lesson_id'],progress:['user_id','lesson_id'],settings:['key'],assets:['bucket','path']}
  for(const domain of DOMAINS){
    const identities=snapshot[domain].map(row=>keys[domain].map(key=>row[key]))
    if(identities.some(parts=>parts.some(value=>value==null))||new Set(identities.map(value=>JSON.stringify(value))).size!==identities.length)failures.push(`${domain}_identity`)
  }
  const users=new Set(snapshot.users.map(row=>row.id)),courses=new Set(snapshot.courses.map(row=>row.id)),lessons=new Set(snapshot.lessons.map(row=>row.id))
  for(const domain of ['payments','course_access','lesson_access','progress']) {
    if(snapshot[domain].some(row=>!users.has(row.user_id)))failures.push(`${domain}_user_reference`)
  }
  for(const domain of ['payments','course_access','lessons'])if(snapshot[domain].some(row=>row.course_id!=null&&!courses.has(row.course_id)))failures.push(`${domain}_course_reference`)
  for(const domain of ['lesson_access','progress'])if(snapshot[domain].some(row=>!lessons.has(row.lesson_id)))failures.push(`${domain}_lesson_reference`)
  if(!snapshot.settings.some(row=>row.key===`content_revision:${RELEASE.content_revision}`&&row.value&&typeof row.value==='object'))failures.push('required_import_receipt')
  // Asset inventory must be based on actual file bytes, not storage object metadata alone.
  if(snapshot.assets.some(row=>!/^[a-f0-9]{64}$/.test(row.sha256)||!Number.isSafeInteger(row.bytes)||row.bytes<0))failures.push('asset_digest')
  return failures
}
export function reconcileRecovery(expected,actual) {
  const failures=[...validate(expected).map(name=>`source_${name}`),...validate(actual).map(name=>`restored_${name}`)]
  const domains=DOMAINS.map(name=>{
    const source=Array.isArray(expected?.[name])?expected[name]:[],restored=Array.isArray(actual?.[name])?actual[name]:[]
    const matches=rowsHash(source)===rowsHash(restored)
    if(!matches)failures.push(`${name}_mismatch`)
    return {name,source_rows:source.length,restored_rows:restored.length,matches}
  })
  return {schema:1,checked_at:new Date().toISOString(),kind:'local_snapshot_reconciliation',full_restore_proven:false,domains,failures,pass:failures.length===0}
}
export function recoveryFixture() {
  return {schema:1,users:[{id:1,xp:42}],courses:[{id:10,title:'Synthetic course'}],lessons:[{id:20,course_id:10}],payments:[{id:30,user_id:1,course_id:10,stars:100,charge_id:'synthetic-charge',refunded_at:null}],course_access:[{user_id:1,course_id:10,source:'stars'}],lesson_access:[{user_id:1,lesson_id:20,source:'admin'}],progress:[{user_id:1,lesson_id:20,score:3,total:4}],settings:[{key:`content_revision:${RELEASE.content_revision}`,value:{course_ids:[10],lesson_ids:[20]}}],assets:[{bucket:'synthetic',path:'example.txt',bytes:7,sha256:createHash('sha256').update('example').digest('hex')}]}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    const fixture=process.argv[2]==='--fixture'
    if(!fixture&&(!process.argv[2]||!process.argv[3]))throw Error('arguments')
    const source=fixture?recoveryFixture():JSON.parse(await readFile(process.argv[2],'utf8'))
    const restored=fixture?structuredClone(source):JSON.parse(await readFile(process.argv[3],'utf8'))
    const report=reconcileRecovery(source,restored)
    console.log(JSON.stringify({...report,evidence:fixture?'synthetic_fixture_only':'operator_supplied_snapshots'},null,2));process.exitCode=report.pass?0:1
  }catch{console.error('Usage: node scripts/verify-recovery.mjs <source.json> <restored.json> | --fixture. Inputs stay local; no row contents are logged.');process.exitCode=1}
}
