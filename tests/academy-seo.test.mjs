import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildAcademyPages, prerenderAcademy } from '../scripts/academy-prerender.mjs'

const shell='<!doctype html><html lang="ru"><head><title>OG</title><script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div></body></html>'
const node=(code,kind,parent_code=null,data={},title=code,state='outline')=>({code,kind,parent_code,data,title,state,position:1})
const catalog={entities:[node('D','direction',null,{description:'Public direction'}),node('C','course','D',{outcome:'Public outcome',level:'Core',hours:10,content_blocks:[{body:'PRIVATE COURSE BODY'}],private_notes:'PRIVATE NOTE'}),node('M','module','C',{body:'PRIVATE MODULE BODY'}),node('L','lesson','M',{content_blocks:[{body:'PRIVATE LESSON BODY'}],questions:[{answer:'PRIVATE ANSWER'}]}),node('Q','assessment','L',{},'PRIVATE QUIZ'),node('X','course','D',{},'PRIVATE DRAFT','draft')]}
test('public curriculum prerender is crawlable metadata and honest outline without private bodies',()=>{
 const pages=buildAcademyPages(catalog,shell,{siteUrl:'https://academy.example'})
 assert.deepEqual([...pages.keys()],['/academy','/academy/directions/D','/academy/courses/C'])
 const html=pages.get('/academy/courses/C')
 assert.match(html,/<h1>C<\/h1>/);assert.match(html,/Программа формируется/);assert.match(html,/Public outcome/);assert.match(html,/<li>L — Программа формируется/)
 assert.match(html,/<title>C · AI Academy<\/title>/);assert.match(html,/<meta name="description" content="Public outcome">/);assert.match(html,/href="https:\/\/academy.example\/academy\/courses\/C"/)
 for(const content of pages.values()){assert.doesNotMatch(content,/PRIVATE/);assert.doesNotMatch(content,/<script[^>]*type="module"/);assert.match(content,/href="\/assets\/app.css"/)}
 assert.match(html,/href="\/#\/academy\/courses\/C"/)
 assert.match(pages.get('/academy'),/href="\/academy\/directions\/D"/);assert.match(pages.get('/academy/directions/D'),/href="\/academy\/courses\/C"/)
})
test('prerender escapes title, text and metadata, validates paths and never trusts nested values',()=>{
 const malicious={entities:[node('C','course',null,{outcome:'"><script>alert(1)</script>',level:{private:'PRIVATE OBJECT'},prerequisites:'<img src=x onerror=alert(2)>'},'<svg onload=alert(3)>')]}
 const html=buildAcademyPages(malicious,shell).get('/academy/courses/C')
 assert.doesNotMatch(html,/<svg|<img|<script>alert|PRIVATE OBJECT/)
 assert.match(html,/&lt;svg onload=alert\(3\)&gt;/);assert.match(html,/&quot;&gt;&lt;script&gt;/)
 assert.throws(()=>buildAcademyPages({entities:[node('../escape','course')]},shell),/Unsafe/)
 assert.throws(()=>buildAcademyPages(catalog,'<html></html>'),/missing an empty root/)
 assert.throws(()=>buildAcademyPages(catalog,shell,{siteUrl:'javascript:alert(1)'}))
})
test('prerender writes static route files after Vite and leaves shell and dynamic routes intact',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'academy-seo-'));t.after(()=>rm(directory,{recursive:true,force:true}))
 const catalogPath=path.join(directory,'catalog.json');await writeFile(catalogPath,JSON.stringify(catalog));await writeFile(path.join(directory,'index.html'),shell)
 assert.equal(await prerenderAcademy({distDir:directory,catalogPath,siteUrl:'https://academy.example'}),3)
 assert.match(await readFile(path.join(directory,'academy','courses','C','index.html'),'utf8'),/<h1>C<\/h1>/)
 assert.equal(await readFile(path.join(directory,'index.html'),'utf8'),shell)
 await assert.rejects(readFile(path.join(directory,'academy','verify','index.html')),/ENOENT/)
 await assert.rejects(readFile(path.join(directory,'academy','portfolio','index.html')),/ENOENT/)
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'))
 const rules=config.rewrites
 assert.deepEqual(rules.at(-1),{source:'/((?!assets/).*)',destination:'/index.html'})
 assert.equal(rules.find(rule=>rule.source==='/academy').destination,'/academy/index.html')
 const actual=JSON.parse(await readFile(new URL('../content/ai-academy/catalog.normalized.json',import.meta.url),'utf8'))
 for(const entity of actual.entities.filter(entity=>['course','direction'].includes(entity.kind))){const area=entity.kind==='course'?'courses':'directions';const rule=rules.find(rule=>rule.source.startsWith(`/academy/${area}/:code(`));assert.ok(rule.source.includes(entity.code));assert.equal(rule.destination,`/academy/${area}/:code/index.html`)}
 assert.ok(!rules.slice(0,-1).some(rule=>/verify|portfolio|lessons/.test(rule.source)))
})
