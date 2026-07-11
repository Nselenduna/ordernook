import { create } from "zustand"
import { persist } from "zustand/middleware"

export type CartLine = {
  /** item_id + sorted option ids — identical customisations merge into one line. */
  key: string
  item_id: string
  name: string
  qty: number
  option_ids: string[]
  option_names: string[]
  /** Base price + option deltas, in minor units. Display only — the DB recomputes on order. */
  unit_price_minor: number
}

type CartState = {
  lines: CartLine[]
  add: (line: Omit<CartLine, "key">) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
}

export function lineKey(itemId: string, optionIds: string[]): string {
  return [itemId, ...[...optionIds].sort()].join("|")
}

// Phase 0: one hard-coded shop per deployment, so the storage key can be
// derived from the env slug. Multi-shop support means one store per slug.
const shopSlug = process.env.NEXT_PUBLIC_SHOP_SLUG ?? "shop"

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line) =>
        set((state) => {
          const key = lineKey(line.item_id, line.option_ids)
          const existing = state.lines.find((l) => l.key === key)
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.key === key ? { ...l, qty: l.qty + line.qty } : l
              ),
            }
          }
          return { lines: [...state.lines, { ...line, key }] }
        }),
      setQty: (key, qty) =>
        set((state) => ({
          lines:
            qty <= 0
              ? state.lines.filter((l) => l.key !== key)
              : state.lines.map((l) => (l.key === key ? { ...l, qty } : l)),
        })),
      remove: (key) =>
        set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [] }),
    }),
    { name: `oa-cart-${shopSlug}` }
  )
)

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0)
}

export function cartTotalMinor(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unit_price_minor * l.qty, 0)
}
