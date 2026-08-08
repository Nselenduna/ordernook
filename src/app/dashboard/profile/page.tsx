import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { ShopProfile } from "@/components/dashboard/shop-profile";
import { getStaffShop } from "@/lib/dashboard";
import { DEFAULT_BRANDING, parseBranding } from "@/lib/branding";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("nav.profile") };

export default async function ProfilePage() {
  const shop = await getStaffShop();
  if (!shop) return null;
  const branding = parseBranding(shop.branding);
  return (
    <div className="theme-travo flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <DashboardNav shop={shop} active="profile" />
      <ShopProfile
        shopId={shop.id}
        initialName={shop.name}
        initialTagline={branding.tagline ?? ""}
        initialPrimary={branding.primary ?? DEFAULT_BRANDING.primary}
        initialAccent={branding.accent ?? DEFAULT_BRANDING.accent}
        initialBackground={branding.background ?? DEFAULT_BRANDING.background}
        initialLogoUrl={branding.logo_url ?? null}
      />
    </div>
  );
}
