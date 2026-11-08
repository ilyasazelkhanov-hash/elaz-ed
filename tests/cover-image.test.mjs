import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {transformWithOxc} from 'vite'

let counter=0
async function harness(reduce=false) {
 const file=new URL('../src/CoverImage.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import[^;\n]*from ["']react["'];?/, 'const {useEffect,useRef,useState,useSyncExternalStore}=globalThis.__coverHooks;')
 code=code.replaceAll('from "react/jsx-runtime"',`from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`)
 code=code.replaceAll('from "../supabase/functions/_shared/cover-media"',`from ${JSON.stringify(new URL('../supabase/functions/_shared/cover-media.ts',import.meta.url).href)}`)
 let cursor=0,slots=[],effects=[],draws=0
 const equal=(a,b)=>a?.length===b?.length&&a.every((x,i)=>Object.is(x,b[i]))
 globalThis.__coverHooks={
  useSyncExternalStore:()=>reduce,
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},
  useRef(){const i=cursor++;if(!(i in slots))slots[i]={current:i===3?{getContext:()=>({drawImage(){draws++}})}:{naturalWidth:1920,naturalHeight:960}};return slots[i]},
  useEffect(fn,deps){const i=cursor++;if(!equal(slots[i],deps)){slots[i]=deps;effects.push(fn)}},
 }
 const {CoverImage}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#cover-${counter++}`)
 const render=(props={})=>{cursor=0;const outer=CoverImage({src:'https://example.org/cover.gif',className:'test-cover',...props});const tree=outer.type(outer.props);while(effects.length)effects.shift()();return tree}
 const children=tree=>[tree.props.children].flat(Infinity).filter(x=>x&&typeof x==='object')
 const image=tree=>children(tree).find(x=>x.type==='img')
 const toggle=tree=>children(tree).find(x=>x.type==='button'&&'aria-pressed'in x.props)
 return {render,children,image,toggle,draws:()=>draws,setReduce:value=>{reduce=value},slots}
}
test('GIF autoplay, pause, resume and first-frame capture use actual component hooks',async()=>{
 const h=await harness(),tree=h.render();assert.equal(h.toggle(tree).props['aria-pressed'],true)
 h.image(tree).props.onLoad({currentTarget:{naturalWidth:1920,naturalHeight:960}})
 assert.equal(h.draws(),1);assert.equal(h.slots[3].current.width,1600);assert.equal(h.slots[3].current.height,800)
 h.toggle(tree).props.onClick();let paused=h.render();assert.equal(h.toggle(paused).props['aria-pressed'],false);assert.equal(h.image(paused).props.style.visibility,'hidden')
 assert.equal(h.children(paused).find(x=>x.type==='canvas').props.style.display,'block')
 h.toggle(paused).props.onClick();assert.equal(h.toggle(h.render()).props['aria-pressed'],true)
})
test('reduced-motion starts still, explicit play works, preference changes reset choice',async()=>{
 const h=await harness(true);let tree=h.render();assert.equal(h.toggle(tree).props['aria-pressed'],false);assert.equal(h.image(tree).props.style.visibility,'hidden')
 h.toggle(tree).props.onClick();tree=h.render();assert.equal(h.toggle(tree).props['aria-pressed'],true)
 h.setReduce(false);h.render();h.render();h.setReduce(true);h.render();tree=h.render();assert.equal(h.toggle(tree).props['aria-pressed'],false)
})
test('cover-open and animation controls stay independent and load errors stop retry loops',async()=>{
 const h=await harness();let opened=0;let tree=h.render({onOpen:()=>opened++,openLabel:'Open article'})
 const open=h.children(tree).find(x=>x.type==='button'&&x.props['aria-label']==='Open article');open.props.onClick();assert.equal(opened,1);assert.equal(h.toggle(h.render()).props['aria-pressed'],true)
 h.image(tree).props.onError();tree=h.render();assert.equal(h.image(tree).props.src,undefined);assert.equal(h.toggle(tree),undefined);assert(h.children(tree).some(x=>x.type==='div'&&x.props.children==='Обложка недоступна'))
})
test('static covers preserve URL, lazy loading and clickable navigation',async()=>{
 const h=await harness();let opened=0;const tree=h.render({src:'https://example.org/photo.jpg?sig=one',onOpen:()=>opened++})
 assert.equal(tree.type,'button');assert.equal(tree.props.children.type,'img');assert.equal(tree.props.children.props.src,'https://example.org/photo.jpg?sig=one');assert.equal(tree.props.children.props.loading,'lazy');tree.props.onClick();assert.equal(opened,1)
})
