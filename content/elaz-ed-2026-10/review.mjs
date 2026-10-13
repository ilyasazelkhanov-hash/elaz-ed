import {readFile,writeFile,readdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
const migrationDir=new URL('../../supabase/migrations/',import.meta.url)
const names=(await readdir(migrationDir)).filter(x=>x.endsWith('.sql')).sort()
const parts=await Promise.all(names.map(x=>readFile(new URL(x,migrationDir),'utf8')))
const schema='begin;\n'+parts.join('\n\n')+`\nupdate public.settings set value='"https://dcdepwdxvadhludnubis.supabase.co/functions/v1/api"'::jsonb where key='api_url';\ncommit;\n`
await writeFile(new URL('schema-new-project.sql',import.meta.url),schema)
const content=await readFile(new URL('import.sql',import.meta.url),'utf8')
const api=await readFile(new URL('../../supabase/functions/api/index.ts',import.meta.url),'utf8')
const update=await readFile(new URL('update-existing.sql',import.meta.url),'utf8')
const escape=x=>x.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const sections=[['schema','Схема для пустого проекта',schema],['content','84 материала',content],['api','Edge Function api',api],['update','Обновление текстов Elaz Ed',update]]
const html=`<!doctype html><meta charset="utf-8"><title>Elaz Ed — пакет контента</title><style>body{font:16px system-ui;max-width:960px;margin:40px auto;padding:0 20px}textarea{width:100%;height:300px;font:12px monospace}h2{margin-top:40px}</style><h1>Elaz Ed: импорт 13 октября 2026</h1><p>Целевой Supabase: dcdepwdxvadhludnubis. 64 материала ленты, 20 уроков курса. Схема применяется только к проверенному пустому проекту. Секретов здесь нет.</p>`+sections.map(([id,title,data])=>`<h2>${title}</h2><textarea id="${id}" aria-label="${title}" readonly>${escape(data)}</textarea>`).join('')
await writeFile(new URL('review.html',import.meta.url),html)
console.log(JSON.stringify({files:names.length,html:fileURLToPath(new URL('review.html',import.meta.url))}))
