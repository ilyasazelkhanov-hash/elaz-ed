import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {fileURLToPath,pathToFileURL} from 'node:url'
import path from 'node:path'

const root=fileURLToPath(new URL('../',import.meta.url))
const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
function lines(text,limit){
 const output=[];let line=''
 for(const word of String(text||'').split(/\s+/)){if(line&&line.length+word.length+1>limit){output.push(line);line=word}else line+=(line?' ':'')+word}
 if(line)output.push(line)
 return output
}
const textLines=(text,x,y,size,limit,color='#edf0fa')=>lines(text,limit).map((line,i)=>`<text x="${x}" y="${y+i*(size+8)}" fill="${color}" font-size="${size}">${escape(line)}</text>`).join('\n')
const ordinal=code=>Number(code.match(/-(?:M|L)(\d+)$/)?.[1]||0)
const position=item=>Number.isFinite(Number(item.position))&&item.position!==null?Number(item.position):ordinal(item.code)
const compare=(a,b)=>position(a)-position(b)||a.code.localeCompare(b.code,'en',{numeric:true})
const labels={microlecture:'Разбор',guided_demo:'Показ на примере',hands_on_lab:'Практика',case_review:'Разбор ситуации',knowledge_check:'Самопроверка',assignment:'Задание',project_defense:'Защита результата',live_workshop:'Практикум',resource:'Источник'}

export function moduleIllustration(course,module,lessons,moduleIndex,offset,total){
 const title=lines(module.title,44),courseTitle=lines(course.title,57),cards=lessons.map(lesson=>({lesson,title:lines(lesson.title,43)}))
 let y=194+Math.max(0,title.length-1)*30+Math.max(0,courseTitle.length-1)*22
 const items=[]
 for(const [i,{lesson,title}]of cards.entries()){
  const height=72+title.length*28
  if(i)items.push(`<path d="M61 ${y-19}v14m-5-5 5 5 5-5" stroke="#98a3c6" stroke-width="2" fill="none"/>`)
  items.push(`<rect x="28" y="${y}" width="664" height="${height}" rx="18" fill="#1a2138" stroke="#3c4665"/>
<rect x="44" y="${y+18}" width="52" height="38" rx="11" fill="#b8a4ff"/>
<text x="70" y="${y+44}" text-anchor="middle" fill="#17142b" font-size="19" font-weight="700">${moduleIndex+1}.${i+1}</text>
<text x="114" y="${y+31}" font-size="14" fill="#c1b4ff">Урок ${offset+i+1} из ${total} · ${escape(labels[lesson.data?.format]||'Занятие')}</text>
${textLines(lesson.title,114,y+62,20,43)}`)
  y+=height+26
 }
 const height=y+72
 return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${height}" viewBox="0 0 720 ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escape(module.code)}: порядок занятий</title>
<desc id="desc">${escape(lessons.map((l,i)=>`${moduleIndex+1}.${i+1}. ${l.title}`).join('; '))}</desc>
<rect width="720" height="${height}" rx="24" fill="#10172a"/>
<g font-family="system-ui, sans-serif">
<text x="30" y="38" fill="#c1b4ff" font-size="15" letter-spacing="1">${escape(course.code)} · МОДУЛЬ ${moduleIndex+1}</text>
${textLines(course.title,30,70,15,57,'#aab5d1')}
${textLines(module.title,30,112+Math.max(0,courseTitle.length-1)*22,23,44)}
<text x="30" y="${156+Math.max(0,title.length-1)*30+Math.max(0,courseTitle.length-1)*22}" fill="#aab5d1" font-size="15">Проходи сверху вниз: разбор → практика → проверка.</text>
${items.join('\n')}
<text x="30" y="${height-45}" fill="#c1b4ff" font-size="16">${moduleIndex===3?'После последнего занятия — защита результата курса.':`Дальше: модуль ${moduleIndex+2}. Сначала проверь результат текущего.`}</text>
</g></svg>\n`
}

export async function writeModuleIllustrations(catalog){
 const directory=path.join(root,'public/learning/academy/steps');await mkdir(directory,{recursive:true});let count=0
 for(const course of catalog.entities.filter(n=>n.kind==='course')){
  const modules=catalog.entities.filter(n=>n.kind==='module'&&n.parent_code===course.code).sort(compare),total=catalog.entities.filter(n=>n.kind==='lesson'&&modules.some(m=>n.parent_code===m.code)).length;let offset=0
  for(const [index,module]of modules.entries()){
   const lessons=catalog.entities.filter(n=>n.kind==='lesson'&&n.parent_code===module.code).sort(compare),svg=moduleIllustration(course,module,lessons,index,offset,total),file=path.join(directory,module.code+'.svg')
   if(await readFile(file,'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error})!==svg)await writeFile(file,svg)
   offset+=lessons.length;count++
  }
 }
 return count
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const catalog=JSON.parse(await readFile(path.join(root,'content/ai-academy/catalog.learning.json'),'utf8'));console.log('Module diagrams:',await writeModuleIllustrations(catalog))}
