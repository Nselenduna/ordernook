import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getStaffShop } from "@/lib/dashboard"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

function site() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}
const settings = (q: string) =>
  NextResponse.redirect(new URL(`/dashboard/settings?connect=${q}`, site()))

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  if (params.get("error")) return settings("cancelled") // user declined on Stripe

  const code = params.get("code")
  const state = params.get("state")
  const jar = await cookies()
  const cookieState = jar.get("onbd_state")?.value
  jar.delete("onbd_state")
  if (!code || !state || !cookieState || state !== cookieState) return settings("error")

  const shop = await getStaffShop()
  if (!shop) return NextResponse.redirect(new URL("/dashboard", site()))

  try {
    const token = await getStripe().oauth.token({
      grant_type: "authorization_code",
      code,
    })
    const acct = token.stripe_user_id
    if (!acct) return settings("error")
    const admin = createAdminClient()
    await admin.from("shops").update({ stripe_account_id: acct }).eq("id", shop.id)
  } catch {
    return settings("error")
  }
  return settings("success")
}
