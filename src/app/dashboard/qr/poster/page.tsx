import type { Metadata } from "next";
import { QrPoster } from "@/components/dashboard/qr-poster";
import { getStaffShop } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Poster" };

export default async function PosterPage() {
  const shop = await getStaffShop();
  if (!shop) return null;
  // Latte theme for a warm printed poster; no dashboard nav (print-friendly).
  return (
    <div className="theme-latte min-h-dvh bg-background text-foreground">
      <QrPoster slug={shop.slug} shopName={shop.name} />
    </div>
  );
}
