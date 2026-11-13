import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {bindEditorialReveal, bindLearningScene} from '../src/lib/editorial-motion.ts'

function environment({reduce=false, supported=true}={}) {
 const old={window:globalThis.window,document:globalThis.document,IntersectionObserver:globalThis.IntersectionObserver}
 const media=new EventTarget();media.matches=reduce
 const document=new EventTarget();document.visibilityState='visible';document.activeElement=null
 const observers=[]
 class Observer {
  constructor(callback){this.callback=callback;this.targets=new Set();this.disconnected=false;observers.push(this)}
  observe(node){this.targets.add(node)}
  unobserve(node){this.targets.delete(node)}
  disconnect(){this.targets.clear();this.disconnected=true}
  show(node,visible=true){this.callback([{target:node,isIntersecting:visible}])}
 }
 globalThis.document=document;globalThis.window={matchMedia:()=>media,...supported?{IntersectionObserver:Observer}:{}}
 globalThis.IntersectionObserver=Observer
 const node=()=>Object.assign(new EventTarget(),{dataset:{},contains:()=>false})
 return {media,document,observers,node,restore(){Object.assign(globalThis,old)}}
}

test('course cards remain visible by default and reveal only once after intersection',()=>{
 const env=environment(),a=env.node(),b=env.node(),root=env.node()
 root.querySelectorAll=()=>[a,b]
 try {
  const stop=bindEditorialReveal(root),observer=env.observers[0]
  assert.deepEqual(a.dataset,{})
  observer.show(a,false);assert.deepEqual(a.dataset,{})
  observer.show(a);assert.equal(a.dataset.reveal,'enter');assert.equal(observer.targets.has(a),false)
  assert.equal(observer.targets.has(b),true)
  stop();assert.equal(observer.disconnected,true);assert.deepEqual(a.dataset,{})
 } finally {env.restore()}
})

test('keyboard focus skips entrance and changing reduced motion cancels active effects',()=>{
 const env=environment(),a=env.node(),root=env.node();root.querySelectorAll=()=>[a];root.closest=()=>a
 try {
  const stop=bindEditorialReveal(root),observer=env.observers[0]
  observer.show(a);root.dispatchEvent(new Event('focusin'))
  assert.deepEqual(a.dataset,{})
  env.media.matches=true;env.media.dispatchEvent(new Event('change'))
  assert.equal(observer.disconnected,true);assert.equal(env.observers.length,1)
  stop()
 } finally {env.restore()}
})

test('unsupported observers and reduced motion use the static scene, with no hidden content',()=>{
 for (const options of [{reduce:true},{supported:false}]) {
  const env=environment(options),root=env.node();root.querySelectorAll=()=>[]
  try {
   const stopReveal=bindEditorialReveal(root),stopScene=bindLearningScene(root)
   assert.equal(root.dataset.scene,'still')
   assert.equal(root.dataset.reveal,undefined)
   stopReveal();stopScene();assert.deepEqual(root.dataset,{})
  } finally {env.restore()}
 }
})

test('scene starts in view, pauses offscreen/background and cleans up on repeated navigation',()=>{
 const env=environment(),root=env.node()
 try {
  for(let i=0;i<2;i++) {
   const stop=bindLearningScene(root),observer=env.observers.at(-1)
   assert.equal(root.dataset.scene,'still')
   observer.show(root);assert.equal(root.dataset.scene,'play');assert.equal(root.dataset.paused,'false')
   env.document.visibilityState='hidden';env.document.dispatchEvent(new Event('visibilitychange'));assert.equal(root.dataset.paused,'true')
   env.document.visibilityState='visible';env.document.dispatchEvent(new Event('visibilitychange'));assert.equal(root.dataset.paused,'false')
   observer.show(root,false);assert.equal(root.dataset.paused,'true')
   env.media.matches=true;env.media.dispatchEvent(new Event('change'));assert.equal(root.dataset.scene,'still')
   stop();assert.deepEqual(root.dataset,{});assert.equal(observer.disconnected,true)
   env.document.dispatchEvent(new Event('visibilitychange'));assert.deepEqual(root.dataset,{})
   env.media.matches=false
  }
 } finally {env.restore()}
})

test('motion loops inside a bounded scene and exposes pause plus an accessible static description',async()=>{
 const [css,ui,reader]=await Promise.all(['src/screens/home/learning-motion.css','src/screens/home/LearningMotion.tsx','src/screens/home/free-first.css'].map(path=>readFile(new URL('../'+path,import.meta.url),'utf8')))
 assert.doesNotMatch(css,/cursor\s*:\s*none/)
 assert.equal((css.match(/8s [^;]+ infinite/g)||[]).length,3)
 assert.match(css,/data-user-paused='true'/)
 assert.match(ui,/Приостановить анимацию маршрута/);assert.match(ui,/aria-pressed=\{paused\}/)
 assert.match(ui,/setPaused\(value => !value\)/);
assert.match(css,/prefers-reduced-motion:reduce/)
 assert.match(css,/pointer-events:none/);assert.match(css,/pointer:fine/)
 assert.match(ui,/role="img" aria-label="Учебный маршрут/)
 assert.match(reader,/prefers-reduced-motion:reduce/)
})

test('narrow scenes reserve separate cursor and result lanes without shrinking text or pause target',async()=>{
 const css=await readFile(new URL('../src/screens/home/learning-motion.css',import.meta.url),'utf8')
 const narrow=css.slice(css.indexOf('@media(max-width:359px)'),css.indexOf('.editorial-card {'))
 assert.match(narrow,/inset-inline:12px; gap:8px/)
 assert.match(narrow,/padding:2px 3px/)
 assert.match(css,/cursor-finish \{ right:12px; left:auto;/)
 assert.doesNotMatch(narrow,/font-size|learning-scene-toggle/)
 assert.match(css,/learning-scene-toggle[^}]*width:44px; height:44px/)
})


test('assembly module palettes use the same custom property consumed by their borders and parts',async()=>{
 const css=await readFile(new URL('../src/screens/home/learning-motion.css',import.meta.url),'utf8')
 assert.match(css,/learning-scene-module-build \{ --assembly-color:#6ee7cf;/)
 assert.match(css,/learning-scene-module-result \{ --assembly-color:#ffca8a;/)
 assert.doesNotMatch(css,/--assembly---/)
 // Cursor's maximum +12px travel is reserved at the right edge at every viewport.
 assert.match(css,/cursor-finish \{ right:12px; left:auto;/)
 assert.match(css,/24%\{transform:translate\(12px,-17px\)/)
})
