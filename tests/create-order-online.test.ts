import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.test" })
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const guest = () => createClient(url, anon)

// A known corner-grind menu item id is needed for a valid cart. Resolve it at runtime.
let itemId: string

async function firstItem(): Promise<string> {
  const { data: shop } = await admin.from("shops").select("id").eq("slug", "corner-grind").single()
  const { data } = await admin.from("menu_items").select("id")
    .eq("shop_id", (shop as { id: string }).id).eq("is_available", true).limit(1).single()
  return (data as { id: string }).id
}

describe("create_order payment_mode", () => {
  beforeAll(async () => {
    itemId = await firstItem()
    await admin.from("shops").update({ stripe_account_id: "acct_test_connect", payment_modes: ["in_store", "online"] }).eq("slug", "corner-grind")
  })
  afterAll(async () => {
    await admin.from("shops").update({ stripe_account_id: null, payment_modes: ["in_store"] }).eq("slug", "corner-grind")
    await admin.from("orders").delete().eq("customer_name", "PMode Test")
  })

  it("online order is created pending_payment with a token + total", async () => {
    const { data, error } = await guest().rpc("create_order", {
      p_shop_slug: "corner-grind", p_customer_name: "PMode Test", p_customer_phone: null,
      p_items: [{ item_id: itemId, qty: 1, option_ids: [] }], p_payment_mode: "online",
    })
    expect(error).toBeNull()
    const o = data as { order_id: string; token: string; total_minor: number; status?: string }
    expect(o.token).toBeTruthy()
    expect(o.total_minor).toBeGreaterThan(0)
    const { data: row } = await admin.from("orders").select("status, payment_mode").eq("id", o.order_id).single()
    expect((row as { status: string }).status).toBe("pending_payment")
    expect((row as { payment_mode: string }).payment_mode).toBe("online")
  })

  it("in_store order is created new (unchanged)", async () => {
    const { data, error } = await guest().rpc("create_order", {
      p_shop_slug: "corner-grind", p_customer_name: "PMode Test", p_customer_phone: null,
      p_items: [{ item_id: itemId, qty: 1, option_ids: [] }], p_payment_mode: "in_store",
    })
    expect(error).toBeNull()
    const { data: row } = await admin.from("orders").select("status").eq("id", (data as { order_id: string }).order_id).single()
    expect((row as { status: string }).status).toBe("new")
  })

  it("online rejected when shop has no online mode", async () => {
    await admin.from("shops").update({ payment_modes: ["in_store"] }).eq("slug", "corner-grind")
    const { error } = await guest().rpc("create_order", {
      p_shop_slug: "corner-grind", p_customer_name: "PMode Test", p_customer_phone: null,
      p_items: [{ item_id: itemId, qty: 1, option_ids: [] }], p_payment_mode: "online",
    })
    expect(error?.message ?? "").toContain("payment_mode_unavailable")
    await admin.from("shops").update({ payment_modes: ["in_store", "online"] }).eq("slug", "corner-grind")
  })

  it("online rejected when shop has no connected account", async () => {
    await admin.from("shops").update({ stripe_account_id: null }).eq("slug", "corner-grind")
    const { error } = await guest().rpc("create_order", {
      p_shop_slug: "corner-grind", p_customer_name: "PMode Test", p_customer_phone: null,
      p_items: [{ item_id: itemId, qty: 1, option_ids: [] }], p_payment_mode: "online",
    })
    expect(error?.message ?? "").toContain("online_not_configured")
    await admin.from("shops").update({ stripe_account_id: "acct_test_connect" }).eq("slug", "corner-grind")
  })
})
