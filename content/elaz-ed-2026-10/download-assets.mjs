import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const manifest=JSON.parse(await readFile(new URL('./assets-manifest.json',import.meta.url),'utf8'))
const directory=new URL('./assets/',import.meta.url)
await mkdir(directory,{recursive:true})
let saved=0
for(const item of manifest){
  const target=new URL(item.name,directory)
  try{const bytes=await readFile(target);if(createHash('sha256').update(bytes).digest('hex')===item.sha256){saved++;continue}}catch{}
  const response=await fetch(item.url,{signal:AbortSignal.timeout(45000)})
  if(!response.ok)throw Error(`${item.name}: HTTP ${response.status}`)
  const bytes=Buffer.from(await response.arrayBuffer())
  if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error(`${item.name}: ошибка хэша`)
  await writeFile(target,bytes)
  saved++
}
console.log(JSON.stringify({files:saved,bytes:manifest.reduce((n,x)=>n+x.bytes,0)}))
