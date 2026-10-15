// 00:00–00:05. Карточки «Сотрудники», «Новости», «Корпоратив» хаотично кружат,
// собираются вокруг окна Telegram и сливаются в один брендированный вход — дверь «Орбиты».
import React from 'react';
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { useDemo } from '../props';
import { alpha, C, ease, FONT, mix, mixColor, pop } from '../style';
import { sceneSpec } from '../timeline';
import { Caption } from '../ui/Caption';
import { doorRadius, OrbitaMark, Plane, Star, Touch } from '../ui/kit';

const WIN = { x: 160, y: 600, w: 760, h: 900 };
const TG = { bg: '#15202E', row: '#1C2A3B', ink: '#EAF2FB', mute: '#8EA3BC', blue: '#4FA8E8' };

const People: React.FC<{ color: string }> = ({ color }) => (
  <svg width={52} height={52} viewBox="0 0 24 24">
    <circle cx={9} cy={8} r={3.6} fill={color} />
    <circle cx={16.5} cy={9} r={2.8} fill={color} opacity={0.7} />
    <path d="M2.5 19.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6z" fill={color} />
    <path d="M14.5 13.8c3.3-.6 6.8 1.3 7 5.2h-4.6c-.3-2-1-3.6-2.4-5.2z" fill={color} opacity={0.7} />
  </svg>
);

const News: React.FC<{ color: string }> = ({ color }) => (
  <svg width={52} height={52} viewBox="0 0 24 24">
    <rect x={3} y={4} width={18} height={16} rx={3.5} fill="none" stroke={color} strokeWidth={2} />
    <rect x={6.5} y={7.5} width={5} height={5} rx={1.2} fill={color} />
    <path d="M14 8h3.5M14 11.5h3.5M6.5 16h11" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </svg>
);

type Chip = { label: string; sub: string; icon: React.ReactNode; tint: string; orbit: [number, number, number] };

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const demo = useDemo();
  const p = demo.company.palette;
  const spec = sceneSpec('hook');

  const chips: Chip[] = [
    { label: 'Сотрудники', sub: 'чаты отделов', icon: <People color={C.ice} />, tint: C.ice, orbit: [40, 650, -5] },
    { label: 'Новости', sub: 'канал компании', icon: <News color={C.iceSoft} />, tint: C.iceSoft, orbit: [600, 960, 4] },
    { label: 'Корпоратив', sub: 'кто, где, когда', icon: <Star size={52} color={C.gold} />, tint: C.gold, orbit: [60, 1320, -3] },
  ];

  const winIn = pop(frame, fps, 0, { damping: 20 });
  // Хаос → орбита → слияние.
  const gather = pop(frame, fps, 52, { damping: 16, stiffness: 90 });
  const merge = ease(frame, [84, 108]);
  const entry = pop(frame, fps, 96, { damping: 15, stiffness: 120 });
  const listDim = Math.max(ease(frame, [50, 70]) * 0.45, ease(frame, [86, 106]));

  // Палец: подлетает к кнопке и нажимает.
  const btn = { x: WIN.x + WIN.w / 2, y: WIN.y + 670 };
  const touchIn = ease(frame, [112, 126]);
  const press = ease(frame, [128, 142], [0, 1]);
  const doorLight = ease(frame, [130, 150]);

  return (
    <AbsoluteFill>
      <Caption text={spec.captions[0]} sub={spec.sublines[0]} at={6} highlight={['Telegram']} />

      {/* окно Telegram */}
      <div
        style={{
          position: 'absolute',
          left: WIN.x,
          top: WIN.y,
          width: WIN.w,
          height: WIN.h,
          borderRadius: 56,
          background: TG.bg,
          border: '2px solid rgba(255,255,255,0.08)',
          boxShadow: '0 60px 140px rgba(0,4,18,0.65)',
          overflow: 'hidden',
          opacity: winIn,
          transform: `translateY(${(1 - winIn) * 60}px) scale(${mix(0.94, 1, winIn)})`,
        }}
      >
        <div style={{ height: 110, display: 'flex', alignItems: 'center', gap: 18, padding: '0 40px', borderBottom: '1.5px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 62, height: 62, borderRadius: '50%', background: TG.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plane size={36} />
          </div>
          <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 40, color: TG.ink }}>Telegram</div>
        </div>
        {/* список чатов — гаснет, когда появляется один вход */}
        <div style={{ opacity: 1 - listDim * 0.75, filter: `blur(${listDim * 6}px)` }}>
          {[
            ['Отдел сервиса', 'Марат: Клиент доволен', '12'],
            ['Маркетинг', 'Ксения: Макеты готовы', '3'],
            ['Офис на Лесной', 'Кто в офисе в пятницу?', '27'],
            ['Бухгалтерия', 'Напоминание о сроках', '5'],
          ].map(([t, s, n], i) => {
            const r = pop(frame, fps, 6 + i * 4);
            return (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '26px 40px', opacity: r, transform: `translateX(${(1 - r) * 40}px)` }}>
                <div style={{ width: 92, height: 92, borderRadius: '50%', background: `hsl(${200 + i * 40} 45% 42%)`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 38, color: TG.ink }}>{t}</div>
                  <div style={{ fontFamily: FONT.text, fontSize: 30, color: TG.mute, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s}</div>
                </div>
                <div style={{ minWidth: 56, height: 56, padding: '0 14px', borderRadius: 28, background: TG.blue, color: '#fff', fontFamily: FONT.text, fontWeight: 700, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</div>
              </div>
            );
          })}
        </div>

        {/* единый брендированный вход */}
        <div
          style={{
            position: 'absolute',
            left: 50,
            right: 50,
            top: 170,
            bottom: 60,
            borderRadius: 48,
            background: `linear-gradient(180deg, ${p.card}, ${p.surface})`,
            border: `2px solid ${alpha(p.primary, 0.35)}`,
            boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 ${80 * doorLight}px ${alpha(C.gold, 0.5 * doorLight)}`,
            opacity: entry,
            transform: `scale(${mix(0.86, 1, entry)})`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 50,
          }}
        >
          <OrbitaMark size={150} palette={p} phase={0.1 + frame / 160} />
          <div style={{ marginTop: 20, fontFamily: FONT.accent, fontWeight: 600, fontSize: 64, letterSpacing: 3, color: p.ink, textTransform: 'uppercase' }}>{demo.company.name}</div>
          <div style={{ marginTop: 14, fontFamily: FONT.text, fontWeight: 500, fontSize: 40, color: p.mute }}>{demo.company.tagline}</div>
          {/* кнопка-дверь */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: btn.y - WIN.y - 170 - 100,
              width: 280,
              height: 200,
              marginLeft: -140,
              borderRadius: doorRadius(280),
              background: `linear-gradient(180deg, ${mixColor(C.gold, '#FFF4D6', doorLight)}, ${C.goldDeep})`,
              boxShadow: `0 0 ${40 + 120 * doorLight}px ${alpha(C.gold, 0.45 + 0.4 * doorLight)}`,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 40,
              transform: `scale(${1 - Math.sin(press * Math.PI) * 0.05})`,
              fontFamily: FONT.text,
              fontWeight: 800,
              fontSize: 48,
              color: '#2A1A00',
            }}
          >
            Открыть
          </div>
        </div>
      </div>

      {/* карточки-поводы: хаос, потом орбита, потом слияние в один вход */}
      {chips.map((c, i) => {
        const k = `hook-chip-${i}`;
        const t = frame / fps;
        const chaosX = 80 + random(`${k}-x`) * 520 + Math.sin(t * (1.6 + random(`${k}-fx`)) + i * 2) * 120;
        const chaosY = 620 + random(`${k}-y`) * 760 + Math.cos(t * (1.3 + random(`${k}-fy`)) + i) * 140;
        const chaosR = Math.sin(t * 2.2 + i * 1.7) * 14;
        const [ox, oy, or] = c.orbit;
        const cx = WIN.x + WIN.w / 2 - 220;
        const cy = WIN.y + 300;
        const x = mix(mix(chaosX, ox, gather), cx, merge);
        const y = mix(mix(chaosY, oy, gather), cy, merge);
        const r = mix(mix(chaosR, or, gather), 0, merge);
        const appear = pop(frame, fps, 2 + i * 5);
        return (
          <div
            key={c.label}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 440,
              height: 150,
              borderRadius: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              padding: '0 32px',
              background: 'rgba(16, 40, 78, 0.94)',
              border: `2px solid ${alpha(c.tint, 0.35)}`,
              boxShadow: '0 30px 70px rgba(0,0,0,0.45)',
              opacity: appear * (1 - merge),
              transform: `rotate(${r}deg) scale(${mix(0.7, 1, appear) * mix(1, 0.4, merge)})`,
            }}
          >
            <div style={{ width: 88, height: 88, borderRadius: 26, background: alpha(c.tint, 0.14), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.icon}</div>
            <div>
              <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 48, color: C.milk, lineHeight: 1 }}>{c.label}</div>
              <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 30, color: C.milkMute, marginTop: 8 }}>{c.sub}</div>
            </div>
          </div>
        );
      })}

      <Touch x={mix(btn.x + 200, btn.x, touchIn)} y={mix(btn.y + 260, btn.y, touchIn)} opacity={touchIn * (1 - ease(frame, [144, 150]))} press={press} />
    </AbsoluteFill>
  );
};
