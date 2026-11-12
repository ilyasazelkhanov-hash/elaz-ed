import test from 'node:test'
import assert from 'node:assert/strict'
import { learningNextStep, learningScope, readFreeAttempts, readLastFreeGuide } from '../src/lib/learning-next.ts'
import { beginnerGuides } from '../src/lib/beginner-content.ts'
import { ogPracticeCourses } from '../src/lib/og-practice.ts'
const initial = () => ({choice:{audience:'beginner', goal:'', entry:'practice'}, attempts:[], lastFree:null, progress:{done:[],lastLesson:null}, courses:[],feed:[]})
test('beginner starts on one free task; experienced gets applied self-check, not a credential',()=>{
 assert.equal(learningNextStep(initial()).path, '/start/first-request')
 const input=initial();input.choice.audience='experienced'
 assert.equal(learningNextStep(input).path, '/start/check-answer')
 assert.match(learningNextStep(input).reason,/самопроверка, не экзамен/)
})
test('free sequence resumes a valid open step and advances only self-reported attempts',()=>{
 const input=initial();input.lastFree='check-answer'
 assert.equal(learningNextStep(input).label,'Продолжить разбор')
 input.attempts=['check-answer'];assert.equal(learningNextStep(input).path,'/start/first-request')
 input.attempts=beginnerGuides.map(g=>g.id);input.choice.goal='coding'
 assert.equal(learningNextStep(input).path,'/og-practice/coding')
 assert.match(learningNextStep(input).reason,/платная/)
})
test('server-accessible paid reading wins; local done does not pretend completion or bypass access',()=>{
 const outline=ogPracticeCourses[0], first=outline.lessons[0],second=outline.lessons[1]
 const input=initial();input.progress={lastLesson:first.key,done:[first.key,second.key]}
 input.courses=[{id:1,practice_key:outline.key,access:true,practice_lessons:[{id:1,key:first.key,completed:false},{id:2,key:second.key,completed:false}]}]
 assert.equal(learningNextStep(input).path,`/og-practice/${outline.key}/${first.key}`)
 input.courses[0].practice_lessons[0].completed=true
 assert.equal(learningNextStep(input).path,`/og-practice/${outline.key}/${second.key}`)
 input.courses[0].access=false
 assert.equal(learningNextStep(input).path,'/start/first-request')
})
test('malformed, obsolete and blocked local data are ignored and modes/accounts separated',()=>{
 assert.notEqual(learningScope(1,true),learningScope(1,false));assert.notEqual(learningScope(1,false),learningScope(2,false))
 assert.deepEqual(readFreeAttempts(1,false,{getItem:()=>'{'}),[])
 assert.deepEqual(readFreeAttempts(1,false,{getItem:()=>JSON.stringify(['first-request','first-request','admin',3])}),['first-request'])
 assert.equal(readLastFreeGuide(1,false,{getItem:()=>'/admin'}),null)
 assert.equal(readLastFreeGuide(1,false,{getItem:()=>{throw Error('blocked')}}),null)
})

test('home next-action UI has one primary CTA, route options remain accessible without claiming mastery',async()=>{
 const {readFile}=await import('node:fs/promises'),{transformWithOxc}=await import('vite'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server')
 const path=new URL('../src/screens/home/LearningNext.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(path,'utf8'),path.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import \{([^}]+)\} from ["'](\.\.?\/[^"']+)["'];?/g,(_,names)=>`const {${names}}=globalThis.__learningNext;`)
 for(const name of ['react','react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 globalThis.__learningNext={isDemo:false,learningScope,learningNextStep,readFreeAttempts,readLastFreeGuide,readPracticeProgress:()=>({done:[],lastLesson:null}),readPathwayChoice:()=>initial().choice,writePathwayChoice(){},subscribePracticeProgress:()=>()=>{},practiceGoals:[{id:'coding',label:'Приложение'}],useStore:selector=>selector({me:{id:1},courses:[],feed:[],stack:[],push(){}}),Tap:({children,...props})=>createElement('button',props,children)}
 try{
  const {LearningNext}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const html=renderToStaticMarkup(createElement(LearningNext))
  assert.match(html,/Следующий учебный шаг/);assert.match(html,/Первый запрос, который помогает/)
  assert.match(html,/<details/);assert.match(html,/<fieldset/);assert.match(html,/aria-pressed="true"/)
  assert.match(html,/не подтверждают навык и не открывают платный доступ/)
  assert.equal((html.match(/bg-violet px-3/g)||[]).length,1)
 }finally{delete globalThis.__learningNext}
})
