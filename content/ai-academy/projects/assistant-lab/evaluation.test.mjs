import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {evaluate} from './evaluate.mjs'
import {gradeSignals} from './grader.mjs'
import {extractiveAnswer,search} from './retrieval.mjs'
const read=name=>readFile(new URL(name,import.meta.url),'utf8').then(JSON.parse)
const documents=await read('./knowledge.json'),cases=await read('./eval-cases.json')
test('fixed 30-case retrieval/handoff benchmark and morphology regressions',()=>{const result=evaluate(documents,cases);assert.equal(result.cases,30);assert.equal(result.correctTopDocuments,30);assert.equal(result.correctHandoffs,30);assert.equal(result.privateLeaks,0);assert.equal(search(documents,'На какой улице находится мастерская?')[0].document.id,'FAQ-ADDRESS');assert.equal(extractiveAnswer(documents,'Какой срок готовности моего заказа?').needsHuman,true)})
test('grader calibration exposes false acceptance despite valid evidence and expected fact',()=>{const price=documents.find(doc=>doc.id==='FAQ-PRICE'),base={citations:[{id:price.id,quote:price.text}],needsHuman:false},reference={expectedDocument:price.id,referenceFacts:['1500']};const correct=gradeSignals({...base,answer:'Диагностика стоит 1500 тенге.'},reference,[price]);assert.equal(correct.referenceFactsPresent,true);const wrong=gradeSignals({...base,answer:'Диагностика стоит 900 тенге.'},reference,[price]);assert.equal(wrong.referenceFactsPresent,false);const unsupported=gradeSignals({...base,answer:'Диагностика стоит 1500 тенге. Любой ремонт бесплатный.'},reference,[price]);assert.equal(unsupported.schemaValid&&unsupported.referenceFactsPresent&&unsupported.expectedCitationPresent,true);assert.match(unsupported.limitation,/не обнаруживают все/)
})
