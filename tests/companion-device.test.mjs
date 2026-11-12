import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { companionDeviceKey, parseCompanionDevice, readCompanionDevice, saveCompanionDevice, subscribeCompanionDevice, companionMotionStatus, setCompanionMotionStatus, registerCompanionMotion, requestCompanionMotion, stopCompanionMotion, createCompanionSpeaker, companionVoiceAvailable } from '../src/lib/companion-device.ts'

test('device preferences default to no sound/no lamp and are scoped per account',()=>{
 assert.deepEqual(parseCompanionDevice(null),{voice:false,lantern:false})
 assert.deepEqual(parseCompanionDevice('{bad'),{voice:false,lantern:false})
 assert.deepEqual(parseCompanionDevice('{"voice":"true","lantern":1,"permission":"granted"}'),{voice:false,lantern:false})
 const data=new Map();globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}
 try {
  assert.equal(saveCompanionDevice(880,{voice:true,lantern:true}),true)
  assert.deepEqual(readCompanionDevice(880),{voice:true,lantern:true});assert.deepEqual(readCompanionDevice(881),{voice:false,lantern:false})
  assert.deepEqual([...data.keys()],[companionDeviceKey(880)])
  assert.doesNotMatch(data.values().next().value,/permission|reading|acceleration/)
 }finally{delete globalThis.localStorage}
})
test('storage rejection retains session choice and reports persistence failure',()=>{
 assert.equal(saveCompanionDevice(882,{voice:false,lantern:true}),false)
 assert.deepEqual(readCompanionDevice(882),{voice:false,lantern:true})
 assert.deepEqual(readCompanionDevice(883),{voice:false,lantern:false})
})
test('motion controls invoke synchronously only on request, states are session-only and deduplicated',()=>{
 let starts=0,stops=0,changes=0
 const off=subscribeCompanionDevice(()=>changes++)
 const unregister=registerCompanionMotion(884,{start:()=>starts++,stop:()=>stops++})
 assert.equal(starts,0);assert.equal(requestCompanionMotion(884),true);assert.equal(starts,1)
 assert.equal(requestCompanionMotion(885),false);stopCompanionMotion(884);assert.equal(stops,1)
 setCompanionMotionStatus(884,'active');setCompanionMotionStatus(884,'active');assert.equal(changes,1)
 unregister();assert.equal(companionMotionStatus(884),'off');assert.equal(requestCompanionMotion(884),false);off()
})
function voiceHost(){
 const queue=[],host={SpeechSynthesisUtterance:class {constructor(text){this.text=text}},speechSynthesis:{speak:utterance=>queue.push(utterance),cancel(){host.cancelled++},getVoices:()=>[{lang:'ru-RU',localService:false,name:'network'},{lang:'ru-RU',localService:true,name:'local'}]},cancelled:0}
 return {host,queue}
}
test('voice does not auto-play, prefers a local voice and stale callbacks cannot revive cancelled speech',()=>{
 const {host,queue}=voiceHost(),states=[],speaker=createCompanionSpeaker(s=>states.push(s),host)
 assert.equal(queue.length,0);assert.equal(companionVoiceAvailable(host),true)
 speaker.speak('  Привет.  Только по кнопке. ');assert.equal(queue.length,1)
 const first=queue[0];assert.equal(first.text,'Привет. Только по кнопке.');assert.equal(first.voice.name,'local')
 first.onstart();assert.equal(states.at(-1),'speaking');speaker.stop();assert.equal(host.cancelled,1)
 first.onend();first.onstart();assert.equal(states.at(-1),'idle')
 speaker.speak('Следующая');queue[1].onend();speaker.stop();assert.equal(host.cancelled,1)
})
test('voice unsupported/throwing paths preserve text and never leave a startup timeout',()=>{
 const states=[],speaker=createCompanionSpeaker(s=>states.push(s),{})
 speaker.speak('Текст');assert.equal(states.at(-1),'unavailable');speaker.stop()
 const {host}=voiceHost();host.speechSynthesis.speak=()=>{throw new Error('blocked')}
 const throwing=createCompanionSpeaker(s=>states.push(s),{...host,SpeechSynthesisUtterance:class{constructor(){throw Error('blocked')}}});throwing.speak('Текст');assert.equal(states.at(-1),'error');throwing.stop()
 const blocked=createCompanionSpeaker(s=>states.push(s),host);blocked.speak('Текст');assert.equal(states.at(-1),'error');blocked.stop()
})
test('speech handles synchronous completion without manufacturing a later error',()=>{
 const {host}=voiceHost(),states=[];host.speechSynthesis.speak=utterance=>{utterance.onstart();utterance.onend()}
 const speaker=createCompanionSpeaker(s=>states.push(s),host);speaker.speak('Привет');assert.equal(states.at(-1),'idle');speaker.stop();assert.equal(host.cancelled,0)
})
test('interaction owner gates and cleans up sensors and sound; no physical torch, microphone or brightness claims',async()=>{
 const hook=await readFile(new URL('../src/screens/home/dots/useInteractions.ts',import.meta.url),'utf8')
 const ui=await readFile(new URL('../src/screens/home/Companion.tsx',import.meta.url),'utf8')
 const device=await readFile(new URL('../src/lib/companion-device.ts',import.meta.url),'utf8')
 assert.match(hook,/new AbortController/);assert.match(hook,/own\.signal\.aborted/);assert.match(hook,/!latest.current.active \|\| !latest.current.motion/)
 assert.match(hook,/abort.current\?\.abort/);assert.match(hook,/ownSpeaker.stop\(\)/);assert.match(hook,/!active \|\| !preferences.voice/)
 assert.match(ui,/requestCompanionMotion\(userId\)\) closeSettings/)
 assert.match(ui,/Яркость экрана не считывается/);assert.match(ui,/беззвучный режим телефона определить нельзя/)
 assert.doesNotMatch(hook+ui+device,/getUserMedia|AmbientLightSensor|mozBrightness|applyConstraints|deviceVolume|fetch\(/)
})

test('device disclosure stays in the real focus trap for closed/open keyboard navigation',async()=>{
 const {transformWithOxc}=await import('vite')
 const file=new URL('../src/FocusLayer.tsx',import.meta.url),source=await readFile(file,'utf8')
 const companion=await readFile(new URL('../src/screens/home/Companion.tsx',import.meta.url),'utf8')
 assert.match(companion,/<summary tabIndex=\{0\}>Движение/)
 let code=(await transformWithOxc(source,file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import \{([^}]+)\} from ["'](?:react|motion\/react)["'];?/g,(_m,names)=>`const {${names}} = globalThis.__focusHarness;`)
 code=code.replaceAll('from "react/jsx-runtime"',`from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`)
 const handlers=new Map(),cleanups=[];let ref=0,open=false
 class Element {constructor(name,inside=true){this.name=name;this.tabIndex=0;this.inside=inside}closest(){return null}matches(){return false}getClientRects(){return this.inside&&!open?[]:[{}]}focus(){globalThis.document.activeElement=this}}
 const first=new Element('close',false),summary=new Element('summary',false),sensor=new Element('sensor',true),save=new Element('save',false),items=[first,summary,sensor,save]
 const root={querySelectorAll(selector){assert.match(selector,/\[tabindex\]/);return items},contains:element=>items.includes(element),focus(){}}
 globalThis.HTMLElement=Element;globalThis.document={activeElement:summary,addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)}
 globalThis.__focusHarness={useRef:value=>({current:ref++===0?root:value}),useLayoutEffect:fn=>{const cleanup=fn();if(cleanup)cleanups.push(cleanup)},useIsPresent:()=>true,motion:{div:'div'},AnimatePresence:'div'}
 try {
  const {FocusLayer}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);FocusLayer({active:true,label:'Dots',children:null})
  for(const expanded of [false,true]){
   open=expanded;document.activeElement=summary;let prevented=false
   handlers.get('keydown')({key:'Tab',shiftKey:false,preventDefault(){prevented=true}});assert.equal(prevented,false,'native Tab from summary proceeds, never jumps to first control')
   document.activeElement=save;handlers.get('keydown')({key:'Tab',shiftKey:false,preventDefault(){prevented=true}});assert.equal(document.activeElement,first)
  }
 }finally{delete globalThis.__focusHarness;delete globalThis.document;delete globalThis.HTMLElement}
})
