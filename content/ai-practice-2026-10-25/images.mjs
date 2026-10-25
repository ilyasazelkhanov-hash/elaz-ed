import {readFile,writeFile} from 'node:fs/promises'
const dir=new URL('./',import.meta.url)
const source=(await readFile(new URL('source.md',dir),'utf8')).replaceAll('\r\n','\n')
const starts=[...source.matchAll(/^### (\d{2})\. (.+)$/gm)].filter(x=>+x[1]<=56)
const groups=new Map()
for(let i=0;i<starts.length;i++){
const m=starts[i];const raw=source.slice(m.index+m[0].length,starts[i+1]?.index).split(/^## |^<a /m)[0]
const url=[...raw.matchAll(/\]\((https?:[^)]+)\)/g)][0]?.[1]
if(!url)throw Error(`No source ${m[1]}`)
if(!groups.has(url))groups.set(url,[]);groups.get(url).push(+m[1])
}
const results=[]
const queue=[...groups]
await Promise.all(Array.from({length:6},async()=>{while(queue.length){
const [source,ids]=queue.shift()
try{
if(source.includes('youtube.com')){results.push({ids,source,url:`https://i.ytimg.com/vi/${new URL(source).searchParams.get('v')}/hqdefault.jpg`,type:'video-thumbnail'});continue}
const r=await fetch(source,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0'}})
const html=await r.text()
const tags=html.match(/<meta\b[^>]*>/gi)??[]
const tag=tags.find(t=>/(?:property|name)=["']og:image["']/i.test(t))??tags.find(t=>/(?:property|name)=["']twitter:image["']/i.test(t))
const image=tag?.match(/content=["']([^"']+)/i)?.[1]?.replaceAll('&amp;','&')
results.push({ids,source,url:image?new URL(image,source).href:null,status:r.status,type:'publisher-preview'})
}catch(e){results.push({ids,source,url:null,error:e.message})}
}}))
results.sort((a,b)=>a.ids[0]-b.ids[0])
await writeFile(new URL('images.json',dir),JSON.stringify(results,null,2)+'\n')
console.log(JSON.stringify(results))
