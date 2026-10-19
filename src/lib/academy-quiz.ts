export type AcademyAnswer = number | number[] | string
type Question = Record<string, any>
function invalid():never{throw new Error('invalid_answers')}
function indexes(value:unknown,size:number,nonempty=false):number[]{
 if(!Array.isArray(value)||nonempty&&!value.length||value.some(n=>!Number.isInteger(n)||n<0||n>=size)||new Set(value).size!==value.length)invalid()
 return [...value].sort((a,b)=>a-b)
}
export function validAcademyQuestion(q:Question):boolean{
 try{
  if(typeof q.prompt!=='string'||!q.prompt.trim())return false
  const type=q.type??'mcq',key=q.answer??q.correct??q.expected
  if(type==='text'||type==='code')return typeof key==='string'&&key.length>0&&key.length<=20000&&(!q.accepted_answers||Array.isArray(q.accepted_answers)&&q.accepted_answers.every((a:unknown)=>typeof a==='string'))
  if(!['mcq','single','multi'].includes(type)||!Array.isArray(q.choices)||q.choices.length<2||q.choices.length>30||q.choices.some((c:unknown)=>typeof c!=='string'))return false
  if(type==='multi'){indexes(key,q.choices.length,true);return true}
  return Number.isInteger(key)&&key>=0&&key<q.choices.length
 }catch{return false}
}
export function gradeAcademyAnswer(q:Question,answer:unknown):boolean{
 if(!validAcademyQuestion(q))throw new Error('assessment_not_configured')
 const type=q.type??'mcq',key=q.answer??q.correct??q.expected
 if(type==='multi')return JSON.stringify(indexes(answer,q.choices.length))===JSON.stringify(indexes(key,q.choices.length,true))
 if(type==='text'||type==='code'){
  if(typeof answer!=='string'||answer.length>20000)invalid()
  const normalize=(a:string)=>{const s=a.replaceAll('\r\n','\n').trim();return(q.case_sensitive??type==='code')?s:s.toLowerCase()}
  return [key,...q.accepted_answers??[]].some(k=>normalize(k)===normalize(answer as string))
 }
 if(!Number.isInteger(answer)||Number(answer)<0||Number(answer)>=q.choices.length)invalid()
 return answer===key
}
export function academyAnswerPresent(answer:AcademyAnswer|undefined){return typeof answer==='number'||Array.isArray(answer)?Array.isArray(answer)?answer.length>0:true:typeof answer==='string'&&!!answer.trim()}
