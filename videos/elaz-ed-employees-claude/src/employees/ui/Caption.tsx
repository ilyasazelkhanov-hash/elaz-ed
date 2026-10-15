// Заголовок сцены: слова выходят по одному, снизу и из лёгкого размытия. Под ним — подстрочник экранной версии.
import React, { useContext } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { SceneLengthContext, useDemo } from '../props';
import { C, ease, FONT, pop, SAFE } from '../style';

const splitLines = (text: string, breaks?: number[]) => {
  const words = text.split(' ');
  if (!breaks?.length) return [words];
  const lines: string[][] = [[]];
  words.forEach((w, i) => {
    lines[lines.length - 1].push(w);
    if (breaks.includes(i) && i < words.length - 1) lines.push([]);
  });
  return lines;
};

export const Caption: React.FC<{
  text: string;
  sub?: string;
  /** Кадр сцены, с которого заголовок начинает появляться. */
  at?: number;
  /** Кадр сцены, когда заголовок уходит. Не задан — остаётся до конца. */
  out?: number;
  size?: number;
  top?: number;
  align?: 'left' | 'center';
  highlight?: string[];
  /** Свой кадр появления для каждого слова — когда слова идут в такт действию. */
  wordAt?: number[];
  /** Номера слов (с нуля), после которых принудительный перенос строки. */
  breaks?: number[];
}> = ({ text, sub, at = 6, out, size = 88, top = SAFE.top + 10, align = 'center', highlight = [], wordAt, breaks }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { showSublines } = useDemo();
  const sceneLength = useContext(SceneLengthContext);
  // Строки можно задать явно (breaks — слова, после которых перенос); слова внутри строк выходят по одному.
  const lines = splitLines(text, breaks);
  const words = lines.flat();
  const outAt = out ?? (Number.isFinite(sceneLength) ? sceneLength - 6 : undefined);
  const leave = outAt === undefined ? 0 : ease(frame, [outAt, outAt + 10]);
  const subAt = wordAt ? at + 12 : at + 10 + words.length * 3;
  const subIn = ease(frame, [subAt, subAt + 16]);
  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE.side,
        right: SAFE.side,
        top,
        textAlign: align,
        opacity: 1 - leave,
        transform: `translateY(${-leave * 24}px)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT.text,
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1.04,
          letterSpacing: -size * 0.025,
          color: C.milk,
          textWrap: 'balance',
        }}
      >
        {lines.map((line, li) => (
          <div key={li}>
        {line.map((w, wi) => {
          const i = lines.slice(0, li).reduce((n, l) => n + l.length, 0) + wi;
          const p = pop(frame, fps, wordAt?.[i] ?? at + i * 3, { damping: 20, stiffness: 120 });
          const lit = highlight.includes(w.replace(/[.,:]/g, ''));
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: wi < line.length - 1 ? size * 0.24 : 0,
                opacity: p,
                transform: `translateY(${(1 - p) * 36}px)`,
                filter: `blur(${(1 - p) * 8}px)`,
                color: lit ? C.gold : undefined,
              }}
            >
              {w}
            </span>
          );
        })}
          </div>
        ))}
      </div>
      {sub && showSublines && (
        <div
          style={{
            marginTop: 22,
            fontFamily: FONT.text,
            fontWeight: 500,
            fontSize: 44,
            lineHeight: 1.2,
            color: C.milkMute,
            opacity: subIn,
            transform: `translateY(${(1 - subIn) * 14}px)`,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
};
