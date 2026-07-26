"use client"

import { useState } from "react"
import { toast } from "sonner"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Item = { id: string; name: string; is_available: boolean; sort_order: number }
type Category = { id: string; name: string; sort_order: number; menu_items: Item[] }

export function MenuAvailability({ categories }: { categories: Category[] }) {
  const supabase = createClient()
  const [items, setItems] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      categories.flatMap((c) => c.menu_items.map((i) => [i.id, i.is_available]))
    )
  )

  const toggle = async (id: string) => {
    const next = !items[id]
    setItems((prev) => ({ ...prev, [id]: next })) // optimistic
    const { error } = await supabase
      .from("menu_items")
      .update({ is_available: next })
      .eq("id", id)
    if (error) {
      setItems((prev) => ({ ...prev, [id]: !next })) // revert
      toast.error(t("menu.updateFailed"))
    }
  }

  const hasItems = categories.some((c) => c.menu_items.length > 0)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-4">
      {!hasItems ? (
        <p className="py-16 text-center text-muted-foreground">
          {t("menu.emptyMenu")}
        </p>
      ) : (
        categories
          .filter((c) => c.menu_items.length > 0)
          .map((category) => (
            <section key={category.id} className="flex flex-col gap-2">
              <h2 className="font-heading text-lg font-semibold">{category.name}</h2>
              <ul className="flex flex-col gap-2">
                {[...category.menu_items]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item) => {
                    const available = items[item.id]
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3"
                      >
                        <span className="font-medium">{item.name}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={available}
                          onClick={() => toggle(item.id)}
                          className={cn(
                            "h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
                            available
                              ? "bg-secondary text-secondary-foreground"
                              : "bg-destructive/10 text-destructive"
                          )}
                        >
                          {available ? t("menu.available") : t("menu.markSoldOut")}
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </section>
          ))
      )}
    </main>
  )
}
