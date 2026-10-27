export function allowedContext(meeting){return{provenance:meeting.provenance,date:meeting.date,records:meeting.records.filter(row=>row.visibility==='public').map(row=>({...row}))}}
export function meetingPacket(meeting){
 const context=allowedContext(meeting)
 return{provenance:context.provenance,facts:context.records.filter(row=>row.kind==='fact').map(row=>({text:row.text,source_id:row.id})),decisions:context.records.filter(row=>row.kind==='decision').map(row=>({text:row.text,source_id:row.id})),actions:context.records.filter(row=>row.kind==='action').map(row=>({text:row.text,source_id:row.id,owner:row.owner||null,due:row.due||null})),method:'deterministic tagged-note baseline, not a live LLM response'}
}
export function validateSummary(meeting,summary){
 const context=allowedContext(meeting)
 if(!Array.isArray(summary.claims))throw Error('claims_required')
 for(const claim of summary.claims){const row=context.records.find(note=>note.id===claim.source_id);if(!row||typeof claim.quote!=='string'||!claim.quote.trim()||!row.text.includes(claim.quote))throw Error('unsupported_evidence');if(claim.owner&&claim.owner!==row.owner||claim.due&&claim.due!==row.due)throw Error('invented_commitment')}
 return{...summary,requiresHumanInterpretationReview:true,provenance:context.provenance}
}
export function agenda(items,limitMinutes){
 if(!Number.isFinite(limitMinutes)||limitMinutes<=0||items.some(row=>!Number.isFinite(row.minutes)||row.minutes<=0||!row.decision?.trim()))throw Error('invalid_agenda')
 const total=items.reduce((sum,row)=>sum+row.minutes,0);if(total>limitMinutes)throw Error('time_limit');return{items,total,limitMinutes,remaining:limitMinutes-total}
}
export function followup(packet){return['# Учебный черновик follow-up','','Решения:',...packet.decisions.map(row=>`- ${row.text} (${row.source_id})`),'','Действия:',...packet.actions.map(row=>`- ${row.text} · ответственный: ${row.owner||'не назначен'} · срок: ${row.due||'не указан'} (${row.source_id})`),'','Проверь текст человеком перед использованием. Сообщение не отправлялось.'].join('\n')}
