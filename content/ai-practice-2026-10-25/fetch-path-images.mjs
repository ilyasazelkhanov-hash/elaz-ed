import {readFile,writeFile} from 'node:fs/promises'
const images=JSON.parse(await readFile(new URL('path-images.json',import.meta.url),'utf8'))
for(const shot of images){const r=await fetch(shot.url,{signal:AbortSignal.timeout(25000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw Error(shot.file+': '+r.status);const b=Buffer.from(await r.arrayBuffer());await writeFile(new URL('../../public/learning/ai-practice/ui/'+shot.file,import.meta.url),b);shot.bytes=b.length;shot.checked_at='2026-10-26'}
await writeFile(new URL('path-images.json',import.meta.url),JSON.stringify(images,null,2)+'\n')
console.log(JSON.stringify(images.map(x=>({file:x.file,bytes:x.bytes}))))
