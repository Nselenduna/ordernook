# Phase 2B-2a — Customer Pay-Online (money-in) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A customer at a Connect-enabled shop can pay for their order online (full amount, hosted Stripe Checkout charged directly on the shop's connected account); the paid order enters the shop queue. Pay-on-collection unchanged. (Auto-refund is 2B-2b.)

**Architecture:** `create_order` gains a `payment_mode` param; `online` orders are created `pending_payment` (invisible to the shop). A token-authorized route creates a Checkout Session on the shop's connected account (zero commission). On return, the order status page reconciles the session and flips the order to `new`; a Connect webhook is the reliability backup.

**Tech Stack:** Supabase Postgres RPC, Next route handlers (nodejs), Stripe Node SDK (Checkout + Connect direct charges via `stripeAccount`), the customer PWA (checkout-sheet, order status page), vitest.

## Global Constraints
- **Zero commission** — direct charges on the connected account (`{ stripeAccount: shop.stripe_account_id }`), NO `application_fee` anywhere.
- **`online` requires** the shop to have `online` ∈ `payment_modes` AND a `stripe_account_id` (both already enforceable; `create_order` must re-check).
- **Unpaid `pending_payment` orders must never appear in the shop dashboard.**
- **Guest checkout** — the customer isn't authenticated; the order `token` (server secret from `create_order`) authorizes the checkout-order route.
- **Money-critical writes** (flip to paid, store PaymentIntent) go through the service-role admin client and must be **idempotent** (reconcile + webhook may both fire).
- All customer strings via `t()`. Reuse `getStripe()`, `createAdminClient()`, `NEXT_PUBLIC_APP_URL` (required, no localhost fallback — see 2B-1).

## Prerequisites (manual, for the live E2E in Task 5 — not for building)
- A **test connected account** to pay into (the Connect OAuth flow from 2B-1 creates one).
- For the webhook backup: a **Connect webhook** endpoint + signing secret (`STRIPE_CONNECT_WEBHOOK_SECRET`) with `checkout.session.completed` enabled on connected accounts. Reconcile-on-return works without it; the webhook is reliability only.

## File Structure
- `supabase/migrations/<ts>_create_order_payment_mode.sql` (create) — `create_order` overload + dashboard exclusion.
- `tests/create-order-online.test.ts` (create) — RPC tests.
- `src/app/api/stripe/checkout-order/route.ts` (create) — Checkout Session on connected account.
- `src/components/shop/checkout-sheet.tsx` (modify) — payment-method choice + pay-now branch.
- `src/app/order/[token]/page.tsx` (modify) — reconcile-on-return.
- `src/app/api/stripe/connect-webhook/route.ts` (create) — Connect webhook backup.
- `src/lib/i18n.ts` (modify) — `cart.pay*` / `order.*` keys.

---

### Task 1: `create_order` payment mode + `pending_payment` lifecycle + dashboard exclusion

**Files:**
- Create: `supabase/migrations/<timestamp>_create_order_payment_mode.sql` (timestamp after `20260804160000`)
- Create: `tests/create-order-online.test.ts`

**Interfaces:**
- Produces `create_order(p_shop_slug text, p_customer_name text, p_customer_phone text, p_items jsonb, p_payment_mode text default 'in_store') returns jsonb`. New raises: `payment_mode_unavailable`, `online_not_configured`. Returned jsonb still includes `token` and the order total (`total_minor`).

- [ ] **Step 1: Write the failing test**

Create `tests/create-order-online.test.ts`. It signs in as SHOP_A (corner-grind) owner only to provision state via the admin client; the RPC itself is called anonymously (guest checkout — `create_order` is granted to anon/authenticated as today). Provision corner-grind with online enabled + a fake account in `beforeAll` (admin, service-role) and clear in `afterAll`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.test" })
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const guest = () => createClient(url, anon)

// A known corner-grind menu item id is needed for a valid cart. Resolve it at runtime.
let itemId: string

async function firstItem(): Promise<string> {
  const { data } = await admin.from("menu_items").select("id").eq("is_available", true).limit(1).single()
  return (data as { id: string }).id
}

describe("create_order payment_mode", () => {
  beforeAll(async () => {
    itemId = await firstItem()
    await admin.from("shops").update({ stripe_account_id: "acct_test_connect", payment_modes: ["in_store", "online"] }).eq("slug", "corner-grind")
  })
  afterAll(async () => {
    await admin.from("shops").update({ stripe_account_id: null, payment_modes: ["in_store"] }).eq("slug", "corner-grind")
    await admin.from("orders").delete().eq("customer_name", "PMode Test")
  })

  it("online order is created pending_payment with a token + total", async () => {
    const { data, error } = await guest().rpc("create_order", {
      p_shop_slug: "corner-grind", p_customer_name: "PMode Test", p_customer_phone: null,
      p_items: [{ item_id: itemId, qty: 1, option_ids: [] }], p_payment_mode: "online",
    })
    expect(error).toBeNull()
    const o = data as { order_id: string; token: string; total_minor: number; status?: string }
    expect(o.token).toBeTruthy()
    expect(o.total_minor).toBeGreaterThan(0)
    const { data: row } = await admin.from("orders").select("status, payment_mode").eq("id", o.order_id).single()
    expect((row as { status: string }).status).toBe("pending_payment")
    expect((row as { payment_mode: string }).payment_mode).toBe("online")
  })

  it("in_store order is created new (unchanged)", async () => {
    const { data, error } = await guest().rpc("create_order", {
      p_shop_slug: "corner-grind", p_customer_name: "PMode Test", p_customer_phone: null,
      p_items: [{ item_id: itemId, qty: 1, option_ids: [] }], p_payment_mode: "in_store",
    })
    expect(error).toBeNull()
    const { data: row } = await admin.from("orders").select("status").eq("id", (data as { order_id: string }).order_id).single()
    expect((row as { status: string }).status).toBe("new")
  })

  it("online rejected when shop has no online mode", async () => {
    await admin.from("shops").update({ payment_modes: ["in_store"] }).eq("slug", "corner-grind")
    const { error } = await guest().rpc("create_order", {
      p_shop_slug: "corner-grind", p_customer_name: "PMode Test", p_customer_phone: null,
      p_items: [{ item_id: itemId, qty: 1, option_ids: [] }], p_payment_mode: "online",
    })
    expect(error?.message ?? "").toContain("payment_mode_unavailable")
    await admin.from("shops").update({ payment_modes: ["in_store", "online"] }).eq("slug", "corner-grind")
  })

  it("online rejected when shop has no connected account", async () => {
    await admin.from("shops").update({ stripe_account_id: null }).eq("slug", "corner-grind")
    const { error } = await guest().rpc("create_order", {
      p_shop_slug: "corner-grind", p_customer_name: "PMode Test", p_customer_phone: null,
      p_items: [{ item_id: itemId, qty: 1, option_ids: [] }], p_payment_mode: "online",
    })
    expect(error?.message ?? "").toContain("online_not_configured")
    await admin.from("shops").update({ stripe_account_id: "acct_test_connect" }).eq("slug", "corner-grind")
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/create-order-online.test.ts`
Expected: FAIL — `create_order` doesn't accept `p_payment_mode` yet (function signature mismatch). (Controller applies the migration between Steps 4 and 6.)

- [ ] **Step 3: Write the migration**

Open the current `create_order` definition (latest is in `supabase/migrations/20260802010000_shop_subscriptions.sql`) and re-create it with the new parameter. Copy the ENTIRE existing body verbatim, then make exactly these changes:
1. Signature: add `, p_payment_mode text default 'in_store'` as the last parameter.
2. After the existing `is_entitled` / `is_paused` / name / cart guards, add:
   ```sql
   if p_payment_mode not in ('in_store','online') then raise exception 'invalid_payment_mode'; end if;
   if not (p_payment_mode = any(v_shop.payment_modes)) then raise exception 'payment_mode_unavailable'; end if;
   if p_payment_mode = 'online' and v_shop.stripe_account_id is null then raise exception 'online_not_configured'; end if;
   ```
3. In the `insert into orders (...)`, set `payment_mode` to `p_payment_mode` and `status` to
   `case when p_payment_mode = 'online' then 'pending_payment'::order_status else 'new'::order_status end`
   (if `status` isn't currently in the insert column list, add it; if `payment_mode` isn't, add it).
4. Leave every price-computation and returned-jsonb line unchanged, EXCEPT ensure the returned jsonb
   includes `total_minor` (the computed `v_total`) and `token` (it already returns the token). If
   `total_minor` isn't already in the returned object, add `'total_minor', v_total`.

Because Postgres treats the added default param as the same function name with a new arity, also
`drop function if exists public.create_order(text, text, text, jsonb);` at the top of the migration so
the old 4-arg version doesn't linger (callers all move to the 5-arg form; the default keeps existing
4-arg call sites working — but dropping the old arity avoids ambiguity). Keep the grants the old
function had (`grant execute ... to anon, authenticated`).

Then handle the **dashboard exclusion**: the dashboard reads orders via a select in a server component
/ realtime. Add a guard so `pending_payment` never shows. Find the dashboard order query (search
`from("orders")` under `src/app/dashboard` / `src/components/dashboard`) — this is a code change, do it
in Task 1's migration commit's sibling only if it's SQL; if it's a client query, note it for Task 3.
(If the dashboard query has no status filter, add `.neq("status", "pending_payment")`; if RLS/view
based, add the exclusion there.)

- [ ] **Step 4: Commit migration + test (do NOT run — controller provisions + runs)**

```bash
git add supabase/migrations/*_create_order_payment_mode.sql tests/create-order-online.test.ts
git commit -m "feat(pay): create_order payment_mode + pending_payment lifecycle"
```

---

### Task 2: `POST /api/stripe/checkout-order` — Checkout Session on the connected account

**Files:**
- Create: `src/app/api/stripe/checkout-order/route.ts`

**Interfaces:**
- Consumes `getStripe()`, `createAdminClient()`. Body `{ order_id: string, token: string }`. Returns `{ url }` or an error. Creates a Checkout Session on the shop's connected account for a `pending_payment` online order.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

function site() {
  const s = process.env.NEXT_PUBLIC_APP_URL
  if (!s) throw new Error("NEXT_PUBLIC_APP_URL not set")
  return s
}

export async function POST(request: Request) {
  const { order_id, token } = await request.json().catch(() => ({}))
  if (!order_id || !token) return NextResponse.json({ error: "bad_request" }, { status: 400 })

  const admin = createAdminClient()
  const { data: order } = await admin
    .from("orders")
    .select("id, access_token, status, payment_mode, total_minor, currency, shop_id, shops(slug, stripe_account_id, name)")
    .eq("id", order_id)
    .maybeSingle()

  // `access_token` (uuid) is the order's secret; the URL /order/[token] uses it. token param must match.
  if (!order || String(order.access_token) !== String(token))
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  if (order.status !== "pending_payment" || order.payment_mode !== "online")
    return NextResponse.json({ error: "not_payable" }, { status: 409 })

  const shop = order.shops as { slug: string; stripe_account_id: string | null; name: string }
  if (!shop.stripe_account_id) return NextResponse.json({ error: "no_account" }, { status: 409 })
  if ((order.total_minor ?? 0) < 30) return NextResponse.json({ error: "amount_too_low" }, { status: 409 })

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: (order.currency ?? "gbp").toLowerCase(),
          unit_amount: order.total_minor,
          product_data: { name: `${shop.name} order` },
        },
      }],
      metadata: { order_id: order.id },
      payment_intent_data: { metadata: { order_id: order.id } },
      success_url: `${site()}/order/${token}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site()}/${shop.slug}`,
    },
    { stripeAccount: shop.stripe_account_id } // direct charge on the connected account, zero commission
  )
  return NextResponse.json({ url: session.url })
}
```

Adjust the `select` + token column name to match the real `orders` schema (check whether the token
column is `token` or `access_token`, and whether `total_minor`/`currency` exist on `orders`; if the
total lives elsewhere, compute from the returned create_order value passed through instead).

- [ ] **Step 2: Verify build** — `npm run build`, no type errors, route present. Commit.

```bash
git add src/app/api/stripe/checkout-order && git commit -m "feat(pay): checkout-order route creates Checkout Session on connected account"
```

---

### Task 3: Checkout sheet — payment-method choice + pay-now branch

**Files:**
- Modify: `src/components/shop/checkout-sheet.tsx`
- Modify: `src/lib/i18n.ts` (add `cart.payNow`, `cart.payLater`, `cart.payChoice`, `cart.redirecting`)
- Possibly modify the dashboard order query for the `pending_payment` exclusion if it was a client query (from Task 1 note).

**Interfaces:**
- Consumes `create_order` (now with `p_payment_mode`) and `POST /api/stripe/checkout-order`. The shop summary passed to the sheet must include `payment_modes` (thread it through if not already present).

- [ ] **Step 1: Add the payment choice + branch**

In `checkout-sheet.tsx`: read whether the shop offers online (`shop.payment_modes?.includes("online")`).
If so, render a two-option choice (radio/segmented) "Pay online now" / "Pay when I collect" above the
place-order button (Latte Glass styling). On submit:
- **in_store** (or no online offered) → existing path: `create_order(..., p_payment_mode: "in_store")` →
  add to history, go to `/order/{token}` (unchanged).
- **online** → `create_order(..., p_payment_mode: "online")` → on success, `POST /api/stripe/checkout-order`
  with `{ order_id, token }` → `window.location.href = url`. Clear the cart AFTER create_order succeeds
  (so a failed redirect leaves a recoverable pending order). Show a "Redirecting to payment…" state.
Map new create_order errors (`payment_mode_unavailable`, `online_not_configured`, `amount_too_low` from
the route) to friendly `t()` copy.

- [ ] **Step 2: Verify build** — `npm run build`. Commit all Task 3 files.

---

### Task 4: Reconcile-on-return + Connect webhook backup

**Files:**
- Modify: `src/app/order/[token]/page.tsx` (reconcile)
- Create: `src/app/api/stripe/connect-webhook/route.ts` (backup)
- Create/modify: `src/lib/billing.ts` or a new `src/lib/orders.ts` — a shared `markOrderPaid(order, paymentIntentId)` idempotent helper.

**Interfaces:**
- Produces `reconcileOrderPayment(token, sessionId)` used by the order page, and the webhook handler; both call the same idempotent `pending_payment → new` + store PaymentIntent write via the admin client.

- [ ] **Step 1: Shared idempotent mark-paid helper**

```ts
// src/lib/orders.ts
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

/** Flip a pending_payment online order to new + store the PaymentIntent. Idempotent. */
export async function markOrderPaidFromSession(sessionId: string): Promise<void> {
  try {
    const admin = createAdminClient()
    // Find the order by session? We stored order_id in session metadata; but we arrive here with a
    // session_id from the connected account, so retrieve it with the account header. To get the
    // account, first find the order via the page's token (page passes order+account), OR:
    // The order page resolves order -> shop.stripe_account_id, then calls this with that account.
  } catch { /* webhook/next load can still reconcile */ }
}
```

Because retrieving a **connected-account** session needs the account id, implement two entry points:
- `reconcileOrderPayment({ order, sessionId })` (order page has the order + shop account): retrieve the
  session on `{ stripeAccount: shop.stripe_account_id }`, if `payment_status==='paid'` and order is
  `pending_payment` → update `status='new', stripe_payment_intent_id=<pi>` where `id=order.id AND status='pending_payment'` (the status guard makes it idempotent).
- The webhook (has `event.account`): on `checkout.session.completed`, `metadata.order_id`, do the same
  guarded update.

- [ ] **Step 2: Order page reconcile**

In `src/app/order/[token]/page.tsx` (server component): if `searchParams.session_id`, load the order by
token, resolve its shop's `stripe_account_id`, call `reconcileOrderPayment({ order, sessionId })` before
rendering. Then render as normal (the order now shows `new`/"waiting to accept"). If still
`pending_payment` (payment not completed), show an "awaiting payment" state with a link to retry.

- [ ] **Step 3: Connect webhook**

```ts
// src/app/api/stripe/connect-webhook/route.ts
import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature")
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!sig || !secret) return NextResponse.json({ error: "config" }, { status: 400 })
  const raw = await request.text()
  let event: Stripe.Event
  try { event = getStripe().webhooks.constructEvent(raw, sig, secret) }
  catch { return NextResponse.json({ error: "bad_signature" }, { status: 400 }) }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session
    const orderId = s.metadata?.order_id
    if (orderId && s.payment_status === "paid") {
      const admin = createAdminClient()
      await admin.from("orders")
        .update({ status: "new", stripe_payment_intent_id: (s.payment_intent as string) ?? null })
        .eq("id", orderId).eq("status", "pending_payment") // idempotent guard
    }
  }
  return NextResponse.json({ received: true })
}
```

- [ ] **Step 4: Verify build** — `npm run build`. Commit all Task 4 files.

---

### Task 5: End-to-end verification

**Files:** none. Controller-driven; the full pay-online round-trip needs a connected test account + `STRIPE_CONNECT_CLIENT_ID` (from 2B-1, already set in `.env.local`).

- [ ] **Step 1: RPC tests** — controller provisions corner-grind (online + fake account) via admin, runs `npm test -- tests/create-order-online.test.ts` (4/4), resets corner-grind.
- [ ] **Step 2: checkout-order route** — with a real pending online order (created via a connected test shop), POST returns a `checkout.stripe.com` URL on the connected account; wrong token / paid order → rejected.
- [ ] **Step 3: Full pay-online round-trip** — connect a test shop (2B-1 flow), place an order choosing "Pay online now", complete Checkout with test card 4242 → returns to `/order/{token}` showing the order accepted-pending; DB: order `new`, `stripe_payment_intent_id` set. Verify the order appears in that shop's dashboard queue and the `pending_payment` never did.
- [ ] **Step 4: Full suite + build** — `npm test`, `npm run build`. Update state.md/roadmap.md. Commit docs.

---

## Self-Review
**Spec coverage:** create_order payment_mode + pending_payment → Task 1; checkout-order Session on connected account → Task 2; checkout-sheet choice → Task 3; reconcile + webhook → Task 4; dashboard exclusion → Task 1/3; tests → Tasks 1 & 5. Auto-refund is explicitly 2B-2b, not here. ✓
**Placeholder scan:** the `markOrderPaidFromSession` stub in Task 4 Step 1 is illustrative — the real implementation is the two named entry points described immediately below it; the implementer writes `reconcileOrderPayment({ order, sessionId })` + the webhook, not the stub. Flagged, not a silent placeholder.
**Type/name consistency:** `create_order(...,p_payment_mode)`, error strings (`payment_mode_unavailable`, `online_not_configured`, `amount_too_low`), the order `token` column name (verify: `token` vs `access_token` — Task 2/4 must use the real column), and `stripeAccount` direct-charge option are consistent across tasks. The order total field (`total_minor`) must exist in the returned create_order jsonb (Task 1 ensures it) for Task 2's amount.
