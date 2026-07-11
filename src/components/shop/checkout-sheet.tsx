"use client"

import { useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
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
import { addOrderToHistory } from "@/lib/order-history"
import { createClient } from "@/lib/supabase/client"
import { cartTotalMinor, useCart } from "@/store/cart"
import type { Json } from "@/lib/database.types"
import type {
  CreateOrderItem,
  CreateOrderResult,
  ShopSummary,
} from "@/lib/types"

/** Map create_order DB exceptions to friendly copy. */
function orderErrorMessage(dbMessage: string): string {
  if (dbMessage.includes("shop_paused")) return t("errors.shop_paused")
  if (dbMessage.includes("item_unavailable")) return t("errors.item_unavailable")
  if (dbMessage.includes("missing_required_option"))
    return t("errors.missing_required_option")
  return t("errors.generic")
}

export function CheckoutSheet({
  open,
  onOpenChange,
  shop,
  currency,
  brandVars,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shop: ShopSummary
  currency: string
  brandVars: CSSProperties
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { lines, setQty, remove, clear } = useCart()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const totalMinor = cartTotalMinor(lines)

  const placeOrder = async () => {
    if (!name.trim()) {
      toast.error(t("errors.nameRequired"))
      return
    }
    if (lines.length === 0 || submitting) return

    setSubmitting(true)
    const items: CreateOrderItem[] = lines.map((line) => ({
      item_id: line.item_id,
      qty: line.qty,
      option_ids: line.option_ids,
    }))

    // Only item ids + qty go up — create_order recomputes every price
    // server-side, so a tampered client can never set its own total.
    const { data, error } = await supabase.rpc("create_order", {
      p_shop_slug: shop.slug,
      p_customer_name: name.trim(),
      // Generated types say string, but the function accepts NULL for "no phone".
      p_customer_phone: (phone.trim() || null) as unknown as string,
      p_items: items as unknown as Json,
    })

    if (error || !data) {
      toast.error(orderErrorMessage(error?.message ?? ""))
      setSubmitting(false)
      return
    }

    const result = data as unknown as CreateOrderResult
    clear()
    addOrderToHistory({
      token: result.access_token,
      shop_slug: shop.slug,
      placed_at: new Date().toISOString(),
    })
    // Keep submitting=true while we navigate so the button can't double-fire.
    router.push(`/order/${result.access_token}`)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="theme-latte max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl bg-background text-foreground"
        style={brandVars}
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="font-heading text-2xl">
            {t("cart.title")}
          </SheetTitle>
          <SheetDescription>{t("cart.payNote")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          {lines.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              {t("cart.empty")}
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {lines.map((line) => (
                  <li
                    key={line.key}
                    className="flex flex-col gap-2 rounded-2xl bg-card/80 p-3 shadow-[0_8px_30px_rgba(111,78,55,.08)] backdrop-blur-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{line.name}</p>
                        {line.option_names.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {line.option_names.join(", ")}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold tabular-nums">
                        {formatMinor(line.unit_price_minor * line.qty, currency)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <QtyStepper
                        qty={line.qty}
                        onChange={(qty) => setQty(line.key, qty)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 rounded-full px-4 text-destructive"
                        onClick={() => remove(line.key)}
                      >
                        {t("cart.remove")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              <Separator />

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="checkout-name">{t("cart.nameLabel")}</Label>
                  <Input
                    id="checkout-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("cart.namePlaceholder")}
                    autoComplete="name"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="checkout-phone">{t("cart.phoneLabel")}</Label>
                  <Input
                    id="checkout-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    autoComplete="tel"
                    className="h-11 rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("cart.phoneHint")}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-base font-semibold">
                <span>{t("cart.total")}</span>
                <span className="tabular-nums">
                  {formatMinor(totalMinor, currency)}
                </span>
              </div>

              <Button
                type="button"
                size="lg"
                className="h-12 w-full rounded-full text-base"
                disabled={submitting}
                onClick={placeOrder}
              >
                {submitting ? t("cart.placing") : t("cart.placeOrder")}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
