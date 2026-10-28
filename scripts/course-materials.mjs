import {mkdir,writeFile,readFile,readdir,unlink} from 'node:fs/promises'
import path from 'node:path'
const strings=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'):[]
const string=v=>typeof v==='string'?v:''
const studyFields=['title','concept','situation','input_text','result_text','mistake','check','diagram_src']
function block(value){
 if(!['markdown','code','checklist','link'].includes(value.type))return null
 const out={type:value.type}
 for(const key of ['text','body','title','language','url','label'])if(typeof value[key]==='string')out[key]=value[key]
 if(Array.isArray(value.items))out.items=strings(value.items)
 if(['beginner','module_example','starter_resources'].includes(value.learning_role))out.learning_role=value.learning_role
 if(value.study&&typeof value.study==='object')out.study={...Object.fromEntries(studyFields.filter(key=>typeof value.study[key]==='string').map(key=>[key,value.study[key]])),steps:strings(value.study.steps)}
 return out
}
const sourceFields=['language','author','provider','rights','allowed_use','usage_rights']
function publicSourceUrl(value){
 if(typeof value!=='string'||value.length>2048)return null
 try{
  const url=new URL(value)
  if(url.protocol!=='https:'||url.username||url.password||[...url.searchParams.keys()].some(key=>/^(token|api[_-]?key|secret|authorization|access_token|signature|sig|jwt|x-amz-.+|x-goog-.+)$/i.test(key)))return null
  return url.href
 }catch{return null}
}
/** Only reviewed public links are copied, never source bodies, notes or grading data. */
function sourcesFor(catalog,target){
 const result=[],seen=new Set()
 for(const link of catalog.links||[]){
  if(link.target_code!==target||!['public','student'].includes(link.visibility)||['methodological','internal'].includes(link.usage))continue
  const source=catalog.entities.find(node=>node.code===link.source_code&&node.kind==='source'&&node.state==='published'),data=source?.data
  if(!data||!['approved','owned','licensed','public_link'].includes(data.rights_state)||data.link_state!=='verified'||typeof data.checked_at!=='string'||!Number.isFinite(Date.parse(data.checked_at)))continue
  const url=publicSourceUrl(data.canonical_url||data.url)
  if(!url)continue
  const start=Number.isSafeInteger(link.start_seconds)&&link.start_seconds>=0?link.start_seconds:0,end=Number.isSafeInteger(link.end_seconds)&&link.end_seconds>start?link.end_seconds:null
  const identity=`${source.code}:${start}:${end??''}`
  if(seen.has(identity))continue
  seen.add(identity)
  const out={code:source.code,title:string(source.title),url,checked_at:data.checked_at}
  for(const field of sourceFields)if(typeof data[field]==='string')out[field]=data[field]
  if(start>0||end!==null)out.start_seconds=start
  if(end!==null)out.end_seconds=end
  result.push(out)
 }
 return result
}
/** Explicit public reading edition of already-authored, published, unmapped free courses.
 * Assessments, answers, rubrics, learner records and arbitrary node data never enter it.
 */
export function courseMaterials(catalog){
 const books=[]
 for(const course of catalog.entities.filter(n=>n.kind==='course'&&n.state==='published'&&n.data.authored_pack&&!n.data.legacy_course_id&&(n.data.price_stars==null||Number(n.data.price_stars)===0))){
  const modules=catalog.entities.filter(n=>n.kind==='module'&&n.parent_code===course.code&&n.state==='published').sort((a,b)=>a.position-b.position)
  const lessons=modules.flatMap(m=>catalog.entities.filter(n=>n.kind==='lesson'&&n.parent_code===m.code&&n.state==='published'&&n.data.authored_pack===course.data.authored_pack).sort((a,b)=>a.position-b.position)).map(n=>({code:n.code,title:n.title,parent_code:n.parent_code,position:n.position,sources:sourcesFor(catalog,n.code),data:{format:string(n.data.format||n.data.primary_format),minutes:Number(n.data.minutes)||15,artifact:string(n.data.artifact||n.data.deliverable),acceptance:strings(n.data.acceptance),content_blocks:(n.data.content_blocks||[]).map(block).filter(Boolean)}}))
  if(!lessons.length||lessons.some(n=>!n.data.content_blocks.some(b=>b.text||b.body)))continue
  books.push({revision:catalog.content_revision,course:{code:course.code,title:course.title},sources:sourcesFor(catalog,course.code),modules:modules.map(m=>({code:m.code,title:m.title,position:m.position})),lessons})
 }
 return books
}
export async function writeCourseMaterials(catalog,root){
 const books=courseMaterials(catalog),folder=path.join(root,'public/learning/courses/materials')
 await mkdir(folder,{recursive:true})
 const write=async(file,value)=>{const body=JSON.stringify(value)+'\n';let previous;try{previous=await readFile(file,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}if(previous!==body)await writeFile(file,body)}
 const current=new Set(books.map(book=>`${book.course.code}.json`))
 for(const file of await readdir(folder))if(/^[A-Z]+-\d{3}\.json$/.test(file)&&!current.has(file))await unlink(path.join(folder,file))
 for(const book of books)await write(path.join(folder,`${book.course.code}.json`),book)
 const courses=books.map(book=>({revision:book.revision,course:book.course,modules:book.modules,lessons:book.lessons.map(({data,sources,...lesson})=>({...lesson,minutes:data.minutes})),url:`/learning/courses/materials/${book.course.code}.json`}))
 await write(path.join(root,'content/ai-academy/materials-manifest.json'),{revision:catalog.content_revision,courses})
 return books
}
