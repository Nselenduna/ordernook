"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import {
  PRESETS,
  brandingVars,
  contrastVsWhite,
  contrastRatio,
  derivedForeground,
} from "@/lib/branding"

export function ShopProfile({
  shopId,
  initialName,
  initialTagline,
  initialPrimary,
  initialAccent,
  initialBackground,
  initialLogoUrl,
}: {
  shopId: string
  initialName: string
  initialTagline: string
  initialPrimary: string
  initialAccent: string
  initialBackground: string
  initialLogoUrl: string | null
}) {
  const supabase = createClient()
  const [name, setName] = useState(initialName)
  const [tagline, setTagline] = useState(initialTagline)
  const [primary, setPrimary] = useState(initialPrimary)
  const [accent, setAccent] = useState(initialAccent)
  const [background, setBackground] = useState(initialBackground)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const primaryOk = contrastVsWhite(primary) >= 4.5
  const bgOk = contrastRatio(derivedForeground(primary), background) >= 4.5
  const paletteOk = primaryOk && bgOk

  const save = async () => {
    if (!name.trim()) return
    if (!primaryOk) return void toast.error(t("profile.contrastWarning"))
    if (!bgOk) return void toast.error(t("profile.bgContrastWarning"))
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
        branding: { ...current, tagline: tagline.trim(), primary, accent, background },
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
    setLogoUrl(`${logo_url}?t=${Date.now()}`)
    toast.success(t("profile.saved"))
  }

  const previewVars = brandingVars({ primary, accent, background })

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
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h2 className="font-semibold">{t("profile.palette")}</h2>
          <p className="text-sm text-muted-foreground">{t("profile.paletteHint")}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-label={p.label}
              onClick={() => {
                setPrimary(p.primary)
                setAccent(p.accent)
                setBackground(p.background)
              }}
              className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
            >
              <span className="flex overflow-hidden rounded-full border border-border">
                <span className="size-4" style={{ background: p.primary }} />
                <span className="size-4" style={{ background: p.accent }} />
                <span className="size-4" style={{ background: p.background }} />
              </span>
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <ColourField id="c-primary" label={t("profile.primary")} value={primary} onChange={setPrimary} />
          <ColourField id="c-accent" label={t("profile.accent")} value={accent} onChange={setAccent} />
          <ColourField id="c-bg" label={t("profile.background")} value={background} onChange={setBackground} />
        </div>

        {!primaryOk ? (
          <p className="text-xs text-destructive">{t("profile.contrastWarning")}</p>
        ) : !bgOk ? (
          <p className="text-xs text-destructive">{t("profile.bgContrastWarning")}</p>
        ) : null}

        <div
          className="theme-latte rounded-xl border border-border p-3"
          style={{ ...previewVars, background: "var(--background)", color: "var(--foreground)" }}
        >
          <p className="mb-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("profile.preview")}
          </p>
          <div
            className="flex items-center justify-between rounded-lg p-3"
            style={{ background: "var(--card)", color: "var(--card-foreground)" }}
          >
            <div>
              <div className="font-medium">Flat White</div>
              <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                £3.20
              </div>
            </div>
            <span
              className="rounded-full px-4 py-2 text-sm font-medium"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              Add
            </span>
          </div>
        </div>

        <Button
          type="button"
          className="h-11 w-fit rounded-full px-6"
          disabled={saving || !paletteOk || !name.trim()}
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

function ColourField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-xl border border-input bg-transparent"
        />
        <span className="text-xs tabular-nums text-muted-foreground">{value}</span>
      </div>
    </div>
  )
}
