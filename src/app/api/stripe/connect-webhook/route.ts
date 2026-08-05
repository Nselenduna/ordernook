import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

// Reliability backstop for `reconcileOrderPayment` (src/lib/orders.ts): the
// order page reconciles on return from Checkout, but if the customer closes
// the tab before landing back, this Connect webhook (events from CONNECTED
// accounts, configured separately from the platform webhook) still flips the
// order. Same guarded update — safe if both fire for the same order.
export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature")
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!sig || !secret) return NextResponse.json({ error: "config" }, { status: 400 })
  const raw = await request.text()
  let event: Stripe.Event
  try { event = getStripe().webhooks.constructEvent(raw, sig, secret) }
  catch { return NextResponse.json({ error: "bad_signature" }, { status: 400 }) }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session
    const orderId = s.metadata?.order_id
    if (orderId && s.payment_status === "paid") {
      const admin = createAdminClient()
      await admin.from("orders")
        .update({ status: "new", stripe_payment_intent_id: (s.payment_intent as string) ?? null })
        .eq("id", orderId).eq("status", "pending_payment") // idempotent guard
    }
  }
  return NextResponse.json({ received: true })
}
