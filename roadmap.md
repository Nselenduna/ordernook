# roadmap.md — Order-Ahead

- **Phase 0 — validate the loop** ← CURRENT. Scaffold, schema+RLS, test shop, menu→cart→pay-in-store order→live dashboard queue→status flow→ready push, PWA basics. No Stripe.
- **Phase 1 — self-serve shops:** registration, country config, menu editor, branding + dynamic manifest, QR generation (print PDF), subdomain routing, shop settings. Phases 0–1 = sellable Basic tier.
- **Phase 2 — money:** Stripe Connect (Standard, direct charges, deferred prefilled onboarding), Checkout pay-at-order, refunds, Stripe Billing 2 tiers + suspension, sales summary.
- **Phase 3 — growth:** wallet (after legal sign-off, per-shop closed loop only), pickup slots, SMS fallback (Twilio), loyalty, staff roles, analytics, second country.
- **Pilot:** 2–3 local shops on Phase 1–2, free, weekly feedback.

## Done
- 11 Jul 2026: Supabase project created (eu-west-2), full schema + RLS + order functions applied and smoke-tested, test shop seeded, Next.js scaffold, design tokens locked (Travo dashboard + Latte customer).

## Next
- Build customer flow + dashboard + PWA (Phase 0 items 3–6 in requirements.md).
- Before Phase 1 marketing copy: run the AUDIENCE.md 4-question interview → generate audience.md.
- Open: product name/domain (placeholder "Order-Ahead"), Sentry DSN, wallet legal check.
