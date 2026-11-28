import { useEffect, useState } from 'react'
import { readSparks, subscribeSparks, type Sparks } from './practice-sparks'

/** Live local spark total for one account and mode. */
export function useSparks(scope: string): Sparks {
  const [value, setValue] = useState(() => readSparks(scope))
  useEffect(() => {
    const update = () => setValue(readSparks(scope))
    update()
    return subscribeSparks(scope, update)
  }, [scope])
  return value
}
