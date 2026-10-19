// Оригинальная музыка и UI-звуки для ролика. Без сторонних сэмплов: всё синтезируется здесь,
// поэтому права на звук целиком наши. Результат детерминирован (фиксированный seed).
// Запуск: npm run audio → public/audio/*.wav
//
// Музыка: спокойная электроника, 100 BPM, фа мажор, зимние колокольчики.
// Форма повторяет сцены ролика: вступление → пульс → игры (арпеджио) → после праздника (светлее)
// → настройки (половинный темп, спокойнее) → финал с разрешением на тонику.
import { mkdir, writeFile } from 'node:fs/promises';

const RATE = 44100;
const TAU = Math.PI * 2;
const BPM = 100;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

let seed = 20261214;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const out = new URL('../public/audio/', import.meta.url);
await mkdir(out, { recursive: true });

async function writeWav(name, left, right = left) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const l = Math.tanh(left[i] * 1.1);
    const r = Math.tanh(right[i] * 1.1);
    buf.writeInt16LE(Math.round(l * 32000), 44 + i * 4);
    buf.writeInt16LE(Math.round(r * 32000), 46 + i * 4);
  }
  await writeFile(new URL(name, out), buf);
  console.log(`${name}: ${(n / RATE).toFixed(2)} s`);
}

/** Колокольчик: FM-синтез с затухающим индексом модуляции. */
function bell(L, R, start, midi, gain, pan = 0, decay = 1.8) {
  const f = hz(midi);
  const s0 = Math.floor(start * RATE);
  const len = Math.floor(Math.min(4, decay * 2.2) * RATE);
  const gl = gain * (1 - pan) * 0.5 + gain * 0.5;
  const gr = gain * (1 + pan) * 0.5 + gain * 0.5;
  for (let i = 0; i < len && s0 + i < L.length; i++) {
    if (s0 + i < 0) continue;
    const t = i / RATE;
    const env = Math.exp(-t * (3 / decay)) * Math.min(1, t * 400);
    const index = 2.2 * Math.exp(-t * 6);
    const v = Math.sin(TAU * f * t + index * Math.sin(TAU * f * 3.5 * t)) * env + 0.25 * Math.sin(TAU * f * 2 * t) * env * Math.exp(-t * 4);
    L[s0 + i] += v * gl;
    R[s0 + i] += v * gr;
  }
}

function music() {
  const dur = 60;
  const n = dur * RATE;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  // Fmaj9 → Dm9 → B♭maj7 → C6/9, по два такта.
  const chords = [
    [41, 53, 57, 60, 64, 67],
    [38, 53, 57, 60, 62, 64],
    [34, 50, 53, 57, 60, 62],
    [36, 52, 55, 57, 62, 64],
  ];
  const chordLen = BAR * 2;
  const sec = (t) => (t < 5 ? 'intro' : t < 21 ? 'pulse' : t < 29 ? 'games' : t < 36 ? 'pulse' : t < 44 ? 'after' : t < 53 ? 'calm' : 'final');

  // Пэд и бас — посэмплово.
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const ci = Math.floor(t / chordLen) % chords.length;
    const finalChord = t >= 53 ? chords[0] : chords[ci];
    const q = t % chordLen;
    const env = Math.min(1, q / 0.5) * Math.min(1, (chordLen - q) / 0.6);
    const master = Math.min(1, t / 2.5) * Math.min(1, (dur - t) / 2.2);
    let l = 0;
    let r = 0;
    for (let k = 1; k < finalChord.length; k++) {
      const f = hz(finalChord[k]);
      const wob = 1 + 0.0025 * Math.sin(TAU * 0.13 * t + k);
      l += (Math.sin(TAU * f * 0.998 * wob * t) + 0.18 * Math.sin(TAU * f * 2 * t)) * 0.028;
      r += (Math.sin(TAU * f * 1.002 * wob * t) + 0.18 * Math.sin(TAU * f * 2 * t + 0.5)) * 0.028;
    }
    // бас: корень аккорда, «дышит» под бочку
    const s = sec(t);
    const beatPos = t % BEAT;
    const duck = s === 'intro' ? 1 : 0.55 + 0.45 * Math.min(1, beatPos / 0.25);
    const bassOn = s === 'intro' ? 0.4 : 1;
    const bass = Math.sin(TAU * hz(finalChord[0]) * t) * 0.12 * bassOn * env;
    L[i] += (l * env * duck + bass * duck) * master;
    R[i] += (r * env * duck + bass * duck) * master;
  }

  // Бочка, шейкер, колокольчики — событиями по сетке.
  const beats = Math.floor(dur / BEAT);
  for (let b = 0; b < beats; b++) {
    const t0 = b * BEAT;
    const s = sec(t0);
    const inBar = b % 4;
    const kick = (s === 'pulse' || s === 'games' || s === 'final') ? inBar === 0 || inBar === 2 : s === 'after' ? (t0 > 39 && (inBar === 0 || inBar === 2)) : s === 'calm' ? inBar === 0 : false;
    if (kick && t0 < 58) {
      const s0 = Math.floor(t0 * RATE);
      for (let i = 0; i < 0.35 * RATE; i++) {
        const t = i / RATE;
        const f = 45 + 75 * Math.exp(-t * 28);
        const v = Math.sin(TAU * (45 * t + (75 * (1 - Math.exp(-t * 28))) / 28)) * Math.exp(-t * 9) * 0.3;
        L[s0 + i] += v;
        R[s0 + i] += v;
        void f;
      }
    }
    // шейкер восьмыми
    if (s !== 'intro' && s !== 'calm' && t0 < 58) {
      for (const off of [0, BEAT / 2]) {
        const s0 = Math.floor((t0 + off) * RATE);
        let prev = 0;
        const g = off ? 0.035 : 0.02;
        for (let i = 0; i < 0.06 * RATE; i++) {
          const x = rand() * 2 - 1;
          const hp = x - prev;
          prev = x;
          const v = hp * Math.exp(-(i / RATE) * 70) * g;
          L[s0 + i] += v * 0.8;
          R[s0 + i] += v;
        }
      }
    }
  }

  // колокольчики: пентатоника фа мажора
  const penta = [65, 67, 69, 72, 74, 77, 79, 81, 84];
  for (let b = 0; b < beats * 2; b++) {
    const t0 = b * (BEAT / 2);
    if (t0 > 57) break;
    const s = sec(t0);
    const density = s === 'intro' ? 0.18 : s === 'games' ? 0.62 : s === 'after' ? 0.42 : s === 'calm' ? 0.16 : s === 'final' ? 0.3 : 0.26;
    if (rand() < density) {
      const note = penta[Math.floor(rand() * penta.length)] + (s === 'after' ? 0 : 0);
      bell(L, R, t0 + (rand() - 0.5) * 0.01, note, 0.05 + rand() * 0.03, rand() * 1.6 - 0.8, 1.6 + rand());
    }
  }
  // финал: разрешение на тонику
  [65, 69, 72, 77].forEach((m, i) => bell(L, R, 55.2 + i * 0.12, m, 0.07, (i - 1.5) * 0.4, 2.6));
  return [L, R];
}

function tap() {
  const n = Math.floor(0.14 * RATE);
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = 900 + 600 * Math.exp(-t * 60);
    a[i] = Math.sin(TAU * f * t) * Math.exp(-t * 48) * 0.45 + (rand() * 2 - 1) * Math.exp(-t * 400) * 0.05;
  }
  return [a, a];
}

function gift() {
  const n = Math.floor(2.4 * RATE);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  // тёплая подложка: мягкий аккорд с атакой
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / 0.12) * Math.exp(-t * 1.6);
    let v = 0;
    for (const m of [53, 57, 60, 65]) v += Math.sin(TAU * hz(m) * t) * 0.07;
    L[i] += v * env;
    R[i] += v * env;
  }
  [72, 77, 81, 84, 89].forEach((m, i) => bell(L, R, 0.03 + i * 0.07, m, 0.16 - i * 0.015, (i - 2) * 0.35, 1.4));
  // искристый шум сверху
  let prev = 0;
  for (let i = 0; i < 0.9 * RATE; i++) {
    const t = i / RATE;
    const x = rand() * 2 - 1;
    const hp = x - prev;
    prev = x;
    const v = hp * Math.min(1, t / 0.05) * Math.exp(-t * 5) * 0.03;
    L[i] += v;
    R[i] -= v;
  }
  return [L, R];
}

function reward() {
  const n = Math.floor(1.6 * RATE);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  bell(L, R, 0, 84, 0.2, -0.2, 1.2);
  bell(L, R, 0.11, 89, 0.2, 0.2, 1.4);
  return [L, R];
}

function whoosh() {
  const n = Math.floor(0.8 * RATE);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  let lp = 0;
  let lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const k = 0.02 + 0.25 * Math.sin(Math.PI * Math.min(1, t / 0.8));
    const x = rand() * 2 - 1;
    lp += (x - lp) * k;
    lp2 += (lp - lp2) * k;
    const env = Math.sin(Math.PI * Math.min(1, t / 0.8)) ** 2;
    L[i] = lp2 * env * 0.5 * (1 - t);
    R[i] = lp2 * env * 0.5 * t;
  }
  return [L, R];
}

function brand() {
  const n = Math.floor(2 * RATE);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / 0.4) * Math.exp(-t * 1.8);
    let v = 0;
    for (const m of [57, 64, 69]) v += Math.sin(TAU * hz(m) * t) * 0.05;
    L[i] += v * env;
    R[i] += v * env;
  }
  [81, 84, 88].forEach((m, i) => bell(L, R, 0.05 + i * 0.1, m, 0.12, (i - 1) * 0.5, 1.6));
  return [L, R];
}

await writeWav('music.wav', ...music());
await writeWav('tap.wav', ...tap());
await writeWav('gift.wav', ...gift());
await writeWav('reward.wav', ...reward());
await writeWav('whoosh.wav', ...whoosh());
await writeWav('brand.wav', ...brand());
