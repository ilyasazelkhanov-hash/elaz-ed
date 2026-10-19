import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const INPUT = path.join(ROOT, 'content/ai-academy/reference/AI_Academy_Codex_Curriculum_Seed_2026.json');
export const OUTPUT = path.join(ROOT, 'content/ai-academy/catalog.normalized.json');
export function sqlActor(value) {
  check(typeof value === 'string' && /^[1-9]\d*$/.test(value) && BigInt(value) <= 9223372036854775807n, '--sql requires a positive bigint Telegram ID --actor');
  return `'${value}'::bigint`;
}
const FORMATS = new Set(['microlecture', 'guided_demo', 'hands_on_lab', 'knowledge_check', 'case_review', 'live_workshop', 'assignment', 'project_defense', 'resource']);
const EXPECTED = { directions: 9, courses: 28, modules: 112, lessons: 448, sources: 147, lesson_source_links: 1222 };
function check(condition, message) { if (!condition) throw new Error(message); }
export function seconds(value) {
  if (typeof value === 'number') { check(Number.isInteger(value) && value >= 0, 'Invalid timestamp'); return value; }
  check(typeof value === 'string' && /^\d+(?::[0-5]\d){1,2}$/.test(value), 'Invalid timestamp');
  return value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}
export function canonicalURL(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid source URL'); }
  check(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, 'Unsafe source URL or credentials');
  check(![...url.searchParams.keys()].some(key => /^(api[_-]?key|token|access_token|password|secret|authorization)$/i.test(key)), 'Secret credentials in source URL');
  url.hash = '';
  if (['youtu.be', 'www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname)) {
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
    check(id && /^[\w-]{11}$/.test(id), 'Invalid YouTube URL');
    return `https://www.youtube.com/watch?v=${id}`;
  }
  for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.href;
}
export function validatePrerequisites(prerequisites, entities) {
  const courses = new Set(entities.filter(x => x.kind === 'course').map(x => x.code));
  const edges = new Map(); const keys = new Set();
  for (const edge of prerequisites) {
    check(courses.has(edge.course_code) && courses.has(edge.requires_code), 'Missing prerequisite course');
    const key = `${edge.course_code}:${edge.requires_code}`;
    check(!keys.has(key), 'Duplicate prerequisite'); keys.add(key);
    edges.set(edge.course_code, [...(edges.get(edge.course_code) || []), edge.requires_code]);
  }
  const active = new Set(), done = new Set();
  function visit(code) { check(!active.has(code), 'Prerequisite cycle'); if (done.has(code)) return; active.add(code); for (const next of edges.get(code) || []) visit(next); active.delete(code); done.add(code); }
  for (const code of courses) visit(code);
}
export function validateCatalog(catalog) {
  const map = new Map(), positions = new Set();
  for (const entity of catalog.entities) {
    check(['direction', 'course', 'module', 'lesson', 'source', 'skill', 'assessment', 'rubric'].includes(entity.kind), 'Invalid entity kind');
    check(typeof entity.code === 'string' && entity.code.length > 0 && !map.has(entity.code), 'Duplicate or invalid entity code'); map.set(entity.code, entity);
    check(entity.state === 'outline' && entity.seed_managed === true && entity.version === 1, 'Seed must remain managed outline');
    check(Number.isInteger(entity.position) && entity.position >= 0, 'Invalid position');
    const positionKey = JSON.stringify([entity.parent_code, entity.kind, entity.position]);
    check(!positions.has(positionKey), 'Duplicate sibling position'); positions.add(positionKey);
    check(typeof entity.title === 'string' && entity.title.trim(), 'Missing entity title');
  }
  const parentKind = { course: 'direction', module: 'course', lesson: 'module' };
  for (const entity of catalog.entities) {
    if (parentKind[entity.kind] && entity.code !== 'CORE-000') check(map.get(entity.parent_code)?.kind === parentKind[entity.kind], `Missing parent for ${entity.code}`);
    if (entity.kind === 'course') {
      const level = entity.code === 'CORE-000' ? 'Core' : { '101': 'Junior', '201': 'Middle', '301': 'Senior' }[entity.code.split('-').at(-1)];
      check(level && entity.data.level === level, 'Invalid course level');
      if (entity.code === 'CORE-000') check(entity.parent_code === null, 'CORE must be a root course');
    }
    if (entity.kind === 'lesson') {
      check(FORMATS.has(entity.data.format), 'Invalid lesson format');
      check(Number.isFinite(entity.data.minutes) && entity.data.minutes > 0, 'Invalid lesson duration');
      check(Array.isArray(entity.data.content_blocks) && entity.data.content_blocks.length === 0, 'Seed cannot invent lesson content');
    }
    if (entity.kind === 'source') {
      check(entity.data.canonical_url === canonicalURL(entity.data.original_url), 'Source canonical URL mismatch');
      for (const chapter of entity.data.chapters || []) {
        check(seconds(chapter.start_seconds) === chapter.start_seconds, 'Invalid chapter timestamp');
        if (chapter.time) check(seconds(chapter.time) === chapter.start_seconds, 'Chapter timestamp mismatch');
      }
    }
  }
  const keys = new Set();
  for (const link of catalog.links) {
    check(map.get(link.source_code)?.kind === 'source' && ['lesson', 'module', 'course'].includes(map.get(link.target_code)?.kind), 'Missing source link reference');
    check(link.visibility === 'internal' && link.usage === 'methodological', 'Unverified source link visibility');
    if (link.start_seconds !== undefined) seconds(link.start_seconds);
    if (link.end_seconds !== undefined) check(seconds(link.end_seconds) > (link.start_seconds || 0), 'Invalid source segment end');
    const key = JSON.stringify([link.source_code, link.target_code, link.start_seconds ?? null, link.end_seconds ?? null]);
    check(!keys.has(key), 'Duplicate source link'); keys.add(key);
  }
  validatePrerequisites(catalog.prerequisites, catalog.entities);
  return catalog;
}
export function normalizeSeed(seed, { strictCounts = true } = {}) {
  for (const [key, count] of Object.entries(EXPECTED)) {
    check(Array.isArray(seed[key]), `Missing seed array ${key}`);
    if (strictCounts) check(seed[key].length === count, `Unexpected ${key} count: expected ${count}`);
  }
  const seen = new Set();
  for (const row of [...seed.directions, ...seed.courses, ...seed.modules, ...seed.lessons, ...seed.sources]) {
    check(typeof row.id === 'string' && !seen.has(row.id), 'Duplicate or invalid seed code'); seen.add(row.id);
  }
  const entities = [], linksByKey = new Map(), aliases = {};
  const rawData = row => Object.fromEntries(Object.entries(row).filter(([key]) => !['id', 'title', 'name', 'order', 'course', 'module', 'refs'].includes(key)));
  function entity(row, kind, parent = null, position = 0, extra = {}) {
    const result = { code: row.id, kind, parent_code: parent, title: row.title || row.name, position: row.order ?? position, state: 'outline', version: 1, data: { ...rawData(row), ...extra }, seed_managed: true };
    entities.push(result); return result;
  }
  seed.directions.forEach((row, i) => entity(row, 'direction', null, i + 1));
  seed.courses.forEach((row, i) => {
    const direction = seed.directions.find(d => d.id === row.direction || d.name === row.direction);
    check(row.id === 'CORE-000' || direction, `Missing direction for ${row.id}`);
    entity(row, 'course', direction?.id || null, i + 1);
  });
  seed.modules.forEach(row => entity(row, 'module', row.course));
  seed.lessons.forEach(row => {
    check(seed.modules.find(m => m.id === row.module)?.course === row.course, 'Lesson course/module mismatch');
    entity(row, 'lesson', row.module, 0, { content_blocks: [], required: true });
  });
  const byURL = new Map();
  for (const row of [...seed.sources].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    const url = canonicalURL(row.url);
    const chapters = (row.chapters || []).map(chapter => {
      const start = seconds(chapter.seconds ?? chapter.start_seconds ?? chapter.time);
      if (chapter.time) check(seconds(chapter.time) === start, 'Chapter timestamp mismatch');
      return { ...chapter, start_seconds: start };
    });
    if (byURL.has(url)) {
      const source = byURL.get(url); aliases[row.id] = source.code;
      source.data.aliases.push(row.id); source.data.original_records.push(row);
      for (const chapter of chapters) if (!source.data.chapters.some(c => c.start_seconds === chapter.start_seconds && c.topic === chapter.topic)) source.data.chapters.push(chapter);
    } else {
      const source = entity(row, 'source', null, byURL.size + 1, { url, canonical_url: url, original_url: row.url, original_status: row.status, original_rights: row.rights, status: 'unchecked', rights: 'reference_only', rights_state: 'reference_only', link_state: 'unchecked', visibility: 'internal', chapters, aliases: [], original_records: [row] });
      byURL.set(url, source); aliases[row.id] = row.id;
    }
  }
  function link(sourceId, target, ref = {}) {
    const sourceCode = aliases[sourceId]; check(sourceCode, `Missing source ${sourceId}`);
    const record = { source_code: sourceCode, target_code: target, usage: 'methodological', visibility: 'internal' };
    const start = ref.start_seconds ?? ref.seconds ?? ref.time;
    if (start !== undefined) record.start_seconds = seconds(start);
    if (ref.end_seconds !== undefined) record.end_seconds = seconds(ref.end_seconds);
    if (ref.note) record.note = ref.note;
    const key = JSON.stringify([sourceCode, target, record.start_seconds ?? null, record.end_seconds ?? null]);
    const old = linksByKey.get(key);
    if (!old) linksByKey.set(key, record);
    else if (record.note && !old.note?.includes(record.note)) old.note = [old.note, record.note].filter(Boolean).join('\n');
  }
  // Retain explicit link notes before merging the inherited refs.
  seed.lesson_source_links.forEach(row => link(row.source_id, row.lesson_id, row));
  for (const row of [...seed.courses, ...seed.modules, ...seed.lessons]) for (const ref of row.refs || []) link(typeof ref === 'string' ? ref : ref.source_id || ref.id, row.id, typeof ref === 'object' ? ref : {});
  const prerequisites = [];
  for (const direction of seed.directions) {
    for (const [suffix, prior] of [['101', 'CORE-000'], ['201', `${direction.id}-101`], ['301', `${direction.id}-201`]]) prerequisites.push({ course_code: `${direction.id}-${suffix}`, requires_code: prior });
  }
  const links = [...linksByKey.values()];
  const report = { original_counts: Object.fromEntries(Object.keys(EXPECTED).map(key => [key, seed[key].length])), normalized_counts: { entities: entities.length, sources: byURL.size, links: links.length, prerequisites: prerequisites.length }, source_aliases: aliases, chapter_count: entities.filter(e => e.kind === 'source').reduce((n, e) => n + e.data.chapters.length, 0), warnings: ['All learning content is outline; lesson bodies and assessments require authoring.', 'External rights, availability, attribution and chapter relevance require editorial verification.'] };
  return validateCatalog({ version: seed.spec_version || '1.0.0', entities, links, prerequisites, report });
}
export async function main(args = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--write', '--dry-run'].includes(arg)) options[arg] = true;
    else if (['--input', '--payload', '--sql', '--actor'].includes(arg)) { check(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value for ${arg}`); options[arg] = args[++i]; }
    else throw new Error(`Unknown argument ${arg}`);
  }
  check(!(options['--write'] && options['--dry-run']), 'Choose --write or --dry-run');
  const catalog = normalizeSeed(JSON.parse(await readFile(options['--input'] || INPUT, 'utf8')));
  const payload = { entities: catalog.entities, links: catalog.links, prerequisites: catalog.prerequisites, dry_run: !options['--write'] };
  if (options['--sql']) {
    const actor = sqlActor(options['--actor']);
    const literal = JSON.stringify(payload).replaceAll("'", "''");
    await writeFile(options['--sql'], `begin;\nselect public.academy_action(${actor}, 'admin_import', '${literal}'::jsonb);\ncommit;\n`);
  }
  if (options['--write']) await writeFile(OUTPUT, `${JSON.stringify(catalog, null, 2)}\n`);
  if (options['--payload']) await writeFile(options['--payload'], `${JSON.stringify(payload, null, 2)}\n`);
  const { source_aliases, ...summary } = catalog.report;
  console.log(JSON.stringify({ mode: options['--write'] ? 'write' : 'dry-run', ...summary }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(`Academy seed: ${error.message}`); process.exitCode = 1; });
