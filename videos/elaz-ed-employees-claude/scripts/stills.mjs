// Проверка ролика без экспорта MP4:
//  1) прогоняет все кадры композиции в уменьшенном виде (ловит ошибки рендера в любом кадре);
//  2) сохраняет контрольные кадры — начало, середина и конец каждой сцены — в полном размере;
//  3) собирает обзорный лист (contact sheet) из уменьшенных кадров.
// Запуск: npm run stills → out/check/
import { bundle } from '@remotion/bundler';
import { renderFrames, renderStill, selectComposition } from '@remotion/renderer';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'out', 'check');
await mkdir(path.join(outDir, 'all'), { recursive: true });
await mkdir(path.join(outDir, 'keys'), { recursive: true });

const only = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));

console.log('Бандл…');
const serveUrl = await bundle({ entryPoint: path.join(root, 'src', 'index.ts'), publicDir: path.join(root, 'public') });
const composition = await selectComposition({ serveUrl, id: 'ElazEdEmployeesDemo' });
console.log(`${composition.id}: ${composition.durationInFrames} кадров, ${composition.width}×${composition.height}, ${composition.fps} fps`);

// Сцены и их границы — из того же таймлайна, что и ролик.
const scenes = [
  ['hook', 150], ['advent', 210], ['quiz', 270], ['games', 240],
  ['event', 210], ['after', 240], ['customize', 270], ['final', 210],
];
let from = 0;
const keys = [];
for (const [id, d] of scenes) {
  keys.push([`${id}-start`, from + 12], [`${id}-mid`, from + Math.round(d / 2)], [`${id}-end`, from + d - 4]);
  from += d;
}

const frames = only.length ? only.map((f) => [`frame-${f}`, f]) : keys;
for (const [name, frame] of frames) {
  await renderStill({ composition, serveUrl, frame, output: path.join(outDir, 'keys', `${String(frame).padStart(4, '0')}-${name}.png`) });
  console.log(`кадр ${frame} (${name})`);
}

if (!only.length) {
  console.log('Все кадры, уменьшенно…');
  let errors = 0;
  await renderFrames({
    composition,
    serveUrl,
    imageFormat: 'jpeg',
    jpegQuality: 70,
    scale: 0.25,
    outputDir: path.join(outDir, 'all'),
    concurrency: 4,
    onStart: ({ frameCount }) => console.log(`рендер ${frameCount} кадров`),
    onFrameUpdate: (done) => {
      if (done % 300 === 0) console.log(`  ${done}`);
    },
    onBrowserLog: (log) => {
      if (log.type === 'error') {
        errors++;
        console.log('ошибка в браузере:', log.text);
      }
    },
  });
  const files = (await readdir(path.join(outDir, 'all'))).filter((f) => f.endsWith('.jpeg'));
  console.log(`готово: ${files.length} кадров, ошибок в консоли: ${errors}`);

  // Обзорный лист: каждый 15-й кадр (полсекунды), 12 в ряд.
  const pick = files.sort().filter((_, i) => i % 15 === 0);
  const html = `<!doctype html><meta charset="utf-8"><title>ElazEdEmployeesDemo — обзор</title>
<style>body{background:#111;color:#ccc;font:14px system-ui;margin:16px}div{display:grid;grid-template-columns:repeat(12,1fr);gap:6px}figure{margin:0}img{width:100%;display:block}figcaption{font-size:11px;text-align:center}</style>
<h3>Каждые 0,5 с · ${files.length} кадров</h3><div>${pick
    .map((f, i) => `<figure><img src="all/${f}"><figcaption>${(i * 0.5).toFixed(1)} с</figcaption></figure>`)
    .join('')}</div>`;
  await writeFile(path.join(outDir, 'sheet.html'), html);
}
