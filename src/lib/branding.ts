import type { CSSProperties } from "react"
import type { Json } from "@/lib/database.types"
import type { Branding } from "@/lib/types"

/** Latte Glass defaults — used when a shop hasn't set a branding value. */
export const DEFAULT_BRANDING: Required<
  Pick<Branding, "primary" | "accent" | "background">
> = {
  primary: "#6F4E37",
  accent: "#D89A7E",
  background: "#F6EBDF",
}

/** Safely read the shops.branding jsonb into a typed object. */
export function parseBranding(json: Json | null | undefined): Branding {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {}
  const raw = json as Record<string, Json | undefined>
  const str = (v: Json | undefined) => (typeof v === "string" ? v : undefined)
  return {
    primary: str(raw.primary),
    accent: str(raw.accent),
    background: str(raw.background),
    tagline: str(raw.tagline),
    logo_url: str(raw.logo_url),
  }
}

/**
 * Tenant colours as CSS variables. The .theme-latte class (globals.css) maps
 * --brand-* onto the shadcn tokens, so setting these on a wrapper re-skins
 * every component inside it. Portalled content (sheets/dialogs) renders
 * outside the wrapper, so pass these vars to popup content too.
 */
export function brandingVars(branding: Branding): CSSProperties {
  return {
    "--brand-primary": branding.primary ?? DEFAULT_BRANDING.primary,
    "--brand-accent": branding.accent ?? DEFAULT_BRANDING.accent,
    "--brand-bg": branding.background ?? DEFAULT_BRANDING.background,
  } as CSSProperties
}

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
