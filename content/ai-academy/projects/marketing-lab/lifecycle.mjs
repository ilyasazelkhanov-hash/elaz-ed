import {createHash} from 'node:crypto'
export function createLifecycle(){
 const contacts=new Map(),releases=new Map(),history=[]
 const hash=payload=>createHash('sha256').update(JSON.stringify(payload)).digest('hex')
 function eligible(id,now){const contact=contacts.get(id);if(!contact?.marketingConsent)throw Error('consent_required');if(history.filter(row=>row.id===id&&now-row.at>=0&&now-row.at<7*86400000).length>=2)throw Error('cadence_limit');return contact}
 return{
  setConsent(id,marketingConsent){if(typeof marketingConsent!=='boolean')throw Error('invalid_consent');const old=contacts.get(id);contacts.set(id,{marketingConsent,version:(old?.version||0)+1})},
  draft(id,campaign,step,body,now=Date.now()){const contact=eligible(id,now);const payload={id,campaign,step,body,consentVersion:contact.version,scope:'local_draft_not_sent'};return{payload,digest:hash(payload),creator:'author'}},
  approve(draft,reviewer){if(!reviewer||reviewer===draft.creator)throw Error('independent_review_required');if(hash(draft.payload)!==draft.digest)throw Error('draft_changed');return{digest:draft.digest,reviewer}},
  release(draft,approval,now=Date.now()){const key=JSON.stringify([draft.payload.id,draft.payload.campaign,draft.payload.step]);const contact=contacts.get(draft.payload.id);if(!contact?.marketingConsent||contact.version!==draft.payload.consentVersion)throw Error('consent_changed');if(approval?.digest!==hash(draft.payload)||draft.digest!==approval.digest||!approval.reviewer||approval.reviewer===draft.creator)throw Error('approval_missing_or_stale');const old=releases.get(key);if(old){if(old.digest!==draft.digest)throw Error('idempotency_conflict');return old}eligible(draft.payload.id,now);const receipt={key,digest:draft.digest,status:'prepared_not_sent'};releases.set(key,receipt);history.push({id:draft.payload.id,at:now});return receipt}
 }
}
