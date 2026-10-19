import {chromium,expect} from '@playwright/test'
import {createRequire} from 'node:module'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
const require=createRequire(new URL('../../package.json',import.meta.url))
const {createServer,build}=require('vite'),react=require('@vitejs/plugin-react').default
const pack=JSON.parse(await readFile(new URL('../../content/ai-academy/authored/VC-101.json',import.meta.url),'utf8'))
const code=lesson=>pack.lessons.find(l=>l.code===lesson).data.content_blocks.find(b=>b.type==='code').text
const folder=path.resolve('test-results/academy-example')
await mkdir(folder,{recursive:true})
for(const [name,body] of Object.entries({'App.jsx':code('VC-101-M3-L3'),'App.css':code('VC-101-M2-L3'),'main.jsx':"import React from 'react';import {createRoot} from 'react-dom/client';import App from './App';createRoot(document.getElementById('root')).render(<App/>);",'index.html':'<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.jsx"></script></body></html>'}))await writeFile(path.join(folder,name),body)
await build({root:folder,configFile:false,plugins:[react()],logLevel:'error'})
const server=await createServer({root:folder,configFile:false,plugins:[react()],server:{host:'127.0.0.1',port:5199,strictPort:true}})
await server.listen()
const browser=await chromium.launch({executablePath:process.env.AZ_CHROME_PATH||undefined})
try{
 const page=await browser.newPage({viewport:{width:360,height:844}}),errors=[]
 page.on('pageerror',e=>errors.push(String(e)))
 await page.goto('http://127.0.0.1:5199/')
 await page.getByRole('button',{name:'Сохранить учебную заявку',exact:true}).click()
 await expect(page.getByLabel('Имя',{exact:true})).toHaveAttribute('aria-invalid','true')
 await page.getByRole('button',{name:'Выбрать: Установка светильника',exact:true}).click()
 await page.getByLabel('Имя',{exact:true}).fill('Ая')
 await page.getByLabel('Учебный контакт',{exact:true}).fill('demo-contact')
 await page.getByRole('button',{name:'Сохранить учебную заявку',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('мастеру не отправлено')
 await expect(page.getByRole('status')).toContainText('Установка светильника')
 await page.reload()
 await expect(page.getByRole('status')).toContainText('demo-contact')
 await page.evaluate(()=>{localStorage.setItem('master-request-v1','broken JSON')})
 await page.reload()
 await expect(page.getByLabel('Имя',{exact:true})).toBeVisible()
 expect(errors).toEqual([])
 await writeFile('test-results/academy-example.json',JSON.stringify({build:true,checks:['invalid form','selected service','truthful local confirmation','reload','corrupt storage'],errors},null,2))
 console.log('Authored React example: build + 5 browser checks passed.')
}finally{await browser.close();await server.close()}
