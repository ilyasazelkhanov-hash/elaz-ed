import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { handleAcademyFiles } from '../../supabase/functions/api/academy-files.ts'

const actor = { id: 2, is_admin: false }, fileId = 'e88f155e-8d18-44df-a288-ac9197d89d70'
function fixture(overrides = {}) {
 const calls = [], file = { id:fileId,path:`2/${fileId}.txt`,filename:'work.txt',mime:'text/plain',expected_size:5 }
 const storage = { createSignedUploadUrl:async(...args)=>{calls.push(['sign',...args]);return {data:{signedUrl:'https://storage.example/upload?token=x',token:'x'},error:null}},list:async()=>({data:[{name:`${fileId}.txt`,metadata:{size:5,mimetype:'text/plain'}}],error:null}),download:async()=>({data:new Blob(['hello']),error:null}),createSignedUrl:async(...args)=>{calls.push(['download',...args]);return {data:{signedUrl:'https://storage.example/download'},error:null}},...overrides }
 const db = { rpc:async(name,args)=>{calls.push([name,args]);return {data:args.p_action==='ready'?{...file,state:'ready'}:file,error:null}},storage:{from(bucket){assert.equal(bucket,'academy-private');return storage}} }
 return {db,calls,file}
}
test('private signed upload is scoped to verified actor, never client path or admin flag',async()=>{
 const {db,calls}=fixture()
 const result=await handleAcademyFiles(db,actor,'file_upload',{lesson_code:'L',filename:'work.txt',mime:'text/plain',size:5,path:'victim/path',owner_id:3,is_admin:true})
 assert.equal(result.file_id,fileId);assert.equal(result.token,'x')
 assert.equal(calls[0][1].p_actor,2); assert.equal(calls[0][1].p_payload.owner_id,undefined)
 assert.deepEqual(calls[1],['sign',`2/${fileId}.txt`,{upsert:false}])
 for(const data of [{filename:'x.html',mime:'text/html',size:5},{filename:'x.svg',mime:'image/svg+xml',size:5},{filename:'x.pdf',mime:'application/pdf',size:10485761},{filename:'../x.txt',mime:'text/plain',size:5}]) await assert.rejects(handleAcademyFiles(db,actor,'file_upload',data),/academy_file_invalid/)
 await assert.rejects(handleAcademyFiles(db,null,'file_upload',{}),/academy_auth_required/)
 await assert.rejects(handleAcademyFiles({rpc:db.rpc},actor,'file_upload',{lesson_code:'L',filename:'x.txt',mime:'text/plain',size:5}),/academy_storage_unavailable/)
 const unavailable=fixture({createSignedUploadUrl:async()=>({data:null,error:{message:'bucket does not exist'}})})
 await assert.rejects(handleAcademyFiles(unavailable.db,actor,'file_upload',{lesson_code:'L',filename:'x.txt',mime:'text/plain',size:5}),/academy_storage_unavailable/)
})
test('finalize reads object metadata and bytes; payload cannot forge completion',async()=>{
 const {db,calls}=fixture()
 assert.equal((await handleAcademyFiles(db,actor,'file_finalize',{file_id:fileId,actual_size:999,actual_mime:'text/html'})).state,'ready')
 assert.equal(calls.at(-1)[1].p_payload.actual_size,5)
 const mismatch=fixture({list:async()=>({data:[{name:`${fileId}.txt`,metadata:{size:8,mimetype:'text/plain'}}],error:null})})
 await assert.rejects(handleAcademyFiles(mismatch.db,actor,'file_finalize',{file_id:fileId}),/academy_file_metadata_mismatch/)
 const missing=fixture({list:async()=>({data:[],error:null})})
 await assert.rejects(handleAcademyFiles(missing.db,actor,'file_finalize',{file_id:fileId}),/academy_file_upload_incomplete/)
 const forged=fixture({download:async()=>({data:new Blob(['<svg>']),error:null})})
 await assert.rejects(handleAcademyFiles(forged.db,actor,'file_finalize',{file_id:fileId}),/academy_file_content_invalid/)
 await handleAcademyFiles(db,actor,'file_download',{file_id:fileId})
 assert.deepEqual(calls.at(-1),['download',`2/${fileId}.txt`,60,{download:'work.txt'}])
})
test('SQL ownership, instructor assignment, consent revocation and public field privacy',async t=>{
 const db=new PGlite();t.after(()=>db.close())
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;')
 await db.exec(await readFile(new URL('../../supabase/migrations/001_init.sql',import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../../supabase/migrations/006_courses_stars_freezes.sql',import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../../supabase/migrations/20261018080000_ai_academy.sql',import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../../supabase/migrations/20261018150000_ai_academy_completion.sql',import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../../supabase/migrations/20261018170000_ai_academy_files.sql',import.meta.url),'utf8'))
 await db.exec(`insert into users(id) values(1),(2),(3),(4);insert into settings(key,value) values('admins','{"owner":1}');
 alter table aa_nodes disable trigger aa_validate_node;
 insert into aa_nodes(code,kind,parent_code,title,state,data,position) values('C','course',null,'Course','published','{}',0),('M','module','C','Module','published','{}',0),('L','lesson','M','Lesson','published','{}',0),('A','assessment','L','Assignment','published','{"kind":"assignment"}',0),('L2','lesson','M','Other','published','{}',1);
 insert into aa_enrollments(user_id,course_code,state) values(2,'C','active'),(3,'C','active');insert into aa_roles values(3,'instructor'),(4,'instructor');`)
 const files=async(user,action,payload={})=>(await db.query('select academy_files_action($1,$2,$3::jsonb) value',[user,action,JSON.stringify(payload)])).rows[0].value
 const portfolio=async(user,action,payload={})=>(await db.query('select academy_portfolio($1,$2,$3::jsonb) value',[user,action,JSON.stringify(payload)])).rows[0].value
 const f=await files(2,'reserve',{lesson_code:'L',filename:'work.txt',mime:'text/plain',size:5})
 assert.match(f.path,/^2\/[\da-f-]+\.txt$/)
 for (const filename of ['../work.txt','folder/work.txt','folder\\work.txt','work\n.txt']) await assert.rejects(files(2,'reserve',{lesson_code:'L',filename,mime:'text/plain',size:5}),/academy_file_invalid/)
 await assert.rejects(files(3,'owner',{file_id:f.id}),/academy_file_forbidden/)
 await assert.rejects(files(2,'ready',{file_id:f.id,actual_size:6,actual_mime:'text/plain'}),/academy_file_metadata_mismatch/)
 const valid=async(user,lesson,ids)=>(await db.query('select aa_valid_files($1,$2,$3::jsonb) value',[user,lesson,JSON.stringify({file_ids:ids})])).rows[0].value
 assert.equal(await valid(2,'A',[f.id]),false)
 await files(2,'ready',{file_id:f.id,actual_size:5,actual_mime:'text/plain'})
 assert.equal(await valid(2,'A',[f.id]),true);assert.equal(await valid(3,'A',[f.id]),false);assert.equal(await valid(2,'L2',[f.id]),false);assert.equal(await valid(2,'A',[f.id,f.id]),false);assert.equal(await valid(2,'A',null),false)
 await assert.rejects(db.query('select academy_action($1,$2,$3::jsonb)',[3,'submission_save',JSON.stringify({code:'A',artifact:{text:'stolen',file_ids:[f.id]}})]),/academy_files_invalid/)
 await db.exec('grant select on users,settings to service_role;set role service_role;')
 await files(2,'download',{file_id:f.id})
 await db.exec('reset role;')
 const s=(await db.query(`insert into aa_submissions(user_id,assessment_code,assessment_version,version,state,artifact,assigned_to) values(2,'A',1,1,'passed',$1,3) returning id`,[JSON.stringify({text:'Approved result',url:'https://example.org/result',file_ids:[f.id],private_notes:'SECRET'})])).rows[0]
 await files(3,'download',{file_id:f.id});await files(1,'download',{file_id:f.id});await assert.rejects(files(4,'download',{file_id:f.id,is_admin:true}),/academy_file_forbidden/)
 await assert.rejects(portfolio(2,'publish',{submission_id:s.id}),/academy_consent_required/)
 await assert.rejects(portfolio(3,'publish',{submission_id:s.id,consent:true}),/academy_portfolio_forbidden/)
 const entry=await portfolio(2,'publish',{submission_id:s.id,consent:true})
 const pub=await portfolio(null,'public',{slug:entry.slug})
 assert.deepEqual(pub.artifact,{text:'Approved result',url:'https://example.org/result'});assert.equal(JSON.stringify(pub).includes('owner_id'),false);assert.equal(JSON.stringify(pub).includes('SECRET'),false);assert.equal(JSON.stringify(pub).includes(f.id),false)
 for (const privateUrl of ['https://s3.example/object?X-Amz-Signature=SECRET&X-Amz-Credential=SECRET','https://example.org/result?api_key=SECRET','https://example.org/result?to%6ben=SECRET','https://example.org/result#access_token=SECRET']) {
  await db.query('update aa_submissions set artifact=$1 where id=$2',[JSON.stringify({text:'Approved result',url:privateUrl}),s.id])
  await portfolio(2,'publish',{submission_id:s.id,consent:true})
  const sanitized=await portfolio(null,'public',{slug:entry.slug})
  assert.deepEqual(sanitized.artifact,{text:'Approved result'});assert.equal(JSON.stringify(sanitized).includes('SECRET'),false)
 }
 await portfolio(2,'revoke',{submission_id:s.id});await assert.rejects(portfolio(null,'public',{slug:entry.slug}),/academy_portfolio_not_found/)
 await db.exec(`insert into aa_certificates(code,user_id,course_code) values('AA-public',2,'C');`)
 const cert=(await db.query("select academy_certificate_public('AA-public') value")).rows[0].value
 assert.equal(cert.valid,true);assert.equal(cert.course_title,'Course');assert.equal(cert.user_id,undefined)
 await db.exec("update aa_certificates set revoked_at=now() where code='AA-public'")
 assert.equal((await db.query("select academy_certificate_public('AA-public') value")).rows[0].value.valid,false)
 await db.exec(`set role anon;`)
 await assert.rejects(db.query("select academy_certificate_public('AA-public')"),/permission denied/)
 await assert.rejects(db.query('select * from aa_files'),/permission denied/)
})
