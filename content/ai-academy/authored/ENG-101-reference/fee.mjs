import { quote } from '../../drafts/ENG-101/starter/quote.mjs'
export function quoteWithFee(labor, parts, fee) {
  if (!Number.isSafeInteger(fee) || fee < 0) throw new TypeError('Сбор должен быть неотрицательным целым числом')
  const result = quote(labor, parts) + fee
  if (!Number.isSafeInteger(result)) throw new RangeError('Слишком большая сумма')
  return result
}
