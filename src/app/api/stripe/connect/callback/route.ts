import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

// Return target from Stripe hosted onboarding. We re-read the account to learn
// whether it can charge yet — the café may return before completing onboarding.
const settings = (q: string, request: Request) =>
  NextResponse.redirect(new URL(`/dashboard/settings?connect=${q}`, request.url))

export async function GET(request: Request) {
  const shop = await getStaffShop()
  if (!shop) return NextResponse.redirect(new URL("/dashboard", request.url))
  if (!shop.stripe_account_id) return settings("error", request)

  try {
    const acct = await getStripe().accounts.retrieve(shop.stripe_account_id)
    const enabled = acct.charges_enabled === true
    const admin = createAdminClient()
    await admin.from("shops").update({ stripe_charges_enabled: enabled }).eq("id", shop.id)
    return settings(enabled ? "success" : "pending", request)
  } catch {
    return settings("error", request)
  }
}
