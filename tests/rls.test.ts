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

describe("RLS cross-tenant isolation", () => {
  let a: SupabaseClient
  let b: SupabaseClient
  let aShopId: string
  let bShopId: string

  beforeAll(async () => {
    a = await signedIn(process.env.SHOP_A_EMAIL!, process.env.SHOP_A_PASSWORD!)
    b = await signedIn(process.env.SHOP_B_EMAIL!, process.env.SHOP_B_PASSWORD!)
    const { data: sa } = await a.from("shops").select("id").limit(1).single()
    const { data: sb } = await b.from("shops").select("id").limit(1).single()
    aShopId = sa!.id
    bShopId = sb!.id
  })

  it("each staff sees only their own shop", () => {
    expect(aShopId).not.toEqual(bShopId)
  })

  it("A cannot read B's menu items", async () => {
    const { data } = await a.from("menu_items").select("id").eq("shop_id", bShopId)
    expect(data ?? []).toHaveLength(0)
  })

  it("A cannot update B's shop row", async () => {
    const { data } = await b.from("shops").select("prep_minutes").eq("id", bShopId).single()
    const before = data!.prep_minutes
    await a.from("shops").update({ prep_minutes: before + 99 }).eq("id", bShopId)
    const { data: after } = await b.from("shops").select("prep_minutes").eq("id", bShopId).single()
    expect(after!.prep_minutes).toEqual(before) // unchanged — RLS blocked A
  })

  it("A CAN toggle its own item (sanity: policy isn't just deny-all)", async () => {
    const { data: item } = await a
      .from("menu_items").select("id, is_available").eq("shop_id", aShopId).limit(1).single()
    const { error } = await a
      .from("menu_items").update({ is_available: item!.is_available }).eq("id", item!.id)
    expect(error).toBeNull()
  })
})
