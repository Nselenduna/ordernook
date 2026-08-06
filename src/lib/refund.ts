/**
 * Pure decision: does rejecting this order require a Stripe refund?
 * Only paid-online orders (payment_mode "online" with a captured payment
 * intent) get refunded; in-store or unpaid orders just flip to "rejected".
 * Kept in its own module with no server-only imports so it's importable
 * from vitest (node env, no `@/` alias resolution) without pulling in
 * `@/lib/dashboard` etc. via the route file.
 */
export function decideRejectOutcome(o: {
  payment_mode: string
  stripe_payment_intent_id: string | null
}): { status: "refunded" | "rejected"; refund: boolean } {
  const refund = o.payment_mode === "online" && !!o.stripe_payment_intent_id
  return { status: refund ? "refunded" : "rejected", refund }
}
