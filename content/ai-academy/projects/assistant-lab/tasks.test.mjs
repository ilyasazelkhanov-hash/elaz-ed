import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {TaskStore} from './tasks.mjs'
const student={id:'student',role:'student'},reviewer={id:'teacher',role:'reviewer'}
test('approval is bound to current version and another reviewer',()=>{const store=new TaskStore();try{const task=store.create(student,'TASK-A','Учебное обращение');assert.throws(()=>store.execute(student,task.id),/approval_required/);assert.throws(()=>store.approve({...student,role:'reviewer'},task.id,1),/approval_forbidden/);store.approve(reviewer,task.id,1);store.amend(student,task.id,'Изменённое обращение',1);assert.throws(()=>store.execute(student,task.id),/approval_required/);store.approve(reviewer,task.id,2);store.execute(student,task.id);store.execute(student,task.id);assert.equal(store.count(),1)}finally{store.close()}})
test('cancelled task cannot execute and another user cannot read or amend',()=>{const store=new TaskStore();try{store.create(student,'TASK-A','Обращение');assert.throws(()=>store.read({id:'other'},'TASK-A'),/not_found/);store.approve(reviewer,'TASK-A',1);store.cancel(student,'TASK-A');assert.throws(()=>store.execute(student,'TASK-A'),/approval_required/);assert.equal(store.count(),0)}finally{store.close()}})
test('approved checkpoint survives reopen and local execution remains atomic',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'assistant-'));let store;try{const file=path.join(root,'tasks.sqlite');store=new TaskStore(file);store.create(student,'TASK-A','Обращение');store.approve(reviewer,'TASK-A',1);store.close();store=new TaskStore(file);store.execute(student,'TASK-A');assert.equal(store.count(),1)}finally{store?.close();await rm(root,{recursive:true,force:true})}})
