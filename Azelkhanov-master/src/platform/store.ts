import { create } from 'zustand'
import type { AppConfig, Data, PlatformApi, Snapshot } from './contracts.ts'
import { incomingGift } from './gift-links.ts'
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
let toastTimer: ReturnType<typeof setTimeout>
export const usePlatform = create<PlatformStore>((set, get) => ({
  snapshot: null,
  api: null,
  loading: true,
  error: '',
  busy: false,
  stack: [{ type: 'home' }],
  toast: '',
  celebration: '',
  cart: [],
  boot: async (config, base) => {
    set({ loading: true, error: '' })
    try {
      const api = await createApi(config, base)
      const snapshot = await api.bootstrap()
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
      set({ error: e instanceof Error ? e.message : 'Не удалось открыть приложение', loading: false })
    }
  },
  act: async (action, payload = {}) => {
    if (get().busy) return
    set({ busy: true })
    try {
      const before = get().snapshot!.me
      const result = await get().api!.dispatch(action, payload)
      set({ snapshot: result.snapshot })
      haptic('success')
      return {
        ...result.result,
        gainedXp: (result.snapshot.me.platformXp ?? result.snapshot.me.xp) - (before.platformXp ?? before.xp),
        gainedPoints: result.snapshot.me.points - before.points,
      }
    } catch (e) {
      get().message(e instanceof Error ? e.message : 'Не удалось выполнить действие')
      return undefined
    } finally {
      set({ busy: false })
    }
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
