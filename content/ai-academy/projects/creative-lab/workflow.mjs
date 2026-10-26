import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {inspect,approve,release,assetPath} from './qa.mjs'
const root=fileURLToPath(new URL('./',import.meta.url)),manifest=JSON.parse(await readFile(root+'manifest.json','utf8')),action=process.argv[2]
try{
 if(action==='check')console.log(JSON.stringify(await inspect(root,manifest),null,2))
 else if(action==='approve'){
  const reviewer=process.argv.find(arg=>arg.startsWith('--reviewer='))?.slice(11)
  const approval=await approve(root,manifest,reviewer,'Учебное ручное ревью: факты, визуальная преемственность, права и субтитры проверены человеком.')
  await writeFile(root+'approval.json',JSON.stringify(approval,null,2)+'\n');console.log('Local learning approval recorded. This is not authenticated production approval.')
 }else if(action==='release'){
  const receipt=await release(root,manifest,JSON.parse(await readFile(root+'approval.json','utf8')))
  await mkdir(root+'release/assets',{recursive:true})
  for(const name of new Set(manifest.assets.flatMap(asset=>[asset.file,...asset.dependencies||[]])))await copyFile(await assetPath(root,name),root+'release/'+name)
  await writeFile(root+'release/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log('Exported local review package. Nothing was posted or sent.')
 }else throw Error('Use: node workflow.mjs check | approve --reviewer=teacher | release')
}catch(error){console.error(error.message);process.exitCode=1}
