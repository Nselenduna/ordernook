# Shop Colour Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a shop owner pick a ready-made palette or fine-tune three colours so the customer ordering page and installable PWA look owned by the shop.

**Architecture:** Reuse the existing `shops.branding` jsonb and `--brand-*` CSS-variable pipeline. Add AA-validated presets + pure contrast helpers in `src/lib/branding.ts`, make `.theme-latte` derive all surface tints from the three brand colours via `color-mix()`, and replace the single colour picker in `ShopProfile` with a preset chooser + three fine-tune inputs + a live preview, gated by contrast checks. The customer page already consumes `brandingVars`, so the fuller palette flows through; only the PWA manifest needs a one-line tweak.

**Tech Stack:** Next.js App Router (React client component, route handler), Supabase JS (client update), CSS `color-mix()`, Vitest (pure unit tests).

## Global Constraints

- Customer-facing only: `/[slug]` page, customer menu UI, per-shop PWA manifest. The dashboard admin theme (`.theme-travo`) is unchanged.
- No migration — reuse `shops.branding` jsonb (`primary`, `accent`, `background`, `tagline`, `logo_url`).
- Light backgrounds only; no font/shape/template switching (YAGNI).
- Every preset MUST pass the contrast test (Task 1): `primary` ≥ 4.5 vs white, and `derivedForeground(primary)` ≥ 4.5 vs `background`. A failing preset is adjusted, never shipped.
- `accent` carries no text (ring + low-opacity tints only) — it has no contrast gate.
- Logo upload logic in `ShopProfile` and `/api/branding/logo` is unchanged.
- Verify UI tasks with `npx tsc --noEmit && npm run build` (both must pass). Route/CSS/visual behaviour is confirmed in the manual run-through.

---

### Task 1: Presets + pure contrast helpers in `src/lib/branding.ts`

**Files:**
- Modify: `src/lib/branding.ts`
- Test: `tests/branding.test.ts`

**Interfaces:**
- Produces:
  - `contrastRatio(a: string, b: string): number` — WCAG ratio 1–21, order-independent.
  - `contrastVsWhite(hex: string): number` — ratio vs `#ffffff`; `0` for malformed input.
  - `mixSrgb(a: string, b: string, weight: number): string` — linear sRGB mix, `weight` = share of `a`.
  - `derivedForeground(primary: string): string` — the theme's body-text colour = `mixSrgb(primary, "#1a1a1a", 0.35)`.
  - `type Preset = { id: string; label: string; primary: string; accent: string; background: string }`
  - `PRESETS: Preset[]`
  - (existing `DEFAULT_BRANDING`, `parseBranding`, `brandingVars` stay.)

- [ ] **Step 1: Write the failing test**

Create `tests/branding.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  contrastRatio,
  contrastVsWhite,
  mixSrgb,
  derivedForeground,
  PRESETS,
} from "../src/lib/branding"

describe("contrastRatio", () => {
  it("white vs black is ~21", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0)
  })
  it("is order-independent", () => {
    expect(contrastRatio("#6F4E37", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#6F4E37"), 5)
  })
  it("same colour is 1", () => {
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5)
  })
})

describe("contrastVsWhite", () => {
  it("returns 0 for malformed hex", () => {
    expect(contrastVsWhite("nope")).toBe(0)
  })
})

describe("mixSrgb", () => {
  it("weight 1 returns a", () => {
    expect(mixSrgb("#102030", "#ffffff", 1)).toBe("#102030")
  })
  it("weight 0 returns b", () => {
    expect(mixSrgb("#102030", "#ffffff", 0)).toBe("#ffffff")
  })
  it("midpoint averages channels", () => {
    expect(mixSrgb("#000000", "#ffffff", 0.5)).toBe("#808080")
  })
})

describe("PRESETS accessibility", () => {
  it("has at least 5 presets with unique ids", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5)
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length)
  })
  for (const p of PRESETS) {
    it(`${p.id}: primary is AA vs white button text`, () => {
      expect(contrastVsWhite(p.primary)).toBeGreaterThanOrEqual(4.5)
    })
    it(`${p.id}: body text is AA on the background`, () => {
      expect(contrastRatio(derivedForeground(p.primary), p.background)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/branding.test.ts`
Expected: FAIL — `contrastRatio`, `mixSrgb`, `derivedForeground`, `PRESETS` are not exported yet.

- [ ] **Step 3: Implement the helpers and presets**

In `src/lib/branding.ts`, add (keep the existing `DEFAULT_BRANDING`, `parseBranding`, `brandingVars`):

```ts
function channels(hex: string): [number, number, number] {
  const c = hex.replace("#", "")
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
}

function relLuminance(hex: string): number {
  const lin = channels(hex).map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

/** WCAG contrast ratio between two hex colours (order-independent), 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a)
  const lb = relLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Contrast of a colour against white (customer buttons use near-white text). */
export function contrastVsWhite(hex: string): number {
  const c = hex.replace("#", "")
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return 0
  return contrastRatio(`#${c}`, "#ffffff")
}

/** Linear sRGB mix of two hex colours; `weight` is the share of `a` (0–1). */
export function mixSrgb(a: string, b: string, weight: number): string {
  const ca = channels(a)
  const cb = channels(b)
  const mixed = ca.map((v, i) => Math.round((v * weight + cb[i] * (1 - weight)) * 255))
  return "#" + mixed.map((n) => n.toString(16).padStart(2, "0")).join("")
}

/** The dark, brand-tinted body-text colour the customer theme derives from
 *  primary — mirrors the CSS: color-mix(in srgb, primary 35%, #1a1a1a). */
export function derivedForeground(primary: string): string {
  return mixSrgb(primary, "#1a1a1a", 0.35)
}

export type Preset = {
  id: string
  label: string
  primary: string
  accent: string
  background: string
}

/** Ready-made, AA-validated palettes (guarded by tests/branding.test.ts).
 *  Light backgrounds only — the customer theme uses dark text. */
export const PRESETS: Preset[] = [
  { id: "latte", label: "Latte Glass", primary: "#6F4E37", accent: "#D89A7E", background: "#F6EBDF" },
  { id: "kupa", label: "Kupa Green", primary: "#1D6F4C", accent: "#C08A2D", background: "#F6F4EF" },
  { id: "travo", label: "Travo Purple", primary: "#5B3FC7", accent: "#A78BFA", background: "#F4F1FF" },
  { id: "bite", label: "Bite Bold", primary: "#C8102E", accent: "#F0A500", background: "#FFFFFF" },
  { id: "slate", label: "Slate Classic", primary: "#334155", accent: "#3B82F6", background: "#F8FAFC" },
]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/branding.test.ts`
Expected: PASS. If any `${id}: primary is AA` or `body text is AA` case fails, adjust that preset's `primary` darker (or `background` lighter) until it passes — do not weaken the `4.5` threshold.

- [ ] **Step 5: Commit**

```bash
git add src/lib/branding.ts tests/branding.test.ts
git commit -m "feat(branding): AA-validated palette presets + contrast helpers"
```

---

### Task 2: Derive `.theme-latte` surface tints from the brand colours

**Files:**
- Modify: `src/app/globals.css` (the `.theme-latte` block, currently lines ~130–157)

**Interfaces:**
- Consumes: `--brand-primary`, `--brand-accent`, `--brand-bg` (set inline by `brandingVars`).
- Produces: a customer theme whose card/secondary/muted/accent/border/foreground tokens all derive from the three brand colours, so any palette looks coherent.

- [ ] **Step 1: Replace the `.theme-latte` token derivations**

In `src/app/globals.css`, replace the body of `.theme-latte` (keep the `--brand-*` defaults and the font/radius lines) so the tokens derive from the brand vars:

```css
.theme-latte {
  --brand-primary: #6f4e37;
  --brand-accent: #d89a7e;
  --brand-bg: #f6ebdf;

  --background: var(--brand-bg);
  --foreground: color-mix(in srgb, var(--brand-primary) 35%, #1a1a1a);
  --card: color-mix(in srgb, var(--brand-bg), white 30%);
  --card-foreground: var(--foreground);
  --popover: color-mix(in srgb, var(--brand-bg), white 45%);
  --popover-foreground: var(--foreground);
  --primary: var(--brand-primary);
  --primary-foreground: #fdfcfa;
  --secondary: color-mix(in srgb, var(--brand-accent) 18%, transparent);
  --secondary-foreground: var(--foreground);
  --muted: color-mix(in srgb, var(--brand-primary) 8%, transparent);
  --muted-foreground: color-mix(in srgb, var(--brand-primary) 55%, #6b6b6b);
  --accent: color-mix(in srgb, var(--brand-accent) 22%, transparent);
  --accent-foreground: var(--foreground);
  --destructive: #b3261e;
  --border: color-mix(in srgb, var(--brand-primary) 15%, transparent);
  --input: color-mix(in srgb, var(--brand-primary) 25%, transparent);
  --ring: var(--brand-accent);
  --radius: 1.25rem;

  --app-font-sans: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  --app-font-heading: var(--font-fraunces), Georgia, serif;
}
```

- [ ] **Step 2: Verify the build compiles the CSS**

Run: `npm run build`
Expected: PASS (build succeeds; no CSS parse errors). The default Latte palette is preserved because the `--brand-*` defaults are unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(branding): derive customer theme tints from brand colours"
```

---

### Task 3: Palette chooser + fine-tune + live preview in `ShopProfile`

**Files:**
- Modify: `src/components/dashboard/shop-profile.tsx`
- Modify: `src/app/dashboard/profile/page.tsx`
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `PRESETS`, `contrastVsWhite`, `contrastRatio`, `derivedForeground`, `brandingVars` from `@/lib/branding` (Task 1); the reworked `.theme-latte` (Task 2).
- Produces: `ShopProfile` props change from `initialColour` to `initialPrimary` / `initialAccent` / `initialBackground`.

- [ ] **Step 1: Add the i18n keys**

In `src/lib/i18n.ts`, remove the now-unused `"profile.brandColour"` and `"profile.brandColourHint"` keys, and add:

```ts
  "profile.palette": "Colour palette",
  "profile.paletteHint": "Pick a look or fine-tune your colours — this is what customers see.",
  "profile.primary": "Primary",
  "profile.accent": "Accent",
  "profile.background": "Background",
  "profile.preview": "Preview",
  "profile.bgContrastWarning": "Background is too dark for the text — pick a lighter background.",
```

Keep `"profile.contrastWarning"` (reused for the primary check).

- [ ] **Step 2: Rewrite `ShopProfile`**

Replace the entire contents of `src/components/dashboard/shop-profile.tsx`:

```tsx
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
```

- [ ] **Step 3: Update the profile page to pass the three colours**

In `src/app/dashboard/profile/page.tsx`, replace the `<ShopProfile ... />` usage's colour prop:

```tsx
      <ShopProfile
        shopId={shop.id}
        initialName={shop.name}
        initialTagline={branding.tagline ?? ""}
        initialPrimary={branding.primary ?? DEFAULT_BRANDING.primary}
        initialAccent={branding.accent ?? DEFAULT_BRANDING.accent}
        initialBackground={branding.background ?? DEFAULT_BRANDING.background}
        initialLogoUrl={branding.logo_url ?? null}
      />
```

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS — no type errors (props line up), production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/shop-profile.tsx src/app/dashboard/profile/page.tsx src/lib/i18n.ts
git commit -m "feat(branding): palette chooser + fine-tune + live preview"
```

---

### Task 4: PWA manifest uses the shop background

**Files:**
- Modify: `src/app/[slug]/manifest.webmanifest/route.ts`

**Interfaces:**
- Consumes: `parseBranding(...).background`.

- [ ] **Step 1: Use `background` for `background_color`**

In `src/app/[slug]/manifest.webmanifest/route.ts`, change the manifest's `background_color` line:

```ts
    background_color: b.background ?? DEFAULT_BRANDING.background,
```

(Leave `theme_color: b.primary ?? b.accent ?? DEFAULT_BRANDING.primary` as-is.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[slug]/manifest.webmanifest/route.ts"
git commit -m "feat(branding): PWA splash background follows shop palette"
```

---

### Task 5: Manual verification (deploy gate)

**Files:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS (including `tests/branding.test.ts`).

- [ ] **Step 2: Manual palette check (after deploy to a preview/prod)**

For a test shop at `/dashboard/profile`:
1. Click each preset → the live preview recolours; the "Add" button text stays readable on every preset.
2. Fine-tune the primary to a very light colour (e.g. `#EEEEEE`) → the primary warning shows and Save is disabled.
3. Set a valid preset, Save, open `/[slug]` → cards, borders, buttons, and highlights all match the palette (no leftover terracotta on a non-Latte palette).
4. Install the PWA → the app icon is the shop logo and the splash/theme colour matches the palette.

Expected: coherent, readable branding across the customer page and installed PWA.

---

## Notes for the implementer

- `color-mix()` output is used both in CSS (Task 2) and mirrored in JS for the contrast test (`derivedForeground`, Task 1). Keep the `#1a1a1a` constant and `35%` weight identical in both places — if you change one, change the other, or the test no longer reflects what renders.
- The preview panel gets its own `.theme-latte` class plus inline `--brand-*` vars, so it renders the selected palette independently of the dashboard's `.theme-travo` wrapper.
- Do not lower the `4.5` AA threshold to make a preset pass — adjust the preset colour instead.
