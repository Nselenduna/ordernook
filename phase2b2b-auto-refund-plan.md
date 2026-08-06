# Phase 2B-2b — Auto-Refund (money-back) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** When a shop rejects/cancels an order the customer paid for online, OrderNook automatically refunds it in full on the shop's connected account and sets the order `refunded`. In-store/unpaid rejects behave as before. (Returns/disputes/goodwill remain the shop's own Stripe job.)

**Architecture:** Rejecting moves from a direct client DB update to a staff-authed server route (`/api/orders/reject`) — a refund needs the Stripe secret + connected account. The route refunds paid online orders and sets status; the dashboard reject dialog calls it.

**Tech Stack:** Next route handler (nodejs), Stripe refunds on connected accounts (`{ stripeAccount }`), Supabase admin client, vitest.

## Global Constraints
- Refund is **full**, on the shop's **connected account** (`stripe.refunds.create({ payment_intent }, { stripeAccount })`), never a platform refund.
- Only **paid online** orders (`payment_mode='online'` AND `stripe_payment_intent_id` set) refund; in-store or unpaid → status only.
- The route is **staff-authed** (`getStaffShop`) and verifies the order belongs to the caller's shop.
- **Idempotent** — an already-final order (`refunded`/`rejected`/`collected`) is not re-refunded.
- All strings via `t()`.

## Prerequisite (for the live E2E — not the build)
A shop with a real connected test account and a **paid online order** (produced by 2B-2a's pay-with-4242 flow).

## File Structure
- `src/app/api/stripe/refund-order/route.ts` (create) — reject/refund route.
- `src/components/dashboard/dashboard-shell.tsx` (modify) — reject dialog calls the route.
- `src/components/dashboard/order-card.tsx` (modify) — "Paid online" badge.
- `src/app/order/[token]/order-status-client.tsx` (modify) — refunded message.
- `src/lib/i18n.ts` (modify) — `order.status.refunded` / `order.refunded.*`, `dash.paidOnline`.
- `tests/refund-order.test.ts` (create) — non-refund + guard tests.

---

### Task 1: `/api/stripe/refund-order` route + dashboard wiring

**Files:**
- Create: `src/app/api/stripe/refund-order/route.ts`
- Modify: `src/components/dashboard/dashboard-shell.tsx`
- Create: `tests/refund-order.test.ts`

**Interfaces:**
- Produces `POST /api/stripe/refund-order` body `{ order_id, reason }`. Refunds paid online orders → `refunded`, else `rejected`. Returns `{ status }`.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const shop = await getStaffShop()
  if (!shop) return NextResponse.json({ error: "no_shop" }, { status: 401 })

  const { order_id, reason } = await request.json().catch(() => ({}))
  if (!order_id) return NextResponse.json({ error: "bad_request" }, { status: 400 })

  const admin = createAdminClient()
  const { data: order } = await admin
    .from("orders")
    .select("id, shop_id, status, payment_mode, stripe_payment_intent_id")
    .eq("id", order_id)
    .maybeSingle()
  if (!order || order.shop_id !== shop.id)
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  if (["refunded", "rejected", "collected"].includes(order.status))
    return NextResponse.json({ status: order.status }) // already final; idempotent

  const paidOnline = order.payment_mode === "online" && !!order.stripe_payment_intent_id
  if (paidOnline) {
    if (!shop.stripe_account_id)
      return NextResponse.json({ error: "no_account" }, { status: 409 })
    try {
      await getStripe().refunds.create(
        { payment_intent: order.stripe_payment_intent_id as string },
        { stripeAccount: shop.stripe_account_id }
      )
    } catch (e) {
      console.error("refund-order refund failed", { orderId: order.id, e })
      return NextResponse.json({ error: "refund_failed" }, { status: 502 })
    }
  }

  const nextStatus = paidOnline ? "refunded" : "rejected"
  const { error } = await admin
    .from("orders")
    .update({ status: nextStatus, reject_reason: reason ?? null })
    .eq("id", order.id)
    .in("status", ["new", "accepted", "preparing", "ready", "pending_payment"]) // guard against races
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 })
  return NextResponse.json({ status: nextStatus })
}
```

- [ ] **Step 2: Wire the dashboard reject dialog to the route**

In `src/components/dashboard/dashboard-shell.tsx`, the RejectDialog `onConfirm` currently calls `advance(order, "rejected", { reject_reason: reason })` (a direct client `.update`). Replace that call with a fetch to the route, then optimistically update local state:

```tsx
onConfirm={async (order, reason) => {
  const res = await fetch("/api/stripe/refund-order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ order_id: order.id, reason }),
  })
  if (!res.ok) { toast.error(t("dash.updateFailed")); return }
  const { status } = await res.json()
  // reflect the returned status (refunded or rejected) in local state:
  setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status, reject_reason: reason } : o)))
  setRejectTarget(null)
}}
```
Match the real local-state updater name/shape in the file (it uses `advance`'s optimistic pattern — reuse whatever state setter `advance` uses; the point is the status comes from the server response, which may be `refunded` or `rejected`). Keep accept/preparing/ready/collected transitions on the existing direct-update `advance` path (no money). Import `toast`/`t` if not already.

- [ ] **Step 3: Write the tests**

`tests/refund-order.test.ts` — the route requires a staff session (cookie), which vitest doesn't have, so test the **DB-observable guard behavior through a direct RPC-free path is not possible**; instead test the route's core decision at the DB level via a helper OR keep the automated coverage to what's checkable: assert (a) an in-store order rejected via the route sets `rejected` and creates no Stripe refund, and (b) an already-`refunded` order is left unchanged. Because the route is cookie-authed, drive it with a signed-in supabase client only if the route reads the session cookie; if the harness can't send the cookie, mark the route's happy/guard paths for the Task 3 manual E2E and instead unit-test a small extracted pure helper `decideRejectOutcome(order): { status, refund: boolean }` that the route uses:

```ts
// in the route file, export a tiny pure helper and test it:
export function decideRejectOutcome(o: { payment_mode: string; stripe_payment_intent_id: string | null }) {
  const refund = o.payment_mode === "online" && !!o.stripe_payment_intent_id
  return { status: refund ? "refunded" : "rejected", refund }
}
```
Test: online+PI → { refunded, refund:true }; online+no PI → { rejected, false }; in_store → { rejected, false }. This gives deterministic coverage of the refund-vs-not decision without Stripe/cookies. (Full refund happens in Task 3 E2E.)

- [ ] **Step 4: Verify build** — `npm run build`. Commit route + dashboard + test.

---

### Task 2: Display — "Paid online" badge + customer refunded message

**Files:**
- Modify: `src/components/dashboard/order-card.tsx` (add "Paid online" badge for online orders; the `refunded` status badge already exists in `STATUS_BADGE`).
- Modify: `src/app/order/[token]/order-status-client.tsx` (add a refunded message/card).
- Modify: `src/lib/i18n.ts` (`dash.paidOnline`, `order.status.refunded`, `order.refunded.title`, `order.refunded.body`).

- [ ] **Step 1: Dashboard order-card badge**

In `order-card.tsx`, near the existing status/payment badges, add a small "Paid online" `Badge` when `order.payment_mode === "online"` (distinguish from the existing "Pay at counter" for in_store). Use `t("dash.paidOnline")`.

- [ ] **Step 2: Customer refunded display**

In `order-status-client.tsx`, `refunded` is already treated as a final status. Add a refunded branch to the rendered card (mirror the existing `rejected` card): show `t("order.refunded.title")` + `t("order.refunded.body")` and the `reject_reason` if present. Add `order.status.refunded` to `STATUS_MESSAGE` if it drives the stepper text.

- [ ] **Step 3: i18n**

Add: `"dash.paidOnline": "Paid online"`, `"order.status.refunded": "Refunded"`, `"order.refunded.title": "Order refunded"`, `"order.refunded.body": "This order was refunded in full to your card."`

- [ ] **Step 4: Verify build** — `npm run build`. Commit.

---

### Task 3: End-to-end verification

**Files:** none. Controller-driven; the refund path needs a real paid online order (from 2B-2a's live flow).

- [ ] **Step 1: Guard tests** — controller runs `npm test -- tests/refund-order.test.ts` (decideRejectOutcome 3/3).
- [ ] **Step 2: In-store reject** — reject an in_store order from the dashboard → status `rejected`, no Stripe refund (verify no refund on the account). Customer page shows rejected.
- [ ] **Step 3: Paid-online reject → refund** — with a paid online order (2B-2a flow), reject it from the dashboard → Stripe shows a **full refund** on the connected account, order status `refunded`, dashboard shows the Refunded badge, customer page shows "Order refunded". Reject again → idempotent no-op (no second refund).
- [ ] **Step 4: Full suite + build** — `npm test`, `npm run build`. Update state.md/roadmap.md. Commit docs.

---

## Self-Review
**Spec coverage:** refund route (paid online → refund+refunded; else rejected) → Task 1; dashboard reject routed through server → Task 1; idempotency (already-final skip + status `.in()` guard) → Task 1; "Paid online" + refunded display → Task 2; tests → Tasks 1 & 3. Returns/disputes explicitly out of scope. ✓
**Placeholder scan:** the test approach in Task 1 Step 3 is deliberately a pure-helper unit test (`decideRejectOutcome`) because the route is cookie-authed and the full refund needs Stripe — flagged, not a silent gap; the real refund is Task 3 E2E.
**Type/name consistency:** route path `/api/stripe/refund-order`, body `{ order_id, reason }`, statuses `refunded`/`rejected`, `stripe_payment_intent_id`, `{ stripeAccount }` refund, and the `decideRejectOutcome` helper are consistent across tasks. The dashboard wiring must reflect the **server-returned** status (refunded vs rejected), not hard-code "rejected".
