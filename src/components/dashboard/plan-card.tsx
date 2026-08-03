"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { t } from "@/lib/i18n"
import type { Tables } from "@/lib/database.types"

export function PlanCard({
  shop,
  trialDays,
}: {
  shop: Tables<"shops">
  trialDays: number | null // computed server-side (null unless trialing)
}) {
  const [busy, setBusy] = useState(false)
  const active = shop.subscription_status === "active"

  const open = async (path: string) => {
    setBusy(true)
    const res = await fetch(path, { method: "POST" })
    const { url } = (await res.json().catch(() => ({}))) as { url?: string }
    if (url) window.location.href = url
    else {
      toast.error(t("billing.failed"))
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <Label>{t("billing.plan")}</Label>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{t("billing.basic")}</span>
        <span className="text-muted-foreground">
          {active
            ? t("billing.active")
            : trialDays !== null
              ? t("billing.trialLeft", { days: trialDays })
              : t("billing.trialEnded")}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t("billing.proSoon")}</p>
      {active ? (
        <Button
          variant="ghost"
          className="h-11 w-fit rounded-full px-6"
          disabled={busy}
          onClick={() => open("/api/stripe/portal")}
        >
          {busy ? t("billing.opening") : t("billing.manage")}
        </Button>
      ) : (
        <Button
          className="h-11 w-fit rounded-full px-6"
          disabled={busy}
          onClick={() => open("/api/stripe/checkout")}
        >
          {busy ? t("billing.opening") : t("billing.subscribe")}
        </Button>
      )}
    </section>
  )
}
