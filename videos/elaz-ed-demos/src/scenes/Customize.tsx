import {Interactive, useCurrentFrame, useVideoConfig} from 'remotion';
import {fade, Footline, Heading, Icon, Orbit, palette, Panel, Pill, SceneProps, sceneSchema, Stage} from '../design';

function Customize(props: SceneProps) {
  const f = useCurrentFrame(); const {fps} = useVideoConfig(); const step = Math.min(3, Math.floor(f / fps / 2.25));
  const labels = ['Ваш бренд', 'Нужные разделы', 'Ваша кампания', 'Понятная картина'];
  return <Stage {...props} chapter={7} seconds={9} snow={0}>
    <Heading title={'Ваша команда.\nВаши задачи.'} lead="Гибкая разработка приложения" accentColor={props.accentColor}/>
    <div style={{position: 'absolute', left: 105, top: 570, width: 870, display: 'flex', gap: 14}}>{[0, 1, 2, 3].map(i => <div key={i} style={{height: 7, flex: 1, borderRadius: 8, background: i <= step ? props.accentColor : '#FFFFFF20'}}/>)}</div>
    <Panel style={{position: 'absolute', left: 105, top: 625, width: 870, height: 860, padding: 45}}>
      <div style={{opacity: fade(f % (2.25 * fps)), height: '100%'}}>
        <Pill>0{step + 1} / {labels[step]}</Pill>
        {step === 0 && <><div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 90}}><Orbit size={125} color={props.accentColor}/><span style={{fontSize: 72, fontWeight: 650}}>{props.brandName}</span></div><div style={{display: 'flex', justifyContent: 'center', gap: 27, marginTop: 65}}>{[props.accentColor, '#7ACBE8', '#8CE7C0', '#C1A6F0'].map(c => <div key={c} style={{width: 100, height: 100, borderRadius: 30, background: c, border: c === props.accentColor ? '5px solid white' : 'none'}}/>)}</div><div style={{fontSize: 40, textAlign: 'center', color: palette.mute, marginTop: 55}}>Название. Цвета. Характер.</div></>}
        {step === 1 && <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 23, marginTop: 50}}>{(['Новости', 'Курсы', 'Игры', 'Адвент'] as const).map((name, i) => <Panel key={name} style={{height: 210, padding: 30}}><Icon kind={(['news', 'book', 'play', 'calendar'] as const)[i]} color={props.accentColor} size={60}/><div style={{fontSize: 38, marginTop: 25}}>{name}</div></Panel>)}</div>}
        {step === 2 && <><div style={{fontSize: 56, fontWeight: 650, marginTop: 65}}>Новый год вместе</div>{[['Даты', '1–26 декабря'], ['Механика', 'Задания и подарки'], ['Призы', 'От вашей компании']].map(([a, b]) => <div key={a} style={{borderBottom: '1px solid #FFFFFF20', padding: '30px 0'}}><div style={{fontSize: 30, color: palette.mute}}>{a}</div><div style={{fontSize: 42, marginTop: 10}}>{b}</div></div>)}</>}
        {step === 3 && <><div style={{marginTop: 35, fontSize: 31, color: palette.mute}}>Пример данных · демонстрация</div><div style={{display: 'flex', gap: 20, marginTop: 35}}>{[['128', 'Участники'], ['84', 'Прошли урок']].map(([value, label]) => <Panel key={label} style={{flex: 1, padding: 27}}><div style={{fontSize: 76, color: props.accentColor}}>{value}</div><div style={{fontSize: 31, marginTop: 12}}>{label}</div></Panel>)}</div><div style={{display: 'flex', height: 205, alignItems: 'end', gap: 25, marginTop: 35, paddingBottom: 12, borderBottom: '1px solid #FFFFFF40'}}>{[0.32, 0.53, 0.45, 0.76, 0.61, 0.9, 0.81].map((h, i) => <div key={i} style={{flex: 1, height: `${h * 100}%`, borderRadius: '13px 13px 0 0', background: i === 5 ? props.accentColor : '#7ACBE870'}}/>)}</div><div style={{fontSize: 35, marginTop: 25}}>Участие и прохождение</div></>}
      </div>
    </Panel>
    <Footline>Сценарий и состав функций — под вашу задачу.</Footline>
  </Stage>;
}
export const CustomizeScene = Interactive.withSchema({Component: Customize, componentName: 'Настройка под компанию', schema: sceneSchema, wrapInSequence: true});
