"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { CartBar } from "@/components/shop/cart-bar"
import { CheckoutSheet } from "@/components/shop/checkout-sheet"
import { ItemSheet } from "@/components/shop/item-sheet"
import { brandingVars } from "@/lib/branding"
import { t } from "@/lib/i18n"
import { formatMinor } from "@/lib/money"
import { cn } from "@/lib/utils"
import type {
  Branding,
  CategoryWithItems,
  MenuItemWithGroups,
  ShopSummary,
} from "@/lib/types"

function ItemCard({
  item,
  currency,
  onSelect,
}: {
  item: MenuItemWithGroups
  currency: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!item.is_available}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-3xl bg-card p-4 text-left shadow-[0_8px_30px_rgba(111,78,55,.12)] ring-1 ring-foreground/5 backdrop-blur-md transition-transform active:translate-y-px",
        !item.is_available && "opacity-60"
      )}
    >
      <span className="flex flex-col gap-1">
        <span className="font-medium">{item.name}</span>
        {item.description && (
          <span className="line-clamp-2 text-sm text-muted-foreground">
            {item.description}
          </span>
        )}
        {!item.is_available && (
          <Badge variant="secondary" className="mt-1">
            {t("menu.soldOut")}
          </Badge>
        )}
      </span>
      <span className="shrink-0 font-semibold text-primary tabular-nums">
        {formatMinor(item.price_minor, currency)}
      </span>
    </button>
  )
}

export function MenuPage({
  shop,
  branding,
  categories,
}: {
  shop: ShopSummary
  branding: Branding
  categories: CategoryWithItems[]
}) {
  const [activeItem, setActiveItem] = useState<MenuItemWithGroups | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "")
  const sectionsRef = useRef<HTMLDivElement>(null)

  // Sheets portal to <body>, outside the themed wrapper — so they need the
  // tenant CSS variables passed in again.
  const brandVars = useMemo(() => brandingVars(branding), [branding])

  // All items in a shop share one currency (enforced by shop config).
  const currency = categories[0]?.menu_items[0]?.currency ?? "GBP"

  // Scroll spy: highlight the category whose section is in the upper part
  // of the viewport as the customer scrolls.
  useEffect(() => {
    const sections = sectionsRef.current?.querySelectorAll("[data-category-id]")
    if (!sections || sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-category-id")
            if (id) setActiveCategory(id)
          }
        }
      },
      { rootMargin: "-15% 0px -70% 0px" }
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [categories])

  const scrollToCategory = (id: string) => {
    setActiveCategory(id)
    document
      .getElementById(`category-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-28">
      <header className="px-4 pt-10 pb-4 text-center">
        <h1 className="font-heading text-4xl font-semibold">{shop.name}</h1>
        {branding.tagline && (
          <p className="mt-2 text-sm text-muted-foreground">
            {branding.tagline}
          </p>
        )}
      </header>

      <nav className="sticky top-0 z-30 bg-background/80 py-3 backdrop-blur-md">
        <div className="flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => scrollToCategory(category.id)}
              className={cn(
                "h-11 shrink-0 rounded-full px-5 text-sm font-medium transition-colors",
                activeCategory === category.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground shadow-[0_4px_16px_rgba(111,78,55,.08)]"
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      </nav>

      <div ref={sectionsRef} className="flex flex-col gap-8 px-4 pt-4">
        {categories.map((category) => (
          <section
            key={category.id}
            id={`category-${category.id}`}
            data-category-id={category.id}
            className="scroll-mt-20"
          >
            <h2 className="mb-3 font-heading text-2xl font-medium">
              {category.name}
            </h2>
            <div className="flex flex-col gap-3">
              {category.menu_items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  currency={currency}
                  onSelect={() => setActiveItem(item)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <ItemSheet
        item={activeItem}
        currency={currency}
        brandVars={brandVars}
        onClose={() => setActiveItem(null)}
      />
      <CheckoutSheet
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        shop={shop}
        currency={currency}
        brandVars={brandVars}
      />
      <CartBar currency={currency} onOpen={() => setCheckoutOpen(true)} />
    </main>
  )
}
