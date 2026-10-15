// Матовая подарочная коробка. lid 0…1 — крышка поднимается и отлетает, glow — свет изнутри.
import React from 'react';
import { alpha, mixColor } from '../style';

export const GiftBox: React.FC<{
  size: number;
  body: string;
  ribbon: string;
  lid?: number;
  glow?: number;
  style?: React.CSSProperties;
}> = ({ size, body, ribbon, lid = 0, glow = 0, style }) => {
  const id = (body + ribbon).replace(/[^a-z0-9]/gi, '');
  const shade = mixColor(body, '#000000', 0.22);
  const light = mixColor(body, '#ffffff', 0.12);
  const lidY = -lid * 46;
  const lidR = -lid * 24;
  const lidX = lid * 18;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', ...style }}>
      <defs>
        <linearGradient id={`gb-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={shade} />
        </linearGradient>
        <radialGradient id={`gl-${id}`} cx="0.5" cy="1" r="0.8">
          <stop offset="0" stopColor="#FFF4D6" stopOpacity={1} />
          <stop offset="0.5" stopColor="#FFD166" stopOpacity={0.6} />
          <stop offset="1" stopColor="#FFD166" stopOpacity={0} />
        </radialGradient>
      </defs>
      {glow > 0 && (
        <>
          <ellipse cx={50} cy={42} rx={60 + glow * 30} ry={46 + glow * 26} fill={`url(#gl-${id})`} opacity={glow} />
          {/* лучи света вверх */}
          <path d={`M 30 40 L ${12 - glow * 20} ${-40 - glow * 60} L ${88 + glow * 20} ${-40 - glow * 60} L 70 40 Z`} fill="#FFE7A8" opacity={0.22 * glow} />
        </>
      )}
      {/* тень под коробкой */}
      <ellipse cx={50} cy={97} rx={36} ry={4} fill="rgba(0,0,0,0.35)" />
      {/* корпус */}
      <rect x={16} y={44} width={68} height={52} rx={6} fill={`url(#gb-${id})`} />
      <rect x={45} y={44} width={10} height={52} fill={ribbon} />
      <rect x={16} y={44} width={68} height={6} fill={alpha('#000000', 0.15)} />
      {/* крышка с бантом */}
      <g transform={`translate(${lidX} ${lidY}) rotate(${lidR} 50 40)`}>
        <rect x={12} y={30} width={76} height={16} rx={5} fill={light} />
        <rect x={45} y={30} width={10} height={16} fill={ribbon} />
        <path d="M 50 30 C 38 14, 24 20, 32 30 Z" fill={ribbon} />
        <path d="M 50 30 C 62 14, 76 20, 68 30 Z" fill={ribbon} />
        <circle cx={50} cy={29} r={4.5} fill={mixColor(ribbon, '#000000', 0.15)} />
      </g>
    </svg>
  );
};
