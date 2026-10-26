/** Учебные тарифы вводятся явно; это не цены какого-либо поставщика. */
export function estimateCost({inputTokens,outputTokens,inputPerMillion,outputPerMillion,fixedCost=0}){
 for(const value of [inputTokens,outputTokens])if(!Number.isSafeInteger(value)||value<0)throw new TypeError('invalid_token_count')
 for(const value of [inputPerMillion,outputPerMillion,fixedCost])if(!Number.isFinite(value)||value<0)throw new TypeError('invalid_rate')
 const inputCost=inputTokens/1_000_000*inputPerMillion,outputCost=outputTokens/1_000_000*outputPerMillion
 return {inputCost,outputCost,fixedCost,total:inputCost+outputCost+fixedCost,currency:'fictional_USD'}
}
