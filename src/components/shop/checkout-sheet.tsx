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
import { cn } from "@/lib/utils"
import type { Json } from "@/lib/database.types"
import type {
  CreateOrderItem,
  CreateOrderResult,
  PaymentMode,
  ShopSummary,
} from "@/lib/types"

/** Map create_order DB exceptions to friendly copy. */
function orderErrorMessage(dbMessage: string): string {
  if (dbMessage.includes("shop_paused")) return t("errors.shop_paused")
  if (dbMessage.includes("item_unavailable")) return t("errors.item_unavailable")
  if (dbMessage.includes("missing_required_option"))
    return t("errors.missing_required_option")
  if (dbMessage.includes("payment_mode_unavailable"))
    return t("errors.payment_mode_unavailable")
  if (dbMessage.includes("online_not_configured"))
    return t("errors.online_not_configured")
  return t("errors.generic")
}

/** Map /api/stripe/checkout-order error codes (JSON `{ error }`) to friendly copy. */
function checkoutRouteErrorMessage(code: string): string {
  if (code === "amount_too_low") return t("errors.amount_too_low")
  if (code === "no_account") return t("errors.no_account")
  if (code === "not_payable") return t("errors.not_payable")
  return t("cart.payErrorGeneric")
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
  const [redirecting, setRedirecting] = useState(false)
  // Default to pay-on-collection — online is an opt-in choice.
  const [payMode, setPayMode] = useState<PaymentMode>("in_store")

  const totalMinor = cartTotalMinor(lines)
  const onlineOffered = shop.payment_modes?.includes("online") ?? false
  // Ignore a stale "online" selection if the shop doesn't (or no longer) offers it.
  const effectiveMode: PaymentMode = onlineOffered ? payMode : "in_store"

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
      p_payment_mode: effectiveMode,
    })

    if (error || !data) {
      toast.error(orderErrorMessage(error?.message ?? ""))
      setSubmitting(false)
      return
    }

    const result = data as unknown as CreateOrderResult

    // Clear the cart once create_order has succeeded — even if the payment
    // redirect below fails, the order is already recoverable via the access
    // token we're about to save to history, so nothing is lost.
    clear()
    addOrderToHistory({
      token: result.access_token,
      shop_slug: shop.slug,
      placed_at: new Date().toISOString(),
    })

    if (effectiveMode === "online") {
      setRedirecting(true)
      try {
        const response = await fetch("/api/stripe/checkout-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: result.order_id,
            token: result.access_token,
          }),
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok || !body.url) {
          toast.error(checkoutRouteErrorMessage(body.error ?? ""))
          setRedirecting(false)
          setSubmitting(false)
          // The order still exists as pending_payment — send them to its
          // status page so they can see it / retry from there.
          router.push(`/order/${result.access_token}`)
          return
        }
        // Full navigation to Stripe Checkout — leaves this page/state behind.
        window.location.href = body.url as string
      } catch {
        toast.error(t("cart.payErrorGeneric"))
        setRedirecting(false)
        setSubmitting(false)
        router.push(`/order/${result.access_token}`)
      }
      return
    }

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
          {/* Once online payment is an option the choice below explains how
              they'll pay, so the generic "pay at the counter" note would be
              wrong for half of them — only show it when there's no choice. */}
          {!onlineOffered && (
            <SheetDescription>{t("cart.payNote")}</SheetDescription>
          )}
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

              <p className="text-xs text-muted-foreground">
                {t("cart.allergenReminder")}
              </p>

              <div className="flex items-center justify-between text-base font-semibold">
                <span>{t("cart.total")}</span>
                <span className="tabular-nums">
                  {formatMinor(totalMinor, currency)}
                </span>
              </div>

              {onlineOffered && (
                <div className="flex flex-col gap-1.5">
                  <Label>{t("cart.payChoice")}</Label>
                  <div
                    role="radiogroup"
                    aria-label={t("cart.payChoice")}
                    className="flex gap-1 rounded-2xl bg-card/80 p-1 shadow-[0_8px_30px_rgba(111,78,55,.08)] backdrop-blur-md"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={payMode === "in_store"}
                      disabled={submitting || redirecting}
                      onClick={() => setPayMode("in_store")}
                      className={cn(
                        "h-11 flex-1 rounded-xl text-sm font-medium transition-colors",
                        payMode === "in_store"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {t("cart.payLater")}
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={payMode === "online"}
                      disabled={submitting || redirecting}
                      onClick={() => setPayMode("online")}
                      className={cn(
                        "h-11 flex-1 rounded-xl text-sm font-medium transition-colors",
                        payMode === "online"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {t("cart.payNow")}
                    </button>
                  </div>
                </div>
              )}

              <Button
                type="button"
                size="lg"
                className="h-12 w-full rounded-full text-base"
                disabled={submitting}
                onClick={placeOrder}
              >
                {redirecting
                  ? t("cart.redirecting")
                  : submitting
                    ? t("cart.placing")
                    : effectiveMode === "online"
                      ? t("cart.payNow")
                      : t("cart.placeOrder")}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
