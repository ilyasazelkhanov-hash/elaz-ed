import {createHash} from 'node:crypto'
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export function draftDecision(plan,report,creator,cap){
 if(typeof creator!=='string'||!creator.trim()||!Number.isFinite(cap)||cap<0||!Number.isFinite(plan.requestedSpend)||plan.requestedSpend<0||plan.requestedSpend>cap)throw Error('budget_or_actor_invalid')
 const payload={plan,reportDigest:digest(report),creator,cap,scope:'local_learning_recommendation'}
 return{payload,digest:digest(payload)}
}
export function approveDecision(draft,report,reviewer){
 if(typeof reviewer!=='string'||!reviewer.trim()||reviewer===draft.payload.creator)throw Error('independent_review_required')
 if(draft.digest!==digest(draft.payload)||draft.payload.reportDigest!==digest(report))throw Error('decision_or_report_changed')
 return{digest:draft.digest,reviewer}
}
export function releaseDecision(draft,approval,report){
 if(!approval?.reviewer||approval.reviewer===draft.payload.creator||approval.digest!==digest(draft.payload)||draft.digest!==approval.digest||draft.payload.reportDigest!==digest(report))throw Error('approval_missing_or_stale')
 if(draft.payload.plan.requestedSpend>draft.payload.cap)throw Error('budget_cap')
 return{status:'recommendation_prepared_not_applied',requestedSpend:draft.payload.plan.requestedSpend,digest:draft.digest,scope:'no_platform_api_no_payment_no_messages'}
}
