import {Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {AppWindow, Avatar, Cursor, Footline, Heading, Icon, Panel, Pill, Stage, clamp, display, fade, palette, pop, sceneSchema, type SceneProps} from '../design';

const KnowledgeInner = (props: SceneProps) => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  const quiz = f >= 2.3 * fps; const correct = f >= 5.2 * fps;
  return <Stage {...props} chapter={3} seconds={9}>
    <Heading title={'Узнать.\nПоучаствовать.'} lead="Небольшие шаги — общий опыт" accentColor={props.accentColor}/>
    <AppWindow {...props} title="День 7 · наш подход" style={{top: 570, minHeight: 870}}>
      {!quiz ? <div style={{opacity: interpolate(f, [1.85 * fps, 2.3 * fps], [1, 0], clamp), translate: `0px ${interpolate(f, [0, 18], [30, 0], clamp)}px`}}>
        <Pill color={props.accentColor}><Icon kind="book" size={32}/>История компании</Pill>
        <div style={{fontFamily: display, fontSize: 57, lineHeight: 1.22, marginTop: 37}}>Начинаем<br/>с задачи клиента.</div>
        <p style={{fontSize: 43, lineHeight: 1.38, color: '#BCCBDD', margin: '26px 0 0'}}>Слушаем, разбираемся<br/>и вместе ищем решение.</p>
        <div style={{marginTop: 45, display: 'flex', alignItems: 'center', gap: 20, fontSize: 38}}><Icon kind="clock" size={34} color={props.accentColor}/>Короткая история · 2 минуты</div>
      </div> : <div style={{opacity: fade(f, 2.3 * fps)}}>
        <Pill color={props.accentColor}>КВИЗ · 1 ИЗ 1</Pill>
        <div style={{fontFamily: display, fontSize: 43, lineHeight: 1.28, marginTop: 29, marginBottom: 28}}>Что мы ценим в работе<br/>с клиентами?</div>
        <div style={{padding: '25px 26px', borderRadius: 23, border: `2px solid ${correct ? palette.mint : '#FFFFFF30'}`, background: correct ? '#8CE7C01C' : '#FFFFFF08', display: 'flex', gap: 19, alignItems: 'center', fontSize: 42, fontWeight: 550}}><span style={{display: 'grid', placeItems: 'center', width: 50, height: 50, borderRadius: '50%', background: correct ? palette.mint : '#FFFFFF12', color: '#153847', flexShrink: 0}}>{correct ? <Icon kind="check" size={34}/> : 'А'}</span>Помогаем решить задачу</div>
        <div style={{padding: '25px 26px', marginTop: 17, borderRadius: 23, border: '1px solid #FFFFFF20', color: correct ? '#889CAF' : '#DCE3E7', display: 'flex', gap: 19, alignItems: 'center', fontSize: 41}}><span style={{width: 50, textAlign: 'center'}}>Б</span>Только скорость ответа</div>
        {correct && <div style={{marginTop: 29, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: pop(f, fps, 5.2 * fps)}}><span style={{color: palette.mint, fontSize: 39, fontWeight: 650}}>Верно. Хороший старт!</span><Pill color={props.accentColor}><Icon kind="bolt" size={29}/>+40 XP</Pill></div>}
      </div>}
    </AppWindow>
    <Cursor x={interpolate(f, [4.15 * fps, 5.05 * fps], [890, 640], clamp)} y={interpolate(f, [4.15 * fps, 5.05 * fps], [1440, 994], clamp)} visible={fade(f, 4.1 * fps) * (1 - fade(f, 5.55 * fps))} pressed={interpolate(f, [5 * fps, 5.13 * fps, 5.25 * fps], [0, 1, 0], clamp)}/>
    <Panel style={{position: 'absolute', top: 1420, left: 150, width: 780, padding: '24px 32px', display: 'flex', gap: 20, alignItems: 'center', opacity: pop(f, fps, 6.3 * fps), translate: `0px ${interpolate(f, [6.3 * fps, 7 * fps], [50, 0], clamp)}px`}}><Avatar name="Артём" size={57} color="#A9D8DF"/><div style={{fontSize: 35}}>Артём тоже открыл дверь дня</div><Icon kind="check" size={36} color={palette.mint}/></Panel>
    <Footline>Знания и участие — в одном месте.</Footline>
  </Stage>;
};
export const KnowledgeScene = Interactive.withSchema({Component: KnowledgeInner, componentName: '<KnowledgeScene>', schema: sceneSchema, wrapInSequence: true});
