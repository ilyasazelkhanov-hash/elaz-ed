import { useEffect,useId,useRef,useState } from 'react'
import { useInView,useReducedMotion } from 'motion/react'
import { BrainCircuit,Code2,Workflow,Bot,Palette,PenTool,Megaphone,ChartNoAxesCombined,BriefcaseBusiness,Braces } from 'lucide-react'
import './course-artwork.css'
const looks={CORE:{icon:BrainCircuit,a:'#b69aff',b:'#ff8ac9'},VC:{icon:Code2,a:'#72ccff',b:'#b19aff'},ENG:{icon:Braces,a:'#65f1ce',b:'#7ebaff'},AU:{icon:Workflow,a:'#ffbb82',b:'#ff87be'},AG:{icon:Bot,a:'#c9a2ff',b:'#ffbada'},CR:{icon:Palette,a:'#ffb1d4',b:'#ffd78d'},DS:{icon:PenTool,a:'#8ff2d6',b:'#bdadff'},MK:{icon:Megaphone,a:'#ffc180',b:'#ff8cbc'},DT:{icon:ChartNoAxesCombined,a:'#83d7ff',b:'#a7acff'},BI:{icon:BriefcaseBusiness,a:'#c6f58d',b:'#74e5c6'}}
/** Local vector animation, paused offscreen and for reduced-motion users. */
export function CourseArtwork({code}:{code:string}){
 const prefix=code.split('-')[0] as keyof typeof looks,look=looks[prefix]||looks.CORE,Icon=look.icon
 const id=useId().replace(/[^a-z0-9_-]/gi,''),ref=useRef<HTMLDivElement>(null),inView=useInView(ref,{amount:.1}),reduce=useReducedMotion()
 const [visible,setVisible]=useState(()=>document.visibilityState!=='hidden')
 useEffect(()=>{const change=()=>setVisible(document.visibilityState!=='hidden');document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change)},[])
 const moving=inView&&visible&&!reduce
 return <div ref={ref} className="og-course-art" data-course-artwork data-animated={moving?'true':'false'} style={{'--art-a':look.a,'--art-b':look.b} as React.CSSProperties} aria-hidden="true">
  <svg viewBox="0 0 360 180" role="presentation" focusable="false">
   <defs><radialGradient id={`${id}-glow`}><stop stopColor={look.a} stopOpacity=".38"/><stop offset="1" stopColor={look.a} stopOpacity="0"/></radialGradient><linearGradient id={`${id}-top`} x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".95"/><stop offset="1" stopColor={look.a}/></linearGradient><linearGradient id={`${id}-front`} x2="1" y2="1"><stop stopColor={look.a}/><stop offset="1" stopColor={look.b}/></linearGradient><linearGradient id={`${id}-side`} x2="1" y2="1"><stop stopColor={look.b}/><stop offset="1" stopColor="#6253bd"/></linearGradient></defs>
   <ellipse cx="180" cy="102" rx="140" ry="90" fill={`url(#${id}-glow)`}/>
   <g className="og-art-orbit"><ellipse cx="180" cy="112" rx="133" ry="42" fill="none" stroke={look.a} strokeOpacity=".32" strokeDasharray="4 7"/><circle cx="312" cy="112" r="5" fill={look.b}/><circle cx="50" cy="115" r="3" fill={look.a}/></g>
   <ellipse cx="180" cy="154" rx="51" ry="11" fill="#050414" opacity=".38"/>
   <g className="og-art-cube"><path d="M180 25 237 56 180 88 123 56Z" fill={`url(#${id}-top)`}/><path d="M123 56 180 88 180 150 123 117Z" fill={`url(#${id}-front)`}/><path d="M180 88 237 56 237 117 180 150Z" fill={`url(#${id}-side)`}/><path d="m180 25 57 31v61l-57 33-57-33V56Z" fill="none" stroke="white" strokeOpacity=".5"/><path d="m123 56 57 32 57-32M180 88v62" fill="none" stroke="white" strokeOpacity=".35"/><g transform="translate(142 83) skewY(29)"><Icon size={27} color="#241843" strokeWidth={1.8}/></g></g>
   <g className="og-art-note"><rect x="47" y="37" width="61" height="39" rx="11" fill="#fff" fillOpacity=".08" stroke={look.a} strokeOpacity=".48"/><path d="m62 51-7 6 7 6m24-12 7 6-7 6m-10-14-5 16" fill="none" stroke={look.a} strokeWidth="2" strokeLinecap="round"/></g>
   <g className="og-art-note is-second"><rect x="261" y="86" width="58" height="45" rx="12" fill="#fff" fillOpacity=".09" stroke={look.b} strokeOpacity=".5"/><path d="M275 117v-9m10 9V98m10 19v-14" fill="none" stroke={look.b} strokeWidth="4" strokeLinecap="round"/></g>
   <g fill="white"><circle cx="100" cy="130" r="2" opacity=".75"/><circle cx="252" cy="35" r="2" opacity=".85"/><path d="m276 46 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill={look.a}/></g>
  </svg>
 </div>
}
