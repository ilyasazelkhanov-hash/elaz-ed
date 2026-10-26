export function researchContext(notes){return{provenance:notes.provenance,records:notes.records.filter(n=>n.visibility==='public').map(({id,text})=>({id,text}))}}
export function validateSynthesis(notes,result){
 const context=researchContext(notes)
 if(!Array.isArray(result.findings)||!result.findings.length)throw Error('findings_required')
 return result.findings.map(finding=>{
  if(typeof finding.claim!=='string'||!finding.evidence?.length)throw Error('evidence_required')
  for(const ref of finding.evidence){const note=context.records.find(n=>n.id===ref.note_id);if(!note||typeof ref.quote!=='string'||!ref.quote.trim()||!note.text.includes(ref.quote))throw Error('quote_not_supported')}
  return{...finding,provenance:context.provenance,interpretation_requires_human_review:true}
 })
}
