import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {transformWithOxc} from 'vite'

let counter=0
async function harness(reduce=false, autoplay=true) {
 const file=new URL('../src/CoverImage.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import[^;\n]*from ["']react["'];?/, 'const {useEffect,useRef,useState,useSyncExternalStore}=globalThis.__coverHooks;')
 code=code.replaceAll('from "react/jsx-runtime"',`from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`)
 code=code.replaceAll('from "../supabase/functions/_shared/cover-media"',`from ${JSON.stringify(new URL('../supabase/functions/_shared/cover-media.ts',import.meta.url).href)}`)
 code=code.replace(/import[^;\n]*from ["']\.\/lib\/gif-preference["'];?/, 'const useGifAutoplay=()=>globalThis.__coverAutoplay();')
 globalThis.__coverAutoplay=()=>autoplay
 let cursor=0,slots=[],effects=[],draws=0
 const equal=(a,b)=>a?.length===b?.length&&a.every((x,i)=>Object.is(x,b[i]))
 globalThis.__coverHooks={
  useSyncExternalStore:()=>reduce,
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},
  useRef(){const i=cursor++;if(!(i in slots))slots[i]={current:i===2?{getContext:()=>({drawImage(){draws++}})}:{naturalWidth:1920,naturalHeight:960}};return slots[i]},
  useEffect(fn,deps){const i=cursor++;if(!equal(slots[i],deps)){slots[i]=deps;effects.push(fn)}},
 }
 const {CoverImage}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#cover-${counter++}`)
 const render=(props={})=>{cursor=0;const outer=CoverImage({src:'https://example.org/cover.gif',className:'test-cover',...props});const tree=outer.type(outer.props);while(effects.length)effects.shift()();return tree}
 const children=tree=>[tree.props.children].flat(Infinity).filter(x=>x&&typeof x==='object')
 const image=tree=>children(tree).find(x=>x.type==='img')
 const toggle=tree=>children(tree).find(x=>x.type==='button'&&'aria-pressed'in x.props)
 return {render,children,image,toggle,draws:()=>draws,setReduce:value=>{reduce=value},setAutoplay:value=>{autoplay=value},slots}
}
test('GIF autoplay preserves first-frame capture without overlay pause controls',async()=>{
 const h=await harness(),tree=h.render();assert.equal(h.toggle(tree),undefined)
 assert.equal(h.image(tree).props.style,undefined)
 h.image(tree).props.onLoad({currentTarget:{naturalWidth:1920,naturalHeight:960}})
 assert.equal(h.draws(),1);assert.equal(h.slots[2].current.width,1600);assert.equal(h.slots[2].current.height,800)
 h.setAutoplay(false);h.render();const paused=h.render()
 assert.equal(h.image(paused).props.style.visibility,'hidden')
 assert.equal(h.children(paused).find(x=>x.type==='canvas').props.style.display,'block')
 h.setAutoplay(true);assert.equal(h.image(h.render()).props.style,undefined)
})
test('reduced-motion always wins over global autoplay and reacts live',async()=>{
 const h=await harness(true);let tree=h.render();assert.equal(h.toggle(tree),undefined);assert.equal(h.image(tree).props.style.visibility,'hidden')
 h.setReduce(false);tree=h.render();assert.equal(h.image(tree).props.style,undefined)
 h.setReduce(true);tree=h.render();assert.equal(h.image(tree).props.style.visibility,'hidden')
})
test('cover-open remains the only button and load errors stop retry loops',async()=>{
 const h=await harness();let opened=0;let tree=h.render({onOpen:()=>opened++,openLabel:'Open article'})
 const buttons=h.children(tree).filter(x=>x.type==='button');assert.equal(buttons.length,1)
 buttons[0].props.onClick();assert.equal(opened,1)
 h.image(tree).props.onError();tree=h.render();assert.equal(h.image(tree).props.src,undefined);assert.equal(h.toggle(tree),undefined);assert(h.children(tree).some(x=>x.type==='div'&&x.props.children==='Обложка недоступна'))
})
test('static covers preserve URL, lazy loading and clickable navigation',async()=>{
 const h=await harness();let opened=0;const tree=h.render({src:'https://example.org/photo.jpg?sig=one',onOpen:()=>opened++})
 assert.equal(tree.type,'button');assert.equal(tree.props.children.type,'img');assert.equal(tree.props.children.props.src,'https://example.org/photo.jpg?sig=one');assert.equal(tree.props.children.props.loading,'lazy');tree.props.onClick();assert.equal(opened,1)
})

test('global GIF preference notifies all covers, persists locally and cleans up subscriptions',async()=>{
 const original=globalThis.window;const handlers=new Map(),values=new Map()
 globalThis.window={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:(name,fn)=>{if(handlers.get(name)===fn)handlers.delete(name)}}
 try {
  const store=await import('../src/lib/gif-preference.ts');let a=0,b=0
  const offA=store.subscribeGifAutoplay(()=>a++),offB=store.subscribeGifAutoplay(()=>b++)
  assert.equal(store.gifAutoplayEnabled(),true)
  store.setGifAutoplayEnabled(false);assert.equal(store.gifAutoplayEnabled(),false);assert.equal(a,1);assert.equal(b,1)
  assert.equal(values.get('og:gif-autoplay:v1'),'off')
  values.set('og:gif-autoplay:v1','on');handlers.get('storage')({key:'og:gif-autoplay:v1'})
  assert.equal(store.gifAutoplayEnabled(),true);assert.equal(a,2)
  window.localStorage.setItem=()=>{throw Error('blocked')}
  store.setGifAutoplayEnabled(false);assert.equal(store.gifAutoplayEnabled(),false)
  offA();assert(handlers.has('storage'));offB();assert(!handlers.has('storage'))
 } finally {globalThis.window=original}
})

test('single profile GIF control has a label, explanation and working change handler',async()=>{
 const file=new URL('../src/screens/profile/GifPreference.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import[^;\n]*from ["']..\/..\/lib\/gif-preference["'];?/,'const useGifAutoplay=()=>true;const setGifAutoplayEnabled=value=>globalThis.__settingValue=value;')
 code=code.replace(/import[^;\n]*from ["']..\/..\/lib\/visibility["'];?/,'const usePrefersReducedMotion=()=>false;')
 code=code.replaceAll('from "react/jsx-runtime"',`from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`)
 const {GifPreference}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#preference`)
 const tree=GifPreference(),label=tree.props.children[0],input=label.props.children[1]
 assert.equal(label.type,'label');assert.equal(label.props.children[0],'GIF-анимация');assert.equal(input.props.checked,true)
 assert.equal(input.props['aria-describedby'],tree.props.children[1].props.id)
 input.props.onChange({currentTarget:{checked:false}});assert.equal(globalThis.__settingValue,false)
 delete globalThis.__settingValue
})
