import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { chargesSyncUpdate } from "@/lib/connect"
import type { PaymentMode } from "@/lib/types"

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
    const patch = chargesSyncUpdate(enabled, shop.payment_modes ?? [])
    // chargesSyncUpdate takes/returns string[] (lib/connect.ts is DB-type-agnostic);
    // narrow back to the shops.payment_modes enum array for the update call.
    await admin
      .from("shops")
      .update({ stripe_charges_enabled: patch.stripe_charges_enabled, payment_modes: patch.payment_modes as PaymentMode[] })
      .eq("id", shop.id)
    return settings(enabled ? "success" : "pending", request)
  } catch {
    return settings("error", request)
  }
}
