"use client"

import { useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { CheckIcon } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { QtyStepper } from "@/components/shop/qty-stepper"
import { t } from "@/lib/i18n"
import { formatMinor } from "@/lib/money"
import { useCart } from "@/store/cart"
import { cn } from "@/lib/utils"
import type { MenuItemWithGroups, OptionGroupWithOptions } from "@/lib/types"

type Selections = Record<string, string[]> // group_id -> selected option ids

/** Preselect the first option of required single groups (e.g. default Size). */
function initialSelections(item: MenuItemWithGroups): Selections {
  const selections: Selections = {}
  for (const group of item.option_groups) {
    selections[group.id] =
      group.type === "single" && group.required && group.options.length > 0
        ? [group.options[0].id]
        : []
  }
  return selections
}

function OptionGroupSection({
  group,
  selected,
  currency,
  onToggle,
}: {
  group: OptionGroupWithOptions
  selected: string[]
  currency: string
  onToggle: (optionId: string) => void
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{group.name}</h3>
        <Badge variant={group.required ? "secondary" : "outline"}>
          {group.required ? t("menu.required") : t("menu.optional")}
        </Badge>
      </div>
      <p className="sr-only">
        {group.type === "single" ? t("menu.chooseOne") : t("menu.chooseMany")}
      </p>
      <div className="flex flex-col gap-1.5">
        {group.options.map((option) => {
          const isSelected = selected.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              role={group.type === "single" ? "radio" : "checkbox"}
              aria-checked={isSelected}
              onClick={() => onToggle(option.id)}
              className={cn(
                "flex min-h-11 items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left text-sm transition-colors",
                isSelected
                  ? "border-primary bg-secondary font-medium"
                  : "border-border bg-card/60"
              )}
            >
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center border",
                    group.type === "single" ? "rounded-full" : "rounded-md",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input"
                  )}
                >
                  {isSelected && <CheckIcon className="size-3.5" />}
                </span>
                {option.name}
              </span>
              {option.price_delta_minor !== 0 && (
                <span className="text-muted-foreground tabular-nums">
                  {option.price_delta_minor > 0 ? "+" : ""}
                  {formatMinor(option.price_delta_minor, currency)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Holds the customisation form state. Mounted with key={item.id} so opening
 * a different item starts from a fresh state (no reset effect needed).
 */
function ItemSheetBody({
  item,
  currency,
  onDone,
}: {
  item: MenuItemWithGroups
  currency: string
  onDone: () => void
}) {
  const addToCart = useCart((state) => state.add)
  const [selections, setSelections] = useState<Selections>(() =>
    initialSelections(item)
  )
  const [qty, setQty] = useState(1)

  const toggleOption = (group: OptionGroupWithOptions, optionId: string) => {
    setSelections((prev) => {
      const current = prev[group.id] ?? []
      if (group.type === "single") {
        // Required single groups always keep a selection; optional ones can clear.
        if (current.includes(optionId)) {
          return group.required ? prev : { ...prev, [group.id]: [] }
        }
        return { ...prev, [group.id]: [optionId] }
      }
      return {
        ...prev,
        [group.id]: current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      }
    })
  }

  const { unitPriceMinor, optionIds, optionNames, requiredMet } =
    useMemo(() => {
      let price = item.price_minor
      const ids: string[] = []
      const names: string[] = []
      let met = true
      for (const group of item.option_groups) {
        const chosen = selections[group.id] ?? []
        if (group.required && chosen.length === 0) met = false
        for (const option of group.options) {
          if (chosen.includes(option.id)) {
            price += option.price_delta_minor
            ids.push(option.id)
            names.push(option.name)
          }
        }
      }
      return {
        unitPriceMinor: price,
        optionIds: ids,
        optionNames: names,
        requiredMet: met,
      }
    }, [item, selections])

  const handleAdd = () => {
    if (!requiredMet) return
    addToCart({
      item_id: item.id,
      name: item.name,
      qty,
      option_ids: optionIds,
      option_names: optionNames,
      unit_price_minor: unitPriceMinor,
    })
    toast.success(t("menu.added"))
    onDone()
  }

  return (
    <>
      {item.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.photo_url}
          alt=""
          className="h-40 w-full rounded-t-3xl object-cover"
        />
      )}
      <SheetHeader className="pb-2">
        <SheetTitle className="font-heading text-2xl">{item.name}</SheetTitle>
        <SheetDescription>
          {item.description ?? t("menu.customise")}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 px-4 pb-4">
        {item.option_groups.map((group) => (
          <OptionGroupSection
            key={group.id}
            group={group}
            selected={selections[group.id] ?? []}
            currency={currency}
            onToggle={(optionId) => toggleOption(group, optionId)}
          />
        ))}

        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{t("menu.allergens")}</h3>
          {item.allergens.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {item.allergens.map((a) => (
                <Badge key={a} variant="outline" className="capitalize">
                  {a}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("menu.allergensNone")}
            </p>
          )}
        </section>

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t("menu.qty")}</span>
          <QtyStepper qty={qty} onChange={setQty} />
        </div>

        <Button
          type="button"
          size="lg"
          className="h-12 w-full rounded-full text-base"
          disabled={!requiredMet}
          onClick={handleAdd}
        >
          {t("menu.addToOrder", {
            total: formatMinor(unitPriceMinor * qty, currency),
          })}
        </Button>
      </div>
    </>
  )
}

export function ItemSheet({
  item,
  currency,
  brandVars,
  onClose,
}: {
  item: MenuItemWithGroups | null
  currency: string
  brandVars: CSSProperties
  onClose: () => void
}) {
  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
      {/* theme-latte + brand vars must be re-applied: sheets portal to <body>,
          outside the themed page wrapper. */}
      <SheetContent
        side="bottom"
        className="theme-latte max-h-[85dvh] gap-0 overflow-y-auto rounded-t-3xl bg-background text-foreground"
        style={brandVars}
      >
        {item && (
          <ItemSheetBody
            key={item.id}
            item={item}
            currency={currency}
            onDone={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
