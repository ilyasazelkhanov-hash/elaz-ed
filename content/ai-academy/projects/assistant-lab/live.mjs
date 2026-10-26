import {readFile} from 'node:fs/promises'
import {askModel} from './model-adapter.mjs'
const required=['AI_API_URL','AI_API_TOKEN','AI_MODEL'],missing=required.filter(name=>!process.env[name])
if(missing.length){console.error('Не настроены переменные:',missing.join(', '));process.exit(1)}
const documents=JSON.parse(await readFile(new URL('./knowledge.json',import.meta.url),'utf8'))
try{const result=await askModel({documents,question:process.argv[2]||'Сколько стоит диагностика?',endpoint:process.env.AI_API_URL,token:process.env.AI_API_TOKEN,model:process.env.AI_MODEL});console.log(JSON.stringify(result,null,2))}catch(error){console.error('Вызов модели не завершён:',/^model_http_\d+$|^invalid_|^missing_/.test(error.message)?error.message:'connection_or_provider_error');process.exit(1)}
