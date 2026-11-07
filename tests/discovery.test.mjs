import test from 'node:test'
import assert from 'node:assert/strict'
import {newestPosts,beginnerPicks,updateSummary} from '../src/lib/discovery.ts'
import {parseSavedPosts,parseFollowedTopics,toggleSavedPost,readSavedPosts,toggleFollowedTopic,readFollowedTopics} from '../src/lib/blog-library.ts'

const now=Date.parse('2026-11-06T10:00:00Z')
const card=(id,date,extra={})=>({id,kind:'lesson',course_id:null,published:true,published_at:date,pinned:false,title:'Заметка',subtitle:'',category:'ИИ',...extra})
test('updates stay chronological despite old promotions and exclude hidden, future and course lessons',()=>{
 const input=[card(1,'2026-01-01',{pinned:true}),card(2,'2026-11-05'),card(3,'2026-11-07'),card(4,'2026-11-06',{published:false}),card(5,'2026-11-06',{course_id:9}),card(6,null),card(7,'2026-11-06',{kind:'story'})]
 assert.deepEqual(newestPosts(input,now).map(p=>p.id),[2,1,6])
 assert.deepEqual(input.map(p=>p.id),[1,2,3,4,5,6,7])
 const summary=updateSummary(input,[1],now)
 assert.equal(summary.unread,2);assert.equal(summary.latest,'2026-11-05')
 assert.deepEqual(updateSummary([],[],now),{posts:[],unread:0,latest:null})
})
test('beginner picks favor usable introductions and never invent extra content',()=>{
 const input=[card(1,'2026-11-06',{title:'Архитектура кластера'}),card(2,'2026-11-04',{title:'Первый запрос: как начать с ИИ'}),card(3,'2026-11-05',{title:'Простая проверка ответа'})]
 assert.equal(beginnerPicks(input,2,now)[0].id,2)
 assert.equal(beginnerPicks(input,0,now).length,0)
 assert.deepEqual(beginnerPicks([],3,now),[])
})
test('saved IDs and topic preferences reject corrupt values and stay bounded',()=>{
 assert.deepEqual(parseSavedPosts('[1,1,-2,"3",null,4.5,2]'),[1,2])
 assert.deepEqual(parseSavedPosts('broken'),[])
 assert.equal(parseSavedPosts(JSON.stringify(Array.from({length:600},(_,i)=>i+1))).length,500)
 assert.deepEqual(parseFollowedTopics('["Текст","Текст","",null,22]'),['Текст'])
})
test('bookmarks and interests stay user scoped and work in memory when browser storage is blocked',()=>{
 const original=globalThis.localStorage
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}})
 try{
  assert.equal(toggleSavedPost(901,42),true)
  assert.deepEqual(readSavedPosts(901),[42]);assert.deepEqual(readSavedPosts(902),[])
  assert.equal(toggleSavedPost(901,42),false);assert.deepEqual(readSavedPosts(901),[])
  assert.equal(toggleFollowedTopic(901,'Текст'),true)
  assert.deepEqual(readFollowedTopics(901),['Текст']);assert.deepEqual(readFollowedTopics(902),[])
  assert.equal(toggleSavedPost(901,-1),false)
 }finally{Object.defineProperty(globalThis,'localStorage',{configurable:true,value:original})}
})
