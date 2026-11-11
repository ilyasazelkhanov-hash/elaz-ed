import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises'
import {fileURLToPath,pathToFileURL} from 'node:url'
import path from 'node:path'
const root=fileURLToPath(new URL('../',import.meta.url))
const assert=(condition,message)=>{if(!condition)throw Error(message)}
export async function loadStudyExamples(){
 const folder=path.join(root,'content/ai-academy/examples'),rows=[]
 for(const name of (await readdir(folder)).filter(name=>name.endsWith('.json')).sort())rows.push(...JSON.parse(await readFile(path.join(folder,name),'utf8')))
 const codes=new Set()
 for(const row of rows){
  assert(/^[A-Z]+-\d{3}-M[1-4]$/.test(row.module_code)&&!codes.has(row.module_code),'Invalid/duplicate module case');codes.add(row.module_code)
  for(const key of ['title','concept','situation','input','expected','mistake','check'])assert(typeof row[key]==='string'&&row[key].trim().length>8,`${row.module_code}: missing ${key}`)
  assert(Array.isArray(row.steps)&&row.steps.length===3&&row.steps.every(item=>typeof item==='string'&&item.length>15),`${row.module_code}: three concrete actions required`)
  assert(row.diagram?.length===4&&row.diagram.every(item=>typeof item==='string'&&item.length>2&&item.length<=35),`${row.module_code}: four short diagram labels required`)
 }
 return rows
}
// A lesson pack is opt-in. Existing module cases remain available for courses not yet edited.
// Validate the entire pack before writing, including when only one module is regenerated.
export function validateLessonExamples(pack,rows){
 assert(Array.isArray(rows),`${pack.course_code}: invalid lesson examples`)
 if(!rows.length){assert(!pack.lessons.some(lesson=>lesson.data.content_blocks.some(block=>block.example_scope==='lesson')),`${pack.course_code}: missing lesson examples for enriched pack`);return}
 const codes=new Set(),unique=new Map(['title','input','expected','attempt','transfer','steps'].map(key=>[key,new Set()]))
 assert(rows.length===pack.lessons.length,`${pack.course_code}: incomplete lesson example coverage`)
 for(const row of rows){
  assert(row&&typeof row==='object',`${pack.course_code}: invalid lesson example`)
  const lesson=pack.lessons.find(item=>item.code===row.lesson_code)
  assert(lesson&&!codes.has(row.lesson_code),`${row.lesson_code}: unknown/duplicate lesson example`);codes.add(row.lesson_code)
  assert(row.lesson_title===lesson.title&&row.artifact===lesson.data.artifact&&JSON.stringify(row.acceptance)===JSON.stringify(lesson.data.acceptance),`${row.lesson_code}: stale lesson alignment`)
  for(const key of ['title','concept','situation','input','expected','mistake','check','attempt','transfer'])assert(typeof row[key]==='string'&&row[key].trim().length>15,`${row.lesson_code}: missing ${key}`)
  assert(Array.isArray(row.steps)&&row.steps.length===3&&row.steps.every(step=>typeof step==='string'&&step.trim().length>30),`${row.lesson_code}: three worked steps required`)
  assert(Array.isArray(row.feedback)&&row.feedback.length===2&&row.feedback.every(step=>typeof step==='string'&&step.trim().length>30),`${row.lesson_code}: two feedback hints required`)
  for(const [key,seen]of unique){const value=(Array.isArray(row[key])?row[key].join(' '):row[key]).replace(/\s+/g,' ').trim().toLowerCase();assert(!seen.has(value),`${row.lesson_code}: repeated ${key}`);seen.add(value)}
 }
}
export async function loadLessonExamples(courseCode){
 assert(/^[A-Z]+-\d{3}$/.test(courseCode),'Invalid course code')
 return JSON.parse(await readFile(path.join(root,'content/ai-academy/lesson-examples',courseCode+'.json'),'utf8').catch(error=>{if(error.code==='ENOENT')return'[]';throw error}))
}
function lessonBlocks(row){
 const study={title:row.title,concept:row.concept,situation:row.situation,input_text:row.input,steps:row.steps,result_text:row.expected,mistake:row.mistake,check:row.check}
 const text=[`## На примере: ${row.title}`,row.concept,row.situation,`### Что есть в начале\n\n${row.input}`,`### Разберём по шагам\n\n${row.steps.map((step,index)=>`${index+1}. ${step}`).join('\n')}`,`### Что должно получиться\n\n${row.expected}`,`### Где легко ошибиться\n\n${row.mistake}`,`### Проверка примера\n\n${row.check}`,'Пример вымышленный. Он не подтверждает внедрение, фактический AI-вызов или независимое ревью.'].join('\n\n')
 const checkpoint=/-L4$/.test(row.lesson_code)
 const practice=[`## Практика: ${checkpoint?'контрольная работа':'другие исходные данные'}`,row.attempt,'### Что нужно сохранить',row.artifact,'Сохрани входы, свою версию, проверку и ограничения. Подпиши режим: фактический локальный запуск, фактический AI-запуск или анализ готового примера. Отсутствие запуска не считается выполненным запуском.','### Подсказка: исправь причину, а не только ответ',...row.feedback.map(item=>`- ${item}`),'### Практика: перенос в новый контекст',row.transfer,'### Самопроверка: доказательства результата',...row.acceptance.map(item=>`- ${item}`),'Для каждого критерия отметь «нет доказательства», «частично» или «достаточно» и укажи фрагмент своей работы. При пробеле исправь работу и сохрани новую версию с причиной изменения. Это ориентир самопроверки, не автоматический зачёт и не замена действующей рубрики. Проверка работы и статус в Academy выполняются отдельно.'].join('\n\n')
 // Keep the legacy role consumed by LessonStudy, but identify the lesson source explicitly.
 // Do not attach the module diagram: its operation may differ from this lesson's objective.
 return [{type:'markdown',learning_role:'module_example',example_scope:'lesson',source_lesson_code:row.lesson_code,text,study},{type:'markdown',learning_role:'lesson_practice',generated_by:'academy-enrich-lessons:lesson-v1',text:practice}]
}
export function assertLessonExamplesCurrent(pack,rows){
 validateLessonExamples(pack,rows)
 for(const row of rows){
  const lesson=pack.lessons.find(item=>item.code===row.lesson_code)
  const generated=lesson.data.content_blocks.filter(block=>block.learning_role==='module_example'||block.generated_by==='academy-enrich-lessons:lesson-v1')
  assert(JSON.stringify(generated)===JSON.stringify(lessonBlocks(row)),`${row.lesson_code}: stale generated examples; run academy:enrich -- --course=${pack.course_code}`)
 }
}
function moduleBlock(row){
 const diagram_src=`/learning/academy/concepts/${row.module_code}.svg`
 const study={title:row.title,concept:row.concept,situation:row.situation,input_text:row.input,steps:row.steps,result_text:row.expected,mistake:row.mistake,check:row.check,diagram_src}
 const text=[`## На примере: ${row.title}`,row.concept,row.situation,`![${row.diagram.join(' → ')}](${diagram_src})`,`### Что есть в начале\n\n${row.input}`,`### Разберём по шагам\n\n${row.steps.map((step,index)=>`${index+1}. ${step}`).join('\n')}`,`### Что должно получиться\n\n${row.expected}`,`### Где легко ошибиться\n\n${row.mistake}`,`### Проверка примера\n\n${row.check}`,'Это вымышленный учебный пример. Он не подтверждает выполненное внедрение, AI-вызов или независимое ревью. Свою практику выполни отдельно.'].join('\n\n')
 return{type:'markdown',learning_role:'module_example',text,study}
}
function beginnerBlock(row){
 const study={diagram_src:`/learning/academy/concepts/${row.lesson_code.replace(/-L\d+$/,'')}.svg`,title:'Мини-пример',concept:row.plain,situation:row.example,steps:row.steps,result_text:row.expected,mistake:row.mistake,check:row.self_check.join(' ')}
 const text=['## Простыми словами',row.plain,'### Один маленький пример',row.example,'### Повтори на учебной копии',row.steps.map((step,index)=>`${index+1}. ${step}`).join('\n'),`### Наблюдаемый результат\n\n${row.expected}`,`### Частая ошибка\n\n${row.mistake}`,'### Объясни своими словами',row.self_check.map(question=>`- ${question}`).join('\n'),'Пример вымышленный. В итоговую работу приложи свои входные данные, фактический результат и проверку.'].join('\n\n')
 return{type:'markdown',learning_role:'beginner',text,study}
}
export function enrichPack(pack,examples,explainers=[],moduleNumber,lessonExamples=[]){
 validateLessonExamples(pack,lessonExamples)
 const copy=structuredClone(pack),cases=new Map(examples.map(row=>[row.module_code,row])),notes=new Map(explainers.map(row=>[row.lesson_code,row])),lessonCases=new Map(lessonExamples.map(row=>[row.lesson_code,row]))
 for(const lesson of copy.lessons){
  if(moduleNumber&&!lesson.code.startsWith(`${pack.course_code}-M${moduleNumber}-`))continue
  const moduleCode=lesson.code.replace(/-L\d+$/,''),example=cases.get(moduleCode),note=notes.get(lesson.code)
  assert(example,`${lesson.code}: missing module case`)
  if(note){assert(note.steps?.length===3&&note.self_check?.length===2,`${lesson.code}: invalid beginner walkthrough`);for(const key of ['plain','example','expected','mistake'])assert(typeof note[key]==='string'&&note[key].length>20,`${lesson.code}: missing ${key}`)}
  const original=lesson.data.content_blocks.filter(block=>!['module_example','beginner'].includes(block.learning_role)&&block.generated_by!=='academy-enrich-lessons:lesson-v1')
  lesson.data.content_blocks=[...original,...(note?[beginnerBlock(note)]:[]),...(lessonCases.has(lesson.code)?lessonBlocks(lessonCases.get(lesson.code)):[moduleBlock(example)])]
 }
 return copy
}
export async function enrichSources({courseCode,moduleNumber}={}){
 const examples=await loadStudyExamples(),folder=path.join(root,'content/ai-academy/authored'),codes=JSON.parse(await readFile(path.join(folder,'index.json'),'utf8'));let changed=0
 if(courseCode)assert(codes.includes(courseCode),'Unknown course')
 for(const code of codes.filter(code=>!courseCode||code===courseCode)){
  const file=path.join(folder,code+'.json'),before=await readFile(file,'utf8'),pack=JSON.parse(before)
  const notes=JSON.parse(await readFile(path.join(root,'content/ai-academy/lesson-explainers',code+'.json'),'utf8').catch(error=>{if(error.code==='ENOENT')return'[]';throw error}))
  const lessonExamples=await loadLessonExamples(code)
  const enriched=enrichPack(pack,examples,notes,moduleNumber,lessonExamples),after=JSON.stringify(enriched,null,2)+'\n'
  if(after!==before){await writeFile(file,after);changed++}
 }
 console.log(`Enriched ${changed} course packs with authored teaching examples. No database writes.`)
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const args=process.argv.slice(2),courseCode=args.find(arg=>arg.startsWith('--course='))?.slice(9),moduleArg=args.find(arg=>arg.startsWith('--module='))?.slice(9);assert(!moduleArg||/^[1-4]$/.test(moduleArg),'Invalid module');await enrichSources({courseCode,moduleNumber:Number(moduleArg)||undefined})}
