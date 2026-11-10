/** A screen may only publish the newest request, including failures and unmounts. */
export interface LatestRequestState<T> {
  key: string
  loading: boolean
  value?: T
  error: string
}
export function createLatestRequest<T>(publish: (state: LatestRequestState<T>) => void) {
  let generation = 0
  let activeKey: string | undefined
  return {
    select(key: string) { generation++; activeKey = key },
    invalidate() { generation++; activeKey = undefined },
    async run(key: string, request: () => Promise<T | undefined>) {
      if (activeKey !== key) return
      const current = ++generation
      publish({ key, loading: true, error: '' })
      try {
        const value = await request()
        if (current !== generation) return
        publish(value === undefined
          ? { key, loading: false, error: 'Не удалось загрузить операции. Повторите обновление.' }
          : { key, loading: false, value, error: '' })
      } catch (e) {
        if (current === generation)
          publish({ key, loading: false, error: e instanceof Error ? e.message : 'Не удалось загрузить операции.' })
      }
    },
  }
}
