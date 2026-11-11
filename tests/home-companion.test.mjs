import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {companionCues, nextCompanionCue, parseCompanionSession, readCompanionSession, saveCompanionSession, COMPANION_AUTO_LIMIT, COMPANION_INTERVAL_MS} from '../src/lib/home-companion.ts'

const now = Date.parse('2026-11-11T12:00:00Z')
const card = (id, extra = {}) => ({id, kind:'lesson', course_id:null, published:true, published_at:`2026-11-${String(id).padStart(2,'0')}T10:00:00Z`, title:`Полезная статья ${id}`, news_eligible:true, ...extra})
const advent = {title:'Адвент',start:'2026-11-01',days:24,today:11,opened:4,today_open:false,streak:1}

test('always offers the real free-start route, even without content', () => {
 const cues=companionCues([],null,[],now)
 assert.equal(cues.length,1)
 assert.deepEqual(cues[0].target,{type:'learning',path:'/start'})
 assert.match(cues[0].detail,/бесплатно/)
 assert.equal(nextCompanionCue(cues,'start'),'start')
})
test('article points to the newest unread eligible, published, non-course post', () => {
 const feed=[card(7),card(8),card(9),card(10,{kind:'story'}),card(11,{course_id:1}),card(12),card(6,{published:false}),card(5,{news_eligible:false})]
 const cue=companionCues(feed,null,[9],now).find(c=>c.tone==='read')
 assert.equal(cue.id,'post:8')
 assert.equal(cue.detail,'Полезная статья 8')
 assert.deepEqual(cue.target,{type:'lesson',id:8,post:true})
})
test('all-read feed still has an honest article action, no unread claim', () => {
 const cue=companionCues([card(7),card(8)],null,[7,8],now)[1]
 assert.equal(cue.target.id,8)
 assert.doesNotMatch(cue.detail,/непрочит/)
})
test('no article action when feed contains only unavailable material', () => {
 assert.equal(companionCues([card(2,{published:false}),card(3,{kind:'story'}),card(4,{course_id:9}),card(5,{news_eligible:false}),card(12)],null,[],now).length,1)
})
test('advent action uses only an existing available unopened day', () => {
 const cue=companionCues([],advent,[],now).find(c=>c.tone==='advent')
 assert.deepEqual(cue.target,{type:'advent'})
 assert.match(cue.detail,/№11/)
 for(const unavailable of [null,{...advent,today:0},{...advent,today:-1},{...advent,today:25},{...advent,today_open:true}]){
  assert.equal(companionCues([],unavailable,[],now).some(c=>c.tone==='advent'),false)
 }
})
test('manual sequence wraps safely, including a disappeared cue', () => {
 const cues=companionCues([card(8)],advent,[],now)
 assert.equal(nextCompanionCue(cues,'start'),'post:8')
 assert.equal(nextCompanionCue(cues,'post:8'),cues[2].id)
 assert.equal(nextCompanionCue(cues,cues[2].id),'start')
 assert.equal(nextCompanionCue(cues,'removed'),'post:8')
 assert.equal(nextCompanionCue([],'removed'),'start')
})
test('session preferences are bounded and tolerate corrupt browser storage', () => {
 const initial={cueId:'start',collapsed:false,paused:false,autoChanges:0}
 for(const raw of [null,'bad','null','false','5']) assert.deepEqual(parseCompanionSession(raw),initial)
 assert.deepEqual(parseCompanionSession('{"cueId":1,"paused":"yes","collapsed":true,"autoChanges":999}'),{...initial,collapsed:true,autoChanges:2})
 assert.equal(parseCompanionSession('{"autoChanges":-3}').autoChanges,0)
 assert.equal(parseCompanionSession('{"autoChanges":1.5}').autoChanges,0)
 assert.equal(COMPANION_AUTO_LIMIT,2)
 assert.ok(COMPANION_INTERVAL_MS>=14000)
})
test('storage failure does not crash and preferences stay scoped to a user', () => {
 const value={cueId:'start',collapsed:true,paused:true,autoChanges:2}
 saveCompanionSession(910,value)
 assert.deepEqual(readCompanionSession(910),value)
 assert.notDeepEqual(readCompanionSession(911),value)
})
test('component exposes real actions, persistent collapse, quiet auto changes and reduced motion', async () => {
 const {transformWithOxc}=await import('vite'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server')
 const file=new URL('../src/screens/home/Companion.tsx',import.meta.url), source=await readFile(file,'utf8')
 let code=(await transformWithOxc(source,file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import \{([^}]+)\} from ["']\.\.\/[^"']+["'];?/g,(_statement,names)=>`const {${names}} = globalThis.__companionHarness;`)
 code=code.replace(/import ["']\.\/companion\.css["'];?/g,'')
 for(const name of ['react','react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 let reduced=false, session=parseCompanionSession(null)
 globalThis.__companionHarness={companionCues,COMPANION_AUTO_LIMIT,COMPANION_INTERVAL_MS,nextCompanionCue,
  readCompanionSession:()=>session,saveCompanionSession(){},useReadPosts:()=>[],useDocumentVisible:()=>true,useElementVisible:()=>true,usePrefersReducedMotion:()=>reduced,
  useStore:selector=>selector({feed:[card(8)],advent,stack:[],reward:null,share:null,push(){}})}
 try{
  const {Companion}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  let html=renderToStaticMarkup(createElement(Companion,{userId:1}))
  assert.match(html,/Попробовать ИИ/);assert.match(html,/Другая идея/);assert.match(html,/aria-expanded="true"/)
  assert.match(html,/Приостановить анимацию и подсказки/);assert.match(html,/role="status" aria-live="polite" aria-atomic="true"><\/span>/)
  reduced=true;html=renderToStaticMarkup(createElement(Companion,{userId:1}))
  assert.match(html,/data-moving="false"/);assert.doesNotMatch(html,/Приостановить анимацию/)
  session={...session,collapsed:true};html=renderToStaticMarkup(createElement(Companion,{userId:1}))
  assert.match(html,/Показать подсказку спутника/);assert.match(html,/aria-expanded="false"/);assert.doesNotMatch(html,/>Попробовать ИИ</)
 }finally{delete globalThis.__companionHarness}
 assert.match(source,/current\.autoChanges \+ 1/);assert.match(source,/window\.clearTimeout/)
 assert.match(source,/!covered && !hovered && !focused/)
 const css=await readFile(new URL('../src/screens/home/companion.css',import.meta.url),'utf8')
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/)
 assert.match(css,/min-width: 44px; min-height: 44px/)
 assert.match(css,/animation-play-state: paused !important/)
 assert.doesNotMatch(css,/position: fixed|z-index: 999/)
})
