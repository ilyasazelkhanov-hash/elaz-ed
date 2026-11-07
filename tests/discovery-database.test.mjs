import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('discovery cohorts respect mature windows, unique users, server receipts and permissions', async t => {
 const db = new PGlite(); t.after(() => db.close())
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
 for (const name of ['001_init.sql','006_courses_stars_freezes.sql','007_refunds_webhook_url.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'))
 await db.exec(`create table public.events(id bigint generated always as identity primary key,user_id bigint,name text,lesson_id bigint,props jsonb default '{}',created_at timestamptz default now());alter table public.payments add column refund_pending boolean not null default false;`)
 await db.exec(await readFile(new URL('../supabase/migrations/20261107063101_discovery_editorial.sql',import.meta.url),'utf8'))
 await db.exec(`update settings set value='"2026-11-01T00:00:00Z"'::jsonb where key='discovery_measurement_started_at';
 insert into users(id,created_at) values(1,'2026-11-02'),(2,'2026-11-18'),(3,'2026-10-01');
 insert into courses(id,title,published) overriding system value values(1,'Course',true);
 insert into lessons(id,title,published,course_id) overriding system value values(1,'Free',true,null),(2,'Private',true,1);
 insert into events(user_id,name,props,created_at) values
 (1,'guide_open','{"guide_id":"first-request"}','2026-11-02'),
 (1,'guide_open','{"guide_id":"first-request"}','2026-11-02'),
 (1,'guide_try','{"guide_id":"first-request"}','2026-11-03'),
 (1,'guide_open','{"guide_id":"check-answer"}','2026-11-10'),
 (2,'guide_try','{"guide_id":"first-request"}','2026-11-18'),
 (1,'guide_feedback','{"guide_id":"first-request","useful":false}','2026-11-04'),
 (1,'guide_feedback','{"guide_id":"first-request","useful":true}','2026-11-05'),
 (1,'checkout_start','{"course_id":1}','2026-11-05'),
 (1,'checkout_start','{"course_id":1}','2026-11-05'),
 (2,'checkout_result','{"course_id":1,"status":"paid"}','2026-11-19');
 insert into payments(user_id,course_id,stars,charge_id,created_at) values(1,1,100,'a','2026-11-06'),(3,1,100,'b','2026-11-07');
 update payments set refunded_at='2026-11-08' where charge_id='b';`)
 const summary = async now => (await db.query('select discovery_summary($1::timestamptz) value',[now])).rows[0].value
 const data=await summary('2026-11-20T00:00:00Z')
 assert.equal(data.activation.eligible,1)
 assert.equal(data.activation.attempted,1)
 assert.equal(data.activation.waiting,1)
 assert.deepEqual(data.return14,{eligible:1,returned:1,waiting:1})
 assert.deepEqual(data.feedback,{positive:1,responses:1})
 assert.equal(data.guides.find(g=>g.id==='first-request').opened,1)
 assert.equal(data.courses[0].checkout_users,1)
 assert.equal(data.courses[0].buyers,1,'client paid outcome never counts as a receipt')
 assert.equal(data.courses[0].stars,100)
 assert.equal(data.courses[0].refunded,1)
 assert.equal(data.courses[0].converted,1)
 await db.exec(`update events set created_at='2026-11-17' where user_id=1 and name='guide_open' and props->>'guide_id'='check-answer';`)
 assert.equal((await summary('2026-11-20')).return14.returned,0,'exact 336h boundary excluded')
 await db.exec(`insert into events(user_id,name,lesson_id,created_at) values(1,'lesson_open',1,'2026-11-18'),(1,'lesson_open',1,'2026-11-19'),(2,'lesson_open',2,'2026-11-19');`)
 assert.deepEqual((await summary('2026-11-20')).repeat7,{readers:1,repeated:1},'private course opens excluded')
 await db.exec(`update lessons set body='PRIVATE AUTHOR TEXT', editorial='{"kind":"evergreen","audience":"Beginners"}' where id=2;`)
 assert.equal((await db.query('select body from feed_cards where id=2')).rows[0].body,null)
 assert.equal((await db.query('select editorial from feed_cards where id=2')).rows[0].editorial.audience,'Beginners')
 await db.exec('set role anon')
 await assert.rejects(summary('2026-11-20'),/permission denied/)
})
