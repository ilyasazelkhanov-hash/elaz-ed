import {Interactive, useCurrentFrame, useVideoConfig} from 'remotion';
import {display, fade, Icon, Orbit, palette, Panel, Pill, pop, SceneProps, sceneSchema, Stage} from '../design';

function Final(props: SceneProps) {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  return <Stage {...props} chapter={8} seconds={7} snow={0.25}>
    <div style={{position: 'absolute', left: 80, top: 255, right: 80, fontFamily: display, fontSize: 84, lineHeight: 1.13, fontWeight: 750, letterSpacing: -3}}>Соберём<br/>приложение для<br/>вашей команды</div>
    <div style={{position: 'absolute', top: 660, left: 80, right: 80, display: 'flex', flexWrap: 'wrap', gap: 15, opacity: fade(f, 15)}}>{['Новый год', 'Корпоратив', 'На постоянку'].map(text => <Pill key={text} style={{fontSize: 34}}>{text}</Pill>)}</div>
    <Panel style={{position: 'absolute', top: 880, left: 80, width: 920, padding: 60, borderColor: `${props.accentColor}70`, scale: pop(f, fps, 24)}}>
      <div style={{display: 'flex', gap: 22, alignItems: 'center', color: props.accentColor}}><Icon kind="telegram" size={64}/><span style={{fontSize: 44}}>Напишите {props.contact}</span></div>
      <div style={{fontFamily: display, fontSize: 88, fontWeight: 700, letterSpacing: -3, marginTop: 38}}>КОМАНДА</div>
      <div style={{fontSize: 39, color: palette.mute, marginTop: 30, lineHeight: 1.3}}>Обсудим идею<br/>и подходящий формат</div>
    </Panel>
    <div style={{position: 'absolute', left: 80, top: 1485, right: 80, display: 'flex', gap: 24, alignItems: 'center', opacity: fade(f, 40)}}><Orbit size={72} color={props.accentColor}/><div style={{fontSize: 33, color: palette.mute}}>Elaz Ed · разработка<br/>приложений в Telegram</div></div>
  </Stage>;
}
export const FinalScene = Interactive.withSchema({Component: Final, componentName: 'Приглашение', schema: sceneSchema, wrapInSequence: true});
