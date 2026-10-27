export function choosePortfolio(input){
 const {projects,budget,effortLimit,horizonMonths}=input
 if(!Array.isArray(projects)||projects.length>12||!Number.isFinite(budget)||budget<0||!Number.isFinite(effortLimit)||effortLimit<0||!Number.isInteger(horizonMonths)||horizonMonths<1)throw Error('portfolio_contract')
 const byId=new Map()
 for(const p of projects){if(!p||typeof p.id!=='string'||!/^[A-Z][A-Z0-9_]*$/.test(p.id)||byId.has(p.id)||typeof p.approved!=='boolean'||!Array.isArray(p.dependencies)||new Set(p.dependencies).size!==p.dependencies.length||typeof p.benefitGroup!=='string'||!p.benefitGroup||['setupCost','monthlyCapacityValue','monthlySupport','effortHours'].some(k=>!Number.isFinite(p[k])||p[k]<0))throw Error('portfolio_project');byId.set(p.id,p)}
 const visited=new Set(),visiting=new Set()
 function visit(id){if(visiting.has(id))throw Error('portfolio_cycle');if(visited.has(id))return;const p=byId.get(id);if(!p)throw Error('portfolio_unknown_dependency');visiting.add(id);for(const dep of p.dependencies)visit(dep);visiting.delete(id);visited.add(id)}
 for(const p of projects)visit(p.id)
 let best={ids:[],setupCost:0,effortHours:0,scenarioNetCapacityValue:0}
 for(let mask=1;mask<2**projects.length;mask++){
  const selected=projects.filter((_,i)=>mask&(1<<i)),ids=new Set(selected.map(p=>p.id));if(selected.some(p=>!p.approved||p.dependencies.some(d=>!ids.has(d))))continue
  if(new Set(selected.map(p=>p.benefitGroup)).size!==selected.length)continue
  const sum=k=>selected.reduce((n,p)=>n+p[k],0),setupCost=sum('setupCost'),effortHours=sum('effortHours');if(setupCost>budget||effortHours>effortLimit)continue
  const scenarioNetCapacityValue=horizonMonths*(sum('monthlyCapacityValue')-sum('monthlySupport'))-setupCost
  if(scenarioNetCapacityValue>best.scenarioNetCapacityValue||scenarioNetCapacityValue===best.scenarioNetCapacityValue&&setupCost<best.setupCost)best={ids:[...ids].sort(),setupCost,effortHours,scenarioNetCapacityValue}
 }
 return{...best,scope:'Fictional capacity valuation under declared constraints, not cash profit, approval or causal evidence.'}
}
