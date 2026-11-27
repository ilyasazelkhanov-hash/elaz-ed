import {ArrowRight,Check,CheckCheck,Circle,Send,Share2} from 'lucide-react'
import {Tap} from '../../ui'

type Props={
 done:boolean
 trained:{correct:number;total:number}
 work:'empty'|'draft'|'self_checked'
 demo:boolean
 next?:{title:string;minutes:number}
 telegramLink?:string|null
 onMark:()=>void
 onShare:()=>void
 onNext:()=>void
}
const workLabel={empty:'пока не сохранена',draft:'черновик сохранён',self_checked:'сохранена, самопроверка выполнена'} as const
/**
 * End of a free guide: what was actually done, the learner's own mark, and one next step.
 * The mark is a self-report. Nothing here grades the work, grants XP or claims a verified skill.
 */
export function GuideFinale({done,trained,work,demo,next,telegramLink,onMark,onShare,onNext}:Props){
 const facts:[boolean,string][]=[
  [trained.total>0&&trained.correct===trained.total,`Тренировка: ${trained.correct} из ${trained.total} заданий`],
  [work!=='empty',`Своя работа: ${workLabel[work]}`],
 ]
 return <section className="free-start-task free-start-finale" data-done={done||undefined} aria-label="Итог разбора">
  <h2>{done?'Разбор пройден':'Заверши разбор'}</h2>
  <ul className="free-start-finale-facts">{facts.map(([ok,text])=><li key={text} data-ok={ok||undefined}>{ok?<Check size={16} aria-hidden="true"/>:<Circle size={16} aria-hidden="true"/>}<span>{text}<span className="sr-only">{ok?' - сделано':' - ещё не сделано'}</span></span></li>)}</ul>
  <Tap feedback="none" onClick={onMark} aria-pressed={done} className={done?'is-done':''}><CheckCheck size={18}/>{done?'Попробовал · отменить отметку':'Я попробовал'}</Tap>
  <small>Отметку ставишь ты сам, она хранится в этом браузере{demo?' в демо-режиме':''}. Это не проверка результата, без оценки и XP.</small>
  {done&&<div className="free-start-finale-share">
   <p>Позови друга на этот же разбор: по ссылке он попадёт сразу сюда.</p>
   <Tap className="free-start-finale-secondary" onClick={onShare}><Share2 size={17} aria-hidden="true"/>Поделиться и позвать друга</Tap>
   {demo&&telegramLink&&<><a className="free-start-link" href={telegramLink} target="_blank" rel="noopener noreferrer"><Send size={16} aria-hidden="true"/>Продолжить в Telegram<ArrowRight size={16} aria-hidden="true"/></a><p className="free-start-note">Демо не переносит отметки в Telegram. Зато там есть XP, стрик и свежие разборы.</p></>}
  </div>}
  {done&&next&&<Tap className="free-start-finale-next" onClick={onNext}><span><small>Следующий бесплатный шаг · {next.minutes} мин</small>{next.title}</span><ArrowRight size={19} aria-hidden="true"/></Tap>}
 </section>
}
