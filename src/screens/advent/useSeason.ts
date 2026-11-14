import { useEffect, useState } from 'react'
import { adventToday } from '../../lib/advent-season'
export function useSeasonToday() {
  const [today, setToday] = useState(() => adventToday())
  useEffect(() => {
    const update = () => setToday(adventToday())
    const timer = window.setInterval(update, 30000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update) }
  }, [])
  return today
}
