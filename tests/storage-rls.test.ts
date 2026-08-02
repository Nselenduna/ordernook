import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.test" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
) // 1x1 png

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anon)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}
async function ownShopId(c: SupabaseClient): Promise<string> {
  const { data } = await c.from("staff_users").select("shop_id").single()
  return (data as { shop_id: string }).shop_id
}

describe("Storage RLS: shop-logos", () => {
  let a: SupabaseClient
  let b: SupabaseClient
  let aShop: string
  let bShop: string

  beforeAll(async () => {
    a = await signedIn(process.env.SHOP_A_EMAIL!, process.env.SHOP_A_PASSWORD!)
    b = await signedIn(process.env.SHOP_B_EMAIL!, process.env.SHOP_B_PASSWORD!)
    aShop = await ownShopId(a)
    bShop = await ownShopId(b)
  })

  afterAll(async () => {
    await a.storage.from("shop-logos").remove([`${aShop}/test.png`])
  })

  it("A can upload under its own shop folder", async () => {
    const { error } = await a.storage
      .from("shop-logos")
      .upload(`${aShop}/test.png`, PNG, { contentType: "image/png", upsert: true })
    expect(error).toBeNull()
  })

  it("A CANNOT upload under B's shop folder", async () => {
    const { error } = await a.storage
      .from("shop-logos")
      .upload(`${bShop}/hack.png`, PNG, { contentType: "image/png", upsert: true })
    expect(error).not.toBeNull()
  })

  it("logos are publicly readable (anon)", async () => {
    const anonClient = createClient(url, anon)
    const { data } = anonClient.storage
      .from("shop-logos")
      .getPublicUrl(`${aShop}/test.png`)
    const res = await fetch(data.publicUrl)
    expect(res.status).toBe(200)
  })
})

describe("Storage RLS: menu-photos", () => {
  let a: SupabaseClient
  let b: SupabaseClient
  let aShop: string
  let bShop: string

  beforeAll(async () => {
    a = await signedIn(process.env.SHOP_A_EMAIL!, process.env.SHOP_A_PASSWORD!)
    b = await signedIn(process.env.SHOP_B_EMAIL!, process.env.SHOP_B_PASSWORD!)
    aShop = await ownShopId(a)
    bShop = await ownShopId(b)
  })

  afterAll(async () => {
    await a.storage.from("menu-photos").remove([`${aShop}/rls-test.webp`])
  })

  it("A can upload under its own shop folder", async () => {
    const { error } = await a.storage
      .from("menu-photos")
      .upload(`${aShop}/rls-test.webp`, PNG, {
        contentType: "image/webp",
        upsert: true,
      })
    expect(error).toBeNull()
  })

  it("A CANNOT upload under B's shop folder", async () => {
    const { error } = await a.storage
      .from("menu-photos")
      .upload(`${bShop}/hack.webp`, PNG, {
        contentType: "image/webp",
        upsert: true,
      })
    expect(error).not.toBeNull()
  })
})
