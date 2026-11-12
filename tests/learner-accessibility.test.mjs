import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {rolldown} from 'rolldown'
import {fileURLToPath} from 'node:url'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import {renderToStaticMarkup} from 'react-dom/server'

async function load(file, context = {}, modules = {}) {
  const bundle=await rolldown({input:fileURLToPath(new URL('../src/'+file,import.meta.url)),external:(_id,parent)=>!!parent,transform:{jsx:{runtime:'automatic'}}})
  let js
  try {js=(await bundle.generate({format:'cjs'})).output[0].code} finally {await bundle.close()}
  const module={exports:{}}
  vm.runInNewContext(js,{module,exports:module.exports,React,URLSearchParams,require(name){
    if (name==='react/jsx-runtime') return jsxRuntime
    if (name.endsWith('.css')) return {}
    if(name in modules) return modules[name]
    return {}
  },...context})
  return module.exports
}

for (const platform of ['ios','android','tdesktop']) test(`Telegram startup preserves device orientation on ${platform}`,async()=>{
  const calls=[]
  const sdk={platform,initData:'test',isVersionAtLeast:()=>true}
  for(const name of ['ready','expand','disableVerticalSwipes','requestFullscreen','lockOrientation','unlockOrientation']) sdk[name]=()=>calls.push(name)
  const {initTelegram}=await load('lib/tg.ts',{window:{Telegram:{WebApp:sdk}},location:{search:''}})
  initTelegram()
  assert.deepEqual(calls,platform==='tdesktop'?['ready','expand','disableVerticalSwipes']:['ready','expand','disableVerticalSwipes','requestFullscreen'])
})

test('startup remains safe outside Telegram and with an old incomplete SDK',async()=>{
  for(const sdk of [undefined,{platform:'ios',initData:'test',isVersionAtLeast:()=>false}]) {
    const {initTelegram}=await load('lib/tg.ts',{window:{Telegram:{WebApp:sdk}},location:{search:''}})
    assert.doesNotThrow(()=>initTelegram())
  }
})

test('learner catalog no longer sends learners to the private repository',async()=>{
  const Element=({children})=>React.createElement('div',null,children)
  const modules={
    react:React,'lucide-react':{ArrowRight:Element,ChevronRight:Element,Search:Element},
    '../../lib/learning-scope':{useLearningDemo:()=>false},
    '../../lib/academy-i18n':{useAcademyTranslation:()=>x=>x,useAcademyLocale:()=> 'ru',localizedEntity:x=>x},
    '../../ui':{Tap:Element,Cta:Element},
    './shared':{useAcademy:()=>({data:{courses:[],directions:[],preview_only:true},loading:false,error:null,refresh(){}}),ProgramNotice:()=>React.createElement('p',null,'Учебные материалы временно недоступны'),FetchState:()=>null,Empty:Element,More:()=>null},
  }
  const {Catalog}=await load('screens/academy/Catalog.tsx',{},modules)
  const html=renderToStaticMarkup(React.createElement(Catalog,{go(){}}))
  assert.doesNotMatch(html,/github\.com|Читать модули/)
  assert.match(html,/Учебные материалы временно недоступны/)
  assert.match(html,/Поиск курсов/)
})
