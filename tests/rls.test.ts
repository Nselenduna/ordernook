import { beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.test" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anon)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

// Derive each account's OWN shop via staff_users (RLS scopes it to self).
// NOT via an unfiltered shops query — shops/menu_items are public-read by design
// (anonymous QR menu browsing), so that would return an arbitrary shop.
async function ownShopId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.from("staff_users").select("shop_id").single()
  if (error) throw error
  return (data as { shop_id: string }).shop_id
}

describe("RLS cross-tenant isolation", () => {
  let a: SupabaseClient
  let b: SupabaseClient
  let aShopId: string
  let bShopId: string

  beforeAll(async () => {
    a = await signedIn(process.env.SHOP_A_EMAIL!, process.env.SHOP_A_PASSWORD!)
    b = await signedIn(process.env.SHOP_B_EMAIL!, process.env.SHOP_B_PASSWORD!)
    aShopId = await ownShopId(a)
    bShopId = await ownShopId(b)
  })

  it("each staff resolves to a distinct own shop", () => {
    expect(aShopId).toBeTruthy()
    expect(bShopId).toBeTruthy()
    expect(aShopId).not.toEqual(bShopId)
  })

  it("A CANNOT update B's shop row (write isolation)", async () => {
    const { data: before } = await b.from("shops").select("prep_minutes").eq("id", bShopId).single()
    await a.from("shops").update({ prep_minutes: (before!.prep_minutes ?? 0) + 99 }).eq("id", bShopId)
    const { data: after } = await b.from("shops").select("prep_minutes").eq("id", bShopId).single()
    expect(after!.prep_minutes).toEqual(before!.prep_minutes)
  })

  it("A CANNOT update B's menu items (write isolation)", async () => {
    const { data: item } = await b.from("menu_items").select("id, is_available").eq("shop_id", bShopId).limit(1).single()
    const original = item!.is_available
    await a.from("menu_items").update({ is_available: !original }).eq("id", item!.id)
    const { data: afterItem } = await b.from("menu_items").select("is_available").eq("id", item!.id).single()
    expect(afterItem!.is_available).toEqual(original)
  })

  it("A CANNOT read B's orders (customer PII isolation)", async () => {
    const { data } = await a.from("orders").select("id").eq("shop_id", bShopId)
    expect(data ?? []).toHaveLength(0)
  })

  it("A CAN update its own menu item (policy isn't deny-all)", async () => {
    const { data: item } = await a.from("menu_items").select("id, is_available").eq("shop_id", aShopId).limit(1).single()
    const { error } = await a.from("menu_items").update({ is_available: item!.is_available }).eq("id", item!.id)
    expect(error).toBeNull()
  })

  it("menu items are public-read by design (documents intended model, not a leak)", async () => {
    const { data } = await a.from("menu_items").select("id").eq("shop_id", bShopId)
    expect((data ?? []).length).toBeGreaterThan(0)
  })
})
