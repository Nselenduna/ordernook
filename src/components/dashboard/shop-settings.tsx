"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export function ShopSettings({
  shopId,
  initialPaused,
  initialPrep,
}: {
  shopId: string
  initialPaused: boolean
  initialPrep: number
}) {
  const supabase = createClient()
  const [paused, setPaused] = useState(initialPaused)
  const [prep, setPrep] = useState(String(initialPrep))
  const [savingPrep, setSavingPrep] = useState(false)

  const accepting = !paused

  const toggleAccepting = async () => {
    // nextPaused = accepting, because `accepting` is already the toggled value of `paused`
    const nextPaused = accepting
    setPaused(nextPaused) // optimistic
    const { error } = await supabase
      .from("shops")
      .update({ is_paused: nextPaused })
      .eq("id", shopId)
    if (error) {
      setPaused(!nextPaused)
      toast.error(t("settings.saveFailed"))
    }
  }

  const savePrep = async () => {
    const value = Number.parseInt(prep, 10)
    if (!Number.isFinite(value) || value < 0) {
      setPrep(String(initialPrep))
      return
    }
    setSavingPrep(true)
    const { error } = await supabase
      .from("shops")
      .update({ prep_minutes: value })
      .eq("id", shopId)
    setSavingPrep(false)
    toast[error ? "error" : "success"](
      error ? t("settings.saveFailed") : t("settings.saved")
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4">
      <section className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h2 className="font-semibold">{t("settings.acceptingOrders")}</h2>
          <p className="text-sm text-muted-foreground">
            {accepting ? t("settings.acceptingOn") : t("settings.acceptingOff")}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={accepting}
          onClick={toggleAccepting}
          className={cn(
            "h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
            accepting
              ? "bg-(--status-ready) text-white"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {accepting ? t("settings.acceptingOrders") : t("settings.acceptingOffLabel")}
        </button>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <Label htmlFor="prep">{t("settings.prepTime")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="prep"
            type="number"
            min={0}
            value={prep}
            onChange={(e) => setPrep(e.target.value)}
            className="h-11 w-28 rounded-xl"
          />
          <Button
            type="button"
            className="h-11 rounded-full px-5"
            disabled={savingPrep}
            onClick={savePrep}
          >
            {t("settings.saveButton")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("settings.prepHint")}</p>
      </section>
    </main>
  )
}
