import test from 'node:test'
import assert from 'node:assert/strict'
import {readingParts,belongsToReadingSection} from '../src/lib/academy-reading.ts'

test('normalizes page-level headings without changing fenced commands or executing them',()=>{
 const source='# Объяснение\n\nТекст.\n\n```bash\n# это комментарий команды\nprintf "$(never_execute)"\n```\n\n# Следующая мысль'
 const parts=readingParts(source)
 assert.match(parts[0].text,/^## Объяснение/)
 const code=parts.find(part=>part.kind==='code')
 assert.equal(code.language,'bash')
 assert.equal(code.text,'# это комментарий команды\nprintf "$(never_execute)"\n')
 assert.equal(code.source,'```bash\n# это комментарий команды\nprintf "$(never_execute)"\n```')
 assert.match(parts.at(-1).text,/^## Следующая мысль/)
})

test('practice commands move with their instructions while reading and self-check stay separate',()=>{
 const parts=readingParts('## Объяснение\nСначала пойми правило.\n\n## Повтори сам\nВыполни команду.\n\n```bash\nnode --test\n```\n\n## Самопроверка\nСравни итог.')
 const practice=parts.filter(part=>belongsToReadingSection(part,'practice'))
 assert.equal(practice.find(part=>part.kind==='code').text,'node --test\n')
 assert.ok(!parts.filter(part=>belongsToReadingSection(part,'reading')).some(part=>part.kind==='code'))
 assert.match(parts.filter(part=>belongsToReadingSection(part,'check'))[0].text,/Сравни итог/)
})

test('semantic teaching sections retain order, Markdown links, tables and concrete instructions',()=>{
 const parts=readingParts('Вводная.\n\n## На простом примере\nПосмотри [источник](/learning/data.zip).\n\n| Поле | Значение |\n| --- | --- |\n| a | 1 |\n\n### Практика\n1. Сохрани исходник.\n2. Сравни результат.\n\n## Самопроверка\n- Источник найден.\n\n### Подсказка\nСравни одну строку.\n\n## Ожидаемый результат\nФайл с проверкой.')
 assert.deepEqual(parts.map(part=>part.kind),['text','example','practice','check','hint','result'])
 assert.match(parts[1].text,/\[источник\]\(\/learning\/data\.zip\)/)
 assert.match(parts[1].text,/\| a \| 1 \|/)
 assert.match(parts[2].text,/1\. Сохрани исходник\./)
 assert.equal(parts.at(-1).text,'Файл с проверкой.')
})

test('inline practice labels are promoted while longer fences and unclosed code remain literal',()=>{
 const parts=readingParts('**Практика.** Составь два примера.\n\n````text\n```\n# Заголовок внутри примера\n````\n\nПодсказка: начни с одного примера.\n\n~~~js\n# не заголовок\nconst x = 1;')
 assert.equal(parts[0].kind,'practice');assert.equal(parts[0].text,'Составь два примера.')
 assert.equal(parts[1].kind,'code');assert.equal(parts[1].text,'```\n# Заголовок внутри примера\n')
 assert.equal(parts[2].kind,'hint');assert.equal(parts[2].text,'начни с одного примера.')
 assert.equal(parts[3].kind,'code');assert.equal(parts[3].text,'# не заголовок\nconst x = 1;')
})

test('an ordinary new heading ends a preceding practical callout without losing either section',()=>{
 const parts=readingParts('## Практика\nСохрани две строки.\n\n## Почему это работает\nОбъяснение с `inline code`.')
 assert.deepEqual(parts.map(part=>part.kind),['practice','text'])
 assert.equal(parts[0].text,'Сохрани две строки.')
 assert.match(parts[1].text,/^## Почему это работает/)
 assert.match(parts[1].text,/`inline code`/)
})
