import { reconcileOrderPayment } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrderStatusClient } from "./order-status-client";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export default async function OrderStatusPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { session_id } = await searchParams;

  // Returning from Stripe Checkout → reconcile straight from Stripe (don't
  // wait on the connect webhook) so the order flips to `new` the moment the
  // customer lands. `token` IS the order's access_token (the secret that
  // authorizes reading this order), same as checkout-order's lookup.
  if (session_id) {
    try {
      const admin = createAdminClient();
      const { data: order } = await admin
        .from("orders")
        .select("id, status, shops(stripe_account_id)")
        .eq("access_token", token)
        .maybeSingle();
      if (order) {
        const shop = order.shops as { stripe_account_id: string | null } | null;
        await reconcileOrderPayment(
          {
            id: order.id,
            status: order.status,
            shop_stripe_account_id: shop?.stripe_account_id ?? null,
          },
          session_id
        );
      }
    } catch {
      // Swallow: the connect webhook can still reconcile this order, and the
      // client below will just show `pending_payment` until it does.
    }
  }

  return <OrderStatusClient token={token} />;
}
