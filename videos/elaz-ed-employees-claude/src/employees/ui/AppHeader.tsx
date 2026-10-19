// Шапка приложения «Орбиты»: логотип, стрик и XP. Одинаковая во всех экранах.
import React from 'react';
import type { Palette } from '../props';
import { BrandLockup, Bolt, Flame, Pill } from './kit';

export const AppHeader: React.FC<{
  name: string;
  palette: Palette;
  xp: number;
  streak: number;
  phase?: number;
  xpGlow?: number;
  streakGlow?: number;
}> = ({ name, palette, xp, streak, phase, xpGlow = 0, streakGlow = 0 }) => (
  <div style={{ position: 'absolute', left: 40, right: 40, top: 26, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <BrandLockup name={name} palette={palette} size={0.78} phase={phase} />
    <div style={{ display: 'flex', gap: 14 }}>
      <Pill
        palette={palette}
        icon={<Flame size={38} />}
        value={streak}
        style={{ boxShadow: streakGlow ? `0 0 ${40 * streakGlow}px rgba(255,158,94,${0.6 * streakGlow})` : undefined, transform: `scale(${1 + streakGlow * 0.08})` }}
      />
      <Pill
        palette={palette}
        icon={<Bolt size={36} color={palette.accent} />}
        value={Math.round(xp)}
        style={{ boxShadow: xpGlow ? `0 0 ${40 * xpGlow}px rgba(255,209,102,${0.6 * xpGlow})` : undefined, transform: `scale(${1 + xpGlow * 0.08})` }}
      />
    </div>
  </div>
);

/** Где на экране (координаты окна приложения) находится плашка XP — туда летят очки. */
export const XP_PILL = { x: 900 - 40 - 90, y: 92 + 26 + 40 };
