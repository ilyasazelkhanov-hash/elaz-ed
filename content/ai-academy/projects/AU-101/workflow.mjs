export const defaultConfig={acceptRequests:true,requireEmail:true,confidenceThreshold:0.8}
export function classifyResult(value, threshold) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !['repair','question','other'].includes(value.category) || typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1 || typeof value.summary !== 'string' || value.summary.length > 160) return {queue:'manual',reason:'invalid_model_output'}
  return {queue:value.confidence>=threshold?value.category:'manual',reason:value.confidence>=threshold?'accepted':'low_confidence'}
}
export function processRequest(state,request,config=defaultConfig,{failAt,modelOutput}={}) {
  const next=structuredClone(state),events=[]
  const step=(node,status,detail)=>events.push({node,status,detail})
  if(!config || typeof config.acceptRequests!=='boolean'||typeof config.requireEmail!=='boolean'||typeof config.confidenceThreshold!=='number'||!Number.isFinite(config.confidenceThreshold)||config.confidenceThreshold<0||config.confidenceThreshold>1)throw new TypeError('Invalid workflow settings')
  if(!config.acceptRequests){step('trigger','stopped','workflow_paused');return {state:next,events,status:'paused'}}
  if(!request||typeof request.id!=='string'||!/^REQ-\d{3}$/.test(request.id)||typeof request.message!=='string'||!request.message.trim()||request.message.length>1000||(request.email!==undefined&&typeof request.email!=='string')){step('validate','rejected','invalid_request');return {state:next,events,status:'rejected'}}
  step('trigger','passed',request.id)
  if(config.requireEmail&&(typeof request.email!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email))){step('filter','rejected','missing_email');return {state:next,events,status:'rejected'}}
  step('filter','passed','valid_input')
  const previous=next.rows.find(row=>row.id===request.id)
  if(previous){if(previous.message!==request.message||previous.email!==(request.email??'')){step('table','rejected','id_conflict');return {state:next,events,status:'conflict'}}step('table','skipped','already_saved');return {state:next,events,status:'duplicate'}}
  if(failAt==='table'){step('table','failed','simulated_storage_error');return {state:next,events,status:'failed'}}
  const classification=modelOutput===undefined?{queue:'manual',reason:'model_not_called'}:classifyResult(modelOutput,config.confidenceThreshold)
  step('classification','passed',classification.reason)
  const row={id:request.id,message:request.message,email:request.email??'',queue:classification.queue}
  const draft={id:request.id,state:'draft',text:`Заявка ${request.id}: очередь ${classification.queue}. Нужна проверка ответственным.`}
  next.rows.push(row);next.notifications.push(draft)
  step('table','passed','saved_with_notification_draft')
  if(failAt==='notification'){step('notification','failed','simulated_delivery_error');return {state:next,events,status:'saved_needs_attention'}}
  step('notification','draft','no_external_delivery')
  return {state:next,events,status:'saved'}
}
export const emptyState=()=>({rows:[],notifications:[]})
