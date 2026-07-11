"use client"

import { useEffect, useState } from "react"
import { t } from "@/lib/i18n"
import { formatMinor } from "@/lib/money"
import { cartCount, cartTotalMinor, useCart } from "@/store/cart"

/** Floating "view order" bar shown while the cart has items. */
export function CartBar({
  currency,
  onOpen,
}: {
  currency: string
  onOpen: () => void
}) {
  const lines = useCart((state) => state.lines)
  // The cart is restored from localStorage on the client, so skip the first
  // server-rendered frame to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const count = cartCount(lines)
  if (!mounted || count === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-4">
      <button
        type="button"
        onClick={onOpen}
        className="pointer-events-auto mx-auto flex h-14 w-full max-w-md items-center justify-between rounded-full bg-primary px-5 text-primary-foreground shadow-[0_8px_30px_rgba(111,78,55,.3)] transition-transform active:translate-y-px"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/20 text-sm font-bold tabular-nums">
          {count}
        </span>
        <span className="text-base font-semibold">{t("menu.viewOrder")}</span>
        <span className="text-base font-semibold tabular-nums">
          {formatMinor(cartTotalMinor(lines), currency)}
        </span>
      </button>
    </div>
  )
}
