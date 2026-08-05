import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getStaffShop } from "@/lib/dashboard"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

// Internal redirects use request.url as the base (not NEXT_PUBLIC_APP_URL) so this
// route has no dependency on that env var — only the outbound OAuth flow in
// start/route.ts needs the canonical app URL.
const settings = (q: string, request: Request) => {
  const res = NextResponse.redirect(new URL(`/dashboard/settings?connect=${q}`, request.url))
  res.cookies.delete("onbd_state") // clear on the response we actually return
  return res
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  if (params.get("error")) return settings("cancelled", request) // user declined on Stripe

  const code = params.get("code")
  const state = params.get("state")
  const jar = await cookies()
  const cookieState = jar.get("onbd_state")?.value
  if (!code || !state || !cookieState || state !== cookieState) return settings("error", request)

  const shop = await getStaffShop()
  if (!shop) {
    const res = NextResponse.redirect(new URL("/dashboard", request.url))
    res.cookies.delete("onbd_state")
    return res
  }

  try {
    const token = await getStripe().oauth.token({
      grant_type: "authorization_code",
      code,
    })
    const acct = token.stripe_user_id
    if (!acct) return settings("error", request)
    const admin = createAdminClient()
    await admin.from("shops").update({ stripe_account_id: acct }).eq("id", shop.id)
  } catch {
    return settings("error", request)
  }
  return settings("success", request)
}
