import { afterAll, beforeAll, describe, expect, it } from "vitest"
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

// SHOP_A (corner-grind) needs a stripe_account_id for the success-path tests below.
// The suite provisions it itself with the service-role client (bypasses RLS + the
// billing trigger, since normal clients can't set the protected stripe_account_id
// column) and resets it in afterAll so no fake account is left on a real shop.
// SHOP_B (pilot-test) has no account.
describe("set_online_payments", () => {
  let withAcct: SupabaseClient
  let noAcct: SupabaseClient
  let noShop: SupabaseClient
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  beforeAll(async () => {
    withAcct = await signedIn(process.env.SHOP_A_EMAIL!, process.env.SHOP_A_PASSWORD!)
    noAcct = await signedIn(process.env.SHOP_B_EMAIL!, process.env.SHOP_B_PASSWORD!)
    noShop = await signedIn(process.env.REGISTER_TEST_EMAIL!, process.env.REGISTER_TEST_PASSWORD!)
    await admin
      .from("shops")
      .update({
        stripe_account_id: "acct_test_connect",
        stripe_charges_enabled: true,
        payment_modes: ["in_store"],
      })
      .eq("slug", "corner-grind")
  })

  afterAll(async () => {
    await admin
      .from("shops")
      .update({
        stripe_account_id: null,
        stripe_charges_enabled: false,
        payment_modes: ["in_store"],
      })
      .eq("slug", "corner-grind")
  })

  it("enable without a connected account is rejected", async () => {
    const { error } = await noAcct.rpc("set_online_payments", { p_enabled: true })
    expect(error?.message ?? "").toContain("no_stripe_account")
  })

  it("enable with an account but charges not enabled is rejected", async () => {
    await admin.from("shops").update({ stripe_charges_enabled: false }).eq("slug", "corner-grind")
    const { error } = await withAcct.rpc("set_online_payments", { p_enabled: true })
    expect(error?.message ?? "").toContain("charges_not_enabled")
    await admin.from("shops").update({ stripe_charges_enabled: true }).eq("slug", "corner-grind")
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

  it("direct PATCH enabling online without an account is blocked", async () => {
    const { data: me } = await noAcct.from("staff_users").select("shop_id").single()
    const { error } = await noAcct
      .from("shops")
      .update({ payment_modes: ["in_store", "online"] })
      .eq("id", (me as { shop_id: string }).shop_id)
    expect(error?.message ?? "").toContain("online_requires_account")
  })
})
