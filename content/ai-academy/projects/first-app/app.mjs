import {SERVICES,validateDraft,saveRequest,readRequest,deleteRequest} from './request.mjs'
const byId=id=>document.getElementById(id),form=byId('request-form'),confirmation=byId('confirmation')
const errorsFor={serviceId:'service-error',name:'name-error',contact:'contact-error'}
let status='editing',errors={}
const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)}
const draft=()=>({serviceId:form.querySelector('input[name="serviceId"]:checked')?.value,name:form.elements.name.value,contact:form.elements.contact.value})
function setStatus(value){status=value;document.documentElement.dataset.state=value;byId('save-button').disabled=value==='saving';for(const input of form.querySelectorAll('input'))input.disabled=value==='saving';byId('save-button').textContent=value==='saving'?'Сохраняем в этом браузере…':'Сохранить на этом устройстве'}
function showErrors(next){errors=next;for(const [key,id]of Object.entries(errorsFor)){const field=byId(id);field.textContent=next[key]||'';field.hidden=!next[key];const input=key==='serviceId'?form.querySelector('input[name="serviceId"]'):form.elements[key];if(next[key])input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid')}
 const summary=byId('error-summary');summary.textContent=next.storage|| (Object.keys(next).length?'Заявка не сохранена. Исправь отмеченные поля — введённые значения остались в форме.':'');summary.hidden=!Object.keys(next).length}
function updateService(){const selected=SERVICES.find(service=>service.id===draft().serviceId);byId('selected-service').textContent='Выбрано: '+(selected?.title||'выбери услугу')}
function showSaved(request,focus=false){form.hidden=true;confirmation.hidden=false;byId('saved-service').textContent=SERVICES.find(service=>service.id===request.serviceId).title;byId('saved-name').textContent=request.name;byId('saved-contact').textContent=request.contact;const time=byId('saved-time');time.textContent=new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(request.createdAt));time.dataset.createdAt=request.createdAt;byId('save-status').textContent='';setStatus('success');if(focus)byId('saved-heading').focus()}
function editing(focus=false){form.reset();form.hidden=false;confirmation.hidden=true;byId('load-notice').hidden=true;byId('delete-status').textContent='';byId('save-status').textContent='';showErrors({});setStatus('editing');updateService();if(focus)form.querySelector('input[name="serviceId"]').focus()}
form.addEventListener('input',event=>{if(status==='saving')return;updateService();if(event.target.name&&Object.keys(errors).length){const validation=validateDraft(draft()),next={...errors};delete next.storage;if(validation[event.target.name])next[event.target.name]=validation[event.target.name];else delete next[event.target.name];showErrors(next)}})
form.addEventListener('submit',async event=>{event.preventDefault();if(status==='saving')return;const value=draft(),next=validateDraft(value);showErrors(next);if(Object.keys(next).length){setStatus('error');byId('error-summary').focus();return}
 const simulate=byId('simulate-storage-failure').checked;setStatus('saving');byId('save-status').textContent='Записываем в localStorage. HTTP-запроса и отправки мастеру нет.'
 // A short local delay makes the saving state visible; it does not simulate network delivery.
 await new Promise(resolve=>setTimeout(resolve,180))
 const result=saveRequest(simulate?{setItem(){throw Error('local_training_failure')}}:storage,value)
 if(result.ok){showErrors({});showSaved(result.request,true)}else{setStatus('error');byId('save-status').textContent='';showErrors(result.errors);byId('error-summary').focus()}
})
byId('new-request').addEventListener('click',()=>editing(true))
byId('delete-request').addEventListener('click',()=>{const result=deleteRequest(storage);if(result.ok){editing(true);const notice=byId('load-notice');notice.textContent='Учебная заявка удалена с этого устройства. Мастеру ничего не отправлялось.';notice.hidden=false}else byId('delete-status').textContent='Не удалось удалить запись. Проверь разрешения хранилища в браузере.'})
const loaded=readRequest(storage)
if(loaded.state==='saved')showSaved(loaded.request)
else{editing();if(loaded.state!=='empty'){const notice=byId('load-notice');notice.textContent=loaded.state==='unavailable'?'Хранилище браузера недоступно. Открыта форма; сохранение может завершиться ошибкой.':'Сохранённую запись не удалось прочитать. Открыта пустая форма; автоматического восстановления нет.';notice.hidden=false}}
