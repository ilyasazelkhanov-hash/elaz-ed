import { useId } from 'react'
import type { CompanionPreferences } from '../../../lib/home-companion'

const palettes = {
  violet: { light: '#eee3ff', middle: '#b19af3', dark: '#6650af', edge: '#4b387f', blush: '#efabc9' },
  mint: { light: '#e1ffe9', middle: '#83d9b9', dark: '#328e88', edge: '#25616b', blush: '#f2b7ac' },
  peach: { light: '#fff0d9', middle: '#ffb590', dark: '#d8757c', edge: '#a25169', blush: '#ed8d9b' },
  sky: { light: '#e5f7ff', middle: '#8bcaf3', dark: '#557fbf', edge: '#365a91', blush: '#e3b2d1' },
}
const silhouettes = {
  soft: 'M44 50C41 33 51 24 64 28C73 19 88 23 95 31C111 26 124 38 121 53C133 69 130 98 118 112C102 132 63 132 45 115C31 102 29 76 38 60Z',
  round: 'M80 29C109 28 130 48 130 78C131 107 112 128 81 129C50 130 30 110 30 80C29 50 50 30 80 29Z',
  spark: 'M72 31C77 20 87 21 92 32L102 48L122 51C136 53 138 62 129 72L115 88L118 109C120 122 111 129 99 123L81 115L62 124C50 130 40 122 43 109L47 89L32 73C22 63 26 53 39 51L60 48Z',
}

/** A complete, original static illustration: readable before WebGL or when GPU/motion is unavailable. */
export function DotsPoster({ look, mood }: { look: CompanionPreferences; mood: string }) {
  const uid = useId().replace(/:/g, '')
  const id = (part: string) => `dots-${uid}-${part}`
  const fill = (part: string) => `url(#${id(part)})`
  const p = palettes[look.color]
  const happy = mood === 'happy'
  const curious = mood === 'curious'
  return <svg className="og-dots-poster-art" viewBox="0 0 160 160" aria-hidden="true" focusable="false" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}>
    <defs>
      <radialGradient id={id('body')} cx="28%" cy="20%" r="88%"><stop stopColor={p.light}/><stop offset=".33" stopColor={p.middle}/><stop offset=".75" stopColor={p.dark}/><stop offset="1" stopColor={p.edge}/></radialGradient>
      <linearGradient id={id('limb')} x1="0" y1="0" x2="1" y2="1"><stop stopColor={p.light}/><stop offset=".4" stopColor={p.middle}/><stop offset="1" stopColor={p.dark}/></linearGradient>
      <radialGradient id={id('eye')} cx="38%" cy="22%" r="80%"><stop stopColor="#4d4265"/><stop offset=".42" stopColor="#211b35"/><stop offset="1" stopColor="#090916"/></radialGradient>
      <radialGradient id={id('shadow')}><stop stopColor={p.edge} stopOpacity=".24"/><stop offset="1" stopColor={p.edge} stopOpacity="0"/></radialGradient>
      <linearGradient id={id('shine')} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".75"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>
      <linearGradient id={id('cream')} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff2d9"/><stop offset=".5" stopColor="#eacba9"/><stop offset="1" stopColor="#b58d88"/></linearGradient>
      <radialGradient id={id('cheek')}><stop stopColor={p.blush} stopOpacity=".7"/><stop offset="1" stopColor={p.blush} stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="81" cy="140" rx="48" ry="12" fill={fill('shadow')}/>
    <ellipse cx="59" cy="123" rx="15" ry="8" fill={fill('limb')} transform="rotate(-12 59 123)"/>
    <ellipse cx="104" cy="123" rx="14" ry="8" fill={fill('limb')} transform="rotate(12 104 123)"/>
    <path d={silhouettes[look.shape]} fill={fill('body')} stroke={p.light} strokeOpacity=".45" strokeWidth=".6"/>
    <path d="M45 61C45 42 57 33 72 34C59 39 53 47 51 60C50 67 44 68 45 61Z" fill={fill('shine')} opacity=".8"/>
    <path d="M111 103C104 116 88 123 69 119" fill="none" stroke={p.light} strokeOpacity=".14" strokeWidth="3" strokeLinecap="round"/>
    <ellipse cx="34" cy="92" rx="10" ry="17" fill={fill('limb')} transform="rotate(26 34 92)"/>
    <ellipse cx="128" cy={happy ? 77 : 93} rx="10" ry="17" fill={fill('limb')} transform={`rotate(${happy ? -42 : -26} 128 ${happy ? 77 : 93})`}/>
    <path d="M29 86C28 90 29 94 31 96" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round"/>
    <ellipse cx="53" cy="91" rx="13" ry="8" fill={fill('cheek')}/><ellipse cx="108" cy="91" rx="13" ry="8" fill={fill('cheek')}/>
    <g transform={curious ? 'translate(0 -2) rotate(-4 80 78)' : undefined}>
      <g className="og-dots-poster-eye" style={{transformOrigin: '62px 76px'}}>
      <ellipse cx="62" cy="76" rx="10" ry="14" fill={p.edge} opacity=".18" transform="translate(0 2)"/>
      <ellipse cx="62" cy="76" rx="9" ry="13" fill={fill('eye')}/>
      <ellipse cx="59" cy="71" rx="3.2" ry="4.5" fill="#fff" opacity=".95" transform="rotate(20 59 71)"/>
      <circle cx="66" cy="81" r="1.6" fill="#c9c6f4" opacity=".8"/>
      </g>
      {mood === 'wink' ? <path d="M94 78Q101 71 108 78" fill="none" stroke="#211b35" strokeWidth="4" strokeLinecap="round"/> : <g className="og-dots-poster-eye" style={{transformOrigin: '101px 76px'}}>
        <ellipse cx="101" cy="76" rx="10" ry="14" fill={p.edge} opacity=".18" transform="translate(0 2)"/>
        <ellipse cx="101" cy="76" rx="9" ry="13" fill={fill('eye')}/>
        <ellipse cx="98" cy="71" rx="3.2" ry="4.5" fill="#fff" opacity=".95" transform="rotate(20 98 71)"/>
        <circle cx="105" cy="81" r="1.6" fill="#c9c6f4" opacity=".8"/>
      </g>}
      {happy ? <><path d="M73 91Q81 94 89 91Q88 106 81 106Q74 106 73 91Z" fill="#32213e"/><path d="M76 101Q81 97 86 101Q82 109 76 101Z" fill="#ee97b4"/></> : curious ? <ellipse cx="82" cy="96" rx="4" ry="5" fill="#342444"/> : <path d="M75 94Q82 102 89 93" fill="none" stroke="#352346" strokeWidth="2.7" strokeLinecap="round"/>}
    </g>
    {look.accessory === 'glasses' && <g fill="#fff" fillOpacity=".06" stroke="#40354f" strokeWidth="3"><circle cx="61" cy="77" r="15"/><circle cx="102" cy="77" r="15"/><path d="M76 76Q82 72 87 76M46 75L39 72M117 75L124 72" fill="none" strokeLinecap="round"/><path d="M52 68L58 65M93 68L99 65" stroke="#fff" strokeOpacity=".5" strokeWidth="2"/></g>}
    {look.accessory === 'sprout' && <g><path d="M80 32Q83 19 78 12" fill="none" stroke="#43836e" strokeWidth="3.5" strokeLinecap="round"/><path d="M79 21C63 22 60 14 61 9C73 8 80 12 79 21Z" fill="#81bd8f"/><path d="M80 17C83 6 93 5 100 8C97 18 88 22 80 17Z" fill="#a3d3a2"/><path d="M65 12L77 19M84 16L95 10" fill="none" stroke="#d6efba" strokeWidth="1.3" strokeLinecap="round"/></g>}
    {look.accessory === 'headphones' && <g><path d="M35 76C25 15 129 12 128 75" fill="none" stroke="#4f3d63" strokeWidth="8" strokeLinecap="round"/><path d="M35 60C41 19 115 20 125 60" fill="none" stroke="#e5c8c0" strokeWidth="3" strokeLinecap="round"/><rect x="24" y="64" width="16" height="31" rx="8" fill={fill('cream')} stroke="#9d7b82" strokeWidth="1" transform="rotate(-7 32 80)"/><rect x="122" y="64" width="16" height="31" rx="8" fill={fill('cream')} stroke="#9d7b82" strokeWidth="1" transform="rotate(7 130 80)"/><path d="M28 71V85M126 71V85" stroke="#fff5e6" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round"/></g>}
  </svg>
}
