import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { lessonAnimations, type AnimationStage, type LessonAnimationSpec } from './lib/lesson-animations'

function Bars({level}:{level:number}) {
  return <span className="la-bars" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{height:`${level===0?2:8+((i*17)%34)*level/100}px`}} />)}</span>
}
function Visual({spec,stage,index}:{spec:LessonAnimationSpec;stage:AnimationStage;index:number}) {
 const f=stage.frame??{}
 if(spec.mode==='layers')return <div className="la-canvas" aria-label={`На макете ${f.value} слоя`}>
  {(f.value??0)>=2&&<div className="la-shapes"><i/><i/><i/></div>}
  {(f.value??0)>=3&&<strong>Первая<br/>автоматизация</strong>}
  {(f.value??0)>=4&&<span>7 ноября · 19:00 Алматы</span>}
  <small>Учебный макет · слои {f.value}/4</small>
 </div>
 if(spec.mode==='timeline'){
  const time=f.value??0
  return <div className="la-timeline">
   <div className="la-preview"><small>{time===15?'Ролик собран':`${time} сек · текущая сцена`}</small><strong>{time<4?'Рутина съедает вечер?':time<10?'Заявка → таблица → черновик':time<15?'7 ноября · Сохрани дату':'4 + 6 + 5 = 15 секунд'}</strong></div>
   <div className="la-clips">{['Вопрос','Действие','Финал'].map((label,i)=><span key={label} className={index===i?'is-active':''}><b>{label}</b><small>{['0–4 с','4–10 с','10–15 с'][i]}</small></span>)}</div>
   <div className="la-time-line"><i style={{left:`min(calc(100% - 3px), ${time/15*100}%)`}}/></div>
  </div>
 }
 if(spec.mode==='mix')return <div className="la-mix">
  <div><span>Голос <b>{f.voice}</b></span><Bars level={f.voice??0}/></div>
  <div><span>Музыка <b>{f.music}</b></span><Bars level={f.music??0}/></div>
  <small>Условные уровни · схема без звука</small>
 </div>
 if(spec.mode==='workflow')return <div className="la-workflow">
  <div className="la-node">Вход: {f.branch==='invalid'?'время пустое':'19:00'} <small>event_id: {f.branch==='invalid'?'focus-2':'focus-1'}</small></div>
  <span aria-hidden="true">↓</span><div className="la-node">Проверка: время есть?</div>
  <div className="la-branches"><div className={f.branch==='invalid'?'':'is-active'}>Да → {f.branch==='duplicate'?'Вернуть готовый файл':'Черновик'}</div><div className={f.branch==='invalid'?'is-error':''}>Нет → Нужно время</div></div>
  <small className="la-journal">Журнал: {f.branch==='duplicate'?'focus-1 найден, второй файл не создаём':f.branch==='ready'?'focus-1 → ready, файл сохранён':f.branch==='invalid'?'focus-2 остановлен до исправления':'проверяем новый ключ'}</small>
 </div>
 if(spec.mode==='form')return <div className="la-form-preview">
  <small>Учебная схема формы</small><label>Имя</label><div className={`la-input ${f.status==='error'?'is-error':''}`}>{f.name?.trim()||'Введи имя'}</div>
  <div className="la-mock-button">Проверить учебную заявку</div>
  <p className={f.status==='error'?'la-error':'la-success'}>{f.status==='error'?'Укажи имя: пробелы не подходят':f.status==='success'?'Проверено. Никуда не отправлено.':'Результат появится после проверки'}</p>
 </div>
 if(spec.mode==='schedule')return <div className="la-schedule">
  <div className="la-calendar" aria-hidden="true"><span>ЭТАП</span><b>{index+1}</b></div>
  <div><strong>{['Ручная проба','Повтор сохранён','Запуск проверен','Задача на паузе'][index]}</strong><p>{index===0?'Пока без автоматического повтора':index===3?'Новых запусков до возобновления нет':'Проверь источник, время и результат'}</p><span className={index===3?'la-paused':'la-status'}>{index===3?'Ⅱ На паузе':index===0?'Черновик':'✓ Под контролем'}</span></div>
 </div>
 if(spec.mode==='evidence')return <div className="la-evidence">
  <div className="la-node">Документация → чтение → проверка</div>
  <div><span>Импорт CSV</span><b className={index>0?'la-success':''}>{index>0?'✓ подтверждён':'? проверить'}</b></div>
  <div><span>Бесплатный тариф</span><b className="la-unknown">? неизвестно</b></div>
  <small>{index===3?'Добавлены URL и дата проверки':'Неизвестное не становится фактом'}</small>
 </div>
 if(spec.mode==='prompt')return <div className="la-evaluation">
  <strong>{index<2?'Запрос: проверяем слабые места':'Те же входы: проверяем правку'}</strong>
  {['Полный бриф → черновик','Нет времени → уточнение','Разные даты → вопрос'].map((label,i)=><div key={label}><span>{label}</span><b className={index>=2||i===0?'la-success':'la-unknown'}>{index>=2||i===0?'✓':'?'}</b></div>)}
  <small>Учебные контрольные случаи</small>
 </div>
 if(spec.mode==='voice')return <div className="la-transcript">
  <Bars level={65}/><small>В исходнике: «седьмого ноября»</small>
  <strong className={f.status==='error'?'la-error':f.status==='success'?'la-success':''}>{index===0?'Сначала слушаем запись':index===1?'Встреча 9 ноября':'Встреча 7 ноября'}</strong>
  <span>{index===1?'Дата не совпала — перепроверь':'Дату нельзя угадывать по контексту'}</span>
 </div>
 return <div className="la-review">
  <div className="la-review-track">{['План','Правка','Проверки','Сохранить'].map((label,i)=><span key={label} className={index===i?'is-active':''}>{label}</span>)}</div>
  <code className={index===0?'':'la-removed'}>name.length &gt; 0</code>
  {index>=1&&<code className="la-added">name.trim().length &gt; 0</code>}
  {index>=2&&<div className="la-checks"><Check size={17}/> Пустое имя · пробелы · Алия</div>}
 </div>
}

export function LessonAnimation({id}:{id:string}) {
 const spec=lessonAnimations[id]
 const titleId=useId()
 const root=useRef<HTMLElement>(null)
 const [index,setIndex]=useState(0)
 const [playing,setPlaying]=useState(()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
 const [inView,setInView]=useState(false)
 const [visible,setVisible]=useState(!document.hidden)
 useEffect(()=>{
  const observer=new IntersectionObserver(entries=>setInView((entries[0]?.intersectionRatio??0)>=0.35),{threshold:0.35})
  if(root.current)observer.observe(root.current)
  const onVisibility=()=>setVisible(!document.hidden)
  document.addEventListener('visibilitychange',onVisibility)
  return()=>{observer.disconnect();document.removeEventListener('visibilitychange',onVisibility)}
 },[])
 useEffect(()=>{
  const query=window.matchMedia('(prefers-reduced-motion: reduce)')
  const change=()=>{if(query.matches)setPlaying(false)}
  query.addEventListener('change',change)
  return()=>query.removeEventListener('change',change)
 },[])
 useEffect(()=>{
  if(!spec||!playing||!inView||!visible)return
  if(index===spec.stages.length-1){setPlaying(false);return}
  const timer=window.setTimeout(()=>setIndex(i=>Math.min(i+1,spec.stages.length-1)),4800)
  return()=>window.clearTimeout(timer)
 },[playing,inView,visible,index,spec])
 if(!spec)return null
 const stage=spec.stages[index]
 const select=(i:number)=>{setPlaying(false);setIndex(i)}
 const toggle=()=>{if(index===spec.stages.length-1)setIndex(0);setPlaying(p=>!p)}
 return <section ref={root} className={`lesson-animation ${playing&&inView&&visible?'is-playing':''}`} aria-labelledby={titleId} data-animation-id={id}>
  <header><span>Наглядно · учебная анимация</span><h3 id={titleId}>{spec.title}</h3></header>
  <div className="la-visual"><Visual spec={spec} stage={stage} index={index}/></div>
  <div className="la-explanation"><span className="la-step-count">Шаг {index+1} из {spec.stages.length}</span><h4>{stage.label}</h4><p>{stage.why}</p><pre>{stage.artifact}</pre></div>
  <div className="la-stage-picker" aria-label="Выбрать шаг">{spec.stages.map((s,i)=><button type="button" key={s.label} onClick={()=>select(i)} aria-label={`Шаг ${i+1}: ${s.label}`} aria-pressed={index===i}>{i+1}</button>)}</div>
  <div className="la-controls">
   <button type="button" onClick={()=>select(Math.max(0,index-1))} disabled={index===0} aria-label="Предыдущий шаг"><ChevronLeft size={19}/></button>
   <button type="button" onClick={toggle} className="la-play">{playing?<Pause size={17}/>:<Play size={17}/>} {playing?'Пауза':index===spec.stages.length-1?'Повторить':'Смотреть'}</button>
   <button type="button" onClick={()=>select(Math.min(spec.stages.length-1,index+1))} disabled={index===spec.stages.length-1} aria-label="Следующий шаг"><ChevronRight size={19}/></button>
   <button type="button" onClick={()=>select(0)} aria-label="Вернуться к началу"><RotateCcw size={17}/></button>
  </div>
  <p className="la-takeaway">{spec.takeaway}</p>
 </section>
}
