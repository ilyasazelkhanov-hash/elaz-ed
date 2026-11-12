import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plainDashes, remarkPlainDashes } from '../src/lib/plain-dashes.ts'
import { unified } from 'unified'
import remarkParse from 'remark-parse'

test('normalizes prose and leaves numeric ranges intact', () => {
  assert.equal(plainDashes('Задача — результат; слово–слово; 2026–2027; 10–15'), 'Задача - результат; слово-слово; 2026–2027; 10–15')
  assert.equal(plainDashes('Автор — «слово — слово» и “дословно — так”'), 'Автор - «слово — слово» и “дословно — так”')
})
test('preserves Markdown syntax, code, URLs and verbatim quotes', async () => {
  const input = '# Заголовок — пример\n\n[Кнопка — пример](https://example.com/a—b)\n\n`a—b`\n\n```js\nconst a = "x—y"\n```\n\n> Цитата — дословно\n\nОбычный текст — конец'
  const processor = unified().use(remarkParse).use(remarkPlainDashes)
  const tree = await processor.run(processor.parse(input))
  assert.equal(tree.children[0].children[0].value, 'Заголовок - пример')
  const link = tree.children[1].children[0]
  assert.equal(link.url, 'https://example.com/a—b')
  assert.equal(link.children[0].value, 'Кнопка - пример')
  assert.equal(tree.children[2].children[0].value, 'a—b')
  assert.equal(tree.children[3].value, 'const a = "x—y"')
  assert.equal(tree.children[4].children[0].children[0].value, 'Цитата — дословно')
  assert.equal(tree.children[5].children[0].value, 'Обычный текст - конец')
})
test('does not mutate HTML, metadata or fields other than visible prose', () => {
  const tree = { type: 'root', children: [{type: 'html', value: '<span data-id="a—b">x—y</span>'}, {type: 'image', url: 'a—b.png', alt: 'Original — alt'}, {type: 'definition', url: 'a—b', title: 'Original — title'}] }
  const before = structuredClone(tree)
  remarkPlainDashes()(tree)
  assert.deepEqual(tree, before)
})
