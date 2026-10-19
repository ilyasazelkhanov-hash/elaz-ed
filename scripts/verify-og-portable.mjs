/** Outside-checkout OG build, including its own dependencies; never copies the master. */
import {cp,mkdtemp,readFile,writeFile,mkdir}from'node:fs/promises'
import{tmpdir}from'node:os'
import path from'node:path'
import{fileURLToPath}from'node:url'
import{spawn}from'node:child_process'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),temp=await mkdtemp(path.join(tmpdir(),'og-independent-')),out=path.join(temp,'og')
await mkdir(out)
for(const name of ['src','public','server','supabase','tests','scripts','content','package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts','vercel.json'])await cp(path.join(root,name),path.join(out,name),{recursive:true,filter:source=>!source.split(path.sep).some(part=>['.git','.temp','node_modules','.env'].includes(part))})
const env={...process.env};delete env.API_FILE
const run=args=>new Promise((resolve,reject)=>{const child=spawn(process.platform==='win32'?'npm.cmd':'npm',args,{cwd:out,env,windowsHide:true,shell:process.platform==='win32',stdio:'inherit'});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error('Independent OG check failed: '+args.join(' '))))})
await run(['ci','--ignore-scripts','--prefer-offline','--no-audit','--no-fund'])
for(const script of ['build','test:api','test:database'])await run(['run',script])
await mkdir(path.join(root,'test-results'),{recursive:true})
await writeFile(path.join(root,'test-results/og-independent-report.json'),JSON.stringify({out,masterPresent:false,checks:['own npm ci','production build','API checks','ordinary quiz PostgreSQL tests'],version:JSON.parse(await readFile(path.join(out,'package.json'),'utf8')).version},null,2))
console.log('PASS OG installed, built and tested without the master: '+out)
