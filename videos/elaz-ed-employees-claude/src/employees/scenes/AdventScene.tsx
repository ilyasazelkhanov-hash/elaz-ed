// 00:05–00:12. Открывается «Орбита»: «Вместе до Нового года», двери по дням, сегодняшний подарок.
// Алина открывает дверь №7 — створки расходятся, коробка раскрывается, свет ведёт в следующую сцену.
// Первый эмоциональный пик ролика.
import React from 'react';
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { useDemo } from '../props';
import { alpha, APP, C, ease, FONT, mix, mixColor, pop } from '../style';
import { sceneSpec } from '../timeline';
import { AppHeader } from '../ui/AppHeader';
import { Caption } from '../ui/Caption';
import { Garland } from '../ui/Garland';
import { GiftBox } from '../ui/GiftBox';
import { AppWindow, Check, doorRadius, NameCard, Touch } from '../ui/kit';

export const HERO_GRADIENT = 'radial-gradient(90% 70% at 20% 10%, #1d6b8f 0%, transparent 70%), linear-gradient(180deg, #071630 0%, #0d2d55 60%, #134a72 100%)';

const GRID = { x: 40, y: 400, w: 185, h: 180, gx: 26, gy: 24, cols: 4 };
export const tilePos = (i: number) => ({
  x: GRID.x + (i % GRID.cols) * (GRID.w + GRID.gx),
  y: GRID.y + Math.floor(i / GRID.cols) * (GRID.h + GRID.gy),
});

export const AdventScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const demo = useDemo();
  const p = demo.company.palette;
  const spec = sceneSpec('advent');
  const today = demo.advent.todayDoor;
  const todayIdx = today - 1;

  const enter = pop(frame, fps, 0, { damping: 22, stiffness: 120 });
  const touchIn = ease(frame, [66, 88]);
  const press = ease(frame, [90, 104]);
  const focus = ease(frame, [100, 132]);
  const leaves = ease(frame, [108, 132]);
  const lid = ease(frame, [128, 146]);
  const glow = ease(frame, [126, 160]);
  const flood = ease(frame, [150, 206], [0, 1]);

  const t7 = tilePos(todayIdx);
  // Дверь дня выезжает в центр окна и крупнеет.
  const target = { x: 450, y: 520 };
  const scale = mix(1, 2.5, focus);
  const cx = mix(t7.x + GRID.w / 2, target.x, focus);
  const cy = mix(t7.y + GRID.h / 2, target.y, focus);

  // Точка касания в координатах кадра.
  const touch = { x: APP.x + t7.x + GRID.w / 2, y: APP.y + 92 + t7.y + GRID.h / 2 };
  const nameIn = pop(frame, fps, 30) * (1 - ease(frame, [96, 110]));

  // Искры из коробки: фиксированные seed, разлетаются по дуге.
  const sparks = Array.from({ length: 26 }, (_, i) => {
    const k = `advent-spark-${i}`;
    const t = ease(frame, [130 + random(`${k}-d`) * 8, 172 + random(`${k}-e`) * 20]);
    const ang = -Math.PI / 2 + (random(`${k}-a`) - 0.5) * 2.4;
    const dist = 160 + random(`${k}-r`) * 300;
    return { x: Math.cos(ang) * dist * t, y: Math.sin(ang) * dist * t + t * t * 120, o: t > 0 && t < 1 ? 1 - t : 0, s: 6 + random(`${k}-s`) * 10, c: random(`${k}-c`) > 0.4 ? C.gold : C.iceSoft };
  });

  return (
    <AbsoluteFill>
      <Caption text={spec.captions[0]} sub={spec.sublines[0]} at={14} out={150} highlight={['адвент']} />

      <AppWindow
        palette={p}
        title={demo.company.name}
        style={{
          opacity: ease(frame, [0, 8]),
          transform: `translateY(${(1 - enter) * 190}px) scale(${mix(0.3, 1, enter)})`,
          transformOrigin: '50% 50%',
        }}
      >
        <AppHeader name={demo.company.name} palette={p} xp={120} streak={6} phase={0.2 + frame / 200} />

        {/* шапка календаря */}
        <div
          style={{
            position: 'absolute',
            left: 40,
            right: 40,
            top: 128,
            height: 248,
            borderRadius: 44,
            overflow: 'hidden',
            background: HERO_GRADIENT,
            opacity: 1 - focus * 0.6,
          }}
        >
          <div style={{ position: 'absolute', left: -10, top: -8 }}>
            <Garland width={840} frame={frame} spans={3} sag={22} reveal={ease(frame, [8, 50])} seed="advent-hero" />
          </div>
          <div style={{ position: 'absolute', left: 44, bottom: 40 }}>
            <div style={{ fontFamily: FONT.accent, fontWeight: 600, fontSize: 50, lineHeight: 1.12, color: '#fff', maxWidth: 560 }}>{demo.advent.title}</div>
            <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 32, color: 'rgba(255,255,255,0.75)', marginTop: 12 }}>
              День {today} из {demo.advent.totalDoors} · подарок дня ждёт
            </div>
          </div>
          <GiftBox size={170} body={mixColor(p.primary, '#0B2550', 0.35)} ribbon={p.accent} style={{ position: 'absolute', right: 34, bottom: 30 }} />
        </div>

        {/* двери 1–12 */}
        {Array.from({ length: 12 }, (_, i) => {
          if (i === todayIdx) return null;
          const pos = tilePos(i);
          const day = i + 1;
          const opened = day < today;
          const a = pop(frame, fps, 10 + i * 2.5);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: GRID.w,
                height: GRID.h,
                borderRadius: doorRadius(GRID.w),
                background: opened ? alpha(p.ink, 0.05) : p.card,
                border: `2px solid ${alpha(p.ink, opened ? 0.06 : 0.1)}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: a * (1 - focus * 0.7),
                transform: `scale(${mix(0.8, 1, a)})`,
              }}
            >
              <div style={{ fontFamily: FONT.accent, fontWeight: 600, fontSize: 50, color: opened ? alpha(p.ink, 0.4) : p.ink }}>{day}</div>
              {opened ? (
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: alpha(p.primary, 0.22), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={30} color={p.primary} />
                </div>
              ) : (
                <div style={{ fontFamily: FONT.text, fontSize: 24, fontWeight: 600, color: p.mute }}>скоро</div>
              )}
            </div>
          );
        })}

        {/* дверь дня */}
        <div
          style={{
            position: 'absolute',
            left: cx - GRID.w / 2,
            top: cy - GRID.h / 2,
            width: GRID.w,
            height: GRID.h,
            transform: `scale(${scale})`,
            perspective: 600,
            opacity: pop(frame, fps, 10 + todayIdx * 2.5),
          }}
        >
          {/* проём: тёплый свет и коробка */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: doorRadius(GRID.w), background: `radial-gradient(80% 70% at 50% 80%, #FFE7A8 0%, ${C.goldDeep} 45%, #5a3410 100%)`, overflow: 'visible' }}>
            <GiftBox size={130} body={mixColor(p.primary, '#0B2550', 0.3)} ribbon={p.accent} lid={lid} glow={glow} style={{ position: 'absolute', left: 27, top: 34 }} />
          </div>
          {/* створки */}
          {[0, 1].map((side) => (
            <div
              key={side}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: side === 0 ? 0 : '50%',
                width: '50%',
                transformOrigin: side === 0 ? '0% 50%' : '100% 50%',
                transform: `rotateY(${(side === 0 ? -1 : 1) * leaves * 105}deg)`,
                borderRadius: side === 0 ? `${GRID.w / 2}px 0 0 28px` : `0 ${GRID.w / 2}px 28px 0`,
                background: `linear-gradient(180deg, ${mixColor(p.card, p.primary, 0.18)}, ${p.card})`,
                border: `3px solid ${C.gold}`,
                [side === 0 ? 'borderRight' : 'borderLeft']: `1.5px solid ${alpha(C.gold, 0.6)}`,
                boxShadow: `0 0 ${24 + 18 * Math.sin(frame / 6)}px ${alpha(C.gold, 0.45)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: side === 0 ? 'flex-end' : 'flex-start',
                overflow: 'hidden',
                opacity: 1 - ease(frame, [128, 136]),
              }}
            >
              <div style={{ fontFamily: FONT.accent, fontWeight: 700, fontSize: 64, color: C.gold, transform: `translateX(${side === 0 ? 20 : -21}px)`, marginTop: -14 }}>{today}</div>
            </div>
          ))}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', fontFamily: FONT.text, fontWeight: 700, fontSize: 24, color: C.gold, opacity: 1 - leaves }}>Сегодня</div>
          {sparks.map((s, i) => (
            <div key={i} style={{ position: 'absolute', left: 92 + s.x / scale, top: 90 + s.y / scale, width: s.s / scale, height: s.s / scale, borderRadius: '50%', background: s.c, opacity: s.o, boxShadow: `0 0 ${10 / scale}px ${s.c}` }} />
          ))}
        </div>
      </AppWindow>

      <NameCard person={demo.hero} note={`открывает день ${today}`} palette={p} style={{ position: 'absolute', left: 130, top: 1486, opacity: nameIn, transform: `translateY(${(1 - nameIn) * 40}px)` }} />

      <Touch x={mix(touch.x + 160, touch.x, touchIn)} y={mix(touch.y + 300, touch.y, touchIn)} opacity={touchIn * (1 - ease(frame, [104, 114]))} press={press} />

      {/* свет из открытой коробки заливает кадр — переход в историю */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${APP.x + target.x}px ${APP.y + 92 + target.y - 40}px, rgba(255,244,214,${flood}) 0%, rgba(255,209,102,${flood * 0.95}) ${mix(4, 70, flood)}%, rgba(255,209,102,0) ${mix(10, 140, flood)}%)`,
          opacity: flood > 0 ? 1 : 0,
        }}
      />
    </AbsoluteFill>
  );
};
