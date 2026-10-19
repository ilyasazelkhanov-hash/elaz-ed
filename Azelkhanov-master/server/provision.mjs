// Authenticated provisioning: no service secret in a workstation script or browser.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const args=process.argv.slice(2)
const option=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1]}
const root=resolve(option('--root','.')), endpoint=option('--url',process.env.AZ_API_URL)
if(!endpoint || !process.env.AZ_INIT_DATA) throw new Error('Set AZ_API_URL and fresh owner AZ_INIT_DATA. Usage: node server/provision.mjs --root CLIENT_FOLDER --url https://APP/api')
const readJson=async file=>JSON.parse(await readFile(resolve(root,file),'utf8'))
const config=await readJson('app.config.json'), brand=await readJson('brand.config.json')
const rebrand=value=>typeof value==='string'?value.replaceAll('Azelkhanov',brand.name):Array.isArray(value)?value.map(rebrand):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rebrand(v)])):value
const entities=rebrand((await readJson(option('--catalog','content/catalog.json'))).filter(e=>config.modules.includes(e.module)))
const rules=option('--rules')?await readJson(option('--rules')):{}
const response=await fetch(`${endpoint.replace(/\/$/,'')}/v1/provision`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({auth:process.env.AZ_INIT_DATA,config,brand,entities,rules}),signal:AbortSignal.timeout(60000)})
const result=await response.json()
if(!response.ok) throw new Error(`Provisioning failed (${response.status}): ${result.error || 'server_error'}`)
console.log(`Provisioned ${config.id}: ${entities.length} entities. Authentication material was not logged.`)
