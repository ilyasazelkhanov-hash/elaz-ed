export function parseOrders(csv){
 const lines=csv.trim().split(/\r?\n/),header=lines.shift();if(header!=='order_id,revenue_kzt,last_touch')throw Error('data_contract_columns')
 const seen=new Set();return lines.map(line=>{const values=line.split(',');const[id,amount,channel]=values;if(values.length!==3||!/^O\d+$/.test(id)||seen.has(id)||!/^\d+$/.test(amount)||!['search','social'].includes(channel))throw Error('invalid_or_duplicate_order');if(!Number.isSafeInteger(Number(amount)))throw Error('invalid_order_amount');seen.add(id);return{order_id:id,revenue_kzt:Number(amount),last_touch:channel}})
}
export function campaignReport(orders,campaign){
 if(Object.values(campaign.spend_kzt).some(value=>!Number.isFinite(value)||value<0))throw Error('invalid_spend');const stages=['sessions','leads','qualified','orders'].map(key=>campaign.funnel[key]);if(stages.some((value,i)=>!Number.isInteger(value)||value<0||i>0&&value>stages[i-1])||stages[3]!==orders.length)throw Error('invalid_funnel');const spend=Object.values(campaign.spend_kzt).reduce((a,b)=>a+b,0),revenue=orders.reduce((sum,row)=>sum+row.revenue_kzt,0)
 if(!Number.isFinite(spend)||spend<=0||!(campaign.gross_margin>=0&&campaign.gross_margin<=1))throw Error('invalid_campaign')
 const credited=Object.entries(campaign.platform_credits).map(([channel,ids])=>{if(new Set(ids).size!==ids.length||ids.some(id=>!orders.some(row=>row.order_id===id)))throw Error('unknown_or_duplicate_credit');return{channel,count:ids.length,revenue:ids.reduce((sum,id)=>sum+orders.find(row=>row.order_id===id).revenue_kzt,0)}})
 const lastTouch=Object.keys(campaign.spend_kzt).map(channel=>({channel,orders:orders.filter(row=>row.last_touch===channel).length,revenue:orders.filter(row=>row.last_touch===channel).reduce((sum,row)=>sum+row.revenue_kzt,0),spend:campaign.spend_kzt[channel]}))
 return{provenance:campaign.provenance,uniqueOrders:orders.length,uniqueRevenue:revenue,spend,roas:revenue/spend,contributionAfterAds:revenue*campaign.gross_margin-spend,platformReportedOrders:credited.reduce((sum,row)=>sum+row.count,0),platformReportedRevenue:credited.reduce((sum,row)=>sum+row.revenue,0),credited,lastTouch,scope:'attribution_is_not_incrementality'}
}
export function forecast({spend,cpc,leadRate,qualifiedRate,purchaseRate,averageOrder,grossMargin}){
 if(![spend,cpc,averageOrder].every(Number.isFinite)||spend<0||cpc<=0||averageOrder<0||![leadRate,qualifiedRate,purchaseRate,grossMargin].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('invalid_assumptions')
 const clicks=spend/cpc,leads=clicks*leadRate,qualified=leads*qualifiedRate,expectedOrders=qualified*purchaseRate,revenue=expectedOrders*averageOrder
 return{clicks,leads,qualified,expectedOrders,revenue,contributionAfterAds:revenue*grossMargin-spend,breakEvenRoas:grossMargin?1/grossMargin:null,assumptions:'Stationary funnel rates; no market forecast or guarantee.'}
}
export function experiment(control,treatment){
 for(const group of [control,treatment])if(!Number.isInteger(group.n)||!Number.isInteger(group.successes)||group.n<1||Math.min(group.successes,group.n-group.successes)<5)throw Error('normal_approximation_not_supported')
 const a=control.successes/control.n,b=treatment.successes/treatment.n,difference=b-a,se=Math.sqrt(a*(1-a)/control.n+b*(1-b)/treatment.n)
 return{controlRate:a,treatmentRate:b,difference,ci95Low:difference-1.95996398454*se,ci95High:difference+1.95996398454*se,method:'independent normal approximation; causal interpretation requires actual randomized design'}
}
export function trackingUrl(base,{source,medium,campaign,content}){
 const url=new URL(base);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('invalid_base_url')
 for(const [key,value]of Object.entries({source,medium,campaign,content})){if(typeof value!=='string'||!/[a-z]/.test(value)||!/^[a-z0-9_-]{1,60}$/.test(value))throw Error('invalid_tracking_code');url.searchParams.set('utm_'+key,value)}return url.href
}
export function validateClaims(draft,facts){for(const claim of draft.claims||[])if(!facts.some(f=>f.id===claim.evidence_id))throw Error('unsupported_claim');return{...draft,requiresHumanFactCheck:true}}

export function qualifyLead(lead){
 if(typeof lead.id!=='string'||!lead.id.trim())throw Error('lead_id_required')
 const reasons=[]
 if(!['bag','clothes'].includes(lead.service))reasons.push('service_needs_clarification')
 if(typeof lead.description!=='string'||lead.description.trim().length<10)reasons.push('description_needs_clarification')
 if(lead.contactConsent!==true)reasons.push('contact_permission_required')
 return{id:lead.id,state:reasons.length?'needs_clarification':'human_review',reasons,automaticRejection:false,requiresHuman:true}
}
