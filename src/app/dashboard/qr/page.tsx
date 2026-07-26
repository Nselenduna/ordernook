import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { QrPanel } from "@/components/dashboard/qr-panel";
import { getStaffShop } from "@/lib/dashboard";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("nav.qr") };

export default async function QrPage() {
  const shop = await getStaffShop();
  if (!shop) return null;
  return (
    <div className="theme-travo flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <DashboardNav shop={shop} active="qr" />
      <QrPanel slug={shop.slug} />
    </div>
  );
}
