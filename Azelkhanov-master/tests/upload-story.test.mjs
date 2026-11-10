import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateUpload, uploadResponseError } from '../src/platform/upload-validation.ts'
import { createStoryPlayback } from '../src/platform/story-playback.ts'

test('uploads check extension, MIME, size and empty content before network', () => {
  const file = { name: 'work.PDF', type: 'application/pdf', size: 5 * 1024 * 1024 }
  assert.equal(validateUpload(file, 5).error, undefined)
  assert.equal(validateUpload({ ...file, type: '' }, 5).contentType, 'application/pdf')
  for (const change of [{name:'work.constructor',type:''},{name:'__proto__',type:''},{name:'pdf',type:''},{name:'work.exe'}, {type:'text/html'}, {size:file.size + 1}, {size:0}, {name:'x'.repeat(201)+'.pdf'}]) assert.ok(validateUpload({...file,...change},5).error)
  for (const [ext, type] of [['jpg','image/jpeg'],['jpeg','image/jpeg'],['png','image/png'],['webp','image/webp'],['txt','text/plain']]) assert.equal(validateUpload({name:`work.${ext}`,type,size:100},5).error,undefined)
  for (const status of [400,401,403,413,415,500]) assert.ok(uploadResponseError(status).length > 25)
})
function setup(hidden=false) {
  let time=0, id=0, completed=0, progress=0
  const frames=new Map(), listeners=new Set()
  const visibility={hidden,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)}
  const timer=createStoryPlayback({duration:1000,visibility,now:()=>time,request:fn=>{frames.set(++id,fn);return id},cancel:id=>frames.delete(id),onProgress:p=>progress=p,onComplete:()=>completed++})
  return {timer,frames,listeners,get completed(){return completed},get progress(){return progress},advance(ms){time+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn())},hide(value){visibility.hidden=value;listeners.forEach(fn=>fn())}}
}
test('hidden time does not advance or complete and scheduling resumes with remaining time',()=>{
 const s=setup();s.advance(400);s.hide(true);assert.equal(s.frames.size,0);s.advance(10000);assert.equal(s.completed,0);s.hide(false);s.advance(599);assert.equal(s.completed,0);s.advance(1);assert.equal(s.completed,1);assert.equal(s.progress,1);assert.equal(s.frames.size,0)
})
test('explicit pause survives visibility and touch changes; cleanup cancels frames and listeners',()=>{
 const s=setup();s.advance(200);s.timer.setPaused(true);s.hide(true);s.hide(false);s.timer.setHolding(true);s.timer.setHolding(false);s.advance(10000);assert.equal(s.completed,0);assert.equal(s.frames.size,0);s.timer.setPaused(false);s.advance(799);assert.equal(s.completed,0);s.timer.dispose();assert.equal(s.frames.size,0);assert.equal(s.listeners.size,0);s.advance(5000);assert.equal(s.completed,0)
})
test('initially hidden stories do not schedule; restart resets progress',()=>{
 const s=setup(true);assert.equal(s.frames.size,0);s.advance(5000);s.hide(false);s.advance(500);assert.equal(s.progress,.5);s.timer.restart();assert.equal(s.progress,0);s.advance(999);assert.equal(s.completed,0);s.advance(1);assert.equal(s.completed,1)
})
test('story exposes a keyboard pause/resume button',()=>{
 const source=readFileSync(new URL('../src/screens/Games.tsx',import.meta.url),'utf8'); assert.match(source,/aria-pressed=\{paused\}/);assert.match(source,/Продолжить историю/);assert.match(source,/useStoryPlayback/)
})
