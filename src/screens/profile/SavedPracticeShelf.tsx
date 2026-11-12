import { useEffect, useState } from 'react'
import { ChevronRight, Trash2 } from 'lucide-react'
import { savedFreePractice, deleteSavedFreePractice } from '../../lib/saved-practice'
import { useStore } from '../../store'
import { Tap } from '../../ui'

export function SavedPracticeShelf({scope}:{scope?:string}) {
 const depth=useStore(state=>state.stack.length), push=useStore(state=>state.push)
 const [saved,setSaved]=useState(()=>savedFreePractice(scope))
 const [pending,setPending]=useState<string|null>(null),[message,setMessage]=useState('')
 useEffect(()=>{
  const refresh=()=>{setSaved(savedFreePractice(scope));setPending(null)}
  refresh()
  window.addEventListener('storage',refresh)
  window.addEventListener('focus',refresh)
  return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh)}
 },[scope,depth])
 return <section className="mt-5 rounded-2xl border border-line bg-card p-4" aria-label="Мои бесплатные работы">
  <h2 className="text-sm font-semibold">Мои бесплатные работы</h2>
  <p className="mt-1 text-xs leading-relaxed text-mute">Сохранённое по кнопке в бесплатных разборах, только в этом браузере. Без синхронизации. Это личные черновики и самопроверка, не подтверждённые навыки и не портфолио Academy.</p>
  {saved.unavailable?<p role="status" className="mt-3 text-sm">Хранилище браузера недоступно. Не удалось прочитать сохранённые работы.</p>:saved.items.length?<ul className="mt-3 divide-y divide-line">{saved.items.map(item=><li key={item.id} className="py-2">
   <div className="flex items-center gap-2"><Tap className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 text-left" onClick={()=>push({type:'learning',path:item.path})}><span className="min-w-0 break-words"><b className="block text-sm">{item.title}</b><span className="mt-1 block text-xs text-mute">{item.status==='self_checked'?'Самопроверка выполнена':'Черновик'}</span></span><ChevronRight size={18} className="shrink-0" aria-hidden="true"/></Tap><Tap className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-line" aria-label={`Удалить работу «${item.title}»`} onClick={()=>{setPending(item.id);setMessage('')}}><Trash2 size={16}/></Tap></div>
   {pending===item.id&&<div className="mt-2 rounded-xl bg-veil/5 p-3"><p className="text-xs leading-relaxed">Удалить эту работу из браузера? Текущий несохранённый черновик этой работы тоже будет удалён. Прогресс урока и скачанные файлы останутся.</p><div className="mt-2 flex flex-wrap gap-2"><Tap className="min-h-11 rounded-xl border border-line px-3 text-sm" onClick={()=>{if(deleteSavedFreePractice(scope,item.id)){setSaved(savedFreePractice(scope));setPending(null);setMessage('Работа удалена из этого браузера.')}else setMessage('Не удалось удалить работу. Проверь доступ к хранилищу браузера.')}}>Да, удалить</Tap><Tap className="min-h-11 rounded-xl border border-line px-3 text-sm" onClick={()=>setPending(null)}>Отмена</Tap></div></div>}
  </li>)}</ul>:<div className="mt-3"><p className="text-sm text-mute">Пока нет сохранённых работ.</p><Tap className="mt-2 min-h-11 text-sm font-semibold text-violet" onClick={()=>push({type:'learning',path:'/start'})}>Открыть бесплатные разборы</Tap></div>}
  <p role="status" className="mt-2 text-xs text-mute">{message}</p>
 </section>
}
