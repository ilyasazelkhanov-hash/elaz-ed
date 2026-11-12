import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {transformWithOxc} from 'vite'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {activeStories} from '../src/lib/highlights.ts'

let nonce=0
async function load(file, mocks){
 const url=new URL(`../src/${file}`,import.meta.url)
 let code=(await transformWithOxc(await readFile(url,'utf8'),url.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import \{([^}]+)\} from ["'](\.\.?\/[^"']+)["'];?/g,(_,names)=>`const {${names}}=globalThis.__homeHierarchy;`)
 code=code.replace(/import ["'][^"']+\.css["'];?/g,'')
 for(const name of ['react','react/jsx-runtime','motion/react','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 globalThis.__homeHierarchy=mocks
 return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${++nonce}`)
}
const button=({children,feedback,onClick,...props})=>createElement('button',props,children)

test('home places one server XP target beside avatar and daily state replaces itself, without redundant greetings',async()=>{
 const story={id:1,kind:'story',published:true,course_id:null,category:'Практика'}
 const state={me:{id:1,name:'Ильяс',xp:1234,streak:0,daily_claimed:false},feed:[story,{...story,id:2,published:false},{...story,id:3,course_id:4}],setTab(){}}
 let saved=[]
 const {Home}=await load('screens/Home.tsx',{
  activeStories,useStore:selector=>selector(state),useSavedPosts:()=>saved,useFollowedTopics:()=>[],knowledgeTopics:[],
  Avatar:()=>createElement('span',{'data-avatar':true}),Odometer:({value})=>value,Tap:button,
  Companion:()=>createElement('span',{'data-companion':true}),DailyCard:()=>createElement('span',null,'REWARD_AVAILABLE'),StreakCard:()=>createElement('span',null,'REWARD_CLAIMED'),
  AdventBanner:()=>null,MainCourses:()=>null,Feed:()=>null,StoryBubble:({card})=>createElement('span',{'data-story-id':card.id}),openBlogLibrary(){},
 })
 let html=renderToStaticMarkup(createElement(Home))
 assert.equal((html.match(/id="xp-pill"/g)||[]).length,1)
 const header=html.slice(html.indexOf('<header'),html.indexOf('</header>'))
 assert.match(header,/1234/);assert.match(header,/id="xp-pill"/);assert.match(header,/data-avatar/)
 assert.match(header,/Профиль, 1234 XP/)
 assert.match(html,/REWARD_AVAILABLE/);assert.doesNotMatch(html,/REWARD_CLAIMED|Рад видеть|Маленький бонус|Мой прогресс|Отложить на потом/)
 assert.match(html,/<details[^>]+aria-label="Темы публикаций"/)
 assert.doesNotMatch(html,/<details[^>]+open/)
 assert.match(html,/id="daily-check-in" tabindex="-1"/)
 assert.match(html,/data-story-id="1"/);assert.doesNotMatch(html,/data-story-id="[23]"/)
 state.me.daily_claimed=true;state.me.xp=1244;saved=[3]
 html=renderToStaticMarkup(createElement(Home))
 assert.match(html,/REWARD_CLAIMED/);assert.doesNotMatch(html,/REWARD_AVAILABLE/)
 assert.match(html,/1244/);assert.match(html,/Сохранённые · 1/)
})

test('confirmed daily card shows inline weekly progress, never grants a second reward',async()=>{
 const state={me:{streak:7,best_streak:12,freezes:2}}
 const useStore=selector=>selector(state);useStore.setState=()=>{}
 const {StreakCard}=await load('screens/home/Daily.tsx',{
  useStore,dailyReward:n=>n*10,days:n=>`${n} дней`,Tap:button,
  api:{daily(){throw Error('render cannot claim')}},errorText:String,sfx:{},streakCard(){},haptic:{},Emoji:()=>null,burst(){},flyPoints(){},Pattern:()=>null,GRADIENTS:{},
 })
 const html=renderToStaticMarkup(createElement(StreakCard))
 assert.match(html,/Отметка за сегодня получена/);assert.match(html,/Стрик 7 дней · завтра \+80 XP/)
 assert.doesNotMatch(html,/<details|Серия и заморозки|Забрать бонус дня/)
 assert.match(html,/role="meter"/);assert.match(html,/aria-valuenow="7"/);assert.match(html,/aria-valuetext="7 из 7 дней"/)
 assert.match(html,/Запас заморозок полон/);assert.match(html,/Поделиться стриком/)
 state.me={streak:1,best_streak:2,freezes:0}
 const first=renderToStaticMarkup(createElement(StreakCard))
 assert.match(first,/aria-valuenow="1"/);assert.match(first,/6 дней до заморозки/)
 assert.match(first,/Заморозок в запасе: 0/)
})

test('profile retains XP and member card instead of duplicating a new home progress panel',async()=>{
 const source=await readFile(new URL('../src/screens/Profile.tsx',import.meta.url),'utf8')
 assert.match(source,/<HoloCard me={me}/)
 assert.match(source,/me\.xp.*<Counter value={me\.xp}/)
 assert.match(source,/стрик · рекорд \$?\{me.best_streak\}/)
})

test('advent presents its real campaign title and one current state without a second generic heading',async()=>{
 const state={advent:{today:3,days:24,today_open:false,opened:1,streak:1,title:'Зимний адвент',theme:'mint',start:'2026-11-01'},push(){}}
 const {AdventBanner}=await load('screens/advent/Banner.tsx',{
  useStore:selector=>selector(state),Tap:button,dayMonth:()=> '1 ноября',plural:(n,forms)=>forms[0],
  themeOf:()=>({hero:'black',ink:'white',chip:'gray',id:'mint'}),ThemeScene:()=>null,
 })
 let html=renderToStaticMarkup(createElement(AdventBanner))
 assert.match(html,/Зимний адвент/);assert.match(html,/Дверь №3 ждёт тебя/)
 assert.doesNotMatch(html,/>Календарь<|Открой дверь дня|Скоро открытие/)
 state.advent.today_open=true;html=renderToStaticMarkup(createElement(AdventBanner))
 assert.match(html,/Дверь №3 открыта/);assert.doesNotMatch(html,/ждёт тебя/)
 state.advent.today=0;html=renderToStaticMarkup(createElement(AdventBanner));assert.match(html,/Старт 1 ноября/)
 state.advent.today=25;html=renderToStaticMarkup(createElement(AdventBanner));assert.match(html,/Можно догнать пропущенные/)
})

test('home courses combine the offer without hiding paid status or the introduction',async()=>{
 const {MainCourses}=await load('screens/home/AcademyCourses.tsx',{
  useStore:selector=>selector({push(){}}),Tap:button,ogPracticeCourses:[{lessons:[{},{}]},{lessons:[{}]}],
 })
 const html=renderToStaticMarkup(createElement(MainCourses))
 assert.match(html,/2 платных программ · 3 уроков/);assert.match(html,/Первый урок для знакомства/)
 assert.match(html,/Посмотреть программы/);assert.doesNotMatch(html,/Направления курсов|Хочешь освоить/)
})
