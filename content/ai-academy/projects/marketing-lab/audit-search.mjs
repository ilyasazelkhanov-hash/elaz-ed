import {readFile} from 'node:fs/promises'
const input=JSON.parse(await readFile(new URL('./search-audit.json',import.meta.url),'utf8'))
const mentions=input.queries.filter(row=>row.answer.includes('Второй шов')).length
console.log(JSON.stringify({provenance:input.provenance,recordedQueries:input.queries.length,brandMentions:mentions,answersWithLinks:input.queries.filter(row=>row.citation).length,observedFraction:mentions/input.queries.length,liveSourcesVerified:input.queries.filter(row=>row.live_source_checked).length,scope:input.scope,marketVisibility:null},null,2))
