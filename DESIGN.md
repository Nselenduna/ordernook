# DESIGN.md — OrderNook

Template decision (11 Jul 2026): **Mix — Travo Purple (shop dashboard) + Latte Glass (customer PWA default theme)**.
Customer PWA colours are overridden per shop via `shops.branding` jsonb; Latte Glass is the fallback/default.

## Customer PWA — Latte Glass (default, overridable per tenant)
- Background: #F6EBDF (cream) · Card: #FBF4EA at ~80% opacity with blur (glassmorphism)
- Accent: #D89A7E (terracotta) · Deep: #6F4E37 (coffee brown) · Text: #4A3728
- Type: Fraunces (display headings) + DM Sans (body)
- Shape: 20–24px radius, soft diffused shadows (0 8px 30px rgba(111,78,55,.12)), frosted-glass panels
- Rules: everything warm and soft — no pure white, no pure black, no hard edges.
- Tenant override: `branding.primary` → deep colour, `branding.accent` → accent, `branding.background` → background, applied as CSS variables in the shop layout.

## Shop dashboard — Travo Purple
- Primary: #7B61FF (violet) · Background: #F4F1FF (lavender tint) · Card: #FFFFFF
- Text: #1E1B39 · Muted: #8C89A6 · Chips/tags: #EDEBFF with primary text
- Type: Plus Jakarta Sans (headings) + Inter (body)
- Shape: 16px radius, white cards on tinted background, light shadow (0 4px 16px rgba(123,97,255,.10))
- Rules: violet for primary actions/highlights only; list-heavy layouts; clear card hierarchy.
- Order status colours: new = violet, accepted/preparing = amber #F59E0B, ready = green #16A34A, collected = muted, rejected = red #DC2626.

## Global rules
- Mobile-first, thumb-reachable primary CTA, one primary action per screen.
- Minimum touch target 44px; WCAG AA contrast.
- 8pt spacing grid (8/16/24/32). Pill/rounded-rect buttons, never sharp corners.
