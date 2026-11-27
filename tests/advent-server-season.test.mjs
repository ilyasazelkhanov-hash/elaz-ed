import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {buildDoors,buildSql,seedJson,SEASON} from '../content/advent/build-season.mjs'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('season doors keep every mission, mix real interactions and reuse the previous XP rules',async()=>{
 const doors=buildDoors(),missions=JSON.parse(await read('content/advent/ai-winter-2026.json'))
 assert.equal(doors.length,53);assert.deepEqual(doors.map(d=>d.day),Array.from({length:53},(_,i)=>i+1))
 const kinds=Object.groupBy(doors,d=>d.kind)
 for(const kind of ['quiz','scratch','arcade','story'])assert.ok(kinds[kind].length>=7,kind)
 for(const [i,d] of doors.entries()){
  const m=missions[i]
  assert.equal(d.title,m.title)
  for(const text of [...m.body,m.deliverable,m.check,m.advanced])assert.ok(d.body.includes(text),`${d.day}: mission text kept`)
  assert.ok(d.kind==='scratch'?d.prize===m.prompt&&!d.body.includes(m.prompt):d.body.includes(m.prompt),`${d.day}: prompt placed once`)
  assert.equal(d.xp,d.day===53?50:{quiz:30,scratch:25,arcade:20,story:15}[d.kind])
  if(d.kind==='arcade')assert.deepEqual(d.arcade,{seconds:30,cap:40})
  for(const q of d.quiz??[]){assert.ok(q.options.length>=3);assert.ok(q.options[q.correct]);assert.equal(new Set(q.options).size,q.options.length)}
 }
 // No more than three identical interactions in a row: the calendar must not turn into a text checklist.
 for(let i=3;i<doors.length;i++)assert.ok(new Set(doors.slice(i-3,i+1).map(d=>d.kind)).size>1,`run ends at ${i+1}`)
})

test('generated seed files are current, season-scoped and never activate or overwrite opened doors',async()=>{
 const doors=buildDoors(),sql=await read('content/advent/ai-winter-2026.seed.sql')
 assert.equal(sql,buildSql(doors));assert.equal(await read('src/lib/adventSeasonSeed.json'),seedJson(doors))
 assert.match(sql,/on conflict \(season, day\) do update/);assert.match(sql,/where not exists \(select 1 from public\.advent_opens o where o\.season = excluded\.season/)
 assert.doesNotMatch(sql,/settings|advent_rewards|reward_codes|delete|truncate/i)
 assert.equal((sql.match(new RegExp(`\\('${SEASON}', \\d+,`,'g'))||[]).length,53)
 const activate=await read('content/advent/ai-winter-2026.activate.sql')
 assert.match(activate,/raise exception/);assert.match(activate,/insert into public\.advent_seasons \(id, config, archived_at\)/)
 assert.doesNotMatch(activate,/delete from|truncate|drop /i);assert.doesNotMatch(activate,/advent_rewards|advent_tickets|reward_codes/)
})

test('seed and activation run on the real schema and keep the finished campaign intact',async t=>{
 const {PGlite}=await import('@electric-sql/pglite')
 const db=new PGlite();t.after(()=>db.close())
 await db.exec(`create schema extensions;create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$select decode(repeat(md5(random()::text),ceil(n/16.0)::int),'hex')$$;create role anon;create role authenticated;create role service_role bypassrls;`)
 for(const f of ['001_init.sql','006_courses_stars_freezes.sql','007_refunds_webhook_url.sql','009_advent.sql','010_advent_catchup_rewards.sql','011_advent_prize_modes.sql','20261115120000_advent_seasons.sql'])
  await db.exec((await read('supabase/migrations/'+f)).replace('create extension if not exists pgcrypto with schema extensions;',''))
 const one=async q=>(await db.query(q)).rows[0]
 await db.exec(`insert into users(id,xp) values(1,90);
  update settings set value='{"enabled":true,"title":"Creator Vault","theme":"standard","start":"2026-10-18","days":24,"tz":300,"grace":3,"catchup":{"methods":["quiz"],"stars":75}}' where key='advent';
  insert into settings(key,value) values('advent_push_morning','{"day":2,"done":true}');
  insert into advent_doors(day,title) select i,'Old '||i from generate_series(1,24)i;insert into advent_opens(user_id,day,xp) values(1,1,30);`)
 const activate=await read('content/advent/ai-winter-2026.activate.sql'),seed=await read('content/advent/ai-winter-2026.seed.sql')
 await assert.rejects(db.exec(activate),/не загружены/)
 await db.exec('rollback')
 assert.equal((await one(`select advent_active_season() s`)).s,'legacy')
 await db.exec(seed)
 await db.exec(`select * from advent_open('${SEASON}',1,1,0,0,25,false);update advent_doors set title='Правка автора' where season='${SEASON}' and day=2`)
 await db.exec(seed) // repeat: an opened door stays as participants saw it, unopened doors return to the source
 assert.equal((await one(`select count(*)::int n from advent_doors where season='${SEASON}'`)).n,53)
 assert.notEqual((await one(`select title from advent_doors where season='${SEASON}' and day=2`)).title,'Правка автора')
 await db.exec(`update advent_doors set title='Открытая' where season='${SEASON}' and day=1`);await db.exec(seed)
 assert.equal((await one(`select title from advent_doors where season='${SEASON}' and day=1`)).title,'Открытая')
 const expectedStart=(await one("select (((statement_timestamp() at time zone 'UTC') + interval '5 hours')::date)::text as d")).d
 await db.exec(activate)
 await db.exec("update settings set value='{\"day\":1,\"done\":true}' where key='advent_push_morning'")
 await db.exec(activate)
 const now=(await one(`select value from settings where key='advent'`)).value
 assert.deepEqual([now.season,now.start,now.days,now.theme,now.enabled,now.grace,now.tz],[SEASON,expectedStart,53,'newyear',true,3,300])
 assert.deepEqual(now.catchup,{methods:['quiz'],stars:75})
 const old=(await one(`select config,archived_at from advent_seasons where id='legacy'`))
 assert.deepEqual([old.config.title,old.config.start,old.config.days],['Creator Vault','2026-10-18',24]);assert.ok(old.archived_at)
 assert.equal((await one(`select count(*)::int n from advent_doors where season='legacy'`)).n,24)
 assert.deepEqual(await one(`select day,xp,season from advent_opens where user_id=1 and season='legacy'`),{day:1,xp:30,season:'legacy'})
 assert.deepEqual((await one(`select value from settings where key='advent_push_morning'`)).value,{day:1,done:true})
})

test('home entry prefers the server calendar and keeps the local practice calendar only as a fallback',async()=>{
 const {transformWithOxc}=await import('vite'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server')
 const path=new URL('../src/screens/advent/Banner.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(path,'utf8'),path.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import \{([^}]+)\} from ["'](\.\.?\/[^"']+)["'];?/g,(_,names)=>`const {${names}}=globalThis.__bannerHarness;`)
 for(const name of ['react','react/jsx-runtime','lucide-react','motion/react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 const pushed=[];let advent=null
 globalThis.__bannerHarness={useStore:selector=>selector({advent,push:o=>pushed.push(o)}),Tap:({children,feedback,onClick,...props})=>{onClick();return createElement('button',props,children)},dayMonth:()=> '14 ноября',plural:(n,forms)=>forms[2],
  ADVENT_START:'2026-11-14',seasonDates:()=>['2026-11-14','2026-11-15'],useSeasonToday:()=> '2026-11-15',themeOf:id=>({hero:'black',ink:'white',chip:'gray',id}),ThemeScene:()=>null}
 try{
  const {AdventBanner}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const local=renderToStaticMarkup(createElement(AdventBanner))
  assert.match(local,/Практика дня 2/);assert.doesNotMatch(local,/XP|серия|ждёт тебя/);assert.deepEqual(pushed.pop(),{type:'advent-season'})
  advent={season:'ai-winter-2026',title:'Новогодний AI-адвент',theme:'newyear',start:'2026-11-14',days:53,today:2,opened:1,today_open:false,streak:1}
  const live=renderToStaticMarkup(createElement(AdventBanner))
  assert.match(live,/Дверь №2 ждёт тебя · серия 1/);assert.doesNotMatch(live,/Практика дня/);assert.deepEqual(pushed.pop(),{type:'advent'})
  advent={...advent,today_open:true,streak:2}
  assert.match(renderToStaticMarkup(createElement(AdventBanner)),/Дверь №2 открыта · серия 2\. Завтра новая/)
 }finally{delete globalThis.__bannerHarness}
})

test('calendar and door use the server contract with real rewards, and the archive stays read-only',async()=>{
 const [calendar,door,api,mock]=await Promise.all(['src/screens/advent/Advent.tsx','src/screens/advent/Door.tsx','src/lib/api.ts','src/lib/mockAdvent.ts'].map(read))
 assert.match(calendar,/api\s*\.advent\(season\)/);assert.match(calendar,/push\(\{ type: 'door', day: cell\.day, season \}\)/)
 assert.match(calendar,/if \(!season\) useStore\.getState\(\)\.setAdvent\(summary\)/);assert.match(calendar,/data && !data\.archived && <CatchupSheet/)
 assert.match(door,/api\.adventOpen\(day, input, season\)/);assert.match(door,/setMe\(r\.me\)/);assert.match(door,/sfx\.coin\(\)/);assert.match(door,/celebrate\(\)/);assert.match(door,/haptic\.success\(\)/);assert.match(door,/<ResultCard/)
 assert.match(api,/call\('advent_open', \{ day, \.\.\.input, \.\.\.\(season \? \{ season \} : \{\}\) \}\)/)
 assert.match(mock,/adventSeasonSeed\.json/);assert.match(mock,/elaz-ed-demo-advent-v2/)
})
