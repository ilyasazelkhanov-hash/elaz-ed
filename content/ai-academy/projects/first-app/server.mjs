import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {fileURLToPath,pathToFileURL} from 'node:url'
import path from 'node:path'
const directory=fileURLToPath(new URL('./',import.meta.url))
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.mjs':'app.mjs','/request.mjs':'request.mjs'}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8'}
export function createFirstAppServer(){return createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return}
 let pathname;try{pathname=new URL(req.url,'http://local').pathname}catch{res.writeHead(400);res.end();return}
 const file=Object.hasOwn(files,pathname)?files[pathname]:null
 if(!file){res.writeHead(404);res.end('Not found');return}
 try{const body=await readFile(path.join(directory,file));res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; object-src 'none'; base-uri 'none'"});res.end(req.method==='HEAD'?undefined:body)}catch{res.writeHead(500);res.end('File unavailable')}
})}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const port=Number(process.env.FIRST_APP_PORT||8766);if(!Number.isInteger(port)||port<1||port>65535)throw Error('FIRST_APP_PORT must be an integer between 1 and 65535');createFirstAppServer().listen(port,'127.0.0.1',()=>console.log(`Мастер рядом: http://127.0.0.1:${port}/ — local teaching data only.`))}
