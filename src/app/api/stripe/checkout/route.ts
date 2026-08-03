import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe"

export const runtime = "nodejs"

export async function POST() {
  const shop = await getStaffShop()
  if (!shop) return NextResponse.json({ error: "no_shop" }, { status: 401 })

  const price = process.env.STRIPE_BASIC_PRICE_ID
  if (!price) return NextResponse.json({ error: "no_price" }, { status: 500 })

  const site = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const stripe = getStripe()

  // Ensure the shop has a Stripe customer.
  let customerId = shop.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: shop.name,
      metadata: { shop_id: shop.id, shop_slug: shop.slug },
    })
    customerId = customer.id
    const supabase = await createClient()
    await supabase
      .from("shops")
      .update({ stripe_customer_id: customerId })
      .eq("id", shop.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${site}/dashboard/settings?subscribed=1`,
    cancel_url: `${site}/dashboard/settings`,
    metadata: { shop_id: shop.id },
    subscription_data: { metadata: { shop_id: shop.id } },
  })

  return NextResponse.json({ url: session.url })
}
