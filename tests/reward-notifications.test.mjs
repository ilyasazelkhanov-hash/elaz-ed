import test from 'node:test'
import assert from 'node:assert/strict'
import {rewardNotifications} from '../supabase/functions/_shared/rewardNotifications.ts'
test('large premium rewards fit Telegram messages and point to the full gift',()=>{
 const gifts=Array.from({length:12},(_,i)=>({kind:'message',title:`Набор ${i}`,emoji:'🎁',content:{text:'<Набор & шаблоны> '.repeat(900)}}))
 const messages=rewardNotifications(gifts)
 assert(messages.length>1)
 assert(messages.every(x=>x.length<=4000))
 assert(messages.every(x=>x.includes('календаре')))
 assert(messages.join('').includes('&lt;'))
 for(let i=0;i<12;i++)assert(messages.join('').includes(`Набор ${i}`))
})
