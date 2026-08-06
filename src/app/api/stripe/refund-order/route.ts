import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

/**
 * Pure decision: does rejecting this order require a Stripe refund?
 * Only paid-online orders (payment_mode "online" with a captured payment
 * intent) get refunded; in-store or unpaid orders just flip to "rejected".
 * Extracted so it's testable without a staff session/cookie or Stripe.
 */
export function decideRejectOutcome(o: {
  payment_mode: string
  stripe_payment_intent_id: string | null
}): { status: "refunded" | "rejected"; refund: boolean } {
  const refund = o.payment_mode === "online" && !!o.stripe_payment_intent_id
  return { status: refund ? "refunded" : "rejected", refund }
}

export async function POST(request: Request) {
  const shop = await getStaffShop()
  if (!shop) return NextResponse.json({ error: "no_shop" }, { status: 401 })

  const { order_id, reason } = await request.json().catch(() => ({}))
  if (!order_id) return NextResponse.json({ error: "bad_request" }, { status: 400 })

  const admin = createAdminClient()
  const { data: order } = await admin
    .from("orders")
    .select("id, shop_id, status, payment_mode, stripe_payment_intent_id")
    .eq("id", order_id)
    .maybeSingle()
  if (!order || order.shop_id !== shop.id)
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  if (["refunded", "rejected", "collected"].includes(order.status))
    return NextResponse.json({ status: order.status }) // already final; idempotent

  const { status: nextStatus, refund } = decideRejectOutcome(order)
  if (refund) {
    if (!shop.stripe_account_id)
      return NextResponse.json({ error: "no_account" }, { status: 409 })
    try {
      await getStripe().refunds.create(
        { payment_intent: order.stripe_payment_intent_id as string },
        { stripeAccount: shop.stripe_account_id } // refund on the shop's connected account, never platform
      )
    } catch (e) {
      console.error("refund-order refund failed", { orderId: order.id, e })
      return NextResponse.json({ error: "refund_failed" }, { status: 502 })
    }
  }

  const { error } = await admin
    .from("orders")
    .update({ status: nextStatus, reject_reason: reason ?? null })
    .eq("id", order.id)
    .in("status", ["new", "accepted", "preparing", "ready", "pending_payment"]) // guard against races
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 })
  return NextResponse.json({ status: nextStatus })
}
