import {createServer} from 'node:http'
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createRequire} from 'node:module'
const {chromium}=createRequire(import.meta.url)('playwright')
const exec=promisify(execFile),root=fileURLToPath(new URL('./',import.meta.url)),temporary=await mkdtemp(join(tmpdir(),'creative-render-'))
const ids=['01-question','02-photo','03-detail','04-options','05-next'],server=createServer(async(req,res)=>{const id=req.url?.slice(1);if(!ids.includes(id)){res.writeHead(404).end();return}res.setHeader('Content-Type','image/svg+xml');res.end(await readFile(root+`assets/${id}.svg`))})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
try{
 if(!process.argv.includes('--media-only')){const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
 try{const page=await browser.newPage({viewport:{width:1080,height:1350}});for(const id of ids){await page.goto(`http://127.0.0.1:${server.address().port}/${id}`);await page.screenshot({path:root+`assets/${id}.png`})}}finally{await browser.close()}}
 const phrases=['Second Stitch is a fictional workshop.','Prepare a garment photo and a repair question.','This is a learning example.']
 const inputs=phrases.flatMap(text=>['-f','lavfi','-i',`flite=text='${text}':voice=slt`])
 await exec('ffmpeg',['-hide_banner','-loglevel','error','-y',...inputs,'-filter_complex','[0:a]adelay=0[a];[1:a]adelay=4000[b];[2:a]adelay=8000[c];[a][b][c]amix=inputs=3:duration=longest:normalize=0,aresample=48000[out]','-map','[out]',root+'assets/voice.wav'])
 for(const [name,length,count] of [['intro',15,5],['campaign',12,10]]){
  const duration=length/count,list=[]
  for(let i=0;i<count;i++)list.push(`file '${root}assets/${ids[i%5]}.png'`,`duration ${duration}`)
  list.push(`file '${root}assets/${ids[(count-1)%5]}.png'`)
  const playlist=join(temporary,name+'.txt');await writeFile(playlist,list.join('\n')+'\n')
  const captions=[['00:00:00.000','00:00:04.000','Второй шов — вымышленная мастерская.'],['00:00:04.000','00:00:08.000','Подготовь фото вещи и вопрос о ремонте.'],['00:00:08.000',`00:00:${String(length).padStart(2,'0')}.000`,'Учебный пример. Настоящей записи нет.']]
  await writeFile(root+`assets/${name}.vtt`,'WEBVTT\n\n'+captions.map(([a,b,t],i)=>`${i+1}\n${a} --> ${b}\n${t}`).join('\n\n')+'\n')
  await exec('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',playlist,'-i',root+'assets/voice.wav','-vf','scale=360:450,pad=360:640:0:70:color=0xfff5e5,setsar=1','-af','apad,loudnorm=I=-16:TP=-1.5:LRA=11','-t',String(length),'-r','24','-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart',root+`assets/${name}.mp4`],{maxBuffer:2e6})
 }
 console.log('Rendered five PNGs, two MP4s with local English flite speech, and Russian WebVTT captions.')
}finally{await new Promise(resolve=>server.close(resolve));await rm(temporary,{recursive:true,force:true})}
