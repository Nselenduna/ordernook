import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { ShopSettings } from "@/components/dashboard/shop-settings";
import { PlanCard } from "@/components/dashboard/plan-card";
import { getStaffShop } from "@/lib/dashboard";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("nav.settings") };

export default async function SettingsPage() {
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
      <main className="mx-auto w-full max-w-3xl px-4 pt-4">
        <PlanCard shop={shop} trialDays={trialDays} />
      </main>
      <ShopSettings
        shopId={shop.id}
        initialPaused={shop.is_paused}
        initialPrep={shop.prep_minutes}
      />
    </div>
  );
}
