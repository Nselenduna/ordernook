import { cache } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { MenuPage } from "@/components/shop/menu-page";
import { brandingVars, parseBranding } from "@/lib/branding";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { CategoryWithItems } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

// cache() dedupes the fetch between generateMetadata and the page render.
const getShopWithMenu = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shops")
    .select(
      "*, menu_categories(*, menu_items(*, option_groups(*, options(*))))"
    )
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShopWithMenu(slug);
  if (!shop) return {};
  const branding = parseBranding(shop.branding);
  return {
    title: shop.name,
    description: branding.tagline ?? t("app.description"),
    manifest: `/${slug}/manifest.webmanifest`,
    icons: branding.logo_url
      ? { apple: branding.logo_url.replace("icon-512", "icon-180") }
      : undefined,
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { slug } = await params;
  const shop = await getShopWithMenu(slug);
  const branding = shop ? parseBranding(shop.branding) : {};
  return { themeColor: branding.primary ?? branding.accent ?? "#6F4E37" };
}

/** Nested Supabase selects come back unordered — sort every level once here. */
function sortMenu(categories: CategoryWithItems[]): CategoryWithItems[] {
  const bySort = (a: { sort_order: number }, b: { sort_order: number }) =>
    a.sort_order - b.sort_order;
  return [...categories].sort(bySort).map((category) => ({
    ...category,
    menu_items: [...category.menu_items].sort(bySort).map((item) => ({
      ...item,
      option_groups: [...item.option_groups].sort(bySort).map((group) => ({
        ...group,
        options: [...group.options].sort(bySort),
      })),
    })),
  }));
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params;
  const shop = await getShopWithMenu(slug);
  if (!shop) notFound();

  const branding = parseBranding(shop.branding);
  const vars = brandingVars(branding);

  if (shop.is_paused) {
    return (
      <main
        className="theme-latte flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground"
        style={vars}
      >
        <h1 className="font-heading text-3xl font-semibold">
          {t("menu.paused.title")}
        </h1>
        <p className="max-w-sm text-muted-foreground">
          {t("menu.paused.body", { shop: shop.name })}
        </p>
      </main>
    );
  }

  const categories = sortMenu(shop.menu_categories).filter(
    (category) => category.menu_items.length > 0
  );

  return (
    <div
      className="theme-latte flex flex-1 flex-col bg-background text-foreground"
      style={vars}
    >
      <MenuPage
        shop={{
          id: shop.id,
          name: shop.name,
          slug: shop.slug,
          prep_minutes: shop.prep_minutes,
        }}
        branding={branding}
        categories={categories}
      />
    </div>
  );
}
