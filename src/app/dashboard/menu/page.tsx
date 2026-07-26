import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { MenuEditor } from "@/components/dashboard/menu-editor";
import { getStaffShop } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("nav.menu") };

export default async function MenuPage() {
  const shop = await getStaffShop();
  if (!shop) return null;

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("menu_categories")
    .select(
      "id, name, sort_order, menu_items(id, name, description, price_minor, currency, is_available, sort_order, category_id, allergens)"
    )
    .eq("shop_id", shop.id)
    .order("sort_order");

  const currency =
    categories?.flatMap((c) => c.menu_items).find(Boolean)?.currency ?? "GBP";

  return (
    <div className="theme-travo flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <DashboardNav shop={shop} active="menu" />
      <MenuEditor
        categories={categories ?? []}
        shopId={shop.id}
        currency={currency}
      />
    </div>
  );
}
