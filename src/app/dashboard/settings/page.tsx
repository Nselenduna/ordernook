import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { ShopSettings } from "@/components/dashboard/shop-settings";
import { PlanCard } from "@/components/dashboard/plan-card";
import { OnlinePaymentsCard } from "@/components/dashboard/online-payments-card";
import { ConnectToast } from "@/components/dashboard/connect-toast";
import { getStaffShop } from "@/lib/dashboard";
import { reconcileFromCheckoutSession } from "@/lib/billing";
import { deriveConnectState } from "@/lib/connect";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("nav.settings") };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; connect?: string }>;
}) {
  // Returning from Stripe Checkout → sync the subscription straight from Stripe
  // (don't wait on the webhook) so the shop is unlocked the moment they land.
  const { session_id, connect } = await searchParams;
  if (session_id) await reconcileFromCheckoutSession(session_id);

  const shop = await getStaffShop();
  if (!shop) return null;
  // Computed here (server) so PlanCard stays pure and SSR-stable.
  const trialDays =
    shop.subscription_status === "trialing" && shop.trial_ends_at
      ? Math.max(
          0,
          Math.ceil((new Date(shop.trial_ends_at).getTime() - Date.now()) / 86_400_000)
        )
      : null;
  return (
    <div className="theme-travo flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <DashboardNav shop={shop} active="settings" />
      <ConnectToast status={connect} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4">
        <PlanCard shop={shop} trialDays={trialDays} />
        <OnlinePaymentsCard
          state={deriveConnectState(shop)}
          onlineEnabled={(shop.payment_modes ?? []).includes("online")}
        />
      </main>
      <ShopSettings
        shopId={shop.id}
        initialPaused={shop.is_paused}
        initialPrep={shop.prep_minutes}
      />
    </div>
  );
}
