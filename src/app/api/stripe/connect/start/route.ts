import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { randomBytes } from "node:crypto"
import { getStaffShop } from "@/lib/dashboard"

export const runtime = "nodejs"

export async function GET() {
  const shop = await getStaffShop() // redirects to login if no session
  if (!shop) return NextResponse.redirect(new URL("/dashboard", site()))

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
  if (!clientId)
    return NextResponse.redirect(new URL("/dashboard/settings?connect=error", site()))

  const state = randomBytes(16).toString("hex")
  const jar = await cookies()
  jar.set("onbd_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
  })

  const url = new URL("https://connect.stripe.com/oauth/authorize")
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("scope", "read_write")
  url.searchParams.set("state", state)
  url.searchParams.set("redirect_uri", `${site()}/api/stripe/connect/callback`)
  return NextResponse.redirect(url)
}

function site() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}
