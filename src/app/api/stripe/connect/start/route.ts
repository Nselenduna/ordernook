import { NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { getStaffShop } from "@/lib/dashboard"

export const runtime = "nodejs"

export async function GET() {
  // NEXT_PUBLIC_APP_URL is required to build a correct Stripe redirect_uri (and for
  // the plain redirects below) — fail loud instead of silently falling back to
  // localhost, which would build a bad redirect_uri in prod.
  if (!process.env.NEXT_PUBLIC_APP_URL)
    return NextResponse.json({ error: "config" }, { status: 500 })

  const shop = await getStaffShop() // redirects to login if no session
  if (!shop) return NextResponse.redirect(new URL("/dashboard", site()))

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
  if (!clientId)
    return NextResponse.redirect(new URL("/dashboard/settings?connect=error", site()))

  const state = randomBytes(16).toString("hex")

  const url = new URL("https://connect.stripe.com/oauth/authorize")
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("scope", "read_write")
  url.searchParams.set("state", state)
  url.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/connect/callback`)

  const res = NextResponse.redirect(url)
  res.cookies.set("onbd_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
  })
  return res
}

function site() {
  return process.env.NEXT_PUBLIC_APP_URL
}
