import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {transformWithOxc} from 'vite'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

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
 const state={me:{id:1,name:'Ильяс',xp:1234,streak:0,daily_claimed:false},feed:[],setTab(){}}
 let saved=[]
 const {Home}=await load('screens/Home.tsx',{
  useStore:selector=>selector(state),useSavedPosts:()=>saved,useFollowedTopics:()=>[],knowledgeTopics:[],
  Avatar:()=>createElement('span',{'data-avatar':true}),Odometer:({value})=>value,Tap:button,
  Companion:()=>createElement('span',{'data-companion':true}),DailyCard:()=>createElement('span',null,'REWARD_AVAILABLE'),StreakCard:()=>createElement('span',null,'REWARD_CLAIMED'),
  AdventBanner:()=>null,MainCourses:()=>null,Feed:()=>null,StoryBubble:()=>null,openBlogLibrary(){},
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
 state.me.daily_claimed=true;state.me.xp=1244;saved=[3]
 html=renderToStaticMarkup(createElement(Home))
 assert.match(html,/REWARD_CLAIMED/);assert.doesNotMatch(html,/REWARD_AVAILABLE/)
 assert.match(html,/1244/);assert.match(html,/Сохранённые · 1/)
})

test('confirmed daily card contains status and collapsible real streak details, never grants a second reward',async()=>{
 const state={me:{streak:7,best_streak:12,freezes:2}}
 const useStore=selector=>selector(state);useStore.setState=()=>{}
 const {StreakCard}=await load('screens/home/Daily.tsx',{
  useStore,dailyReward:n=>n*10,days:n=>`${n} дней`,Tap:button,
  api:{daily(){throw Error('render cannot claim')}},errorText:String,sfx:{},streakCard(){},haptic:{},Emoji:()=>null,burst(){},flyPoints(){},Pattern:()=>null,GRADIENTS:{},
 })
 const html=renderToStaticMarkup(createElement(StreakCard))
 assert.match(html,/Отметка за сегодня получена/);assert.match(html,/Стрик 7 дней · завтра \+80 XP/)
 assert.match(html,/<details/);assert.doesNotMatch(html,/<details[^>]+open|Забрать бонус дня/)
 assert.match(html,/Рекорд: 12/);assert.match(html,/Две заморозки в запасе/);assert.match(html,/Поделиться стриком/)
})

test('profile retains XP and member card instead of duplicating a new home progress panel',async()=>{
 const source=await readFile(new URL('../src/screens/Profile.tsx',import.meta.url),'utf8')
 assert.match(source,/<HoloCard me={me}/)
 assert.match(source,/me\.xp.*<Counter value={me\.xp}/)
})
