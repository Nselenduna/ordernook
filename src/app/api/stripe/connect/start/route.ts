import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getStaffShop } from "@/lib/dashboard"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

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
      } catch (e) {
        // Only auto-heal when the stored id is fundamentally unusable for this
        // key (no such account, or a test account under the live key) — those are
        // StripeInvalidRequestError. Let transient errors (network, rate limit,
        // 5xx) propagate to the outer catch so we never orphan a live, charging
        // account by silently replacing it.
        if (e instanceof Stripe.errors.StripeInvalidRequestError) {
          acct = null
        } else {
          throw e
        }
      }
    }
    if (!acct) {
      // Prefill what we already know so the café types less during Stripe
      // onboarding: their email (from the session), business name, public
      // ordering page as the business URL, and a café/restaurant category.
      // All are editable in Stripe's flow — this just pre-populates.
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const created = await stripe.accounts.create({
        type: "standard",
        country: "GB",
        email: user?.email ?? undefined,
        business_profile: {
          name: shop.name,
          url: `${site()}/${shop.slug}`,
          mcc: "5812", // Eating places & restaurants — sensible café default
        },
      })
      acct = created.id
      // A brand-new account can't charge yet — strip "online" from payment_modes
      // so customers aren't offered online pay before onboarding completes.
      const modes = (shop.payment_modes ?? []).filter((m) => m !== "online")
      const { error: updErr } = await admin
        .from("shops")
        .update({ stripe_account_id: acct, stripe_charges_enabled: false, payment_modes: modes })
        .eq("id", shop.id)
      if (updErr) {
        console.error("connect/start: created account but failed to persist", { acct, shopId: shop.id, updErr })
        throw new Error("persist_account_failed")
      }
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
