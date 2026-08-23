# roadmap.md — OrderNook

## Zero-to-Revenue Roadmap (added 11 Aug 2026, corrected 12 Aug 2026)

**Reality check:** product is feature-complete through **Phase 2B** (not just 2A as first thought). Verified 12 Aug directly against git + Vercel, not against the project's own docs: all Connect commits (onboarding, checkout-order, refund-order, connect-webhook) are merged to `master` and **deployed to production**; `STRIPE_CONNECT_CLIENT_ID` + `STRIPE_CONNECT_WEBHOOK_SECRET` are set in Vercel production (added ~8 Aug). The single-£12-tier landing copy (payments folded into Basic) was a deliberate pricing simplification (commit `ead609f`), not a bug — no Pro/Basic split exists in code anymore, and the copy matches that on purpose.

**⚠️ Docs vs. reality gap (fix when convenient, not urgent):** `state.md` and `handoff.md` both still say Phase 2B is "built, merged, NOT deployed" — that's stale from the 3-6 Aug sessions and was never updated after the actual ship. This is exactly why the 11 Aug version of this roadmap wrongly flagged a "live copy is ahead of product" problem — it doesn't exist. Update state.md/handoff.md to reflect Phase 2B as shipped so this doesn't happen again.

Zero real paying shops either way — only `corner-grind` and `pilot-test`, both Lloyd's own pilots on extended trial. **This was never a build problem; it's purely distribution now.**

**RESOLVED 12 Aug 2026 — Phase 2B fully proven live with real money.** `corner-grind` completed Stripe Connect onboarding, "Accept online orders" switched on, and a genuine end-to-end test ran on production: customer checkout offered "Pay online now" → real £2.80 charge captured, showed "Paid online" on the dashboard → rejected → **auto-refunded**, showed "Refunded". Every link in the Phase 2B chain (onboarding → toggle → checkout → capture → reject → refund) is now verified working, not just deployed. `pilot-test` still hasn't gone through this — low priority, `corner-grind` alone is enough to demo to real shops.

- [x] ~~Turn online payments on for corner-grind~~ — done, live-tested with a real transaction + refund (12 Aug).
- [ ] **First real, non-pilot paying shop.** Walk into 2-3 local shops (café, sandwich place, food stall) with the pilot demo live on your phone — once corner-grind's online payments are on, the full pitch (zero commission, pay in-store or online) is demonstrable, not just promised. Target: 1 shop signed up to the 30-day trial this week.
- [ ] Convert that trial shop to paying at day 30 — check in around day 25-28, don't just wait for the trial to lapse silently.
- [ ] Repeat to 3-5 paying shops before touching new features. Each one is a chance to find the real onboarding friction a non-Lloyd shop owner hits.
- [ ] Tidy state.md/handoff.md to say Phase 2B is shipped (5-minute doc fix, do it in the same sitting as the next real update so it doesn't drift again).

**Weekly budget: 2-3 hrs.** Highest-priority of the three revenue products — shortest path to a first real pound because the pitch (community-native, walk-in) is the one Lloyd's already good at, and the product now has zero gaps against that pitch.

---

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
- 2 Aug 2026: **Slice 2c (item photos) SHIPPED** — pushed + deployed to production (ordernook.uk). New `menu-photos` bucket + RLS, sharp upload route, item-form photo picker, customer card thumbnail + item-sheet hero. Full suite 29 passing. **Slice 2 (2a/2b/2c) complete — Phase 1 shop tools done bar self-serve registration (Slice 4).**

- 2 Aug 2026: **Sentry LIVE (Phase A)** — @sentry/nextjs client+server+edge, project `ordernook` (zizweit org), PII off, no replay. Verified on prod. Source maps (Phase B) pending SENTRY_AUTH_TOKEN in Vercel. Specs: `sentry-integration.md` (+ `-plan.md`).

- 3 Aug 2026: **Phase 2A (shop subscriptions) SHIPPED** — Stripe Billing, Basic £12/mo, 30-day trial then hard lock; dedicated OrderNook Stripe account. Live on ordernook.uk. Specs: `phase2a-shop-subscriptions.md` (+ `-plan.md`).

## Next
- **Phase 2B** — customer online payments (Stripe Connect Standard, direct charges; the Pro-tier differentiator). Reuse BookOnTheMap Connect scaffolding.
- Optional: run one real £12 live subscription (test card in live is a real charge) to fully prove prod, then refund.

## Later / open
- Before writing landing/marketing copy: run the AUDIENCE.md 4-question interview → audience.md.
- Open: Sentry DSN, wallet legal check (Phase 3).
