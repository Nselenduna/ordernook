import { NextResponse } from "next/server";
import webpush, { type PushSubscription } from "web-push";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

/**
 * Sends the "your order is ready" web push. Called by the dashboard after a
 * staff member marks an order ready.
 *
 * Security model: there is NO service-role key in this app. The Supabase
 * client is built from the caller's session cookies, so RLS only lets staff
 * of the order's shop read/update the row — an anonymous or foreign-shop
 * caller simply gets "order not found". The VAPID private key never leaves
 * this server route.
 */
export async function POST(request: Request) {
  let orderId: string | undefined;
  try {
    const body = (await request.json()) as { order_id?: string };
    orderId = body.order_id;
  } catch {
    // fall through to the 400 below
  }
  if (!orderId) {
    return NextResponse.json({ error: "missing order_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, access_token, push_subscription, shops(name)")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }
  if (!order.push_subscription) {
    // Customer never opted in — nothing to send, not an error.
    return NextResponse.json({ sent: false });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const payload = JSON.stringify({
    title: t("push.readyTitle", {
      shop: order.shops?.name ?? "",
      number: order.order_number,
    }),
    body: t("push.readyBody"),
    url: `/order/${order.access_token}`,
  });

  try {
    await webpush.sendNotification(
      order.push_subscription as unknown as PushSubscription,
      payload
    );
    return NextResponse.json({ sent: true });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      // Subscription expired/unsubscribed — clear it so we stop trying.
      // Same authed client, so RLS still scopes this update to our shop.
      await supabase
        .from("orders")
        .update({ push_subscription: null })
        .eq("id", orderId);
    }
    return NextResponse.json({ sent: false });
  }
}
