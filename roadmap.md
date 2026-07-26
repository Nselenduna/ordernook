# roadmap.md — OrderNook

- **Phase 0 — validate the loop** ← CURRENT. Scaffold, schema+RLS, test shop, menu→cart→pay-in-store order→live dashboard queue→status flow→ready push, PWA basics. No Stripe.
- **Phase 1 — self-serve shops:** registration, country config, menu editor, branding + dynamic manifest, QR generation (print PDF), subdomain routing, shop settings. Phases 0–1 = sellable Basic tier.
- **Phase 2 — money:** Stripe Connect (Standard, direct charges, deferred prefilled onboarding), Checkout pay-at-order, refunds, Stripe Billing 2 tiers + suspension, sales summary.
- **Phase 3 — growth:** wallet (after legal sign-off, per-shop closed loop only), pickup slots, SMS fallback (Twilio), loyalty, staff roles, analytics, second country.
- **Pilot:** 2–3 local shops on Phase 1–2, free, weekly feedback.

## Done
- 11 Jul 2026: Supabase project created (eu-west-2), full schema + RLS + order functions applied and smoke-tested, test shop seeded, Next.js scaffold, design tokens locked (Travo dashboard + Latte customer).
- 11 Jul 2026: **Phase 0 complete and validated** — full app built, browser-verified, and tested end-to-end on Pixel 6 (order → realtime dashboard → statuses → collected, installed PWA).
- 26 Jul 2026: Schema exported to `supabase/migrations/` (5 baseline migrations, local↔remote in sync); Supabase project moved to Zizwe org, Pro tier.
- 26 Jul 2026: **Deployed to Vercel** (project `lloydmgutshini-projects/order-ahead`). Live over HTTPS at https://order-ahead-omega.vercel.app/corner-grind — menu renders from Supabase, no console errors. Env vars (Supabase + VAPID) set for production + preview. First deploy landed as production (no users/custom domain yet).

## Next (Phase 1)
- **iPhone test** (now unblocked by HTTPS): install PWA from https://order-ahead-omega.vercel.app/corner-grind on a real iPhone (iOS 16.4+), place an order, confirm "order ready" web push works when installed to home screen. This is the one assumption that can invalidate the product mechanics.
- Shop registration + onboarding, menu editor, branding + dynamic per-shop manifest, QR code generation (print PDF), routing per shop (path-based until domain bought, then subdomains), shop settings (hours/prep/pause).
- Before writing landing/marketing copy: run the AUDIENCE.md 4-question interview → audience.md.
- Name chosen (26 Jul 2026): **OrderNook** — reserve `ordernook.uk`. Still open: Sentry DSN, wallet legal check.
