import type { ClientEvent } from './types'

/** In-memory only: bounded loss on a closed app is preferable to persisting personal activity. */
export function createEventQueue(options: {
 send: (events: ClientEvent[]) => Promise<void>
 schedule: (callback: () => Promise<void>, delay: number) => number
 cancel: (timer: number) => void
 enabled: () => boolean
}) {
 let pending: {event:ClientEvent; failures:number}[] = []
 let timer: number | undefined, sending = false
 const schedule = () => {
  if (!sending && pending.length && timer === undefined) timer = options.schedule(flush,1200)
 }
 async function flush() {
  if (timer !== undefined) {options.cancel(timer);timer=undefined}
  if (!options.enabled()) {pending=[];return}
  if (sending || !pending.length) return
  sending=true
  const batch=pending.splice(0,20)
  try {await options.send(batch.map(item=>item.event))}
  catch {
   const retry=batch.filter(item=>++item.failures<3)
   pending=[...retry,...pending].slice(-100)
  } finally {sending=false;schedule()}
 }
 return {
  push(event: ClientEvent) {
   if (!options.enabled()) return
   pending.push({event,failures:0})
   if (pending.length>100) pending.shift()
   schedule()
  },
  flush,
 }
}
