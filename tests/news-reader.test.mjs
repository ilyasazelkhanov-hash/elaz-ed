import test from 'node:test'
import assert from 'node:assert/strict'
import { newsArticleBody, newsCourseRecommendations } from '../src/lib/news-reader.ts'
import { ogPracticeCourses } from '../src/lib/og-practice.ts'
import { primarySourcesForReader } from '../src/lib/editorial.ts'

const visibleText = body => body.replace(/\n{3,}/g, '\n\n').trim()
const primary = { title: 'Официальный анонс', url: 'https://official.example/blog/release' }
const post = (title, subtitle = '', category = 'Новости ИИ') => ({ title, subtitle, category })
const courses = ogPracticeCourses.map((outline, index) => ({ id: index + 1, practice_key: outline.key, title: outline.title, lessons: outline.lessons.length, access: false, price_stars: 700, request: null }))
const keys = (article, available = courses, limit) => newsCourseRecommendations(article, available, limit).map(item => item.outline.key)

test('existing announcement appendix disappears without changing the authored string or importing secondary sources', () => {
 const original = 'Событие.\n\n## Источники анонса\n\n- [Оригинал](https://official.example/blog/release)\n- [Пересказ](https://news.example/story)\n\n## Что дальше\nПроверяем результат.'
 const body = newsArticleBody(original)
 assert.equal(visibleText(body), 'Событие.\n\n## Что дальше\nПроверяем результат.')
 assert.match(original, /Пересказ/)
 assert.deepEqual(primarySourcesForReader([primary]), [primary])
 assert.doesNotMatch(JSON.stringify(primarySourcesForReader([primary])), /news\.example/)
})

test('primary, announcement, bold and setext source appendices collapse into the one metadata footer', () => {
 for (const heading of ['## Первоисточники', '### Источники анонса:', '**Источники анонса**', 'Источники\n----------']) {
  assert.equal(visibleText(newsArticleBody(`Вступление.\n\n${heading}\n\n1. [Анонс](https://example.org/release)\n2. https://example.org/docs\n`)), 'Вступление.')
 }
 assert.equal(visibleText(newsArticleBody('Текст.\n\nИсточник: https://example.org/release')), 'Текст.')
 assert.equal(visibleText(newsArticleBody('Текст.\n\n**Первоисточник:** [Анонс](https://example.org/release)')), 'Текст.')
})

test('article prose, inline citations, unrelated sections and fenced examples are never source appendices', () => {
 const body = '## Источники данных для RAG\n- [Датасет](https://example.org/data)\n\nАвтор [объясняет ограничение](https://example.org/limit).\n\n```markdown\n## Источники анонса\n- [Пример](https://example.org/example)\n```'
 assert.equal(newsArticleBody(body), body)
 const prose = newsArticleBody('## Источники анонса\nЭтот анонс описывает ограничение.\n- [Анонс](https://example.org/release)\n\n## Практика\n- [Файл](https://example.org/file)')
 assert.match(prose, /Этот анонс описывает ограничение/)
 assert.match(prose, /Файл/)
})

test('a source label does not invent primary metadata for a body-only legacy article', () => {
 assert.equal(visibleText(newsArticleBody('Новость\n\n## Источники анонса\n- [СМИ](https://news.example/story)')), 'Новость')
 assert.deepEqual(primarySourcesForReader(), [])
})

test('canonical reader sources deduplicate tracking and fragments but keep distinct documents and actual query identifiers', () => {
 const list = [primary, { ...primary, url: primary.url + '?utm_source=telegram#top' }, { ...primary, url: primary.url + '/' }, { ...primary, url: primary.url + '?version=2' }, { ...primary, url: 'https://official.example/docs' }]
 assert.deepEqual(primarySourcesForReader(list), [list[0], list[3], list[4]])
 assert.equal(list.length, 5)
 const queries = [primary.url + '?path=release/', primary.url + '?path=release'].map(url => ({ ...primary, url }))
 assert.equal(primarySourcesForReader(queries).length, 2)
})

test('course recommendations follow concrete news subjects and can include two relevant courses', () => {
 for (const [title, expected] of [['Codex: новая проверка pull request', ['coding']], ['Veo: новая генерация видео', ['media']], ['NotebookLM: исследование по документам', ['text']], ['n8n: надёжная автоматизация', ['automation']], ['ChatGPT: работа с контекстом', ['foundations']], ['Агенты Codex: автоматизация проверки кода', ['coding', 'automation']]]) assert.deepEqual(keys(post(title)), expected, title)
 assert.deepEqual(keys(post('Sora внутри ChatGPT')), ['media'])
 assert.deepEqual(keys(post('Новое обновление', 'Gemini научился анализировать таблицы')), ['text'])
})

test('general news and broad categories alone never manufacture a course match', () => {
 assert.deepEqual(keys(post('Компания привлекла инвестиции', '', 'Новости ИИ')), [])
 assert.deepEqual(keys(post('OpenAI привлекла инвестиции')), [])
 assert.deepEqual(keys(post('OpenAI наняла рекламное агентство')), [])
 assert.deepEqual(keys(post('Изменился совет директоров', '', 'Код')), [])
})

test('only uniquely matched real server courses with lessons can be recommended', () => {
 const article = post('Veo: генерация видео')
 assert.deepEqual(keys(article, []), [])
 const media = courses.find(course => course.practice_key === 'media')
 for (const lessons of [0, -1, undefined, NaN, '6']) assert.deepEqual(keys(article, [{ ...media, lessons }]), [])
 assert.deepEqual(keys(article, [{ ...media, id: -1 }]), [])
 assert.deepEqual(keys(article, [media, { ...media, id: 91 }]), [])
 assert.deepEqual(keys(article, [{ ...media, practice_key: undefined }]), ['media'])
 assert.deepEqual(keys(article, [{ ...media, practice_key: undefined, title: 'Похожий курс про видео' }]), [])
})

test('access and prices are taken from the current catalog, not invented by relevance', () => {
 const available = courses.map(course => ({ ...course, access: true, price_stars: 0 }))
 const result = newsCourseRecommendations(post('Codex: новый инструмент разработчика'), available)[0]
 assert.equal(result.course, available.find(course => course.practice_key === 'coding'))
 assert.equal(result.course.access, true)
 assert.equal(result.course.price_stars, 0)
 assert.match(result.reason, /создания и проверки/)
 assert.doesNotMatch(result.reason, /новая функция|бесплатн/)
 assert.deepEqual(keys(post('Codex: агенты'), courses, 0), [])
})


test('source cleanup preserves reference definitions, prose starting with a link and indented code', () => {
 const body = 'См. [ограничения][release].\n\n## Источники анонса\n- [Анонс][release]\n[release]: https://example.org/release\n[Автор](https://example.org/author) объясняет ограничения.\n\n    ## Источники анонса\n    - [Пример](https://example.org/example)'
 const cleaned = newsArticleBody(body)
 assert.match(cleaned, /\[release\]: https:\/\/example.org\/release/)
 assert.match(cleaned, /объясняет ограничения/)
 assert.match(cleaned, /    ## Источники анонса/)
 assert.doesNotMatch(cleaned, /^- \[Анонс\]\[release\]/m)
})


test('setext article headings end source lists before unrelated links', () => {
 const body = '## Источники анонса\n- [Анонс](https://example.com)\n\nПрактика\n--------\n- [Скачайте шаблон](https://example.com/template)'
 assert.match(newsArticleBody(body), /Скачайте шаблон/)
 assert.doesNotMatch(newsArticleBody(body), /Анонс/)
})

test('attribution paragraphs and meaningful code whitespace survive exactly', () => {
 const paragraph = 'Источник: [документация](https://example.com) подтверждает только часть заявлений. Важно проверить ограничения.'
 assert.equal(newsArticleBody(paragraph), paragraph)
 for (const body of ['    const x = 1;\n    const y = 2;', '```text\nfirst\n\n\nlast\n```']) assert.equal(newsArticleBody(body), body)
 const body = '```text\nfirst\n\n\nlast\n```\n\n## Источники анонса\n- [Анонс](https://example.org/release)'
 assert.match(newsArticleBody(body), /first\n\n\nlast/)
})

test('source lists preserve substantive qualifications after linked citations', () => {
 const entries = [
  '- [Документация](https://example.org/docs) подтверждает только API; интерфейс приложения ещё не поддерживается.',
  '1. [Ограничения][release] относятся к прежней версии, не к новому интерфейсу.',
  '* https://example.org/docs — сначала проверьте региональную доступность.',
 ]
 const body = `## Источники анонса\n${entries.join('\n')}\n- [Чистая ссылка](https://example.org/release)\n2. <https://example.org/other>\n[release]: https://example.org/limits`
 const cleaned = newsArticleBody(body)
 for (const entry of entries) assert.ok(cleaned.includes(entry), entry)
 assert.doesNotMatch(cleaned, /Чистая ссылка|example.org\/other/)
 assert.match(cleaned, /\[release\]: https:\/\/example.org\/limits/)
})
