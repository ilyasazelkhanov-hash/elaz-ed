// Original, deterministic music and UI effects. No external samples.
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const directory = new URL('../public/audio/', import.meta.url);
await mkdir(directory, {recursive: true});
const rate = 22050;
const tau = Math.PI * 2;
const note = (midi) => 440 * 2 ** ((midi - 69) / 12);
const wav = async (name, seconds, sample) => {
  const count = Math.round(seconds * rate);
  const bytes = Buffer.alloc(44 + count * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + count * 2, 4);
  bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    bytes.writeInt16LE(Math.round(Math.max(-0.95, Math.min(0.95, sample(i / rate, i))) * 32767), 44 + i * 2);
  }
  await writeFile(new URL(name, directory), bytes);
};
const bell = (t, midi, decay = 2) => (Math.sin(tau * note(midi) * t) + 0.27 * Math.sin(tau * note(midi) * 2 * t)) * Math.exp(-t * decay) * Math.min(1, t * 70);
const chords = [[55, 58, 62, 65], [51, 55, 58, 62], [46, 50, 53, 57], [53, 57, 60, 64]];
const beat = 0.6;
let noiseSeed = 2171;
let lastNoise = 0;
await wav('winter-orbit.wav', 60, (t) => {
  const chordTime = 8 * beat;
  const chord = chords[Math.floor(t / chordTime) % chords.length];
  const q = t % chordTime;
  const envelope = Math.min(1, q / 0.7) * Math.min(1, (chordTime - q) / 1.1);
  let value = chord.reduce((sum, n) => sum + Math.sin(tau * note(n) * t) * 0.033 + Math.sin(tau * note(n) * 1.002 * t) * 0.011, 0) * envelope;
  const tick = t % beat;
  value += Math.sin(tau * (48 * tick + 28 * (1 - Math.exp(-20 * tick)) / 20)) * Math.exp(-tick * 23) * 0.12;
  const pulse = t % (beat / 2);
  noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
  const noise = noiseSeed / 4294967296 * 2 - 1;
  value += (noise - lastNoise) * Math.exp(-pulse * 75) * 0.009;
  lastNoise = noise;
  const pluck = t % (beat * 2);
  const index = Math.floor(t / (beat * 2)) % 4;
  value += bell(pluck, chord[index] + 12, 2.9) * 0.08;
  const seasonal = t % (beat * 8);
  value += bell(seasonal, chord[2] + 24, 2.5) * 0.025;
  return value * Math.min(1, t / 1.2) * Math.min(1, (60 - t) / 2.6);
});
await wav('tap.wav', 0.16, (t) => Math.sin(tau * (920 + 350 * Math.exp(-30 * t)) * t) * Math.exp(-t * 40) * 0.18);
await wav('reward.wav', 1.4, (t) => [67, 71, 74, 79].reduce((v, n, i) => t >= i * 0.08 ? v + bell(t - i * 0.08, n, 3.2) * 0.13 : v, 0));
await wav('open.wav', 1.2, (t) => Math.sin(tau * (170 * t + 290 * t * t)) * Math.sin(Math.PI * Math.min(1, t / 1.2)) * 0.12 + bell(t, 79, 2) * 0.09);
console.log('Created original 60-second winter soundtrack and three UI effects.');
