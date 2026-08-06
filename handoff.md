# handoff.md — OrderNook (session end: 6 Aug 2026)

## TL;DR — where we are
- **Phase 2A subscriptions** — LIVE in production, self-healing (reconcile-on-return + live Stripe webhook).
- **Slice 4 self-serve registration** — SHIPPED & LIVE at `ordernook.uk/dashboard/register`.
- **Phase 2B customer online payments** — fully BUILT, reviewed, and MERGED to `master`; **NOT deployed** (held so the whole stack ships together after one live run-through + live-mode Stripe config).

## ▶ IMMEDIATE NEXT ACTION — ship Phase 2B
Do these three, then `vercel --prod --yes` (ships the whole online-payments stack):

**1. One live run-through** (real browser — the automation browser can't complete Stripe's hosted pages):
- A shop → Settings → **Connect Stripe** (test mode) → complete the test connection.
- Place an order → **Pay online now** → pay with test card `4242 4242 4242 4242` → order lands in the shop's dashboard as paid.
- **Reject** that paid order → Stripe shows a full refund + order reads "Refunded".

**2. Live-mode Stripe config** (dev used TEST values; they won't work in prod):
- `STRIPE_CONNECT_CLIENT_ID` = the **live** `ca_…` (OrderNook Stripe → Connect → OAuth, **live** mode) → set in Vercel prod.
  (Test client id used in dev: `ca_V0Srb6UlU42OKo9QbRuYVKzoOqqVZ8RO` — DO NOT use in prod.)
- Register `https://ordernook.uk/api/stripe/connect/callback` in **live**-mode Connect redirects.
- Create a **Connect webhook** (event `checkout.session.completed` on connected accounts) → `STRIPE_CONNECT_WEBHOOK_SECRET` in Vercel prod. (Reconcile-on-return is primary; webhook is the backup.)
- Confirm `NEXT_PUBLIC_APP_URL=https://ordernook.uk` in Vercel prod (routes now require it).

**3. Deploy:** `vercel --prod --yes`. Migrations are already in the DB (single project), so this ships the frontend.

## Project
`C:\Users\lloyd\OneDrive\Desktop\Projexts 2025\OrderNook\order-ahead`
- Repo Nselenduna/ordernook · Live ordernook.uk (Vercel `order-ahead`) · deploy `vercel --prod --yes`
- Supabase **iryavyogljedwgllaoit** (Zizwe org, Pro) — single project = prod; migrations applied via MCP during dev.
- **Dedicated OrderNook Stripe account `acct_1U0RkqDeO3cMpMIL`** (separate account per app — Lloyd's rule).
- Design: Travo Purple (dashboard) + Latte Glass (customer). Sentry project `ordernook`.

## What's LIVE in production
- **Phase 2A subscriptions** — Basic £12/mo, 30-day trial → hard lock. Reconcile (`src/lib/billing.ts`) + live webhook (`/api/stripe/webhook`, endpoint `we_1U0hYp…`, 5 events). Confirm-email is OFF (required for instant registration).
- **Slice 4 registration** — `/dashboard/register` → `register_shop` RPC → shop on a 30-day trial. Auth proxy (`src/proxy.ts`) exempts `/dashboard/register` + `/dashboard/login`.

## Phase 2B detail (built, merged, NOT deployed)
- **2B-1 onboarding** — `/api/stripe/connect/{start,callback,disconnect}` (Standard OAuth, CSRF state cookie, account stored via admin client). `set_online_payments` RPC + `enforce_online_requires_account` trigger gate the "Accept online orders" toggle. Settings "Online payments" card.
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
