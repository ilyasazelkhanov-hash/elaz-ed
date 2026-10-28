import test from 'node:test'
import assert from 'node:assert/strict'
import { GOALS, projectProgress, routeLessons } from '../src/lib/journey.ts'

test('route excludes blog posts, unpublished content, stories and locked course lessons', () => {
  const base = {kind:'lesson',published:true,title:'Telegram приложение',subtitle:'',category:'',position:0,completed:false,course_id:null,free_preview:false}
  const feed = [
    {...base,id:1}, {...base,id:2,course_id:4}, {...base,id:3,course_id:4,free_preview:true},
    {...base,id:4,published:false}, {...base,id:5,kind:'story'},
  ]
  assert.deepEqual(routeLessons(feed, [], 'goal:apps').map((l)=>l.id), [3])
  assert.deepEqual(routeLessons(feed, [{id:4,access:true}], 'goal:apps').map((l)=>l.id), [2,3])
})
test('completion keeps a stable route and no matches fall back to available lessons', () => {
  const feed = Array.from({length:7},(_,i)=>({id:i+1,kind:'lesson',published:true,title:'Общий материал',subtitle:'',category:'',position:i,completed:i%2===0,course_id:4,free_preview:true}))
  for(const goal of GOALS) assert.deepEqual(routeLessons(feed, [],goal.id).map((l)=>l.id),[1,2,3,4])
})
test('unified progress is a read model and repeated projections do not compound', () => {
  const me = {id:1,xp:150, name:'Автор'}
  const projected = projectProgress(me,70)
  assert.equal(projected.xp,220)
  assert.deepEqual(projectProgress(projected,70),projected)
  assert.equal(projectProgress(projected,90).xp,240)
  assert.equal(projectProgress(me,-10).xp,150)
  assert.equal(projectProgress(me,Infinity).xp,150)
  assert.equal(me.xp,150)
})
