import {writeFile} from 'node:fs/promises'
const images=[
 {file:'descript-edit.webp',url:'https://cdn.sanity.io/images/lsw4j9eq/production/911bc2e36110a7bed71b97cc97a899a44f403e45-1280x840.webp?fit=max&auto=format',page:'https://www.descript.com/',caption:'Официальная иллюстрация текстового монтажа Descript; не снимок личного аккаунта.'},
]
for(const shot of images){const r=await fetch(shot.url,{signal:AbortSignal.timeout(30000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw Error(shot.file+': '+r.status);const b=Buffer.from(await r.arrayBuffer());await writeFile(new URL('../../public/learning/ai-practice/ui/'+shot.file,import.meta.url),b);shot.bytes=b.length;shot.checked_at='2026-10-26'}
await writeFile(new URL('reference-images.json',import.meta.url),JSON.stringify(images,null,2)+'\n')
console.log(JSON.stringify(images.map(x=>({file:x.file,bytes:x.bytes}))))
