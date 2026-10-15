// Лист контрольных кадров: 8 сцен × (начало, середина, конец) → out/check/keys-sheet.png.
// Скриншот делает Chrome Headless Shell, который Remotion уже скачал для рендера.
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'out', 'check');
const files = readdirSync(path.join(dir, 'keys')).filter((f) => f.endsWith('.png')).sort();
const names = { hook: 'Хук', advent: 'Адвент', quiz: 'Квиз', games: 'Игры', event: 'Событие', after: 'После НГ', customize: 'Настройки', final: 'Финал' };
const cols = Object.keys(names);
const cell = (f) => {
  const [frame] = f.split('-');
  const sec = (Number(frame) / 30).toFixed(1);
  return `<figure><img src="keys/${f}"><figcaption>${sec} с · кадр ${Number(frame)}</figcaption></figure>`;
};
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0b0f1a;color:#cfd8ea;font:600 15px system-ui;padding:18px}
.grid{display:grid;grid-template-columns:repeat(8,200px);gap:10px}
h4{margin:0 0 6px;font-size:16px;color:#ffd166;text-align:center}
figure{margin:0 0 8px}img{width:200px;display:block;border-radius:8px}figcaption{font-size:12px;text-align:center;margin-top:4px;color:#8ea3bc}
</style><div class="grid">${cols
  .map((c) => `<div><h4>${names[c]}</h4>${files.filter((f) => f.includes(`-${c}-`)).map(cell).join('')}</div>`)
  .join('')}</div>`;
const page = path.join(dir, 'keys-sheet.html');
writeFileSync(page, html);
const chrome = path.join(root, 'node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');
execFileSync(chrome, ['--headless', '--disable-gpu', '--hide-scrollbars', `--screenshot=${path.join(dir, 'keys-sheet.png')}`, '--window-size=1716,1180', '--virtual-time-budget=4000', pathToFileURL(page).href], { stdio: 'inherit' });
console.log('out/check/keys-sheet.png');
