import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {fileURLToPath,pathToFileURL} from 'node:url'
import path from 'node:path'
const root=fileURLToPath(new URL('../',import.meta.url))
const rawBase='https://github.com/ilyasazelkhanov-hash/elaz-ed/raw/refs/heads/main/public/'
const assetLinks=text=>String(text||'').replaceAll('](/learning/',`](${rawBase}learning/`)
const title=text=>String(text||'').replace(/[\r\n|]/g,' ')
function blockText(block){
 if(block.type==='markdown')return assetLinks(block.text||block.body||'')
 if(block.type==='code'){const body=block.code||block.text||block.body||'',fence='`'.repeat(Math.max(3,...[...String(body).matchAll(/`+/g)].map(m=>m[0].length+1)));return`${fence}${/^[a-z0-9+-]+$/i.test(block.language||block.lang||'')?block.language||block.lang:''}\n${body}\n${fence}`}
 if(block.type==='checklist')return(block.items||[]).map(item=>`- [ ] ${typeof item==='string'?item:item.text||item.label||''}`).join('\n')
 if(block.type==='link')return assetLinks(`[${title(block.label||block.title||'Материал')}](${block.url||''})`)
 return''
}
export function courseBookFiles(base,packs,drafts=[]){
 const files=new Map(),courses=base.entities.filter(n=>n.kind==='course'),allModules=base.entities.filter(n=>n.kind==='module');let readyModules=0,readyLessons=0
 const rows=[]
 for(const course of courses){
  const pack=packs.find(p=>p.course_code===course.code),modules=allModules.filter(m=>m.parent_code===course.code).sort((a,b)=>a.position-b.position),courseTitle=pack?.course?.title||course.title,moduleRows=[];let count=0
  for(const module of modules){
   const draft=drafts.find(d=>d.course_code===course.code&&d.module_code===module.code&&d.state==='review_ready')
   const lessons=(pack?.lessons||draft?.lessons||[]).filter(l=>l.code.startsWith(module.code+'-')).sort((a,b)=>a.code.localeCompare(b.code,'en',{numeric:true}));const expected=base.entities.filter(n=>n.kind==='lesson'&&n.parent_code===module.code)
   const ready=expected.length===4&&lessons.length===4&&expected.every(n=>lessons.some(l=>l.code===n.code))&&lessons.every(l=>(l.data?.content_blocks||[]).flatMap(b=>[b.text||b.body||b.code||'']).join(' ').split(/\s+/).length>=140&&l.data.artifact&&l.data.acceptance?.length)
   if(!ready){moduleRows.push(`| ${module.code} | ${title(module.title)} | Готовится |`);continue}
   count+=4;readyModules++;readyLessons+=4
   const short=module.code.slice(course.code.length+1),location=`courses/${course.code}/${short}.md`,parts=[`# ${module.code} · ${title(module.title)}`,'',`[← ${title(courseTitle)}](README.md)`,'','Тексты и практика для просмотра. Зачёт, квизы и прогресс выполняются в мини-аппке после публикации материалов.','']
   for(const lesson of lessons){parts.push(`## ${lesson.code} · ${title(lesson.title)}`,'');for(const [index,block]of (lesson.data.content_blocks||[]).entries()){let text=blockText(block);if(index===0&&block.type==='markdown')text=text.replace(/^#{1,3}[^\n]+\n+/,'');if(text)parts.push(text,'')}parts.push('### Результат занятия','',lesson.data.artifact,'','### Критерии','',...lesson.data.acceptance.map(item=>`- ${item}`),'')}
   const sources=pack?.sources||draft?.sources||[]
   if(sources.length)parts.push('## Проверенные источники','',...sources.map(s=>`- [${title(s.title)}](${s.url}) · проверено ${s.checked_at}`),'')
   files.set(location,parts.join('\n'));moduleRows.push(`| [${module.code}](${short}.md) | ${title(module.title)} | 4/4 занятия |`)
  }
  files.set(`courses/${course.code}/README.md`,[`# ${course.code} · ${title(courseTitle)}`,'','[← Все курсы](../../README.md)','',`Готово ${count}/16 занятий в ${count/4}/4 модулях. Это состояние учебных текстов в репозитории; публикация и прогресс в рабочей мини-аппке проверяются отдельно.`,'','| Модуль | Тема | Готовность |','| --- | --- | --- |',...moduleRows,''].join('\n'))
  rows.push(`| [${course.code}](courses/${course.code}/README.md) | ${title(courseTitle)} | ${count/4}/4 | ${count}/16 |`)
 }
 files.set('README.md',['# Курсы AI Academy','','**[Открыть программы курсов](https://elaz-ed.vercel.app/academy)** · **[Смотреть видео](https://elaz-ed.vercel.app/learning/academy/videos/index.html)** · [Файлы MP4 в репозитории](../../public/learning/academy/videos)','',`В репозитории готовы **${readyModules}/${allModules.length} модулей** и **${readyLessons}/448 занятий**. Открой курс, затем модуль: там сами объяснения, практика, подсказки и файлы, а не только отчёт о работе.`,'','Материалы для чтения находятся ниже. Полноценное обучение с сохранением прогресса и проверкой работ требует публикации в рабочую базу мини-аппки; оно ещё не подтверждено. [Техническое состояние и публикация](main-mini-app.md).','','| Курс | Программа | Модулей | Занятий |','| --- | --- | --- | --- |',...rows,'','Готовые модули добавляются в `main` отдельными коммитами. Источник текстов — авторские пакеты; ответы квизов и служебные поля в эти страницы не включаются.',''].join('\n'))
 return files
}
export async function writeCourseBooks(base,packs){
 const drafts=[]
 for(const entry of await readdir(path.join(root,'content/ai-academy/drafts'),{withFileTypes:true})){if(!entry.isDirectory())continue;const folder=path.join(root,'content/ai-academy/drafts',entry.name);for(const name of await readdir(folder))if(/^M[1-4]\.json$/.test(name))drafts.push(JSON.parse(await readFile(path.join(folder,name),'utf8')))}
 const files=courseBookFiles(base,packs,drafts)
 for(const [relative,text]of files){const destination=path.join(root,'docs/ai-academy',relative);await mkdir(path.dirname(destination),{recursive:true});if(await readFile(destination,'utf8').catch(()=>null)!==text)await writeFile(destination,text)}
 return files.size
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const base=JSON.parse(await readFile(path.join(root,'content/ai-academy/catalog.normalized.json'),'utf8')),codes=JSON.parse(await readFile(path.join(root,'content/ai-academy/authored/index.json'),'utf8')),packs=await Promise.all(codes.map(code=>readFile(path.join(root,`content/ai-academy/authored/${code}.json`),'utf8').then(JSON.parse)));console.log('Readable course pages:',await writeCourseBooks(base,packs))}
