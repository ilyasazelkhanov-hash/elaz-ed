import {createLifecycle} from './lifecycle.mjs'
const engine=createLifecycle(),day=86400000;engine.setConsent('C1',true)
for(const [step,at,body]of [['welcome',0,'Учебное приветствие: подготовьте фото вещи и вопрос.'],['reminder',4*day,'Учебное напоминание только при сохранённой подписке.'],['follow_up',9*day,'Учебное уточнение следующего шага без выдуманной срочности.']]){const draft=engine.draft('C1','repair_nov',step,body,at);console.log(JSON.stringify(engine.release(draft,engine.approve(draft,'teacher'),at)))}
engine.setConsent('C1',false)
try{engine.draft('C1','repair_nov','after_opt_out','Must not prepare',10*day);throw Error('unexpected_success')}catch(error){if(error.message!=='consent_required')throw error;console.log('Opt-out blocks the next draft. No message was sent.')}
