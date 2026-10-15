// 00:44–00:53. Из карточки приложения раскрывается панель настроек. По шагам:
// логотип и палитра → разделы → даты календаря → задания и призы → статистика.
// Перекраска — отдельный понятный эпизод: из шаблона Elaz Ed круговой волной проступает бренд «Орбиты».
// Перекраска изображает работу разработки; редакторы контента и календаря — существующие механики.
// Темп здесь спокойнее: заказчик должен успеть рассмотреть управление.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useDemo, type Palette } from '../props';
import { alpha, APP, C, ease, FONT, mix, mixColor, pop } from '../style';
import { sceneSpec } from '../timeline';
import { Caption } from '../ui/Caption';
import { Garland } from '../ui/Garland';
import { AppWindow, Bar, BrandLockup, doorRadius, Touch } from '../ui/kit';

const STEPS = [
  { id: 'brand', label: 'Бренд', from: 30 },
  { id: 'sections', label: 'Разделы', from: 92 },
  { id: 'dates', label: 'Даты', from: 136 },
  { id: 'tasks', label: 'Задания', from: 172 },
  { id: 'stats', label: 'Статистика', from: 208 },
] as const;
const stepEnd = (i: number) => (i < STEPS.length - 1 ? STEPS[i + 1].from : 999);

const SECTIONS = ['Адвент-календарь', 'Новости', 'Курсы', 'Игры', 'Рейтинг'];

const PREVIEW = { scale: 0.5, x: 540 - (APP.w * 0.5) / 2, y: 540 };
const PANEL = { x: 80, y: 1120, w: 920, h: 520 };

/** Экран сотрудника внутри превью — в полном размере, сжимается снаружи. */
const PreviewHome: React.FC<{ palette: Palette; name: string; mark: 'template' | 'brand'; sectionsOn: number[]; calendar: number; frame: number }> = ({ palette: p, name, mark, sectionsOn, calendar, frame }) => (
  <AppWindow palette={p} title={name} box={{ x: 0, y: 0, w: APP.w, h: APP.h, radius: APP.radius }} style={{ boxShadow: 'none' }}>
    <div style={{ position: 'absolute', left: 40, top: 30 }}>
      {mark === 'brand' ? (
        <BrandLockup name={name} palette={p} size={1} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 78, height: 78, borderRadius: 24, background: C.aurora, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.accent, fontWeight: 700, fontSize: 40, color: '#fff' }}>E</div>
          <div style={{ fontFamily: FONT.accent, fontWeight: 600, fontSize: 40, color: p.ink }}>{name}</div>
        </div>
      )}
    </div>
    <div style={{ position: 'absolute', left: 40, right: 40, top: 150, height: 300, borderRadius: 44, overflow: 'hidden', background: `radial-gradient(70% 90% at 85% 30%, ${alpha(p.primary, 0.5)}, transparent 70%), linear-gradient(160deg, ${mixColor(p.card, p.primary, 0.25)}, ${p.surface})` }}>
      <div style={{ position: 'absolute', left: -10, top: -8, opacity: calendar }}>
        <Garland width={840} frame={frame} spans={3} sag={22} seed="preview" />
      </div>
      <div style={{ position: 'absolute', left: 44, bottom: 44, fontFamily: FONT.accent, fontWeight: 600, fontSize: 56, lineHeight: 1.1, color: p.ink, width: 600 }}>{calendar > 0.5 ? 'Вместе до Нового года' : 'Пространство команды'}</div>
      <div style={{ position: 'absolute', right: 50, bottom: 40, width: 150, height: 200, borderRadius: doorRadius(150), background: `linear-gradient(180deg, ${p.accent}, ${mixColor(p.accent, '#000000', 0.3)})` }} />
    </div>
    {SECTIONS.map((s, i) => {
      const on = sectionsOn[i] ?? 0;
      const order = sectionsOn.slice(0, i).filter((x) => x > 0.5).length;
      return (
        <div key={s} style={{ position: 'absolute', left: 40, right: 40, top: 480 + order * 104, height: 92, borderRadius: 30, background: p.card, display: 'flex', alignItems: 'center', gap: 24, padding: '0 28px', opacity: on, transform: `scale(${mix(0.9, 1, on)})` }}>
          <div style={{ width: 56, height: 62, borderRadius: doorRadius(56), background: i === 0 ? p.accent : alpha(p.primary, 0.5) }} />
          <div style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 42, color: p.ink }}>{s}</div>
        </div>
      );
    })}
  </AppWindow>
);

const Switch: React.FC<{ on: number; color: string; track: string }> = ({ on, color, track }) => (
  <div style={{ width: 100, height: 58, borderRadius: 29, background: on > 0.5 ? color : track, position: 'relative' }}>
    <div style={{ position: 'absolute', top: 6, left: mix(6, 48, on), width: 46, height: 46, borderRadius: '50%', background: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.25)' }} />
  </div>
);

export const CustomizeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const demo = useDemo();
  const brand = demo.company.palette;
  const tpl = demo.templatePalette;
  const spec = sceneSpec('customize');

  // Окно приложения сжимается в карточку-превью, снизу выезжает панель.
  const shrink = ease(frame, [8, 38]);
  const scale = mix(1, PREVIEW.scale, shrink);
  const left = mix(APP.x, PREVIEW.x, shrink);
  const top = mix(APP.y, PREVIEW.y, shrink);
  const panelIn = pop(frame, fps, 14, { damping: 20 });

  const active = STEPS.reduce((acc, s, i) => (frame >= s.from ? i : acc), 0);
  const local = frame - STEPS[active].from;

  // шаг 1: касание образца палитры → волна перекраски
  const swatchTouch = ease(frame, [40, 54]);
  const swatchPress = ease(frame, [54, 64]);
  // Сначала бренд «снимается» до шаблона, потом после выбора палитры проступает обратно.
  const unwrap = ease(frame, [20, 42]);
  const wipe = ease(frame, [58, 90]);
  const brandR = frame < 50 ? mix(1500, 0, unwrap) : mix(0, 1500, wipe);
  const waving = (unwrap > 0 && unwrap < 1) || (wipe > 0 && wipe < 1);
  const logoDrop = pop(frame, fps, 62, { damping: 14 });
  // шаг 2: разделы включаются по одному
  const sectionsOn = SECTIONS.map((_, i) => (i === 0 ? 1 : ease(frame, [100 + i * 7, 106 + i * 7])));
  // шаг 3: календарь
  const calendar = ease(frame, [140, 154]);

  const previewStyle: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: APP.w, height: APP.h };

  const swatches = [tpl.primary, brand.primary, '#4DD4A0', '#FF8A6B'];
  const swatchCenter = { x: PANEL.x + 60 + 1 * 132 + 48, y: PANEL.y + 330 + 48 };

  return (
    <AbsoluteFill>
      <Caption text={spec.captions[0]} sub={spec.sublines[0]} at={10} out={84} />
      <Caption text={spec.captions[1]} sub={spec.sublines[1]} at={96} out={200} />
      <Caption text={spec.captions[2]} sub={spec.sublines[2]} at={212} size={84} top={160} />

      {/* превью: шаблон снизу, бренд проступает волной сверху */}
      <div style={{ position: 'absolute', left, top, width: APP.w, height: APP.h, transform: `scale(${scale})`, transformOrigin: '0 0', borderRadius: APP.radius, overflow: 'hidden', boxShadow: '0 60px 140px rgba(0,4,18,0.65)' }}>
        <div style={previewStyle}>
          <PreviewHome palette={tpl} name="Elaz Ed" mark="template" sectionsOn={sectionsOn} calendar={calendar} frame={frame} />
        </div>
        {brandR > 0 && (
          <div style={{ ...previewStyle, clipPath: `circle(${brandR}px at 50% 115%)` }}>
            <PreviewHome palette={brand} name={demo.company.name} mark="brand" sectionsOn={sectionsOn} calendar={calendar} frame={frame} />
          </div>
        )}
        {/* кольцо волны */}
        {waving && (
          <div style={{ position: 'absolute', left: APP.w / 2 - brandR, top: APP.h * 1.15 - brandR, width: brandR * 2, height: brandR * 2, borderRadius: '50%', border: `10px solid ${alpha(frame < 50 ? tpl.primary : brand.primary, 0.85)}`, pointerEvents: 'none' }} />
        )}
      </div>
      {/* подпись к превью */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: PREVIEW.y - 52, textAlign: 'center', fontFamily: FONT.text, fontWeight: 600, fontSize: 30, color: C.milkMute, opacity: shrink * (1 - ease(frame, [200, 212])) }}>
        {brandR < 700 ? 'Основа — шаблон Elaz Ed' : `Приложение «${demo.company.name}»`}
      </div>

      {/* панель настроек */}
      <div
        style={{
          position: 'absolute',
          left: PANEL.x,
          top: PANEL.y,
          width: PANEL.w,
          height: PANEL.h,
          borderRadius: 52,
          background: alpha('#0E2447', 0.97),
          border: `2px solid ${C.line}`,
          boxShadow: '0 40px 100px rgba(0,0,0,0.55)',
          opacity: panelIn,
          transform: `translateY(${(1 - panelIn) * 200}px)`,
          overflow: 'hidden',
        }}
      >
        {/* навигация по шагам */}
        <div style={{ position: 'absolute', left: 40, right: 40, top: 34, display: 'flex', gap: 10 }}>
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              style={{
                flex: i === active ? 1.6 : 1,
                height: 56,
                borderRadius: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: FONT.text,
                fontWeight: 700,
                fontSize: 26,
                color: i === active ? '#0B1730' : i < active ? C.milk : C.milkMute,
                background: i === active ? C.gold : i < active ? alpha(C.ice, 0.18) : alpha(C.milk, 0.06),
              }}
            >
              {i === active ? `${i + 1}. ${s.label}` : i + 1}
            </div>
          ))}
        </div>

        {STEPS.map((s, i) => {
          const vis = ease(frame, [s.from, s.from + 10]) * (1 - ease(frame, [stepEnd(i) - 6, stepEnd(i)]));
          if (vis <= 0) return null;
          return (
            <div key={s.id} style={{ position: 'absolute', left: 60, right: 60, top: 122, bottom: 30, opacity: vis, transform: `translateY(${(1 - vis) * 20}px)` }}>
              {s.id === 'brand' && (
                <>
                  <StepTitle title="Логотип и палитра" note="Оформление под бренд — часть разработки" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 34 }}>
                    <div style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 34, color: C.milkMute, width: 160 }}>Логотип</div>
                    <div style={{ height: 96, padding: '0 28px', borderRadius: 28, background: alpha(C.milk, 0.06), display: 'flex', alignItems: 'center', transform: `scale(${mix(0.85, 1, logoDrop)})` }}>
                      {logoDrop > 0.05 ? <BrandLockup name={demo.company.name} palette={brand} size={0.8} /> : <span style={{ fontFamily: FONT.text, fontSize: 32, color: C.milkMute }}>Загрузить</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 36, marginTop: 30 }}>
                    {swatches.map((c, k) => {
                      const selected = k === 1 ? swatchPress > 0.5 : k === 0 ? swatchPress <= 0.5 : false;
                      return <div key={c} style={{ width: 96, height: 96, borderRadius: '50%', background: c, boxShadow: selected ? `0 0 0 6px #0E2447, 0 0 0 11px ${C.milk}` : 'none' }} />;
                    })}
                  </div>
                </>
              )}
              {s.id === 'sections' && (
                <>
                  <StepTitle title="Набор разделов" note="Только то, что нужно вашей команде" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 40, rowGap: 22, marginTop: 30 }}>
                    {SECTIONS.map((name, k) => (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
                        <span style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 34, color: C.milk }}>{name === 'Адвент-календарь' ? 'Адвент' : name}</span>
                        <Switch on={sectionsOn[k]} color={C.gold} track={alpha(C.milk, 0.15)} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              {s.id === 'dates' && (
                <>
                  <StepTitle title="Даты календаря" note={`${demo.advent.totalDoors} двери · по одной в день`} />
                  <div style={{ fontFamily: FONT.accent, fontWeight: 600, fontSize: 60, color: C.gold, marginTop: 30 }}>{demo.advent.dates}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 30 }}>
                    {Array.from({ length: demo.advent.totalDoors }, (_, k) => (
                      <div key={k} style={{ flex: 1, height: 64, borderRadius: '14px 14px 6px 6px', background: ease(local, [4 + k * 1, 8 + k * 1]) > 0.5 ? (k === demo.advent.todayDoor - 1 ? C.gold : alpha(C.ice, 0.55)) : alpha(C.milk, 0.08) }} />
                    ))}
                  </div>
                </>
              )}
              {s.id === 'tasks' && (
                <>
                  <StepTitle title="Задания и призы" />
                  <Field label={`День ${demo.advent.todayDoor}`} value="Квиз о ценностях компании" />
                  <Field label="Приз" value={`${demo.prize.title} · лимит ${demo.prize.stock}`} />
                  <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
                    {['За N дверей', 'Подарок дней', 'Случайный', 'Розыгрыш'].map((m, k) => {
                      const pick = Math.min(3, Math.floor(ease(local, [6, 30]) * 4));
                      return (
                        <div key={m} style={{ flex: 1, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.text, fontWeight: 700, fontSize: 25, color: k === pick ? '#0B1730' : C.milkMute, background: k === pick ? C.milk : alpha(C.milk, 0.07) }}>
                          {m}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {s.id === 'stats' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 48, color: C.milk }}>Статистика</div>
                    <div style={{ padding: '8px 20px', borderRadius: 999, border: `2px solid ${alpha(C.gold, 0.7)}`, fontFamily: FONT.text, fontWeight: 700, fontSize: 28, color: C.gold }}>Пример данных</div>
                  </div>
                  {[
                    ['Открыли приложение', 214],
                    ['Прошли урок', 163],
                    ['Прошли три урока', 118],
                    ['Держали стрик три дня', 97],
                  ].map(([label, value], k) => {
                    const g = ease(local, [4 + k * 4, 22 + k * 4]);
                    return (
                      <div key={label as string} style={{ marginTop: k === 0 ? 20 : 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.text, fontWeight: 600, fontSize: 32, color: C.milk }}>
                          <span>{label}</span>
                          <span style={{ fontFamily: FONT.accent, fontVariantNumeric: 'tabular-nums' }}>{Math.round((value as number) * g)}</span>
                        </div>
                        <Bar progress={((value as number) / 214) * g} color={k === 0 ? C.gold : C.ice} track={alpha(C.milk, 0.08)} height={14} style={{ marginTop: 8 }} />
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>

      <Touch x={mix(swatchCenter.x + 220, swatchCenter.x, swatchTouch)} y={mix(swatchCenter.y + 200, swatchCenter.y, swatchTouch)} opacity={swatchTouch * (1 - ease(frame, [66, 76]))} press={swatchPress} />
    </AbsoluteFill>
  );
};

const StepTitle: React.FC<{ title: string; note?: string }> = ({ title, note }) => (
  <div>
    <div style={{ fontFamily: FONT.text, fontWeight: 800, fontSize: 48, color: C.milk }}>{title}</div>
    {note && <div style={{ fontFamily: FONT.text, fontWeight: 500, fontSize: 30, color: C.milkMute, marginTop: 6 }}>{note}</div>}
  </div>
);

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 22, height: 84, marginTop: 18, padding: '0 26px', borderRadius: 24, background: alpha(C.milk, 0.06), border: `1.5px solid ${C.line}` }}>
    <span style={{ fontFamily: FONT.text, fontWeight: 700, fontSize: 30, color: C.gold, minWidth: 110 }}>{label}</span>
    <span style={{ fontFamily: FONT.text, fontWeight: 600, fontSize: 34, color: C.milk }}>{value}</span>
  </div>
);
