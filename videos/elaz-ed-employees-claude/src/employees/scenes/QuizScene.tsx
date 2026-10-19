// 00:12–00:21. За дверью — короткая история компании (карточка знания в форме той же двери),
// затем квиз. Алина выбирает «Помогаем решить задачу», получает XP и ачивку.
// Сбоку — коллега, прошедший тот же день: общий контекст без командного зачёта.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useDemo } from '../props';
import { alpha, APP, C, ease, FONT, mix, mixColor, pop } from '../style';
import { sceneSpec } from '../timeline';
import { AppHeader, XP_PILL } from '../ui/AppHeader';
import { Caption } from '../ui/Caption';
import { AppWindow, Avatar, Bolt, Check, doorRadius, Medal, OrbitaMark, Touch } from '../ui/kit';

const OPT = { x: 40, y: 470, h: 136, gap: 22 };

export const QuizScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const demo = useDemo();
  const p = demo.company.palette;
  const spec = sceneSpec('quiz');
  const { quiz } = demo;

  const reveal = ease(frame, [0, 26]);
  const storyIn = pop(frame, fps, 4, { damping: 22 });
  const swap = ease(frame, [90, 112]);
  const quizIn = pop(frame, fps, 96, { damping: 20 });
  const touchIn = ease(frame, [116, 134]);
  const press = ease(frame, [136, 150]);
  const chosen = ease(frame, [142, 152]);
  const fly = ease(frame, [154, 180]);
  const xp = mix(120, 120 + quiz.xp, ease(frame, [176, 192]));
  const xpGlow = ease(frame, [176, 186]) * (1 - ease(frame, [196, 214]));
  const badge = pop(frame, fps, 192, { damping: 15 }) * (1 - ease(frame, [250, 262]));
  const mate = pop(frame, fps, 212, { damping: 18 });

  const optY = (i: number) => OPT.y + i * (OPT.h + OPT.gap);
  const touch = { x: APP.x + 450, y: APP.y + 92 + optY(quiz.correct) + OPT.h / 2 };
  const start = { x: APP.x + 450, y: APP.y + 92 + optY(quiz.correct) + 20 };
  const end = { x: APP.x + XP_PILL.x, y: APP.y + XP_PILL.y };

  return (
    <AbsoluteFill>
      <Caption text={spec.captions[0]} breaks={[0, 1]} sub={spec.sublines[0]} at={14} wordAt={[16, 100, 182]} size={84} top={160} />

      <AppWindow palette={p} title={demo.company.name}>
        <AppHeader name={demo.company.name} palette={p} xp={xp} streak={6} phase={0.35 + frame / 200} xpGlow={xpGlow} />

        {/* история компании — карточка знания в форме двери */}
        <div
          style={{
            position: 'absolute',
            left: 70,
            top: 136,
            width: 760,
            height: 860,
            borderRadius: doorRadius(760),
            overflow: 'hidden',
            background: `linear-gradient(180deg, ${mixColor(p.card, p.primary, 0.22)} 0%, ${p.card} 55%)`,
            border: `2px solid ${alpha(C.gold, 0.45)}`,
            opacity: storyIn * (1 - swap),
            transform: `translateX(${-swap * 260}px) scale(${mix(0.94, 1, storyIn)})`,
          }}
        >
          {/* сегменты сторис */}
          <div style={{ position: 'absolute', left: 150, right: 150, top: 90, display: 'flex', gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: alpha(p.ink, 0.2), overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(i === 0 ? ease(frame, [10, 92]) : 0) * 100}%`, background: p.ink }} />
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 150, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(closest-side, ${alpha(C.gold, 0.35)}, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <OrbitaMark size={220} palette={p} phase={frame / 120} />
            </div>
          </div>
          <div style={{ position: 'absolute', left: 60, right: 60, top: 480 }}>
            <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 30, color: C.gold, letterSpacing: 0.5 }}>{demo.story.kicker}</div>
            <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 56, lineHeight: 1.08, color: p.ink, marginTop: 14 }}>{demo.story.title}</div>
            <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 38, lineHeight: 1.32, color: alpha(p.ink, 0.82), marginTop: 22 }}>{demo.story.text}</div>
          </div>
        </div>

        {/* квиз */}
        <div style={{ position: 'absolute', inset: 0, opacity: quizIn, transform: `translateX(${(1 - quizIn) * 220}px)` }}>
          <div style={{ position: 'absolute', left: 40, right: 40, top: 150 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ padding: '10px 22px', borderRadius: 999, background: alpha(p.primary, 0.16), color: p.primary, fontFamily: FONT.text, fontWeight: 700, fontSize: 30 }}>Квиз · день {demo.advent.todayDoor}</div>
              <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 30, color: p.mute }}>+{quiz.xp} XP за ответ</div>
            </div>
            <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 60, lineHeight: 1.1, color: p.ink, marginTop: 30 }}>{quiz.question}</div>
          </div>
          {quiz.options.map((o, i) => {
            const isRight = i === quiz.correct;
            const a = pop(frame, fps, 104 + i * 5);
            const on = isRight ? chosen : 0;
            return (
              <div
                key={o}
                style={{
                  position: 'absolute',
                  left: OPT.x,
                  right: 40,
                  top: optY(i),
                  height: OPT.h,
                  borderRadius: 36,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 26,
                  padding: '0 34px',
                  background: on ? mixColor(p.card, p.primary, 0.85 * on) : p.card,
                  border: `2px solid ${on ? p.primary : alpha(p.ink, 0.1)}`,
                  opacity: a * (isRight ? 1 : 1 - chosen * 0.55),
                  transform: `translateY(${(1 - a) * 30}px) scale(${isRight ? 1 + Math.sin(on * Math.PI) * 0.03 : 1})`,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: `3px solid ${on ? '#0B1730' : alpha(p.ink, 0.35)}`,
                    background: on ? '#0B1730' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on > 0.5 && <Check size={38} color={p.primary} />}
                </div>
                <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 46, color: on > 0.5 ? '#0B1730' : p.ink }}>{o}</div>
              </div>
            );
          })}

          {/* ачивка — тост сверху */}
          <div
            style={{
              position: 'absolute',
              left: 40,
              right: 40,
              top: 136,
              height: 180,
              borderRadius: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 28,
              padding: '0 34px',
              background: `linear-gradient(100deg, ${alpha(C.gold, 0.2)}, ${alpha(p.card, 0.96)})`,
              border: `2px solid ${alpha(C.gold, 0.55)}`,
              opacity: badge,
              transform: `translateY(${(1 - badge) * 60}px) scale(${mix(0.9, 1, badge)})`,
            }}
          >
            <Medal size={112} ribbon={p.primary} />
            <div>
              <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 30, color: C.gold }}>Новая ачивка</div>
              <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 48, color: p.ink, marginTop: 4 }}>{demo.achievement}</div>
            </div>
          </div>
        </div>
      </AppWindow>

      {/* +XP летит в плашку */}
      {fly > 0 && fly < 1 && (
        <div
          style={{
            position: 'absolute',
            left: mix(start.x, end.x, fly) - 110,
            top: mix(start.y, end.y, fly) - 40 - Math.sin(fly * Math.PI) * 160,
            width: 220,
            height: 84,
            borderRadius: 42,
            background: C.gold,
            color: '#2A1A00',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: FONT.accent,
            fontWeight: 700,
            fontSize: 40,
            transform: `scale(${mix(1.1, 0.55, fly)})`,
            boxShadow: '0 16px 40px rgba(255,209,102,0.45)',
          }}
        >
          <Bolt size={36} color="#2A1A00" />+{quiz.xp}
        </div>
      )}

      {/* коллега прошёл тот же день */}
      <div
        style={{
          position: 'absolute',
          right: 80,
          top: 1528,
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          padding: '20px 34px 20px 20px',
          borderRadius: 999,
          background: alpha(mixColor(p.card, '#ffffff', 0.05), 0.97),
          border: `1.5px solid ${alpha(p.ink, 0.14)}`,
          boxShadow: '0 30px 70px rgba(0,0,0,0.5)',
          opacity: mate,
          transform: `translateX(${(1 - mate) * 200}px)`,
        }}
      >
        <Avatar person={demo.colleague} size={88} />
        <div>
          <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 44, color: p.ink }}>{demo.colleague.name} тоже прошёл</div>
          <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 30, color: p.mute, marginTop: 4 }}>
            день {demo.advent.todayDoor} · {demo.colleague.role}
          </div>
        </div>
      </div>

      <Touch x={mix(touch.x + 200, touch.x, touchIn)} y={mix(touch.y + 260, touch.y, touchIn)} opacity={touchIn * (1 - ease(frame, [150, 160]))} press={press} />

      {/* остаток света из открытой двери */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 540px 1050px, #FFF4D6 0%, ${C.gold} 60%, rgba(255,209,102,0.6) 100%)`, opacity: 1 - reveal }} />
    </AbsoluteFill>
  );
};
