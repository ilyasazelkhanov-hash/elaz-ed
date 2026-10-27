import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {fileURLToPath,pathToFileURL} from 'node:url'
import path from 'node:path'
import {loadStudyExamples} from './academy-enrich-lessons.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]))
const wrap=(text,limit)=>{const lines=[];let line='';for(const word of text.split(/\s+/)){if(line&&line.length+word.length+1>limit){lines.push(line);line=word}else line+=(line?' ':'')+word}if(line)lines.push(line);return lines}
export async function writeConceptIllustrations(){
 const rows=await loadStudyExamples(),directory=path.join(root,'public/learning/academy/concepts');await mkdir(directory,{recursive:true})
 for(const row of rows){
  const nodes=row.diagram.map((label,index)=>{const y=114+index*118,lines=wrap(label,28);return`${index?`<path d="M360 ${y-27}v20m-6-6 6 6 6-6" fill="none" stroke="#8478a8" stroke-width="3"/>`:''}<rect x="38" y="${y}" width="644" height="92" rx="18" fill="${index===3?'#e4f4ed':'#ffffff'}" stroke="${index===3?'#91c1af':'#d6cee8'}"/><circle cx="78" cy="${y+46}" r="21" fill="#eae3fb"/><text x="78" y="${y+54}" text-anchor="middle" font-size="22" fill="#59418b">${index+1}</text>${lines.map((line,i)=>`<text x="118" y="${y+(lines.length>1?34:58)+i*38}" font-size="36" font-weight="600" fill="#29243d">${escape(line)}</text>`).join('')}`}).join('\n')
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="610" viewBox="0 0 720 610" role="img" aria-labelledby="title"><title id="title">${escape(row.title)}: ${escape(row.diagram.join(' → '))}</title><rect width="720" height="610" rx="24" fill="#f1edf8"/><g font-family="system-ui,sans-serif"><text x="38" y="40" font-size="14" fill="#74658e">${escape(row.module_code)} · УЧЕБНЫЙ ПРИМЕР</text>${wrap(row.title,44).map((line,index)=>`<text x="38" y="${73+index*25}" font-size="20" fill="#29243d">${escape(line)}</text>`).join('')}${nodes}<text x="38" y="594" font-size="13" fill="#74658e">Исходные данные → действие → результат → проверка</text></g></svg>\n`
  const file=path.join(directory,row.module_code+'.svg');if(await readFile(file,'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error})!==svg)await writeFile(file,svg)
 }
 return rows.length
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log('Concept diagrams:',await writeConceptIllustrations())
