// Finds stock phrases that make Russian copy read as machine-written filler.
// Usage: node scripts/copy-slop.mjs [--json] [--max=N] <file-or-dir>...
// Exit code 1 when --max is given and the total is above it. Without --max it only reports.
import {readdirSync, readFileSync, statSync} from 'node:fs'
import {extname, join, relative} from 'node:path'

/** Each marker names the habit, not a banned word: the fix is to say the concrete thing instead. */
export const SLOP_MARKERS = [
 ['пустое вступление', /в современном мире|в наше время|в эпоху [а-яё]+|в мире, где|как никогда (?:раньше|важн|актуальн)|ни для кого не секрет|задумывал(?:ись|ся) ли|знаете ли вы|представьте себе/giu],
 ['объявление вместо дела', /давай(?:те)? (?:разбер[её]мся|рассмотрим|погрузимся|начн[её]м с того)|погрузимся в|окун[её]мся в|в (?:этой|данной) статье (?:мы|я)|в (?:этом|данном) уроке мы (?:рассмотрим|разбер[её]м|узнаем)/giu],
 ['канцелярит', /важно отметить|стоит отметить|следует отметить|нельзя не отметить|необходимо понимать|важно понимать, что|является неотъемлем|неотъемлемая часть|игра(?:ет|ют) (?:ключевую|важную|решающую) роль|в рамках данного|на сегодняшний день|в настоящее время/giu],
 ['рекламный штамп', /раскр(?:ой|ыть|ывает) (?:свой |весь |полный )?потенциал|на новый уровень|суперсил|волшебн|магическ|как по волшебству|революцион|инновационн|мощн(?:ый|ейший|ая) инструмент|гейм-?чейнджер|маст-?х[эе]в|открыва(?:ет|ют) (?:новые|безграничные) (?:возможности|горизонты)|безграничн|бесконечные возможности|новые горизонты|ключ к успеху|секрет успеха|залог успеха|прокача(?:й|ть|ешь) (?:свои |свой )?(?:навык|скилл)/giu],
 ['пустой усилитель', /невероятн|потрясающ|захватывающ|впечатляющ|уникальн(?:ый|ая|ое|ые|ого|ую|ых) (?:возможност|шанс|опыт|инструмент|подход)|по-настоящему|чрезвычайно|крайне (?:важн|полезн)|абсолютно (?:кажд|люб|вс)/giu],
 ['ложная простота', /легко и просто|быстро и легко|просто и быстро|без (?:лишних|особых) усилий|в пару кликов|за считан(?:ые|ных) (?:минут|секунд)|проще простого/giu],
 ['противопоставление-клише', /это не просто [^.!?\n]{1,60}, (?:а|это)|больше,? чем просто|не просто [а-яё]+, а (?:настоящ|целый|полноценн)/giu],
 ['дежурный вывод', /в заключение|подводя итог|подытожим|резюмируя|таким образом, (?:можно|мы|ты|вы)|надеюсь, (?:эта|этот|данн)/giu],
 // A dash between digits is a numeric range and stays, the same rule as src/lib/plain-dashes.ts.
 ['длинное тире', /—|(?<!\d)–|–(?!\d)/gu],
]

const TEXT = new Set(['.md', '.json', '.ts', '.tsx', '.mjs', '.sql', '.html', '.txt'])
const SKIP = /(?:^|\/)(?:node_modules|dist|\.git|test-results|videos|Azelkhanov-master)(?:\/|$)/

function* walk(path) {
 const info = statSync(path)
 if (info.isFile()) { if (TEXT.has(extname(path))) yield path; return }
 for (const name of readdirSync(path)) {
  const child = join(path, name)
  if (!SKIP.test(child)) yield* walk(child)
 }
}

/** Comments are notes for developers, not copy: with `code` they are blanked, line numbers stay. */
const stripComments = text => text
 .replace(/\/\*[\s\S]*?\*\//g, block => block.replace(/[^\n]/g, ' '))
 .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (line, lead) => lead + ' '.repeat(line.length - lead.length))

export function scanText(source, {code = false} = {}) {
 const text = code ? stripComments(source) : source
 const hits = []
 const words = (text.match(/[а-яё]{2,}/giu) ?? []).length
 for (const [kind, pattern] of SLOP_MARKERS) for (const match of text.matchAll(pattern)) {
  const line = text.slice(0, match.index).split('\n').length
  const from = text.lastIndexOf('\n', match.index) + 1, to = text.indexOf('\n', match.index)
  hits.push({kind, phrase: match[0], line, context: text.slice(Math.max(from, match.index - 60), Math.min(to < 0 ? text.length : to, match.index + match[0].length + 60)).trim()})
 }
 return {words, hits}
}

export function scanPaths(paths, root = process.cwd()) {
 const files = []
 for (const path of paths) for (const file of walk(path)) {
  const {words, hits} = scanText(readFileSync(file, 'utf8'))
  if (words >= 20) files.push({file: relative(root, file), words, hits})
 }
 return files
}

if (import.meta.url === `file://${process.argv[1]}`) {
 const args = process.argv.slice(2), json = args.includes('--json')
 const max = Number(args.find(arg => arg.startsWith('--max='))?.slice(6) ?? Number.NaN)
 const paths = args.filter(arg => !arg.startsWith('--'))
 if (!paths.length) { console.error('Usage: node scripts/copy-slop.mjs [--json] [--max=N] <file-or-dir>...'); process.exit(2) }
 const files = scanPaths(paths), total = files.reduce((sum, file) => sum + file.hits.length, 0)
 if (json) console.log(JSON.stringify({total, files: files.filter(file => file.hits.length)}, null, 1))
 else {
  const byKind = new Map()
  for (const file of files) for (const hit of file.hits) byKind.set(hit.kind, (byKind.get(hit.kind) ?? 0) + 1)
  console.log(`Файлов с русским текстом: ${files.length}. Находок: ${total}.`)
  for (const [kind, count] of [...byKind].sort((a, b) => b[1] - a[1])) console.log(`  ${kind}: ${count}`)
  for (const file of files.filter(file => file.hits.length).sort((a, b) => b.hits.length - a.hits.length).slice(0, 40)) {
   console.log(`\n${file.file}: ${file.hits.length} на ${file.words} слов`)
   for (const hit of file.hits.slice(0, 6)) console.log(`  ${hit.line}: [${hit.kind}] ${hit.context.replace(/\s+/g, ' ').slice(0, 150)}`)
  }
 }
 if (Number.isFinite(max) && total > max) { console.error(`\nНаходок ${total}, допустимо ${max}.`); process.exit(1) }
}
