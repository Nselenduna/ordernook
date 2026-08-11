"use client"

import { useMemo, useState } from "react"
import { BellIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { t } from "@/lib/i18n"
import { isPushSupported, subscribeToPush } from "@/lib/push"
import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/lib/database.types"

type PushState = "idle" | "working" | "enabled" | "denied" | "error"

const attachedKey = (token: string) => `oa-push-${token}`

/**
 * "Get notified when your order is ready" opt-in. Hidden entirely when the
 * browser can't do web push (e.g. iOS Safari outside an installed PWA).
 *
 * This card only mounts after the order is fetched client-side, so it never
 * server-renders — browser APIs are safe to read directly here.
 */
export function PushCard({ token }: { token: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<PushState>(() =>
    // Already attached for this order in a previous visit?
    typeof window !== "undefined" &&
    window.localStorage.getItem(attachedKey(token))
      ? "enabled"
      : "idle"
  )

  if (!isPushSupported() || Notification.permission === "denied") return null

  const enable = async () => {
    setState("working")
    try {
      const subscription = await subscribeToPush(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      )
      if (!subscription) {
        setState("denied")
        return
      }
      // Store the subscription on the order row (token-scoped RPC, anon-safe).
      const { error } = await supabase.rpc("attach_push_subscription", {
        p_token: token,
        p_subscription: subscription as unknown as Json,
      })
      if (error) throw error
      window.localStorage.setItem(attachedKey(token), "1")
      setState("enabled")
    } catch {
      setState("error")
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-card p-4 shadow-[0_8px_30px_var(--shadow-brand,rgba(111,78,55,.12))] backdrop-blur-md">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
          <BellIcon className="size-5" />
        </span>
        <div>
          <p className="font-medium">{t("order.push.title")}</p>
          <p className="text-sm text-muted-foreground">
            {state === "enabled"
              ? t("order.push.enabled")
              : state === "denied"
                ? t("order.push.denied")
                : state === "error"
                  ? t("order.push.error")
                  : t("order.push.body")}
          </p>
        </div>
      </div>
      {(state === "idle" || state === "working" || state === "error") && (
        <Button
          type="button"
          className="h-11 w-full rounded-full"
          disabled={state === "working"}
          onClick={enable}
        >
          {t("order.push.button")}
        </Button>
      )}
    </div>
  )
}
