import {ArrowDown,ArrowUp} from 'lucide-react'
import {Tap} from '../../ui'
import {moveGuideItem,type GuideAnswer,type GuideChallenge} from '../../lib/guide-interactions'

type Props={id:string;question:GuideChallenge;answer:GuideAnswer;onChange:(value:GuideAnswer)=>void;wrong?:number[];locked?:boolean}
const list=(answer:GuideAnswer,fallback:number[])=>Array.isArray(answer)?answer:fallback
/**
 * Input for one formative task. Pure and stateless: the parent owns the answer, native controls carry
 * keyboard access. `wrong` marks what to recheck after a failed attempt, never the expected answer.
 */
export function GuideTaskInput({id,question,answer,onChange,wrong=[],locked=false}:Props){
 if(question.type==='choice')return <>{question.options.map((option,i)=><label key={i} className={'guide-journey-option'+(answer===i?' is-selected':'')}><input type="radio" name={`${id}-answer`} checked={answer===i} disabled={locked} onChange={()=>onChange(i)}/><span>{option.text}</span></label>)}</>
 if(question.type==='number')return <label className="guide-journey-number"><span>Твой ответ ({question.unit})</span><input inputMode="decimal" type="text" maxLength={24} value={typeof answer==='string'?answer:''} disabled={locked} onChange={e=>onChange(e.target.value)} aria-describedby={`${id}-number-help`}/><small id={`${id}-number-help`}>Введи только число, без единицы измерения. Можно использовать запятую или точку.</small></label>
 if(question.type==='order'){
  const placed=list(answer,question.items.map((_,i)=>i))
  return <><p className="guide-journey-order-help">Расставь по порядку. Используй стрелки рядом с действием.</p><ol className="guide-journey-order">{placed.map((item,index)=><li key={item}><span><b aria-hidden="true">{index+1}</b>{question.items[item]}</span><div><Tap disabled={locked||index===0} aria-label={`Выше: ${question.items[item]}`} onClick={()=>onChange(moveGuideItem(placed,index,-1))}><ArrowUp size={17} aria-hidden="true"/></Tap><Tap disabled={locked||index===question.items.length-1} aria-label={`Ниже: ${question.items[item]}`} onClick={()=>onChange(moveGuideItem(placed,index,1))}><ArrowDown size={17} aria-hidden="true"/></Tap></div></li>)}</ol></>
 }
 if(question.type==='build'){
  // The next card always lands in the first free block, so the task needs no hidden selection state.
  const filled=list(answer,question.slots.map(()=>-1)),active=filled.indexOf(-1)
  return <>
   <p className="guide-journey-order-help">Нажми карточку: она встанет в подсвеченный блок. Нажми заполненный блок, чтобы освободить его.</p>
   <ol className="guide-journey-build">{question.slots.map((slot,i)=>{
    const card=filled[i],bad=wrong.includes(i)
    return <li key={i} data-active={i===active||undefined} data-filled={card>=0||undefined} data-wrong={bad||undefined}>
     <small>{slot.label}{bad&&<span className="guide-journey-recheck">проверь</span>}</small>
     {card>=0?<Tap disabled={locked} aria-label={`${slot.label}: ${question.bank[card]}. Освободить блок`} onClick={()=>onChange(filled.map((value,k)=>k===i?-1:value))}>{question.bank[card]}</Tap>:<span>{i===active?'Сюда встанет следующая карточка':'Пока пусто'}</span>}
    </li>
   })}</ol>
   <div className="guide-journey-bank" role="group" aria-label="Карточки для блоков">{question.bank.map((text,card)=>{
    const used=filled.includes(card)
    return <Tap key={card} aria-pressed={used} disabled={locked||used||active<0} onClick={()=>onChange(filled.map((value,k)=>k===active?card:value))}>{text}</Tap>
   })}</div>
  </>
 }
 if(question.type==='spot'){
  const picked=list(answer,[])
  return <>
   <p className="guide-journey-order-help">Можно отметить несколько строк.</p>
   <div className="guide-journey-spot"><p className="guide-journey-spot-source">{question.source}</p>{question.fragments.map((text,i)=>{
    const on=picked.includes(i),bad=wrong.includes(i)
    return <label key={i} className={'guide-journey-fragment'+(on?' is-selected':'')} data-wrong={bad||undefined}><input type="checkbox" checked={on} disabled={locked} onChange={()=>onChange(on?picked.filter(value=>value!==i):[...picked,i].sort((a,b)=>a-b))}/><span>{text}{bad&&<small className="guide-journey-recheck">лишняя отметка</small>}</span></label>
   })}</div>
  </>
 }
 const given=list(answer,question.items.map(()=>-1))
 return <div className="guide-journey-sort">{question.items.map((item,i)=>{
  const bad=wrong.includes(i)
  return <fieldset key={i} data-wrong={bad||undefined}><legend>{item.text}{bad&&<small className="guide-journey-recheck">проверь</small>}</legend><div>{question.groups.map((group,g)=><label key={g} className={'guide-journey-chip'+(given[i]===g?' is-selected':'')}><input type="radio" name={`${id}-sort-${i}`} checked={given[i]===g} disabled={locked} onChange={()=>onChange(given.map((value,k)=>k===i?g:value))}/><span>{group}</span></label>)}</div></fieldset>
 })}</div>
}
