import {Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {AppWindow, clamp, fade, Footline, Heading, Icon, palette, Panel, Pill, SceneProps, sceneSchema, Stage} from '../design';

function Evergreen(props: SceneProps) {
  const f = useCurrentFrame(); const {fps} = useVideoConfig(); const t = f / fps;
  const progress = interpolate(t, [4.6, 6.3], [40, 100], clamp);
  return <Stage {...props} chapter={6} seconds={8} snow={interpolate(t, [0, 2], [0.8, 0], clamp)}>
    <Heading title={'И после\nпраздника.'} lead="Одно пространство на каждый день" accentColor={props.accentColor}/>
    <AppWindow {...props} style={{top: 570, height: 935}}>
      {t < 3.6 ? <div style={{opacity: fade(f)}}>
        <Panel style={{padding: 30, marginBottom: 23}}><Pill color={palette.blue} style={{fontSize: 29}}><Icon kind="news" size={30}/> Новости команды</Pill><div style={{fontSize: 43, lineHeight: 1.2, marginTop: 25}}>Новый проект.<br/>Общие планы.</div><div style={{fontSize: 31, color: palette.mute, marginTop: 17}}>Главное — в короткой статье</div></Panel>
        <Panel style={{padding: 30}}><Pill color={palette.mint} style={{fontSize: 29}}><Icon kind="users" size={30}/> Первые дни в компании</Pill><div style={{fontSize: 42, marginTop: 25}}>Знакомство с командой</div><div style={{fontSize: 31, color: palette.mute, marginTop: 17}}>Материалы для новичка</div></Panel>
      </div> : <div style={{opacity: fade(f, 3.6 * fps)}}>
        <Pill color={palette.blue}><Icon kind="book" size={35}/> Курс о продукте</Pill>
        <div style={{fontSize: 53, fontWeight: 650, marginTop: 40, lineHeight: 1.2}}>Понимать продукт.<br/>Помогать клиенту.</div>
        <div style={{marginTop: 38, fontSize: 36, color: palette.mute}}>Модуль 1 · Ключевые возможности</div>
        <div style={{height: 18, borderRadius: 12, background: '#FFFFFF15', marginTop: 35, overflow: 'hidden'}}><div style={{height: '100%', width: `${progress}%`, background: palette.mint}}/></div>
        <div style={{marginTop: 25, fontSize: 37, color: palette.mint}}>{progress === 100 ? 'Модуль завершён' : 'Ваш прогресс'}</div>
        <Panel style={{marginTop: 42, padding: 32, display: 'flex', gap: 24, alignItems: 'center'}}><Icon kind={progress === 100 ? 'check' : 'play'} color={palette.mint} size={64}/><div style={{fontSize: 36}}>{progress === 100 ? 'Следующий шаг — рядом' : 'Учиться в своём темпе'}</div></Panel>
      </div>}
    </AppWindow>
    <Footline>Новости, адаптация и обучение круглый год.</Footline>
  </Stage>;
}
export const EvergreenScene = Interactive.withSchema({Component: Evergreen, componentName: 'После праздника', schema: sceneSchema, wrapInSequence: true});
