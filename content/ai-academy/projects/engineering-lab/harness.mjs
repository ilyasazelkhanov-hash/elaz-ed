import {readFile,writeFile,realpath,lstat,rename,access} from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const hash=value=>createHash('sha256').update(value).digest('hex')
const baseSource=await readFile(new URL('./starter/src/price.mjs',import.meta.url),'utf8')
const patch='\nexport function withFee(values,fee){\n if(!Number.isSafeInteger(fee)||fee<0)throw new TypeError(\'invalid_fee\')\n const result=subtotal(values)+fee\n if(!Number.isSafeInteger(result))throw new RangeError(\'total_too_large\')\n return result\n}\n'
const roles={reader:new Set(['read']),implementer:new Set(['apply_reviewed_patch']),tester:new Set(['test'])}
export async function safeFile(root,relative){
 if(typeof relative!=='string'||path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..')||!['AGENTS.md','src/price.mjs','test/base.test.mjs','test/feature.test.mjs'].includes(relative))throw Error('path_not_allowed')
 const resolved=await realpath(root);let current=resolved
 for(const part of relative.split('/')){current=path.join(current,part);if((await lstat(current)).isSymbolicLink())throw Error('symlink_not_allowed')}
 return current
}
export async function runPlan(root,plan){
 if(!plan||!Array.isArray(plan.steps)||!Number.isInteger(plan.maxSteps)||plan.maxSteps<1||plan.maxSteps>10||plan.steps.length>plan.maxSteps||!Number.isInteger(plan.timeoutMs)||plan.timeoutMs<1||plan.timeoutMs>10000)throw Error('invalid_plan_budget')
 if(new Set(plan.steps.map(step=>step.id)).size!==plan.steps.length)throw Error('duplicate_step_id')
 for(const step of plan.steps)if(!roles[step.role]?.has(step.action))throw Error('action_not_allowed_for_role')
 const resolved=await realpath(root),checkpoint=path.join(resolved,'checkpoint.json'),digest=hash(JSON.stringify(plan))
 let state
 try{state=JSON.parse(await readFile(checkpoint,'utf8'));if(state.planDigest!==digest)throw Error('plan_changed')}catch(error){if(error.code!=='ENOENT')throw error;state={planDigest:digest,index:0,status:'running',audit:[]}}
 const save=async()=>{await writeFile(checkpoint+'.tmp',JSON.stringify(state,null,2)+'\n');await rename(checkpoint+'.tmp',checkpoint)}
 if(state.status==='done'||state.status==='cancelled')return state
 for(let i=state.index;i<plan.steps.length;i++){
  try{await access(path.join(resolved,'CANCEL'));state.status='cancelled';await save();return state}catch(error){if(error.code!=='ENOENT')throw error}
  const step=plan.steps[i];let result
  if(step.action==='read'){const file=await safeFile(resolved,step.path);const text=await readFile(file,'utf8');if(Buffer.byteLength(text)>16384)throw Error('file_too_large');result={bytes:Buffer.byteLength(text)}}
  if(step.action==='apply_reviewed_patch'){const file=await safeFile(resolved,'src/price.mjs'),source=await readFile(file,'utf8');if(source!==baseSource&&source!==baseSource+patch)throw Error('unreviewed_source_change');if(source===baseSource)await writeFile(file,baseSource+patch);result={sourceHash:hash(baseSource+patch)}}
  if(step.action==='test'){
   for(const file of ['src/price.mjs','test/base.test.mjs','test/feature.test.mjs'])await safeFile(resolved,file)
   let output
   const childEnvironment={...process.env};delete childEnvironment.NODE_TEST_CONTEXT
   try{output=execFileSync(process.execPath,['--test','--test-reporter=tap','test/base.test.mjs','test/feature.test.mjs'],{cwd:resolved,env:childEnvironment,timeout:plan.timeoutMs,maxBuffer:65536,encoding:'utf8',shell:false,stdio:['ignore','pipe','pipe']})}catch(error){state.status='failed';state.audit.push({step:step.id,action:'test',status:'failed',exitCode:error.status??null});await save();throw Error('verification_failed')}
   const tests=Number(output.match(/# tests (\d+)/)?.[1]),passed=Number(output.match(/# pass (\d+)/)?.[1]);if(!tests||tests!==passed)throw Error('verification_incomplete');result={tests,passed}
  }
  state.audit.push({step:step.id,role:step.role,action:step.action,status:'passed',result});state.index=i+1;state.status='running';await save()
 }
 state.status='done';await save();return state
}
