export function subtotal(values){
 if(!Array.isArray(values)||!values.every(value=>Number.isSafeInteger(value)&&value>=0))throw new TypeError('invalid_prices')
 const result=values.reduce((sum,value)=>sum+value,0)
 if(!Number.isSafeInteger(result))throw new RangeError('total_too_large')
 return result
}
