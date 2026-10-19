// 00:53–01:00. Три спокойных слова — «Новый год», «Корпоратив», «На постоянку» —
// собираются в брендированную карточку приложения. Главная надпись, CTA и подпись Elaz Ed.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useDemo } from '../props';
import { alpha, C, ease, FONT, mix, pop } from '../style';
import { sceneSpec } from '../timeline';
import { Caption } from '../ui/Caption';
import { Garland } from '../ui/Garland';
import { doorRadius, OrbitaMark } from '../ui/kit';

const WORDS = ['Новый год', 'Корпоратив', 'На постоянку'];
const CARD = { x: 120, y: 540, w: 840, h: 520 };

export const FinalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const demo = useDemo();
  const p = demo.company.palette;
  const spec = sceneSpec('final');

  const join = ease(frame, [54, 84]);
  const cardIn = pop(frame, fps, 62, { damping: 18 });
  const cta = pop(frame, fps, 96, { damping: 15 });
  const sign = ease(frame, [112, 130]);
  const shine = ((frame - 110) % 75) / 75;

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, top: 60, opacity: ease(frame, [0, 30]) }}>
        <Garland width={1080} frame={frame} spans={4} sag={26} seed="final" />
      </div>

      <Caption text={spec.captions[0]} at={72} highlight={['вашей', 'команды']} />

      {/* брендированная карточка приложения */}
      <div
        style={{
          position: 'absolute',
          left: CARD.x,
          top: CARD.y,
          width: CARD.w,
          height: CARD.h,
          borderRadius: 60,
          overflow: 'hidden',
          background: `radial-gradient(70% 60% at 50% 20%, ${alpha(p.primary, 0.32)}, transparent 70%), linear-gradient(180deg, ${p.card}, ${p.surface})`,
          border: `2px solid ${alpha(p.primary, 0.4)}`,
          boxShadow: `0 60px 140px rgba(0,4,18,0.6), 0 0 120px ${alpha(C.gold, 0.18 * cardIn)}`,
          opacity: cardIn,
          transform: `scale(${mix(0.88, 1, cardIn)})`,
        }}
      >
        {/* дверь со светом за логотипом */}
        <div style={{ position: 'absolute', left: CARD.w / 2 - 130, top: 50, width: 260, height: 300, borderRadius: doorRadius(260), background: `radial-gradient(80% 70% at 50% 70%, ${alpha(C.gold, 0.55)}, ${alpha(C.gold, 0.08)} 70%)`, border: `2px solid ${alpha(C.gold, 0.5)}` }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 80, display: 'flex', justifyContent: 'center' }}>
          <OrbitaMark size={220} palette={p} phase={frame / 110} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 360, textAlign: 'center' }}>
          <div style={{ fontFamily: FONT.accent, fontWeight: 600, fontSize: 60, letterSpacing: 3, color: p.ink, textTransform: 'uppercase' }}>{demo.company.name}</div>
          <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 36, color: p.mute, marginTop: 14, opacity: ease(frame, [76, 92]) }}>{WORDS.join(' · ')}</div>
        </div>
      </div>

      {/* три слова: сначала крупно, потом уходят в карточку */}
      {WORDS.map((w, i) => {
        const a = pop(frame, fps, 4 + i * 14, { damping: 20, stiffness: 110 });
        const y0 = 740 + i * 150;
        const y1 = CARD.y + 420;
        return (
          <div
            key={w}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: mix(y0, y1, join),
              textAlign: 'center',
              fontFamily: FONT.accent,
              fontWeight: 600,
              fontSize: 92,
              color: i === 2 ? C.gold : C.milk,
              opacity: a * (1 - ease(frame, [70, 86])),
              transform: `translateY(${(1 - a) * 40}px) scale(${mix(1, 0.4, join)})`,
              filter: `blur(${(1 - a) * 8 + join * 3}px)`,
            }}
          >
            {w}
          </div>
        );
      })}

      {/* CTA */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1120, display: 'flex', justifyContent: 'center', opacity: cta, transform: `translateY(${(1 - cta) * 40}px) scale(${mix(0.92, 1, cta)})` }}>
        <div style={{ position: 'relative', overflow: 'hidden', padding: '30px 46px', borderRadius: 999, background: `linear-gradient(180deg, #FFE08F, ${C.gold} 55%, ${C.goldDeep})`, boxShadow: `0 24px 70px ${alpha(C.gold, 0.4)}`, display: 'flex', alignItems: 'baseline', gap: 16, whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 48, color: '#2A1A00' }}>Напишите {demo.contact}:</span>
          <span style={{ fontFamily: FONT.accent, fontWeight: 700, fontSize: 44, color: '#2A1A00', letterSpacing: 1 }}>{demo.codeWord}</span>
          {frame > 110 && <div style={{ position: 'absolute', top: 0, bottom: 0, width: 120, left: `${mix(-20, 120, shine)}%`, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)', transform: 'skewX(-20deg)' }} />}
        </div>
      </div>

      {/* подпись команды разработки */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1320, textAlign: 'center', opacity: sign }}>
        <div style={{ display: 'inline-block', fontFamily: FONT.accent, fontWeight: 700, fontSize: 46, background: C.auroraText, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Elaz Ed</div>
        <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 36, color: C.milkMute, marginTop: 10 }}>разработка Telegram Mini Apps</div>
        <div style={{ margin: '26px auto 0', width: 220, height: 4, borderRadius: 2, background: C.aurora, opacity: 0.8 }} />
        <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 28, color: alpha(C.milk, 0.5), marginTop: 26 }}>«{demo.company.name}» — вымышленный пример адаптации</div>
      </div>
    </AbsoluteFill>
  );
};
