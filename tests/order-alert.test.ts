import { describe, expect, it } from "vitest"
import { buildOrderAlert } from "../src/lib/order-alert"

describe("buildOrderAlert", () => {
  it("titles with order number and formatted total", () => {
    const { title } = buildOrderAlert({
      orderNumber: 12, totalMinor: 850, currency: "GBP", paymentMode: "online",
    })
    expect(title).toBe("New order #12 — £8.50")
  })

  it("says paid online for an online order", () => {
    const { body } = buildOrderAlert({
      orderNumber: 1, totalMinor: 100, currency: "GBP", paymentMode: "online",
    })
    expect(body).toBe("Paid online")
  })

  it("says pay on collection for an in-store order", () => {
    const { body } = buildOrderAlert({
      orderNumber: 1, totalMinor: 100, currency: "GBP", paymentMode: "in_store",
    })
    expect(body).toBe("Pay on collection")
  })

  it("always deep-links to the dashboard queue", () => {
    expect(buildOrderAlert({
      orderNumber: 3, totalMinor: 0, currency: "GBP", paymentMode: "in_store",
    }).url).toBe("/dashboard")
  })

  it("handles a zero total", () => {
    expect(buildOrderAlert({
      orderNumber: 4, totalMinor: 0, currency: "GBP", paymentMode: "in_store",
    }).title).toBe("New order #4 — £0.00")
  })
})
