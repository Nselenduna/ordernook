# Phase 2B · Part 1 — Shop Stripe Connect Onboarding (design)

**Date:** 2026-08-04
**Status:** Design approved (flow), ready for spec review → implementation plan
**Depends on:** nothing. **Blocks:** 2B-2 (customer online payments).

## Goal
Let a shop connect its own Stripe account (Stripe Connect **Standard**) so it can receive
online order payments directly, and turn "accept online orders" on/off. No customer payment
flow yet — that is 2B-2. After this ships, a shop can connect and toggle online, but customers
still only see pay-on-collection until 2B-2 lands.

## Why
Online payments require the shop to have a connected Stripe account (`shops.stripe_account_id`)
before any charge can be created on it. Onboarding is the prerequisite half of 2B and is
cleanly separable, testable, and shippable on its own.

## Decisions (from the 2B brainstorm)
- **Standard Connect** (OAuth): shop connects/creates their own Stripe account; they own the
  Stripe dashboard, payouts, and disputes; OrderNook carries minimal liability.
- **Zero commission**: direct charges later (2B-2) with no `application_fee`. Nothing fee-related
  is built here.
- Reuses the proven Connect pattern from BookOnTheMap (adapted; that code isn't in this repo).

## Required setup step (manual, one-time — not code)
On the **OrderNook** Stripe account (`acct_1U0RkqDeO3cMpMIL`):
1. Enable **Connect** (Dashboard → Connect → Get started; platform profile).
2. Note the **Connect client ID** (`ca_...`) from Connect → Settings.
3. Register the OAuth **redirect URI**: `https://ordernook.uk/api/stripe/connect/callback`
   (and `http://localhost:3000/api/stripe/connect/callback` for dev).
4. Set env vars (Vercel prod + `.env.local`): `STRIPE_CONNECT_CLIENT_ID=ca_...`.
   `STRIPE_SECRET_KEY` (already set) is used for the token exchange.

## Data layer
- **`shops.stripe_account_id`** (text, exists) holds the connected account id (`acct_...`). It is a
  **billing-protected column** (the `protect_shop_billing` trigger blocks authenticated/anon
  writes), so it is written **only via the service-role admin client** in the callback route —
  same pattern as `stripe_customer_id` in the subscription flow.
- **`shops.payment_modes`** (`payment_mode[]`, default `{in_store}`) is **not** billing-protected,
  so the authed shop can update it via the normal client under the `shops_staff_update` RLS
  policy. But enabling `online` must require a connected account — enforced by a small
  `SECURITY DEFINER` RPC:
  ```
  set_online_payments(p_enabled boolean) returns shops
  ```
  - `p_enabled = true`: raise `no_stripe_account` if `stripe_account_id is null`; else ensure
    `online` is in `payment_modes` (add if missing), keep `in_store`.
  - `p_enabled = false`: remove `online` from `payment_modes` (keep `in_store`).
  - Scopes to the caller's own shop via `staff_users` (like other dashboard writes); grant to
    `authenticated`.
- No new tables. New migration `phase2b_connect_onboarding.sql` = the `set_online_payments` RPC
  (+ grant).

## Backend — OAuth routes (Next Route Handlers, `runtime = "nodejs"`)

### `GET /api/stripe/connect/start`
1. Resolve the authed staff shop (`getStaffShop`); 401 if none.
2. Generate a random `state` token; set it in a short-lived **httpOnly** cookie
   (`onbd_state`, ~10 min) so the callback can verify CSRF.
3. Build the Standard OAuth URL and redirect (302):
   `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=<CONNECT_CLIENT_ID>`
   `&scope=read_write&state=<state>&redirect_uri=<site>/api/stripe/connect/callback`
   (Stripe prefills the shop's business name/email if available.)

### `GET /api/stripe/connect/callback`
1. Read `code` + `state` from the query; read `onbd_state` cookie. If `state` missing/mismatched
   → redirect to `/dashboard/settings?connect=error`. Handle Stripe's `error=access_denied`
   (user cancelled) → redirect `?connect=cancelled`.
2. Resolve the authed staff shop again (the callback carries the user's session cookies); 401/redirect
   to login if none — ties the connected account to the right shop, not just whoever holds `state`.
3. Exchange the code: `stripe.oauth.token({ grant_type: "authorization_code", code })` →
   `stripe_user_id` (the connected `acct_...`).
4. Write `stripe_account_id = stripe_user_id` on the shop via the **admin client** (billing-protected).
5. Clear the `onbd_state` cookie; redirect to `/dashboard/settings?connect=success`.

## Frontend — dashboard Settings "Online payments" card
A new card in `/dashboard/settings` (Travo Purple), below the existing Plan card:
- **Not connected** (`stripe_account_id` null): short blurb ("Let customers pay by card when they
  order — money goes straight to your Stripe, zero commission") + **Connect Stripe** button →
  `GET /api/stripe/connect/start`.
- **Connected** (`stripe_account_id` set): "Connected ✓" + a toggle **Accept online orders**
  bound to whether `online` ∈ `payment_modes`, calling `set_online_payments`. Plus a subtle
  **Disconnect** action (see below).
- Reads the `?connect=success|error|cancelled` query param on load and shows a toast.

### Disconnect
"Disconnect" → confirm → `POST /api/stripe/connect/disconnect` (authed route, `runtime=nodejs`):
resolves the staff shop, then via the **admin client** (a) removes `online` from `payment_modes`
and (b) clears `stripe_account_id`. Both must be the admin client because `stripe_account_id` is
billing-protected — a `SECURITY DEFINER` RPC would **not** work: the trigger checks `auth.role()`,
which stays `authenticated` even inside `SECURITY DEFINER`, so it would still block the write.
Only `service_role` passes the trigger. Disconnect does **not** deauthorize on Stripe's side (the
shop keeps their account); copy notes they can revoke OrderNook's access from their own Stripe
dashboard. (`stripe.oauth.deauthorize` is a possible later enhancement, out of scope here.)

## Error handling
| Case | Handling |
|------|----------|
| `start` with no shop | 401 → redirect to `/dashboard/login` |
| user cancels on Stripe (`access_denied`) | `?connect=cancelled` → info toast, no change |
| bad/absent `state` | `?connect=error` → error toast, no write |
| token exchange fails | `?connect=error` → error toast; nothing stored |
| toggle online with no account | RPC `no_stripe_account` → inline "Connect Stripe first" |

## Test plan
### RPC (vitest against the DB, `.env.test` accounts)
- `set_online_payments(true)` on a shop **with** `stripe_account_id` → `payment_modes` contains
  `online` (and still `in_store`).
- `set_online_payments(true)` on a shop **without** an account → raises `no_stripe_account`;
  `payment_modes` unchanged.
- `set_online_payments(false)` → `online` removed, `in_store` kept.
- Cross-tenant: user A cannot toggle shop B (scoped to own shop).
- `disconnect_stripe()` clears `stripe_account_id` for the caller's shop only.

### Routes (integration / manual)
- `/api/stripe/connect/start` unauthenticated → redirects to login; authed → 302 to
  `connect.stripe.com/oauth/authorize` with the right `client_id`, `scope=read_write`, `state`,
  `redirect_uri`.
- Full OAuth round-trip in Stripe **test mode** with a test Standard account → callback stores a
  `acct_...` on the shop → Settings shows "Connected ✓".
- Callback with mismatched `state` → no write, error toast.
- Toggle **Accept online orders** on a connected shop → `payment_modes` gains `online`
  (verify in DB); toggle off → removed.
- Disconnect → `stripe_account_id` cleared, toggle disabled again.

### Acceptance criteria
- A shop owner can connect a Stripe account from Settings and see "Connected ✓".
- `online` cannot be enabled without a connected account (server-enforced).
- `stripe_account_id` is only ever written server-side via the admin client (billing-protected).
- CSRF-protected OAuth; a connected account is tied to the authed shop.
- `npm run build` + test suite pass. No customer-facing payment change (that's 2B-2).

## Out of scope (→ 2B-2 or later)
- Any customer payment / checkout change, PaymentIntents, direct charges, refunds.
- `application_fee` / commission (design is zero-commission).
- Deauthorizing the account on Stripe's side on disconnect.
- Connect account status/health display (payouts enabled, requirements due) — a nice later add;
  MVP just needs a stored account id.
