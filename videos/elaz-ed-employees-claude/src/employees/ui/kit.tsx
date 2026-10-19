// Мелкие элементы интерфейса: иконки, аватары, логотип «Орбиты», касание пальца, окно мини-аппа.
import React from 'react';
import { alpha, APP, C, FONT, mixColor } from '../style';
import type { Palette, Person } from '../props';

// ---------- Иконки (свои SVG, без эмодзи: одинаково на любом рендере) ----------

type IconProps = { size?: number; color?: string; style?: React.CSSProperties };

export const Bolt: React.FC<IconProps> = ({ size = 40, color = C.gold, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <path d="M13.5 2 4 13.6h6.4L9.6 22 20 9.8h-6.6L13.5 2z" fill={color} />
  </svg>
);

export const Flame: React.FC<IconProps> = ({ size = 40, color = '#FF9E5E', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <path d="M12 2c1 3.6 5.5 5.6 5.5 11a5.5 5.5 0 1 1-11 0c0-2.6 1.4-4.2 2.6-5.3.2 1.7.9 2.8 2 3.4C10.6 8.2 11 5 12 2z" fill={color} />
    <path d="M12 12.5c.6 1.4 2.4 2.1 2.4 4.1a2.4 2.4 0 0 1-4.8 0c0-1.2.9-1.9 1.5-2.4.1.5.4.9.9 1.1-.2-1 .0-1.9 0-2.8z" fill="#FFE2A0" />
  </svg>
);

export const Check: React.FC<IconProps> = ({ size = 40, color = '#06231c', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <path d="M5 12.5 10 17.5 19.5 7" stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Star: React.FC<IconProps> = ({ size = 40, color = C.gold, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8L12 2.5z" fill={color} />
  </svg>
);

export const Medal: React.FC<IconProps & { ribbon?: string }> = ({ size = 40, color = C.gold, ribbon = '#5CC8FF', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <path d="M7 2h4l2 6H9L7 2zm10 0h-4l-2 6h4l2-6z" fill={ribbon} />
    <circle cx={12} cy={15} r={7} fill={color} />
    <circle cx={12} cy={15} r={4.6} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={1.4} />
    <path d="M12 12.2l.9 1.9 2 .2-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.2.9-1.9z" fill="rgba(0,0,0,0.22)" />
  </svg>
);

export const Plane: React.FC<IconProps> = ({ size = 40, color = '#fff', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <path d="M21.5 3.5 2.8 10.8c-.9.4-.9 1.6.1 1.9l4.7 1.5 1.8 5.6c.3.8 1.3 1 1.9.4l2.7-2.6 4.8 3.5c.7.5 1.7.1 1.9-.8l3-15.2c.2-1-.8-1.9-1.7-1.6z" fill={color} />
    <path d="M7.7 14.1 18 7.2l-8.3 8.3-.3 3.9-1.7-5.3z" fill="rgba(0,0,0,0.16)" />
  </svg>
);

export const Calendar: React.FC<IconProps> = ({ size = 40, color = C.ice, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <rect x={3} y={5} width={18} height={16} rx={4} fill="none" stroke={color} strokeWidth={2} />
    <path d="M3 10h18M8 3v4M16 3v4" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </svg>
);

// ---------- Люди ----------

/** Аккуратный аватар: инициал на мягком градиенте. hue — тон, чтобы коллег было легко различать. */
export const Avatar: React.FC<{ person: Person; size: number; ring?: string; style?: React.CSSProperties }> = ({ person, size, ring, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(140deg, hsl(${person.hue} 70% 72%), hsl(${person.hue + 28} 55% 48%))`,
      boxShadow: ring ? `0 0 0 ${Math.max(3, size * 0.06)}px ${ring}` : 'inset 0 -6px 14px rgba(0,0,0,0.15)',
      color: '#0B1730',
      fontFamily: FONT.accent,
      fontWeight: 600,
      fontSize: size * 0.42,
      ...style,
    }}
  >
    {person.name.slice(0, 1)}
  </div>
);

/** Именная карточка — так в кадре появляются люди. */
export const NameCard: React.FC<{ person: Person; note?: string; palette: Palette; style?: React.CSSProperties; size?: number }> = ({ person, note, palette, style, size = 1 }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 22 * size,
      padding: `${18 * size}px ${32 * size}px ${18 * size}px ${18 * size}px`,
      borderRadius: 999,
      background: alpha(mixColor(palette.card, '#ffffff', 0.04), 0.94),
      border: `1.5px solid ${alpha(palette.ink, 0.12)}`,
      boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
      ...style,
    }}
  >
    <Avatar person={person} size={84 * size} />
    <div>
      <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 44 * size, color: palette.ink, lineHeight: 1.05 }}>{person.name}</div>
      <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 30 * size, color: palette.mute, marginTop: 4 }}>{note ?? person.role}</div>
    </div>
  </div>
);

// ---------- Бренд заказчика ----------

/** Логотип «Орбиты»: кольцо орбиты с точкой-спутником. phase — положение спутника. */
export const OrbitaMark: React.FC<{ size: number; palette: Palette; phase?: number }> = ({ size, palette, phase = 0.15 }) => {
  const a = phase * Math.PI * 2 - Math.PI / 2;
  const rx = 40;
  const ry = 16;
  const cx = 50 + Math.cos(a) * rx;
  const cy = 50 + Math.sin(a) * ry;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <linearGradient id="orb-core" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mixColor(palette.primary, '#ffffff', 0.45)} />
          <stop offset="1" stopColor={palette.primary} />
        </linearGradient>
      </defs>
      <circle cx={50} cy={50} r={22} fill="url(#orb-core)" />
      <ellipse cx={50} cy={50} rx={rx} ry={ry} fill="none" stroke={palette.ink} strokeOpacity={0.9} strokeWidth={4} transform="rotate(-18 50 50)" />
      <g transform="rotate(-18 50 50)">
        <circle cx={cx} cy={cy} r={7} fill={palette.accent} />
      </g>
    </svg>
  );
};

export const BrandLockup: React.FC<{ name: string; palette: Palette; size?: number; phase?: number; tagline?: string }> = ({ name, palette, size = 1, phase, tagline }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 18 * size }}>
    <OrbitaMark size={78 * size} palette={palette} phase={phase} />
    <div>
      <div style={{ fontFamily: FONT.accent, fontWeight: 600, fontSize: 40 * size, letterSpacing: 2 * size, color: palette.ink, textTransform: 'uppercase', lineHeight: 1 }}>{name}</div>
      {tagline && <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 26 * size, color: palette.mute, marginTop: 8 * size }}>{tagline}</div>}
    </div>
  </div>
);

// ---------- Касание ----------

/** Палец как мягкое кольцо: подлетает к цели, при нажатии сжимается и пускает волну. press 0…1. */
export const Touch: React.FC<{ x: number; y: number; opacity: number; press: number }> = ({ x, y, opacity, press }) => {
  const ripple = press > 0 ? press : 0;
  return (
    <div style={{ position: 'absolute', left: x - 60, top: y - 60, width: 120, height: 120, opacity, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.75)',
          transform: `scale(${1 + ripple * 0.9})`,
          opacity: ripple > 0 ? 1 - ripple : 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 22,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.32)',
          border: '3px solid rgba(255,255,255,0.9)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          transform: `scale(${1 - Math.sin(Math.min(1, ripple * 2) * Math.PI) * 0.18})`,
        }}
      />
    </div>
  );
};

// ---------- Окно мини-аппа ----------

/** Окно Telegram Mini App: тонкая шапка с названием и само приложение. Одна геометрия во всех сценах. */
export const AppWindow: React.FC<{
  palette: Palette;
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  box?: { x: number; y: number; w: number; h: number; radius: number };
}> = ({ palette, title, children, style, contentStyle, box = APP }) => (
  <div
    style={{
      position: 'absolute',
      left: box.x,
      top: box.y,
      width: box.w,
      height: box.h,
      borderRadius: box.radius,
      overflow: 'hidden',
      background: palette.surface,
      border: `2px solid ${alpha(palette.ink, 0.1)}`,
      boxShadow: '0 60px 140px rgba(0, 4, 18, 0.65), 0 0 0 1px rgba(255,255,255,0.03)',
      ...style,
    }}
  >
    <div
      style={{
        height: 92,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        borderBottom: `1.5px solid ${alpha(palette.ink, 0.07)}`,
        color: palette.mute,
        fontFamily: FONT.text,
        fontSize: 30,
        fontWeight: 600,
      }}
    >
      <span style={{ fontSize: 34, opacity: 0.8 }}>✕</span>
      <span style={{ color: palette.ink }}>{title}</span>
      <span style={{ letterSpacing: 4, fontSize: 34 }}>···</span>
    </div>
    <div style={{ position: 'absolute', top: 92, left: 0, right: 0, bottom: 0, ...contentStyle }}>{children}</div>
  </div>
);

/** Карточка внутри приложения. */
export const Card: React.FC<{ palette: Palette; style?: React.CSSProperties; children: React.ReactNode }> = ({ palette, style, children }) => (
  <div
    style={{
      borderRadius: 40,
      background: palette.card,
      border: `1.5px solid ${alpha(palette.ink, 0.08)}`,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Плашка-счётчик в шапке приложения: XP, стрик. */
export const Pill: React.FC<{ palette: Palette; icon: React.ReactNode; value: React.ReactNode; style?: React.CSSProperties }> = ({ palette, icon, value, style }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      height: 72,
      padding: '0 26px 0 18px',
      borderRadius: 999,
      background: alpha(palette.ink, 0.07),
      border: `1.5px solid ${alpha(palette.ink, 0.1)}`,
      fontFamily: FONT.accent,
      fontWeight: 600,
      fontSize: 32,
      color: palette.ink,
      fontVariantNumeric: 'tabular-nums',
      ...style,
    }}
  >
    {icon}
    {value}
  </div>
);

/** Полоса прогресса. */
export const Bar: React.FC<{ progress: number; color: string; track: string; height?: number; style?: React.CSSProperties }> = ({ progress, color, track, height = 16, style }) => (
  <div style={{ height, borderRadius: height, background: track, overflow: 'hidden', ...style }}>
    <div style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%`, height: '100%', borderRadius: height, background: color }} />
  </div>
);

/** Форма двери: прямоугольник со скруглённым арочным верхом. Сквозной мотив ролика. */
export const doorRadius = (w: number) => `${w / 2}px ${w / 2}px 28px 28px`;
