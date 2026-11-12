import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import * as companion from '../src/lib/home-companion.ts'
const {companionCues,nextCompanionCue,parseCompanionSession,readCompanionSession,saveCompanionSession,parseCompanionPreferences,readCompanionPreferences,saveCompanionPreferences,companionPreferencesKey,companionName,COMPANION_AUTO_LIMIT,COMPANION_INTERVAL_MS}=companion
const now=Date.parse('2026-11-11T12:00:00Z')
const card=(id,extra={})=>({id,kind:'lesson',course_id:null,published:true,published_at:`2026-11-${String(id).padStart(2,'0')}T10:00:00Z`,title:`Полезная статья ${id}`,news_eligible:true,...extra})
const advent={title:'Адвент',start:'2026-11-01',days:24,today:11,opened:4,today_open:false,streak:1}

test('empty or unknown data has a real free-start fallback, not pretend progress',()=>{
 const cues=companionCues([],null,[],now)
 assert.equal(cues.length,1);assert.deepEqual(cues[0].target,{type:'learning',path:'/start'});assert.match(cues[0].detail,/бесплатно/)
 assert.equal(nextCompanionCue(cues,'start'),'start')
})
test('article uses newest unread eligible published post and exact title, never future/course content',()=>{
 const feed=[card(7),card(8),card(9),card(10,{kind:'story'}),card(11,{course_id:1}),card(12),card(6,{published:false}),card(5,{news_eligible:false})]
 const cue=companionCues(feed,null,[9],now).find(c=>c.tone==='read')
 assert.equal(cue.id,'post:8');assert.equal(cue.detail,'Полезная статья 8');assert.deepEqual(cue.target,{type:'lesson',id:8,post:true})
 const read=companionCues([card(7),card(8)],null,[7,8],now).find(c=>c.tone==='read')
 assert.equal(read.target.id,8);assert.doesNotMatch(read.detail,/непрочит/)
 assert.equal(companionCues([card(2,{published:false}),card(3,{kind:'story'}),card(4,{course_id:9}),card(5,{news_eligible:false}),card(12)],null,[],now).length,1)
})
test('advent action needs an existing available unopened integer day and fresh state',()=>{
 const cue=companionCues([],advent,[],now).find(c=>c.tone==='advent')
 assert.deepEqual(cue.target,{type:'advent'});assert.match(cue.detail,/№11/)
 for(const invalid of [null,{...advent,today:0},{...advent,today:1.5},{...advent,today:NaN},{...advent,today:25},{...advent,today_open:true}]) assert.equal(companionCues([],invalid,[],now).some(c=>c.tone==='advent'),false)
 assert.equal(companionCues([],advent,[],now,{fresh:false}).some(c=>c.tone==='advent'),false)
})
test('daily prompt follows server state; stale refresh cannot assert a claimed or available reward',()=>{
 for(const claimed of [false,true]){
  const cues=companionCues([],advent,[],now,{me:{daily_claimed:claimed}})
  assert.equal(cues[0].id,claimed?'daily:done':'daily:ready');assert.deepEqual(cues[0].target,{type:'daily'})
  assert.equal(cues[0].tone,claimed?'celebrate':'daily')
  const stale=companionCues([],advent,[],now,{me:{daily_claimed:claimed},fresh:false})
  assert.ok(!stale.some(c=>['daily','celebrate','advent'].includes(c.tone)))
 }
})
test('continue only a real accessible in-progress course, otherwise explicit catalog route',()=>{
 const course={id:12,title:'Работа с текстом',access:true,done:2,lessons:8}
 const cues=companionCues([],null,[],now,{courses:[course]})
 const cue=cues.find(c=>c.id==='course:12');assert.deepEqual(cue.target,{type:'course',id:12});assert.match(cue.detail,/2 из 8/)
 for(const other of [{...course,done:0},{...course,done:8},{...course,access:false},{...course,lessons:0}]){
  const list=companionCues([],null,[],now,{courses:[other]});assert.ok(!list.some(c=>c.id.startsWith('course:')))
  assert.deepEqual(list.find(c=>c.id==='courses').target,{type:'learning',path:'/og-practice'})
 }
})
test('manual sequence wraps safely and falls back to first cue after a removed target',()=>{
 const cues=companionCues([card(8)],advent,[],now)
 for(let i=0;i<cues.length;i++) assert.equal(nextCompanionCue(cues,cues[i].id),cues[(i+1)%cues.length].id)
 assert.equal(nextCompanionCue(cues,'removed'),cues[0].id);assert.equal(nextCompanionCue([],'removed'),'start')
})
test('session ignores old collapse state and bounds automatic rotation',()=>{
 const initial={cueId:'',paused:false,autoChanges:0}
 for(const raw of [null,'bad','null','false','5'])assert.deepEqual(parseCompanionSession(raw),initial)
 assert.deepEqual(parseCompanionSession('{"cueId":1,"paused":"yes","collapsed":true,"autoChanges":999}'),{...initial,autoChanges:2})
 assert.equal(parseCompanionSession('{"autoChanges":-3}').autoChanges,0);assert.equal(parseCompanionSession('{"autoChanges":1.5}').autoChanges,0)
 assert.equal(COMPANION_AUTO_LIMIT,2);assert.ok(COMPANION_INTERVAL_MS>=14000)
})
test('look is validated, bounded, handles corrupt storage and strips control/bidi characters',()=>{
 const initial={name:'Dots',color:'violet',shape:'soft',accessory:'none'}
 for(const raw of [null,'bad','null','false','5','[]','{}'])assert.deepEqual(parseCompanionPreferences(raw),initial)
 assert.deepEqual(parseCompanionPreferences('{"name":"  Луна  ","color":"mint","shape":"round","accessory":"sprout"}'),{name:'Луна',color:'mint',shape:'round',accessory:'sprout'})
 assert.deepEqual(parseCompanionPreferences('{"name":3,"color":"css-injection","shape":null,"accessory":"url(x)"}'),initial)
 assert.equal(companionName('  Ма\u202eкс \u0000  друг  '),'Макс друг');assert.equal(companionName('  '),'Dots');assert.equal(Array.from(companionName('🌟'.repeat(50))).length,24)
})
test('failed persistence is explicit, retained in memory and isolated from another user',()=>{
 const value={name:'Персик',color:'peach',shape:'spark',accessory:'glasses'}
 assert.equal(saveCompanionPreferences(910,value),false)
 assert.deepEqual(readCompanionPreferences(910),value);assert.notDeepEqual(readCompanionPreferences(911),value)
 assert.notEqual(companionPreferencesKey(910),companionPreferencesKey(911))
 const session={cueId:'start',paused:true,autoChanges:2};saveCompanionSession(910,session)
 assert.deepEqual(readCompanionSession(910),session);assert.notDeepEqual(readCompanionSession(911),session)
})
test('look writes are scoped and normalized, no raw drafts are stored',()=>{
 const items=new Map();globalThis.localStorage={getItem:k=>items.get(k)??null,setItem:(k,v)=>items.set(k,v)}
 try{
  assert.equal(saveCompanionPreferences(912,{name:'  Луна  ',color:'sky',shape:'soft',accessory:'none'}),true)
  assert.deepEqual([...items.keys()],[companionPreferencesKey(912)]);assert.equal(JSON.parse(items.values().next().value).name,'Луна')
  assert.equal(readCompanionPreferences(913).name,'Dots')
 }finally{delete globalThis.localStorage}
})
test('single compact layout exposes separate real action, pet and settings; animation honors lifecycle',async()=>{
 const {transformWithOxc}=await import('vite'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server')
 const file=new URL('../src/screens/home/Companion.tsx',import.meta.url),source=await readFile(file,'utf8')
 let code=(await transformWithOxc(source,file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import \{([^}]+)\} from ["']\.\.\/[^"']+["'];?/g,(_statement,names)=>`const {${names}} = globalThis.__companionHarness;`)
 code=code.replace(/import ["']\.\/companion\.css["'];?/g,'')
 code=code.replace(/import \{ DotsCharacter \} from ["']\.\/dots\/DotsCharacter["'];?/g,'const { DotsCharacter } = globalThis.__companionHarness;')
 for(const name of ['react','react-dom','react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 let reduced=false
 globalThis.__companionHarness={...companion,DotsCharacter:()=>null,FocusLayer:()=>null,readCompanionPreferences:()=>({name:'Луна',color:'mint',shape:'soft',accessory:'none'}),readCompanionSession:()=>parseCompanionSession(null),saveCompanionSession(){},useReadPosts:()=>[],useDocumentVisible:()=>true,useElementVisible:()=>true,usePrefersReducedMotion:()=>reduced,
 useStore:selector=>selector({feed:[card(8)],advent,me:{daily_claimed:false},courses:[],stack:[],reward:null,share:null,push(){}})}
 try{
  const {Companion}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  let html=renderToStaticMarkup(createElement(Companion,{userId:1}))
  assert.match(html,/Луна: погладить и показать другую идею/);assert.match(html,/Настроить Dots/);assert.match(html,/К отметке дня/)
  assert.match(html,/role="status" aria-live="polite" aria-atomic="true"><\/span>/);assert.doesNotMatch(html,/data-collapsed|aria-expanded|Показать подсказку/)
  reduced=true;html=renderToStaticMarkup(createElement(Companion,{userId:1}));assert.match(html,/data-moving="false"/)
 }finally{delete globalThis.__companionHarness}
 assert.match(source,/current\.autoChanges \+ 1/);assert.match(source,/window\.clearTimeout/);assert.match(source,/moving && !hovered && !focused/)
 assert.match(source,/!covered/);assert.match(source,/data-reacting=\{moving && reaction/);assert.match(source,/pointerType !== 'mouse'/);assert.match(source,/previousClaim.current === false && me\?\.daily_claimed === true/)
 assert.doesNotMatch(source,/fetch\(|api\.daily|api\.advent|dangerouslySetInnerHTML/)
 const css=await readFile(new URL('../src/screens/home/companion.css',import.meta.url),'utf8')
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);assert.match(css,/min-width: 44px; min-height: 44px/);assert.doesNotMatch(css,/text-overflow: ellipsis|white-space: nowrap|line-clamp/)
})
