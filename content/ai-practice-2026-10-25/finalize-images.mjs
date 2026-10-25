import {readFile,writeFile} from 'node:fs/promises'
const dir=new URL('./',import.meta.url)
const images=JSON.parse(await readFile(new URL('images.json',dir),'utf8'))
const fixes={
2:'https://images.ctfassets.net/kftzwdyauwt9/3SQQ9jqSm3aytzUPKuNS3X/e30d9ff756987b178e2b141de5c64a35/Art_Card___Landscape___16_9___1920_1080.png?w=1600&h=900&fit=fill',
24:'https://www.heygen.com/_next/image?url=%2Fassets_2025_redesign%2F_next%2Fstatic%2Fimmutable%2Fmedia%2Fbakery.239h5s6ncld8j.jpg&w=1080&q=75',
26:'https://content-management-files.canva.com/eaaa25f7-5062-44e3-8d32-f47802e44aab/CanvaCraftthumbnail.png',
37:'https://images.ctfassets.net/kftzwdyauwt9/6E0HwFxJrpWOEiFct0ZfQE/bb595e7e6ab06dfd2c953cb915c8f89a/build-more-responsive-apps-with-the-decisions-api-cover.png?w=1200&q=80&fm=webp',
47:images.find(x=>x.ids.includes(8)).url,
42:images.find(x=>x.ids.includes(8)).url,
52:'https://research.nvidia.com/labs/nemotron/images/nvidia-nemotron-3.5-bolt-e4b-4gb/bolt_ttft-vs-accuracy.png',
53:'https://cactuscompute.com/opengraph-image?9df76a35fe8276e2',
56:'https://images.ctfassets.net/kftzwdyauwt9/5frqtUAWccstAbVrCFraH6/5ae9b6bfbc3f3dff8001ed249812f97d/Intelligent-UI_Art-Card_16x9.png?w=1600&h=900&fit=fill',
}
for(const image of images){if(fixes[image.ids[0]])image.url=fixes[image.ids[0]];if(image.ids.includes(47)||image.ids.includes(42)){image.source='https://docs.anthropic.com/en/release-notes/claude-apps';image.type='thematic-publisher-image'}if(image.ids.includes(53))image.source='https://cactuscompute.com/'}
const queue=[...images]
await Promise.all(Array.from({length:5},async()=>{while(queue.length){const image=queue.shift();try{const r=await fetch(image.url,{signal:AbortSignal.timeout(20000)});const bytes=await r.arrayBuffer();image.image_status=r.status;image.content_type=r.headers.get('content-type');image.bytes=bytes.byteLength;image.checked=r.ok&&image.content_type?.startsWith('image/')&&image.bytes>1000}catch(e){image.checked=false;image.error=e.message}}}))
await writeFile(new URL('images.json',dir),JSON.stringify(images,null,2)+'\n')
console.log(JSON.stringify(images.map(x=>({ids:x.ids,ok:x.checked,status:x.image_status,type:x.content_type,bytes:x.bytes}))))
