// Light suffix normalization for the Russian teaching corpus; not a full lemmatizer.
const stopWords=new Set(['как','что','где','когда','мне','для','это','есть','вас','какой','хочу','нужно'])
export const tokenize=text=>(String(text).toLocaleLowerCase('ru').match(/[\p{L}\p{N}]+/gu)||[]).filter(word=>word.length>2&&!stopWords.has(word)).map(word=>/^[а-яё]+$/u.test(word)&&word.length>=5?word.replace(/(иями|ями|ами|ого|ему|ому|ыми|ими|ой|ая|ое|ые|ий|ый|ам|ям|ах|ях|ом|ем|у|ю|а|я|е|ы|и|ь)$/u,''):word)

export function search(documents,question,{role='student',asOf='2026-10-26',limit=3}={}){
 const visible=documents.filter(doc=>doc.state==='published'&&doc.validFrom<=asOf&&(doc.visibility==='public'||role==='staff'))
 const corpus=visible.map(doc=>({doc,tokens:tokenize(doc.text+' '+doc.keywords)})),average=corpus.reduce((n,row)=>n+row.tokens.length,0)/(corpus.length||1),query=[...new Set(tokenize(question))]
 return corpus.map(({doc,tokens})=>{let score=0;for(const term of query){const tf=tokens.filter(t=>t===term).length;if(!tf)continue;const df=corpus.filter(row=>row.tokens.includes(term)).length,idf=Math.log(1+(corpus.length-df+0.5)/(df+0.5));score+=idf*(tf*2.2)/(tf+1.2*(0.25+0.75*tokens.length/average))}return {document:doc,score}}).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||a.document.id.localeCompare(b.document.id)).slice(0,limit)
}
export function extractiveAnswer(documents,question,options={}){
 const hits=search(documents,question,options)
 if(!hits.length)return {answer:'В доступном справочнике нет подтверждённого ответа. Нужна проверка человеком.',citations:[],needsHuman:true,mode:'extractive_baseline'}
 const doc=hits[0].document
 return {answer:doc.text,citations:[{id:doc.id,quote:doc.text}],needsHuman:doc.id==='FAQ-REFUND'||(doc.id==='FAQ-PRICE'&&/срок|готовност|заказ/iu.test(question)),mode:'extractive_baseline'}
}
export function validateProposal(proposal,allowedDocuments){
 if(!proposal||typeof proposal!=='object'||Array.isArray(proposal)||Object.keys(proposal).some(key=>!['answer','citations','needsHuman'].includes(key))||typeof proposal.answer!=='string'||!proposal.answer.trim()||proposal.answer.length>2000||!Array.isArray(proposal.citations)||proposal.citations.length>3||typeof proposal.needsHuman!=='boolean')throw Error('invalid_model_schema')
 for(const citation of proposal.citations){const document=allowedDocuments.find(doc=>doc.id===citation?.id);if(!document||typeof citation.quote!=='string'||citation.quote.trim().length<12||!document.text.includes(citation.quote))throw Error('invalid_citation')}
 if(!proposal.needsHuman&&!proposal.citations.length)throw Error('unsupported_answer')
 return structuredClone(proposal)
}
export function cosine(a,b){if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||!a.length||[...a,...b].some(n=>!Number.isFinite(n)))throw Error('invalid_vector');const dot=a.reduce((n,x,i)=>n+x*b[i],0),norm=Math.hypot(...a)*Math.hypot(...b);return norm?dot/norm:0}
