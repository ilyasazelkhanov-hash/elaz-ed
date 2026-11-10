import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'

const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`

test('story hook calls browser frame APIs without an invalid method receiver', async t => {
  const saved = Object.fromEntries(['document','requestAnimationFrame','cancelAnimationFrame','__storyCleanups'].map(key=>[key,globalThis[key]]))
  t.after(()=>{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}})
  globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}}
  let cancelled=0
  globalThis.requestAnimationFrame=function(){assert.equal(this,undefined);return 1}
  globalThis.cancelAnimationFrame=function(){assert.equal(this,undefined,'native Window method must not receive the controller options object');cancelled++}
  const react=moduleUrl('export const useRef=value=>({current:value});export const useState=value=>[value,()=>{}];export const useEffect=effect=>{const cleanup=effect();if(cleanup)globalThis.__storyCleanups.push(cleanup)}')
  for(const path of ['../src/platform/use-story-playback.ts']){
    globalThis.__storyCleanups=[]
    const file=new URL(path,import.meta.url)
    let {code}=await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'ts'})
    code=code.replace(/from (["'])([^"']+)\1/g,(_,quote,name)=>`from ${JSON.stringify(name==='react'?react:new URL(name,file).href)}`)
    const {useStoryPlayback}=await import(moduleUrl(code))
    const controls=useStoryPlayback('slide',6000,()=>{})
    controls.setHolding(true)
    controls.setHolding(false)
    for(const cleanup of globalThis.__storyCleanups)cleanup()
  }
  assert.equal(cancelled,2)
})
