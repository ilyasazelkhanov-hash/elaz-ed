import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {transformWithOxc} from 'vite'
const url=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const fixture={id:1,kind:'story',published:true,course_id:null,category:'Практика',body:'First\n\n---\n\nSecond',gradient:'mint',title:'Story',emoji:'x'}
const harness={effects:[],holding:[],stateIndex:0,slide:0}
globalThis.__storyInteraction=harness
const imports={
 react:url(`export const useMemo=f=>f();export const useCallback=f=>f;export const useEffect=f=>globalThis.__storyInteraction.effects.push(f);export const useRef=value=>({current:value});export const useState=initial=>{const h=globalThis.__storyInteraction;const index=h.stateIndex++;return [index===1?h.slide:typeof initial==='function'?initial():initial,()=>{}]}`),
 'motion/react':url('export const motion={div:"div"};export const AnimatePresence="div";export const useDragControls=()=>({start:event=>globalThis.__storyInteraction.dragStarted=event})'),
 'lucide-react':url('export const ChevronLeft="i",ChevronRight="i",Pause="i",Play="i",X="i"'),
 '../lib/use-story-playback':url('export const useStoryPlayback=()=>({progress:0,paused:false,setPaused(){},setHolding:value=>globalThis.__storyInteraction.holding.push(value),restart(){}})'),
 '../lib/highlights':url('export const activeStories=cards=>cards;export const storySlideDuration=()=>6000'),
 '../lib/api':url('export const api={}'),
 '../lib/game':url('export const GRADIENTS={mint:{css:"green",ink:"black"}};export const slidesOf=body=>body.split("\\n\\n---\\n\\n")'),
 '../lib/sfx':url('export const sfx={}'),
 '../lib/tg':url('export const haptic={}'),
 '../lib/track':url('export const track=()=>{}'),
 '../lib/plain-dashes':new URL('../src/lib/plain-dashes.ts',import.meta.url).href,
 '../Markdown':url('export const Markdown="article"'),
 '../ui':url('export const Emoji="i",Pattern="i",Tap="button"'),
 '../store':url(`const store={feed:[${JSON.stringify(fixture)}],pop(){},markSeen(){}};export const useStore=fn=>fn(store);useStore.getState=()=>store`),
}
const file=new URL('../src/screens/Stories.tsx',import.meta.url)
let {code}=await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx'})
code=code.replace(/from (["'])([^"']+)\1/g,(_,q,name)=>`from ${JSON.stringify(imports[name]??import.meta.resolve(name))}`)
const {Stories}=await import(url(code))
function find(node,predicate){if(!node||typeof node!=='object')return;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const result=find(child,predicate);if(result)return result}}
test('content gesture is isolated from the outer drag-to-close, release/cancel/leave resume',()=>{
 harness.effects=[];harness.holding=[];harness.stateIndex=0
 const tree=Stories({startId:1})
 const content=find(tree,node=>node.props?.className?.includes('overflow-y-auto'))
 assert.equal(tree.props.drag,'y')
 assert.equal(tree.props.dragListener,false)
 harness.dragStarted=null
 assert.equal(content.props.style.touchAction,'pan-y')
 let stopped=0
 content.props.onPointerDown({stopPropagation(){stopped++}})
 assert.equal(stopped,1);assert.deepEqual(harness.holding,[true])
 assert.equal(harness.dragStarted,null)
 const background=find(tree,node=>node.props?.className==='absolute inset-0')
 const event={pointerId:1,currentTarget:{setPointerCapture(){}}}
 background.props.onPointerDown(event)
 assert.equal(harness.dragStarted,event)
 harness.holding.pop()
 for(const key of ['onPointerUp','onPointerCancel','onPointerLeave'])content.props[key]()
 assert.deepEqual(harness.holding,[true,false,false,false])
 assert.equal(content.props.className.includes('pointer-events-auto'),true)
})
test('each story/slide change resets the real scroll container rather than keeping old offset',()=>{
 for(const slide of [0,1]){
  harness.effects=[];harness.stateIndex=0;harness.slide=slide
  const tree=Stories({startId:1}),content=find(tree,node=>node.props?.className?.includes('overflow-y-auto'))
  content.props.ref.current={scrollTop:300}
  for(const effect of harness.effects)effect()
  assert.equal(content.props.ref.current.scrollTop,0)
 }
})
