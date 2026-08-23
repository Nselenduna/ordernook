import { NextResponse } from "next/server"
import webpush, { type PushSubscription } from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildOrderAlert } from "@/lib/order-alert"
import { secretMatches } from "@/lib/notify-auth"

export const runtime = "nodejs"

/**
 * Sends the shop-facing "new order" push. Called by the Postgres trigger
 * `notify_new_order` via pg_net — NOT by a browser.
 *
 * Security model: the caller is the database, so there is no user session to
 * build a client from. Authorisation is a shared secret header compared in
 * constant time; only then do we touch the service-role client.
 */
export async function POST(request: Request) {
  if (!secretMatches(
    request.headers.get("x-ordernook-secret"),
    process.env.NOTIFY_SHARED_SECRET
  )) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 })
  }

  let orderId: string | undefined
  try {
    const body = (await request.json()) as { order_id?: string }
    orderId = body.order_id
  } catch {
    // fall through to the 400 below
  }
  if (!orderId) {
    return NextResponse.json({ error: "missing order_id" }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id, shop_id, order_number, total_minor, currency, payment_mode, shops(name)")
    .eq("id", orderId)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: "order not found" }, { status: 404 })
  }

  const { data: devices } = await supabase
    .from("staff_push_devices")
    .select("id, subscription")
    .eq("shop_id", order.shop_id)

  if (!devices || devices.length === 0) {
    // Nobody enrolled a device — not an error.
    return NextResponse.json({ sent: 0, pruned: 0 })
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const payload = JSON.stringify(
    buildOrderAlert({
      orderNumber: order.order_number,
      totalMinor: order.total_minor,
      currency: order.currency,
      paymentMode: order.payment_mode === "online" ? "online" : "in_store",
    })
  )

  const expired: string[] = []
  const delivered: string[] = []

  // Each device is isolated: one dead subscription must never suppress
  // another device's alert.
  await Promise.all(
    devices.map(async (device) => {
      try {
        await webpush.sendNotification(
          device.subscription as unknown as PushSubscription,
          payload
        )
        delivered.push(device.id)
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          expired.push(device.id)
        }
      }
    })
  )

  if (expired.length > 0) {
    await supabase.from("staff_push_devices").delete().in("id", expired)
  }
  if (delivered.length > 0) {
    await supabase
      .from("staff_push_devices")
      .update({ last_success_at: new Date().toISOString() })
      .in("id", delivered)
  }

  return NextResponse.json({ sent: delivered.length, pruned: expired.length })
}
