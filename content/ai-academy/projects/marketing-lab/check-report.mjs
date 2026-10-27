import {readFile} from 'node:fs/promises'
import {report} from './marketing.mjs'
try{const saved=JSON.parse(await readFile(new URL('./report.json',import.meta.url),'utf8')),current=await report();if(JSON.stringify(saved)!==JSON.stringify(current))throw Error('report_stale');console.log('Report matches current source data and calculations. This does not verify the origin of observations.')}catch(error){console.error('Report is missing, invalid or stale. Run node generate.mjs and review the source changes.');process.exitCode=1}
