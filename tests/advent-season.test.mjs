import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { adventToday, seasonDates, missionAvailable, seasonScope, readSeasonProgress, saveSeasonProgress } from '../src/lib/advent-season.ts'
import { navigationHash, navigationFromHash } from '../src/lib/app-navigation.ts'

test('season has 53 consecutive inclusive days and respects Kazakhstan midnight',()=>{
 const dates=seasonDates();assert.equal(dates.length,53);assert.equal(dates[0],'2026-11-14');assert.equal(dates.at(-1),'2027-01-05');assert.equal(new Set(dates).size,53)
 assert.equal(adventToday(new Date('2026-11-13T18:59:59Z')),'2026-11-13')
 assert.equal(adventToday(new Date('2026-11-13T19:00:00Z')),'2026-11-14')
 assert.equal(adventToday(new Date('2027-01-05T19:00:00Z')),'2027-01-06')
 assert.equal(missionAvailable('2026-11-14','2026-11-13'),false)
 assert.equal(missionAvailable('2026-11-15','2026-11-14'),false)
 assert.equal(missionAvailable('2026-11-14','2027-01-06'),true)
 assert.equal(missionAvailable('2025-01-01','2027-01-06'),false)
})
test('local self-checks are bounded, isolated and honest when storage fails',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)}
 const key=seasonScope(1,false)
 assert.notEqual(key,seasonScope(1,true));assert.notEqual(key,seasonScope(2,false))
 assert.equal(saveSeasonProgress(storage,key,['2026-11-14','2026-11-14','bad']),true)
 assert.deepEqual(readSeasonProgress(storage,key),['2026-11-14']);assert.deepEqual(readSeasonProgress(storage,seasonScope(2,false)),[])
 map.set(key,'{"pretend":true}');assert.deepEqual(readSeasonProgress(storage,key),[])
 map.set(key,'bad');assert.deepEqual(readSeasonProgress(storage,key),[])
 assert.equal(saveSeasonProgress(undefined,key,[]),false);assert.equal(saveSeasonProgress({setItem(){throw Error('quota')}},key,[]),false)
})
test('public calendar route roundtrips without exposing progress or replacing server rewards',()=>{
 const state={tab:'home',stack:[{type:'advent-season'}]}
 assert.equal(navigationHash(state),'#/ai-practice-season');assert.deepEqual(navigationFromHash('#/ai-practice-season'),state)
 assert.deepEqual(navigationFromHash('#/advent'),{tab:'home',stack:[{type:'advent'}]})
 assert.equal(navigationHash({tab:'home',stack:[{type:'advent'}]}),'#/advent')
})
test('each day has an original useful task, beginner and advanced route and an artifact',async()=>{
 const missions=JSON.parse(await readFile(new URL('../content/advent/ai-winter-2026.json',import.meta.url),'utf8'))
 assert.deepEqual(missions.map(m=>m.date),seasonDates());assert.equal(new Set(missions.map(m=>m.title)).size,53)
 for(const m of missions){for(const name of ['title','teaser','prompt','advanced','deliverable','check','courseTag'])assert.ok(typeof m[name]==='string'&&m[name].trim().length>4,`${m.date}:${name}`);assert.ok(m.body.length>=2);assert.ok(m.minutes>=5&&m.minutes<=25)}
})
test('season shell has no reward/API write, exposes local limits and retains old calendar',async()=>{
 const source=await readFile(new URL('../src/screens/advent/Season.tsx',import.meta.url),'utf8')
 assert.doesNotMatch(source,/api\.|setAdvent\(|setMe\(|\.adventOpen\(/)
 assert.match(source,/<LegacyAdventScreen\/>/);assert.match(source,/Отметки только на этом устройстве/);assert.match(source,/без синхронизации и начисления XP/)
 assert.match(source,/!missionAvailable\(selected, today\)/);assert.match(source,/m.date === selected && missionAvailable/)
 const home=await readFile(new URL('../src/screens/Home.tsx',import.meta.url),'utf8')
 assert.ok(home.indexOf('<Companion')<home.indexOf('<AdventBanner'));assert.ok(home.indexOf('<AdventBanner')<home.indexOf('<LearningNext'))
 const banner=await readFile(new URL('../src/screens/advent/SeasonBanner.tsx',import.meta.url),'utf8')
 assert.doesNotMatch(banner,/if \(!advent\) return null/);assert.match(banner,/type: 'advent-season'/)
})

test('actual seasonal components render without a backend calendar and hide future task bodies',async()=>{
 const {transformWithOxc}=await import('vite'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server')
 const model=await import('../src/lib/advent-season.ts')
 const missions=JSON.parse(await readFile(new URL('../content/advent/ai-winter-2026.json',import.meta.url),'utf8'))
 let today='2026-11-14'
 const store=selector=>selector({me:{id:7},pop(){},push(){},advent:null})
 const button=({children,feedback,...props})=>createElement('button',props,children)
 globalThis.__seasonHarness={...model,useStore:store,Tap:button,isDemo:false,AdventBanner:()=>null,useSeasonToday:()=>today,slide:{className:'absolute'},LegacyAdventScreen:()=>null,DoorCell:({cell})=>createElement('button',{'data-door':cell.day,'data-state':cell.state},String(cell.day))}
 globalThis.__seasonMissions=missions
 async function load(name, revealed=false){
  const path=new URL(`../src/screens/advent/${name}.tsx`,import.meta.url)
  let source=await readFile(path,'utf8')
  if(revealed) source=source.replace('useState<string | null>(null)', "useState<string | null>('2026-11-14')")
  let code=(await transformWithOxc(source,path.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
  code=code.replace(/import \{([^}]+)\} from ["'](\.\.?\/[^"']+)["'];?/g,(_,names)=>`const {${names}}=globalThis.__seasonHarness;`)
  code=code.replace(/import missionsData from ["'][^"']+["'];?/g,'const missionsData=globalThis.__seasonMissions;')
  code=code.replace(/import ["'][^"']+\.css["'];?/g,'')
  for(const name of ['react','react/jsx-runtime','lucide-react','motion/react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
 }
 try{
  Object.assign(globalThis.__seasonHarness, await load('themes'))
  const {SeasonBanner}=await load('SeasonBanner')
  const banner=renderToStaticMarkup(createElement(SeasonBanner));assert.match(banner,/День 1 из 53/);assert.match(banner,/AI-адвент/)
  const {AdventSeasonScreen}=await load('Season')
  const html=renderToStaticMarkup(createElement(AdventSeasonScreen))
  assert.ok(!html.includes(missions[0].body[0]));assert.equal((html.match(/data-door=/g)||[]).length,53);assert.match(html,/Новогодний AI-адвент/);assert.match(html,/advent-newyear/)
  const OpenSeason=(await load('Season',true)).AdventSeasonScreen
  const opened=renderToStaticMarkup(createElement(OpenSeason));assert.ok(opened.includes(missions[0].body[0]));assert.match(opened,/Отметки только на этом устройстве/);assert.match(opened,/Твой результат/)
  today='2026-11-13';const locked=renderToStaticMarkup(createElement(OpenSeason));assert.ok(!locked.includes(missions[0].body[0]));assert.match(locked,/Старт 14 ноября/)
  const before=renderToStaticMarkup(createElement(AdventSeasonScreen));assert.ok(!before.includes(missions[0].body[0]));assert.match(before,/data-state="locked"/)
  today='2027-01-06';const after=renderToStaticMarkup(createElement(AdventSeasonScreen));assert.ok(!after.includes(missions.at(-1).body[0]));assert.equal((after.match(/data-door=/g)||[]).length,53)
 }finally{delete globalThis.__seasonHarness;delete globalThis.__seasonMissions}
})


test('original calendar entry shows isolated new season and retains legacy archive',async()=>{
 const home=await readFile(new URL('../src/screens/Home.tsx',import.meta.url),'utf8')
 assert.match(home,/<AdventBanner\/>/);assert.doesNotMatch(home,/<SeasonBanner/);assert.doesNotMatch(home,/53 AI-практики/)
 const app=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8')
 assert.doesNotMatch(app,/type: useStore.getState\(\).advent \? 'advent' : 'advent-season'/)
 const original=await readFile(new URL('../src/screens/advent/Advent.tsx',import.meta.url),'utf8')
 assert.match(original,/api\s*\.advent\(\)/);assert.match(original,/type: 'door'/);assert.match(original,/<CatchupSheet/);assert.match(original,/data.rewards.map/)
})
