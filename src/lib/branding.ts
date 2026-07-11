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
