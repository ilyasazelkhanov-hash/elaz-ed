import {Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {AppWindow, Avatar, clamp, fade, Footline, GiftBox, Heading, Icon, palette, Panel, Pill, SceneProps, sceneSchema, Stage} from '../design';

function Games(props: SceneProps) {
  const f = useCurrentFrame(); const {fps} = useVideoConfig(); const t = f / fps;
  const reveal = interpolate(t, [3.3, 4.8], [0, 100], clamp);
  return <Stage {...props} chapter={4} seconds={8}>
    <Heading title={'Есть повод\nзайти ещё раз.'} lead="Игры, достижения и личный рейтинг" accentColor={props.accentColor}/>
    <AppWindow {...props} style={{top: 570, height: 940}}>
      {t < 3 ? <div style={{opacity: fade(f), position: 'relative', height: 650, overflow: 'hidden'}}>
        <Pill><Icon kind="gift" size={35}/> Поймай подарки</Pill>
        <div style={{position: 'absolute', right: 0, top: 15, fontSize: 42, color: props.accentColor}}>+{Math.min(3, Math.floor(t * 1.4)) * 10}</div>
        {[0, 1, 2, 3].map(i => <div key={i} style={{position: 'absolute', left: 85 + i * 145, top: 130 + ((f * 5 + i * 130) % 350), rotate: `${Math.sin(f / 12 + i) * 12}deg`}}><GiftBox size={95} color={i % 2 ? '#7ACBE8' : props.accentColor}/></div>)}
        <div style={{position: 'absolute', left: 220 + Math.sin(f / 17) * 150, top: 515, width: 230, height: 100, borderRadius: '12px 12px 60px 60px', border: '5px solid #FFD166', background: '#FFD16625', textAlign: 'center', paddingTop: 20, fontSize: 36}}>Корзина</div>
      </div> : t < 5.4 ? <div style={{opacity: fade(f, 3 * fps), height: 650}}>
        <Pill><Icon kind="star" size={35}/> Сотри и узнай</Pill>
        <Panel style={{position: 'relative', height: 390, marginTop: 45, overflow: 'hidden', display: 'grid', placeItems: 'center', textAlign: 'center'}}>
          <div><Icon kind="star" size={100} color={props.accentColor}/><div style={{fontSize: 52, marginTop: 20}}>+20 XP</div><div style={{fontSize: 34, color: palette.mute}}>Бонус дня</div></div>
          <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 0 0 ${reveal}%)`, background: 'repeating-linear-gradient(135deg,#637B97 0px,#A8BAC9 25px,#788FA7 50px)', display: 'grid', placeItems: 'center', fontSize: 44}}>Сотри покрытие</div>
        </Panel>
      </div> : <div style={{opacity: fade(f, 5.4 * fps), height: 650}}>
        <Pill><Icon kind="trophy" size={35}/> Личный рейтинг</Pill>
        {[['1', 'Мария', '420'], ['2', 'Алина', '390'], ['3', 'Артём', '365']].map(([place, name, score]) => <div key={name} style={{display: 'flex', alignItems: 'center', gap: 20, padding: '23px 20px', marginTop: 20, borderRadius: 24, background: name === 'Алина' ? '#FFD16620' : '#FFFFFF07', border: `1px solid ${name === 'Алина' ? '#FFD16680' : '#FFFFFF15'}`, fontSize: 37}}><span style={{width: 30, color: props.accentColor}}>{place}</span><Avatar name={name} size={60}/><span>{name}</span><span style={{marginLeft: 'auto'}}>{score} XP</span></div>)}
        <div style={{marginTop: 30, fontSize: 35, color: palette.mint, display: 'flex', gap: 14}}><Icon kind="check" size={40}/> Достижение «В игре»</div>
      </div>}
    </AppWindow>
    <Footline>Участвуйте. Копите опыт. Растите в рейтинге.</Footline>
  </Stage>;
}
export const GamesScene = Interactive.withSchema({Component: Games, componentName: 'Игры и рейтинг', schema: sceneSchema, wrapInSequence: true});
