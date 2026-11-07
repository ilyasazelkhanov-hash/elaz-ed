import { useId, useRef, type CSSProperties } from 'react'
import { useDocumentVisible, useElementVisible, usePrefersReducedMotion } from '../../lib/visibility'
import './practice.css'

const colors: Record<string, {a: string; b: string}> = {
 foundations: {a: '#b09aff', b: '#82dfc8'}, text: {a: '#8db7ff', b: '#c9a5ee'},
 media: {a: '#ed9dc1', b: '#eac38c'}, coding: {a: '#80d4ce', b: '#9dafee'},
 automation: {a: '#e6b285', b: '#b3a0ec'},
}
const Check = ({x, y, size = 12}: {x: number; y: number; size?: number}) => <path d={`m${x} ${y + size * .5} ${size * .32} ${size * .32} ${size * .68} -${size * .68}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
const Lines = ({x, y, width, count = 3}: {x: number; y: number; width: number; count?: number}) => <g className="og-practice-art-lines">{Array.from({length: count}, (_, i) => <rect key={i} x={x} y={y + i * 12} width={width * (i === count - 1 ? .68 : 1)} height="4" rx="2"/>)}</g>

/** A small vector preview of the work a learner makes, rather than a generic course icon. */
export function PracticeArtwork({courseKey, compact = false}: {courseKey: string; compact?: boolean}) {
 const ref = useRef<HTMLDivElement>(null), id = useId().replace(/[^a-z0-9_-]/gi, '')
 const reduced = usePrefersReducedMotion(), visible = useElementVisible(ref), documentVisible = useDocumentVisible()
 const look = colors[courseKey] ?? colors.foundations
 const moving = visible && documentVisible && !reduced
 return <div ref={ref} className={`og-practice-art${compact ? ' is-compact' : ''}`} data-practice-artwork={courseKey} data-animated={moving ? 'true' : 'false'} aria-hidden="true" style={{'--practice-art-a': look.a, '--practice-art-b': look.b} as CSSProperties}>
  <svg viewBox="0 0 360 200" role="presentation" focusable="false">
   <defs>
    <pattern id={`${id}-dots`} width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="currentColor" opacity=".13"/></pattern>
    <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={look.a} stopOpacity=".18"/><stop offset="1" stopColor={look.b} stopOpacity=".04"/></linearGradient>
   </defs>
   <rect width="360" height="200" fill={`url(#${id}-shine)`}/><rect width="360" height="200" fill={`url(#${id}-dots)`}/>
   <g className="og-practice-art-frame"><rect x="30" y="20" width="300" height="160" rx="15" className="og-practice-art-window"/><path d="M30 45h300" className="og-practice-art-rule"/><g className="og-practice-art-dots"><circle cx="44" cy="33" r="2.5"/><circle cx="54" cy="33" r="2.5"/><circle cx="64" cy="33" r="2.5"/></g><rect x="151" y="30" width="58" height="5" rx="2.5" className="og-practice-art-line"/>
    {courseKey === 'text' ? <>
     <g className="og-practice-art-main"><rect x="78" y="59" width="139" height="107" rx="7" className="og-practice-art-paper"/><rect x="93" y="73" width="80" height="7" rx="3" className="og-practice-art-accent"/><Lines x={93} y={92} width={106} count={2}/><rect x="90" y="115" width="114" height="13" rx="3" className="og-practice-art-highlight"/><Lines x={93} y={120} width={94} count={1}/><Lines x={93} y={140} width={100} count={2}/></g>
     <g className="og-practice-art-detail"><path d="m204 121 30-34h27" className="og-practice-art-connector"/><rect x="232" y="66" width="74" height="43" rx="8" className="og-practice-art-note"/><Lines x={242} y={77} width={51} count={2}/><circle cx="250" cy="139" r="13" className="og-practice-art-badge"/><g className="og-practice-art-check"><Check x={244} y={132}/></g><path d="M271 136h31m-31 8h20" className="og-practice-art-rule"/></g>
    </> : courseKey === 'media' ? <>
     <g className="og-practice-art-main"><rect x="56" y="61" width="111" height="74" rx="8" className="og-practice-art-paper"/><rect x="62" y="67" width="99" height="62" rx="5" className="og-practice-art-image"/><circle cx="130" cy="83" r="10" className="og-practice-art-accent"/><path d="m62 117 30-28 25 22 19-13 25 20v11H62Z" className="og-practice-art-mountain"/></g>
     <g className="og-practice-art-detail"><rect x="180" y="61" width="113" height="74" rx="8" className="og-practice-art-paper"/><rect x="186" y="67" width="101" height="62" rx="5" className="og-practice-art-highlight"/><rect x="201" y="81" width="20" height="34" rx="6" className="og-practice-art-accent"/><path d="m240 82 20 16-20 16Z" className="og-practice-art-mountain"/></g>
     <g><rect x="57" y="147" width="237" height="18" rx="5" className="og-practice-art-track"/>{[61,108,155,202,249].map((x, i) => <rect key={x} x={x} y="151" width="41" height="10" rx="2" className={i % 2 ? 'og-practice-art-accent' : 'og-practice-art-highlight'}/>)}<path d="M180 141v30" className="og-practice-art-playhead"/><circle cx="180" cy="141" r="3" className="og-practice-art-accent"/></g>
    </> : courseKey === 'coding' ? <>
     <g className="og-practice-art-main"><rect x="53" y="61" width="157" height="104" rx="8" className="og-practice-art-paper"/><rect x="63" y="70" width="137" height="16" rx="4" className="og-practice-art-track"/><circle cx="72" cy="78" r="3" className="og-practice-art-accent"/><path d="M83 78h36" className="og-practice-art-rule"/><rect x="64" y="97" width="48" height="54" rx="5" className="og-practice-art-highlight"/><path d="m76 116-7 7 7 7m21-14 7 7-7 7m-9-18-4 22" className="og-practice-art-code"/><Lines x={123} y={100} width={64} count={3}/><rect x="123" y="141" width="48" height="10" rx="4" className="og-practice-art-accent"/></g>
     <g className="og-practice-art-detail"><rect x="223" y="72" width="85" height="84" rx="8" className="og-practice-art-note"/>{[87,109,131].map(y => <g key={y}><circle cx="238" cy={y + 4} r="7" className="og-practice-art-badge"/><g className="og-practice-art-check"><Check x={234} y={y} size={8}/></g><path d={`M252 ${y + 4}h38`} className="og-practice-art-rule"/></g>)}</g>
    </> : courseKey === 'automation' ? <>
     <path d="M86 91h43m28 0h45m28 0h46v40" className="og-practice-art-connector og-practice-art-flow"/>
     <g className="og-practice-art-main"><rect x="58" y="69" width="43" height="43" rx="12" className="og-practice-art-paper"/><path d="m78 79-8 13h9l-3 11 13-17H79l3-7" className="og-practice-art-code"/><rect x="128" y="69" width="43" height="43" rx="12" className="og-practice-art-highlight"/><path d="M139 80h21m-21 10h21m-21 10h21" className="og-practice-art-code"/><circle cx="145" cy="80" r="3" className="og-practice-art-accent"/><circle cx="154" cy="90" r="3" className="og-practice-art-accent"/><circle cx="145" cy="100" r="3" className="og-practice-art-accent"/><rect x="201" y="69" width="43" height="43" rx="12" className="og-practice-art-paper"/><g className="og-practice-art-check"><Check x={213} y={81} size={18}/></g></g>
     <g className="og-practice-art-detail"><rect x="91" y="130" width="203" height="32" rx="8" className="og-practice-art-note"/><circle cx="110" cy="146" r="8" className="og-practice-art-badge"/><g className="og-practice-art-check"><Check x={105} y={141} size={9}/></g><Lines x={126} y={139} width={141} count={2}/></g>
    </> : <>
     <g className="og-practice-art-main"><rect x="82" y="59" width="155" height="107" rx="8" className="og-practice-art-paper"/><rect x="99" y="75" width="83" height="7" rx="3" className="og-practice-art-accent"/><Lines x={99} y={94} width={118} count={2}/>{[124,143].map(y => <g key={y}><rect x="99" y={y - 1} width="10" height="10" rx="3" className="og-practice-art-highlight"/><g className="og-practice-art-check"><Check x={101} y={y} size={6}/></g><rect x="119" y={y + 2} width={y === 124 ? 93 : 68} height="4" rx="2" className="og-practice-art-line"/></g>)}</g>
     <g className="og-practice-art-detail"><rect x="215" y="94" width="69" height="63" rx="13" className="og-practice-art-note"/><circle cx="249" cy="124" r="19" className="og-practice-art-badge"/><g className="og-practice-art-check"><Check x={239} y={114} size={19}/></g></g>
    </>}
   </g>
  </svg>
 </div>
}
