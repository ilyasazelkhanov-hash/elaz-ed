import {readFile,writeFile} from 'node:fs/promises'
const dir=new URL('./',import.meta.url)
const source=JSON.parse(await readFile(new URL('source.json',dir),'utf8'))
const queue=[...source.catalog], checks=[]
await Promise.all(Array.from({length:6},async()=>{while(queue.length){const course=queue.shift();try{
const r=await fetch(course.url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0'}})
await r.body?.cancel()
checks.push({id:course.id,url:course.url,status:r.status,availability:r.ok?'reachable':[404,410].includes(r.status)?'unavailable':'restricted',checked_at:new Date().toISOString()})
}catch{checks.push({id:course.id,url:course.url,status:null,availability:'unverified',checked_at:new Date().toISOString()})}}}))
await writeFile(new URL('link-checks.json',dir),JSON.stringify(checks,null,2)+'\n')
console.log(JSON.stringify({total:checks.length,...Object.fromEntries(['reachable','restricted','unavailable','unverified'].map(k=>[k,checks.filter(c=>c.availability===k).length]))}))
