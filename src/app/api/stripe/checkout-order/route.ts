import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

// Stripe's own per-currency minimum charge amounts (approximate, minor units).
// Guard is currency-aware since a flat 30p minimum is meaningless for e.g. USD/EUR.
const MIN_CHARGE: Record<string, number> = { gbp: 30, usd: 50, eur: 50 }

function site() {
  const s = process.env.NEXT_PUBLIC_APP_URL
  if (!s) throw new Error("NEXT_PUBLIC_APP_URL not set")
  return s
}

export async function POST(request: Request) {
  const { order_id, token } = await request.json().catch(() => ({}))
  if (!order_id || !token) return NextResponse.json({ error: "bad_request" }, { status: 400 })

  const admin = createAdminClient()
  const { data: order } = await admin
    .from("orders")
    .select("id, access_token, status, payment_mode, total_minor, currency, shop_id, shops(slug, stripe_account_id, name)")
    .eq("id", order_id)
    .maybeSingle()

  // `access_token` (uuid) is the order's secret; the URL /order/[token] uses it. token param must match.
  if (!order || String(order.access_token) !== String(token))
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  if (order.status !== "pending_payment" || order.payment_mode !== "online")
    return NextResponse.json({ error: "not_payable" }, { status: 409 })

  const shop = order.shops as { slug: string; stripe_account_id: string | null; name: string }
  if (!shop.stripe_account_id) return NextResponse.json({ error: "no_account" }, { status: 409 })
  const currency = (order.currency ?? "gbp").toLowerCase()
  const minCharge = MIN_CHARGE[currency] ?? 50
  if ((order.total_minor ?? 0) < minCharge) return NextResponse.json({ error: "amount_too_low" }, { status: 409 })

  const stripe = getStripe()
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{
          quantity: 1,
          price_data: {
            currency,
            unit_amount: order.total_minor,
            product_data: { name: `${shop.name} order` },
          },
        }],
        metadata: { order_id: order.id },
        payment_intent_data: { metadata: { order_id: order.id } },
        success_url: `${site()}/order/${token}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${site()}/${shop.slug}`,
      },
      { stripeAccount: shop.stripe_account_id } // direct charge on the connected account, zero commission
    )
    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error("checkout-order session.create failed", e)
    return NextResponse.json({ error: "stripe_error" }, { status: 502 })
  }
}
