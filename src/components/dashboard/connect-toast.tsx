"use client"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { t } from "@/lib/i18n"

export function ConnectToast({ status }: { status?: string }) {
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !status) return
    done.current = true
    if (status === "success") toast.success(t("settings.online.connectSuccess"))
    else if (status === "cancelled") toast(t("settings.online.connectCancelled"))
    else if (status === "error") toast.error(t("settings.online.connectError"))
  }, [status])
  return null
}
