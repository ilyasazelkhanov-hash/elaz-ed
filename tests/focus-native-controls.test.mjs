import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'

// Real FocusLayer effects/handlers, mocked layout. Browser QA remains separate.
async function harness(run) {
 const file = new URL('../src/FocusLayer.tsx', import.meta.url)
 let code = (await transformWithOxc(await readFile(file, 'utf8'), file.pathname, {lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import \{([^}]+)\} from ["'](?:react|motion\/react)["'];?/g,(_m,names)=>`const {${names}} = globalThis.__nativeFocus;`)
 code=code.replaceAll('from "react/jsx-runtime"',`from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`)
 const handlers=new Map(), previous={document:globalThis.document,HTMLElement:globalThis.HTMLElement};let ref=0
 const doc={activeElement:null,defaultView:{getComputedStyle:el=>({visibility:el.visibility})},addEventListener:(n,f)=>handlers.set(n,f),removeEventListener:n=>handlers.delete(n)}
 class Element {
  constructor(kind,opts={}){Object.assign(this,{kind,tabIndex:0,ownerDocument:doc,visibility:'visible',layout:true},opts)}
  matches(){return !!this.disabled}
  closest(selector){return (/hidden/.test(selector)&&this.hidden)||(/inert/.test(selector)&&this.inert)||(/aria-hidden/.test(selector)&&this.ariaHidden)?this:null}
  getClientRects(){return this.layout?[{}]:[]}
  focus(){doc.activeElement=this}
 }
 const first=new Element('button'),summary=new Element('summary'),audio=new Element('audio[controls]'),last=new Element('button'),items=[first,summary,audio,last]
 const root={querySelectorAll(selector){const kinds=selector.split(',').map(x=>x.trim());return items.filter(el=>kinds.includes(el.kind))},contains:el=>items.includes(el),focus(){doc.activeElement=root}}
 globalThis.document=doc;globalThis.HTMLElement=Element
 globalThis.__nativeFocus={useRef:value=>({current:ref++===0?root:value}),useLayoutEffect:fn=>fn(),useIsPresent:()=>true,motion:{div:'div'},AnimatePresence:'div'}
 try{
  doc.activeElement=first
  const {FocusLayer}=await import(`data:text/javascript;base64,${Buffer.from(code+'\n//'+Math.random()).toString('base64')}`)
  FocusLayer({active:true,label:'Test',children:null})
  const key=(shiftKey=false)=>{let prevented=false;handlers.get('keydown')({key:'Tab',shiftKey,preventDefault(){prevented=true}});return prevented}
  await run({doc,Element,items,root,first,summary,audio,last,key})
 }finally{
  delete globalThis.__nativeFocus
  for(const key of Object.keys(previous))if(previous[key]===undefined)delete globalThis[key];else globalThis[key]=previous[key]
 }
}
test('native disclosures and audio without explicit tabindex remain in focus order',()=>harness(({doc,summary,audio,key})=>{
 for(const element of [summary,audio])for(const shift of [false,true]){element.focus();assert.equal(key(shift),false);assert.equal(doc.activeElement,element)}
}))
test('invisible controls with layout boxes cannot become the trap boundary',()=>harness(({doc,items,Element,first,last,key})=>{
 items.unshift(...[{visibility:'hidden'},{visibility:'collapse'},{ariaHidden:true},{hidden:true},{inert:true},{disabled:true},{layout:false},{tabIndex:-1}].map(opts=>new Element('button',opts)))
 last.focus();assert.equal(key(),true);assert.equal(doc.activeElement,first)
 assert.equal(key(true),true);assert.equal(doc.activeElement,last)
}))
test('disclosure content expands and empty scopes still trap safely',()=>harness(({doc,items,Element,root,summary,key})=>{
 const child=new Element('button',{layout:false});items.splice(2,0,child)
 summary.focus();assert.equal(key(),false)
 child.layout=true;child.focus();assert.equal(key(),false)
 for(const item of items)item.disabled=true
 assert.equal(key(),true);assert.equal(doc.activeElement,root)
}))
test('every sibling passed into the layer AnimatePresence has its own key',async()=>{
 const read=path=>readFile(new URL(path,import.meta.url),'utf8')
 const [layer,app,ui,profile]=await Promise.all(['../src/FocusLayer.tsx','../src/App.tsx','../src/ui.tsx','../src/screens/Profile.tsx'].map(read))
 assert.match(layer,/<AnimatePresence>\{children\}<\/AnimatePresence>/,'the layer still hands children to AnimatePresence')
 // Unkeyed siblings share the implicit empty key and React reports duplicate children.
 assert.match(app,/<OverlayView key="view" overlay=\{o\} \/>/)
 assert.match(app,/&& <RefreshNotice key="refresh" \/>\}\s*<\/FocusLayer>/)
 assert.match(app,/<RewardModal key="reward-view" reward=\{reward\} \/>\{!share && <RefreshNotice key="refresh" \/>\}/)
 for(const source of [ui,profile]){assert.match(source,/<div key="backdrop" className="absolute inset-0 bg-black\/65"/);assert.match(source,/key="panel"/)}
})
