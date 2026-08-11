"use client"

import { useEffect, useMemo, useState } from "react"
import { BellRingIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { t } from "@/lib/i18n"
import { isPushSupported, subscribeToPush } from "@/lib/push"
import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/lib/database.types"

type State =
  | "checking"
  | "idle"
  | "working"
  | "enabled"
  | "error"
  | "needsInstall"
  | "hidden"

const DISMISS_KEY = "on-alerts-dismissed"

/**
 * iOS only delivers web push to an installed home-screen PWA (16.4+), and
 * isPushSupported() returns false in mobile Safari. Detect that case
 * explicitly so we can show the install instruction rather than silently
 * rendering nothing to the users who most need telling.
 */
function isIosOutsideStandalone(): boolean {
  const ua = window.navigator.userAgent
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as a Mac; the touch points disambiguate it.
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
  if (!isIos) return false
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  return !standalone
}

function deviceLabel(): string {
  const ua = window.navigator.userAgent
  if (/iPhone/.test(ua)) return "iPhone"
  if (/iPad/.test(ua)) return "iPad"
  if (/Android/.test(ua)) return "Android device"
  return "Desktop"
}

export function OrderAlertsBanner({ shopId }: { shopId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<State>("checking")

  useEffect(() => {
    let cancelled = false

    const decide = async () => {
      if (window.localStorage.getItem(DISMISS_KEY)) return setState("hidden")
      if (isIosOutsideStandalone()) return setState("needsInstall")
      if (!isPushSupported()) return setState("hidden")
      if (Notification.permission === "denied") return setState("hidden")

      // Ask the browser, not localStorage — this survives a cleared cache
      // and reflects the subscription's real state.
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        const existing = await registration?.pushManager.getSubscription()
        if (!cancelled) setState(existing ? "hidden" : "idle")
      } catch {
        if (!cancelled) setState("idle")
      }
    }

    void decide()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = async () => {
    setState("working")
    try {
      const subscription = await subscribeToPush(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      )
      if (!subscription) {
        // Permission refused — nothing more to offer on this device.
        setState("hidden")
        return
      }
      const { error } = await supabase.rpc("attach_staff_push_device", {
        p_shop_id: shopId,
        p_subscription: subscription as unknown as Json,
        p_label: deviceLabel(),
      })
      if (error) throw error
      setState("enabled")
    } catch {
      setState("error")
    }
  }

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1")
    setState("hidden")
  }

  if (state === "checking" || state === "hidden") return null

  const message =
    state === "enabled"
      ? t("alerts.enabled")
      : state === "error"
        ? t("alerts.error")
        : state === "needsInstall"
          ? t("alerts.installFirst")
          : t("alerts.body")

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
        <BellRingIcon className="size-5" />
      </span>
      <div className="flex-1">
        <p className="font-medium">{t("alerts.title")}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{message}</p>
        {(state === "idle" || state === "working" || state === "error") && (
          <Button
            type="button"
            className="mt-3 h-11 rounded-full"
            disabled={state === "working"}
            onClick={enable}
          >
            {t("alerts.button")}
          </Button>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        aria-label={t("alerts.dismiss")}
        className="size-11 shrink-0 rounded-full"
        onClick={dismiss}
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  )
}
