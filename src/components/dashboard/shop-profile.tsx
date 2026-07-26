"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"

/** WCAG contrast ratio of a hex colour against white (button text is white). */
function contrastVsWhite(hex: string): number {
  const c = hex.replace("#", "")
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return 0
  const chan = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  const L = 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2]
  return 1.05 / (L + 0.05) // white luminance = 1.0
}

export function ShopProfile({
  shopId,
  initialName,
  initialTagline,
  initialColour,
  initialLogoUrl,
}: {
  shopId: string
  initialName: string
  initialTagline: string
  initialColour: string
  initialLogoUrl: string | null
}) {
  const supabase = createClient()
  const [name, setName] = useState(initialName)
  const [tagline, setTagline] = useState(initialTagline)
  const [colour, setColour] = useState(initialColour)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const contrastOk = contrastVsWhite(colour) >= 4.5

  const save = async () => {
    if (!name.trim()) return
    if (!contrastOk) {
      toast.error(t("profile.contrastWarning"))
      return
    }
    setSaving(true)
    // Read-merge-write so we don't clobber logo_url the route set.
    const { data: shop } = await supabase
      .from("shops")
      .select("branding")
      .eq("id", shopId)
      .single()
    const current = (shop?.branding as Record<string, unknown>) ?? {}
    const { error } = await supabase
      .from("shops")
      .update({
        name: name.trim(),
        branding: { ...current, tagline: tagline.trim(), primary: colour, accent: colour },
      })
      .eq("id", shopId)
    setSaving(false)
    toast[error ? "error" : "success"](
      error ? t("profile.saveFailed") : t("profile.saved")
    )
  }

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      toast.error(t("profile.logoTooLarge"))
      return
    }
    setUploading(true)
    const body = new FormData()
    body.append("logo", file)
    const res = await fetch("/api/branding/logo", { method: "POST", body })
    setUploading(false)
    if (!res.ok) {
      toast.error(t("profile.logoFailed"))
      return
    }
    const { logo_url } = (await res.json()) as { logo_url: string }
    setLogoUrl(`${logo_url}?t=${Date.now()}`) // bust <img> cache after re-upload
    toast.success(t("profile.saved"))
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shop-name">{t("profile.name")}</Label>
          <Input
            id="shop-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shop-tagline">{t("profile.tagline")}</Label>
          <Input
            id="shop-tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder={t("profile.taglinePlaceholder")}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shop-colour">{t("profile.brandColour")}</Label>
          <div className="flex items-center gap-3">
            <input
              id="shop-colour"
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="h-11 w-16 cursor-pointer rounded-xl border border-input bg-transparent"
            />
            <span className="text-sm tabular-nums text-muted-foreground">
              {colour}
            </span>
          </div>
          {!contrastOk ? (
            <p className="text-xs text-destructive">
              {t("profile.contrastWarning")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("profile.brandColourHint")}
            </p>
          )}
        </div>
        <Button
          type="button"
          className="h-11 w-fit rounded-full px-6"
          disabled={saving || !contrastOk || !name.trim()}
          onClick={save}
        >
          {t("profile.save")}
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <Label>{t("profile.logo")}</Label>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="size-24 rounded-2xl border border-border object-cover"
          />
        )}
        <p className="text-xs text-muted-foreground">{t("profile.logoHint")}</p>
        <label className="inline-flex h-11 w-fit cursor-pointer items-center rounded-full bg-secondary px-5 text-sm font-medium text-secondary-foreground">
          {uploading ? t("profile.uploading") : t("profile.uploadLogo")}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={onLogo}
          />
        </label>
      </section>
    </main>
  )
}
