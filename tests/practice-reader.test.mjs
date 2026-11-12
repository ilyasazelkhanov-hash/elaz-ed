import test from 'node:test'
import assert from 'node:assert/strict'
import {practiceReaderStorageKey, readPracticeReaderDraft, splitPracticeCheck} from '../src/lib/practice-reader.ts'

test('a self-check hides the real answer while preserving every source character', () => {
 const source = '## Проверь себя\n\nПочему?\n\n```md\n## Разбор ответа\nЭто пример разметки.\n```\n\n## Разбор ответа\n\nЭто ответ.\n'
 const {question, answer} = splitPracticeCheck(source)
 assert.equal(question + answer, source)
 assert.ok(question.includes('Это пример разметки.'))
 assert.equal(question.includes('Это ответ.'), false)
 assert.ok(answer.startsWith('## Разбор ответа\n'))
 assert.equal(splitPracticeCheck('## Проверь себя\n\nВопрос без разбора.').answer, '')
})

test('answer headings inside tilde fences cannot disclose the answer early', () => {
 const source = '~~~text\n## Разбор ответа\nучебный текст\n~~~~\n\n## Разбор ответа\nответ'
 assert.equal(splitPracticeCheck(source).answer, '## Разбор ответа\nответ')
})

test('reader drafts are isolated by account, course and lesson without anonymous persistence', () => {
 const first = practiceReaderStorageKey(42, 'text', 'one')
 assert.notEqual(first, practiceReaderStorageKey(43, 'text', 'one'))
 assert.notEqual(first, practiceReaderStorageKey(42, 'text', 'two'))
 assert.notEqual(practiceReaderStorageKey('42:text', 'one', 'two'), practiceReaderStorageKey(42, 'text:one', 'two'))
 assert.equal(practiceReaderStorageKey(undefined, 'text', 'one'), null)
 assert.deepEqual(readPracticeReaderDraft(first, {getItem: () => '{"view":"check","answer":"Мой вывод"}'}), {view:'check',answer:'Мой вывод'})
})

test('unavailable and corrupt browser storage never prevents a lesson from opening', () => {
 const key = practiceReaderStorageKey(42, 'text', 'one'), fallback = {view:'reading',answer:''}
 for (const value of ['{broken', 'null', '42', '{"view":"unknown","answer":false}']) {
  assert.deepEqual(readPracticeReaderDraft(key, {getItem: () => value}), fallback)
 }
 assert.deepEqual(readPracticeReaderDraft(key, {getItem: () => {throw new Error('denied')}}), fallback)
 assert.deepEqual(readPracticeReaderDraft(null, {getItem: () => {throw new Error('must not read')}}), fallback)
})

// Render the reader itself so a navigation regression cannot hide sections behind
// an unlabeled horizontal scroller again. This is not a browser layout test.
test('reader exposes primary sections and an explicit menu for other sections', async () => {
 const {readFile} = await import('node:fs/promises')
 const {transformWithOxc} = await import('vite')
 const {createElement} = await import('react')
 const {renderToStaticMarkup} = await import('react-dom/server')
 const file = new URL('../src/screens/home/PracticeReader.tsx', import.meta.url)
 let code = (await transformWithOxc(await readFile(file, 'utf8'), file.pathname, {lang:'tsx', jsx:{runtime:'automatic'}})).code
 for (const [path, names] of Object.entries({'./GuideJourney':'GuideJourney','../../lib/og-lesson-interactions':'ogLessonInteraction','./PracticeArtifact':'PracticeArtifact','../../Markdown':'Markdown', '../../lib/og-practice':'practiceSections', '../../lib/practice-reader':'practiceReaderStorageKey, readPracticeReaderDraft, splitPracticeCheck', '../../ui':'Tap'})) {
  code = code.replace(new RegExp(`import[^;\\n]*from ["']${path.replaceAll('.', '\\.')}["'];?`, 'g'), `const { ${names} } = globalThis.__readerHarness;`)
 }
 code = code.replace(/import ["']\.\/practice\.css["'];?/g, '')
 for (const name of ['react', 'react/jsx-runtime', 'lucide-react']) code = code.replaceAll(`from "${name}"`, `from ${JSON.stringify(import.meta.resolve(name))}`)
 const {practiceSections} = await import('../src/lib/og-practice.ts')
 globalThis.__readerHarness = {
  GuideJourney:({children})=>children,
  ogLessonInteraction:async()=>undefined,
  PracticeArtifact:()=>null,
  practiceSections, practiceReaderStorageKey, readPracticeReaderDraft, splitPracticeCheck,
  Markdown: ({text}) => createElement('div', null, text),
  Tap: ({children, ...props}) => createElement('button', props, children),
 }
 try {
  const {PracticeReader} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const body = '## Объяснение\nТекст\n## Самостоятельная работа\nЗадание\n## Проверь себя\nВопрос\n## Ссылки\nРесурс'
  const html = renderToStaticMarkup(createElement(PracticeReader, {course:{key:'text',title:'Текст'}, lesson:{key:'one',title:'Урок',minutes:5,body}, index:0,total:1,onBack(){}}))
  assert.match(html, /aria-label="Разделы урока"/)
  for (const label of ['Читать: Объяснение', 'Практика', 'Проверить: Самопроверка']) assert.match(html, new RegExp(`aria-label="${label}"`))
  assert.match(html, /<details class="og-reader-more"/)
  assert.match(html, /Ещё разделы/)
  assert.match(html, /Инструменты и файлы/)
  assert.match(html, /Весь урок/)
  assert.match(html, /aria-controls=/)
  assert.match(html, /tabindex="-1" class="og-reader-content"/)
 } finally { delete globalThis.__readerHarness }
})

test('actual reader blocks stale hashes and unmounted results while preserving source fallback',async()=>{
 const {readFile}=await import('node:fs/promises'),{transformWithOxc}=await import('vite')
 const {practiceSections}=await import('../src/lib/og-practice.ts')
 const file=new URL('../src/screens/home/PracticeReader.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import[^;\n]*from ["']react["'];?/g,'const {useState,useEffect,useMemo,useRef,useId}=globalThis.__readerLife;')
 for(const [path,names]of Object.entries({'./GuideJourney':'GuideJourney','../../lib/og-lesson-interactions':'ogLessonInteraction','./PracticeArtifact':'PracticeArtifact','../../Markdown':'Markdown','../../lib/og-practice':'practiceSections','../../lib/practice-reader':'practiceReaderStorageKey, readPracticeReaderDraft, splitPracticeCheck','../../ui':'Tap'}))code=code.replace(new RegExp(`import[^;\\n]*from ["']${path.replaceAll('.','\\.')}["'];?`,'g'),`const {${names}}=globalThis.__readerLife;`)
 code=code.replace(/import ["']\.\/practice\.css["'];?/g,'')
 for(const name of ['react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 const states=[],effects=[],queued=[],pending=[];let si=0,ei=0,writes=0
 const Journey=()=>null,Markdown=()=>null
 const previous=globalThis.document
 globalThis.document={addEventListener(){},removeEventListener(){}}
 globalThis.__readerLife={GuideJourney:Journey,Markdown,Tap:()=>null,PracticeArtifact:()=>null,practiceSections,practiceReaderStorageKey,readPracticeReaderDraft,splitPracticeCheck,
  useState:init=>{const i=si++;if(!(i in states))states[i]=typeof init==='function'?init():init;return[states[i],v=>{writes++;states[i]=typeof v==='function'?v(states[i]):v}]},
  useEffect:(fn,deps)=>{const i=ei++,old=effects[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))queued.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()}})},
  useMemo:fn=>fn(),useRef:()=>({current:null}),useId:()=>':test:',
  ogLessonInteraction:(course,lesson,body)=>new Promise(resolve=>pending.push({course,lesson,body,resolve}))}
 const nodes=t=>!t||typeof t!=='object'?[]:[t,...[t.props?.children].flat(Infinity).flatMap(nodes)]
 const body=text=>`## Объяснение\n${text}\n## Самостоятельная работа\nЗадание`
 const flow={id:'flow',steps:[],challenges:[]}
 try{
  const {PracticeReader}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const props={course:{key:'foundations',title:'Основы'},lesson:{key:'block-1',title:'Урок',minutes:5,body:body('A')},index:0,total:1,onBack(){}}
  const render=()=>{si=0;ei=0;const outer=PracticeReader(props);return outer.type(outer.props)}
  const flush=()=>{while(queued.length)queued.shift()()}
  const settle=()=>new Promise(resolve=>setImmediate(resolve))
  const assertSource=(tree,text)=>{assert.ok(nodes(tree).some(n=>n.type===Markdown&&n.props.text.includes(text)));assert.ok(!nodes(tree).some(n=>n.type===Journey))}
  assertSource(render(),'A');flush()
  props.lesson={...props.lesson,body:body('B')};assertSource(render(),'B');flush()
  pending[0].resolve(flow);await settle();assertSource(render(),'B')
  pending[1].resolve(flow);await settle();let tree=render()
  assert.ok(nodes(tree).some(n=>n.type===Journey));assert.ok(nodes(tree).some(n=>n.type===Markdown&&n.props.text.includes('B')))
  props.lesson={...props.lesson,body:body('C')};assertSource(render(),'C') // before effect cleanup too
  flush();pending[2].resolve(undefined);await settle();assertSource(render(),'C')
  props.lesson={...props.lesson,body:body('D')};render();flush()
  for(const effect of effects)effect?.cleanup?.()
  const before=writes;pending[3].resolve(flow);await settle();assert.equal(writes,before,'unmounted hash must not set state')
 }finally{delete globalThis.__readerLife;if(previous===undefined)delete globalThis.document;else globalThis.document=previous}
})
