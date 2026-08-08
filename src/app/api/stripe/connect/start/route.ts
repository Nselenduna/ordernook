import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

// NEXT_PUBLIC_APP_URL is required to build the onboarding return/refresh URLs —
// fail loud instead of silently falling back to localhost in prod.
function site() {
  const s = process.env.NEXT_PUBLIC_APP_URL
  if (!s) throw new Error("NEXT_PUBLIC_APP_URL not set")
  return s
}

export async function GET() {
  if (!process.env.NEXT_PUBLIC_APP_URL)
    return NextResponse.json({ error: "config" }, { status: 500 })

  const shop = await getStaffShop() // redirects to login if no session
  if (!shop) return NextResponse.redirect(new URL("/dashboard", site()))

  const stripe = getStripe()
  const admin = createAdminClient()

  try {
    // Reuse an existing connected account, but auto-heal a stale/test account
    // (e.g. one connected during test-mode dev) that the live key can't use.
    let acct = shop.stripe_account_id
    if (acct) {
      try {
        await stripe.accounts.retrieve(acct)
      } catch {
        acct = null
      }
    }
    if (!acct) {
      const created = await stripe.accounts.create({ type: "standard", country: "GB" })
      acct = created.id
      await admin
        .from("shops")
        .update({ stripe_account_id: acct, stripe_charges_enabled: false })
        .eq("id", shop.id)
    }

    const link = await stripe.accountLinks.create({
      account: acct,
      type: "account_onboarding",
      refresh_url: `${site()}/api/stripe/connect/start`,
      return_url: `${site()}/api/stripe/connect/callback`,
    })
    return NextResponse.redirect(link.url, { status: 303 })
  } catch {
    return NextResponse.redirect(new URL("/dashboard/settings?connect=error", site()))
  }
}
