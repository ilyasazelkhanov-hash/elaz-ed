import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import {fileURLToPath,pathToFileURL} from 'node:url'
import path from 'node:path'
const root=fileURLToPath(new URL('../',import.meta.url))
const rawBase='https://github.com/ilyasazelkhanov-hash/elaz-ed/raw/refs/heads/main/public/'
const assetLinks=text=>String(text||'').replaceAll('](/learning/',`](${rawBase}learning/`)
const title=text=>String(text||'').replace(/[\r\n|]/g,' ')
const codeOrder=(a,b)=>a.code.localeCompare(b.code,'en',{numeric:true})
const canonicalOrder=(a,b)=>{
 const position=item=>Number.isFinite(item.position)?item.position:Number(item.code.match(/(?:-M|-L)(\d+)$/)?.[1]||Infinity)
 return position(a)-position(b)||codeOrder(a,b)
}
const anchor=code=>'lesson-'+code.toLowerCase()
const lessonLink=lesson=>`${lesson.short}.md#${anchor(lesson.code)}`
const lessonLabel=lesson=>`Урок ${lesson.number} · ${lesson.moduleNumber}.${lesson.localNumber} · ${title(lesson.title)}`
function lessonNavigation(previous,next){
 const item=(lesson,direction)=>lesson?lesson.ready?`[${direction}: ${lessonLabel(lesson)}](${lessonLink(lesson)})`:`${direction}: ${lessonLabel(lesson)} — материал готовится`:''
 return [previous?item(previous,'← Предыдущий урок'):'Это первый урок курса. Дальше двигайся по порядку.',next?item(next,'Следующий урок →'):'Это последний урок курса. Проверь итоговую работу по критериям; чтение страницы само по себе не даёт зачёт.'].join('\n\n')
}
function visualText(visual){
 if(!visual||typeof visual.src!=='string'||!/^\/learning\/academy\/[a-zA-Z0-9/_-]+\.(?:png|jpg|webp|svg)$/.test(visual.src)||typeof visual.alt!=='string')return''
 const alt=title(visual.alt).replace(/[\[\]]/g,'')
 return assetLinks(`![${alt}](${visual.src})`)+(typeof visual.caption==='string'?`\n\n${visual.caption}`:'')
}
function blockText(block){
 if(block.type==='markdown')return assetLinks(block.text||block.body||'')
 if(block.type==='code'){const body=block.code||block.text||block.body||'',fence='`'.repeat(Math.max(3,...[...String(body).matchAll(/`+/g)].map(m=>m[0].length+1)));return`${fence}${/^[a-z0-9+-]+$/i.test(block.language||block.lang||'')?block.language||block.lang:''}\n${body}\n${fence}`}
 if(block.type==='checklist')return(block.items||[]).map(item=>`- [ ] ${typeof item==='string'?item:item.text||item.label||''}`).join('\n')
 if(block.type==='link')return assetLinks(`[${title(block.label||block.title||'Материал')}](${block.url||''})`)
 return''
}
export function courseBookFiles(base,packs,drafts=[],visuals={lessons:{}}){
 const files=new Map(),courses=base.entities.filter(n=>n.kind==='course'),allModules=base.entities.filter(n=>n.kind==='module');let readyModules=0,readyLessons=0
 const rows=[]
 for(const course of courses){
  const pack=packs.find(p=>p.course_code===course.code),modules=allModules.filter(m=>m.parent_code===course.code).sort(canonicalOrder),courseTitle=pack?.course?.title||course.title,moduleRows=[],lessonRows=[];let count=0,number=0
  const prepared=modules.map((module,index)=>{
   const draft=drafts.find(d=>d.course_code===course.code&&d.module_code===module.code&&d.state==='review_ready')
   const expected=base.entities.filter(n=>n.kind==='lesson'&&n.parent_code===module.code).sort(canonicalOrder)
   const source=(pack?.lessons||draft?.lessons||[]).filter(l=>l.code.startsWith(module.code+'-')),lessons=expected.map(n=>source.find(l=>l.code===n.code)).filter(Boolean)
   const ready=expected.length===4&&source.length===expected.length&&new Set(source.map(l=>l.code)).size===source.length&&lessons.length===4&&expected.every(n=>lessons.some(l=>l.code===n.code))&&lessons.every(l=>(l.data?.content_blocks||[]).flatMap(b=>[b.text||b.body||b.code||'']).join(' ').split(/\s+/).length>=140&&l.data.artifact&&l.data.acceptance?.length)
   const short=module.code.slice(course.code.length+1)
   return {module,draft,lessons,ready,short,moduleNumber:index+1,ordered:expected.map((n,localIndex)=>{const lesson=source.find(l=>l.code===n.code);return{code:n.code,title:lesson?.title||n.title,short,number:++number,moduleNumber:index+1,localNumber:localIndex+1,ready}})}
  })
  const route=prepared.flatMap(m=>m.ordered),total=route.length
  for(const [moduleIndex,entry]of prepared.entries()){
   const {module,draft,lessons,ready,short,moduleNumber,ordered}=entry
   for(const lesson of ordered)lessonRows.push(`| ${lesson.number} | ${lesson.moduleNumber}.${lesson.localNumber} | ${lesson.ready?`[${title(lesson.title)}](${lessonLink(lesson)})`:title(lesson.title)} | ${lesson.ready?'Готов к чтению':'Готовится'} |`)
   if(!ready){moduleRows.push(`| ${module.code} | ${title(module.title)} | Готовится |`);continue}
   count+=4;readyModules++;readyLessons+=4
   const location=`courses/${course.code}/${short}.md`,parts=[`# Модуль ${moduleNumber} из ${modules.length} · ${title(module.title)}`,'',`[← ${title(courseTitle)} · весь порядок уроков](README.md)`,'',`Уроки ${ordered[0].number}–${ordered.at(-1).number} из ${total}. Проходи их сверху вниз: от ${moduleNumber}.1 к ${moduleNumber}.${lessons.length}, затем к следующему модулю.`,'','Тексты и практика для просмотра. Зачёт, квизы и прогресс выполняются в мини-аппке после публикации материалов.','',assetLinks(`![Порядок четырёх уроков модуля ${moduleNumber}: ${ordered.map(l=>title(l.title)).join('; ')}](/learning/academy/steps/${module.code}.svg)`),'','## В этом модуле','',...ordered.map(l=>`${l.localNumber}. [${lessonLabel(l)}](#${anchor(l.code)})`),'']
   for(const [lessonIndex,lesson]of lessons.entries()){
    const item=ordered[lessonIndex],previous=route[item.number-2],next=route[item.number]
    parts.push(`<a id="${anchor(lesson.code)}"></a>`,'',`## Урок ${item.number} из ${total} · ${moduleNumber}.${item.localNumber} · ${title(lesson.title)}`,'',`Код занятия: \`${lesson.code}\`.`, '',lessonNavigation(previous,next),'')
    for(const visual of visuals.lessons?.[lesson.code]||[]){const picture=visualText(visual);if(picture)parts.push(picture,'')}
    for(const [index,block]of (lesson.data.content_blocks||[]).entries()){let text=blockText(block);if(index===0&&block.type==='markdown')text=text.replace(/^#{1,3}[^\n]+\n+/,'');if(text){if(block.learning_role==='module_example'&&lesson.data.content_blocks.some(item=>item.learning_role==='beginner'))parts.push('<details>','<summary>Дополнительный пример для всего модуля</summary>','',text,'','</details>','');else parts.push(text,'')}}
    parts.push('### Результат занятия','',lesson.data.artifact,'','### Критерии','',...lesson.data.acceptance.map(item=>`- ${item}`),'','### Куда дальше','',lessonNavigation(previous,next),'')
   }
   const sources=pack?.sources||draft?.sources||[]
   if(sources.length)parts.push('## Проверенные источники','',...sources.map(s=>`- [${title(s.title)}](${s.url}) · проверено ${s.checked_at}`),'')
   const previousModule=prepared[moduleIndex-1],nextModule=prepared[moduleIndex+1]
   parts.push('## Переход между модулями','',previousModule?previousModule.ready?`[← Модуль ${previousModule.moduleNumber}: ${title(previousModule.module.title)}](${previousModule.short}.md)`:`Предыдущий модуль ${previousModule.moduleNumber} ещё готовится.`:'Это первый модуль курса.','',nextModule?nextModule.ready?`[Модуль ${nextModule.moduleNumber}: ${title(nextModule.module.title)} →](${nextModule.short}.md#${anchor(nextModule.ordered[0].code)})`:`Следующий модуль ${nextModule.moduleNumber} ещё готовится.`:'Это последний модуль. Вернись к критериям итоговой работы и проверь результат.','')
   files.set(location,parts.join('\n'));moduleRows.push(`| [${module.code}](${short}.md) | ${title(module.title)} | 4/4 занятия |`)
  }
  const first=route[0],start=first?.ready?`**[Начать с урока 1: ${title(first.title)}](${lessonLink(first)})**`:first?`Начало курса — урок 1: ${title(first.title)}. Материал ещё готовится.`:''
  files.set(`courses/${course.code}/README.md`,[`# ${course.code} · ${title(courseTitle)}`,'','[← Все курсы](../../README.md)','',`Готово ${count}/16 занятий в ${count/4}/4 модулях. Это состояние учебных текстов в репозитории; публикация и прогресс в рабочей мини-аппке проверяются отдельно.`,'',start,'','## Как идти по курсу','',`Всего ${total} уроков. Порядок: модуль 1 → 2 → 3 → 4. В каждом модуле сначала урок .1, затем .2, .3 и .4. Например, после 1.4 идёт 2.1 — урок 5 курса. Переходы внизу каждого занятия ведут к следующему шагу.`,'','Изучи пример, выполни практику и проверь результат по критериям. Открытие следующей страницы не отмечает предыдущий урок пройденным.','',`| № из ${total} | Модуль.урок | Занятие | Материал |`,'| --- | --- | --- | --- |',...lessonRows,'','## Модули','', '| Модуль | Тема | Готовность |','| --- | --- | --- |',...moduleRows,''].join('\n'))
  rows.push(`| [${course.code}](courses/${course.code}/README.md) | ${title(courseTitle)} | ${count/4}/4 | ${count}/16 |`)
 }
 files.set('README.md',['# Курсы AI Academy','','**[Начать с AI Core и первого приложения: файлы и подробные примеры](first-courses.md)**','','**[Как проходить курс: порядок уроков и примеры экранов](how-to-learn.md)**','','**[Открыть программы курсов](https://elaz-ed.vercel.app/academy)** · **[Смотреть видео](https://elaz-ed.vercel.app/learning/academy/videos/index.html)** · [Файлы MP4 в репозитории](../../public/learning/academy/videos)','',`В репозитории готовы **${readyModules}/${allModules.length} модулей** и **${readyLessons}/448 занятий**. Открой курс, затем модуль: там сами объяснения, практика, подсказки и файлы, а не только отчёт о работе.`,'','Отдельные новые модули доступны для чтения сразу. В учебный каталог включаются полностью готовые курсы.','',
 'Материалы для чтения находятся ниже. Полноценное обучение с сохранением прогресса и проверкой работ требует публикации в рабочую базу мини-аппки; оно ещё не подтверждено. [Техническое состояние и публикация](main-mini-app.md).','','| Курс | Программа | Модулей | Занятий |','| --- | --- | --- | --- |',...rows,'','Готовые модули добавляются в `main` отдельными коммитами. Источник текстов — авторские пакеты; ответы квизов и служебные поля в эти страницы не включаются.',''].join('\n'))
 return files
}
export async function writeCourseBooks(base,packs){
 const drafts=[]
 for(const entry of await readdir(path.join(root,'content/ai-academy/drafts'),{withFileTypes:true})){if(!entry.isDirectory())continue;const folder=path.join(root,'content/ai-academy/drafts',entry.name);for(const name of await readdir(folder))if(/^M[1-4]\.json$/.test(name))drafts.push(JSON.parse(await readFile(path.join(folder,name),'utf8')))}
 const visuals=JSON.parse(await readFile(path.join(root,'content/ai-academy/lesson-visuals.json'),'utf8').catch(error=>{if(error.code==='ENOENT')return'{"lessons":{}}';throw error}))
 const files=courseBookFiles(base,packs,drafts,visuals)
 for(const [relative,text]of files){const destination=path.join(root,'docs/ai-academy',relative);await mkdir(path.dirname(destination),{recursive:true});if(await readFile(destination,'utf8').catch(()=>null)!==text)await writeFile(destination,text)}
 return files.size
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const base=JSON.parse(await readFile(path.join(root,'content/ai-academy/catalog.normalized.json'),'utf8')),codes=JSON.parse(await readFile(path.join(root,'content/ai-academy/authored/index.json'),'utf8')),packs=await Promise.all(codes.map(code=>readFile(path.join(root,`content/ai-academy/authored/${code}.json`),'utf8').then(JSON.parse)));console.log('Readable course pages:',await writeCourseBooks(base,packs))}
