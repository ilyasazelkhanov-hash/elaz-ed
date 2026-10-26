import {execFileSync} from 'node:child_process'
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
const binary=process.env.N8N_BIN
if(!binary)throw Error('Set N8N_BIN to the installed n8n executable (tested with 2.44.7).')
const root=await mkdtemp(path.join(os.tmpdir(),'au101-n8n-'))
const env={...process.env,N8N_USER_FOLDER:root,N8N_DIAGNOSTICS_ENABLED:'false',N8N_VERSION_NOTIFICATIONS_ENABLED:'false',N8N_TEMPLATES_ENABLED:'false'}
const run=args=>{try{return execFileSync(binary,args,{env,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']})}catch(error){throw Error(`n8n ${args[0]} failed with exit ${error.status ?? 'unknown'}; raw execution output is withheld because it may contain internal tokens.`)}}
function execution(output){for(let i=output.indexOf('{');i>=0;i=output.indexOf('{',i+1)){try{const value=JSON.parse(output.slice(i).trim());if(value.data?.resultData)return value}catch{}}throw Error('n8n execution output missing; inspect local runner output without publishing tokens.')}
try{
 const template=JSON.parse(await readFile(new URL('./n8n-workflow.json',import.meta.url),'utf8'))
 for(const valid of [true,false]){
  const workflow=structuredClone(template);workflow.id=valid?'academyAu101Flow01':'academyAu101Empty01'
  if(!valid){const node=workflow.nodes.find(n=>n.name==='Учебная заявка');const input=JSON.parse(node.parameters.jsonOutput);input.email='';node.parameters.jsonOutput=JSON.stringify(input)}
  const file=path.join(root,valid?'valid.json':'empty.json');await writeFile(file,JSON.stringify(workflow));run(['import:workflow',`--input=${file}`])
  const result=execution(run(['execute',`--id=${workflow.id}`,'--rawOutput']))
  assert.equal(result.status,'success');assert.equal(result.finished,true)
  const runs=result.data.resultData.runData
  if(valid){const data=runs['Черновик результата'][0].data.main[0][0].json;assert.deepEqual(data,{requestId:'REQ-001',queue:'manual',notificationState:'draft'})}
  else{assert.equal(runs['Черновик результата'],undefined);assert.equal(runs['Email заполнен'][0].data.main[1].length,1)}
 }
 console.log('n8n: valid request reaches draft; empty email takes rejection branch. Both executions passed.')
}finally{await rm(root,{recursive:true,force:true})}
