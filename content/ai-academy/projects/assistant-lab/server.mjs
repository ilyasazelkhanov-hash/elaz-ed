import http from 'node:http'
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {extractiveAnswer,search,validateProposal} from './retrieval.mjs'
const documents=JSON.parse(await readFile(new URL('./knowledge.json',import.meta.url),'utf8'))
export function createAssistantServer(){return http.createServer(async(req,res)=>{
 const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
 try{const url=new URL(req.url,'http://localhost'),file={'/':'index.html','/client.mjs':'client.mjs','/style.css':'style.css'}[url.pathname];if(file){res.writeHead(200,{'Content-Type':file.endsWith('mjs')?'text/javascript':file.endsWith('css')?'text/css':'text/html; charset=utf-8'});res.end(await readFile(new URL(file,import.meta.url)));return}
 if(req.method==='GET'&&url.pathname==='/ask'){const question=url.searchParams.get('q')||'';if(!question.trim()||question.length>2000){reply(400,{error:'invalid_question'});return}const hits=search(documents,question);reply(200,{...extractiveAnswer(documents,question),retrieved:hits.map(({document,score})=>({id:document.id,text:document.text,score})),notice:'Детерминированный поиск и извлечение текста. Реальная модель не вызывалась.'});return}
 if(req.method==='POST'&&url.pathname==='/validate'){let length=0,body='';for await(const chunk of req){length+=chunk.length;if(length>8192){reply(413,{error:'too_large'});return}body+=chunk}let input;try{input=JSON.parse(body)}catch{reply(400,{error:'bad_json'});return}try{const allowed=search(documents,String(input.question||'')).map(row=>row.document);const proposal=validateProposal(input.proposal,allowed);reply(200,{valid:true,proposal,notice:'Проверены структура и точность цитаты. Смысл ответа требует отдельной проверки.'})}catch{reply(400,{error:'invalid_proposal'})}return}
 reply(404,{error:'not_found'})
 }catch{reply(500,{error:'lab_error'})}
})}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const server=createAssistantServer();server.listen(Number(process.env.PORT||5192),'127.0.0.1',()=>console.log('Лаборатория помощника на локальном порту',server.address().port))}
