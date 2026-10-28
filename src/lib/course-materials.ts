import {useEffect,useState} from 'react'
import manifest from '../../content/ai-academy/materials-manifest.json'
export const publicCourseMaterials=(code:string)=>manifest.courses.find(c=>c.course.code===code)
export type PublicCourseSource={code:string;title:string;url:string;checked_at:string;language?:string;author?:string;provider?:string;rights?:string;allowed_use?:string;usage_rights?:string;start_seconds?:number;end_seconds?:number}
export type PublicLesson={code:string;title:string;parent_code:string;position:number;sources?:PublicCourseSource[];data:{format:string;minutes:number;artifact:string;acceptance:string[];content_blocks:any[]}}
export type PublicCourseBook={revision:string;sources?:PublicCourseSource[];course:{code:string;title:string};modules:{code:string;title:string;position:number}[];lessons:PublicLesson[]}
const pending=new Map<string,Promise<PublicCourseBook>>()
export function loadCourseMaterials(code:string):Promise<PublicCourseBook>{
 const index=publicCourseMaterials(code)
 if(!index)return Promise.reject(Error('Материалы этого курса недоступны.'))
 let task=pending.get(code)
 if(!task){task=fetch(`${index.url}?v=${manifest.revision}`).then(async response=>{if(!response.ok)throw Error('Не удалось загрузить материал. Попробуй ещё раз.');const book=await response.json();if(book.course?.code!==code||book.revision!==manifest.revision||!Array.isArray(book.lessons))throw Error('Материалы обновились. Перезагрузи приложение.');return book}).catch(error=>{pending.delete(code);throw error});pending.set(code,task)}
 return task
}
export function useCourseMaterials(code:string){
 const [data,setData]=useState<PublicCourseBook|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0)
 useEffect(()=>{let alive=true;setData(null);setError('');loadCourseMaterials(code).then(book=>{if(alive)setData(book)}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Материал не загрузился.')});return()=>{alive=false}},[code,revision])
 return {data,error,retry:()=>setRevision(n=>n+1)}
}
