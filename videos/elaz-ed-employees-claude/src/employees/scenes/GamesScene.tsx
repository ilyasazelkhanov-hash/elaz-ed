// 00:21–00:29. Игровые поводы вернуться: ловля подарков в аркаде, скретч-карта, отметка нового дня,
// затем личный рейтинг и ачивка. Тон — приятное участие, не контроль.
import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { useDemo } from '../props';
import { alpha, C, clamp, ease, FONT, mix, mixColor, pop } from '../style';
import { sceneSpec } from '../timeline';
import { AppHeader } from '../ui/AppHeader';
import { Caption } from '../ui/Caption';
import { GiftBox } from '../ui/GiftBox';
import { AppWindow, Avatar, Bar, Check, Flame, Medal, Star, Touch } from '../ui/kit';

const SEG = { arcade: [0, 92], scratch: [86, 158], streak: [152, 192], rating: [186, 240] } as const;

const segOpacity = (frame: number, [a, b]: readonly [number, number], first = false, last = false) =>
  (first ? 1 : ease(frame, [a, a + 8])) * (last ? 1 : 1 - ease(frame, [b - 6, b]));

// ---------- аркада ----------

const FIELD = { x: 40, y: 220, w: 820, h: 760 };
const CATCH_Y = 600;
const FALL = 34;
const DROPS = Array.from({ length: 9 }, (_, i) => ({
  at: 6 + i * 8,
  x: 90 + random(`arcade-x-${i}`) * 560,
  rare: i === 5,
  spin: (random(`arcade-r-${i}`) - 0.5) * 50,
}));

const Sled: React.FC<{ color: string }> = ({ color }) => (
  <svg width={190} height={90} viewBox="0 0 190 90">
    <path d="M20 22h130c10 0 16 8 16 18v6c0 8-6 14-14 14H34C24 60 16 50 16 40z" fill={color} />
    <path d="M24 72h132c12 0 20-8 22-18" stroke="#F7F2E8" strokeWidth={7} fill="none" strokeLinecap="round" />
    <path d="M44 60v12M140 60v12" stroke="#F7F2E8" strokeWidth={6} strokeLinecap="round" />
    <rect x={30} y={22} width={120} height={10} rx={5} fill="rgba(255,255,255,0.25)" />
  </svg>
);

const ArcadePanel: React.FC<{ frame: number; palette: ReturnType<typeof useDemo>['company']['palette'] }> = ({ frame, palette: p }) => {
  const lands = DROPS.map((d) => d.at + FALL);
  const sledX = interpolate(frame, [0, ...lands], [FIELD.w / 2 - 95, ...DROPS.map((d) => d.x - 50)], clamp);
  const caught = DROPS.filter((d) => frame >= d.at + FALL);
  const score = caught.reduce((s, d) => s + (d.rare ? 3 : 1), 0);
  const combo = caught.length >= 5;
  return (
    <>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 128, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 48, color: p.ink }}>Поймай подарки</div>
        <div style={{ fontFamily: FONT.accent, fontWeight: 700, fontSize: 52, color: p.accent, fontVariantNumeric: 'tabular-nums' }}>{score}</div>
      </div>
      <div style={{ position: 'absolute', left: FIELD.x, top: FIELD.y, width: FIELD.w, height: FIELD.h, borderRadius: 40, overflow: 'hidden', background: 'linear-gradient(180deg, #071630 0%, #0d2d55 70%, #134a72 100%)', border: `2px solid ${alpha(p.ink, 0.08)}` }}>
        <Bar progress={1 - frame / 92} color={p.primary} track={alpha('#ffffff', 0.1)} height={12} style={{ position: 'absolute', left: 30, right: 30, top: 26 }} />
        {DROPS.map((d, i) => {
          const t = (frame - d.at) / FALL;
          if (t < 0 || t > 1.25) return null;
          const y = -100 + t * (CATCH_Y + 100 - 40);
          const gone = t > 1 ? ease(t, [1, 1.25]) : 0;
          return (
            <div key={i} style={{ position: 'absolute', left: d.x, top: Math.min(y, CATCH_Y - 40), opacity: 1 - gone, transform: `rotate(${d.spin * Math.min(1, t)}deg) scale(${1 - gone * 0.6})` }}>
              {d.rare ? <Star size={92} color={p.accent} /> : <GiftBox size={96} body={i % 2 ? mixColor(p.primary, '#0B2550', 0.3) : '#C9504F'} ribbon={i % 2 ? p.accent : '#F7F2E8'} />}
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: sledX, top: CATCH_Y + 30 }}>
          <Sled color={p.primary} />
        </div>
        {combo && (
          <div style={{ position: 'absolute', right: 30, top: 54, padding: '6px 22px', borderRadius: 999, background: p.accent, color: '#2A1A00', fontFamily: FONT.accent, fontWeight: 700, fontSize: 36, transform: `scale(${pop(frame, 30, DROPS[4].at + FALL, { damping: 10 })})` }}>
            ×2
          </div>
        )}
        <div style={{ position: 'absolute', left: 30, top: 58, fontFamily: FONT.text, fontWeight: 600, fontSize: 30, color: 'rgba(255,255,255,0.7)' }}>Серия из пяти — очки ×2</div>
      </div>
    </>
  );
};

// ---------- скретч ----------

const CARD = { x: 100, y: 230, w: 700, h: 560 };
const PATH: [number, number][] = [
  [90, 140], [600, 110], [140, 250], [620, 230], [110, 380], [610, 360], [160, 480], [580, 470],
];
const pathLength = PATH.slice(1).reduce((s, pt, i) => s + Math.hypot(pt[0] - PATH[i][0], pt[1] - PATH[i][1]), 0);
const pointAt = (t: number) => {
  let left = t * pathLength;
  for (let i = 1; i < PATH.length; i++) {
    const seg = Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]);
    if (left <= seg) {
      const k = left / seg;
      return [mix(PATH[i - 1][0], PATH[i][0], k), mix(PATH[i - 1][1], PATH[i][1], k)];
    }
    left -= seg;
  }
  return PATH[PATH.length - 1];
};

const ScratchPanel: React.FC<{ frame: number; palette: ReturnType<typeof useDemo>['company']['palette'] }> = ({ frame, palette: p }) => {
  const t = ease(frame, [14, 58], [0, 1], (x) => x);
  const fade = ease(frame, [56, 66]);
  return (
    <>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 128, fontFamily: FONT.text, fontWeight: 800, fontSize: 48, color: p.ink }}>Скретч-карта дня</div>
      <div style={{ position: 'absolute', left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: 44, overflow: 'hidden', background: `radial-gradient(70% 60% at 50% 40%, ${alpha(p.accent, 0.35)}, ${p.card})`, border: `2px solid ${alpha(p.accent, 0.4)}` }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: FONT.accent, fontWeight: 700, fontSize: 110, color: p.accent }}>+50 XP</div>
          <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 40, color: p.ink, marginTop: 10 }}>бонус за новый день</div>
        </div>
        <svg width={CARD.w} height={CARD.h} style={{ position: 'absolute', inset: 0, opacity: 1 - fade }}>
          <defs>
            <linearGradient id="foil" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#C9D3E2" />
              <stop offset="0.5" stopColor="#8E9BB0" />
              <stop offset="1" stopColor="#B7C2D3" />
            </linearGradient>
            <mask id="scratch-mask">
              <rect width={CARD.w} height={CARD.h} fill="white" />
              <polyline points={PATH.map((pt) => pt.join(',')).join(' ')} fill="none" stroke="black" strokeWidth={150} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={pathLength} strokeDashoffset={pathLength * (1 - t)} />
            </mask>
          </defs>
          <g mask="url(#scratch-mask)">
            <rect width={CARD.w} height={CARD.h} fill="url(#foil)" />
            {Array.from({ length: 40 }, (_, i) => (
              <circle key={i} cx={random(`foil-x-${i}`) * CARD.w} cy={random(`foil-y-${i}`) * CARD.h} r={2 + random(`foil-r-${i}`) * 4} fill="rgba(255,255,255,0.35)" />
            ))}
            <text x={CARD.w / 2} y={CARD.h / 2 + 16} textAnchor="middle" fontFamily={FONT.accent} fontWeight={700} fontSize={44} fill="rgba(20,30,50,0.55)" letterSpacing={3}>
              СОТРИ ПАЛЬЦЕМ
            </text>
          </g>
        </svg>
      </div>
      <TouchOnCard t={t} visible={frame > 8 && frame < 62} />
    </>
  );
};

const TouchOnCard: React.FC<{ t: number; visible: boolean }> = ({ t, visible }) => {
  const [x, y] = pointAt(t);
  return <Touch x={CARD.x + x} y={CARD.y + y} opacity={visible ? 1 : 0} press={0} />;
};

// ---------- отметка дня ----------

const StreakPanel: React.FC<{ frame: number; fps: number; palette: ReturnType<typeof useDemo>['company']['palette'] }> = ({ frame, fps, palette: p }) => {
  const mark = pop(frame, fps, 14, { damping: 12 });
  return (
    <div style={{ position: 'absolute', left: 40, right: 40, top: 160, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 260, height: 260, borderRadius: '50%', background: `radial-gradient(closest-side, rgba(255,158,94,0.35), transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${mix(0.7, 1, mark)})` }}>
        <Flame size={190} />
      </div>
      <div style={{ fontFamily: FONT.accent, fontWeight: 700, fontSize: 64, color: p.ink, marginTop: 20 }}>8 дней подряд</div>
      <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 40, color: p.mute, marginTop: 14 }}>Новый день отмечен</div>
      <div style={{ display: 'flex', gap: 14, marginTop: 50 }}>
        {Array.from({ length: 8 }, (_, i) => {
          const on = i < 7 ? 1 : mark;
          return (
            <div key={i} style={{ width: 84, height: 96, borderRadius: '42px 42px 18px 18px', background: on > 0.5 ? mixColor(p.card, p.primary, 0.8) : p.card, border: `2px solid ${alpha(p.ink, 0.12)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: i === 7 ? `scale(${mix(0.6, 1, mark)})` : undefined }}>
              {on > 0.5 ? <Check size={44} color="#0B1730" /> : <span style={{ fontFamily: FONT.accent, fontSize: 30, color: p.mute }}>{i + 1}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- личный рейтинг ----------

const RatingPanel: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const demo = useDemo();
  const p = demo.company.palette;
  const rise = ease(frame, [10, 30]);
  const ach = pop(frame, fps, 26, { damping: 14 });
  const rows = [
    { person: demo.people[0], xp: 260, rank: 1 },
    { person: demo.colleague, xp: 205, rank: mix(2, 3, rise) },
    { person: demo.hero, xp: mix(162, 212, rise), rank: mix(3, 2, rise), me: true },
    { person: demo.people[1], xp: 180, rank: 4 },
  ];
  return (
    <>
      <div style={{ position: 'absolute', left: 40, right: 40, top: 128 }}>
        <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 48, color: p.ink }}>Личный рейтинг</div>
        <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 32, color: p.mute, marginTop: 6 }}>Свой прогресс и немного азарта</div>
      </div>
      {rows.map((r) => (
        <div
          key={r.person.name}
          style={{
            position: 'absolute',
            left: 40,
            right: 40,
            top: 280 + (r.rank - 1) * 138,
            height: 120,
            borderRadius: 34,
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            padding: '0 30px',
            background: r.me ? mixColor(p.card, p.primary, 0.28) : p.card,
            border: `2px solid ${r.me ? alpha(p.primary, 0.7) : alpha(p.ink, 0.08)}`,
            zIndex: r.me ? 2 : 1,
          }}
        >
          <div style={{ width: 50, fontFamily: FONT.accent, fontWeight: 700, fontSize: 38, color: p.mute, textAlign: 'center' }}>{Math.round(r.rank)}</div>
          <Avatar person={r.person} size={76} />
          <div style={{ flex: 1, fontFamily: FONT.text, fontWeight: 700, fontSize: 44, color: p.ink }}>
            {r.person.name}
            {r.me && <span style={{ marginLeft: 16, padding: '4px 16px', borderRadius: 999, background: p.primary, color: '#0B1730', fontSize: 28, verticalAlign: 'middle' }}>Вы</span>}
          </div>
          <div style={{ fontFamily: FONT.accent, fontWeight: 600, fontSize: 38, color: p.ink, fontVariantNumeric: 'tabular-nums' }}>{Math.round(r.xp)}</div>
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: 40,
          right: 40,
          top: 850,
          height: 150,
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          padding: '0 30px',
          background: `linear-gradient(100deg, ${alpha(C.gold, 0.2)}, ${p.card})`,
          border: `2px solid ${alpha(C.gold, 0.5)}`,
          opacity: ach,
          transform: `translateY(${(1 - ach) * 50}px)`,
        }}
      >
        <Medal size={96} ribbon={p.primary} />
        <div>
          <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 30, color: C.gold }}>Новая ачивка</div>
          <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 46, color: p.ink }}>Неделя в календаре</div>
        </div>
      </div>
    </>
  );
};

export const GamesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const demo = useDemo();
  const p = demo.company.palette;
  const spec = sceneSpec('games');

  const arcadeScore = DROPS.filter((d) => frame >= d.at + FALL).reduce((s, d) => s + (d.rare ? 3 : 1), 0);
  const xp = 150 + arcadeScore + ease(frame, [SEG.scratch[0] + 60, SEG.scratch[0] + 72]) * 50;
  const streak = frame >= SEG.streak[0] + 16 ? 8 : 7;
  const streakGlow = ease(frame, [SEG.streak[0] + 14, SEG.streak[0] + 22]) * (1 - ease(frame, [SEG.streak[0] + 30, SEG.streak[0] + 40]));

  return (
    <AbsoluteFill>
      <Caption text={spec.captions[0]} sub={spec.sublines[0]} at={8} highlight={['каждый', 'день']} />
      <AppWindow palette={p} title={demo.company.name}>
        <AppHeader name={demo.company.name} palette={p} xp={xp} streak={streak} streakGlow={streakGlow} phase={0.5 + frame / 200} />
        {frame < SEG.arcade[1] && (
          <div style={{ position: 'absolute', inset: 0, opacity: segOpacity(frame, SEG.arcade, true) }}>
            <ArcadePanel frame={frame} palette={p} />
          </div>
        )}
        {frame >= SEG.scratch[0] && frame < SEG.scratch[1] && (
          <div style={{ position: 'absolute', inset: 0, opacity: segOpacity(frame, SEG.scratch) }}>
            <ScratchPanel frame={frame - SEG.scratch[0]} palette={p} />
          </div>
        )}
        {frame >= SEG.streak[0] && frame < SEG.streak[1] && (
          <div style={{ position: 'absolute', inset: 0, opacity: segOpacity(frame, SEG.streak) }}>
            <StreakPanel frame={frame - SEG.streak[0]} fps={fps} palette={p} />
          </div>
        )}
        {frame >= SEG.rating[0] && (
          <div style={{ position: 'absolute', inset: 0, opacity: segOpacity(frame, SEG.rating, false, true) }}>
            <RatingPanel frame={frame - SEG.rating[0]} fps={fps} />
          </div>
        )}
      </AppWindow>
    </AbsoluteFill>
  );
};
