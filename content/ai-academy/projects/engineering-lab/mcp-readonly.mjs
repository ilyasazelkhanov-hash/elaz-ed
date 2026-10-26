import readline from 'node:readline'
import {readFile} from 'node:fs/promises'
import {safeFile} from './harness.mjs'
const root=process.argv[2]
if(!root){console.error('Usage: node mcp-readonly.mjs /path/to/isolated/starter');process.exit(1)}
const tool={name:'read_project_file',description:'Read one permitted file from the isolated teaching project. No writes or commands.',inputSchema:{type:'object',properties:{path:{type:'string',enum:['AGENTS.md','src/price.mjs','test/base.test.mjs','test/feature.test.mjs']}},required:['path'],additionalProperties:false}}
const send=value=>process.stdout.write(JSON.stringify(value)+'\n')
let handshake=false,initialized=false
for await(const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})){
 let request
 try{if(Buffer.byteLength(line)>32768)throw Error('oversized');request=JSON.parse(line)}catch{send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON message'}});continue}
 if(request?.id===undefined){if(handshake&&request?.method==='notifications/initialized')initialized=true;continue}
 const id=request.id,response={jsonrpc:'2.0',id}
 if(request.jsonrpc!=='2.0'||typeof request.method!=='string'){send({...response,error:{code:-32600,message:'Invalid request'}});continue}
 if(request.method==='initialize'){handshake=true;initialized=false;send({...response,result:{protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},serverInfo:{name:'academy-readonly-fixture',version:'1.0.0'}}});continue}
 if(request.method==='ping'){send({...response,result:{}});continue}
 if(['tools/list','tools/call'].includes(request.method)&&!initialized){send({...response,error:{code:-32000,message:'Initialization required'}});continue}
 if(request.method==='tools/list'){send({...response,result:{tools:[tool]}});continue}
 if(request.method==='tools/call'){
  const args=request.params?.arguments
  if(request.params?.name!==tool.name||!args||typeof args.path!=='string'||Object.keys(args).some(key=>key!=='path')){send({...response,error:{code:-32602,message:'Invalid tool arguments'}});continue}
  try{const file=await safeFile(root,args.path),text=await readFile(file,'utf8');if(Buffer.byteLength(text)>16384)throw Error('file_too_large');send({...response,result:{content:[{type:'text',text}]}})}catch{send({...response,result:{content:[{type:'text',text:'Requested file is unavailable or outside the permitted scope.'}],isError:true}})}continue
 }
 send({...response,error:{code:-32601,message:'Method not found'}})
}
