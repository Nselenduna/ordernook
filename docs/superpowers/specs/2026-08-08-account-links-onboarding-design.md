# OrderNook shop onboarding via Stripe Account Links — Design

**Date:** 2026-08-08
**Status:** Approved
**Supersedes:** classic Standard OAuth onboarding (broken — the platform `acct_1U0RkqDeO3cMpMIL` is on Stripe's Accounts v2 regime, which force-redirects `/oauth/authorize` → `/oauth/v2/authorize` and rejects the classic `ca_` client id with "No application matches the supplied client identifier").

## Goal
Let a café connect a Stripe account so OrderNook can take **direct-charge, zero-commission** online payments on the café's behalf — using Stripe's recommended **Connect Onboarding / Account Links** instead of the deprecated OAuth flow.

## Model (unchanged from the OAuth design)
- Account type: **Standard** (`type: 'standard'`). Café gets their own full Stripe dashboard, café pays Stripe's fees, café is liable, Stripe collects requirements.
- Payments stay **direct charges** on the connected account (`checkout.sessions.create` with `stripeAccount: shop.stripe_account_id`, **no** `application_fee`). OrderNook takes zero commission.
- `checkout-order`, `refund-order`, `create_order`, and the customer checkout UI are **untouched** — they already key off `stripe_account_id`.

## Scope of change
Swap only the onboarding *mechanism* inside the existing three routes, and add a "can this account actually charge?" gate. Same route names, same `OnlinePaymentsCard`, same payment/refund code.

## 1. Data model (one migration)
- Add column `shops.stripe_charges_enabled boolean not null default false`.
- Strengthen the existing `enforce_online_requires_account` trigger: enabling `"online"` in `payment_modes` now requires **both** `stripe_account_id IS NOT NULL` **and** `stripe_charges_enabled = true`.
- `getStaffShop` selects `shops(*)`, so the new column flows through with no query change.

## 2. Route: `connect/start` (create + link)
- Auth via `getStaffShop()` (redirects to login if no session), same as today.
- If shop has no `stripe_account_id`: `accounts.create({ type: 'standard', country: 'GB' })`, then persist the `acct_` immediately (so a retry never creates a duplicate account).
- **Auto-heal stale/test account:** if a `stripe_account_id` already exists, attempt to use it; if `accounts.retrieve` fails (e.g. corner-grind's test `acct_1TT6AF…` under the live key, or a livemode mismatch), null it and create a fresh live Standard account. This removes the need for any manual DB cleanup.
- `accountLinks.create({ account, type: 'account_onboarding', refresh_url: ${APP_URL}/api/stripe/connect/start, return_url: ${APP_URL}/api/stripe/connect/callback })` → redirect the café to `accountLink.url`.
- Remove the OAuth `onbd_state` cookie logic (Account Links don't use it).
- Still hard-fails if `NEXT_PUBLIC_APP_URL` is unset.

## 3. Route: `connect/callback` (verify)
- `getStaffShop()`; `accounts.retrieve(shop.stripe_account_id)`.
- Write `stripe_charges_enabled = account.charges_enabled`.
- Redirect: `connect=success` when charges enabled, `connect=pending` when onboarding isn't complete yet.
- No more OAuth token exchange / state-cookie check.

## 4. Connect webhook (`connect-webhook`) — add `account.updated`
- Keep the existing `checkout.session.completed` handling.
- Add `account.updated`: for the connected account (`event.account`), update the matching shop's `stripe_charges_enabled = account.charges_enabled`.
- **If charges become false**, also remove `"online"` from that shop's `payment_modes`, so customers are never offered online pay on an account that can't charge.
- Operational: add the `account.updated` event to the existing Connected-accounts webhook destination in the Stripe Dashboard.

## 5. UI: `OnlinePaymentsCard` — three states
Derived from `stripe_account_id` + `stripe_charges_enabled`:
1. **No account** → "Set up payments" button → `/api/stripe/connect/start`.
2. **Account exists, charges not enabled** → "Finish setup" button (re-runs `start`, which issues a fresh account link) + a "Verification pending" note.
3. **Charges enabled** → "Ready" + online toggle (`set_online_payments` RPC, unchanged) + disconnect (unchanged).

`disconnect` stays as-is but also resets `stripe_charges_enabled = false` (it already clears `stripe_account_id` and removes `"online"`).

## 6. Error handling
- `start`: account-create / account-link failures → redirect to settings with `connect=error`.
- `callback`: retrieve failure → `connect=error`; never leaves the shop showing "ready" without a positive `charges_enabled`.
- Webhook: signature-verified (existing `STRIPE_CONNECT_WEBHOOK_SECRET`); unknown/mismatched accounts logged and ignored (existing pattern).

## 7. Testing
- Trigger: rejects enabling `"online"` when `stripe_charges_enabled = false`; allows when true.
- Webhook: `account.updated` with `charges_enabled=false` clears the flag **and** removes `"online"` from `payment_modes`.
- `start` auto-heal: an invalid stored `stripe_account_id` results in a new account rather than an error.
- Manual live run-through: Set up payments → complete Stripe onboarding → return → status "Ready" → toggle online on → place order → pay with real card → shop rejects → auto-refund fires.

## Out of scope
- No change to billing (Phase 2A subscriptions), customer checkout, refunds, or `create_order`.
- No migration of the deprecated OAuth routes' *names* — they're reused.

## Risks / notes
- `type: 'standard'` must be accepted by the account's default API version (`2026-07-29.dahlia`). If the pinned version rejects `type` in favour of controller properties, use the Standard-equivalent controller block: `controller: { stripe_dashboard: { type: 'full' }, fees: { payer: 'account' }, losses: { payments: 'stripe' }, requirement_collection: 'stripe' }`.
- A café that already has a Stripe account can still sign into it during the hosted onboarding; platform-created Standard accounts don't force a brand-new business entity.
