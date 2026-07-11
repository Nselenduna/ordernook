/**
 * Anonymous order history, kept in localStorage so a returning customer can
 * find their active order again (and later: "reorder the usual").
 */
export type OrderHistoryEntry = {
  token: string
  shop_slug: string
  placed_at: string
}

const KEY = "oa-order-history"
const MAX_ENTRIES = 20

export function getOrderHistory(): OrderHistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as OrderHistoryEntry[]) : []
  } catch {
    return []
  }
}

export function addOrderToHistory(entry: OrderHistoryEntry): void {
  try {
    const next = [entry, ...getOrderHistory()].slice(0, MAX_ENTRIES)
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage full/blocked — history is a convenience, never block ordering.
  }
}
