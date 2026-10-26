import {validateProposal} from './retrieval.mjs'
export function gradeSignals(proposal,{expectedDocument,referenceFacts},documents){
 let schemaValid=true;try{validateProposal(proposal,documents)}catch{schemaValid=false}
 return {schemaValid,expectedCitationPresent:Array.isArray(proposal?.citations)&&proposal.citations.some(c=>c.id===expectedDocument),referenceFactsPresent:typeof proposal?.answer==='string'&&referenceFacts.every(fact=>proposal.answer.includes(fact)),limitation:'Проверки не обнаруживают все добавленные неподтверждённые утверждения.'}
}
