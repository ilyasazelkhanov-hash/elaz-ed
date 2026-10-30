// Real keyboard regression checks against the local Vite app; synthetic demo data only.
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
;(async () => {
 const browser = await chromium.launch({headless:true})
 const failures=[],results=[]
 try {
  for (const width of [390,1024]) for (const scenario of ['focus','bonus','bonus-space','bonus-pointer','contrast']) {
   if(process.env.UI_CASE && scenario!==process.env.UI_CASE)continue
   const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'})
   page.setDefaultTimeout(10000)
   try {
    await page.goto(process.env.UI_ORIGIN || 'http://127.0.0.1:5173/?demo')
    await page.waitForLoadState('networkidle')
    await page.waitForFunction(async()=> (await import('/src/store.ts')).useStore.getState().phase==='ok')
    if(scenario==='focus') {
     await page.evaluate(async()=> (await import('/src/store.ts')).useStore.getState().setTab('blog'))
     const opener=page.getByRole('button',{name:/Читать публикацию:/}).first()
     await opener.focus();await opener.press('Enter')
     const post=page.getByRole('region',{name:'Публикация блога'})
     await post.waitFor()
     assert.equal(await post.evaluate(el=>el.contains(document.activeElement)),true,'opening must focus the article')
     for(const key of ['Tab','Shift+Tab'])for(let i=0;i<25;i++){await page.keyboard.press(key);assert.equal(await post.evaluate(el=>el.contains(document.activeElement)),true,'Tab stays inside article')}
     assert.equal(await page.getByRole('navigation',{name:'Основные разделы',includeHidden:true}).evaluate(el=>!!el.closest('[inert]')),true)
     const share=post.getByRole('button',{name:'Поделиться публикацией'})
     await share.focus()
     // Blog share opens Telegram directly. Open the app's share sheet with a synthetic card.
     await page.evaluate(async()=> {const {useStore}=await import('/src/store.ts');const {levelCard}=await import('/src/lib/shareCard.ts');useStore.setState({share:levelCard(useStore.getState().me)})})
     await page.waitForFunction(()=>!!document.activeElement?.closest('[role="dialog"][aria-label="Поделиться"]'))
     await page.keyboard.press('Escape')
     await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Поделиться публикацией')
     // A nested screen must isolate the article, then restore its triggering control.
     await page.evaluate(async()=> (await import('/src/store.ts')).useStore.getState().push({type:'club'}))
     await page.waitForFunction(()=>document.querySelectorAll('[data-focus-layer]').length===2)
     assert.equal(await post.evaluate(el=>!!el.closest('[inert]')),true)
     await page.evaluate(async()=> (await import('/src/store.ts')).useStore.getState().pop())
     await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Поделиться публикацией')
     await post.getByRole('button',{name:'Назад',exact:true}).click()
     await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')?.startsWith('Читать публикацию:'))
     await page.waitForFunction(()=>document.querySelectorAll('[data-focus-layer]').length===0)
    } else if(scenario.startsWith('bonus')) {
     await page.evaluate(async()=>{const {api}=await import('/src/lib/api.ts');const original=api.daily;window.dailyCalls=0;api.daily=async()=>{window.dailyCalls++;await new Promise(r=>setTimeout(r,500));return original()}})
     const bonus=page.getByRole('button',{name:/бонус дня/})
     assert.equal(await bonus.evaluate(el=>el.tagName),'BUTTON','bonus must support native keyboard activation')
     if(scenario==='bonus-pointer') {
      await bonus.scrollIntoViewIfNeeded()
      // Wait for the card's entrance animation before starting a physical hold.
      await page.waitForFunction(()=>[...document.getAnimations()].every(a=>a.effect?.getComputedTiming().iterations===Infinity || a.playState!=='running'))
      await bonus.hover();await page.mouse.down();await page.waitForFunction(()=>window.dailyCalls===1);await page.waitForFunction(()=>document.querySelector('button[aria-label="Забрать бонус дня"]')?.disabled);await page.mouse.up()
     } else {
      const key=scenario==='bonus-space'?'Space':'Enter'
      await bonus.focus();await page.keyboard.down(key);await page.keyboard.down(key);await page.keyboard.up(key);await page.keyboard.press(key)
     }
     assert.equal(await bonus.isDisabled(),true,'busy claim disables input')
     assert.equal(await page.evaluate(()=>window.dailyCalls),1,'autorepeat and busy input must not duplicate claim')
    } else {
     const ratios=await page.evaluate(()=>{
      const b=document.createElement('button');b.className='cta cta-aurora';document.body.append(b)
      const color=getComputedStyle(b).color.match(/[\d.]+/g).slice(0,3).map(Number);b.remove()
      const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)
      const stops=[[[124,107,255],[178,107,255],[255,133,192]],[[255,106,0],[255,179,71]],[[232,51,74],[255,209,102],[62,224,143]]]
      return stops.flatMap(gradient=>gradient.slice(1).flatMap((end,i)=>Array.from({length:101},(_,j)=>gradient[i].map((v,k)=>v+(end[k]-v)*j/100)))).map(c=>(Math.max(lum(c),lum(color))+.05)/(Math.min(lum(c),lum(color))+.05))
     });assert.ok(ratios.every(r=>r>=4.5),`CTA contrast: ${ratios}`)
    }
    const out=path.resolve('docs/audits/2026-10-30-remediation/ui');await fs.mkdir(out,{recursive:true});await page.screenshot({path:path.join(out,`${scenario}-${width}.png`)})
    console.log(`PASS ${scenario} ${width}`)
    results.push({scenario,width,passed:true})
   } catch(e){failures.push(`${scenario} ${width}: ${e.message}`);console.error(e.stack);console.error(await page.evaluate(()=>({active:document.activeElement?.outerHTML.slice(0,250),layers:[...document.querySelectorAll('[data-focus-layer]')].map(e=>({label:e.getAttribute('aria-label'),inert:e.inert}))})));console.error(`FAIL ${failures.at(-1)}`)} finally{await page.close()}
  }
 }finally{await browser.close()}
 await fs.mkdir(path.resolve('docs/audits/2026-10-30-remediation/ui'),{recursive:true})
 await fs.writeFile(path.resolve('docs/audits/2026-10-30-remediation/ui/checks.json'),JSON.stringify({results,failures},null,2))
 if(failures.length)throw Error(failures.join('\n'))
})().catch(e=>{console.error(e);process.exitCode=1})
