import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
const css=readFileSync(new URL('../src/index.css',import.meta.url),'utf8')
const tokens=part=>Object.fromEntries([...part.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6});/gi)].map(([,k,v])=>[k,v]))
const dark=tokens(css.split(':root {')[0]),light={...dark,...tokens(css.split(":root[data-theme='light'] {")[1].split('@layer base')[0])}
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255)
const luminance=c=>c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
for(const [name,t] of Object.entries({dark,light})) {
 test(`${name}: readable normal-sized semantic text on opaque app surfaces`,()=>{
  for(const role of ['ink','mute','faint','violet','success','pink','peach','mint','sky','amber','rose']) for(const bg of ['bg','card','card2','float']) assert.ok(ratio(rgb(t[role]),rgb(t[bg]))>=4.5,`${role} on ${bg}: ${ratio(rgb(t[role]),rgb(t[bg]))}`)
 })
 test(`${name}: filled semantic controls retain readable labels`,()=>{
  for(const role of ['violet','mint','rose','inverse']) assert.ok(ratio(rgb(t[role]),rgb(t[`on-${role}`]))>=4.5,role)
 })
}
test('violet controls never pair theme-aware fills with fixed white labels',()=>{
 for(const file of ['Admin.tsx','Stories.tsx','advent/Door.tsx','home/KnowledgeHub.tsx']) assert.doesNotMatch(readFileSync(new URL(`../src/screens/${file}`,import.meta.url),'utf8'),/bg-violet[^"\n]*text-white/)
})
