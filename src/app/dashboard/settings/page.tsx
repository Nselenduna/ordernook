import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { ShopSettings } from "@/components/dashboard/shop-settings";
import { getStaffShop } from "@/lib/dashboard";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("nav.settings") };

export default async function SettingsPage() {
  const shop = await getStaffShop();
  if (!shop) return null;
  return (
    <div className="theme-travo flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <DashboardNav shop={shop} active="settings" />
      <ShopSettings
        shopId={shop.id}
        initialPaused={shop.is_paused}
        initialPrep={shop.prep_minutes}
      />
    </div>
  );
}
