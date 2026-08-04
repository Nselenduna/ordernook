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

// Every case here raises BEFORE any insert, so no rows are written and the
// no-shop account stays shopless — the suite is repeatable.
describe("register_shop RPC guards", () => {
  let noShop: SupabaseClient // account with NO staff_users row
  let hasShop: SupabaseClient // corner-grind owner (already has a shop)

  beforeAll(async () => {
    noShop = await signedIn(process.env.REGISTER_TEST_EMAIL!, process.env.REGISTER_TEST_PASSWORD!)
    hasShop = await signedIn(process.env.SHOP_A_EMAIL!, process.env.SHOP_A_PASSWORD!)
  })

  it("anon cannot register", async () => {
    const anonClient = createClient(url, anon)
    const { error } = await anonClient.rpc("register_shop", { p_name: "X", p_slug: "some-cafe" })
    expect(error).not.toBeNull()
    expect(error?.message ?? "").toContain("permission denied")
  })

  it("rejects a reserved slug and writes nothing", async () => {
    const { error } = await noShop.rpc("register_shop", { p_name: "Test Cafe", p_slug: "dashboard" })
    expect(error?.message ?? "").toContain("slug_reserved")
    const { data } = await noShop.from("staff_users").select("id")
    expect(data ?? []).toHaveLength(0)
  })

  it("rejects an invalid (too short) slug", async () => {
    const { error } = await noShop.rpc("register_shop", { p_name: "Test Cafe", p_slug: "ab" })
    expect(error?.message ?? "").toContain("slug_invalid")
  })

  it("rejects an empty name", async () => {
    const { error } = await noShop.rpc("register_shop", { p_name: "  ", p_slug: "valid-slug" })
    expect(error?.message ?? "").toContain("name_invalid")
  })

  it("rejects a second shop for an already-registered owner", async () => {
    const { error } = await hasShop.rpc("register_shop", { p_name: "Another", p_slug: "another-cafe" })
    expect(error?.message ?? "").toContain("already_registered")
  })
})
