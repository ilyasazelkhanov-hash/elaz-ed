import {Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {AppWindow, Avatar, Cursor, Footline, Heading, Icon, Panel, Stage, clamp, fade, palette, pop, sceneSchema, type SceneProps} from '../design';

const HookInner = (props: SceneProps) => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  const gather = interpolate(f, [0, 2.3 * fps], [1, 0], clamp);
  return <Stage {...props} chapter={1} seconds={5}>
    <Heading title={'Ваша команда\nуже в Telegram.'} lead="Дайте ей повод собраться." accentColor={props.accentColor}/>
    <AppWindow {...props} title="Корпоративный бот" style={{top: 735, height: 745}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, color: palette.mute, fontSize: 32}}><Icon kind="telegram" size={32}/><span>Telegram · пространство команды</span></div>
      <div style={{position: 'absolute', left: 280, top: 255, width: 235, height: 235, display: 'grid', placeItems: 'center', borderRadius: 65, background: 'linear-gradient(145deg,#58C7F4,#197DC8)', boxShadow: '0 15px 65px #48BCEC30', scale: pop(f, fps, 14)}}><Icon kind="telegram" size={127} color="#FFFFFF"/></div>
      <div style={{position: 'absolute', left: 95, right: 95, top: 550, height: 103, borderRadius: 28, background: props.accentColor, color: '#182B43', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, fontSize: 43, fontWeight: 700}}>Открыть {props.brandName}<Icon kind="arrow" size={38}/></div>
    </AppWindow>
    <Panel style={{position: 'absolute', top: 570 + gather * 60, left: 105 - gather * 90, width: 390, padding: '24px 30px', display: 'flex', gap: 20, alignItems: 'center', rotate: `${-gather * 9 - 3}deg`, opacity: fade(f, 4)}}><Icon kind="users" color={props.accentColor}/><span style={{fontSize: 38, fontWeight: 600}}>Сотрудники</span></Panel>
    <Panel style={{position: 'absolute', top: 645 - gather * 30, right: 105 - gather * 50, width: 330, padding: '24px 30px', display: 'flex', gap: 20, alignItems: 'center', rotate: `${gather * 8 + 3}deg`, opacity: fade(f, 10)}}><Icon kind="news" color={palette.blue}/><span style={{fontSize: 38, fontWeight: 600}}>Новости</span></Panel>
    <Panel style={{position: 'absolute', top: 1425 + gather * 70, right: 85, width: 440, padding: '22px 32px', display: 'flex', gap: 20, alignItems: 'center', rotate: '-3deg', opacity: fade(f, 22)}}><Icon kind="gift" color={props.accentColor}/><span style={{fontSize: 38, fontWeight: 600}}>Корпоратив</span></Panel>
    <div style={{position: 'absolute', left: 115, top: 1388, display: 'flex', gap: 10, opacity: fade(f, 24)}}><Avatar name="Алина"/><Avatar name="Артём" color="#B6D9E4"/><Avatar name="Марк" color="#DBC6B2"/></div>
    <Cursor x={interpolate(f, [2.7 * fps, 3.7 * fps], [870, 665], clamp)} y={interpolate(f, [2.7 * fps, 3.7 * fps], [1510, 1326], clamp)} visible={fade(f, 2.7 * fps)} pressed={interpolate(f, [3.7 * fps, 3.85 * fps, 4 * fps], [0, 1, 0], clamp)}/>
    <Footline>Новости. Знания. Общие поводы.</Footline>
  </Stage>;
};
export const HookScene = Interactive.withSchema({Component: HookInner, componentName: '<HookScene>', schema: sceneSchema, wrapInSequence: true});
