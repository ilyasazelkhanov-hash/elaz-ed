import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { canonicalURL, INPUT, main, normalizeSeed, seconds, sqlActor, validateCatalog, validatePrerequisites } from '../scripts/academy-seed.mjs';

const original = JSON.parse(await readFile(INPUT, 'utf8'));
const copy = () => structuredClone(original);
test('full supplied seed produces a deterministic unpublished curriculum', () => {
  const catalog = normalizeSeed(copy());
  assert.deepEqual(catalog, normalizeSeed(copy()));
  for (const [kind, count] of [['direction', 9], ['course', 28], ['module', 112], ['lesson', 448]]) assert.equal(catalog.entities.filter(e => e.kind === kind).length, count);
  assert.equal(catalog.report.original_counts.lesson_source_links, 1222);
  assert.equal(catalog.report.original_counts.sources, 147);
  assert.equal(catalog.prerequisites.length, 27);
  assert.ok(catalog.entities.every(e => e.state === 'outline' && e.seed_managed));
  assert.ok(catalog.entities.filter(e => e.kind === 'lesson').every(e => e.data.content_blocks.length === 0 && e.data.required));
  assert.ok(catalog.links.every(l => l.visibility === 'internal' && l.usage === 'methodological'));
  const source = catalog.entities.find(e => e.code === 'U01');
  assert.equal(source.data.original_rights, 'link_only');
  assert.equal(source.data.rights, 'reference_only');
  assert.equal(source.data.rights_state, 'reference_only');
  assert.equal(source.data.link_state, 'unchecked');
  assert.equal(source.data.chapters[2].start_seconds, 5637);
  assert.equal(source.data.chapters[2].time, '01:33:57');
});
test('SQL export uses validated positive bigint Telegram IDs and defaults to dry run', async () => {
  assert.equal(sqlActor('123456789'), "'123456789'::bigint");
  assert.equal(sqlActor('9223372036854775807'), "'9223372036854775807'::bigint");
  for (const actor of [undefined, '-1', '0', '1.2', '1;drop table users', "1'", '9223372036854775808']) assert.throws(() => sqlActor(actor), /positive bigint/);
  const directory = await mkdtemp(path.join(tmpdir(), 'academy-seed-test-'));
  try {
    const destination = path.join(directory, 'import.sql');
    await main(['--sql', destination, '--actor', '123456789']);
    const sql = await readFile(destination, 'utf8');
    const catalog = normalizeSeed(copy());
    const payload = { entities: catalog.entities, links: catalog.links, prerequisites: catalog.prerequisites, dry_run: true };
    assert.equal(sql, `begin;\nselect public.academy_action('123456789'::bigint, 'admin_import', '${JSON.stringify(payload).replaceAll("'", "''")}'::jsonb);\ncommit;\n`);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('rejects duplicate codes, missing parents, changed counts and invalid formats', () => {
  let seed = copy(); seed.sources[0].id = seed.sources[1].id; assert.throws(() => normalizeSeed(seed), /Duplicate/);
  seed = copy(); seed.modules[0].course = 'UNKNOWN'; assert.throws(() => normalizeSeed(seed), /mismatch|Missing parent/);
  seed = copy(); seed.lessons.pop(); assert.throws(() => normalizeSeed(seed), /count/);
  seed = copy(); seed.lessons[0].format = 'invented'; assert.throws(() => normalizeSeed(seed), /format/);
  seed = copy(); seed.courses[1].level = 'Graduate'; assert.throws(() => normalizeSeed(seed), /level/);
  seed = copy(); seed.directions[1].order = seed.directions[0].order; assert.throws(() => normalizeSeed(seed), /sibling position/);
});
test('validates prerequisite references and detects cycles', () => {
  const catalog = normalizeSeed(copy());
  assert.throws(() => validatePrerequisites([...catalog.prerequisites, { course_code: 'CORE-000', requires_code: 'VC-301' }], catalog.entities), /cycle/);
  assert.throws(() => validatePrerequisites([{ course_code: 'VC-101', requires_code: 'MISSING' }], catalog.entities), /Missing prerequisite/);
});
test('canonicalizes repeated URLs preserving originals and all alias references', () => {
  const seed = copy(); seed.sources[1].url = seed.sources[0].url + '?utm_source=test';
  const catalog = normalizeSeed(seed);
  assert.equal(catalog.report.normalized_counts.sources, 146);
  const source = catalog.entities.find(e => e.code === 'A01');
  assert.deepEqual(source.data.aliases, ['A02']);
  assert.equal(source.data.original_records[1].url, seed.sources[1].url);
  assert.equal(catalog.report.source_aliases.A02, 'A01');
  assert.ok(!catalog.links.some(l => l.source_code === 'A02'));
  assert.equal(catalog.report.original_counts.lesson_source_links, 1222);
});
test('rejects unsafe URLs and credentials without exposing their values', () => {
  for (const url of ['javascript:alert(1)', 'file:///tmp/test', 'https://user:secret@example.com/', 'https://example.com/?api_key=secret', 'https://example.com/?access_token=secret']) assert.throws(() => canonicalURL(url), /Unsafe|Secret/);
  assert.equal(canonicalURL('https://youtu.be/-q5VabXMWfk?t=304'), 'https://www.youtube.com/watch?v=-q5VabXMWfk');
});
test('validates temporal refs and preserves explicit objects', () => {
  assert.equal(seconds('01:33:57'), 5637);
  assert.throws(() => seconds('01:99'), /timestamp/);
  const seed = copy(); seed.lessons[0].refs.push({ source_id: 'U01', start_seconds: 304, end_seconds: 400, note: 'User supplied segment' });
  const catalog = normalizeSeed(seed);
  assert.ok(catalog.links.some(l => l.target_code === seed.lessons[0].id && l.start_seconds === 304 && l.end_seconds === 400));
  const link = catalog.links.find(l => l.start_seconds === 304); link.end_seconds = 200;
  assert.throws(() => validateCatalog(catalog), /segment end/);
  seed.sources.find(s => s.id === 'U01').chapters[0].seconds = -1;
  assert.throws(() => normalizeSeed(seed), /timestamp/);
});
