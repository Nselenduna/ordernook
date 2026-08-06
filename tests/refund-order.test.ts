import { describe, expect, it } from "vitest"
import { decideRejectOutcome } from "../src/app/api/stripe/refund-order/route"

describe("decideRejectOutcome", () => {
  it("refunds a paid online order", () => {
    expect(
      decideRejectOutcome({ payment_mode: "online", stripe_payment_intent_id: "pi_123" })
    ).toEqual({ status: "refunded", refund: true })
  })

  it("rejects without refund when online but no payment intent (unpaid)", () => {
    expect(
      decideRejectOutcome({ payment_mode: "online", stripe_payment_intent_id: null })
    ).toEqual({ status: "rejected", refund: false })
  })

  it("rejects without refund for in-store orders", () => {
    expect(
      decideRejectOutcome({ payment_mode: "in_store", stripe_payment_intent_id: null })
    ).toEqual({ status: "rejected", refund: false })
  })
})
