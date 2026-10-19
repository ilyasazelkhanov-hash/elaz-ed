// 00:29–00:36. Новость «Встречаемся на корпоративе» раскрывается в программу вечера — обычный материал ленты.
// Следом окно адвент-розыгрыша «Подарки участникам»: приз с лимитом и подписью «По правилам кампании».
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useDemo } from '../props';
import { alpha, APP, C, ease, FONT, mix, mixColor, pop } from '../style';
import { sceneSpec } from '../timeline';
import { AppHeader } from '../ui/AppHeader';
import { Caption } from '../ui/Caption';
import { Garland } from '../ui/Garland';
import { GiftBox } from '../ui/GiftBox';
import { AppWindow, Calendar, doorRadius, Touch } from '../ui/kit';

export const EventScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const demo = useDemo();
  const p = demo.company.palette;
  const spec = sceneSpec('event');

  const cardIn = pop(frame, fps, 0, { damping: 20 });
  const touchIn = ease(frame, [22, 36]);
  const press = ease(frame, [38, 50]);
  const open = ease(frame, [44, 72]);
  const out = ease(frame, [94, 108]);
  const drawIn = pop(frame, fps, 106, { damping: 19 });
  const chances = ease(frame, [140, 176]);

  const coverH = mix(300, 230, open);
  const cardH = mix(520, 900, open);

  return (
    <AbsoluteFill>
      <Caption text={spec.captions[0]} sub={spec.sublines[0]} at={8} wordAt={[8, 12, 106, 110]} highlight={['празднике']} />
      <AppWindow palette={p} title={demo.company.name}>
        <AppHeader name={demo.company.name} palette={p} xp={212} streak={8} phase={0.7 + frame / 200} />

        {/* лента: новость раскрывается в материал */}
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - out, transform: `translateY(${-out * 120}px)` }}>
          <div style={{ position: 'absolute', left: 40, top: 130, fontFamily: FONT.text, fontWeight: 800, fontSize: 44, color: p.ink, opacity: 1 - open }}>Новости</div>
          <div
            style={{
              position: 'absolute',
              left: 40,
              right: 40,
              top: mix(206, 128, open),
              height: cardH,
              borderRadius: 44,
              overflow: 'hidden',
              background: p.card,
              border: `2px solid ${alpha(p.ink, 0.08)}`,
              opacity: cardIn,
              transform: `translateY(${(1 - cardIn) * 50}px) scale(${1 - Math.sin(press * Math.PI) * 0.015})`,
            }}
          >
            <div style={{ position: 'relative', height: coverH, overflow: 'hidden', background: 'radial-gradient(60% 80% at 70% 30%, #3b6fb0 0%, transparent 70%), linear-gradient(160deg, #1a3b6e, #0b1f40)' }}>
              <div style={{ position: 'absolute', left: -20, top: 10 }}>
                <Garland width={860} frame={frame} spans={4} sag={20} seed="event-cover" />
              </div>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{ position: 'absolute', left: 120 + i * 150, top: 120 + (i % 2) * 50, width: 70 + (i % 3) * 30, height: 70 + (i % 3) * 30, borderRadius: '50%', background: i % 2 ? alpha(C.gold, 0.25) : alpha(C.iceSoft, 0.2), filter: 'blur(6px)' }} />
              ))}
              <div style={{ position: 'absolute', left: 34, bottom: 24, padding: '8px 20px', borderRadius: 999, background: 'rgba(0,0,0,0.35)', fontFamily: FONT.text, fontWeight: 700, fontSize: 28, color: '#fff' }}>Новости</div>
            </div>
            <div style={{ padding: '30px 40px 0' }}>
              <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 54, lineHeight: 1.08, color: p.ink }}>{demo.event.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, fontFamily: FONT.text, fontWeight: 600, fontSize: 34, color: p.mute }}>
                <Calendar size={38} color={p.primary} />
                {demo.event.date}
              </div>
              {/* программа вечера */}
              <div style={{ marginTop: 40, opacity: ease(frame, [56, 70]) }}>
                <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 36, color: p.ink, marginBottom: 14 }}>Программа вечера</div>
                {demo.event.program.map((row, i) => {
                  const a = pop(frame, fps, 60 + i * 6);
                  return (
                    <div key={row.time} style={{ display: 'flex', alignItems: 'center', gap: 28, height: 84, borderTop: `1.5px solid ${alpha(p.ink, 0.08)}`, opacity: a, transform: `translateX(${(1 - a) * 30}px)` }}>
                      <div style={{ width: 130, fontFamily: FONT.accent, fontWeight: 600, fontSize: 34, color: p.accent }}>{row.time}</div>
                      <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 40, color: p.ink }}>{row.title}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {/* соседняя новость — чтобы было видно, что это лента */}
          <div style={{ position: 'absolute', left: 40, right: 40, top: 760, height: 200, borderRadius: 44, background: p.card, border: `2px solid ${alpha(p.ink, 0.06)}`, opacity: (1 - open) * cardIn * 0.8, padding: '34px 40px' }}>
            <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 30, color: p.mute }}>Новости · вчера</div>
            <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 44, color: p.ink, marginTop: 10 }}>Итоги квартала за 3 минуты</div>
          </div>
        </div>

        {/* адвент-розыгрыш */}
        <div style={{ position: 'absolute', inset: 0, opacity: drawIn, transform: `translateY(${(1 - drawIn) * 160}px)` }}>
          <div style={{ position: 'absolute', left: 40, right: 40, top: 130 }}>
            <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 32, color: p.accent }}>Адвент · розыгрыш</div>
            <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 64, color: p.ink, marginTop: 6 }}>Подарки участникам</div>
          </div>
          <div style={{ position: 'absolute', left: 40, right: 40, top: 330, height: 620, borderRadius: 48, background: `radial-gradient(80% 60% at 50% 0%, ${alpha(p.accent, 0.22)}, ${p.card} 70%)`, border: `2px solid ${alpha(p.accent, 0.4)}` }}>
            <GiftBox size={250} body={mixColor(p.primary, '#0B2550', 0.3)} ribbon={p.accent} glow={0.35 + Math.sin(frame / 10) * 0.08} style={{ position: 'absolute', left: 285, top: 20 }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 290, textAlign: 'center' }}>
              <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 56, color: p.ink }}>{demo.prize.title}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 20 }}>
                {['Розыгрыш', `Всего ${demo.prize.stock}`, '1 дверь = 1 шанс'].map((t) => (
                  <div key={t} style={{ padding: '10px 22px', borderRadius: 999, background: alpha(p.ink, 0.08), fontFamily: FONT.text, fontWeight: 700, fontSize: 30, color: p.ink }}>{t}</div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 36 }}>
                <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 36, color: p.ink, marginRight: 14 }}>Ваши шансы</div>
                {Array.from({ length: 7 }, (_, i) => {
                  const on = chances * 7 > i;
                  return <div key={i} style={{ width: 42, height: 52, borderRadius: doorRadius(42), background: on ? p.accent : alpha(p.ink, 0.12), transform: `scale(${on ? 1 : 0.85})` }} />;
                })}
              </div>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 40, right: 40, top: 974, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: FONT.text, fontWeight: 600, fontSize: 32, color: p.mute }}>
            <span style={{ width: 36, height: 36, borderRadius: '50%', border: `2.5px solid ${p.mute}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800 }}>i</span>
            {demo.prize.note}
          </div>
        </div>
      </AppWindow>
      <Touch x={mix(APP.x + 640, APP.x + 450, touchIn)} y={mix(APP.y + 1000, APP.y + 92 + 420, touchIn)} opacity={touchIn * (1 - ease(frame, [50, 58]))} press={press} />
    </AbsoluteFill>
  );
};
