import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { getStripe } from "@/lib/stripe"

export const runtime = "nodejs"

export async function POST() {
  const shop = await getStaffShop()
  if (!shop) return NextResponse.json({ error: "no_shop" }, { status: 401 })
  if (!shop.stripe_customer_id)
    return NextResponse.json({ error: "no_customer" }, { status: 400 })

  const site = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const session = await getStripe().billingPortal.sessions.create({
    customer: shop.stripe_customer_id,
    return_url: `${site}/dashboard/settings`,
  })
  return NextResponse.json({ url: session.url })
}
