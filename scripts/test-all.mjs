// Generate books only in an isolated copy; never modify the user's tracked materials.
import {cp,mkdtemp,readFile,writeFile,mkdir,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn} from 'node:child_process'
import {checkEnvironment} from './test-environment.mjs'
const root=fileURLToPath(new URL('../',import.meta.url)),check=checkEnvironment()
if(check.problems.length){console.error(check.problems.join('\n'));process.exit(1)}
const out=await mkdtemp(path.join(tmpdir(),'og-audit-tests-'))
for(const name of ['src','public','server','supabase','tests','scripts','content','docs','package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts','vercel.json'])await cp(path.join(root,name),path.join(out,name),{recursive:true,filter:p=>!p.split(path.sep).some(part=>['node_modules','.git','.temp','__pycache__'].includes(part))})
await symlink(path.join(root,'node_modules'),path.join(out,'node_modules'),process.platform==='win32'?'junction':'dir')
const pkg=JSON.parse(await readFile(path.join(out,'package.json'),'utf8'))
const env={...process.env}
delete env.API_FILE;delete env.NODE_TEST_CONTEXT
const results=[]
const run=async(name,command)=>{
 const start=Date.now(),log=[]
 const status=await new Promise(resolve=>{
  const child=spawn(process.execPath,command,{cwd:out,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log.push(chunk);process.stdout.write(chunk)})
  child.on('error',e=>{log.push(Buffer.from(e.message));resolve(1)})
  child.on('close',code=>resolve(code??1))
 })
 await writeFile(path.join(root,'test-results',`${name.replaceAll(':','-')}.log`),Buffer.concat(log))
 results.push({name,status,duration_ms:Date.now()-start})
}
await mkdir(path.join(root,'test-results'),{recursive:true})
console.log('Isolated validation directory: '+out)
for(const [name,command] of Object.entries(pkg.scripts)){
 if(!name.startsWith('test:')||name==='test:all'||name==='test:ui-audit')continue
 if(!command.startsWith('node '))throw Error(`Unsupported test command ${name}`)
 const args=command.slice(5).split(/\s+/)
 if(args.includes('--test'))args.splice(args.indexOf('--test')+1,0,'--test-concurrency=1')
 await run(name,args)
}
// Explicit build stages avoid shell parsing and npm rewriting the source checkout.
await run('build-content',['scripts/academy-content.mjs'])
await run('build-types',['node_modules/typescript/bin/tsc','--noEmit'])
await run('build-vite',['node_modules/vite/bin/vite.js','build'])
await run('build-prerender',['scripts/academy-prerender.mjs'])
await writeFile(path.join(root,'test-results','audit-validation.json'),JSON.stringify({out,versions:check.versions,results},null,2))
process.exitCode=results.some(r=>r.status!==0)?1:0
