export function contrast(first,second){
 const luminance=hex=>{if(!/^#[0-9a-f]{6}$/i.test(hex))throw Error('invalid_color');const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
 const a=luminance(first),b=luminance(second);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)
}
export function validateAudit(proposal,measurements){
 if(!Array.isArray(proposal.findings))throw Error('findings_required')
 return proposal.findings.map(finding=>{
  const measured=measurements.find(row=>row.id===finding.measurement_id)
  if(!measured||measured.status!=='fail'||finding.code!==measured.code)throw Error('unsupported_finding')
  return{...finding,measurement:measured,requires_human_review:true}
 })
}
export function confusion(results){
 const n={tp:0,fp:0,tn:0,fn:0}
 for(const row of results)n[row.expected?row.detected?'tp':'fn':row.detected?'fp':'tn']++
 return{...n,precision:n.tp+n.fp?n.tp/(n.tp+n.fp):null,recall:n.tp+n.fn?n.tp/(n.tp+n.fn):null}
}
export function verifyChange(issue,evidence,reviewer){
 if(!reviewer||reviewer===issue.author)throw Error('independent_review_required')
 if(evidence.spec_version!==issue.spec_version||evidence.implementation_digest!==issue.implementation_digest)throw Error('stale_evidence')
 if(!evidence.before||!evidence.after||!evidence.assertions?.length||evidence.assertions.some(row=>row.passed!==true))throw Error('verification_incomplete')
 return{...issue,state:'verified',reviewer,evidence,scope:'local_learning_only'}
}
