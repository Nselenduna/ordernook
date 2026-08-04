import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Reconcile a shop's subscription state directly from Stripe after the customer
 * returns from Checkout. This makes the money-critical "I just paid, unlock me"
 * moment reliable WITHOUT depending on the webhook (which can lag, fail, or be
 * mis-subscribed). The webhook still handles async lifecycle events.
 * Best-effort: any failure is swallowed so the page still renders.
 */
export async function reconcileFromCheckoutSession(sessionId: string): Promise<void> {
  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const shopId = session.metadata?.shop_id
    if (!shopId || !session.subscription) return

    const sub = await stripe.subscriptions.retrieve(session.subscription as string)
    const active = sub.status === "active" || sub.status === "trialing"

    const admin = createAdminClient()
    await admin
      .from("shops")
      .update({
        subscription_status:
          sub.status === "past_due" ? "past_due" : active ? "active" : "canceled",
        stripe_subscription_id: sub.id,
        stripe_customer_id: sub.customer as string,
        plan_tier: "basic",
      })
      .eq("id", shopId)
  } catch {
    // Swallow: the webhook or a later load can still reconcile.
  }
}
