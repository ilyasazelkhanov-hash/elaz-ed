export function parsePilot(csv){
 const lines=csv.trim().split(/\r?\n/);if(lines.shift()!=='task_id,manual_min,draft_min,review_min,fix_min,manual_pass,ai_pass')throw Error('pilot_contract')
 const seen=new Set();return lines.map(line=>{const [id,...values]=line.split(',');if(seen.has(id)||!/^T\d+$/.test(id)||values.length!==6||values.some(v=>!/^\d+$/.test(v))||values.some(v=>!Number.isSafeInteger(Number(v)))||!['0','1'].includes(values[4])||!['0','1'].includes(values[5]))throw Error('pilot_row');seen.add(id);return{id,manual:Number(values[0]),draft:Number(values[1]),review:Number(values[2]),fix:Number(values[3]),manualPass:values[4]==='1',aiPass:values[5]==='1'}})
}
export function pilotMetrics(rows){
 if(!rows.length)throw Error('pilot_empty')
 const total=key=>rows.reduce((sum,row)=>sum+row[key],0),assisted=row=>row.draft+row.review+row.fix,pairs=rows.filter(row=>row.manualPass&&row.aiPass)
 return{provenance:'synthetic_records_not_real_pilot',tasks:rows.length,manualMinutes:total('manual'),draftMinutes:total('draft'),reviewMinutes:total('review'),fixMinutes:total('fix'),assistedMinutes:rows.reduce((sum,row)=>sum+assisted(row),0),rawDraftSavings:total('manual')-total('draft'),netMinutesSaved:total('manual')-rows.reduce((sum,row)=>sum+assisted(row),0),manualQualityRate:rows.filter(row=>row.manualPass).length/rows.length,assistedQualityRate:rows.filter(row=>row.aiPass).length/rows.length,comparablePairs:pairs.length,comparableManualMinutes:pairs.reduce((sum,row)=>sum+row.manual,0),comparableAssistedMinutes:pairs.reduce((sum,row)=>sum+assisted(row),0),comparableMinutesSaved:pairs.reduce((sum,row)=>sum+row.manual-assisted(row),0),scope:'Descriptive; pass-conditioned subset is not a causal or cash-savings estimate.'}
}
export function capacityScenario(input){
 for(const name of ['tasksPerMonth','hourlyValue','setupCost','monthlyTools','monthlySupport','variableCostPerTask'])if(!Number.isFinite(input[name])||input[name]<0)throw Error('invalid_economics')
 if(!Number.isFinite(input.minutesSaved)||!Number.isInteger(input.horizonMonths)||input.horizonMonths<1)throw Error('invalid_economics')
 const monthlyCapacityValue=input.tasksPerMonth*input.minutesSaved/60*input.hourlyValue,monthlyCost=input.monthlyTools+input.monthlySupport+input.tasksPerMonth*input.variableCostPerTask,totalCost=input.setupCost+input.horizonMonths*monthlyCost,totalCapacityValue=input.horizonMonths*monthlyCapacityValue,monthlyNet=monthlyCapacityValue-monthlyCost
 return{monthlyCapacityValue,monthlyCost,totalCost,totalCapacityValue,netCapacityValue:totalCapacityValue-totalCost,roi:totalCost?(totalCapacityValue-totalCost)/totalCost:null,paybackMonths:monthlyNet>0?input.setupCost/monthlyNet:null,horizonMonths:input.horizonMonths,scope:'Monetized capacity scenario, not proven cash savings.'}
}
export function pilotDecision(metrics,policy){
 if(!Number.isFinite(policy.minQualityRate)||policy.minQualityRate<0||policy.minQualityRate>1||!Number.isInteger(policy.minComparablePairs)||policy.minComparablePairs<1||!Number.isInteger(policy.openIncidents)||policy.openIncidents<0)throw Error('invalid_gate')
 if(policy.openIncidents)return{decision:'pause_and_review',reason:'unresolved_incidents'}
 if(metrics.assistedQualityRate<policy.minQualityRate)return{decision:'revise_before_scaling',reason:'quality_below_threshold'}
 if(metrics.comparablePairs<policy.minComparablePairs)return{decision:'collect_more_evidence',reason:'insufficient_comparable_pairs'}
 return{decision:'limited_next_stage_review',reason:'local_thresholds_met_not_causal_proof'}
}
export function wilsonRate(successes,total,z=1.96){
 if(!Number.isSafeInteger(total)||total<1||!Number.isSafeInteger(successes)||successes<0||successes>total||!Number.isFinite(z)||z<=0)throw Error('invalid_proportion')
 const p=successes/total,denominator=1+z*z/total,center=(p+z*z/(2*total))/denominator,margin=z*Math.sqrt(p*(1-p)/total+z*z/(4*total*total))/denominator
 return{low:Math.max(0,center-margin),high:Math.min(1,center+margin),method:'Wilson score interval; independent binomial observations assumed, not guaranteed by the synthetic paired dataset.'}
}
