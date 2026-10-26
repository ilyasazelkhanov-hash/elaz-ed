import http from 'node:http'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {requestJSON,withRetry,fetchPages,normalizeTickets} from './integration.mjs'
import {JobQueue} from './queue.mjs'
export function createLabServer(){
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),json=(code,data,headers={})=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))}
  try{
   const file={'/':'index.html','/client.mjs':'client.mjs','/style.css':'style.css'}[url.pathname]
   if(file){res.writeHead(200,{'Content-Type':file.endsWith('mjs')?'text/javascript':file.endsWith('css')?'text/css':'text/html; charset=utf-8'});res.end(await readFile(new URL(file,import.meta.url)));return}
   if(url.pathname==='/remote'||url.pathname==='/tickets'){
    if(req.headers.authorization!=='Bearer training-only'){json(401,{error:'mock_authentication_required'});return}
    if(url.pathname==='/tickets'){const page=Number(url.searchParams.get('page')||1);const pages={1:[{id:'T-001',email:' One@Example.test ',message:' Ремонт ',private_note:'FICTIONAL_INTERNAL_NOTE'},{id:'T-002',email:'two@example.test',message:'Вопрос'}],2:[{id:'T-002',email:'two@example.test',message:'Вопрос'},{id:'T-003',email:'',message:'Нет email'}]};json(200,{items:pages[page]||[],nextPage:page===1?2:null});return}
    const scenario=url.searchParams.get('scenario'),attempt=Number(url.searchParams.get('attempt'))
    if(scenario==='timeout'){const timer=setTimeout(()=>json(200,{ok:true}),150);res.on('close',()=>clearTimeout(timer));return}
    if((scenario==='429'||scenario==='500')&&attempt<3){json(Number(scenario),{error:'simulated_failure'},scenario==='429'?{'Retry-After':'1'}:{});return}
    json(200,{ok:true,attempt});return
   }
   if(url.pathname==='/run'){
    const scenario=url.searchParams.get('scenario'),origin=`http://127.0.0.1:${server.address().port}`
    if(scenario==='pages'){const items=await fetchPages(origin,{token:'training-only'});json(200,{scenario,received:items.length,...normalizeTickets(items)});return}
    if(scenario==='queue'){
     const queue=new JobQueue();try{queue.enqueue('JOB-ONE',{ticket:'T-001'});const first=queue.claim('worker-a',{now:0,leaseMs:100});queue.fail(first.id,'worker-a',{now:0,attempt:first.attempts,reason:'server_error',baseDelayMs:100});const early=queue.claim('worker-b',{now:50});const retry=queue.claim('worker-b',{now:100});queue.ack(retry.id,'worker-b',{now:101,attempt:retry.attempts});json(200,{scenario,earlyClaim:early,attempts:retry.attempts,metrics:queue.metrics(),clock:'simulated'})}finally{queue.close()}return
    }
    if(!['ok','401','429','500','timeout'].includes(scenario)){json(400,{error:'unknown_scenario'});return}
    const waits=[];let attempts=0
    try{const result=await withRetry(attempt=>{attempts=attempt;return requestJSON(`${origin}/remote?scenario=${scenario}&attempt=${attempt}`,{token:scenario==='401'?'wrong-training-token':'training-only',timeoutMs:scenario==='timeout'?20:1000})},{baseDelayMs:100,random:()=>0,wait:async ms=>waits.push(ms)});json(200,{scenario,attempts,logicalWaitsMs:waits,result,externalRequests:false})}
    catch(error){json(200,{scenario,attempts,logicalWaitsMs:waits,error:error.message,externalRequests:false})}return
   }
   json(404,{error:'not_found'})
  }catch{json(500,{error:'lab_error'})}
 });return server
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const server=createLabServer();server.listen(Number(process.env.PORT||5191),'127.0.0.1',()=>console.log('Лаборатория на локальном порту',server.address().port))}
