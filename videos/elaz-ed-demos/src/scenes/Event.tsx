import {Interactive, useCurrentFrame, useVideoConfig} from 'remotion';
import {AppWindow, fade, Footline, GiftBox, Heading, Icon, palette, Panel, Pill, SceneProps, sceneSchema, Stage} from '../design';

function Event(props: SceneProps) {
  const f = useCurrentFrame(); const {fps} = useVideoConfig(); const prize = f >= 3 * fps;
  return <Stage {...props} chapter={5} seconds={7}>
    <Heading title={'До встречи\nна корпоративе.'} lead="Программа и сюрпризы — под рукой" accentColor={props.accentColor}/>
    <AppWindow {...props} style={{top: 570, height: 930}} title="Новый год вместе">
      {!prize ? <div style={{opacity: fade(f)}}>
        <Pill><Icon kind="calendar" size={36}/> 26 декабря · 18:00</Pill>
        <div style={{fontSize: 52, fontWeight: 650, margin: '36px 0'}}>Вечер нашей команды</div>
        {[['18:00', 'Встречаемся'], ['19:00', 'Играем и общаемся'], ['20:30', 'Вручаем подарки']].map(([time, text]) => <div key={time} style={{display: 'flex', gap: 24, alignItems: 'center', padding: '30px 0', borderBottom: '1px solid #FFFFFF15', fontSize: 37}}><span style={{color: props.accentColor}}>{time}</span><span>{text}</span></div>)}
        <div style={{marginTop: 35, fontSize: 35, color: palette.mute}}>Все детали в одной карточке</div>
      </div> : <div style={{opacity: fade(f, 3 * fps), textAlign: 'center'}}>
        <Pill><Icon kind="gift" size={36}/> Подарки от компании</Pill>
        <div style={{display: 'flex', justifyContent: 'center', marginTop: 38}}><GiftBox size={220} opening={0.5} color={props.accentColor}/></div>
        <div style={{fontSize: 50, fontWeight: 650, marginTop: 20}}>Праздничный набор</div>
        <Panel style={{padding: 20, marginTop: 22, fontSize: 35, lineHeight: 1.35}}>Откройте условия участия<br/><span style={{color: props.accentColor}}>и дату розыгрыша</span></Panel>
        <div style={{fontSize: 28, marginTop: 14, color: palette.mute}}>Подарки — по правилам кампании</div>
      </div>}
    </AppWindow>
    <Footline>Общий праздник начинается раньше встречи.</Footline>
  </Stage>;
}
export const EventScene = Interactive.withSchema({Component: Event, componentName: 'Корпоратив и подарки', schema: sceneSchema, wrapInSequence: true});
