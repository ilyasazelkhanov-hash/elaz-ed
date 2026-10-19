// Тонкая гирлянда: провод провисает дугами, лампочки мерцают каждая в своём ритме (seed по номеру).
import React from 'react';
import { random } from 'remotion';
import { C } from '../style';

export const Garland: React.FC<{
  width: number;
  frame: number;
  spans?: number;
  sag?: number;
  colors?: string[];
  reveal?: number;
  seed?: string;
}> = ({ width, frame, spans = 3, sag = 34, colors = [C.gold, C.iceSoft, C.gold, '#FFB37A'], reveal = 1, seed = 'garland' }) => {
  const seg = width / spans;
  let d = 'M 0 6';
  for (let i = 0; i < spans; i++) d += ` Q ${seg * i + seg / 2} ${6 + sag * 2} ${seg * (i + 1)} 6`;
  const perSpan = 6;
  const bulbs: { x: number; y: number; c: string; k: string }[] = [];
  for (let i = 0; i < spans; i++) {
    for (let j = 1; j < perSpan; j++) {
      const t = j / perSpan;
      const x = seg * i + seg * t;
      // точка на квадратичной кривой: y = 6 + 2·sag·2t(1−t)
      const y = 6 + sag * 2 * 2 * t * (1 - t);
      bulbs.push({ x, y, c: colors[(i * perSpan + j) % colors.length], k: `${seed}-${i}-${j}` });
    }
  }
  return (
    <svg width={width} height={sag * 2 + 40} style={{ overflow: 'visible', display: 'block' }}>
      <path d={d} stroke="rgba(247,242,232,0.35)" strokeWidth={2} fill="none" strokeDasharray={width * 1.4} strokeDashoffset={width * 1.4 * (1 - reveal)} />
      {bulbs.map((b, i) => {
        const shown = reveal >= b.x / width;
        if (!shown) return null;
        const tw = 0.55 + 0.45 * Math.sin(frame / (9 + random(`${b.k}-r`) * 8) + random(`${b.k}-p`) * 6.28);
        return (
          <g key={i} transform={`translate(${b.x} ${b.y + 4})`}>
            <circle r={18} fill={b.c} opacity={0.18 * tw} />
            <ellipse rx={5.5} ry={7.5} cy={4} fill={b.c} opacity={0.6 + 0.4 * tw} />
            <rect x={-3} y={-6} width={6} height={5} rx={1.5} fill="rgba(247,242,232,0.5)" />
          </g>
        );
      })}
    </svg>
  );
};
