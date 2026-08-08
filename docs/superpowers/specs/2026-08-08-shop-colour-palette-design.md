# Shop Colour Palette (presets + fine-tune) — Design

**Date:** 2026-08-08
**Status:** Approved
**Goal:** Let a shop owner give their customer-facing OrderNook page a coherent colour identity — pick a ready-made palette or fine-tune three colours — so the ordering page and installable PWA feel owned by the shop, not by OrderNook.

## Scope
Customer-facing branding only: the `/[slug]` ordering page, the customer menu UI, and the per-shop PWA manifest. The shop **dashboard** admin theme (`theme-travo`) is unchanged. No font or shape/template switching. No dark backgrounds in v1 (the customer theme uses fixed dark text).

## Current state (what exists)
- `shops.branding` jsonb already holds `{ primary, accent, background, tagline, logo_url }` and is consumed by `brandingVars()` → `--brand-primary/accent/bg` CSS variables, mapped onto shadcn tokens by `.theme-latte` (`globals.css`).
- The profile UI (`ShopProfile`, `/dashboard/profile`) exposes only **one** colour (it writes `primary` = `accent` = that colour) plus logo + tagline. `background` is never set.
- In `.theme-latte`, only `--brand-primary` (buttons), `--brand-bg` (background), and `--brand-accent` (focus ring only) respond to the shop. `--card`, `--secondary`, `--muted`, `--accent` surfaces are **hard-coded terracotta** — so a non-brown palette looks incoherent today.
- Logo upload already works end-to-end (`/api/branding/logo` → `branding.logo_url`, shown on the menu page header + used as the PWA/apple-touch icon).

## The change

### 1. Data model
Reuse `shops.branding` jsonb — `primary`, `accent`, `background` (all already typed in `Branding`). **No migration.** All three are light-safe hex strings.

### 2. Presets (light backgrounds, pre-validated for WCAG AA)
Add a `PRESETS` array (pure data in `src/lib/branding.ts`): `{ id, label, primary, accent, background }`. ~5 palettes derived from DESIGN.md, each with a `primary` that passes ≥4.5 contrast against near-white button text and a light `background`:

| id | label | primary | accent | background |
|----|-------|---------|--------|------------|
| `latte` | Latte Glass | `#6F4E37` | `#D89A7E` | `#F6EBDF` |
| `kupa` | Kupa Green | `#1D6F4C` | `#C08A2D` | `#F6F4EF` |
| `travo` | Travo Purple | `#5B3FC7` | `#A78BFA` | `#F4F1FF` |
| `bite` | Bite Bold | `#C8102E` | `#F0A500` | `#FFFFFF` |
| `slate` | Slate Classic | `#334155` | `#3B82F6` | `#F8FAFC` |

(Travo's primary is a deepened violet vs DESIGN.md's `#7B61FF` so white button text passes AA; exact hexes are finalised by the contrast test in §6, which is the source of truth — any preset that fails the test must be adjusted, not shipped.)

### 3. Theme coherence (core change) — `globals.css` `.theme-latte`
Derive the surface tints from the brand colours instead of hard-coding terracotta, using CSS `color-mix()`, so any palette looks cohesive across cards, chips, borders, and highlights:
- `--primary: var(--brand-primary)`, `--primary-foreground` stays near-white.
- `--foreground: color-mix(in srgb, var(--brand-primary) 35%, #1a1a1a)` — a very dark brand-tinted text that reads on any light background (verified by the background contrast guard).
- `--card: color-mix(in srgb, var(--brand-bg), white 30%)` (keep the frosted feel via existing opacity).
- `--secondary: color-mix(in srgb, var(--brand-accent) 18%, transparent)`; `--secondary-foreground: var(--foreground)`.
- `--muted: color-mix(in srgb, var(--brand-primary) 8%, transparent)`; `--muted-foreground: color-mix(in srgb, var(--brand-primary) 55%, #6b6b6b)`.
- `--accent: color-mix(in srgb, var(--brand-accent) 22%, transparent)`; `--accent-foreground: var(--foreground)`.
- `--border: color-mix(in srgb, var(--brand-primary) 15%, transparent)`; `--input: color-mix(in srgb, var(--brand-primary) 25%, transparent)`; `--ring: var(--brand-accent)`.
- Fonts/shape/radius unchanged.

The `--brand-*` defaults in `.theme-latte` stay as Latte Glass, so a shop that never customises is unaffected.

### 4. Profile UI — `ShopProfile` (`/dashboard/profile`)
Replace the single colour picker with:
- **Preset chooser:** a row of ~5 swatch cards (each shows its primary/accent/bg). Clicking one sets all three working colours.
- **Fine-tune:** three `<input type="color">` controls (primary, accent, background), pre-filled from the current values; editing any one puts the form in a "custom" state.
- **Live preview:** a small panel wrapped in `theme-latte` with the current colours applied inline via `brandingVars`, showing a sample menu-item card and an "Add" pill button + the three swatches — updates instantly as they pick/tweak, before saving.
- **Contrast guards (block save on fail, reuse the existing toast pattern):**
  - `primary` vs near-white button text ≥ 4.5 (reuse existing check).
  - `background` vs the derived dark `foreground` ≥ 4.5 (new — protects fine-tuned backgrounds).
  - `accent` is not used for text (ring + low-opacity tints only), so it has **no** contrast gate — keeps it free for expressive highlights.
- **Save:** read-merge-write into `branding` (preserve `logo_url`), writing `primary`, `accent`, `background`, `tagline`, `name`.

### 5. Consumers
- `[slug]/page.tsx` + `menu-page.tsx` already apply `theme-latte` + `brandingVars` → the fuller palette flows through with no change.
- **PWA manifest** (`[slug]/manifest.webmanifest/route.ts`): set `background_color` from `branding.background` (falling back to `DEFAULT_BRANDING.background`); keep `theme_color = primary`. So the installed app's splash matches the shop.

### 6. Testing
- **Unit (`tests/branding.test.ts`, pure):** extract the contrast helper into `src/lib/branding.ts` and assert, for **every** preset: `primary` passes ≥4.5 vs white, and `background` passes ≥4.5 vs the derived dark foreground. This locks palette accessibility into CI — a bad preset fails the build.
- **Manual:** apply each preset → view `/[slug]` and install the PWA → confirm cards/buttons/borders are coherent and text is readable; fine-tune to a too-light primary → confirm save is blocked.

### 7. Files touched
- Create: `tests/branding.test.ts`
- Modify: `src/lib/branding.ts` (add `PRESETS`, extract contrast util), `src/app/globals.css` (`.theme-latte` derivations), `src/components/dashboard/shop-profile.tsx` (chooser + fine-tune + preview + guards), `src/app/dashboard/profile/page.tsx` (pass initial primary/accent/background), `src/app/[slug]/manifest.webmanifest/route.ts` (background_color), `src/lib/i18n.ts` (preset labels + UI strings).

## Out of scope (YAGNI)
Font/shape template switching; dark-background palettes; theming the admin dashboard; a migration (the jsonb already fits).

## Risks / notes
- `color-mix()` is broadly supported in current evergreen browsers and the app's PWA target; acceptable.
- Presets must pass the §6 contrast test — the table hexes are the intent, the test is the gate. Adjust any failing hex before merge rather than shipping an inaccessible preset.
- Accent carries no text, so it is intentionally ungated; if a future change puts text on accent, add a guard then.
