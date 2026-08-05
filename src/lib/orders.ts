import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

type ReconcilableOrder = {
  id: string
  status: string
  shop_stripe_account_id: string | null
}

/**
 * Reconcile a `pending_payment` online order straight from Stripe when the
 * customer returns from Checkout — don't make them wait on the connect
 * webhook (which can lag or fail). The webhook (`/api/stripe/connect-webhook`)
 * runs the same guarded update as a backstop.
 *
 * Idempotent: the `.eq("status", "pending_payment")` guard means whichever of
 * this reconcile call or the webhook lands second is a no-op, so it's safe
 * for both to fire for the same order.
 *
 * Best-effort: any failure (bad session id, Stripe API error, etc.) is
 * swallowed so the order status page still renders — the webhook can still
 * reconcile the order later.
 */
export async function reconcileOrderPayment(
  order: ReconcilableOrder,
  sessionId: string
): Promise<void> {
  if (order.status !== "pending_payment" || !order.shop_stripe_account_id) return

  try {
    // Checkout Sessions for direct charges live on the connected account, not
    // the platform account — `stripeAccount` is a request option (3rd arg),
    // not a session param.
    const session = await getStripe().checkout.sessions.retrieve(
      sessionId,
      {},
      { stripeAccount: order.shop_stripe_account_id }
    )
    if (session.payment_status !== "paid") return

    const admin = createAdminClient()
    await admin
      .from("orders")
      .update({
        status: "new",
        stripe_payment_intent_id: (session.payment_intent as string) ?? null,
      })
      .eq("id", order.id)
      .eq("status", "pending_payment") // idempotent guard vs. the connect webhook
  } catch {
    // Swallow: the connect webhook is the reliability backstop for this order.
  }
}
