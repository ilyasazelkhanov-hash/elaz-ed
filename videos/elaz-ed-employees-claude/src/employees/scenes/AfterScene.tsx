// 00:36–00:44. Снег растворяется. Бренд остаётся, подарки уступают место разделам:
// «Новости команды», «Добро пожаловать в компанию», «Курс по продукту». Дверь в шапке теперь —
// вход в постоянное пространство. Затем курс из последовательных уроков и завершение вводного модуля.
// Второй эмоциональный пик ролика.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useDemo } from '../props';
import { alpha, APP, C, ease, FONT, mix, mixColor, pop } from '../style';
import { sceneSpec } from '../timeline';
import { AppHeader } from '../ui/AppHeader';
import { Caption } from '../ui/Caption';
import { Garland } from '../ui/Garland';
import { GiftBox } from '../ui/GiftBox';
import { AppWindow, Bar, Check, doorRadius, Medal, Touch } from '../ui/kit';
import { HERO_GRADIENT, tilePos } from './AdventScene';

const SectionIcon: React.FC<{ kind: number; color: string }> = ({ kind, color }) => {
  if (kind === 0)
    return (
      <svg width={54} height={54} viewBox="0 0 24 24">
        <rect x={3} y={4} width={18} height={16} rx={3.5} fill="none" stroke={color} strokeWidth={2} />
        <path d="M7 9h10M7 13h10M7 17h6" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  if (kind === 1)
    return (
      <svg width={54} height={54} viewBox="0 0 24 24">
        <path d="M6 21V8a6 6 0 0 1 12 0v13" fill="none" stroke={color} strokeWidth={2} />
        <circle cx={14.5} cy={14} r={1.3} fill={color} />
        <path d="M3 21h18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width={54} height={54} viewBox="0 0 24 24">
      <path d="M12 4 2.5 9 12 14l9.5-5L12 4z" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <path d="M6.5 11.3V16c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.7" fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
};

export const AfterScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const demo = useDemo();
  const p = demo.company.palette;
  const spec = sceneSpec('after');
  const { sections, course } = demo.after;

  const calm = ease(frame, [34, 70]);
  const doorShow = ease(frame, [44, 58]);
  const doorOpen = ease(frame, [60, 86]);
  const tilesOut = (i: number) => ease(frame, [40 + i * 3, 58 + i * 3]);
  const sectionIn = (i: number) => pop(frame, fps, 74 + i * 7, { damping: 18 });
  const touchIn = ease(frame, [104, 118]);
  const press = ease(frame, [120, 132]);
  const courseIn = pop(frame, fps, 128, { damping: 20 });
  const lessonDone = (i: number) => ease(frame, [150 + i * 9, 156 + i * 9]);
  const progress = ease(frame, [150, 150 + course.lessons.length * 9]);
  const done = pop(frame, fps, 150 + course.lessons.length * 9 + 2, { damping: 14 });
  const xp = 212 + ease(frame, [200, 212]) * 50;

  const doorLight = mixColor('#CDEBFF', '#FFFFFF', doorOpen);
  const touch = { x: APP.x + 450, y: APP.y + 92 + 440 + 2 * 170 + 75 };

  return (
    <AbsoluteFill>
      <Caption text={spec.captions[0]} breaks={[2, 3]} sub={spec.sublines[0]} at={52} highlight={['привычки']} size={84} top={160} />
      <AppWindow palette={p} title={demo.company.name}>
        <AppHeader name={demo.company.name} palette={p} xp={xp} streak={8} phase={0.85 + frame / 200} xpGlow={ease(frame, [200, 206]) * (1 - ease(frame, [214, 228]))} />

        <div style={{ position: 'absolute', inset: 0, opacity: 1 - ease(frame, [128, 142]), transform: `translateX(${-ease(frame, [128, 146]) * 160}px)` }}>
          {/* шапка: праздник → постоянное пространство */}
          <div style={{ position: 'absolute', left: 40, right: 40, top: 128, height: 280, borderRadius: 44, overflow: 'hidden', background: HERO_GRADIENT }}>
            <div style={{ position: 'absolute', inset: 0, opacity: calm, background: `radial-gradient(70% 90% at 85% 40%, ${alpha(p.primary, 0.35)}, transparent 70%), linear-gradient(160deg, ${mixColor(p.card, p.primary, 0.2)}, ${p.surface})` }} />
            <div style={{ position: 'absolute', left: -10, top: -8, opacity: 1 - calm }}>
              <Garland width={840} frame={frame} spans={3} sag={22} seed="after-hero" />
            </div>
            <div style={{ position: 'absolute', left: 44, bottom: 44, width: 520 }}>
              <div style={{ position: 'relative', height: 120 }}>
                <div style={{ position: 'absolute', bottom: 0, fontFamily: FONT.accent, fontWeight: 600, fontSize: 48, lineHeight: 1.12, color: '#fff', opacity: 1 - calm }}>{demo.advent.title}</div>
                <div style={{ position: 'absolute', bottom: 0, fontFamily: FONT.accent, fontWeight: 600, fontSize: 48, lineHeight: 1.12, color: p.ink, opacity: calm }}>{demo.company.tagline}</div>
              </div>
              <div style={{ position: 'relative', height: 44, marginTop: 10, fontFamily: FONT.text, fontWeight: 500, fontSize: 32 }}>
                <div style={{ position: 'absolute', color: 'rgba(255,255,255,0.75)', opacity: 1 - calm }}>Финал календаря</div>
                <div style={{ position: 'absolute', color: p.mute, opacity: calm }}>Открыто круглый год</div>
              </div>
            </div>
            {/* подарок уступает место двери, дверь открывается в дневной свет */}
            <GiftBox size={170} body={mixColor(p.primary, '#0B2550', 0.35)} ribbon={p.accent} style={{ position: 'absolute', right: 34, bottom: 36, opacity: 1 - doorShow, transform: `scale(${1 - doorShow * 0.3})` }} />
            <div style={{ position: 'absolute', right: 60, bottom: 30, width: 160, height: 210, opacity: doorShow, perspective: 500 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: doorRadius(160), background: `radial-gradient(90% 80% at 50% 70%, #FFFFFF 0%, ${doorLight} 40%, ${alpha(p.primary, 0.9)} 100%)`, boxShadow: `0 0 ${60 * doorOpen}px ${alpha('#CDEBFF', 0.8 * doorOpen)}` }} />
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
                    transform: `rotateY(${(side === 0 ? -1 : 1) * doorOpen * 100}deg)`,
                    borderRadius: side === 0 ? '80px 0 0 20px' : '0 80px 20px 0',
                    background: `linear-gradient(180deg, ${mixColor(p.card, p.primary, 0.3)}, ${p.card})`,
                    border: `2.5px solid ${alpha(p.primary, 0.9)}`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* подарки уходят */}
          {Array.from({ length: 8 }, (_, i) => {
            const pos = tilePos(i);
            const o = tilesOut(i);
            return (
              <div key={i} style={{ position: 'absolute', left: pos.x, top: pos.y + 40, width: 185, height: 180, borderRadius: doorRadius(185), background: p.card, border: `2px solid ${alpha(p.ink, 0.08)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 1 - o, transform: `scale(${1 - o * 0.4}) translateY(${o * 30}px)` }}>
                <GiftBox size={100} body={i % 2 ? '#C9504F' : mixColor(p.primary, '#0B2550', 0.3)} ribbon={i % 2 ? '#F7F2E8' : p.accent} />
              </div>
            );
          })}

          {/* разделы постоянного пространства */}
          {sections.map((s, i) => {
            const a = sectionIn(i);
            const isCourse = i === sections.length - 1;
            return (
              <div
                key={s.title}
                style={{
                  position: 'absolute',
                  left: 40,
                  right: 40,
                  top: 440 + i * 170,
                  height: 150,
                  borderRadius: 40,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 28,
                  padding: '0 30px',
                  background: isCourse ? mixColor(p.card, p.primary, 0.12 + 0.2 * press) : p.card,
                  border: `2px solid ${isCourse ? alpha(p.primary, 0.5) : alpha(p.ink, 0.08)}`,
                  opacity: a,
                  transform: `translateY(${(1 - a) * 60}px) scale(${isCourse ? 1 - Math.sin(press * Math.PI) * 0.02 : 1})`,
                }}
              >
                <div style={{ width: 96, height: 108, borderRadius: doorRadius(96), background: alpha(p.primary, 0.16), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <SectionIcon kind={i} color={p.primary} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 40, color: p.ink, lineHeight: 1.05, whiteSpace: 'nowrap' }}>{s.title}</div>
                  <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 30, color: p.mute, marginTop: 8 }}>{s.text}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* курс из последовательных уроков */}
        <div style={{ position: 'absolute', inset: 0, opacity: courseIn, transform: `translateX(${(1 - courseIn) * 220}px)` }}>
          <div style={{ position: 'absolute', left: 40, right: 40, top: 128, opacity: 1 - done }}>
            <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 30, color: p.primary }}>Вводный модуль · {course.lessons.length} уроков</div>
            <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 60, color: p.ink, marginTop: 6 }}>{course.title}</div>
            <Bar progress={progress} color={p.primary} track={alpha(p.ink, 0.1)} height={16} style={{ marginTop: 24 }} />
          </div>
          {/* линия пути */}
          <div style={{ position: 'absolute', left: 40 + 30 + 36, top: 360 + 60, width: 4, height: (course.lessons.length - 1) * 118, background: alpha(p.ink, 0.12) }}>
            <div style={{ width: '100%', height: `${progress * 100}%`, background: p.primary }} />
          </div>
          {course.lessons.map((l, i) => {
            const d = lessonDone(i);
            return (
              <div key={l} style={{ position: 'absolute', left: 40, right: 40, top: 360 + i * 118, height: 104, display: 'flex', alignItems: 'center', gap: 26, padding: '0 30px', borderRadius: 32, background: d > 0.5 ? alpha(p.primary, 0.1) : 'transparent' }}>
                <div style={{ width: 76, height: 76, borderRadius: '50%', flexShrink: 0, background: d > 0.5 ? p.primary : p.card, border: `2.5px solid ${d > 0.5 ? p.primary : alpha(p.ink, 0.2)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + Math.sin(d * Math.PI) * 0.15})` }}>
                  {d > 0.5 ? <Check size={44} color="#0B1730" /> : <span style={{ fontFamily: FONT.accent, fontWeight: 600, fontSize: 32, color: p.mute }}>{i + 1}</span>}
                </div>
                <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 44, color: p.ink }}>{l}</div>
              </div>
            );
          })}
          <div
            style={{
              position: 'absolute',
              left: 40,
              right: 40,
              top: 136,
              height: 196,
              borderRadius: 44,
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              padding: '0 34px',
              background: `linear-gradient(100deg, ${mixColor(p.card, C.gold, 0.25)}, ${p.card})`,
              border: `2px solid ${alpha(C.gold, 0.6)}`,
              boxShadow: '0 30px 70px rgba(0,0,0,0.45)',
              opacity: done,
              transform: `translateY(${(1 - done) * -40}px) scale(${mix(0.92, 1, done)})`,
            }}
          >
            <Medal size={124} ribbon={p.primary} />
            <div>
              <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 50, color: p.ink, lineHeight: 1.05 }}>Вводный модуль пройден</div>
              <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 32, color: p.mute, marginTop: 8 }}>Дальше — модуль 2</div>
            </div>
          </div>
        </div>
      </AppWindow>
      <Touch x={mix(touch.x + 200, touch.x, touchIn)} y={mix(touch.y + 220, touch.y, touchIn)} opacity={touchIn * (1 - ease(frame, [132, 140]))} press={press} />
    </AbsoluteFill>
  );
};
