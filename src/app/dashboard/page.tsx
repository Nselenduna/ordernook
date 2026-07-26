import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { t } from "@/lib/i18n";
import { getStaffShop } from "@/lib/dashboard";

export const metadata: Metadata = { title: t("login.title") };

export default async function DashboardPage() {
  const shop = await getStaffShop();
  if (!shop) {
    return (
      <main className="theme-travo flex flex-1 flex-col items-center justify-center bg-background px-6 text-center text-foreground">
        <p className="max-w-sm text-muted-foreground">{t("dash.notLinked")}</p>
      </main>
    );
  }
  return <DashboardShell shop={shop} />;
}
