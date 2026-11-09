/** Serialize snapshot-changing requests. Identical pending calls share one result. */
export function createActionQueue(onPending: (count: number) => void) {
  let tail: Promise<unknown> = Promise.resolve()
  const pending = new Map<string, Promise<unknown>>()
  return function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const existing = pending.get(key)
    if (existing) return existing as Promise<T>
    const run = tail.then(task)
    const settled = run.finally(() => {
      pending.delete(key)
      onPending(pending.size)
    })
    pending.set(key, settled)
    onPending(pending.size)
    tail = settled.catch(() => undefined)
    return settled
  }
}
