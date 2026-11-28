import test from 'node:test'
import assert from 'node:assert/strict'
import {grantPairs,grantSummary,GRANT_USER_LIMIT,parseUsernames,retryPairs,runGrants} from '../src/lib/access-grant.ts'
import {starsEstimate,starsEstimateText,STARS_REFERENCE} from '../src/lib/stars-economy.ts'
import {accessTiers,friendUnlock,practiceOffer} from '../src/lib/og-course-access.ts'

const apiError=(code,status=404)=>Object.assign(new Error(code),{code,status})

test('logins are read from handles, bare names and links, without duplicates or guesses',()=>{
 const parsed=parseUsernames(' @ivan_p,\nIVAN_P  https://t.me/Aruzhan_K?start=1 t.me/mark_dev; telegram.me/abcd ')
 assert.deepEqual(parsed.valid,['ivan_p','Aruzhan_K','mark_dev','abcd'])
 assert.deepEqual(parsed.invalid,[]);assert.equal(parsed.overflow,0)
 const wrong=parseUsernames('иван abc 1name name-with-dash @ok_name '+'a'.repeat(33))
 assert.deepEqual(wrong.valid,['ok_name'])
 assert.equal(wrong.invalid.length,5)
 assert.ok(wrong.invalid.every(item=>item.length<=40))
 assert.deepEqual(parseUsernames(''),{valid:[],invalid:[],overflow:0})
 assert.deepEqual(parseUsernames(null),{valid:[],invalid:[],overflow:0})
})

test('one batch is limited and says how many logins did not fit',()=>{
 const many=Array.from({length:GRANT_USER_LIMIT+4},(_,index)=>`user_${String(index).padStart(3,'0')}`).join(' ')
 const parsed=parseUsernames(many)
 assert.equal(parsed.valid.length,GRANT_USER_LIMIT);assert.equal(parsed.overflow,4)
})

test('pairs cover every chosen person and course once, people first',()=>{
 assert.deepEqual(grantPairs(['a_user','b_user'],[2,1,2,0,-1,1.5]),[
  {username:'a_user',courseId:2},{username:'a_user',courseId:1},{username:'b_user',courseId:2},{username:'b_user',courseId:1},
 ])
 assert.deepEqual(grantPairs([],[1]),[]);assert.deepEqual(grantPairs(['a_user'],[]),[])
})

test('a person the server does not know is asked once and their other courses are skipped',async()=>{
 const calls=[]
 const results=await runGrants(grantPairs(['ghost_user','ivan_p'],[1,2]),async(courseId,username)=>{
  calls.push(`${username}:${courseId}`)
  if(username==='ghost_user')throw apiError('user_not_found')
  return 'Иван'
 })
 assert.deepEqual(calls,['ghost_user:1','ivan_p:1','ivan_p:2'])
 assert.deepEqual(results.map(result=>result.status),['user_not_found','skipped','granted','granted'])
 assert.equal(results[2].name,'Иван')
 assert.deepEqual(grantSummary(results),{granted:2,failed:0,missing:['ghost_user'],total:4})
 assert.deepEqual(retryPairs(results),[{username:'ghost_user',courseId:1},{username:'ghost_user',courseId:2}])
})

test('a missing course fails only its own pair',async()=>{
 const results=await runGrants(grantPairs(['ivan_p'],[1,99]),async courseId=>{if(courseId===99)throw apiError('not_found');return 'Иван'})
 assert.deepEqual(results.map(result=>result.status),['granted','course_not_found'])
 assert.equal(grantSummary(results).failed,1)
})

test('lost admin rights stop the batch instead of repeating a request that cannot succeed',async()=>{
 let calls=0
 const seen=[]
 const results=await runGrants(grantPairs(['a_user','b_user'],[1,2]),async()=>{calls++;if(calls===2)throw apiError('forbidden',403);return 'A'},{errorText:()=>'Нет доступа',onResult:(result,done,total)=>seen.push(`${done}/${total}:${result.status}`)})
 assert.equal(calls,2)
 assert.deepEqual(results.map(result=>result.status),['granted','error','stopped','stopped'])
 assert.equal(results[2].message,'Нет доступа')
 assert.deepEqual(seen,['1/4:granted','2/4:error','3/4:stopped','4/4:stopped'])
 assert.equal(retryPairs(results).length,3)
})

test('a lost answer is never reported as an opened course',async()=>{
 const results=await runGrants(grantPairs(['a_user'],[1,2]),async courseId=>{if(courseId===1)throw new TypeError('Failed to fetch');return 'A'},{errorText:()=>'Нет соединения'})
 assert.deepEqual(results.map(result=>[result.status,result.message??'']),[['error','Нет соединения'],['granted','']])
 assert.equal(grantSummary(results).granted,1)
})

test('price estimate is rounded, dated and absent for a course that is not sold',()=>{
 assert.equal(starsEstimate(0),null);assert.equal(starsEstimate(-5),null);assert.equal(starsEstimate(Number.NaN),null)
 assert.equal(starsEstimateText(0),'')
 const estimate=starsEstimate(500)
 assert.equal(estimate.buyerKzt,5890);assert.equal(estimate.payoutUsd,6.5)
 assert.ok(estimate.buyerKztDirect<estimate.buyerKzt,'buying Stars outside the app stores costs the buyer less')
 assert.ok(estimate.payoutKzt<estimate.buyerKztDirect,'the developer never receives more than the buyer paid')
 const text=starsEstimateText(250)
 assert.match(text,new RegExp(`Ориентир на ${STARS_REFERENCE.checked}`))
 assert.doesNotMatch(text,/[—–]/)
})

test('friend unlock exists only where the server enables it and never exceeds its target',()=>{
 const course={access:false,invite_unlock:3}
 assert.equal(friendUnlock(null,5),null)
 assert.equal(friendUnlock({access:false,invite_unlock:0},5),null)
 assert.equal(friendUnlock({access:true,invite_unlock:3},1),null)
 assert.deepEqual(friendUnlock(course,0),{need:3,have:0,left:3,ready:false})
 assert.deepEqual(friendUnlock(course,2),{need:3,have:2,left:1,ready:false})
 assert.deepEqual(friendUnlock(course,9),{need:3,have:3,left:0,ready:true})
 assert.deepEqual(friendUnlock(course,-4),{need:3,have:0,left:3,ready:false})
 assert.deepEqual(friendUnlock(course,undefined),{need:3,have:0,left:3,ready:false})
})

test('offer label names the friend option next to the price',()=>{
 const base={id:1,title:'Основы',price_stars:250,invite_unlock:0,access:false,request:null}
 assert.equal(practiceOffer(base).label,'250 ⭐')
 assert.equal(practiceOffer({...base,invite_unlock:3}).label,'250 ⭐ или 3 друга')
 assert.equal(practiceOffer({...base,invite_unlock:1}).label,'250 ⭐ или 1 друг')
 assert.equal(practiceOffer({...base,invite_unlock:5}).label,'250 ⭐ или 5 друзей')
 assert.equal(practiceOffer({...base,price_stars:0,invite_unlock:3}).label,'Заявка или 3 друга')
 assert.equal(practiceOffer({...base,invite_unlock:3,access:true}).label,'Доступ открыт')
 assert.equal(practiceOffer({...base,invite_unlock:3}).action,'Открыть курс за 250 ⭐')
})

test('access tiers are counted from server data, not promised',()=>{
 const lesson=(key,free)=>({key,id:1,title:key,minutes:5,free_preview:free,completed:false})
 const courses=[
  {id:1,title:'Основы',price_stars:250,invite_unlock:3,access:false,practice_lessons:[lesson('a',true),lesson('b',false)]},
  {id:2,title:'Тексты',price_stars:400,invite_unlock:0,access:false,practice_lessons:[lesson('c',true)]},
  {id:3,title:'Открытый',price_stars:594,invite_unlock:2,access:true,practice_lessons:[lesson('d',false)]},
 ]
 assert.deepEqual(accessTiers(courses,1),{previews:2,friends:[{title:'Основы',need:3,left:2}],stars:{from:250,to:400,count:2},opened:1})
 assert.deepEqual(accessTiers([],0),{previews:0,friends:[],stars:null,opened:0})
 assert.equal(accessTiers([{...courses[2]}],0).stars,null)
})

// The learner-facing blocks are rendered from the real components with their imports replaced.
import {readFile} from 'node:fs/promises'
import {transformWithOxc} from 'vite'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {plural} from '../src/lib/game.ts'
let nonce=0
async function friendBlocks(state,calls=[]){
 const url=new URL('../src/screens/home/FriendUnlock.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(url,'utf8'),url.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import \{([^}]+)\} from ["'](\.\.?\/[^"']+)["'];?/g,(_,names)=>`const {${names}}=globalThis.__friendUX;`)
 for(const name of ['react','react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 // The card is also called as a plain function to reach its handlers, so its one state hook is a constant here.
 code=code.replace(/useState\(/g,'globalThis.__friendState(');globalThis.__friendState=value=>[value,()=>{}]
 const useStore=selector=>selector(state);useStore.getState=()=>state
 globalThis.__friendUX={useStore,plural,accessTiers,friendUnlock,WARMUP_ID:'warmup',Tap:({children,feedback,...props})=>createElement('button',props,children),
  freeStartLink:target=>state.link?`https://t.me/bot?startapp=g_${target}_r7`:null,appLink:()=>null,shareLink:(link,text)=>calls.push({link,text})}
 return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${++nonce}`)
}
const find=(node,test)=>{
 if(!node||typeof node!=='object')return null
 if(Array.isArray(node)){for(const child of node){const hit=find(child,test);if(hit)return hit}return null}
 if(test(node))return node
 return find(node.props?.children,test)
}

test('friend card shows the server counter, invites to the free warm-up and discloses the incentive',async()=>{
 const calls=[],toasts=[]
 const state={me:{invited:1},link:true,courses:[],toast:text=>toasts.push(text),boot:async()=>'ok'}
 const {FriendUnlockCard}=await friendBlocks(state,calls)
 const course={id:1,title:'Основы',price_stars:250,invite_unlock:3,access:false}
 const html=renderToStaticMarkup(createElement(FriendUnlockCard,{course}))
 assert.match(html,/Или открой бесплатно с друзьями/)
 assert.match(html,/придут 3 друга/);assert.match(html,/Засчитывается новый человек/)
 assert.match(html,/<progress[^>]*aria-label="Друзья по твоей ссылке"[^>]*max="3"[^>]*value="1"/)
 assert.match(html,/1 из 3/);assert.match(html,/Позвать друга · осталось 2/)
 assert.doesNotMatch(html,/репост|лайк/i)
 const tree=FriendUnlockCard({course})
 find(tree,node=>typeof node.props?.onClick==='function').props.onClick()
 assert.equal(calls.length,1)
 assert.equal(calls[0].link,'https://t.me/bot?startapp=g_warmup_r7')
 assert.match(calls[0].text,/бесплатной разминки/);assert.match(calls[0].text,/у меня откроется курс «Основы»/)
 assert.doesNotMatch(calls[0].text,/[—–]/)
 state.link=false
 find(FriendUnlockCard({course}),node=>typeof node.props?.onClick==='function').props.onClick()
 assert.equal(calls.length,1,'without a configured bot nothing is shared');assert.match(toasts[0],/когда бот будет настроен/)
})

test('friend card is absent without the option and turns into an access check once friends came',async()=>{
 const state={me:{invited:4},link:true,courses:[],toast(){},boot:async()=>'ok'}
 const {FriendUnlockCard}=await friendBlocks(state)
 assert.equal(renderToStaticMarkup(createElement(FriendUnlockCard,{course:{id:1,title:'A',price_stars:250,invite_unlock:0,access:false}})),'')
 assert.equal(renderToStaticMarkup(createElement(FriendUnlockCard,{course:{id:1,title:'A',price_stars:250,invite_unlock:3,access:true}})),'')
 const ready=renderToStaticMarkup(createElement(FriendUnlockCard,{course:{id:1,title:'A',price_stars:0,invite_unlock:3,access:false}}))
 assert.match(ready,/data-friend-unlock="ready"/);assert.match(ready,/3 из 3/);assert.match(ready,/Друзья пришли\. Открыть курс/)
 assert.match(ready,/>Открой бесплатно с друзьями</);assert.doesNotMatch(ready,/Позвать друга/)
})

test('catalog note lists three tiers only as far as the server data supports them',async()=>{
 const state={me:{invited:1},link:true,courses:[],toast(){},boot:async()=>'ok'}
 const {AccessTiersNote}=await friendBlocks(state)
 const lesson=free=>({key:'k',id:1,title:'t',minutes:5,free_preview:free,completed:false})
 const full=renderToStaticMarkup(createElement(AccessTiersNote,{courses:[
  {id:1,title:'Основы',price_stars:250,invite_unlock:3,access:false,practice_lessons:[lesson(true)]},
  {id:2,title:'Игры',price_stars:594,invite_unlock:0,access:false,practice_lessons:[lesson(false)]},
 ]}))
 assert.match(full,/Что бесплатно, а что нет/)
 assert.match(full,/Бесплатно<\/dt>/);assert.match(full,/В курсах открыто пробных уроков: 1/)
 assert.match(full,/За друзей<\/dt>/);assert.match(full,/«Основы»: 3 друга по твоей ссылке, осталось 2/);assert.match(full,/Друзей считает сервер/)
 assert.match(full,/За звёзды Telegram<\/dt>/);assert.match(full,/от 250 до 594 ⭐/)
 const plain=renderToStaticMarkup(createElement(AccessTiersNote,{courses:[{id:2,title:'Игры',price_stars:250,invite_unlock:0,access:false}]}))
 assert.doesNotMatch(plain,/За друзей/);assert.match(plain,/Курсы покупаются по одному: 250 ⭐/);assert.doesNotMatch(plain,/пробных уроков/)
 const owned=renderToStaticMarkup(createElement(AccessTiersNote,{courses:[{id:2,title:'Игры',price_stars:250,invite_unlock:3,access:true}]}))
 assert.doesNotMatch(owned,/За друзей|За звёзды/);assert.match(owned,/Бесплатно/)
 for(const html of [full,plain,owned])assert.doesNotMatch(html,/[—–]/)
})
