import { Check, ChevronRight, Lock } from 'lucide-react'
import { publicCourseMaterials } from '../../lib/course-materials'
import { useState } from 'react'
import { api,isDemo } from '../../lib/api'
import { useLearningRequest } from '../../lib/learning-scope'
import directory from '../../../content/ai-academy/course-directory.json'
import { safeAcademyUrl } from '../../lib/academy-types'
import { canPayStars,openInvoice } from '../../lib/tg'
import type { AcademyEntity } from '../../lib/academy-types'
import { orderedAcademyModules,orderedAcademyLessons,completedAcademyLessonCodes } from '../../lib/academy-sequence'
import { Bar,Cta,Tap } from '../../ui'
import { Empty,FetchState,useAcademy,useAction,text } from '../academy/shared'
import { CourseArtwork } from './CourseArtwork'
import { courseGradient,courseTopic } from './CourseCard'

type Go=(path:string)=>void
/** Native OG course page: one action, progress, and an ordered list of modules. */
export function CourseProgram({code,go}:{code:string;go:Go}){
 const request=useLearningRequest(),resource=useAcademy('course',{code}),action=useAction(resource.refresh)
 const learning=useAcademy('my',{},!!resource.data?.course&&!resource.data?.preview_only),[paying,setPaying]=useState(false),[paymentMessage,setPaymentMessage]=useState(''),[evidence,setEvidence]=useState('')
 const publicBook=publicCourseMaterials(code)
 if((resource.error&&!resource.data)||(!resource.data&&!publicBook))return <FetchState {...resource}/>
 const data=resource.data||{course:directory.find(c=>c.code===code),modules:publicBook?.modules,lessons:publicBook?.lessons.map(l=>({...l,state:'outline',data:{minutes:l.minutes}})),preview_only:true}
 const {course,enrollment,offer,progress,assessments=[]}=data
 if(!course)return <Empty title="Курс недоступен">Вернись к списку курсов и попробуй ещё раз.</Empty>
 const modules:AcademyEntity[]=orderedAcademyModules(data.modules||[]),lessons:AcademyEntity[]=orderedAcademyLessons(data.lessons||[],modules)
 const completed=completedAcademyLessonCodes(learning.data?.progress||[]),done=lessons.filter(l=>completed.has(l.code)).length
 const next=lessons.find(l=>!completed.has(l.code))||lessons[0],ready=course.state==='published'&&!data.preview_only
 const active=['active','enrolled','completed'].includes(enrollment?.state||enrollment?.status)
 const eligible=data.eligible!==false,canStudy=ready&&active&&eligible&&(!offer||offer.has_access),g=courseGradient(code)
 const required:string[]=(data.prerequisites||[]).map((p:any)=>typeof p==='string'?p:p.requires_code).filter(Boolean)
 const missing=required.find(requiredCode=>!learning.data?.enrollments?.some((e:any)=>e.course_code===requiredCode&&(e.progress?.all_required_passed||e.progress?.percent===100)))||required[0]||'CORE-000'
 const missingTitle=directory.find(c=>c.code===missing)?.title||'Вводный курс'
 async function buy(){
  if(paying)return
  if(isDemo||!canPayStars){setPaymentMessage('Оплата доступна в приложении Telegram.');return}
  setPaying(true);setPaymentMessage('')
  try{
   const invoice=await api.courseInvoice(offer.legacy_course_id)
   if(!invoice)throw Error('Не удалось создать счёт. Попробуй ещё раз.')
   const status=await openInvoice(invoice)
   if(status==='failed')throw Error('Оплата не прошла. Повтори попытку.')
   if(status!=='paid'){setPaymentMessage(status==='pending'?'Платёж обрабатывается. Обнови статус доступа позже.':'Оплата отменена.');return}
   let confirmed=false
   for(let i=0;i<6;i++){if((await request('course',{code})).offer?.has_access){confirmed=true;break}await new Promise(resolve=>setTimeout(resolve,1000))}
   if(confirmed)await action.run('enroll',{code},'Оплата подтверждена. Можно начинать.')
   else setPaymentMessage('Платёж отправлен. Курс откроется после подтверждения сервером.')
   resource.refresh()
  }catch(e){setPaymentMessage(e instanceof Error?e.message:'Не удалось проверить оплату.')}finally{setPaying(false)}
 }
 return <div className="space-y-5" data-course-program>
  <section className="overflow-hidden rounded-[28px]" style={{background:g.css,color:g.ink}}><CourseArtwork code={code}/><div className="p-6"><p className="text-xs font-semibold">{courseTopic(code)}</p><h1 className="mt-3 font-display text-[25px] font-semibold leading-tight">{course.title}</h1><p className="mt-3 line-clamp-2 text-sm leading-relaxed">{text(course.data.outcome||course.data.description)}</p><p className="mt-5 text-xs font-semibold">{modules.length} модуля · {lessons.length} уроков</p></div></section>
  {publicBook&&(!canStudy||next?.state!=='published')&&<section className="rounded-[24px] border border-line bg-card p-5" aria-label="Материалы курса"><h2 className="text-lg font-semibold">{publicBook.lessons.length} полных уроков</h2><p className="mb-4 mt-2 text-sm leading-relaxed text-mute">Объяснения, примеры, иллюстрации и задания уже внутри. Открой первый урок и двигайся по порядку.</p><Cta className="w-full" onClick={()=>go(`/read/${publicBook.lessons[0].code}`)}>Открыть первый урок<ChevronRight size={17}/></Cta></section>}
  <details open={!publicBook||!!canStudy&&next?.state==='published'} className="rounded-[24px] border border-line bg-card"><summary className="cursor-pointer p-5 text-sm font-semibold">Отправка работ и зачёт</summary>
  <section className="rounded-[24px] border border-line bg-card p-5" aria-label="Обучение по курсу">
   {canStudy?<><p className="text-sm font-semibold">Твой прогресс · {done} из {lessons.length} уроков</p><Bar progress={lessons.length?done/lessons.length:0} className="my-3"/>{next&&<p className="mb-4 text-sm leading-relaxed text-mute">{done===lessons.length?'Можно повторить материал':done?'Следующий урок':'Начни с первого урока'}: {next.state==='published'?next.title:'Урок ещё готовится. Пройденные материалы доступны в программе ниже.'}</p>}<Cta tone="inverse" className="w-full" disabled={!next||next.state!=='published'||learning.loading||!!learning.error} onClick={()=>next&&go(`/lessons/${next.code}`)}>{done===lessons.length?'Повторить курс':next?.state==='published'?'Продолжить обучение':'Следующий урок готовится'}<ChevronRight size={17}/></Cta>{learning.error&&<Tap className="mt-3 min-h-11 text-violet" onClick={learning.refresh}>Повторить загрузку прогресса</Tap>}</>
   :!ready?<><h2 className="font-semibold">{publicBook?'Проверки и зачёт пока недоступны':'Пока доступна программа'}</h2><p className="mt-2 text-sm leading-relaxed text-mute">{publicBook?'Все материалы можно читать и выполнять самостоятельно. Отправка работ и подтверждение результатов откроются отдельно.':'Уроки и запись откроются после публикации материалов.'}</p><Tap className="mt-3 min-h-11 text-violet" onClick={resource.refresh}>Проверить доступность уроков</Tap></>
   :!eligible?<><h2 className="font-semibold">Сначала пройди подготовку</h2><p className="mb-4 mt-2 text-sm leading-relaxed text-mute">Для этой программы нужен курс «{missingTitle}».</p><Cta tone="inverse" disabled={learning.loading} onClick={()=>go(`/courses/${missing}`)}>Открыть подготовительный курс</Cta><details className="mt-4"><summary className="cursor-pointer text-sm text-violet">Уже есть опыт?</summary><p className="mt-3 text-sm leading-relaxed text-mute">Пришли ссылку на проект. После проверки преподаватель сможет подтвердить подготовку.</p><label className="mt-3 block text-xs text-mute">Ссылка на проект<input type="url" value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="https://…" className="mt-2 w-full rounded-xl border border-line bg-card2 p-3 text-base text-ink"/></label><Tap className="mt-3 min-h-11 text-sm text-violet" disabled={action.busy} onClick={()=>{const url=safeAcademyUrl(evidence);if(!url){action.fail('Укажи открытую HTTPS-ссылку на проект.');return}void action.run('placement',{code,evidence_url:url},'Проект отправлен на проверку.')}}>Отправить на проверку</Tap></details></>
   :offer&&!offer.has_access?<><h2 className="font-semibold">Открой доступ к курсу</h2><p className="mb-4 mt-2 text-sm text-mute">{offer.purchasable?`Стоимость: ${offer.price_stars} звёзд Telegram.`:'Доступ к этой программе выдаёт автор.'}</p>{offer.purchasable&&<Cta tone="inverse" className="w-full" busy={paying} onClick={()=>void buy()}>Открыть за {offer.price_stars} ★</Cta>}<Tap className="mt-3 min-h-11 text-violet" onClick={resource.refresh}>Обновить статус доступа</Tap></>
   :<><h2 className="font-semibold">Готов начать?</h2><p className="mb-4 mt-2 text-sm leading-relaxed text-mute">Запишись, затем двигайся по урокам сверху вниз. Результаты сохраняются в «Моём обучении».</p><Cta tone="inverse" className="w-full" busy={action.busy} onClick={()=>void action.run('enroll',{code},'Курс добавлен в твоё обучение.')}>Начать курс<ChevronRight size={17}/></Cta></>}
   {paymentMessage&&<p role="status" className="mt-3 text-sm leading-relaxed">{paymentMessage}</p>}{action.feedback}
  </section>
  </details>
  <section aria-label="Программа курса"><h2 className="mb-3 font-display text-lg font-semibold">Программа курса</h2>{modules.map((m,mi)=><details key={m.code} open={m.code===(next?.parent_code||modules[0]?.code)} className="mb-3 rounded-[24px] border border-line bg-card"><summary className="flex min-h-16 cursor-pointer items-center justify-between gap-3 p-5"><span><span className="block text-xs text-mute">Модуль {mi+1}</span><b className="mt-1 block text-sm leading-snug">{m.title}</b></span><ChevronRight size={18} className="shrink-0 text-mute"/></summary><ol className="border-t border-line px-5">{lessons.filter(l=>l.parent_code===m.code).map(l=>{const number=lessons.findIndex(item=>item.code===l.code)+1,readable=!!publicBook?.lessons.some(item=>item.code===l.code),online=canStudy&&l.state==='published';return <li key={l.code}><Tap onClick={()=>go(`${online?'/lessons':'/read'}/${l.code}`)} disabled={!online&&!readable} className="flex min-h-16 w-full items-center gap-3 border-b border-line py-4 text-left disabled:opacity-60"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${completed.has(l.code)?'bg-mint/15 text-mint':'bg-card2 text-mute'}`}>{completed.has(l.code)?<Check size={16}/>:number}</span><span className="min-w-0 flex-1"><span className="block text-sm leading-snug">{l.title}</span><span className="mt-1 block text-xs text-mute">{l.state==='published'||readable?`${l.data.minutes||15} мин`:'Материал готовится'}{completed.has(l.code)?' · Пройдено':canStudy&&next?.code===l.code?' · Следующий урок':''}</span></span>{online||readable?<ChevronRight size={16} className="shrink-0 text-mute"/>:<Lock size={15} className="shrink-0 text-mute"/>}</Tap></li>})}</ol></details>)}</section>
  {assessments.length>0&&<section className="rounded-2xl border border-line bg-card p-5"><h2 className="font-semibold">Итоговая работа</h2>{assessments.map((a:AcademyEntity)=><Tap key={a.code} disabled={!canStudy} className="mt-3 min-h-11 text-left text-sm text-violet" onClick={()=>go(`/assessments/${a.code}`)}>{a.title} →</Tap>)}</section>}
  {Number(progress?.percent)===100&&<section className="rounded-2xl border border-line bg-card p-5"><p className="text-sm leading-relaxed">Все уроки пройдены. После успешной защиты можно получить подтверждение результата.</p><Tap className="mt-3 min-h-11 text-sm text-violet" disabled={action.busy} onClick={()=>void action.run('certificate',{code},'Подтверждение добавлено в «Моё обучение».')}>Получить подтверждение</Tap></section>}
 </div>
}
