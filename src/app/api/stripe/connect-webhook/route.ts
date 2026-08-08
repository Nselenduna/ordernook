import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { chargesSyncUpdate } from "@/lib/connect"
import type { PaymentMode } from "@/lib/types"

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
      // Standard Connect: each shop has its own Stripe account, so a
      // malicious shop could pay a trivial amount on THEIR account with
      // another shop's order_id in metadata to flip that order to paid.
      // Confirm the order actually belongs to the account that emitted
      // this event before writing anything.
      const { data: ord } = await admin
        .from("orders")
        .select("id, total_minor, shops(stripe_account_id)")
        .eq("id", orderId)
        .maybeSingle()
      const acct = (ord?.shops as { stripe_account_id: string | null } | null)
        ?.stripe_account_id
      if (!ord || acct !== event.account) {
        // Either the order doesn't exist, or the event came from a Stripe
        // account that doesn't own this order (see comment above) — a paid
        // Checkout session with nowhere to land. Log so it's not silently lost.
        console.error("connect-webhook account mismatch or order not found", { orderId, eventAccount: event.account })
        return NextResponse.json({ received: true }) // ignore mismatched/unknown
      }
      // Belt-and-braces: the paid amount should exactly match what the order
      // was created for. A mismatch means something's wrong upstream — don't
      // flip the order to paid, just log for investigation.
      if (s.amount_total != null && s.amount_total !== ord.total_minor) {
        console.error("connect-webhook amount mismatch", { orderId, sessionAmount: s.amount_total, orderTotal: ord.total_minor })
        return NextResponse.json({ received: true })
      }

      await admin.from("orders")
        .update({ status: "new", stripe_payment_intent_id: (s.payment_intent as string) ?? null })
        .eq("id", orderId).eq("status", "pending_payment") // idempotent guard
    }
  }

  if (event.type === "account.updated") {
    const acct = event.data.object as Stripe.Account
    if (acct.id !== event.account) return NextResponse.json({ received: true })
    const admin = createAdminClient()
    const { data: shop } = await admin
      .from("shops")
      .select("id, payment_modes")
      .eq("stripe_account_id", acct.id)
      .maybeSingle()
    if (shop) {
      const patch = chargesSyncUpdate(acct.charges_enabled === true, shop.payment_modes ?? [])
      // chargesSyncUpdate takes/returns string[] (lib/connect.ts is DB-type-agnostic);
      // narrow back to the shops.payment_modes enum array for the update call.
      await admin
        .from("shops")
        .update({ ...patch, payment_modes: patch.payment_modes as PaymentMode[] })
        .eq("id", shop.id)
    }
  }
  return NextResponse.json({ received: true })
}
