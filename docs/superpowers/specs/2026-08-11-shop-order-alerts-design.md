# OrderNook shop-side new-order alerts (web push) — Design

**Date:** 2026-08-11
**Status:** Approved

## Why

The live landing page at ordernook.uk promises, in the Features grid:

> **Push notifications** — A ping the moment an order comes in — even when the page is closed.

That is currently false. Web push runs in one direction only: **shop → customer** ("your order is ready", `/api/notify-ready`, fired from the dashboard when staff advance an order). `push_subscription` is a column on `orders` — it holds the *customer's* device, per order. There is no staff-side subscription anywhere in the schema.

The shop's only new-order alert is `useChime` (`src/components/dashboard/use-chime.ts`) — a WebAudio tone that requires the dashboard to be **open and unlocked by a pointer press**. Close the tab and a paying customer's order lands in silence.

This matters more than a copy inaccuracy because online payments are live and taking real money (`kwadube-meals-on-wheels`, `charges_enabled=true`, £8.50 charged 8 Aug). A customer can now pay online and have nobody in the shop know.

**Goal:** a shop is alerted the moment an order reaches them, with no browser open anywhere — making the landing claim true.

## Scope

In scope: staff device subscriptions, a database-driven trigger, a notify route, and enrolment UI on the orders dashboard.

Explicitly **not** in this change (both real, both separate work):
- Sweeping the 4 orphaned `pending_payment` orders that never expire.
- The Connect onboarding drop-off (2 of 3 real shops sit at `charges_enabled=false`).

## 1. Data model (one migration)

New table `public.staff_push_devices`:

| column | type | notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `shop_id` | uuid not null | → `shops(id)` on delete cascade |
| `auth_user_id` | uuid not null | → `auth.users(id)` on delete cascade |
| `endpoint` | text not null **unique** | the push endpoint URL; identity of a device |
| `subscription` | jsonb not null | full `PushSubscriptionJSON` |
| `label` | text | e.g. "iPhone", "Counter tablet" |
| `created_at` | timestamptz not null | `now()` |
| `last_success_at` | timestamptz | set on each successful send |

Index on `(shop_id)` — the notify route's only lookup.

**One row per device, not per user.** An owner with a phone and a counter tablet gets both. `unique (endpoint)` makes re-subscribing the same device an upsert rather than a duplicate.

**Why not reuse `orders.push_subscription`?** That column is per-order, customer-owned, and nulled on expiry. Staff devices are long-lived and shop-scoped. Different lifecycle, different table.

RLS (`enable row level security`):
- `staff_push_devices_self` for all: `using (auth_user_id = auth.uid() and public.is_staff_of(shop_id))` with the same check.
- The notify route reads via the service-role client, which bypasses RLS by design.

New RPC `public.attach_staff_push_device(p_shop_id uuid, p_subscription jsonb, p_label text)`:
- `SECURITY DEFINER`, `set search_path = public`.
- Raises unless `public.is_staff_of(p_shop_id)`.
- Extracts `p_subscription->>'endpoint'` and upserts on that conflict target, refreshing `subscription` and `label`.
- `revoke execute ... from anon` — mirrors `is_staff_of` and `attach_push_subscription`.

## 2. Trigger (same migration)

`create extension if not exists pg_net with schema extensions;` — available on this project (v0.20.3) but **not currently installed**.

**Two** row-level triggers on `public.orders` sharing one function:

```sql
-- in-store: inserted straight at 'new'
after insert ... when (new.status = 'new')

-- online: flips pending_payment -> new on payment
after update ... when (new.status = 'new' and old.status is distinct from 'new')
```

They must be separate. Postgres forbids referencing `OLD` in the `WHEN` clause of an INSERT trigger and exposes no `tg_op` there, so a combined `AFTER INSERT OR UPDATE ... WHEN (... old.status ...)` fails at creation time.

Together they cover both arrival paths:
- **In-store** orders are inserted directly at `status='new'` → fires on INSERT.
- **Online** orders are inserted at `pending_payment` and flip to `new` when payment reconciles → fires on UPDATE.
- Abandoned checkouts never leave `pending_payment`, so they never fire.
- `is distinct from` stops an unrelated re-save from double-pinging.

The trigger function calls `net.http_post` with `{ order_id }` and an `x-ordernook-secret` header.

**The endpoint URL and shared secret are read from `vault.decrypted_secrets`** (`supabase_vault` 0.3.1 is installed), keyed `ordernook_notify_url` and `ordernook_notify_secret`. They are *not* written into the migration body — the GitHub repo is public, so a hardcoded secret would be a live leak.

`pg_net` is asynchronous and fire-and-forget: a slow, failing, or unreachable endpoint can never block or fail an order insert. That property is the reason for choosing it over a synchronous call-out, and it must be preserved — the trigger must never raise.

## 3. Route: `POST /api/notify-new-order`

- Compares the `x-ordernook-secret` header against `NOTIFY_SHARED_SECRET` using a **timing-safe** compare; 401 on mismatch or absence.
- Uses the service-role client (`src/lib/supabase/admin.ts`) — the caller is Postgres, not a user session, so there are no cookies to build a client from.
- Loads the order (`order_number`, `total_minor`, `currency`, `payment_mode`, `shops(name)`) and every `staff_push_devices` row for that `shop_id`.
- Sends via `web-push` with the existing VAPID env vars, in parallel, each failure isolated.
- On a `404`/`410` response, deletes that device row — the same expiry handling `notify-ready` already performs.
- On success, sets `last_success_at`.
- Returns `{ sent: n, pruned: m }`. Always 200 once authorised; a shop with zero devices is not an error.

Payload:
- **title:** `New order #12 — £8.50`
- **body:** `Paid online` or `Pay on collection`, from `payment_mode`. This distinction is the point of the feature — it tells staff whether money has already changed hands.
- **url:** `/dashboard`, so the existing `notificationclick` handler focuses or opens the live queue.

Strings go through `src/lib/i18n.ts` alongside the existing `push.readyTitle` / `push.readyBody` keys.

## 4. Enrolment UI

New `<OrderAlertsBanner>` at the top of the orders dashboard, modelled on `src/components/order/push-card.tsx`.

Visibility:
- Hidden when this device already has a subscription — checked with `registration.pushManager.getSubscription()`, **not** localStorage. It survives a cleared cache and reflects the browser's real state.
- Hidden when `Notification.permission === "denied"` (nothing useful to offer).
- Dismissible; dismissal is per-device in localStorage.

**iOS branch.** On iOS Safari outside standalone mode, `isPushSupported()` returns `false`. The existing `PushCard` early-returns `null` in that case, which would hide the banner from exactly the users who most need instruction. The banner needs a **separate branch** rendering "Add OrderNook to your Home Screen to get order alerts" instead of the button. iOS 16.4+ only delivers push to installed PWAs; the dashboard became installable in commit `5b6060c`, so the prerequisite already shipped.

On click: `subscribeToPush(NEXT_PUBLIC_VAPID_PUBLIC_KEY)` → `attach_staff_push_device` RPC with a device label derived from the user agent.

## 5. Service worker

**No changes.** `/sw.js` already has generic `push` and `notificationclick` handlers that read `title`/`body`/`url` from the payload, and `subscribeToPush()` registers `/sw.js` itself before subscribing.

Note `SwRegister` is production-only by design (dev registration caused the stale-chunk trap documented in state.md), so banner testing needs a production build or a deployed preview.

## 6. Error handling

- Trigger: must never raise. `net.http_post` is async; a missing Vault secret results in no call, not an error.
- Missing Vault secret → the trigger makes no call at all, so the route never runs and nothing would surface on its own. The trigger function therefore `raise log`s when it cannot read either Vault key, and step 5 of the deployment sequence (the acceptance test) is what actually proves the wiring. A silent no-op must not be mistaken for "no orders yet".
- Route: unauthorised → 401 and nothing read. Per-device send failures are isolated; one dead device cannot suppress another's alert.
- Expired subscriptions are pruned, matching `notify-ready`.

## 7. Testing

- **Unit:** the payload builder extracted as a pure function (same pattern as `decideRejectOutcome` in the refund work) — asserts the online vs collection body, currency formatting, and order number.
- **RLS / cross-tenant:** shop A's staff can neither read nor write shop B's `staff_push_devices`. Extends the existing suite (29 passing, `fileParallelism:false`).
- **Auth guard:** `POST /api/notify-new-order` returns 401 with no header and with a wrong header.
- **Trigger:** inserting a `pending_payment` order fires nothing; flipping it to `new` fires once; re-saving a `new` order does not fire again.
- **Acceptance (manual, real hardware):** iPhone with the dashboard installed to the home screen, **app fully closed**, place an order on `corner-grind` → notification arrives and opens the live queue. This mirrors the Phase 0 iOS push proof and is the test that decides whether the landing claim is true.

## 8. Deployment notes

Ordered, because the trigger is inert until the secrets exist:

1. Apply the migration (`supabase db push`).
2. Set `ordernook_notify_url` and `ordernook_notify_secret` in Supabase Vault.
3. Set `NOTIFY_SHARED_SECRET` in Vercel Production to the same value.
4. Deploy.
5. Run the acceptance test.

**All database access for this project goes through the Supabase CLI**, which is linked to `iryavyogljedwgllaoit`: `supabase db push` for migrations, `supabase db query --linked` for ad-hoc SQL.

**Do not use the Supabase MCP on this project.** It is bound to `qihlqywpaszxnxcdkymp` — **BookOnTheMap production**. The state.md note that the MCP can't reach the Zizwe order-ahead project is correct and current. Running this feature's `create extension`, `vault.create_secret`, or test-order SQL through the MCP would write them into a different live product's database.
