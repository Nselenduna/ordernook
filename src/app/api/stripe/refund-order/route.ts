import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { decideRejectOutcome } from "@/lib/refund"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

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
        {
          stripeAccount: shop.stripe_account_id, // refund on the shop's connected account, never platform
          // Idempotency key scoped per connected account by Stripe: a
          // duplicate/concurrent request for the same order (e.g. a staff
          // double-click) returns the SAME refund instead of refunding twice.
          idempotencyKey: `refund-${order.id}`,
        }
      )
    } catch (e) {
      console.error("refund-order refund failed", { orderId: order.id, e })
      return NextResponse.json({ error: "refund_failed" }, { status: 502 })
    }
  }

  const { data: updated, error } = await admin
    .from("orders")
    .update({ status: nextStatus, reject_reason: reason ?? null })
    .eq("id", order.id)
    .in("status", ["new", "accepted", "preparing", "ready", "pending_payment"]) // guard against races
    .select("id")
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 })
  if (!updated || updated.length === 0) {
    // A concurrent request already flipped the status (e.g. a double-click
    // that raced past the early idempotent-check above). Don't claim
    // nextStatus was written when it wasn't — report what's actually there.
    const { data: cur } = await admin
      .from("orders")
      .select("status")
      .eq("id", order.id)
      .maybeSingle()
    return NextResponse.json({ status: (cur as { status: string } | null)?.status ?? nextStatus })
  }
  return NextResponse.json({ status: nextStatus })
}
