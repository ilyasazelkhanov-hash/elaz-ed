import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
test('payment search covers all matching users and treats wildcard characters literally',async t=>{
 const db=new PGlite();t.after(()=>db.close())
 await db.exec(`create role anon;create role authenticated;create role service_role;create table users(id bigint primary key,first_name text,username text);create table courses(id bigint primary key,title text);create table payments(id bigint primary key,user_id bigint,course_id bigint,stars integer,charge_id text,created_at timestamptz,refunded_at timestamptz,refund_pending boolean,purpose text);`)
 const files=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('_admin_payment_search.sql'))
 for(const file of files)await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
 await db.exec(`insert into users select n,'Matching Person','person'||n from generate_series(1,1002)n;insert into courses values(1,'Course');insert into payments values(1,1002,1,500,'literal%_charge',now(),null,true,'course'),(2,1,1,500,'literalXYcharge',now(),null,false,'course');`)
 const page=async(cursor,query)=>(await db.query('select admin_payment_page($1,$2) result',[cursor,query])).rows[0].result
 assert.deepEqual((await page(null,'Matching')).payments.map(p=>p.id),[2,1])
 assert.deepEqual((await page(null,'%_')).payments.map(p=>p.id),[1])
 assert.equal((await page(null,'PERSON1002')).payments[0].refund_pending,true)
 await db.exec(`insert into payments select n,1,1,500,'ch-'||n,now(),null,false,'course' from generate_series(3,55)n`)
 const first=await page(null,'');assert.equal(first.payments.length,50);assert.equal(first.next_cursor,6)
 assert.deepEqual((await page(first.next_cursor,'')).payments.map(p=>p.id),[5,4,3,2,1])
 await db.exec('set role authenticated')
 await assert.rejects(page(null,''),/permission denied/)
})
