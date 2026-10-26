import test from 'node:test'
import assert from 'node:assert/strict'
import {publicArticle} from '../content/ai-practice-2026-10-25/editorial.mjs'
test('social examples are standalone articles without blogger promotion or invented personal testing',()=>{
 for(let n=44;n<=50;n++){
  const p=publicArticle({source_index:n,title:'Telegram: old',body:'Denis Sexy IT [Пост](https://t.me/denissexy/11748)',subtitle:'Old',cover_url:'https://i.ytimg.com/old.jpg'},'https://official.example/claude.png')
  assert(!/denissexy|Denis Sexy|Thalita|t\.me|youtube\.com|reddit\.com|YouTube:|Telegram:/i.test(JSON.stringify(p)))
  assert(p.body.length>500);assert(!p.body.includes('мы проверили'))
  assert.equal(p.cover_url,'https://official.example/claude.png')
 }
})
test('presentation removes research footer and keeps useful official product links',()=>{
 const p=publicArticle({body:'[Инструмент](https://official.example/tool)\n\n---\n\nПо официальному описанию в предоставленной базе. Материал подборки на 25 октября 2026.\n\n[Изображение и источник иллюстрации](https://example.org/picture)'})
 assert(p.body.includes('https://official.example/tool'))
 assert(!p.body.includes('источник иллюстрации'));assert(!p.body.includes('предоставленной базе'))
})
