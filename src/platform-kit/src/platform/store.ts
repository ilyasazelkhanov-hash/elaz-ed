import { create } from 'zustand'
import type { AppConfig, Data, PlatformApi, Snapshot } from './contracts.ts'
import { incomingGift } from './gift-links.ts'
import { createActionQueue } from './action-queue.ts'
import { createApi, haptic } from './client.ts'
export interface View {
  type: string
  id?: string
}
interface PlatformStore {
  snapshot: Snapshot | null
  api: PlatformApi | null
  loading: boolean
  error: string
  busy: boolean
  pendingActions: number
  stack: View[]
  toast: string
  celebration: string
  cart: { entityId: string; quantity: number; variant: string }[]
  boot: (config: AppConfig, base?: string) => Promise<void>
  act: (action: string, payload?: Data) => Promise<Data | undefined>
  push: (view: View) => void
  back: () => void
  home: () => void
  message: (text: string) => void
  celebrate: (text: string) => void
  addCart: (entityId: string, variant: string) => void
  removeCart: (entityId: string, variant: string) => void
  clearCart: () => void
}
let session = 0
let queueApi: PlatformApi | null = null
let queueSession = 0
let enqueue = createActionQueue(() => undefined)
let toastTimer: ReturnType<typeof setTimeout>
export const usePlatform = create<PlatformStore>((set, get) => ({
  snapshot: null,
  api: null,
  loading: true,
  error: '',
  busy: false,
  pendingActions: 0,
  stack: [{ type: 'home' }],
  toast: '',
  celebration: '',
  cart: [],
  boot: async (config, base) => {
    session++
    const bootSession = session
    set({ loading: true, error: '', api: null, snapshot: null, busy: false, pendingActions: 0 })
    try {
      const api = await createApi(config, base)
      const snapshot = await api.bootstrap()
      if (bootSession !== session) return
      set({
        api,
        snapshot,
        loading: false,
        stack: [
          {
            type: location.pathname.endsWith('/admin')
              ? 'admin'
              : location.pathname.endsWith('/redeem')
                ? 'cashier'
                : incomingGift()
                  ? 'gifts'
                  : new URLSearchParams(location.search).has('industry')
                    ? 'industry'
                    : 'home',
            id: new URLSearchParams(location.search).get('industry') ?? undefined,
          },
        ],
      })
    } catch (e) {
      if (bootSession === session) set({ error: e instanceof Error ? e.message : 'Не удалось открыть приложение', loading: false })
    }
  },
  act: (action, payload = {}) => {
    const actionSession = session
    const api = get().api
    if (queueApi !== api || queueSession !== actionSession) {
      queueApi = api
      queueSession = actionSession
      enqueue = createActionQueue((pendingActions) => {
        if (session === actionSession && get().api === api) set({ pendingActions, busy: pendingActions > 0 })
      })
    }
    return enqueue(`${actionSession}:${action}:${JSON.stringify(payload)}`, async () => {
      // A queued action must never run against another account/application after boot.
      if (!api || actionSession !== session || api !== get().api || !get().snapshot) return undefined
      try {
        const before = get().snapshot!.me
        const result = await api.dispatch(action, payload)
        if (actionSession !== session || api !== get().api) return undefined
        set({ snapshot: result.snapshot })
        haptic('success')
        return {
          ...result.result,
          gainedXp: (result.snapshot.me.platformXp ?? result.snapshot.me.xp) - (before.platformXp ?? before.xp),
          gainedPoints: result.snapshot.me.points - before.points,
        }
      } catch (e) {
        if (actionSession === session && api === get().api) get().message(e instanceof Error ? e.message : 'Не удалось выполнить действие')
        return undefined
      }
    })
  },
  push: (view) => {
    haptic()
    set((s) => ({ stack: [...s.stack, view] }))
  },
  back: () => set((s) => ({ stack: s.stack.length > 1 ? s.stack.slice(0, -1) : [{ type: 'home' }] })),
  home: () => set({ stack: [{ type: 'home' }] }),
  message: (text) => {
    clearTimeout(toastTimer)
    set({ toast: text })
    toastTimer = setTimeout(() => set({ toast: '' }), 4200)
  },
  celebrate: (text) => set({ celebration: text }),
  addCart: (entityId, variant) =>
    set((s) => {
      const index = s.cart.findIndex((i) => i.entityId === entityId && i.variant === variant)
      return {
        cart:
          index < 0
            ? [...s.cart, { entityId, variant, quantity: 1 }]
            : s.cart.map((i, n) => (n === index ? { ...i, quantity: Math.min(20, i.quantity + 1) } : i)),
      }
    }),
  removeCart: (entityId, variant) =>
    set((s) => ({
      cart: s.cart.flatMap((i) =>
        i.entityId === entityId && i.variant === variant
          ? i.quantity > 1
            ? [{ ...i, quantity: i.quantity - 1 }]
            : []
          : [i],
      ),
    })),
  clearCart: () => set({ cart: [] }),
}))
