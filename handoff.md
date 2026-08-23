# handoff.md — OrderNook (last verified: 23 Aug 2026)

## TL;DR — where we are
- **Phase 2A subscriptions** — LIVE in production, self-healing (reconcile-on-return + live Stripe webhook).
- **Slice 4 self-serve registration** — SHIPPED & LIVE at `ordernook.uk/dashboard/register`.
- **Phase 2B customer online payments** — **SHIPPED, LIVE, AND PROVEN WITH REAL MONEY (12 Aug 2026).** `corner-grind` completed Connect onboarding, took a genuine £2.80 card charge, was rejected, and auto-refunded. Every link in the chain is verified, not just deployed.
- **Shop order alerts (push-to-staff)** — Tasks 1–5 built and reviewed on `feat/shop-order-alerts` (pushed to origin 23 Aug). **Task 6 — deploy + prove on a real iPhone — not started.** This is the last unfinished build work.
- **Legal pages** — `/terms` and `/privacy` written on `feat/legal-pages`; footer repointed off the `zizweit.uk` soft-404s.

> **Doc-drift warning (the lesson from 11 Aug).** This file previously said Phase 2B was "NOT deployed" for over a week after it had actually shipped, which sent a later session chasing a problem that did not exist. **Trust git and Vercel over this file.** If they disagree, this file is the one that is wrong — fix it in the same sitting.

## ▶ IMMEDIATE NEXT ACTION
The product has no gaps against the sales pitch. What is left is distribution — see `roadmap.md` and `walk-in-kit.md`. The one piece of unfinished engineering is **Task 6 of the order-alerts plan** (`docs/superpowers/plans/2026-08-11-shop-order-alerts.md`), which needs a real iPhone and two secrets in Vercel; without it a shop with the dashboard tab closed silently misses orders, which the walk-in pitch promises will not happen.

## Project
`C:\Users\lloyd\OneDrive\Desktop\Projexts 2025\OrderNook\order-ahead`
- Repo Nselenduna/ordernook · Live ordernook.uk (Vercel `order-ahead`) · deploy `vercel --prod --yes`
- Supabase **iryavyogljedwgllaoit** (Zizwe org, Pro) — single project = prod; migrations applied via MCP during dev.
- **Dedicated OrderNook Stripe account `acct_1U0RkqDeO3cMpMIL`** (separate account per app — Lloyd's rule).
- Design: Travo Purple (dashboard) + Latte Glass (customer). Sentry project `ordernook`.

## What's LIVE in production
- **Phase 2A subscriptions** — Basic £12/mo, 30-day trial → hard lock. Reconcile (`src/lib/billing.ts`) + live webhook (`/api/stripe/webhook`, endpoint `we_1U0hYp…`, 5 events). Confirm-email is OFF (required for instant registration).
- **Slice 4 registration** — `/dashboard/register` → `register_shop` RPC → shop on a 30-day trial. Auth proxy (`src/proxy.ts`) exempts `/dashboard/register` + `/dashboard/login`.

## Phase 2B detail (SHIPPED — live and proven 12 Aug 2026)
- **2B-1 onboarding** — `/api/stripe/connect/{start,callback,disconnect}`. **NOTE: the original Standard OAuth version described here was abandoned** — the OrderNook platform account is on Stripe's Accounts v2 regime, which force-redirects `/oauth/authorize` to `/oauth/v2/authorize` and rejects the classic `ca_` client id. It was rebuilt on **Account Links** (`accounts.create` + `accountLinks.create`, helpers in `src/lib/connect.ts`, migration `20260808120000_stripe_charges_enabled.sql`), and that is what is live. `set_online_payments` RPC + `enforce_online_requires_account` trigger gate the "Accept online orders" toggle; the toggle is additionally gated on `charges_enabled`. Settings "Online payments" card has three states (Set up / Finish setup / Ready).
- **2B-2a pay-online** — `create_order(p_payment_mode)` → online = `pending_payment` (hidden from shop). `/api/stripe/checkout-order` = Checkout Session ON the connected account (direct charge, **zero commission**, no application_fee). Reconcile-on-return in `/order/[token]` (now a server page + `order-status-client.tsx`) + `/api/stripe/connect-webhook` backup flip → `new`. Customer picks pay-now / pay-on-collection.
- **2B-2b auto-refund** — `/api/stripe/refund-order` (staff-authed): rejecting a PAID online order → full refund on the connected account (idempotency key `refund-<id>`, status re-verify + affected-row guard) → status `refunded`; else `rejected`. `protect_order_terminal_status` trigger blocks direct client refunded/rejected writes. Auto-refund is ONLY shop-reject-of-paid; returns/disputes/goodwill = shop's own Stripe.
- Docs: `phase2b-connect-onboarding.md`, `phase2b-customer-payments.md`, `phase2b2a-*-plan.md`, `phase2b2b-*-plan.md`.

## Key migrations (all applied to the DB)
`20260802010000_shop_subscriptions` · `20260802020000_protect_billing_columns` · `20260804140000_register_shop` · `20260804160000_set_online_payments` · `20260805120000_create_order_payment_mode` · `20260806120000_protect_order_terminal_status`.

## Test accounts / fixtures (.env.test, gitignored)
- SHOP_A = corner-grind `owner@cornergrind.test` / `OrderNook-CG-r7Qx-2607` (has orders/menu; tests self-provision + clear its stripe_account_id/payment_modes).
- SHOP_B = pilot-test `owner@pilot-test.test` / `PilotTest-Demo1!` (no account).
- REGISTER_TEST = `register-test@ordernook.test` (no shop — keep shopless for guard tests). `SUPABASE_SERVICE_ROLE_KEY` in .env.test lets tests self-provision.
- corner-grind + pilot-test have a hand-set `trial_ends_at=2027-01-01` (demo convenience — that's why they show ~150 days; REAL new shops get exactly 30 days).
- `signUp` rejects `.test` emails (use a real domain for signup E2E; SQL-seeded users bypass it).

## Gotchas
- **`vitest` runs files serially** (`fileParallelism:false`) — integration tests share one live Supabase + mutate shared shop fixtures; parallel races/flakes. Occasional cross-file flake is transient (re-run).
- `stripe login` restricted key can READ webhooks but NOT create them → create webhooks in the Dashboard.
- `vercel env pull` returns EMPTY for sensitive vars — set prod secrets in the Vercel dashboard/CLI + redeploy.
- supabase-js storage.upload: pass a `Blob`, not a Node Buffer (undici on Vercel corrupts binary).
- PWA dev: after dev restart, unregister SW + clear caches or stale chunks persist.

## Open follow-ups
- **Deploy Phase 2B** (the immediate next action above).
- Non-blocking hardening deferred during 2B review (see the phase docs / git): Sentry logging on Stripe routes; a Connect-webhook integration test; refund-route race integration test; cosmetic stepper/`?connect=` URL cleanup.
- Flagged earlier: make the DASHBOARD installable as a PWA (only customer `/[slug]` installs today).
- **Phase 2B billing-model note:** online payments are zero-commission (shops keep 100%); OrderNook monetizes via the £12/mo subscription only.
