# Phase 2A — Shop Subscriptions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 30-day trial then Basic £12/mo (Stripe Billing); unentitled shops → dashboard locked + public ordering paused + `create_order` rejected.

**Architecture:** Plain Stripe Billing (not Connect). New `shops` fields (`stripe_customer_id`, `trial_ends_at`) + a SQL `is_entitled()` helper gate `create_order` and the UI. Routes `checkout`/`portal`/`webhook` (webhook writes via a service-role client). Dashboard gated by a `layout.tsx` LockScreen; public page reuses the existing paused state.

**Tech Stack:** `stripe` SDK, Supabase (anon + new service-role client), Next 16 route handlers (`runtime = "nodejs"`), Stripe test mode for verification.

## Global Constraints

- **Dedicated OrderNook Stripe account** (per-app; NOT BookOnTheMap). Basic product/price created there; ids/keys from there.
- **Env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (secrets — Lloyd sets in `.env.local` + Vercel); `STRIPE_BASIC_PRICE_ID`, `NEXT_PUBLIC_APP_URL` (not secret). Code must **build cleanly without them** (lazy Stripe client).
- **Entitlement:** entitled iff `subscription_status='active'` OR (`='trialing'` AND `trial_ends_at` in future). One SQL helper `public.is_entitled(uuid)`; one TS mirror `isEntitled(shop)`.
- **Basic only** (Pro shown "coming soon", not sellable). Money GBP, minor units.
- **Webhook** verified by Stripe signature; only it (service role) writes billing fields. `create_order` untouched except the entitlement gate.
- After each code step: `npm run build` clean.

---

### Task 1: Migration — subscription fields, entitlement helper, `create_order` gate, pilot backfill

**Files:**
- Create: `supabase/migrations/20260802010000_shop_subscriptions.sql`

**Interfaces:**
- Produces: `shops.stripe_customer_id`, `shops.trial_ends_at`; `public.is_entitled(p_shop_id uuid) returns boolean`; `create_order` raises `not_entitled` when the shop is locked.

- [ ] **Step 1: Write the migration**

```sql
-- Phase 2A: shop subscriptions (Stripe Billing).
alter table public.shops
  add column if not exists stripe_customer_id text,
  add column if not exists trial_ends_at timestamptz;

-- Backfill: 30-day trial from creation for existing shops.
update public.shops set trial_ends_at = created_at + interval '30 days'
  where trial_ends_at is null;

-- Keep the two live pilots unlocked well past ship.
update public.shops set trial_ends_at = timestamptz '2027-01-01 00:00:00+00'
  where slug in ('corner-grind', 'pilot-test');

-- New shops get a 30-day trial by default.
alter table public.shops
  alter column trial_ends_at set default (now() + interval '30 days');

-- Entitlement: active, or still within a trial.
create or replace function public.is_entitled(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shops s
    where s.id = p_shop_id
      and (
        s.subscription_status = 'active'
        or (s.subscription_status = 'trialing' and s.trial_ends_at > now())
      )
  );
$$;
```

Then append a `create_order` gate. Read the current `create_order` body from `supabase/migrations/20260711143434_fix_create_order_currency.sql`, copy it into this migration verbatim, and insert — immediately after `v_shop` is resolved (the `select ... into v_shop from shops where slug = p_shop_slug` and its `if not found` guard) — this check:

```sql
  if not public.is_entitled(v_shop.id) then
    raise exception 'not_entitled';
  end if;
```

(Placing the whole `create or replace function public.create_order(...)` again with this line added keeps the RPC's other logic identical.)

- [ ] **Step 2: Apply to remote**

Run: `supabase db push`
Expected: applies with no error. If the CLI prompts, confirm.

- [ ] **Step 3: Verify the helper + gate against the live DB**

Run (via the authenticated node pattern used in `tests/`, or `supabase` SQL): confirm `is_entitled(corner-grind's id)` returns `true` (pilot, far-future trial), and that setting a throwaway shop's `subscription_status='canceled'` makes it `false`. Confirm `create_order` on a non-entitled shop raises `not_entitled` (a canceled test shop) and still works for corner-grind.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260802010000_shop_subscriptions.sql
git commit -m "$(cat <<'EOF'
feat(billing): shop subscription fields + is_entitled gate

Adds shops.stripe_customer_id + trial_ends_at (30-day trial, pilots
backfilled far-future); is_entitled() helper; create_order rejects
non-entitled shops. Applied to remote via db push.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Stripe client, service-role Supabase client, entitlement TS helper

**Files:**
- Create: `src/lib/stripe.ts`, `src/lib/supabase/admin.ts`, `src/lib/entitlement.ts`

**Interfaces:**
- Produces: `getStripe(): Stripe`; `createAdminClient(): SupabaseClient` (service role, bypasses RLS); `isEntitled(shop): boolean`.

- [ ] **Step 1: Install the SDK**

Run: `npm install stripe`

- [ ] **Step 2: Lazy Stripe client** — `src/lib/stripe.ts`

```ts
import Stripe from "stripe"

// Lazy: route modules import this at BUILD time, but the secret key is only
// present at RUNTIME. Constructing eagerly would break `next build` without it.
let client: Stripe | null = null

export function getStripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!)
  return client
}
```

- [ ] **Step 3: Service-role Supabase client** — `src/lib/supabase/admin.ts`

```ts
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

// Service-role client for the Stripe webhook (no user session; must bypass RLS
// to write billing fields). Server-only — never import into client components.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
```

- [ ] **Step 4: Entitlement TS mirror** — `src/lib/entitlement.ts`

```ts
import type { Tables } from "@/lib/database.types"

// Mirrors the SQL public.is_entitled(): active, or still within trial.
export function isEntitled(
  shop: Pick<Tables<"shops">, "subscription_status" | "trial_ends_at">
): boolean {
  if (shop.subscription_status === "active") return true
  if (shop.subscription_status === "trialing" && shop.trial_ends_at) {
    return new Date(shop.trial_ends_at).getTime() > Date.now()
  }
  return false
}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: clean (lazy client → no missing-env crash). Then `npm run lint` on the three files — clean.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/stripe.ts src/lib/supabase/admin.ts src/lib/entitlement.ts
git commit -m "$(cat <<'EOF'
feat(billing): stripe client, service-role client, entitlement helper

Lazy getStripe(); createAdminClient() (service role, webhook-only);
isEntitled() TS mirror of the SQL helper.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Checkout + Portal routes

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/portal/route.ts`

**Interfaces:**
- Consumes: `getStripe()` (Task 2); `getStaffShop()` from `@/lib/dashboard`.
- Produces: `POST /api/stripe/checkout` → `{ url }`; `POST /api/stripe/portal` → `{ url }`.

- [ ] **Step 1: Checkout route** — `src/app/api/stripe/checkout/route.ts`

```ts
import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe"

export const runtime = "nodejs"

export async function POST() {
  const shop = await getStaffShop()
  if (!shop) return NextResponse.json({ error: "no_shop" }, { status: 401 })

  const price = process.env.STRIPE_BASIC_PRICE_ID
  if (!price) return NextResponse.json({ error: "no_price" }, { status: 500 })

  const site = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const stripe = getStripe()

  // Ensure the shop has a Stripe customer.
  let customerId = shop.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: shop.name,
      metadata: { shop_id: shop.id, shop_slug: shop.slug },
    })
    customerId = customer.id
    const supabase = await createClient()
    await supabase.from("shops").update({ stripe_customer_id: customerId }).eq("id", shop.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${site}/dashboard/settings?subscribed=1`,
    cancel_url: `${site}/dashboard/settings`,
    metadata: { shop_id: shop.id },
    subscription_data: { metadata: { shop_id: shop.id } },
  })

  return NextResponse.json({ url: session.url })
}
```

- [ ] **Step 2: Portal route** — `src/app/api/stripe/portal/route.ts`

```ts
import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { getStripe } from "@/lib/stripe"

export const runtime = "nodejs"

export async function POST() {
  const shop = await getStaffShop()
  if (!shop) return NextResponse.json({ error: "no_shop" }, { status: 401 })
  if (!shop.stripe_customer_id)
    return NextResponse.json({ error: "no_customer" }, { status: 400 })

  const site = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const session = await getStripe().billingPortal.sessions.create({
    customer: shop.stripe_customer_id,
    return_url: `${site}/dashboard/settings`,
  })
  return NextResponse.json({ url: session.url })
}
```

- [ ] **Step 3: Build + lint** — Run: `npm run build` then `npm run lint` on both files. Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts src/app/api/stripe/portal/route.ts
git commit -m "$(cat <<'EOF'
feat(billing): stripe checkout + customer portal routes

Checkout creates/reuses the shop's Stripe customer and opens hosted
subscription Checkout for the Basic price; portal opens the billing portal.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Webhook route

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `getStripe()`, `createAdminClient()` (Task 2).
- Produces: `POST /api/stripe/webhook` — syncs `shops` billing fields from Stripe events.

- [ ] **Step 1: Webhook route** — `src/app/api/stripe/webhook/route.ts`

```ts
import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature")
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) return NextResponse.json({ error: "config" }, { status: 400 })

  const raw = await request.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret)
  } catch {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const byCustomer = (customerId: string, fields: Record<string, unknown>) =>
    supabase.from("shops").update(fields).eq("stripe_customer_id", customerId)

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session
      const shopId = s.metadata?.shop_id
      if (shopId) {
        await supabase
          .from("shops")
          .update({
            subscription_status: "active",
            plan_tier: "basic",
            stripe_subscription_id: (s.subscription as string) ?? null,
            stripe_customer_id: (s.customer as string) ?? null,
          })
          .eq("id", shopId)
      }
      break
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      const active = sub.status === "active" || sub.status === "trialing"
      await byCustomer(sub.customer as string, {
        subscription_status:
          sub.status === "past_due" ? "past_due" : active ? "active" : "canceled",
        stripe_subscription_id: sub.id,
        plan_tier: "basic",
      })
      break
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice
      if (inv.customer) await byCustomer(inv.customer as string, { subscription_status: "past_due" })
      break
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      await byCustomer(sub.customer as string, { subscription_status: "canceled" })
      break
    }
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 2: Build + lint** — clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "$(cat <<'EOF'
feat(billing): stripe webhook syncs shop subscription state

Signature-verified; service-role writes. checkout.session.completed →
active; subscription.updated → status map; payment_failed → past_due;
subscription.deleted → canceled.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Dashboard lock (layout gate) + PlanCard

**Files:**
- Create: `src/app/dashboard/layout.tsx`, `src/components/dashboard/lock-screen.tsx`, `src/components/dashboard/plan-card.tsx`
- Modify: `src/components/dashboard/shop-settings.tsx` (mount `PlanCard`), `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `getStaffShop()`, `isEntitled()` (Task 2).
- Produces: dashboard routes gated behind `LockScreen` when not entitled; a `PlanCard` (Subscribe / Manage / trial days) in Settings.

- [ ] **Step 1: i18n keys** — add to `src/lib/i18n.ts` before `} as const`:

```ts
  "billing.plan": "Plan",
  "billing.basic": "Basic — £12/mo",
  "billing.proSoon": "Pro — coming soon",
  "billing.trialLeft": "Trial: {days} days left",
  "billing.trialEnded": "Your free trial has ended",
  "billing.status": "Status",
  "billing.subscribe": "Subscribe",
  "billing.manage": "Manage billing",
  "billing.opening": "Opening…",
  "billing.lockTitle": "Subscribe to keep taking orders",
  "billing.lockBody": "Your OrderNook trial has ended. Subscribe to Basic (£12/mo) to unlock your dashboard and start taking orders again.",
  "billing.failed": "Couldn't open billing — try again.",
```

- [ ] **Step 2: LockScreen** — `src/components/dashboard/lock-screen.tsx`

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { t } from "@/lib/i18n"

async function go(path: string) {
  const res = await fetch(path, { method: "POST" })
  const { url } = (await res.json().catch(() => ({}))) as { url?: string }
  if (url) window.location.href = url
  else toast.error(t("billing.failed"))
}

export function LockScreen({ hasCustomer }: { hasCustomer: boolean }) {
  const [busy, setBusy] = useState(false)
  const run = async (path: string) => {
    setBusy(true)
    await go(path)
    setBusy(false)
  }
  return (
    <main className="theme-travo mx-auto flex min-h-[70dvh] max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-2xl font-semibold">{t("billing.lockTitle")}</h1>
      <p className="text-muted-foreground">{t("billing.lockBody")}</p>
      <Button className="h-12 w-full rounded-full text-base" disabled={busy} onClick={() => run("/api/stripe/checkout")}>
        {busy ? t("billing.opening") : t("billing.subscribe")}
      </Button>
      {hasCustomer && (
        <Button variant="ghost" className="rounded-full" disabled={busy} onClick={() => run("/api/stripe/portal")}>
          {t("billing.manage")}
        </Button>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Dashboard layout gate** — `src/app/dashboard/layout.tsx`

```tsx
import { getStaffShop } from "@/lib/dashboard"
import { isEntitled } from "@/lib/entitlement"
import { LockScreen } from "@/components/dashboard/lock-screen"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const shop = await getStaffShop()
  // Not linked to a shop, or entitled → render normally. Locked → LockScreen.
  if (shop && !isEntitled(shop)) {
    return <LockScreen hasCustomer={!!shop.stripe_customer_id} />
  }
  return <>{children}</>
}
```
Note: the existing `/dashboard/login` route is outside `/dashboard`'s authed area? It's at `src/app/dashboard/login` — it WILL be wrapped by this layout. Guard: only lock when `shop` exists (an unauthenticated visitor has no staff shop → `getStaffShop()` returns null → not locked → login renders). Confirmed by the `if (shop && !isEntitled(shop))` condition.

- [ ] **Step 4: PlanCard** — `src/components/dashboard/plan-card.tsx`

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { t } from "@/lib/i18n"
import type { Tables } from "@/lib/database.types"

export function PlanCard({ shop }: { shop: Tables<"shops"> }) {
  const [busy, setBusy] = useState(false)
  const active = shop.subscription_status === "active"
  const trialDays =
    shop.subscription_status === "trialing" && shop.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(shop.trial_ends_at).getTime() - Date.now()) / 86_400_000))
      : null

  const open = async (path: string) => {
    setBusy(true)
    const res = await fetch(path, { method: "POST" })
    const { url } = (await res.json().catch(() => ({}))) as { url?: string }
    setBusy(false)
    if (url) window.location.href = url
    else toast.error(t("billing.failed"))
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <Label>{t("billing.plan")}</Label>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{t("billing.basic")}</span>
        <span className="text-muted-foreground">
          {active ? t("billing.status") + ": active" : trialDays !== null ? t("billing.trialLeft", { days: trialDays }) : t("billing.trialEnded")}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t("billing.proSoon")}</p>
      {active ? (
        <Button variant="ghost" className="h-11 w-fit rounded-full px-6" disabled={busy} onClick={() => open("/api/stripe/portal")}>
          {busy ? t("billing.opening") : t("billing.manage")}
        </Button>
      ) : (
        <Button className="h-11 w-fit rounded-full px-6" disabled={busy} onClick={() => open("/api/stripe/checkout")}>
          {busy ? t("billing.opening") : t("billing.subscribe")}
        </Button>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Mount PlanCard in Settings**

Read `src/components/dashboard/shop-settings.tsx` and its page. Pass the `shop` (already fetched via `getStaffShop()` in `src/app/dashboard/settings/page.tsx`) into `PlanCard` and render `<PlanCard shop={shop} />` at the top of the settings content. (If settings is a client component, thread the shop fields it needs through props from the server page.)

- [ ] **Step 6: Build + lint + browser-verify the lock (no Stripe needed)**

Run `npm run build`/`npm run lint` — clean. Then start dev and verify **without Stripe** by flipping entitlement in the DB:
- Set a **throwaway** test shop's `trial_ends_at` to the past + `subscription_status='trialing'` → its dashboard shows the LockScreen; corner-grind (far-future trial) still loads normally with a PlanCard showing trial days.
- Restore the test shop afterward. (Do NOT lock corner-grind/pilot-test.)

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/layout.tsx src/components/dashboard/lock-screen.tsx src/components/dashboard/plan-card.tsx src/components/dashboard/shop-settings.tsx src/lib/i18n.ts
git commit -m "$(cat <<'EOF'
feat(billing): dashboard lock screen + plan card

Dashboard layout gates unentitled shops behind a LockScreen (Subscribe /
Manage); Settings gains a PlanCard (trial days, subscribe/manage). Pro shown
as coming soon.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Public page — pause ordering when not entitled

**Files:**
- Modify: `src/app/[slug]/page.tsx` (compute paused), `src/components/shop/menu-page.tsx` (respect a paused flag if not already)

**Interfaces:**
- Consumes: `isEntitled()`.

- [ ] **Step 1: Compute paused from entitlement**

In `src/app/[slug]/page.tsx`, after fetching the shop, treat a non-entitled shop as paused. Find where `is_paused` / the paused state is passed to `MenuPage` and OR it with `!isEntitled(shop)`:

```ts
import { isEntitled } from "@/lib/entitlement"
// ...
const paused = shop.is_paused || !isEntitled(shop)
```
Pass `paused` into `MenuPage` (the component already renders the paused UI from `menu.paused.title/body`). If `MenuPage` currently reads `shop.is_paused` directly, add a `paused` prop and use it instead so entitlement folds in.

- [ ] **Step 2: Build + browser-verify**

`npm run build` clean. In the browser, with the throwaway test shop set non-entitled (from Task 5): its `/[slug]` shows the paused "not taking orders" state; `create_order` there already rejects (Task 1). corner-grind unaffected. Restore the test shop.

- [ ] **Step 3: Commit**

```bash
git add src/app/[slug]/page.tsx src/components/shop/menu-page.tsx
git commit -m "$(cat <<'EOF'
feat(billing): pause public ordering for unentitled shops

A locked shop's public page shows the paused state (menu visible, not taking
orders); create_order already rejects server-side.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Stripe wiring + end-to-end verification (needs Lloyd's OrderNook account)

**Files:** none (Stripe setup + env + deploy).

**Dependency:** the dedicated **OrderNook Stripe account** with Basic product/price (live + test), a webhook endpoint, and keys.

- [ ] **Step 1: Lloyd — create the account + product + webhook**

- Create the **OrderNook** account under Zizwe IT (account switcher → Create account).
- In **test** mode: create "OrderNook Basic" product + £12/mo GBP recurring price → note the **test** price id.
- In **live** mode: same → note the **live** price id.
- Add a webhook endpoint `https://ordernook.uk/api/stripe/webhook` (events: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`) → note the **signing secret** (test + live).

- [ ] **Step 2: Set env**

Local `.env.local` (test keys): `STRIPE_SECRET_KEY` (test), `STRIPE_WEBHOOK_SECRET` (from `stripe listen` or the test endpoint), `STRIPE_BASIC_PRICE_ID` (test price), `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
Vercel (prod): live `STRIPE_SECRET_KEY`, live `STRIPE_WEBHOOK_SECRET`, live `STRIPE_BASIC_PRICE_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL=https://ordernook.uk`.

- [ ] **Step 3: Verify in test mode**

With `stripe listen --forward-to localhost:3000/api/stripe/webhook` running: subscribe a **test** shop via the LockScreen/PlanCard → Checkout with card `4242 4242 4242 4242` → webhook flips `subscription_status='active'` → dashboard unlocks, PlanCard shows active. Cancel via the Portal → `subscription.deleted` → status `canceled` → dashboard locks + public page pauses. Set trial past → locked.

- [ ] **Step 4: Deploy + prod smoke**

`git push origin master && vercel --prod --yes`. Confirm ordernook.uk healthy; a real subscribe is optional (real £12 charge) — the pilots are on far-future trials, so nothing locks.

- [ ] **Step 5: Update state/roadmap docs + commit.**

---

## Self-Review

**Spec coverage:** trial+entitlement (T1) ✓; data model + backfill + pilots (T1) ✓; `create_order` gate (T1) ✓; Stripe/admin/entitlement helpers (T2) ✓; checkout/portal (T3) ✓; webhook (T4) ✓; dashboard hard lock (T5) ✓; PlanCard (T5) ✓; public pause (T6) ✓; Basic-only / Pro coming-soon (T5 PlanCard) ✓; env/secrets + verification (T7) ✓. No gaps.

**Placeholder scan:** the migration reuses the existing `create_order` body (Task 1 Step 1 says copy it verbatim + add one line) — not a placeholder, an explicit instruction against a named source file. All route/UI code is complete. No TBD/TODO.

**Type consistency:** `isEntitled(shop)` signature (`Pick<Tables<"shops">, "subscription_status" | "trial_ends_at">`) matches its call sites (layout passes the full shop; `[slug]` passes the shop). `getStripe()` / `createAdminClient()` names match across T3/T4. `STRIPE_BASIC_PRICE_ID` used in T3 + set in T7. `shop.stripe_customer_id` field (T1) used in T3/T5. Webhook updates match the columns added in T1. Consistent.
