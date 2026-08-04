import { beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.test" })
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(url, anon)
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return c
}

// SHOP_A (corner-grind) is given a fake stripe_account_id by the controller before this
// suite and reset after. SHOP_B (pilot-test) has no account.
describe("set_online_payments", () => {
  let withAcct: SupabaseClient
  let noAcct: SupabaseClient
  let noShop: SupabaseClient

  beforeAll(async () => {
    withAcct = await signedIn(process.env.SHOP_A_EMAIL!, process.env.SHOP_A_PASSWORD!)
    noAcct = await signedIn(process.env.SHOP_B_EMAIL!, process.env.SHOP_B_PASSWORD!)
    noShop = await signedIn(process.env.REGISTER_TEST_EMAIL!, process.env.REGISTER_TEST_PASSWORD!)
  })

  it("enable without a connected account is rejected", async () => {
    const { error } = await noAcct.rpc("set_online_payments", { p_enabled: true })
    expect(error?.message ?? "").toContain("no_stripe_account")
  })

  it("enable with an account adds 'online' (keeps 'in_store')", async () => {
    const { data, error } = await withAcct.rpc("set_online_payments", { p_enabled: true })
    expect(error).toBeNull()
    const modes = (data as { payment_modes: string[] }).payment_modes
    expect(modes).toContain("online")
    expect(modes).toContain("in_store")
  })

  it("disable removes 'online' (keeps 'in_store')", async () => {
    const { data, error } = await withAcct.rpc("set_online_payments", { p_enabled: false })
    expect(error).toBeNull()
    const modes = (data as { payment_modes: string[] }).payment_modes
    expect(modes).not.toContain("online")
    expect(modes).toContain("in_store")
  })

  it("anon cannot call (blocked at grant)", async () => {
    const fresh = createClient(url, anon)
    const { error } = await fresh.rpc("set_online_payments", { p_enabled: true })
    expect(error?.message ?? "").toContain("permission denied")
  })

  it("signed-in user with no shop is rejected", async () => {
    const { error } = await noShop.rpc("set_online_payments", { p_enabled: true })
    expect(error?.message ?? "").toContain("no_shop")
  })

  it("direct PATCH of payment_modes is blocked (bypass closed)", async () => {
    const { data: me } = await withAcct.from("staff_users").select("shop_id").single()
    const { error } = await withAcct
      .from("shops")
      .update({ payment_modes: ["in_store", "online"] })
      .eq("id", (me as { shop_id: string }).shop_id)
    expect(error).not.toBeNull()
  })
})
