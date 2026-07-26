"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { Tables } from "@/lib/database.types"

type Section = "orders" | "menu" | "settings" | "qr" | "profile"

const LINKS: { id: Section; href: string; label: string }[] = [
  { id: "orders", href: "/dashboard", label: t("nav.orders") },
  { id: "menu", href: "/dashboard/menu", label: t("nav.menu") },
  { id: "settings", href: "/dashboard/settings", label: t("nav.settings") },
  { id: "qr", href: "/dashboard/qr", label: t("nav.qr") },
  { id: "profile", href: "/dashboard/profile", label: t("nav.profile") },
]

export function DashboardNav({
  shop,
  active,
}: {
  shop: Tables<"shops">
  active: Section
}) {
  const router = useRouter()

  const signOut = async () => {
    await createClient().auth.signOut()
    router.push("/dashboard/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-2">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-lg font-bold">{shop.name}</h1>
          <Button
            variant="ghost"
            className="h-11 rounded-full px-3 text-muted-foreground"
            onClick={signOut}
          >
            {t("dash.signOut")}
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {LINKS.map(({ id, href, label }) => (
            <Link
              key={id}
              href={href}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-sm font-medium leading-9 transition-colors",
                id === active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
