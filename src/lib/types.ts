import type { Database, Json, Tables } from "@/lib/database.types"

export type OrderStatus = Database["public"]["Enums"]["order_status"]
export type PaymentMode = Database["public"]["Enums"]["payment_mode"]

/** Shape of the shops.branding jsonb (all optional — Latte Glass defaults apply). */
export type Branding = {
  primary?: string
  accent?: string
  background?: string
  tagline?: string
}

// ---- Menu tree as fetched on the shop page (shop → categories → items → groups → options)

export type OptionRow = Tables<"options">
export type OptionGroupWithOptions = Tables<"option_groups"> & {
  options: OptionRow[]
}
export type MenuItemWithGroups = Tables<"menu_items"> & {
  option_groups: OptionGroupWithOptions[]
}
export type CategoryWithItems = Tables<"menu_categories"> & {
  menu_items: MenuItemWithGroups[]
}

/** The subset of shop fields the customer menu UI needs. */
export type ShopSummary = {
  id: string
  name: string
  slug: string
  prep_minutes: number
}

// ---- RPC payloads/results (the RPCs take/return jsonb, so we type them here)

/** One line sent to create_order. Prices are NOT sent — the DB recomputes them. */
export type CreateOrderItem = {
  item_id: string
  qty: number
  option_ids: string[]
}

export type CreateOrderResult = {
  order_id: string
  access_token: string
  order_number: number
  total_minor: number
  currency: string
  prep_minutes: number
}

export type OrderItemSnapshot = {
  name: string
  unit_price_minor: number
  options: { group: string; name: string; price_delta_minor: number }[]
}

/** Shape returned by get_order_by_token. */
export type OrderView = {
  id: string
  status: OrderStatus
  order_number: number
  customer_name: string
  total_minor: number
  currency: string
  payment_mode: PaymentMode
  placed_at: string
  ready_at: string | null
  reject_reason: string | null
  shop: {
    name: string
    slug: string
    prep_minutes: number
    branding: Branding | null
  }
  items: { qty: number; snapshot: OrderItemSnapshot }[]
}

// ---- Dashboard

export type OrderRow = Tables<"orders">
export type OrderItemRow = Tables<"order_items">
export type DashboardOrder = OrderRow & { order_items: OrderItemRow[] }

/** Parse an order_items.item_snapshot jsonb defensively. */
export function parseSnapshot(json: Json): OrderItemSnapshot {
  const raw = (json ?? {}) as Partial<OrderItemSnapshot>
  return {
    name: raw.name ?? "?",
    unit_price_minor: raw.unit_price_minor ?? 0,
    options: Array.isArray(raw.options) ? raw.options : [],
  }
}
