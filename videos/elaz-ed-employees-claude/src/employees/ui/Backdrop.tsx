// Общий фон ролика: зимняя ночь, мягкое сияние и снег в три слоя.
// Снег привязан к абсолютному кадру и фиксированным seed — каждый рендер одинаковый.
import React from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { sceneEnd, sceneStart, HEIGHT, WIDTH } from '../timeline';
import { C, ease } from '../style';

type Layer = { count: number; size: [number, number]; speed: [number, number]; blur: number; opacity: number; sway: number };

const LAYERS: Layer[] = [
  { count: 90, size: [2, 4], speed: [0.9, 1.6], blur: 0, opacity: 0.55, sway: 14 },
  { count: 46, size: [5, 8], speed: [2, 3.2], blur: 0.6, opacity: 0.75, sway: 26 },
  { count: 14, size: [12, 20], speed: [4.2, 6], blur: 4, opacity: 0.5, sway: 40 },
];

/** Сколько снега в кадре: полный в праздничной части, растворяется после Нового года, чуть возвращается в финале. */
export const snowLevel = (frame: number) => {
  const afterStart = sceneStart('after');
  const finalStart = sceneStart('final');
  const melt = ease(frame, [afterStart + 10, afterStart + 80], [1, 0.08]);
  const back = ease(frame, [finalStart + 10, finalStart + 70], [0, 0.45]);
  return frame < finalStart ? melt : Math.max(0.08, back);
};

/** Тёплый свет из открытой двери — в адвенте и в финале. */
const warmth = (frame: number) => {
  const a = ease(frame, [sceneStart('advent'), sceneStart('advent') + 60], [0.25, 0.6]);
  const b = ease(frame, [sceneStart('after'), sceneStart('after') + 60], [0, -0.35]);
  const c = ease(frame, [sceneStart('final'), sceneEnd('final') - 60], [0, 0.35]);
  return Math.max(0.15, a + b + c);
};

export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const level = snowLevel(frame);
  const warm = warmth(frame);
  const drift = Math.sin(frame / 90) * 40;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.night} 0%, ${C.night2} 52%, ${C.deep} 100%)` }}>
      {/* холодное сияние сверху */}
      <div
        style={{
          position: 'absolute',
          left: -300 + drift,
          top: -420,
          width: 1300,
          height: 1100,
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(143, 211, 255, 0.28), rgba(143, 211, 255, 0) 70%)',
        }}
      />
      {/* тёплый свет снизу — как из открытой двери */}
      <div
        style={{
          position: 'absolute',
          left: 140 - drift,
          bottom: -520,
          width: 1100,
          height: 1000,
          borderRadius: '50%',
          opacity: warm,
          background: 'radial-gradient(closest-side, rgba(255, 209, 102, 0.42), rgba(255, 209, 102, 0) 72%)',
        }}
      />
      {/* мягкая дымка, чтобы фон не был плоским */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(120% 60% at 50% 40%, rgba(255,255,255,0.035), transparent 70%)',
        }}
      />
      <Snow level={level} frame={frame} />
    </AbsoluteFill>
  );
};

export const Snow: React.FC<{ level: number; frame: number; seed?: string }> = ({ level, frame, seed = 'snow' }) => {
  if (level <= 0.001) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {LAYERS.map((layer, li) =>
        Array.from({ length: layer.count }, (_, i) => {
          const key = `${seed}-${li}-${i}`;
          // Хлопья исчезают по одному, а не всем слоем сразу.
          if (random(`${key}-keep`) > level) return null;
          const size = layer.size[0] + random(`${key}-s`) * (layer.size[1] - layer.size[0]);
          const speed = layer.speed[0] + random(`${key}-v`) * (layer.speed[1] - layer.speed[0]);
          const span = HEIGHT + 80;
          const y = ((random(`${key}-y`) * span + frame * speed) % span) - 40;
          const x = random(`${key}-x`) * WIDTH + Math.sin(frame / (40 + random(`${key}-f`) * 50) + random(`${key}-p`) * 6.28) * layer.sway;
          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: size,
                height: size,
                borderRadius: '50%',
                background: C.milk,
                opacity: layer.opacity * (0.55 + random(`${key}-o`) * 0.45),
                filter: layer.blur ? `blur(${layer.blur}px)` : undefined,
              }}
            />
          );
        }),
      )}
    </AbsoluteFill>
  );
};
