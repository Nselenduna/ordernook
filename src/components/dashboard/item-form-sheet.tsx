"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { UK_ALLERGENS } from "@/lib/allergens"

export type EditorItem = {
  id: string
  name: string
  description: string | null
  price_minor: number
  currency: string
  is_available: boolean
  sort_order: number
  category_id: string
  allergens: string[]
}

export function ItemFormSheet({
  open,
  onOpenChange,
  item,
  categories,
  shopId,
  currency,
  defaultCategoryId,
  nextSortOrder,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  item: EditorItem | null // null = add mode
  categories: { id: string; name: string }[]
  shopId: string
  currency: string
  defaultCategoryId: string
  nextSortOrder: number
}) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState(item?.name ?? "")
  const [description, setDescription] = useState(item?.description ?? "")
  const [price, setPrice] = useState(item ? (item.price_minor / 100).toFixed(2) : "")
  const [categoryId, setCategoryId] = useState(item?.category_id ?? defaultCategoryId)
  const [allergens, setAllergens] = useState<Set<string>>(
    new Set(item?.allergens ?? [])
  )
  const [saving, setSaving] = useState(false)

  const toggleAllergen = (key: string) =>
    setAllergens((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return toast.error(t("editor.nameRequired"))
    const pounds = Number.parseFloat(price)
    if (!Number.isFinite(pounds) || pounds < 0)
      return toast.error(t("editor.priceInvalid"))
    const price_minor = Math.round(pounds * 100)

    setSaving(true)
    const fields = {
      name: trimmed,
      description: description.trim() || null,
      price_minor,
      category_id: categoryId,
      allergens: [...allergens],
    }
    const { error } = item
      ? await supabase.from("menu_items").update(fields).eq("id", item.id)
      : await supabase.from("menu_items").insert({
          ...fields,
          shop_id: shopId,
          currency,
          is_available: true,
          sort_order: nextSortOrder,
        })
    setSaving(false)
    if (error) return toast.error(t("editor.saveFailed"))
    toast.success(t("editor.saved"))
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="theme-travo max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl bg-background text-foreground"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="font-heading text-2xl">
            {item ? t("editor.editItem") : t("editor.addItem")}
          </SheetTitle>
          <SheetDescription>{t("editor.itemFormHint")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="it-name">{t("editor.name")}</Label>
            <Input
              id="it-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="it-desc">{t("editor.description")}</Label>
            <Textarea
              id="it-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-xl"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="it-price">{t("editor.priceLabel")}</Label>
              <Input
                id="it-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-11 w-28 rounded-xl"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="it-cat">{t("editor.category")}</Label>
              <select
                id="it-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-11 rounded-xl border border-input bg-transparent px-3"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("editor.allergens")}</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {UK_ALLERGENS.map(({ key, label }) => {
                const on = allergens.has(key)
                return (
                  <button
                    key={key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleAllergen(key)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm",
                      on
                        ? "border-primary bg-secondary font-medium"
                        : "border-border bg-card"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border text-xs",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      )}
                    >
                      {on ? "✓" : ""}
                    </span>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            className="h-12 w-full rounded-full text-base"
            disabled={saving}
            onClick={save}
          >
            {saving ? t("editor.saving") : t("editor.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
