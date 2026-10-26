import {mkdtemp,cp,readFile,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {runPlan} from './harness.mjs'
const root=await mkdtemp(path.join(os.tmpdir(),'engineering-demo-'))
try{await cp(new URL('./starter/',import.meta.url),root,{recursive:true});const plan=JSON.parse(await readFile(new URL('./plan.json',import.meta.url),'utf8'));const result=await runPlan(root,plan);const repeated=await runPlan(root,plan);console.log(JSON.stringify({status:result.status,steps:result.audit.length,tests:result.audit.at(-1).result,repeatedAuditEntries:repeated.audit.length,mode:'reviewed deterministic patch, no live coding model'},null,2))}finally{await rm(root,{recursive:true,force:true})}
