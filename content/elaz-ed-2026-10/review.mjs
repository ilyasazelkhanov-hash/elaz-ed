import {readFile,writeFile,readdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
const migrationDir=new URL('../../supabase/migrations/',import.meta.url)
const names=(await readdir(migrationDir)).filter(x=>x.endsWith('.sql')).sort()
const parts=await Promise.all(names.map(x=>readFile(new URL(x,migrationDir),'utf8')))
const schema='begin;\n'+parts.join('\n\n')+'\ncommit;\n'
await writeFile(new URL('schema-new-project.sql',import.meta.url),schema)
const content=await readFile(new URL('import.sql',import.meta.url),'utf8')
const api=await readFile(new URL('../../supabase/functions/api/index.ts',import.meta.url),'utf8')
const update=await readFile(new URL('update-existing.sql',import.meta.url),'utf8')
const price=await readFile(new URL('course-price.sql',import.meta.url),'utf8')
// Последняя миграция, уже применённая на работающем проекте. Шаг 1 — всё, что новее.
const APPLIED='007_refunds_webhook_url.sql'
const fresh=names.filter(n=>n>APPLIED)
const escape=x=>x.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
// Сначала — обновление работающего проекта по шагам, ниже — всё для пустого проекта.
const groups=[
  ['Обновление работающего проекта — выполнять по порядку',[
    ['step1',`Шаг 1. SQL: миграции ${fresh.join(', ')}`,fresh.map(n=>parts[names.indexOf(n)].trim()).join('\n\n')+'\n'],
    ['api','Шаг 2. Edge Function api — заменить код целиком',api],
  ]],
  ['Пустой проект и материалы',[
    ['schema','Схема для пустого проекта (все миграции)',schema],
    ['content','84 материала',content],
    ['update','Обновление текстов уже перенесённых материалов',update],
    ['price','Цена и описание курса (на работающем проекте выполнено 14 октября)',price],
  ]],
]
const html=`<!doctype html><meta charset="utf-8"><title>Elaz Ed — пакет контента</title><style>body{font:16px system-ui;max-width:960px;margin:40px auto;padding:0 20px}textarea{width:100%;height:300px;font:12px monospace}h2{margin-top:56px}h3{margin-top:32px}</style><h1>Elaz Ed: сервер и материалы</h1><p>Целевой Supabase: dcdepwdxvadhludnubis. 64 материала ленты, 20 уроков курса. Схема для пустого проекта применяется только к проверенному пустому проекту. Секретов здесь нет.</p>`+groups.map(([group,sections])=>`<h2>${group}</h2>`+sections.map(([id,title,data])=>`<h3>${title}</h3><textarea id="${id}" aria-label="${title}" readonly>${escape(data)}</textarea>`).join('')).join('')
await writeFile(new URL('review.html',import.meta.url),html)
console.log(JSON.stringify({files:names.length,html:fileURLToPath(new URL('review.html',import.meta.url))}))
