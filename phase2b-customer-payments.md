# Phase 2B · Part 2 — Customer Online Payments + Auto-Refund (design)

**Date:** 2026-08-05
**Status:** Design draft — for review → implementation plan
**Depends on:** 2B-1 (shop Connect onboarding — merged). **Ships with:** 2B-1 (deploy the pair together).

## Goal
Let a customer pay for their order online at checkout — full amount, hosted Stripe Checkout,
charged directly on the shop's connected Stripe account (zero commission). A paid order enters
the shop's queue; if the shop rejects/cancels a paid order, OrderNook auto-refunds it in full.

## Decisions (settled in the 2B brainstorm)
- **Zero commission** — direct charges on the shop's connected account (`Stripe-Account` header),
  no `application_fee`. Money and Stripe fees are the shop's.
- **Full prepay** — one PaymentIntent for the whole order.
- **Customer chooses** — at checkout, "Pay online now" or "Pay when I collect".
- **Hosted Stripe Checkout** (redirect), reusing the subscription reconcile-on-return pattern.
- **Auto-refund is narrow** — fires only when the shop **rejects/cancels a paid online order**
  (full refund, system-triggered). Returns after collection, disputes/chargebacks, and
  goodwill/partial refunds are the shop's own job in their Stripe dashboard (Standard Connect).

## Order lifecycle (the spine)
The `order_status` enum already has `pending_payment` and `refunded`, and `orders.stripe_payment_intent_id`
exists — the schema was built for this.

- **Pay on collection** → `create_order(mode=in_store)` → status `new` → shop queue. (Unchanged from today.)
- **Pay online** → `create_order(mode=online)` → status **`pending_payment`** (NOT shown to the shop)
  → hosted Checkout on the connected account → on paid, status flips to **`new`** (enters the queue)
  with `stripe_payment_intent_id` stored.
- **Reject/cancel a paid online order** → refund the PaymentIntent on the connected account →
  status **`refunded`** (+ reject reason). Customer sees "refunded".

## Data layer

### `create_order` — add a payment-mode parameter
Current: `create_order(p_shop_slug, p_customer_name, p_customer_phone, p_items jsonb) returns jsonb`,
SECURITY DEFINER, creates a `new` order and returns `{ order_id, token, number, total_minor, ... }`.
Change to `create_order(p_shop_slug, p_customer_name, p_customer_phone, p_items jsonb, p_payment_mode text default 'in_store')`:
- Validate `p_payment_mode` ∈ the shop's `payment_modes` (reject `payment_mode_unavailable` otherwise).
- `in_store` → status `new`, `payment_mode = 'in_store'` (today's behavior).
- `online` → status `pending_payment`, `payment_mode = 'online'`; the shop must have a
  `stripe_account_id` (else `online_not_configured`). The order is created but invisible to the shop.
- Returns the same jsonb (must include `token` and `total_minor` — the checkout route needs the amount).
- Keep the existing entitlement gate (`is_entitled`) and all price recomputation.

### Dashboard must exclude `pending_payment`
The dashboard order list must not show unpaid `pending_payment` orders (they aren't real orders yet).
The tab filters (`new/in progress/ready/done`) already exclude it; ensure the "All" tab and the base
query also exclude `pending_payment` so an abandoned unpaid cart never appears in the shop's queue.

### No new columns required
`orders.stripe_payment_intent_id` (exists) holds the PaymentIntent once paid. The Checkout Session id
is passed back via the success URL (below), so no `stripe_checkout_session_id` column is needed.

## Customer flow

### Checkout sheet (`src/components/shop/checkout-sheet.tsx`)
If the shop has `online` in `payment_modes`, show a payment-method choice before "Place order":
- **Pay when I collect** → `create_order(mode=in_store)` → go to `/order/{token}` (today's path).
- **Pay online now** → `create_order(mode=online)` → returns `{ order_id, token, total_minor }` →
  `POST /api/stripe/checkout-order { order_id, token }` → returns a Checkout `url` → `window.location = url`.
  Cart is cleared only after the order row exists (create_order succeeded), so a failed payment leaves
  a recoverable `pending_payment` order, not a lost cart.
If the shop has only `in_store`, checkout is unchanged (no choice shown).

### `POST /api/stripe/checkout-order` (route handler, nodejs) — creates the Checkout Session
Guest (unauthenticated) flow, so the **order `token`** is the authorization (it's a server-generated
secret returned by `create_order`).
1. Load the order + its shop (admin client). Reject unless: order exists, status `pending_payment`,
   `payment_mode = 'online'`, the token matches, and the shop has a `stripe_account_id`.
2. Guard the amount ≥ Stripe minimum (£0.30) → else `amount_too_low`.
3. Create a Checkout Session **on the connected account** (`{ stripeAccount: shop.stripe_account_id }`),
   `mode: "payment"`, a single line item for the order total (shop currency), NO `application_fee`,
   `metadata: { order_id }`, `success_url: {site}/order/{token}?session_id={CHECKOUT_SESSION_ID}`,
   `cancel_url: {site}/{shop_slug}`.
4. Return `{ url: session.url }`.

### Reconcile on return — `/order/[token]` (existing customer status page, server component)
On `?session_id=…`, before rendering: retrieve the Checkout Session on the connected account
(`stripe.checkout.sessions.retrieve(session_id, { stripeAccount })`, account looked up from the order's
shop). If `payment_status === "paid"` and the order is still `pending_payment`: flip it to `new` and
store `stripe_payment_intent_id` (admin client). Best-effort, idempotent (a webhook may have already
done it). Then render the status page as normal — the customer sees "waiting for the shop to accept".

### Connect webhook (reliability backup)
`checkout.session.completed` fires on the **connected account**; the platform receives it as a Connect
event (with an `account` field). Extend the existing `/api/stripe/webhook` (or add a Connect endpoint)
to handle it: look up the order by `metadata.order_id`, and if `pending_payment`, flip to `new` +
store the PaymentIntent — same idempotent write as the reconcile. This covers the case where the
customer closes the tab before the redirect completes. (Requires a Connect webhook signing secret +
enabling the event — a manual Stripe setup step, like the subscription webhook.)

## Auto-refund (shop rejects/cancels a paid order)

### `POST /api/orders/reject` (route handler, nodejs, staff-authed) — the refund path
Today the dashboard rejects via a direct client `.update({ status: 'rejected', reject_reason })`
(`dashboard-shell.tsx:186`). A refund needs the Stripe secret + connected account, so paid online
orders must route through the server:
1. `getStaffShop()`; verify the order belongs to the caller's shop.
2. If `payment_mode = 'online'` AND `stripe_payment_intent_id` is set (i.e. paid): create a full
   refund on the connected account (`stripe.refunds.create({ payment_intent }, { stripeAccount })`)
   → set status `refunded` + `reject_reason` (admin client).
3. Otherwise (in_store, or online-but-not-yet-paid): set status `rejected` + reason.
4. Return the new status.

### Dashboard wiring
In `dashboard-shell.tsx`, the reject handler calls `POST /api/orders/reject` (instead of the direct
`.update`) when the order is `payment_mode === 'online'` and paid; the in_store path may stay a direct
update, or route through the same endpoint for consistency (preferred — one code path, and the server
enforces ownership). Accept/preparing/ready/collected transitions stay direct client updates (no money).

### Order-card + customer status display
Dashboard order-card already renders `payment_mode`; add a "Paid online" badge for online orders and a
"Refunded" state. The customer `/order/[token]` page shows `refunded` with the reason (i18n keys exist:
`dash.status.refunded`, and add customer-facing `order.status.refunded` / `order.refunded.*`).

## Error handling (customer-facing, all via t())
| Case | Handling |
|------|----------|
| shop not configured for online (no account) | option hidden; `create_order(online)` → `online_not_configured` guard |
| amount below Stripe minimum | checkout-order → `amount_too_low` → friendly message, offer pay-on-collection |
| Checkout session creation fails | error toast; the `pending_payment` order remains (recoverable/abandoned) |
| customer cancels on Stripe | `cancel_url` → back to the shop page; order stays `pending_payment` (abandoned) |
| payment succeeds but reconcile lags | webhook backup flips it; status page polls/refreshes |

## Test plan
### RPC / DB (vitest)
- `create_order(mode=online)` on a shop with online enabled → status `pending_payment`, payment_mode
  `online`, returns token + total.
- `create_order(mode=online)` on a shop WITHOUT online in payment_modes → `payment_mode_unavailable`.
- `create_order(mode=online)` on a shop with online but no `stripe_account_id` → `online_not_configured`.
- `create_order(mode=in_store)` → unchanged (`new`).
- Dashboard query excludes `pending_payment` (a pending order is not visible to staff).

### Routes / integration (Stripe test mode, a connected test account)
- checkout-order: valid pending online order → returns a `checkout.stripe.com` URL on the connected
  account; wrong token / non-pending / no-account → rejected.
- Full pay-online round-trip with test card 4242 → order flips `pending_payment → new`, PaymentIntent
  stored, customer status page shows "waiting to accept".
- Reject a paid online order from the dashboard → Stripe shows a full refund on the connected account,
  order status `refunded`, customer page shows refunded.
- Reject an in_store order → `rejected`, no Stripe call.

### Acceptance criteria
- A customer at a Connect-enabled shop can pay online and their paid order reaches the shop queue.
- Pay-on-collection still works unchanged.
- Rejecting a paid order refunds the customer in full automatically; rejecting an unpaid/in_store order does not.
- Unpaid `pending_payment` orders never appear in the shop's queue.
- Zero commission — no `application_fee` anywhere.
- `npm run build` + test suite pass.

## Out of scope (follow-ups)
- Partial refunds, returns-after-collection, disputes/chargebacks (shop's own Stripe).
- Abandoned `pending_payment` cleanup job (they sit invisible; Checkout sessions expire in 24h). Note only.
- Saved cards / faster repeat checkout.
- Tips.

## Possible decomposition (decide at plan time)
2B-2 is larger than 2B-1. If it's too big for one plan, split: **2B-2a** = customer pay-online +
order lifecycle + reconcile (the money-in half), then **2B-2b** = auto-refund (the money-back half,
which depends on 2B-2a). Refund can't be tested without a real online payment, so 2B-2a comes first.
