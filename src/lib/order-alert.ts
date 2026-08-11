import { t } from "@/lib/i18n"
import { formatMinor } from "@/lib/money"

export type OrderAlertInput = {
  orderNumber: number
  totalMinor: number
  currency: string
  paymentMode: "online" | "in_store"
}

export type OrderAlertPayload = {
  title: string
  body: string
  url: string
}

/**
 * Builds the shop-facing "new order" push payload. Pure — no DB, no browser —
 * so the copy and money formatting are unit-testable on their own.
 *
 * The body distinguishes paid-online from pay-on-collection because that is
 * the whole point of the alert: it tells staff whether money has already
 * changed hands before they start making the order.
 */
export function buildOrderAlert(input: OrderAlertInput): OrderAlertPayload {
  return {
    title: t("push.newOrderTitle", {
      number: input.orderNumber,
      total: formatMinor(input.totalMinor, input.currency),
    }),
    body:
      input.paymentMode === "online"
        ? t("push.newOrderPaid")
        : t("push.newOrderUnpaid"),
    url: "/dashboard",
  }
}
