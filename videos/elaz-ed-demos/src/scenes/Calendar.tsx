import {Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {AppWindow, Cursor, Footline, GiftBox, Heading, Icon, Panel, Pill, Stage, clamp, display, fade, palette, pop, sceneSchema, type SceneProps} from '../design';

const CalendarInner = (props: SceneProps) => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  const reveal = fade(f, 3.4 * fps, 14);
  const opening = interpolate(f, [4.1 * fps, 5.15 * fps], [0, 1], clamp);
  return <Stage {...props} chapter={2} seconds={7}>
    <Heading title={'Адвент\nвашей команды.'} lead="Вместе до Нового года" accentColor={props.accentColor}/>
    <AppWindow {...props} title="Праздник начинается с вас" style={{top: 560}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25}}><Pill color={props.accentColor}><Icon kind="calendar" size={34}/>24 дня вместе</Pill><span style={{fontSize: 32, color: palette.mute}}>Привет, Алина</span></div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 13}}>
        {Array.from({length: 24}, (_, i) => <div key={i} style={{position: 'relative', height: 120, borderRadius: 23, border: `1px solid ${i === 6 ? props.accentColor : '#FFFFFF1B'}`, background: i === 6 ? `linear-gradient(140deg,${props.accentColor},#C99542)` : i < 6 ? '#203851' : '#132640', color: i === 6 ? '#2A2940' : i < 6 ? '#AACABB' : '#8C9BB3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: display, fontSize: 41, fontWeight: 650, opacity: pop(f, fps, 8 + i * 1.2), scale: i === 6 ? 1 + Math.sin(f / 13) * 0.02 : 1}}>{i < 6 ? <Icon kind="check" size={40} color={palette.mint}/> : i + 1}{i === 6 && <span style={{position: 'absolute', bottom: 10, fontFamily: 'Onest', fontSize: 14, letterSpacing: 1, fontWeight: 800}}>СЕГОДНЯ</span>}</div>)}
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 16, marginTop: 28, color: palette.mint, fontSize: 34}}><Icon kind="bolt" size={30}/>Открыто 6 дверей · серия 6 дней</div>
    </AppWindow>
    <Cursor x={interpolate(f, [2.3 * fps, 3.2 * fps], [900, 190], clamp)} y={interpolate(f, [2.3 * fps, 3.2 * fps], [1500, 1000], clamp)} visible={fade(f, 2.2 * fps) * (1 - reveal)} pressed={interpolate(f, [3.1 * fps, 3.25 * fps, 3.4 * fps], [0, 1, 0], clamp)}/>
    <Panel style={{position: 'absolute', top: 740, left: 220, width: 640, height: 750, textAlign: 'center', opacity: reveal, scale: pop(f, fps, 3.4 * fps), background: 'linear-gradient(155deg,#1D4163,#132339)', borderColor: `${props.accentColor}70`}}>
      <Pill color={props.accentColor}>ДВЕРЬ №7</Pill>
      <div style={{position: 'absolute', top: 90, left: 60, width: 520, height: 400, background: `radial-gradient(ellipse,${props.accentColor}65,transparent 66%)`, opacity: opening}}/>
      <div style={{position: 'absolute', top: 260, left: 182}}><GiftBox size={275} color={props.accentColor} opening={opening}/></div>
      <div style={{position: 'absolute', left: 35, right: 35, bottom: 60, fontFamily: display, fontSize: 47, lineHeight: 1.2, opacity: opening}}>Что приготовила<br/>ваша команда?</div>
    </Panel>
    <Footline>Одна дверь. Один новый повод зайти.</Footline>
  </Stage>;
};
export const CalendarScene = Interactive.withSchema({Component: CalendarInner, componentName: '<CalendarScene>', schema: sceneSchema, wrapInSequence: true});
