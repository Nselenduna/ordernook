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
// Assumes exactly one staff_users row per account (true today); would need
// .limit(1) handling if multi-shop staff is added later.
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

  it("A can read its own orders (precondition — corner-grind has orders)", async () => {
    const { data } = await a.from("orders").select("id").eq("shop_id", aShopId)
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it("B CANNOT read A's orders (customer PII isolation)", async () => {
    const { data } = await b.from("orders").select("id").eq("shop_id", aShopId)
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

  it("A CANNOT insert a menu item into B's shop", async () => {
    const { data: cat } = await b
      .from("menu_categories")
      .select("id")
      .eq("shop_id", bShopId)
      .limit(1)
      .single()
    const { error } = await a.from("menu_items").insert({
      shop_id: bShopId,
      category_id: cat!.id,
      name: "rls-hack",
      price_minor: 1,
      currency: "GBP",
    })
    expect(error).not.toBeNull() // RLS with-check rejects the insert
  })

  it("A CANNOT inject an item into B's menu via B's category_id", async () => {
    const { data: bCat } = await b
      .from("menu_categories")
      .select("id")
      .eq("shop_id", bShopId)
      .limit(1)
      .single()
    // shop_id is A's own (passes is_staff_of) but category belongs to B:
    const { error } = await a.from("menu_items").insert({
      shop_id: aShopId,
      category_id: bCat!.id,
      name: "xtenant",
      price_minor: 1,
      currency: "GBP",
    })
    expect(error).not.toBeNull() // category-ownership check must reject
  })

  it("A CANNOT delete B's menu item", async () => {
    const { data: item } = await b
      .from("menu_items")
      .select("id")
      .eq("shop_id", bShopId)
      .limit(1)
      .single()
    await a.from("menu_items").delete().eq("id", item!.id)
    const { data: still } = await b
      .from("menu_items")
      .select("id")
      .eq("id", item!.id)
      .maybeSingle()
    expect(still).not.toBeNull() // still there → delete was blocked by RLS
  })

  it("A CANNOT create an option group on B's item", async () => {
    const { data: item } = await b
      .from("menu_items")
      .select("id")
      .eq("shop_id", bShopId)
      .limit(1)
      .single()
    const { error } = await a.from("option_groups").insert({
      item_id: item!.id,
      name: "rls-hack",
      type: "single",
      required: false,
      sort_order: 999,
    })
    expect(error).not.toBeNull() // RLS with-check rejects via item→shop join
  })

  it("B CANNOT add an option to A's group", async () => {
    const { data: group } = await a
      .from("option_groups")
      .select("id, menu_items!inner(shop_id)")
      .eq("menu_items.shop_id", aShopId)
      .limit(1)
      .single()
    const { error } = await b.from("options").insert({
      group_id: (group as { id: string }).id,
      name: "rls-hack",
      price_delta_minor: 1,
      sort_order: 999,
    })
    expect(error).not.toBeNull() // RLS with-check rejects via group→item→shop join
  })

  it("B CANNOT delete A's option group", async () => {
    const { data: group } = await a
      .from("option_groups")
      .select("id, menu_items!inner(shop_id)")
      .eq("menu_items.shop_id", aShopId)
      .limit(1)
      .single()
    const gid = (group as { id: string }).id
    await b.from("option_groups").delete().eq("id", gid)
    const { data: still } = await a
      .from("option_groups")
      .select("id")
      .eq("id", gid)
      .maybeSingle()
    expect(still).not.toBeNull() // still there → delete was blocked
  })

  it("A CAN add then remove an option on its own group (policy isn't deny-all)", async () => {
    const { data: group } = await a
      .from("option_groups")
      .select("id, menu_items!inner(shop_id)")
      .eq("menu_items.shop_id", aShopId)
      .limit(1)
      .single()
    const gid = (group as { id: string }).id
    const { data: inserted, error } = await a
      .from("options")
      .insert({ group_id: gid, name: "rls-selftest", price_delta_minor: 0, sort_order: 9999 })
      .select("id")
      .single()
    expect(error).toBeNull()
    if (inserted) await a.from("options").delete().eq("id", (inserted as { id: string }).id) // cleanup
  })
})
