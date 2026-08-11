# Shop-side New-Order Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alert a shop by web push the moment an order reaches them, with no browser open anywhere — making the ordernook.uk claim "a ping the moment an order comes in, even when the page is closed" true.

**Architecture:** A new `staff_push_devices` table stores one push subscription per staff device. Two Postgres triggers (split because `OLD` is illegal in an INSERT trigger's `WHEN`) fire `pg_net.http_post` at `/api/notify-new-order` whenever an order enters `status='new'`. That route authenticates on a shared secret, reads the shop's devices with a service-role client, and sends via the existing `web-push` + VAPID setup. A banner on the orders dashboard handles enrolment.

**Tech Stack:** Next.js 16.2.10 (App Router), Supabase Postgres + RLS, `pg_net` 0.20.3, `supabase_vault` 0.3.1, `web-push` 3.6.7, vitest 4.1.10, TypeScript 5.

## Global Constraints

- Read `node_modules/next/dist/docs/` before writing route or component code — per `AGENTS.md`, this Next.js differs from training data.
- Money is **always** integer minor units in code and DB; format only at display via `formatMinor(minor, currency)` from `src/lib/money.ts`.
- Every user-facing string goes in `src/lib/i18n.ts`. No inline literals.
- All new tables get `enable row level security` — never leave a table open.
- `revoke execute ... from anon` on every new `SECURITY DEFINER` function, matching `is_staff_of` and `attach_push_subscription`.
- Tests run serially (`fileParallelism:false` in `vitest.config.ts`) against **live** Supabase; occasional cross-file flake is transient — re-run before investigating.
- The GitHub repo is **public**. No secrets in migrations, code, or committed docs.
- Supabase project is `iryavyogljedwgllaoit`; the CLI is linked and `supabase db push` works.
- Migrations are timestamp-named and live in `supabase/migrations/`. The latest existing is `20260811090000_revoke_trigger_guard_execute.sql`.

---

### Task 1: `staff_push_devices` table, RLS, and enrolment RPC

**Files:**
- Create: `supabase/migrations/20260811120000_staff_push_devices.sql`
- Modify: `src/lib/database.types.ts` (regenerated, not hand-edited)
- Test: `tests/staff-push-devices.test.ts`

**Interfaces:**
- Consumes: `public.is_staff_of(uuid)` (exists since Phase 0).
- Produces: table `public.staff_push_devices`; RPC `public.attach_staff_push_device(p_shop_id uuid, p_subscription jsonb, p_label text) returns void`.

- [ ] **Step 1: Write the failing test**

Create `tests/staff-push-devices.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.test" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anon)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

async function ownShopId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.from("staff_users").select("shop_id").single()
  if (error) throw error
  return (data as { shop_id: string }).shop_id
}

// All test endpoints share this prefix so cleanup can target ONLY test rows.
// A blanket delete would wipe real enrolled staff devices on corner-grind —
// these tests run against live Supabase, not a throwaway database.
const TEST_ENDPOINT_PREFIX = "https://push.test/"

function fakeSubscription(endpoint: string) {
  return { endpoint, keys: { p256dh: "test-p256dh", auth: "test-auth" } }
}

describe("staff_push_devices", () => {
  let a: SupabaseClient
  let b: SupabaseClient
  let aShopId: string
  let bShopId: string

  beforeAll(async () => {
    a = await signedIn(process.env.SHOP_A_EMAIL!, process.env.SHOP_A_PASSWORD!)
    b = await signedIn(process.env.SHOP_B_EMAIL!, process.env.SHOP_B_PASSWORD!)
    aShopId = await ownShopId(a)
    bShopId = await ownShopId(b)
    // Scoped to test endpoints only — never touch real enrolled devices.
    await a.from("staff_push_devices").delete().like("endpoint", `${TEST_ENDPOINT_PREFIX}%`)
    await b.from("staff_push_devices").delete().like("endpoint", `${TEST_ENDPOINT_PREFIX}%`)
  })

  it("A can enrol a device for its own shop", async () => {
    const endpoint = `https://push.test/a-${Date.now()}`
    const { error } = await a.rpc("attach_staff_push_device", {
      p_shop_id: aShopId,
      p_subscription: fakeSubscription(endpoint),
      p_label: "Test phone",
    })
    expect(error).toBeNull()
    const { data } = await a.from("staff_push_devices").select("endpoint,label").eq("endpoint", endpoint)
    expect(data).toHaveLength(1)
    expect(data![0].label).toBe("Test phone")
  })

  it("re-enrolling the same endpoint updates rather than duplicates", async () => {
    const endpoint = `https://push.test/a-dup-${Date.now()}`
    const sub = fakeSubscription(endpoint)
    await a.rpc("attach_staff_push_device", { p_shop_id: aShopId, p_subscription: sub, p_label: "First" })
    await a.rpc("attach_staff_push_device", { p_shop_id: aShopId, p_subscription: sub, p_label: "Second" })
    const { data } = await a.from("staff_push_devices").select("label").eq("endpoint", endpoint)
    expect(data).toHaveLength(1)
    expect(data![0].label).toBe("Second")
  })

  it("A CANNOT enrol a device against B's shop", async () => {
    const { error } = await a.rpc("attach_staff_push_device", {
      p_shop_id: bShopId,
      p_subscription: fakeSubscription(`https://push.test/cross-${Date.now()}`),
      p_label: "Intruder",
    })
    expect(error).not.toBeNull()
  })

  it("B CANNOT read A's devices", async () => {
    const endpoint = `https://push.test/a-private-${Date.now()}`
    await a.rpc("attach_staff_push_device", {
      p_shop_id: aShopId,
      p_subscription: fakeSubscription(endpoint),
      p_label: "Private",
    })
    const { data } = await b.from("staff_push_devices").select("id").eq("endpoint", endpoint)
    expect(data ?? []).toHaveLength(0)
  })

  it("rejects a subscription with no endpoint", async () => {
    const { error } = await a.rpc("attach_staff_push_device", {
      p_shop_id: aShopId,
      p_subscription: { keys: { p256dh: "x", auth: "y" } },
      p_label: null,
    })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/staff-push-devices.test.ts`
Expected: FAIL — the `attach_staff_push_device` function and `staff_push_devices` relation do not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260811120000_staff_push_devices.sql`:

```sql
-- Staff device subscriptions for new-order web push.
-- One row per DEVICE (not per user): an owner with a phone and a counter
-- tablet gets both. Distinct from orders.push_subscription, which is a
-- customer's device attached to a single order and nulled on expiry.
create table public.staff_push_devices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  label text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

create index staff_push_devices_shop_idx on public.staff_push_devices (shop_id);

alter table public.staff_push_devices enable row level security;

-- Staff touch only their own device rows, and only for a shop they staff.
create policy staff_push_devices_self on public.staff_push_devices for all
  using (auth_user_id = auth.uid() and public.is_staff_of(shop_id))
  with check (auth_user_id = auth.uid() and public.is_staff_of(shop_id));

-- Enrolment. SECURITY DEFINER so the upsert can resolve the unique-endpoint
-- conflict even when the row currently belongs to another user (device handed
-- over to a new staff member), while still proving the caller staffs the shop.
create or replace function public.attach_staff_push_device(
  p_shop_id uuid,
  p_subscription jsonb,
  p_label text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_endpoint text := p_subscription->>'endpoint';
begin
  if not public.is_staff_of(p_shop_id) then
    raise exception 'not staff of shop %', p_shop_id;
  end if;

  if v_endpoint is null or v_endpoint = '' then
    raise exception 'subscription missing endpoint';
  end if;

  insert into public.staff_push_devices
    (shop_id, auth_user_id, endpoint, subscription, label)
  values
    (p_shop_id, auth.uid(), v_endpoint, p_subscription, p_label)
  on conflict (endpoint) do update
    set shop_id      = excluded.shop_id,
        auth_user_id = excluded.auth_user_id,
        subscription = excluded.subscription,
        label        = coalesce(excluded.label, staff_push_devices.label);
end;
$$;

revoke execute on function public.attach_staff_push_device(uuid, jsonb, text) from anon;
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase db push`
Expected: the migration applies cleanly; `supabase migration list` shows local and remote in sync.

- [ ] **Step 5: Regenerate database types**

Run: `npx supabase gen types typescript --linked > src/lib/database.types.ts`
Expected: `staff_push_devices` appears under `Tables` and `attach_staff_push_device` under `Functions`. Do not hand-edit this file.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/staff-push-devices.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Run the full suite for regressions**

Run: `npm test`
Expected: all prior tests still pass (29 before this task, 34 after).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260811120000_staff_push_devices.sql src/lib/database.types.ts tests/staff-push-devices.test.ts
git commit -m "feat(alerts): staff_push_devices table, RLS and enrolment RPC"
```

---

### Task 2: Alert payload builder

**Files:**
- Create: `src/lib/order-alert.ts`
- Modify: `src/lib/i18n.ts` (add three keys near the existing `push.*` block, around line 261)
- Test: `tests/order-alert.test.ts`

**Interfaces:**
- Consumes: `formatMinor(minor: number, currency: string, locale?: string): string` from `src/lib/money.ts`; `t(key, params?)` from `src/lib/i18n.ts`.
- Produces: `buildOrderAlert(input: OrderAlertInput): OrderAlertPayload`, where
  `OrderAlertInput = { orderNumber: number; totalMinor: number; currency: string; paymentMode: "online" | "in_store" }`
  and `OrderAlertPayload = { title: string; body: string; url: string }`.

Extracted as a pure function so it is testable without a database or a browser — the same pattern as `decideRejectOutcome` in `src/lib/refund.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/order-alert.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { buildOrderAlert } from "../src/lib/order-alert"

describe("buildOrderAlert", () => {
  it("titles with order number and formatted total", () => {
    const { title } = buildOrderAlert({
      orderNumber: 12, totalMinor: 850, currency: "GBP", paymentMode: "online",
    })
    expect(title).toBe("New order #12 — £8.50")
  })

  it("says paid online for an online order", () => {
    const { body } = buildOrderAlert({
      orderNumber: 1, totalMinor: 100, currency: "GBP", paymentMode: "online",
    })
    expect(body).toBe("Paid online")
  })

  it("says pay on collection for an in-store order", () => {
    const { body } = buildOrderAlert({
      orderNumber: 1, totalMinor: 100, currency: "GBP", paymentMode: "in_store",
    })
    expect(body).toBe("Pay on collection")
  })

  it("always deep-links to the dashboard queue", () => {
    expect(buildOrderAlert({
      orderNumber: 3, totalMinor: 0, currency: "GBP", paymentMode: "in_store",
    }).url).toBe("/dashboard")
  })

  it("handles a zero total", () => {
    expect(buildOrderAlert({
      orderNumber: 4, totalMinor: 0, currency: "GBP", paymentMode: "in_store",
    }).title).toBe("New order #4 — £0.00")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/order-alert.test.ts`
Expected: FAIL — cannot resolve `../src/lib/order-alert`.

- [ ] **Step 3: Add the i18n keys**

In `src/lib/i18n.ts`, directly below the existing `"push.readyBody"` entry:

```ts
  "push.newOrderTitle": "New order #{number} — {total}",
  "push.newOrderPaid": "Paid online",
  "push.newOrderUnpaid": "Pay on collection",
```

- [ ] **Step 4: Write the implementation**

Create `src/lib/order-alert.ts`:

```ts
import { t } from "@/lib/i18n"
import { formatMinor } from "@/lib/money"

export type OrderAlertInput = {
  orderNumber: number
  totalMinor: number
  currency: string
  paymentMode: "online" | "in_store"
}

export type OrderAlertPayload = {
  title: string
  body: string
  url: string
}

/**
 * Builds the shop-facing "new order" push payload. Pure — no DB, no browser —
 * so the copy and money formatting are unit-testable on their own.
 *
 * The body distinguishes paid-online from pay-on-collection because that is
 * the whole point of the alert: it tells staff whether money has already
 * changed hands before they start making the order.
 */
export function buildOrderAlert(input: OrderAlertInput): OrderAlertPayload {
  return {
    title: t("push.newOrderTitle", {
      number: input.orderNumber,
      total: formatMinor(input.totalMinor, input.currency),
    }),
    body:
      input.paymentMode === "online"
        ? t("push.newOrderPaid")
        : t("push.newOrderUnpaid"),
    url: "/dashboard",
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/order-alert.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/order-alert.ts src/lib/i18n.ts tests/order-alert.test.ts
git commit -m "feat(alerts): pure new-order push payload builder"
```

---

### Task 3: `POST /api/notify-new-order`

**Files:**
- Create: `src/app/api/notify-new-order/route.ts`
- Create: `src/lib/notify-auth.ts`
- Test: `tests/notify-auth.test.ts`

**Interfaces:**
- Consumes: `createAdminClient()` from `src/lib/supabase/admin.ts`; `buildOrderAlert` from Task 2; table and columns from Task 1.
- Produces: HTTP endpoint `POST /api/notify-new-order` accepting `{ order_id: string }` with header `x-ordernook-secret`; and `secretMatches(provided: string | null, expected: string | undefined): boolean` from `src/lib/notify-auth.ts`.

The comparison is split into its own module so it can be unit-tested without booting a route — the same extraction rationale as Task 2.

- [ ] **Step 1: Write the failing test**

Create `tests/notify-auth.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { secretMatches } from "../src/lib/notify-auth"

describe("secretMatches", () => {
  it("accepts an exact match", () => expect(secretMatches("s3cret", "s3cret")).toBe(true))
  it("rejects a wrong secret of equal length", () => expect(secretMatches("s3cret", "s3cr3t")).toBe(false))
  it("rejects a wrong secret of different length", () => expect(secretMatches("short", "muchlonger")).toBe(false))
  it("rejects a missing header", () => expect(secretMatches(null, "s3cret")).toBe(false))
  it("rejects an empty header", () => expect(secretMatches("", "s3cret")).toBe(false))
  it("rejects when the server has no secret configured", () => expect(secretMatches("anything", undefined)).toBe(false))
  it("rejects when the server secret is empty", () => expect(secretMatches("", "")).toBe(false))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/notify-auth.test.ts`
Expected: FAIL — cannot resolve `../src/lib/notify-auth`.

- [ ] **Step 3: Write the comparison helper**

Create `src/lib/notify-auth.ts`:

```ts
import { timingSafeEqual } from "node:crypto"

/**
 * Constant-time comparison of the trigger's shared secret.
 *
 * Length is checked first because timingSafeEqual throws on a length
 * mismatch. That leaks the secret's length, which is not a meaningful
 * disclosure for a random server-side secret.
 */
export function secretMatches(
  provided: string | null,
  expected: string | undefined
): boolean {
  if (!expected || !provided) return false
  const a = Buffer.from(provided, "utf8")
  const b = Buffer.from(expected, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/notify-auth.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write the route**

Read `node_modules/next/dist/docs/` on route handlers first. Create `src/app/api/notify-new-order/route.ts`:

```ts
import { NextResponse } from "next/server"
import webpush, { type PushSubscription } from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildOrderAlert } from "@/lib/order-alert"
import { secretMatches } from "@/lib/notify-auth"

export const runtime = "nodejs"

/**
 * Sends the shop-facing "new order" push. Called by the Postgres trigger
 * `notify_new_order` via pg_net — NOT by a browser.
 *
 * Security model: the caller is the database, so there is no user session to
 * build a client from. Authorisation is a shared secret header compared in
 * constant time; only then do we touch the service-role client.
 */
export async function POST(request: Request) {
  if (!secretMatches(
    request.headers.get("x-ordernook-secret"),
    process.env.NOTIFY_SHARED_SECRET
  )) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 })
  }

  let orderId: string | undefined
  try {
    const body = (await request.json()) as { order_id?: string }
    orderId = body.order_id
  } catch {
    // fall through to the 400 below
  }
  if (!orderId) {
    return NextResponse.json({ error: "missing order_id" }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id, shop_id, order_number, total_minor, currency, payment_mode, shops(name)")
    .eq("id", orderId)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: "order not found" }, { status: 404 })
  }

  const { data: devices } = await supabase
    .from("staff_push_devices")
    .select("id, subscription")
    .eq("shop_id", order.shop_id)

  if (!devices || devices.length === 0) {
    // Nobody enrolled a device — not an error.
    return NextResponse.json({ sent: 0, pruned: 0 })
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const payload = JSON.stringify(
    buildOrderAlert({
      orderNumber: order.order_number,
      totalMinor: order.total_minor,
      currency: order.currency,
      paymentMode: order.payment_mode === "online" ? "online" : "in_store",
    })
  )

  const expired: string[] = []
  const delivered: string[] = []

  // Each device is isolated: one dead subscription must never suppress
  // another device's alert.
  await Promise.all(
    devices.map(async (device) => {
      try {
        await webpush.sendNotification(
          device.subscription as unknown as PushSubscription,
          payload
        )
        delivered.push(device.id)
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          expired.push(device.id)
        }
      }
    })
  )

  if (expired.length > 0) {
    await supabase.from("staff_push_devices").delete().in("id", expired)
  }
  if (delivered.length > 0) {
    await supabase
      .from("staff_push_devices")
      .update({ last_success_at: new Date().toISOString() })
      .in("id", delivered)
  }

  return NextResponse.json({ sent: delivered.length, pruned: expired.length })
}
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 7: Verify the auth guard against a running dev server**

Run in one shell: `npm run dev`
Then in another:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/notify-new-order -H "Content-Type: application/json" -d '{"order_id":"00000000-0000-0000-0000-000000000000"}'
```

Expected: `401` (no secret header).

- [ ] **Step 8: Commit**

```bash
git add src/app/api/notify-new-order/route.ts src/lib/notify-auth.ts tests/notify-auth.test.ts
git commit -m "feat(alerts): notify-new-order route with shared-secret guard"
```

---

### Task 4: `pg_net` trigger

**Files:**
- Create: `supabase/migrations/20260811130000_new_order_push_trigger.sql`

**Interfaces:**
- Consumes: `/api/notify-new-order` from Task 3; Vault secrets `ordernook_notify_url` and `ordernook_notify_secret`.
- Produces: triggers `orders_notify_new_order_insert` and `orders_notify_new_order_update` on `public.orders`.

**Why two triggers, not one:** Postgres rejects `OLD` in the `WHEN` clause of an INSERT trigger, and `tg_op` is not available in `WHEN` at all. A combined `AFTER INSERT OR UPDATE ... WHEN (... old.status ...)` therefore fails at creation time. Two triggers sharing one function is the correct construction.

- [ ] **Step 1: Confirm the pg_net function schema**

Enabling the extension first, then checking where its functions landed, avoids guessing at a qualified name:

```sql
create extension if not exists pg_net;
select n.nspname, p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'http_post';
```

Run via the Supabase MCP `execute_sql`. Expected: a row with `nspname = 'net'`. If it is not `net`, use the returned schema in Step 3 instead.

- [ ] **Step 2: Set the Vault secrets**

Never commit these values. Run via the Supabase MCP `execute_sql`, substituting a freshly generated random secret:

```sql
select vault.create_secret('https://ordernook.uk/api/notify-new-order', 'ordernook_notify_url');
select vault.create_secret('<GENERATED_SECRET>', 'ordernook_notify_secret');
```

Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Keep it — Task 6 sets the identical value in Vercel as `NOTIFY_SHARED_SECRET`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260811130000_new_order_push_trigger.sql`:

```sql
-- Fire a shop-facing push whenever an order becomes visible to the shop.
-- pg_net is async and fire-and-forget: a slow or unreachable endpoint can
-- never block or fail an order insert. That property is load-bearing —
-- this function must never raise.
create extension if not exists pg_net;

create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'ordernook_notify_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'ordernook_notify_secret';

  -- Missing config must be loud in the logs, because the failure mode
  -- otherwise looks exactly like "no orders yet".
  if v_url is null or v_secret is null then
    raise log 'notify_new_order: vault secrets missing, skipping order %', new.id;
    return null;
  end if;

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('order_id', new.id),
    headers := jsonb_build_object(
      'Content-Type',       'application/json',
      'x-ordernook-secret', v_secret
    )
  );

  return null;
exception when others then
  raise log 'notify_new_order failed for order %: %', new.id, sqlerrm;
  return null;
end;
$$;

revoke execute on function public.notify_new_order() from anon, authenticated;

-- In-store orders are inserted straight at 'new'.
create trigger orders_notify_new_order_insert
after insert on public.orders
for each row
when (new.status = 'new')
execute function public.notify_new_order();

-- Online orders are inserted at 'pending_payment' and flip to 'new' when
-- payment reconciles. `is distinct from` stops an unrelated re-save from
-- pinging a second time.
create trigger orders_notify_new_order_update
after update on public.orders
for each row
when (new.status = 'new' and old.status is distinct from 'new')
execute function public.notify_new_order();
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase db push`
Expected: applies cleanly. If it errors with "OLD cannot be referenced", the two triggers have been merged — re-split them.

- [ ] **Step 5: Verify the trigger fires exactly once per arrival**

Run via the Supabase MCP `execute_sql`, against the `corner-grind` shop:

```sql
-- Baseline
select count(*) as before from net._http_response;

-- An online order must NOT fire on insert at pending_payment
insert into public.orders (shop_id, status, payment_mode, total_minor, currency, customer_name, order_number, access_token)
select id, 'pending_payment', 'online', 500, 'GBP', 'Trigger Test', 9001, gen_random_uuid()::text
from public.shops where slug = 'corner-grind';

select count(*) as after_pending from net._http_response;
```

Expected: `after_pending` equals `before`.

```sql
-- Flipping to 'new' must fire exactly once
update public.orders set status = 'new' where order_number = 9001;
select count(*) as after_flip from net._http_response;

-- Re-saving must NOT fire again
update public.orders set customer_name = 'Trigger Test 2' where order_number = 9001;
select count(*) as after_resave from net._http_response;
```

Expected: `after_flip` = `before` + 1; `after_resave` = `after_flip`.

- [ ] **Step 6: Clean up the test order**

```sql
delete from public.orders where order_number = 9001;
```

Expected: 1 row deleted. Confirm `select count(*) from public.orders where order_number = 9001` returns 0 — this row must not reach a real shop's queue.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260811130000_new_order_push_trigger.sql
git commit -m "feat(alerts): pg_net trigger posting new orders to the notify route"
```

---

### Task 5: Enrolment banner on the orders dashboard

**Files:**
- Create: `src/components/dashboard/order-alerts-banner.tsx`
- Modify: `src/lib/i18n.ts` (six keys)
- Modify: `src/components/dashboard/dashboard-shell.tsx:288` (render the banner above the existing enable-sound button)

**Interfaces:**
- Consumes: `isPushSupported()` and `subscribeToPush(vapidPublicKey)` from `src/lib/push.ts`; `attach_staff_push_device` RPC from Task 1; `createClient()` from `src/lib/supabase/client.ts`.
- Produces: `<OrderAlertsBanner shopId={string} />`.

- [ ] **Step 1: Add the i18n keys**

In `src/lib/i18n.ts`, below the `push.newOrder*` keys from Task 2:

```ts
  "alerts.title": "Turn on order alerts",
  "alerts.body": "Get a notification the moment an order comes in, even with this page closed.",
  "alerts.button": "Turn on alerts",
  "alerts.enabled": "Order alerts are on for this device.",
  "alerts.error": "Couldn't turn on alerts. Try again.",
  "alerts.installFirst": "Add OrderNook to your Home Screen first, then open it from there to turn on order alerts.",
  "alerts.dismiss": "Dismiss",
```

- [ ] **Step 2: Write the component**

Create `src/components/dashboard/order-alerts-banner.tsx`:

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { BellRingIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { t } from "@/lib/i18n"
import { isPushSupported, subscribeToPush } from "@/lib/push"
import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/lib/database.types"

type State =
  | "checking"
  | "idle"
  | "working"
  | "enabled"
  | "error"
  | "needsInstall"
  | "hidden"

const DISMISS_KEY = "on-alerts-dismissed"

/**
 * iOS only delivers web push to an installed home-screen PWA (16.4+), and
 * isPushSupported() returns false in mobile Safari. Detect that case
 * explicitly so we can show the install instruction rather than silently
 * rendering nothing to the users who most need telling.
 */
function isIosOutsideStandalone(): boolean {
  const ua = window.navigator.userAgent
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as a Mac; the touch points disambiguate it.
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
  if (!isIos) return false
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  return !standalone
}

function deviceLabel(): string {
  const ua = window.navigator.userAgent
  if (/iPhone/.test(ua)) return "iPhone"
  if (/iPad/.test(ua)) return "iPad"
  if (/Android/.test(ua)) return "Android device"
  return "Desktop"
}

export function OrderAlertsBanner({ shopId }: { shopId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<State>("checking")

  useEffect(() => {
    let cancelled = false

    const decide = async () => {
      if (window.localStorage.getItem(DISMISS_KEY)) return setState("hidden")
      if (isIosOutsideStandalone()) return setState("needsInstall")
      if (!isPushSupported()) return setState("hidden")
      if (Notification.permission === "denied") return setState("hidden")

      // Ask the browser, not localStorage — this survives a cleared cache
      // and reflects the subscription's real state.
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        const existing = await registration?.pushManager.getSubscription()
        if (!cancelled) setState(existing ? "hidden" : "idle")
      } catch {
        if (!cancelled) setState("idle")
      }
    }

    void decide()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = async () => {
    setState("working")
    try {
      const subscription = await subscribeToPush(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      )
      if (!subscription) {
        // Permission refused — nothing more to offer on this device.
        setState("hidden")
        return
      }
      const { error } = await supabase.rpc("attach_staff_push_device", {
        p_shop_id: shopId,
        p_subscription: subscription as unknown as Json,
        p_label: deviceLabel(),
      })
      if (error) throw error
      setState("enabled")
    } catch {
      setState("error")
    }
  }

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1")
    setState("hidden")
  }

  if (state === "checking" || state === "hidden") return null

  const message =
    state === "enabled"
      ? t("alerts.enabled")
      : state === "error"
        ? t("alerts.error")
        : state === "needsInstall"
          ? t("alerts.installFirst")
          : t("alerts.body")

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
        <BellRingIcon className="size-5" />
      </span>
      <div className="flex-1">
        <p className="font-medium">{t("alerts.title")}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{message}</p>
        {(state === "idle" || state === "working" || state === "error") && (
          <Button
            type="button"
            className="mt-3 h-11 rounded-full"
            disabled={state === "working"}
            onClick={enable}
          >
            {t("alerts.button")}
          </Button>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        aria-label={t("alerts.dismiss")}
        className="size-11 shrink-0 rounded-full"
        onClick={dismiss}
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Wire it into the dashboard**

In `src/components/dashboard/dashboard-shell.tsx`, add the import alongside the other dashboard component imports:

```tsx
import { OrderAlertsBanner } from "@/components/dashboard/order-alerts-banner"
```

Then inside `<main>` at line 288, immediately **above** the existing `{!unlocked && !muted && (` block:

```tsx
        <OrderAlertsBanner shopId={shop.id} />
```

- [ ] **Step 4: Typecheck, lint, and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all three clean. The build must pass because `SwRegister` is production-only — the banner cannot be exercised via `next dev`.

- [ ] **Step 5: Verify in a production build**

Run: `npm run build && npm start`
Open `http://localhost:3000/dashboard`, log in as `SHOP_A` (`owner@cornergrind.test`, password in `.env.test`).
Expected: the banner renders with a working "Turn on alerts" button; clicking it prompts for notification permission; after granting, the banner text switches to "Order alerts are on for this device."

Then confirm the row landed:

```sql
select label, endpoint, created_at from public.staff_push_devices;
```

Expected: one row labelled "Desktop".

- [ ] **Step 6: Verify the banner hides on reload**

Reload `/dashboard`.
Expected: no banner — `getSubscription()` now returns a subscription.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/order-alerts-banner.tsx src/components/dashboard/dashboard-shell.tsx src/lib/i18n.ts
git commit -m "feat(alerts): order alerts enrolment banner on the dashboard"
```

---

### Task 6: Deploy and prove it on real hardware

**Files:** none — configuration and verification only.

**Interfaces:**
- Consumes: everything from Tasks 1–5.

The trigger is inert until both secrets exist, so the order of these steps matters.

- [ ] **Step 1: Set the Vercel production secret**

Use the same value generated in Task 4 Step 2:

```bash
npx vercel env add NOTIFY_SHARED_SECRET production
```

Expected: the variable appears in `npx vercel env ls production`.

- [ ] **Step 2: Confirm the Vault secrets are present**

Run via the Supabase MCP `execute_sql`:

```sql
select name, created_at from vault.secrets
where name in ('ordernook_notify_url', 'ordernook_notify_secret');
```

Expected: two rows. Do not select `decrypted_secret` — the value must not enter the transcript.

- [ ] **Step 3: Deploy**

Push to `master` (Vercel is git-connected and auto-deploys production from that branch):

```bash
git push origin master
```

Expected: a new production deployment reaching `READY`. Confirm with `npx vercel ls` or the deployment list.

- [ ] **Step 4: Verify the route rejects an unauthenticated call in production**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://ordernook.uk/api/notify-new-order -H "Content-Type: application/json" -d '{"order_id":"00000000-0000-0000-0000-000000000000"}'
```

Expected: `401`.

- [ ] **Step 5: Enrol the real device**

On an iPhone: open `https://ordernook.uk/dashboard`, log in, **Share → Add to Home Screen**, then open OrderNook from the home screen icon.
Expected: the banner shows the install instruction in Safari, and the working "Turn on alerts" button once opened from the home screen. Grant permission.

Confirm:

```sql
select label, created_at from public.staff_push_devices order by created_at desc;
```

Expected: a row labelled "iPhone".

- [ ] **Step 6: Acceptance test — the whole point of this work**

**Close the OrderNook app on the iPhone completely** (swipe it out of the app switcher; do not merely background it).
On another device, place an order on `https://ordernook.uk/corner-grind`.

Expected: a notification arrives on the iPhone titled `New order #N — £X.XX` with body `Pay on collection`. Tapping it opens the dashboard queue with the order visible.

- [ ] **Step 7: Acceptance test — the paid-online variant**

Repeat on a shop with online payments enabled (`kwadube-meals-on-wheels` is the only one with `charges_enabled=true`), paying by card.

Expected: the notification body reads `Paid online`, and it arrives only **after** payment completes — not when checkout starts.

- [ ] **Step 8: Update project state**

Append to `state.md` and `roadmap.md`: shop-side order alerts shipped; the landing page's push claim is now true. Also correct the stale "Phase 2B built + merged, NOT deployed" lines in `handoff.md:6` and `roadmap.md:7` — Phase 2B has been live since 7 Aug.

- [ ] **Step 9: Commit**

```bash
git add state.md roadmap.md handoff.md
git commit -m "docs: shop order alerts shipped; correct stale Phase 2B deploy status"
git push origin master
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| 1 · Data model (table, RLS, RPC) | 1 |
| 2 · Trigger (pg_net, Vault, dual triggers) | 4 |
| 3 · Route (secret, service role, prune, payload) | 2, 3 |
| 4 · Enrolment UI (banner, getSubscription, iOS branch) | 5 |
| 5 · Service worker (no changes) | — correctly absent |
| 6 · Error handling (401, isolation, pruning, raise log) | 3, 4 |
| 7 · Testing (unit, RLS, auth guard, trigger, acceptance) | 1, 2, 3, 4, 6 |
| 8 · Deployment notes (ordered) | 6 |

No gaps.

**Type consistency:** `buildOrderAlert` is defined in Task 2 and consumed in Task 3 with matching field names (`orderNumber`, `totalMinor`, `currency`, `paymentMode`). `secretMatches(provided, expected)` is defined and consumed with the same two-argument shape. `attach_staff_push_device(p_shop_id, p_subscription, p_label)` uses identical parameter names in Tasks 1, 5. The table columns written in Task 1 are exactly those read in Task 3.

**Deviation from spec, deliberate:** the spec described one trigger; this plan uses two. Postgres forbids `OLD` in an INSERT trigger's `WHEN` clause and offers no `tg_op` there, so the single-trigger form fails at creation. Behaviour is identical.
