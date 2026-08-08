import { describe, expect, it } from "vitest"
import { deriveConnectState, chargesSyncUpdate } from "../src/lib/connect"

describe("deriveConnectState", () => {
  it("none when no account", () => {
    expect(deriveConnectState({ stripe_account_id: null, stripe_charges_enabled: false })).toBe("none")
  })
  it("pending when account exists but charges not enabled", () => {
    expect(deriveConnectState({ stripe_account_id: "acct_1", stripe_charges_enabled: false })).toBe("pending")
  })
  it("ready when account exists and charges enabled", () => {
    expect(deriveConnectState({ stripe_account_id: "acct_1", stripe_charges_enabled: true })).toBe("ready")
  })
})

describe("chargesSyncUpdate", () => {
  it("keeps payment_modes when charges enabled", () => {
    expect(chargesSyncUpdate(true, ["in_store", "online"])).toEqual({
      stripe_charges_enabled: true,
      payment_modes: ["in_store", "online"],
    })
  })
  it("removes 'online' when charges disabled", () => {
    expect(chargesSyncUpdate(false, ["in_store", "online"])).toEqual({
      stripe_charges_enabled: false,
      payment_modes: ["in_store"],
    })
  })
})
