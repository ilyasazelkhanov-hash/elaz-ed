/** Учебные суммы в целых тенге. Никаких платежей и внешних запросов. */
export function quote(labor, parts) {
  if (![labor, parts].every(value => Number.isSafeInteger(value) && value >= 0)) {
    throw new TypeError('Стоимость должна быть неотрицательным целым числом')
  }
  const total = labor + parts
  if (!Number.isSafeInteger(total)) throw new RangeError('Слишком большая сумма')
  return Math.round((total >= 10_000 ? labor * 0.9 : labor) + parts)
}
