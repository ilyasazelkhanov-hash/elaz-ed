import {readFile,realpath} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {runPlan} from './harness.mjs'
if(!process.argv[2]){console.error('Usage: node run.mjs ./isolated-teaching-copy');process.exit(1)}
try{const root=await realpath(process.argv[2]),original=await realpath(fileURLToPath(new URL('./starter/',import.meta.url)));if(root===original)throw Error('Copy starter to an isolated teaching folder first.');const plan=JSON.parse(await readFile(new URL('./plan.json',import.meta.url),'utf8'));console.log(JSON.stringify(await runPlan(root,plan),null,2))}catch(error){console.error('Teaching plan stopped:',error.message);process.exit(1)}
