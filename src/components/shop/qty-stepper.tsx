"use client"

import { MinusIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { t } from "@/lib/i18n"

/** Round +/- quantity stepper with 44px touch targets. */
export function QtyStepper({
  qty,
  min = 1,
  onChange,
}: {
  qty: number
  min?: number
  onChange: (qty: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 rounded-full"
        disabled={qty <= min}
        onClick={() => onChange(qty - 1)}
        aria-label={t("menu.decreaseQty")}
      >
        <MinusIcon />
      </Button>
      <span className="min-w-6 text-center text-base font-semibold tabular-nums">
        {qty}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 rounded-full"
        onClick={() => onChange(qty + 1)}
        aria-label={t("menu.increaseQty")}
      >
        <PlusIcon />
      </Button>
    </div>
  )
}
