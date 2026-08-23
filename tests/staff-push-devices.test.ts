import { afterAll, beforeAll, describe, expect, it } from "vitest"
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

async function ownShopId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.from("staff_users").select("shop_id").single()
  if (error) throw error
  return (data as { shop_id: string }).shop_id
}

// All test endpoints share this prefix so cleanup can target ONLY test rows.
// A blanket delete would wipe real enrolled staff devices on corner-grind —
// these tests run against live Supabase, not a throwaway database.
const TEST_ENDPOINT_PREFIX = "https://push.test/"

function fakeSubscription(endpoint: string) {
  return { endpoint, keys: { p256dh: "test-p256dh", auth: "test-auth" } }
}

describe("staff_push_devices", () => {
  let a: SupabaseClient
  let b: SupabaseClient
  let aShopId: string
  let bShopId: string

  beforeAll(async () => {
    a = await signedIn(process.env.SHOP_A_EMAIL!, process.env.SHOP_A_PASSWORD!)
    b = await signedIn(process.env.SHOP_B_EMAIL!, process.env.SHOP_B_PASSWORD!)
    aShopId = await ownShopId(a)
    bShopId = await ownShopId(b)
    // Scoped to test endpoints only — never touch real enrolled devices.
    await a.from("staff_push_devices").delete().like("endpoint", `${TEST_ENDPOINT_PREFIX}%`)
    await b.from("staff_push_devices").delete().like("endpoint", `${TEST_ENDPOINT_PREFIX}%`)
  })

  it("A can enrol a device for its own shop", async () => {
    const endpoint = `https://push.test/a-${Date.now()}`
    const { error } = await a.rpc("attach_staff_push_device", {
      p_shop_id: aShopId,
      p_subscription: fakeSubscription(endpoint),
      p_label: "Test phone",
    })
    expect(error).toBeNull()
    const { data } = await a.from("staff_push_devices").select("endpoint,label").eq("endpoint", endpoint)
    expect(data).toHaveLength(1)
    expect(data![0].label).toBe("Test phone")
  })

  it("re-enrolling the same endpoint updates rather than duplicates", async () => {
    const endpoint = `https://push.test/a-dup-${Date.now()}`
    const sub = fakeSubscription(endpoint)
    await a.rpc("attach_staff_push_device", { p_shop_id: aShopId, p_subscription: sub, p_label: "First" })
    await a.rpc("attach_staff_push_device", { p_shop_id: aShopId, p_subscription: sub, p_label: "Second" })
    const { data } = await a.from("staff_push_devices").select("label").eq("endpoint", endpoint)
    expect(data).toHaveLength(1)
    expect(data![0].label).toBe("Second")
  })

  it("A CANNOT enrol a device against B's shop", async () => {
    const { error } = await a.rpc("attach_staff_push_device", {
      p_shop_id: bShopId,
      p_subscription: fakeSubscription(`https://push.test/cross-${Date.now()}`),
      p_label: "Intruder",
    })
    expect(error).not.toBeNull()
  })

  it("B CANNOT read A's devices", async () => {
    const endpoint = `https://push.test/a-private-${Date.now()}`
    await a.rpc("attach_staff_push_device", {
      p_shop_id: aShopId,
      p_subscription: fakeSubscription(endpoint),
      p_label: "Private",
    })
    const { data } = await b.from("staff_push_devices").select("id").eq("endpoint", endpoint)
    expect(data ?? []).toHaveLength(0)
  })

  it("rejects a subscription with no endpoint", async () => {
    const { error } = await a.rpc("attach_staff_push_device", {
      p_shop_id: aShopId,
      p_subscription: { keys: { p256dh: "x", auth: "y" } },
      p_label: null,
    })
    expect(error).not.toBeNull()
  })

  // Regression for a hijack: B staffs only shop B. Before the fix, calling the
  // RPC with an endpoint already enrolled to A silently reassigned that row's
  // shop_id/auth_user_id to B — the only gate was is_staff_of(p_shop_id), the
  // TARGET shop, not any check on the shop that already owns the row. That
  // physical device would then start receiving B's order alerts instead of A's.
  it("B CANNOT hijack A's device by re-enrolling A's endpoint under B's shop", async () => {
    const endpoint = `https://push.test/hijack-${Date.now()}`
    await a.rpc("attach_staff_push_device", {
      p_shop_id: aShopId,
      p_subscription: fakeSubscription(endpoint),
      p_label: "A's device",
    })
    const { error } = await b.rpc("attach_staff_push_device", {
      p_shop_id: bShopId,
      p_subscription: fakeSubscription(endpoint),
      p_label: "Hijacked",
    })
    expect(error).not.toBeNull()
    // A's row must be untouched — still owned by A's shop.
    const { data } = await a.from("staff_push_devices").select("shop_id").eq("endpoint", endpoint)
    expect(data).toHaveLength(1)
    expect(data![0].shop_id).toBe(aShopId)
  })

  afterAll(async () => {
    // Leave the production table as clean as we found it — don't let test
    // rows accumulate between runs.
    await a.from("staff_push_devices").delete().like("endpoint", `${TEST_ENDPOINT_PREFIX}%`)
    await b.from("staff_push_devices").delete().like("endpoint", `${TEST_ENDPOINT_PREFIX}%`)
  })
})
