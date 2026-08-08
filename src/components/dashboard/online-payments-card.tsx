"use client"

import { useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import type { ConnectState } from "@/lib/connect"

export function OnlinePaymentsCard({
  state,
  onlineEnabled,
}: {
  state: ConnectState
  onlineEnabled: boolean
}) {
  const supabase = createClient()
  const [enabled, setEnabled] = useState(onlineEnabled)
  const [busy, setBusy] = useState(false)
  const [toggling, setToggling] = useState(false)

  const toggle = async () => {
    if (toggling) return // guard against double-click racing the closure's stale `enabled`
    setToggling(true)
    const next = !enabled
    setEnabled(next) // optimistic
    try {
      const { error } = await supabase.rpc("set_online_payments", { p_enabled: next })
      if (error) {
        setEnabled(!next)
        toast.error(t("settings.online.saveFailed"))
      }
    } finally {
      setToggling(false)
    }
  }

  const disconnect = async () => {
    if (!window.confirm(t("settings.online.disconnectConfirm"))) return
    setBusy(true)
    const res = await fetch("/api/stripe/connect/disconnect", { method: "POST" })
    setBusy(false)
    if (!res.ok) return toast.error(t("settings.online.saveFailed"))
    window.location.reload() // reflect the cleared account from the server
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="font-semibold">{t("settings.online.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.online.blurb")}</p>
      </div>

      {state === "none" ? (
        <a
          href="/api/stripe/connect/start"
          className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          {t("settings.online.setup")}
        </a>
      ) : state === "pending" ? (
        <div className="flex flex-col gap-3">
          <span className="text-sm text-muted-foreground">{t("settings.online.pending")}</span>
          <a
            href="/api/stripe/connect/start"
            className="inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            {t("settings.online.finishSetup")}
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-(--status-ready)">
            {t("settings.online.ready")}
          </span>
          <div className="flex items-center justify-between">
            <span id="accept-online-label" className="text-sm">
              {t("settings.online.accept")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-labelledby="accept-online-label"
              disabled={toggling}
              onClick={toggle}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
                enabled ? "bg-(--status-ready) text-white" : "bg-muted text-foreground"
              )}
            >
              {t(enabled ? "settings.online.on" : "settings.online.off")}
            </button>
          </div>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="self-start text-sm text-muted-foreground underline"
          >
            {t("settings.online.disconnect")}
          </button>
        </div>
      )}
    </section>
  )
}
