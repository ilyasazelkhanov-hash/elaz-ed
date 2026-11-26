import assert from 'node:assert/strict'
import {readFile, writeFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import path from 'node:path'
import {chromium} from 'playwright'

const evidence = JSON.parse(await readFile('test-results/audit-validation.json', 'utf8'))
const port = await new Promise((resolve, reject) => {
 const socket = createServer().once('error', reject)
 socket.listen(0, '127.0.0.1', () => {
  const selected = socket.address().port
  socket.close(error => error ? reject(error) : resolve(selected))
 })
})
const base = 'http://127.0.0.1:' + port
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--outDir', path.join(evidence.out, 'dist')], {stdio:'inherit'})
const checks = []
let browser
try {
 for (let i = 0; ; i++) {
  if (await fetch(base).then(r => r.ok, () => false)) break
  if (i >= 40 || server.exitCode !== null) throw Error('Preview did not start')
  await new Promise(resolve => setTimeout(resolve, 250))
 }
 browser = await chromium.launch({headless:true})
 for (const width of [320, 390]) for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({viewport:{width,height:844},colorScheme:theme,reducedMotion:'reduce'})
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/telegram.org/**', route => route.abort())
  await page.goto(base+'/?demo#/courses/start')
  const atlas = page.getByRole('heading',{name:/VIBE ATLAS/}).locator('..')
  await atlas.getByText('Попробовать первую задачу',{exact:true}).click()
  const draft = atlas.getByLabel('Мой результат')
  await draft.fill('Экран записи, свободный слот и подтверждение.')
  await atlas.getByRole('button',{name:'Сохранить',exact:true}).click()
  await atlas.getByText('Работа сохранена в этом браузере.').waitFor()
  await page.reload()
  await atlas.getByText('Попробовать первую задачу',{exact:true}).click()
  assert.match(await draft.inputValue(), /свободный слот/)
  assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
  const overflow = await atlas.evaluate(element => element.closest('main').scrollWidth > element.closest('main').clientWidth + 1)
  assert.equal(overflow,false)
  await page.getByRole('button',{name:'Назад',exact:true}).first().click()
  await page.goto(base+'/?demo#/blog')
  await page.getByRole('button',{name:'Новости',exact:true}).first().waitFor()
  assert.deepEqual(errors,[])
  checks.push({width,theme,draftReload:true,newsTab:true,pageErrors:errors.length})
  await page.close()
 }
} finally {
 await browser?.close()
 server.kill()
 await writeFile('test-results/og-product-browser.json',JSON.stringify({checks},null,2)+'\n')
}
