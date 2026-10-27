export function policyDecision(policy,request){
 const deny=reason=>({allowed:false,reason})
 if(!request||request.policyVersion!==policy.version)return deny('policy_version_mismatch')
 if(!policy.dataClasses.includes(request.dataClass)||!policy.purposes.includes(request.purpose))return deny('unknown_class_or_purpose')
 if(!Object.hasOwn(policy.tools,request.tool))return deny('unknown_tool')
 const tool=policy.tools[request.tool]
 if(tool.approved!==true||!tool.dataClasses.includes(request.dataClass)||!tool.purposes.includes(request.purpose)||!tool.actions.includes(request.action))return deny('outside_declared_scope')
 return{allowed:true,reason:'local_declared_rule_matched_not_real_authorization'}
}
export function closeIncident(incident,review,policy){
 if(!incident||incident.status!=='mitigated'||typeof incident.owner!=='string'||!incident.owner||typeof incident.fixVersion!=='string'||!incident.fixVersion)throw Error('incident_not_ready')
 if(!review||typeof review.reviewer!=='string'||!review.reviewer||review.reviewer===incident.owner||review.policyVersion!==policy.version||review.fixVersion!==incident.fixVersion||review.residualRiskAccepted!==true||!Array.isArray(review.evidence)||!review.evidence.length||review.evidence.some(v=>typeof v!=='string'||!v.trim()))throw Error('incident_review_required')
 return{...structuredClone(incident),status:'closed',review:structuredClone(review),scope:'Local rehearsal state; identity, evidence truth and real approval must be verified separately.'}
}
