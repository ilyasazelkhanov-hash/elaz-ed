import {readFile} from 'node:fs/promises'
import {pixelDiff} from './pixels.mjs'
try{if(process.argv.length!==4)throw Error('Use: node compare.mjs before.png after.png');const report=pixelDiff(await readFile(process.argv[2]),await readFile(process.argv[3]));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1}catch(error){console.error(error.message);process.exitCode=1}
