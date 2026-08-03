"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { t } from "@/lib/i18n"

export function LockScreen({ hasCustomer }: { hasCustomer: boolean }) {
  const [busy, setBusy] = useState(false)

  const run = async (path: string) => {
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
    <main className="theme-travo mx-auto flex min-h-dvh max-w-md flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <h1 className="font-heading text-2xl font-semibold">{t("billing.lockTitle")}</h1>
      <p className="text-muted-foreground">{t("billing.lockBody")}</p>
      <Button
        className="h-12 w-full rounded-full text-base"
        disabled={busy}
        onClick={() => run("/api/stripe/checkout")}
      >
        {busy ? t("billing.opening") : t("billing.subscribe")}
      </Button>
      {hasCustomer && (
        <Button
          variant="ghost"
          className="rounded-full"
          disabled={busy}
          onClick={() => run("/api/stripe/portal")}
        >
          {t("billing.manage")}
        </Button>
      )}
    </main>
  )
}
