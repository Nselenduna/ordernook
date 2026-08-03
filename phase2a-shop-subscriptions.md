# OrderNook — Phase 2A: Shop Subscriptions (Stripe Billing) — design spec

**Date:** 2 August 2026 · **Status:** Approved, ready for implementation plan
**Reference:** BookOnTheMap's Stripe Billing scaffolding (`/api/stripe/checkout`, `/portal`, `/webhook`, `lib/stripe.ts`, `PlanCard`, `LockScreen`) — code pattern only.
**Stripe account:** a **dedicated OrderNook account** under the Zizwe IT org (one Stripe account per app — NOT BookOnTheMap's). Lloyd creates it; the Basic product/price + all keys live there. (An earlier Basic product mistakenly created in the BookOnTheMap account was archived.)

## 1. Goal
Turn OrderNook's live product into a paying one: shops get a **30-day free trial**, then must subscribe to **Basic £12/mo** (Stripe Billing) to keep taking orders. Unpaid → dashboard locked + public ordering paused. This is OrderNook's revenue engine. (Pro tier + online customer payments are Phase 2B.)

## 2. Money flow
Plain Stripe **Billing** — NOT Connect. Each shop is a Stripe **Customer** subscribed to the Basic recurring price; OrderNook's platform account collects. No Connect, no application fees, no per-order money.

## 3. Plans (2A scope)
- **Basic — £12/mo** (GBP). The only sellable plan in 2A. Product + recurring price to be created **in the dedicated OrderNook Stripe account** (live + test modes); the live price id goes in `STRIPE_BASIC_PRICE_ID`.
- **Pro — £25/mo** shown as **"coming soon"** (not sellable) — goes live with 2B (online customer payments). No Pro Stripe price yet.

## 4. Entitlement rule
A shop is **entitled** (unlocked) iff:
- `subscription_status = 'active'`, OR
- `subscription_status = 'trialing'` AND `trial_ends_at` is in the future.

Anything else (`past_due`, `canceled`, `unpaid`, or `trialing` past `trial_ends_at`) → **not entitled** → locked. Computed by a single helper `is_entitled(shop)` used everywhere (DB function + a TS mirror).

## 5. Data model
Most fields exist (Phase 0): `stripe_subscription_id`, `subscription_status`, `plan_tier`, `payment_modes`. **Migration adds:**
- `shops.stripe_customer_id text` — the Stripe Customer for Billing.
- `shops.trial_ends_at timestamptz` — default `now() + interval '30 days'` on new shops; **backfill existing shops** to `created_at + interval '30 days'`, then **set the two live pilots (`corner-grind`, `pilot-test`) to a far-future date** (e.g. `2027-01-01`) so they don't lock on ship.
- A SQL helper `public.is_entitled(p_shop_id uuid) returns boolean` implementing §4, plus `create_order` gated on it.

## 6. Stripe setup (in the dedicated OrderNook account)
- **Create the OrderNook account** under Zizwe IT (Lloyd, via the Stripe account switcher → Create account). One account per app.
- **Live** (production): create the "OrderNook Basic" product + £12/mo GBP recurring price in that account's live mode.
- **Test** (verification): create the same product/price in that account's **test/sandbox** mode (test cards; no real charge).
- Either Lloyd creates these in the dashboard, or the Stripe MCP is reconnected to the OrderNook account (it's currently bound to BookOnTheMap) and re-runs the create.
- The price id is read from `STRIPE_BASIC_PRICE_ID` so test/prod each point at their own price.
- **Webhook endpoint** registered in that account (test + live) → gives the signing secret.

## 7. Environment (Lloyd — secrets)
- `STRIPE_SECRET_KEY` — server only (test key in dev/preview, live key in prod). **Secret; Lloyd sets in `.env.local` + Vercel.**
- `STRIPE_WEBHOOK_SECRET` — from the registered webhook endpoint. **Secret; Lloyd/deploy sets.**
- `STRIPE_BASIC_PRICE_ID` — the Basic price id for the active mode (from the OrderNook account: its live price in prod, its test price in dev/preview). Not secret.
- `NEXT_PUBLIC_APP_URL` (or reuse existing) for Checkout/Portal return URLs.

## 8. Routes (reuse BookOnTheMap, adapted)
- **`POST /api/stripe/checkout`** — auth staff; ensure the shop has a Stripe Customer (create + store `stripe_customer_id` if missing); create a Checkout Session `mode: "subscription"` for `STRIPE_BASIC_PRICE_ID`, `customer`, success/cancel URLs → return the URL. Client redirects.
- **`POST /api/stripe/portal`** — auth staff; Billing Customer Portal session for the shop's customer → return URL (manage card / cancel).
- **`POST /api/stripe/webhook`** — verify signature (`STRIPE_WEBHOOK_SECRET`); handle `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed` → update `shops.subscription_status`, `stripe_subscription_id`, `stripe_customer_id`, and `plan_tier` (basic). Uses the **service-role** Supabase client (webhook is unauthenticated by a user; verified by Stripe signature). `runtime = "nodejs"`.
- **`src/lib/stripe.ts`** — shared Stripe client (`new Stripe(process.env.STRIPE_SECRET_KEY!)`).

## 9. Enforcement (server-verified, two surfaces)
- **Dashboard:** a `LockScreen` gate in the dashboard layout — if the staff's shop is not entitled, render a full-screen "Your free trial has ended — subscribe to keep taking orders" with a **Subscribe** button (→ `/api/stripe/checkout`). All dashboard tabs blocked behind it. (The Settings `PlanCard` remains reachable so they can subscribe/manage.)
- **Public page (`/[slug]`):** if the shop is not entitled, ordering is **paused** — reuse the existing paused UI/state (menu visible, "not taking orders right now"). Do NOT take the page down.
- **`create_order` (DB function):** reject with a clear error if `not is_entitled(shop)` — server-side backstop so a locked shop can't be ordered from even if the client is bypassed.

## 10. Dashboard UI
- **`PlanCard`** in Settings: current plan (Basic/trial), `subscription_status`, **trial days remaining**, and a **Subscribe** (trialing/lapsed) or **Manage billing** (active → Portal) button. Pro shown as a disabled "coming soon" row.

## 11. Security / conventions
- Webhook signature verified; only the webhook (service role) writes billing fields. Staff can read their shop's billing fields (RLS unchanged — `shops` is staff-scoped for these columns).
- No secret keys in client code or `NEXT_PUBLIC_*`. All Stripe server calls in route handlers (`runtime = "nodejs"`).
- Money in minor units; GBP.

## 12. Verification (Stripe TEST mode)
1. With test keys + test Basic price + a test webhook (Stripe CLI `stripe listen` or a test endpoint): subscribe a test shop via Checkout (card `4242…`) → webhook flips `subscription_status → active` → dashboard unlocks.
2. Set a test shop's `trial_ends_at` to the past → confirm dashboard locks + public page shows paused + `create_order` rejects.
3. Cancel via Portal → `customer.subscription.deleted` → status `canceled` → locks again.
4. `npm run build` clean; RLS/entitlement covered by a test where practical.

## 13. Out of scope
Pro tier, Stripe Connect, online customer payments (all **2B**); annual/other intervals; proration UI; dunning emails (Stripe retries handle it); multi-shop staff; tax/VAT handling beyond Stripe defaults.

## 14. Open questions
None. (Test-mode price + Stripe secret/webhook keys are known Lloyd dependencies, not design questions.)
