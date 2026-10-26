import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,cp,readFile,writeFile,rm,symlink} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {runPlan,safeFile} from './harness.mjs'
const plan=JSON.parse(await readFile(new URL('./plan.json',import.meta.url),'utf8'))
async function fixture(fn){const root=await mkdtemp(path.join(os.tmpdir(),'engineering-'));try{await cp(new URL('./starter/',import.meta.url),root,{recursive:true});await fn(root)}finally{await rm(root,{recursive:true,force:true})}}
test('reviewed patch preserves old tests and completes once across checkpoint reload',()=>fixture(async root=>{const first=await runPlan(root,plan);assert.equal(first.status,'done');assert.equal(first.audit.at(-1).result.tests,7);const second=await runPlan(root,plan);assert.equal(second.audit.length,3);const changed=structuredClone(plan);changed.id='another';await assert.rejects(runPlan(root,changed),/plan_changed/)}))
test('roles, budgets and traversal are rejected',()=>fixture(async root=>{await assert.rejects(runPlan(root,{...plan,maxSteps:2}),/invalid_plan_budget/);await assert.rejects(runPlan(root,{...plan,steps:[{id:'a',role:'reader',action:'apply_reviewed_patch'}]}),/action_not_allowed/);await assert.rejects(safeFile(root,'../other'),/path_not_allowed/)}))
test('source symlink and unexpected manual changes stop patching',()=>fixture(async root=>{await rm(path.join(root,'src/price.mjs'));await symlink(path.join(root,'test/base.test.mjs'),path.join(root,'src/price.mjs'));await assert.rejects(runPlan(root,plan),/symlink_not_allowed/)}))
test('cancel before next step does not apply a patch',()=>fixture(async root=>{await writeFile(path.join(root,'CANCEL'),'stop');const result=await runPlan(root,plan);assert.equal(result.status,'cancelled');assert.equal(result.audit.length,0);assert.ok(!(await readFile(path.join(root,'src/price.mjs'),'utf8')).includes('withFee'))}))
test('failing fixture tests preserve a failed status rather than success',()=>fixture(async root=>{await writeFile(path.join(root,'test/feature.test.mjs'),"import assert from 'node:assert/strict';import test from 'node:test';test('wrong expectation',()=>assert.equal(1,2));");await assert.rejects(runPlan(root,plan),/verification_failed/);const checkpoint=JSON.parse(await readFile(path.join(root,'checkpoint.json'),'utf8'));assert.equal(checkpoint.status,'failed');assert.equal(checkpoint.audit.at(-1).status,'failed')}))
