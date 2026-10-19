// Общая раскладка кадра, цвета сцены и помощники анимации.
import { Easing, interpolate, spring } from 'remotion';

/** Цвета ролика (не приложения): зимняя ночь, холодный голубой, тёплое золото, молочный текст. */
export const C = {
  night: '#071630',
  night2: '#0B2550',
  deep: '#040D1F',
  ice: '#8FD3FF',
  iceSoft: '#CDEBFF',
  gold: '#FFD166',
  goldDeep: '#E9A93B',
  milk: '#F7F2E8',
  milkMute: 'rgba(247, 242, 232, 0.72)',
  line: 'rgba(205, 235, 255, 0.14)',
  aurora: 'linear-gradient(120deg, #7c6bff 0%, #b26bff 50%, #ff85c0 100%)',
  auroraText: 'linear-gradient(100deg, #b9a8ff 0%, #ff9fd0 55%, #ffc79e 100%)',
};

export const FONT = {
  text: '"Onest", system-ui, sans-serif',
  accent: '"Unbounded", system-ui, sans-serif',
};

/** Безопасная зона: 80 по бокам, 160 сверху, 260 снизу. */
export const SAFE = { side: 80, top: 160, bottom: 260 };

/** Окно приложения — одно и то же во всех сценах, поэтому смена сцен читается как смена экрана. */
export const APP = { x: 90, y: 520, w: 900, h: 1120, radius: 64 };

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** interpolate с зажатыми краями и мягким выходом по умолчанию. */
export const ease = (
  frame: number,
  input: [number, number],
  output: [number, number] = [0, 1],
  easing: (t: number) => number = Easing.bezier(0.22, 1, 0.36, 1),
) => interpolate(frame, input, output, { ...clamp, easing });

/** Пружина с задержкой. Спокойная по умолчанию: B2B, не аркада. */
export const pop = (
  frame: number,
  fps: number,
  delay = 0,
  config: { damping?: number; stiffness?: number; mass?: number } = {},
) =>
  spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.9, ...config },
  });

/** Последовательные шаги сцены: где мы между a и b (0…1). */
export const step = (frame: number, a: number, b: number) => ease(frame, [a, b]);

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Смешение двух hex-цветов — для перекраски интерфейса. */
export const mixColor = (from: string, to: string, t: number) => {
  const p = (h: string) => {
    const v = h.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  };
  const a = p(from);
  const b = p(to);
  const c = a.map((x, i) => Math.round(mix(x, b[i], Math.max(0, Math.min(1, t)))));
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
};

export const alpha = (hex: string, a: number) => {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
