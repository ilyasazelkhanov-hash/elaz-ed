import test from 'node:test'
import assert from 'node:assert/strict'
import { newsExcerpt, newsShareText, newsTelegramPost } from '../supabase/functions/_shared/news.ts'

test('summary uses article substance, strips markdown and keeps a strict length',()=>{
  const body='**Статус: П. 25.10.2026.**\n\n## Что изменилось\n\nИнструмент собирает [слайды](https://example.org) по источникам. ![обложка](https://example.org/a.png)\n\n### Применение\n\n'+'Подготовь план выступления. '.repeat(100)
  const excerpt=newsExcerpt({body,subtitle:'Краткая подпись'})
  assert(excerpt.includes('Инструмент собирает слайды по источникам.'))
  assert(!/https:|Статус:|!\[|##/.test(excerpt))
  assert(excerpt.length<=480)
})
test('user share is concise and full article link is included by Telegram separately',()=>{
  const text=newsShareText({title:'Новая модель',body:'Модель готовит черновик ролика по трём референсам.'})
  assert(text.includes('Новая модель'));assert(text.includes('по трём референсам'))
  assert(text.length<700)
})
test('bot post escapes HTML, contains a visible direct article URL and fits a photo caption',()=>{
  const post=newsTelegramPost({id:42,title:'Текст <script> & тест',body:'Описание '.repeat(200),emoji:'🤖'}, {username:'elazart_bot',main_app:true})
  assert(post.text.includes('&lt;script&gt; &amp; тест'))
  assert(post.text.includes('https://t.me/elazart_bot?startapp=l42'))
  assert.equal(post.link,'https://t.me/elazart_bot?startapp=l42')
  assert(post.text.length<=1024)
})
