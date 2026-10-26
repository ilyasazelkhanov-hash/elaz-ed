import {readFile,lstat,realpath} from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
const exec=promisify(execFile)
export async function assetPath(root,name){
 if(typeof name!=='string'||!/^assets\/[a-z0-9-]+\.(png|svg|mp4|vtt|wav)$/.test(name))throw Error('asset_path')
 const base=await realpath(root),target=path.resolve(base,name),stat=await lstat(target)
 if(stat.isSymbolicLink()||!stat.isFile()||!(await realpath(target)).startsWith(base+path.sep))throw Error('asset_path')
 return target
}
export function quote(budget){
 for(const field of ['hours','rate','tools','revisions','hours_per_revision','price'])if(!Number.isFinite(budget[field])||budget[field]<0)throw Error('invalid_budget')
 if(!budget.price)throw Error('invalid_price')
 const cost=(budget.hours+budget.revisions*budget.hours_per_revision)*budget.rate+budget.tools
 return{cost,price:budget.price,margin:(budget.price-cost)/budget.price,unit:budget.unit,fictional:true}
}
export function consistency(cases,bible){
 return cases.map(row=>({id:row.id,origin:row.origin,issues:['handles','patch_side','stitch_rows'].filter(key=>row[key]!==bible[key]).concat(row.unknown_mark?['unknown_mark']:[])}))
}
export async function fingerprint(root,manifest){
 const hash=createHash('sha256').update(JSON.stringify(manifest))
 const names=[...new Set(manifest.assets.flatMap(asset=>[asset.file,...asset.dependencies||[]]))].sort()
 for(const name of names)hash.update(name).update(await readFile(await assetPath(root,name)))
 return hash.digest('hex')
}
export async function inspect(root,manifest){
 const issues=[],seen=new Set()
 if(manifest.fictional!==true)issues.push('fictional_label_required')
 for(const asset of manifest.assets){
  if(seen.has(asset.id))issues.push(`${asset.id}:duplicate_id`);seen.add(asset.id)
  if(!asset.alt?.trim())issues.push(`${asset.id}:missing_alt`)
  if(!['owned','licensed'].includes(asset.rights?.state)||!asset.rights?.record)issues.push(`${asset.id}:rights_unresolved`)
  if(!asset.origin)issues.push(`${asset.id}:origin_required`)
  for(const claim of asset.claims||[])if(!manifest.facts.some(f=>f.id===claim.evidence_id))issues.push(`${asset.id}:unsupported_claim`)
  const file=await assetPath(root,asset.file)
  if(asset.file.endsWith('.png')){
   const bytes=await readFile(file)
   if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==asset.width||bytes.readUInt32BE(20)!==asset.height)issues.push(`${asset.id}:dimensions`)
  }else if(asset.file.endsWith('.mp4')){
   const {stdout}=await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file])
   const probe=JSON.parse(stdout),video=probe.streams.find(s=>s.codec_type==='video')
   if(video?.width!==asset.width||video?.height!==asset.height||Math.abs(Number(probe.format.duration)-asset.seconds)>.2)issues.push(`${asset.id}:media_spec`)
   if(!probe.streams.some(s=>s.codec_type==='audio'))issues.push(`${asset.id}:audio_missing`)
   if(!asset.dependencies?.some(name=>name.endsWith('.vtt')))issues.push(`${asset.id}:captions_missing`)
  }
 }
 return{issues,digest:await fingerprint(root,manifest),budget:quote(manifest.budget),note:'Technical checks do not judge visual truth, legal rights or commercial effectiveness.'}
}
export async function approve(root,manifest,reviewer,note){
 const result=await inspect(root,manifest)
 if(result.issues.length)throw Error('qa_failed')
 if(!reviewer||reviewer===manifest.creator||!note?.trim())throw Error('independent_review_required')
 return{digest:result.digest,reviewer,note,approved_at:new Date().toISOString(),scope:'local_learning_only'}
}
export async function release(root,manifest,approval){
 const result=await inspect(root,manifest)
 if(result.issues.length)throw Error('qa_failed')
 if(!approval||approval.digest!==result.digest||!approval.reviewer||approval.reviewer===manifest.creator||!approval.note?.trim())throw Error('approval_missing_or_stale')
 return{digest:result.digest,assets:manifest.assets.map(asset=>asset.file),reviewer:approval.reviewer,budget:result.budget,scope:'local_export_not_publication'}
}
