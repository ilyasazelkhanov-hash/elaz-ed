import {createHash} from 'node:crypto'
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {pathToFileURL,fileURLToPath} from 'node:url'
import path from 'node:path'
import {RELEASE} from './release-contract.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
export async function releaseManifest(base=root) {
  const sources=[]
  for (const directory of ['supabase/functions','supabase/migrations','src']) {
    const visit=async relative=>{
      for(const entry of (await readdir(path.join(base,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
        const name=`${relative}/${entry.name}`
        if(entry.isDirectory())await visit(name)
        else if(/\.(ts|tsx|css|sql)$/.test(name))sources.push({path:name,sha256:digest(await readFile(path.join(base,name)))})
      }
    }
    await visit(directory)
  }
  for(const name of ['package-lock.json','scripts/release-contract.mjs','scripts/release-smoke.mjs','scripts/release-manifest.mjs','scripts/verify-recovery.mjs'])sources.push({path:name,sha256:digest(await readFile(path.join(base,name)))})
  const frontend=[]
  try {
    for(const name of ['index.html',...(await readdir(path.join(base,'dist/assets'))).filter(name=>/\.(js|css)$/.test(name)).map(name=>`assets/${name}`)])frontend.push({path:`dist/${name}`,sha256:digest(await readFile(path.join(base,'dist',name)))})
  }catch{}
  let commit=null,dirty=null
  try {commit=execFileSync('git',['rev-parse','HEAD'],{cwd:base,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']}).trim();dirty=!!execFileSync('git',['status','--porcelain'],{cwd:base,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']}).trim()}catch{}
  return {schema:1,created_at:new Date().toISOString(),commit,dirty,expected_release:RELEASE,sources,sources_sha256:digest(JSON.stringify(sources)),frontend_build:frontend,scope:'Source and optional existing build fingerprints only; not deployment or backup evidence'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){await mkdir(path.join(root,'test-results'),{recursive:true});const manifest=await releaseManifest();await writeFile(path.join(root,'test-results/release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`Release manifest: ${manifest.commit??'unknown commit'}, dirty=${manifest.dirty}, ${manifest.sources.length} source fingerprints`)}
