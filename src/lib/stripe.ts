import Stripe from "stripe"

// Lazy: route modules import this at BUILD time, but the secret key is only
// present at RUNTIME. Constructing eagerly would break `next build` without it.
let client: Stripe | null = null

export function getStripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!)
  return client
}
