import {readFile} from 'node:fs/promises'
import {validateAudit,confusion} from './quality.mjs'
const input=JSON.parse(await readFile(new URL('./audit-cases.json',import.meta.url),'utf8'))
const results=input.proposals.map(proposal=>{let accepted=false;try{validateAudit({findings:[proposal.finding]},input.measurements);accepted=true}catch{}return{id:proposal.id,expected:proposal.expected_supported,detected:accepted}})
console.log(JSON.stringify({provenance:input.provenance,results,validatorScore:confusion(results),limitation:'Checks references to measurements, not visual understanding or WCAG conformance.'},null,2))
