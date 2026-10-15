import type {CSSProperties, ReactNode} from 'react';
import {loadFont} from '@remotion/fonts';
import {Interactive, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig, type InteractivitySchema} from 'remotion';

void Promise.all([
  loadFont({family: 'Onest', url: staticFile('fonts/onest-cyrillic.woff2'), weight: '100 900'}),
  loadFont({family: 'Onest', url: staticFile('fonts/onest-latin.woff2'), weight: '100 900'}),
  loadFont({family: 'Unbounded', url: staticFile('fonts/unbounded-cyrillic.woff2'), weight: '100 900'}),
  loadFont({family: 'Unbounded', url: staticFile('fonts/unbounded-latin.woff2'), weight: '100 900'}),
]);

export type SceneProps = {brandName: string; accentColor: string; contact: string; style?: CSSProperties};
export const sceneSchema = {
  brandName: {type: 'text-content', default: 'Орбита', description: 'Название компании'},
  accentColor: {type: 'color', default: '#FFD166', description: 'Акцент бренда'},
  contact: {type: 'text-content', default: '@elazart', description: 'Контакт'},
} as const satisfies InteractivitySchema;

export const palette = {navy: '#071630', ink: '#F4F1E8', mute: '#AAB9D0', mint: '#8CE7C0', blue: '#7ACBE8'};
export const display = 'Unbounded, sans-serif';
export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const fade = (f: number, from = 0, span = 12) => interpolate(f, [from, from + span], [0, 1], clamp);
export const pop = (f: number, fps: number, delay = 0) => spring({frame: f - delay, fps, config: {damping: 19, stiffness: 140, mass: 0.85}});

type IconKind = 'telegram' | 'gift' | 'book' | 'news' | 'users' | 'check' | 'star' | 'arrow' | 'chart' | 'calendar' | 'trophy' | 'play' | 'clock' | 'bolt';
const paths: Record<IconKind, string> = {
  telegram: 'M3 11L21 3L17 21L11 15L7 18L8 13L17 7L10 12Z',
  gift: 'M3 9H21V13H3ZM5 13V21H19V13M12 9V21M12 9C2 9 5 0 10 4L12 9C22 9 19 0 14 4Z',
  book: 'M12 5C8 2 4 2 2 3V20C5 19 9 19 12 22C15 19 19 19 22 20V3C19 2 15 2 12 5ZM12 5V22',
  news: 'M5 3H19V21H5ZM8 7H16M8 11H16M8 15H12',
  users: 'M16 22V18C16 13 2 13 2 18V22M13 7A4 4 0 1 1 5 7A4 4 0 1 1 13 7M16 4C21 4 21 11 16 11M19 14C23 15 23 19 23 22',
  check: 'M4 12L10 18L21 5',
  star: 'M12 2L15 8L22 9L17 14L18 22L12 18L6 22L7 14L2 9L9 8Z',
  arrow: 'M4 12H20M13 5L20 12L13 19',
  chart: 'M3 3V21H22M7 16V11M12 16V7M17 16V4',
  calendar: 'M3 5H21V22H3ZM7 2V8M17 2V8M3 11H21M8 15H9M15 15H16M8 19H9',
  trophy: 'M7 3H17V9C17 17 7 17 7 9ZM7 5H2V8C2 12 7 12 7 12M17 5H22V8C22 12 17 12 17 12M12 15V21M7 22H17',
  play: 'M7 3L21 12L7 21Z',
  clock: 'M22 12A10 10 0 1 1 2 12A10 10 0 1 1 22 12M12 5V12L17 15',
  bolt: 'M14 1L3 14H11L10 23L21 10H13Z',
};
export const Icon = ({kind, size = 48, color = 'currentColor'}: {kind: IconKind; size?: number; color?: string}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]}/></svg>
);

export const Orbit = ({size = 64, color = '#FFD166'}: {size?: number; color?: string}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <ellipse cx="50" cy="50" rx="43" ry="18" stroke={color} strokeWidth="4" transform="rotate(-32 50 50)"/>
    <ellipse cx="50" cy="50" rx="43" ry="18" stroke={color} strokeWidth="4" transform="rotate(32 50 50)"/>
    <circle cx="50" cy="50" r="10" fill={color}/><circle cx="85" cy="25" r="5" fill={color}/>
  </svg>
);

export function Background({snow = 1}: {snow?: number}) {
  const f = useCurrentFrame();
  return <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: 'radial-gradient(ellipse at 85% 20%, #183C62 0%, transparent 50%), radial-gradient(ellipse at 0% 90%, #132540 0%, transparent 60%), #071630'}}>
    <div style={{position: 'absolute', inset: 0, opacity: 0.17, backgroundImage: 'radial-gradient(#96BADD 1px, transparent 1px)', backgroundSize: '32px 32px'}}/>
    <svg width="1600" height="1600" style={{position: 'absolute', left: -260, top: 120, rotate: `${f * 0.012}deg`, opacity: 0.11}} viewBox="0 0 1600 1600"><ellipse cx="800" cy="800" rx="620" ry="340" fill="none" stroke="#9AC6DF" strokeWidth="1" transform="rotate(-30 800 800)"/><ellipse cx="800" cy="800" rx="620" ry="340" fill="none" stroke="#9AC6DF" strokeWidth="1" transform="rotate(30 800 800)"/></svg>
    {Array.from({length: 40}, (_, i) => {
      const size = 2 + random(`size-${i}`) * 5;
      return <div key={i} style={{position: 'absolute', left: random(`x-${i}`) * 1080 + Math.sin(f / 80 + i) * 20, top: (random(`y-${i}`) * 1920 + f * (0.3 + random(`speed-${i}`) * 0.8)) % 1920, width: size, height: size, borderRadius: '50%', background: '#DAE8EE', opacity: snow * (0.16 + random(`opacity-${i}`) * 0.5)}}/>;
    })}
    <div style={{position: 'absolute', left: 80, right: 80, top: 100, height: 1, background: 'linear-gradient(90deg, transparent, #9CAAC64D, transparent)'}}/>
  </div>;
}

export function Stage({children, chapter, seconds, brandName, accentColor, style, snow = 1}: SceneProps & {children: ReactNode; chapter: number; seconds: number; snow?: number}) {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  return <Interactive.Div name="Сцена" style={{position: 'absolute', inset: 0, background: palette.navy, color: palette.ink, fontFamily: 'Onest, sans-serif', overflow: 'hidden', ...style}}>
    <Background snow={snow}/>
    <div style={{position: 'absolute', left: 80, top: 136, display: 'flex', alignItems: 'center', gap: 14}}><Orbit size={42} color={accentColor}/><span style={{fontWeight: 650, fontSize: 32, letterSpacing: 2}}>{brandName.toUpperCase()}</span></div>
    <div style={{position: 'absolute', top: 145, right: 80, fontSize: 26, color: '#AAB9D0', letterSpacing: 3}}>0{chapter} / 08</div>
    <div style={{position: 'absolute', inset: 0, opacity: interpolate(f, [0, 9, seconds * fps - 8, seconds * fps - 1], [0.2, 1, 1, 0.08], clamp), translate: `0px ${interpolate(f, [0, 18], [20, 0], clamp)}px`}}>{children}</div>
    <div style={{position: 'absolute', left: 80, bottom: 145, color: '#AAB9D0', fontSize: 24, letterSpacing: 1}}>ДЕМОНСТРАЦИЯ КОРПОРАТИВНОГО ПРИЛОЖЕНИЯ</div>
    <div style={{position: 'absolute', bottom: 92, left: 80, right: 80, height: 3, borderRadius: 4, background: '#FFFFFF13'}}><div style={{width: `${((chapter - 1 + Math.min(1, f / (seconds * fps))) / 8) * 100}%`, height: '100%', background: accentColor, borderRadius: 4}}/></div>
  </Interactive.Div>;
}

export function Heading({title, lead, accentColor = '#FFD166'}: {title: string; lead?: string; accentColor?: string}) {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  return <>
    <Interactive.H1 name="Заголовок" style={{position: 'absolute', left: 80, right: 80, top: 215, margin: 0, fontFamily: display, fontSize: 86, fontWeight: 750, letterSpacing: -3.5, lineHeight: 1.1, whiteSpace: 'pre-line', translate: `0px ${interpolate(f, [0, 20], [28, 0], clamp)}px`}}>{title}</Interactive.H1>
    {lead && <Interactive.Div name="Подзаголовок" style={{position: 'absolute', left: 84, top: 440, maxWidth: 900, fontSize: 44, fontWeight: 500, color: accentColor, opacity: pop(f, fps, 9)}}>{lead}</Interactive.Div>}
  </>;
}

export function Panel({children, style, light = false}: {children: ReactNode; style?: CSSProperties; light?: boolean}) {
  return <div style={{borderRadius: 40, border: `1px solid ${light ? '#FFFFFF99' : '#C7DEF126'}`, background: light ? '#F1F4F6' : 'linear-gradient(150deg,#192E4CEB,#0D1D34F5)', color: light ? '#182B43' : palette.ink, boxShadow: '0 26px 65px #00000030, inset 0 1px 0 #FFFFFF13', padding: 38, ...style}}>{children}</div>;
}

export function AppWindow({children, brandName, accentColor, style, title = 'Пространство команды'}: Pick<SceneProps, 'brandName' | 'accentColor'> & {children: ReactNode; style?: CSSProperties; title?: string}) {
  return <Panel style={{position: 'absolute', left: 105, top: 565, width: 870, padding: 38, borderRadius: 52, ...style}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 30, borderBottom: '1px solid #FFFFFF15', marginBottom: 30}}><Orbit size={58} color={accentColor}/><div><div style={{fontFamily: display, fontSize: 39, fontWeight: 700}}>{brandName}</div><div style={{fontSize: 26, color: palette.mute, marginTop: 5}}>{title}</div></div><div style={{marginLeft: 'auto', width: 62, height: 62, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 31, background: '#EBDCC7', color: '#423F56'}}>А</div></div>
    {children}
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-around', ...(style?.height ? {position: 'absolute', left: 38, right: 38, bottom: 30} : {}), fontSize: 28, color: '#91A8C2', borderTop: '1px solid #FFFFFF15', paddingTop: 25, marginTop: 30}}><span style={{color: accentColor}}>Главная</span><span>Рейтинг</span><span>Профиль</span></div>
  </Panel>;
}

export function Pill({children, color = '#FFD166', style}: {children: ReactNode; color?: string; style?: CSSProperties}) {
  return <div style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '15px 24px', borderRadius: 22, border: `1px solid ${color}55`, background: `${color}14`, color, fontWeight: 650, fontSize: 35, ...style}}>{children}</div>;
}

export function Footline({children}: {children: ReactNode}) {
  return <Interactive.Div name="Ключевая мысль" style={{position: 'absolute', left: 80, right: 80, top: 1570, textAlign: 'center', fontSize: 43, lineHeight: 1.25, fontWeight: 500, color: '#D0DDED'}}>{children}</Interactive.Div>;
}

export function GiftBox({size = 230, color = '#FFD166', opening = 0}: {size?: number; color?: string; opening?: number}) {
  return <div style={{position: 'relative', width: size, height: size, filter: 'drop-shadow(0 20px 30px #00000035)'}}>
    <div style={{position: 'absolute', left: size * 0.06, right: size * 0.06, top: size * 0.28, bottom: size * 0.08, borderRadius: size * 0.08, background: `linear-gradient(145deg,${color},#BA814A)`, boxShadow: 'inset -20px 0 25px #00000018'}}/>
    <div style={{position: 'absolute', width: size * 0.14, left: size * 0.43, top: size * 0.28, bottom: size * 0.08, background: '#FFF0BC'}}/>
    <div style={{position: 'absolute', width: size, height: size * 0.19, top: size * 0.21, background: `linear-gradient(135deg,#FFF1B7,${color})`, borderRadius: size * 0.05, translate: `0px ${-opening * size * 0.47}px`, rotate: `${-opening * 14}deg`, boxShadow: '0 8px 0 #00000013'}}>
      <div style={{position: 'absolute', left: size * 0.43, width: size * 0.14, height: '100%', background: '#FFF7DC'}}/>
      <div style={{position: 'absolute', left: size * 0.2, top: -size * 0.2, width: size * 0.34, height: size * 0.23, borderRadius: '65% 65% 5% 65%', border: `${size * 0.055}px solid #FFE8A1`, rotate: '20deg'}}/>
      <div style={{position: 'absolute', right: size * 0.2, top: -size * 0.2, width: size * 0.34, height: size * 0.23, borderRadius: '65% 65% 65% 5%', border: `${size * 0.055}px solid #FFE8A1`, rotate: '-20deg'}}/>
    </div>
  </div>;
}

export function Cursor({x, y, visible = 1, pressed = 0}: {x: number; y: number; visible?: number; pressed?: number}) {
  return <div style={{position: 'absolute', left: x, top: y, opacity: visible, zIndex: 10, scale: 1 - pressed * 0.12, pointerEvents: 'none'}}><div style={{position: 'absolute', left: -38, top: -38, width: 90, height: 90, borderRadius: '50%', border: '2px solid #FFFFFF', opacity: pressed * 0.7, scale: 0.8 + pressed * 0.4}}/><svg width="58" height="70" viewBox="0 0 58 70" style={{filter: 'drop-shadow(0 5px 7px #00000060)'}}><path d="M7 3L8 57L22 44L35 65L46 58L32 36L50 32Z" fill="#F6F2E8" stroke="#102644" strokeWidth="3"/></svg></div>;
}

export function Avatar({name, color = '#D8DCF1', size = 68}: {name: string; color?: string; size?: number}) {
  return <div style={{width: size, height: size, borderRadius: '50%', background: color, color: '#263247', display: 'grid', placeItems: 'center', fontSize: size * 0.48, fontWeight: 650}}>{name.slice(0, 1)}</div>;
}
