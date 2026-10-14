import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const base='https://dcdepwdxvadhludnubis.supabase.co'
const manifest=JSON.parse(await readFile(new URL('./assets-manifest.json',import.meta.url),'utf8'))
const checks=[]
for(let i=0;i<manifest.length;i+=5)await Promise.all(manifest.slice(i,i+5).map(async item=>{
  const r=await fetch(base+'/storage/v1/object/public/learning-content/'+item.name,{signal:AbortSignal.timeout(30000)})
  const bytes=Buffer.from(await r.arrayBuffer())
  const sha256=createHash('sha256').update(bytes).digest('hex')
  checks.push({file:item.name,status:r.status,bytes:bytes.length,match:r.ok&&sha256===item.sha256})
}))
const health=await (await fetch(base+'/functions/v1/api/health')).json()
const unauth=await fetch(base+'/functions/v1/api/boot',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
const unauthBody=await unauth.json()
const result={checked_at:new Date().toISOString(),health,authentication:{status:unauth.status,error:unauthBody.error},assets:{count:checks.length,passed:checks.filter(x=>x.match).length,bytes:checks.reduce((n,x)=>n+x.bytes,0)},checks}
await writeFile(new URL('./verification.json',import.meta.url),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({...result,checks:checks.filter(x=>!x.match)}))
if(checks.some(x=>!x.match)||unauth.status!==401||!health.ok||!health.channel)process.exitCode=1
