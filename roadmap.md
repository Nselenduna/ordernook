# roadmap.md — OrderNook

- **Phase 0 — validate the loop** ← CURRENT. Scaffold, schema+RLS, test shop, menu→cart→pay-in-store order→live dashboard queue→status flow→ready push, PWA basics. No Stripe.
- **Phase 1 — shop tools (lean pilot-first):** Lloyd hand-onboards 2–3 pilot shops; build the tools they use daily. Sliced:
  - **Slice 1 — Go-Live Kit** ← NEXT (see `phase1-go-live-kit.md`): sold-out toggle, accepting-orders/pause toggle, prep time, QR/link + print poster, allergens (schema + customer display), repeatable pilot seed script. Hours kept simple (no 7-day schedule).
  - Slice 2 — full menu editor (CRUD, options, photos, allergen editing).
  - Slice 3 — per-shop branding + dynamic manifest.
  - Slice 4 — self-serve registration + onboarding wizard.
  - Deferred: 7-day hours, subdomain routing (path-based `ordernook.uk/{slug}` until Pro-plan wildcard), multi-country. Phases 0–1 = sellable Basic tier.
- **Phase 2 — money:** Stripe Connect (Standard, direct charges, deferred prefilled onboarding), Checkout pay-at-order, refunds, Stripe Billing 2 tiers + suspension, sales summary.
- **Phase 3 — growth:** wallet (after legal sign-off, per-shop closed loop only), pickup slots, SMS fallback (Twilio), loyalty, staff roles, analytics, second country.
- **Pilot:** 2–3 local shops on Phase 1–2, free, weekly feedback.

## Done
- 11 Jul 2026: Supabase project created (eu-west-2), full schema + RLS + order functions applied and smoke-tested, test shop seeded, Next.js scaffold, design tokens locked (Travo dashboard + Latte customer).
- 11 Jul 2026: **Phase 0 complete and validated** — full app built, browser-verified, and tested end-to-end on Pixel 6 (order → realtime dashboard → statuses → collected, installed PWA).
- 26 Jul 2026: Schema exported to `supabase/migrations/` (5 baseline migrations, local↔remote in sync); Supabase project moved to Zizwe org, Pro tier.
- 26 Jul 2026: **Deployed to Vercel** (project `lloydmgutshini-projects/order-ahead`). Live over HTTPS at https://order-ahead-omega.vercel.app/corner-grind — menu renders from Supabase, no console errors. Env vars (Supabase + VAPID) set for production + preview. First deploy landed as production (no users/custom domain yet).
- 26 Jul 2026: **Slices 1, 3, 2a SHIPPED** to production (ordernook.uk) — Go-Live Kit, Shop Profile & Branding, Menu Editor (items & categories). See state.md.
- 1 Aug 2026: **Slice 2b (option groups & options editor) SHIPPED** — pushed (3760386) + deployed to production (ordernook.uk). UI-only; full suite 27 passing. Specs: `phase1-slice2b-options-editor.md` (+ `-plan.md`).

## Next
- **Slice 2c** — item photos (reuse Slice 3 Storage + sharp pipeline).
- Then **Phase 2** — payments (Stripe Connect, direct charges; reuse BookOnTheMap scaffolding).

## Later / open
- Before writing landing/marketing copy: run the AUDIENCE.md 4-question interview → audience.md.
- Open: Sentry DSN, wallet legal check (Phase 3).
