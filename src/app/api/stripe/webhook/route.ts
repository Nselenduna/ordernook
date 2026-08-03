import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import type { TablesUpdate } from "@/lib/database.types"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature")
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret)
    return NextResponse.json({ error: "config" }, { status: 400 })

  const raw = await request.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret)
  } catch {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const byCustomer = (customerId: string, fields: TablesUpdate<"shops">) =>
    supabase.from("shops").update(fields).eq("stripe_customer_id", customerId)

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session
      const shopId = s.metadata?.shop_id
      if (shopId) {
        await supabase
          .from("shops")
          .update({
            subscription_status: "active",
            plan_tier: "basic",
            stripe_subscription_id: (s.subscription as string) ?? null,
            stripe_customer_id: (s.customer as string) ?? null,
          })
          .eq("id", shopId)
      }
      break
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      const active = sub.status === "active" || sub.status === "trialing"
      await byCustomer(sub.customer as string, {
        subscription_status:
          sub.status === "past_due" ? "past_due" : active ? "active" : "canceled",
        stripe_subscription_id: sub.id,
        plan_tier: "basic",
      })
      break
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice
      if (inv.customer)
        await byCustomer(inv.customer as string, { subscription_status: "past_due" })
      break
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      await byCustomer(sub.customer as string, { subscription_status: "canceled" })
      break
    }
  }

  return NextResponse.json({ received: true })
}
