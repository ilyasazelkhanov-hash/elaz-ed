import manifest from '../../content/ai-academy/lesson-visuals.json' with {type:'json'}

export type LessonScreenshot = {src:string;alt:string;caption:string}
const screenshots=(manifest as {lessons:Record<string,LessonScreenshot[]>}).lessons

export function lessonVisuals(code:string){
 const match=code.match(/^([A-Z]+-\d{3}-M[1-4])-L([1-4])$/)
 if(!match)return undefined
 return{
  diagram:`/learning/academy/steps/${match[1]}.svg`,
  step:Number(match[2]),
  screenshots:(screenshots[code]||[]).filter(item=>/^\/learning\/academy\/(?:screenshots|design)\/[a-z0-9-]+\.png$/.test(item.src)&&item.alt&&item.caption),
 }
}
