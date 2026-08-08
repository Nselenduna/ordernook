# Account Links Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace OrderNook's broken Stripe Connect OAuth onboarding with Stripe's recommended Account Links flow, gated on the connected account being able to charge.

**Architecture:** Keep the three existing routes (`connect/start`, `connect/callback`, `connect/disconnect`) and the `OnlinePaymentsCard`, swapping only the onboarding mechanism. Add a `stripe_charges_enabled` flag to `shops`, synced on return from onboarding and via the `account.updated` Connect webhook. Pure decision logic lives in `src/lib/connect.ts` and is unit-tested; Stripe I/O in the routes is verified by the live run-through.

**Tech Stack:** Next.js App Router (route handlers, `runtime = "nodejs"`), Stripe Node SDK (`getStripe()`), Supabase (admin client + SECURITY DEFINER RPC/trigger), Vitest (integration tests against the live Supabase project `iryavyogljedwgllaoit`).

## Global Constraints

- Stripe account model: **Standard** (`type: 'standard'`), country `GB`. Café gets a full Stripe dashboard, café pays Stripe fees, OrderNook takes **zero** commission (direct charges, no `application_fee`).
- Single Supabase project = prod: **`iryavyogljedwgllaoit`** (eu-west-2, Zizwe org). Apply migrations there via the repo's established method (`supabase db push`, CLI linked to that ref).
- Payments/refunds/`create_order`/customer checkout are **out of scope** — do not modify.
- Integration tests hit the live Supabase and mutate the `corner-grind` shop fixture; `vitest.config.ts` runs files serially (`fileParallelism: false`). Every test that mutates `corner-grind` must restore it in `afterAll`/inline.
- Env var already set in Vercel prod: `NEXT_PUBLIC_APP_URL=https://ordernook.uk`, `STRIPE_SECRET_KEY` (live), `STRIPE_CONNECT_WEBHOOK_SECRET`.
- `getStaffShop` selects `shops(*)`, so new columns need no query change.

---

### Task 1: Migration — `stripe_charges_enabled` column + charge-gated online payments

**Files:**
- Create: `supabase/migrations/20260808120000_stripe_charges_enabled.sql`
- Modify: `tests/set-online-payments.test.ts`

**Interfaces:**
- Produces: column `shops.stripe_charges_enabled boolean not null default false`; RPC `set_online_payments(boolean)` now raises `charges_not_enabled` when the account can't charge; trigger `enforce_online_requires_account` now requires `stripe_charges_enabled is true`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260808120000_stripe_charges_enabled.sql`:

```sql
-- Phase 2B onboarding rebuild (Account Links): a connected account exists as soon
-- as it's created, but can't take charges until Stripe onboarding completes. Gate
-- the 'online' payment mode on charges being enabled, not merely on an account id.

alter table public.shops
  add column if not exists stripe_charges_enabled boolean not null default false;

-- RPC now requires charges to be enabled, not just an account present.
create or replace function public.set_online_payments(p_enabled boolean)
returns public.shops
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_shop public.shops;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select s.* into v_shop
  from public.shops s
  join public.staff_users su on su.shop_id = s.id
  where su.auth_user_id = v_uid
  limit 1;

  if v_shop.id is null then
    raise exception 'no_shop' using errcode = 'P0001';
  end if;

  if p_enabled then
    if v_shop.stripe_account_id is null then
      raise exception 'no_stripe_account' using errcode = 'P0001';
    end if;
    if not v_shop.stripe_charges_enabled then
      raise exception 'charges_not_enabled' using errcode = 'P0001';
    end if;
    update public.shops
      set payment_modes = array(
        select distinct unnest(payment_modes || array['online']::payment_mode[])
      )
      where id = v_shop.id
      returning * into v_shop;
  else
    update public.shops
      set payment_modes = array_remove(payment_modes, 'online'::payment_mode)
      where id = v_shop.id
      returning * into v_shop;
  end if;

  return v_shop;
end;
$$;

revoke all on function public.set_online_payments(boolean) from public, anon;
grant execute on function public.set_online_payments(boolean) to authenticated;

-- Trigger backstop for direct writes: 'online' requires a connected account that
-- can actually charge.
create or replace function public.enforce_online_requires_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.role() in ('authenticated', 'anon')
     and 'online' = any(new.payment_modes)
     and (new.stripe_account_id is null or new.stripe_charges_enabled is not true) then
    raise exception 'online_requires_account' using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;

drop trigger if exists enforce_online_requires_account on public.shops;
create trigger enforce_online_requires_account
  before insert or update on public.shops
  for each row execute function public.enforce_online_requires_account();
```

- [ ] **Step 2: Apply the migration to the prod project**

Run: `supabase db push` (CLI linked to ref `iryavyogljedwgllaoit`).
Expected: the new migration applies cleanly; `supabase migration list` shows local and remote in sync.

- [ ] **Step 3: Update the existing test to provision the charges flag and add a charge-gate test**

In `tests/set-online-payments.test.ts`:

Change `beforeAll` provisioning to set the charges flag:

```ts
    await admin
      .from("shops")
      .update({
        stripe_account_id: "acct_test_connect",
        stripe_charges_enabled: true,
        payment_modes: ["in_store"],
      })
      .eq("slug", "corner-grind")
```

Change `afterAll` reset:

```ts
    await admin
      .from("shops")
      .update({
        stripe_account_id: null,
        stripe_charges_enabled: false,
        payment_modes: ["in_store"],
      })
      .eq("slug", "corner-grind")
```

Add this test immediately after the `"enable without a connected account is rejected"` test:

```ts
  it("enable with an account but charges not enabled is rejected", async () => {
    await admin.from("shops").update({ stripe_charges_enabled: false }).eq("slug", "corner-grind")
    const { error } = await withAcct.rpc("set_online_payments", { p_enabled: true })
    expect(error?.message ?? "").toContain("charges_not_enabled")
    await admin.from("shops").update({ stripe_charges_enabled: true }).eq("slug", "corner-grind")
  })
```

- [ ] **Step 4: Run the suite and verify it passes**

Run: `npx vitest run tests/set-online-payments.test.ts`
Expected: PASS — including the new `charges_not_enabled` case and the existing success/disable cases (which now rely on `stripe_charges_enabled: true`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260808120000_stripe_charges_enabled.sql tests/set-online-payments.test.ts
git commit -m "feat(connect): gate online payments on stripe_charges_enabled"
```

---

### Task 2: Pure connect helpers (`src/lib/connect.ts`)

**Files:**
- Create: `src/lib/connect.ts`
- Test: `tests/connect.test.ts`

**Interfaces:**
- Produces:
  - `type ConnectState = "none" | "pending" | "ready"`
  - `deriveConnectState(shop: { stripe_account_id: string | null; stripe_charges_enabled: boolean | null }): ConnectState`
  - `chargesSyncUpdate(chargesEnabled: boolean, paymentModes: string[]): { stripe_charges_enabled: boolean; payment_modes: string[] }`

- [ ] **Step 1: Write the failing tests**

Create `tests/connect.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { deriveConnectState, chargesSyncUpdate } from "../src/lib/connect"

describe("deriveConnectState", () => {
  it("none when no account", () => {
    expect(deriveConnectState({ stripe_account_id: null, stripe_charges_enabled: false })).toBe("none")
  })
  it("pending when account exists but charges not enabled", () => {
    expect(deriveConnectState({ stripe_account_id: "acct_1", stripe_charges_enabled: false })).toBe("pending")
  })
  it("ready when account exists and charges enabled", () => {
    expect(deriveConnectState({ stripe_account_id: "acct_1", stripe_charges_enabled: true })).toBe("ready")
  })
})

describe("chargesSyncUpdate", () => {
  it("keeps payment_modes when charges enabled", () => {
    expect(chargesSyncUpdate(true, ["in_store", "online"])).toEqual({
      stripe_charges_enabled: true,
      payment_modes: ["in_store", "online"],
    })
  })
  it("removes 'online' when charges disabled", () => {
    expect(chargesSyncUpdate(false, ["in_store", "online"])).toEqual({
      stripe_charges_enabled: false,
      payment_modes: ["in_store"],
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/connect.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/connect'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/connect.ts`:

```ts
export type ConnectState = "none" | "pending" | "ready"

// UI state for a shop's Stripe onboarding. An account can exist before Stripe
// onboarding finishes, so "ready" requires charges to actually be enabled.
export function deriveConnectState(shop: {
  stripe_account_id: string | null
  stripe_charges_enabled: boolean | null
}): ConnectState {
  if (!shop.stripe_account_id) return "none"
  return shop.stripe_charges_enabled ? "ready" : "pending"
}

// DB patch for a charges-status change. When charges are disabled, 'online' must
// be removed from payment_modes so customers aren't offered online pay on an
// account that can't charge.
export function chargesSyncUpdate(
  chargesEnabled: boolean,
  paymentModes: string[]
): { stripe_charges_enabled: boolean; payment_modes: string[] } {
  return {
    stripe_charges_enabled: chargesEnabled,
    payment_modes: chargesEnabled ? paymentModes : paymentModes.filter((m) => m !== "online"),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/connect.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/connect.ts tests/connect.test.ts
git commit -m "feat(connect): pure state + charges-sync helpers"
```

---

### Task 3: `connect/start` — create account + account link (with auto-heal)

**Files:**
- Modify (full rewrite): `src/app/api/stripe/connect/start/route.ts`

**Interfaces:**
- Consumes: `getStaffShop()` (returns shop with `id`, `stripe_account_id`), `getStripe()`, `createAdminClient()`, `process.env.NEXT_PUBLIC_APP_URL`.
- Produces: `GET` handler that redirects the café to a Stripe hosted onboarding URL.

- [ ] **Step 1: Rewrite the route**

Replace the entire contents of `src/app/api/stripe/connect/start/route.ts`:

```ts
import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

// NEXT_PUBLIC_APP_URL is required to build the onboarding return/refresh URLs —
// fail loud instead of silently falling back to localhost in prod.
function site() {
  const s = process.env.NEXT_PUBLIC_APP_URL
  if (!s) throw new Error("NEXT_PUBLIC_APP_URL not set")
  return s
}

export async function GET() {
  if (!process.env.NEXT_PUBLIC_APP_URL)
    return NextResponse.json({ error: "config" }, { status: 500 })

  const shop = await getStaffShop() // redirects to login if no session
  if (!shop) return NextResponse.redirect(new URL("/dashboard", site()))

  const stripe = getStripe()
  const admin = createAdminClient()

  try {
    // Reuse an existing connected account, but auto-heal a stale/test account
    // (e.g. one connected during test-mode dev) that the live key can't use.
    let acct = shop.stripe_account_id
    if (acct) {
      try {
        await stripe.accounts.retrieve(acct)
      } catch {
        acct = null
      }
    }
    if (!acct) {
      const created = await stripe.accounts.create({ type: "standard", country: "GB" })
      acct = created.id
      await admin
        .from("shops")
        .update({ stripe_account_id: acct, stripe_charges_enabled: false })
        .eq("id", shop.id)
    }

    const link = await stripe.accountLinks.create({
      account: acct,
      type: "account_onboarding",
      refresh_url: `${site()}/api/stripe/connect/start`,
      return_url: `${site()}/api/stripe/connect/callback`,
    })
    return NextResponse.redirect(link.url, { status: 303 })
  } catch {
    return NextResponse.redirect(new URL("/dashboard/settings?connect=error", site()))
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors). (Stripe I/O is verified in the live run-through, Task 7 — the codebase does not unit-test route handlers.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/connect/start/route.ts
git commit -m "feat(connect): start route creates account + onboarding link"
```

---

### Task 4: `connect/callback` + `disconnect` — sync charges flag

**Files:**
- Modify (full rewrite): `src/app/api/stripe/connect/callback/route.ts`
- Modify: `src/app/api/stripe/connect/disconnect/route.ts`

**Interfaces:**
- Consumes: `getStaffShop()`, `getStripe()`, `createAdminClient()`.
- Produces: `callback` GET redirects to `/dashboard/settings?connect=success|pending|error`; `disconnect` also resets `stripe_charges_enabled = false`.

- [ ] **Step 1: Rewrite the callback route**

Replace the entire contents of `src/app/api/stripe/connect/callback/route.ts`:

```ts
import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

// Return target from Stripe hosted onboarding. We re-read the account to learn
// whether it can charge yet — the café may return before completing onboarding.
const settings = (q: string, request: Request) =>
  NextResponse.redirect(new URL(`/dashboard/settings?connect=${q}`, request.url))

export async function GET(request: Request) {
  const shop = await getStaffShop()
  if (!shop) return NextResponse.redirect(new URL("/dashboard", request.url))
  if (!shop.stripe_account_id) return settings("error", request)

  try {
    const acct = await getStripe().accounts.retrieve(shop.stripe_account_id)
    const enabled = acct.charges_enabled === true
    const admin = createAdminClient()
    await admin.from("shops").update({ stripe_charges_enabled: enabled }).eq("id", shop.id)
    return settings(enabled ? "success" : "pending", request)
  } catch {
    return settings("error", request)
  }
}
```

- [ ] **Step 2: Update the disconnect route to reset the charges flag**

In `src/app/api/stripe/connect/disconnect/route.ts`, change the update to also clear `stripe_charges_enabled`:

```ts
  await admin
    .from("shops")
    .update({ stripe_account_id: null, stripe_charges_enabled: false, payment_modes: modes })
    .eq("id", shop.id)
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stripe/connect/callback/route.ts src/app/api/stripe/connect/disconnect/route.ts
git commit -m "feat(connect): callback syncs charges_enabled; disconnect resets it"
```

---

### Task 5: Connect webhook — handle `account.updated`

**Files:**
- Modify: `src/app/api/stripe/connect-webhook/route.ts`

**Interfaces:**
- Consumes: `chargesSyncUpdate` from `@/lib/connect` (Task 2), existing `getStripe()`, `createAdminClient()`.
- Produces: on `account.updated`, updates the matching shop's `stripe_charges_enabled` and strips `'online'` from `payment_modes` when charges are disabled.

- [ ] **Step 1: Add the `account.updated` branch**

In `src/app/api/stripe/connect-webhook/route.ts`, add the import at the top:

```ts
import { chargesSyncUpdate } from "@/lib/connect"
```

Then, immediately before the final `return NextResponse.json({ received: true })`, add:

```ts
  if (event.type === "account.updated") {
    const acct = event.data.object as Stripe.Account
    const admin = createAdminClient()
    const { data: shop } = await admin
      .from("shops")
      .select("id, payment_modes")
      .eq("stripe_account_id", acct.id)
      .maybeSingle()
    if (shop) {
      const patch = chargesSyncUpdate(acct.charges_enabled === true, shop.payment_modes ?? [])
      await admin.from("shops").update(patch).eq("id", shop.id)
    }
  }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/connect-webhook/route.ts
git commit -m "feat(connect): sync charges_enabled via account.updated webhook"
```

---

### Task 6: UI — `OnlinePaymentsCard` three states + i18n + pending toast

**Files:**
- Modify: `src/components/dashboard/online-payments-card.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`
- Modify: `src/lib/i18n.ts`
- Modify: `src/components/dashboard/connect-toast.tsx`

**Interfaces:**
- Consumes: `deriveConnectState` from `@/lib/connect` (Task 2).
- Produces: `OnlinePaymentsCard` renders none/pending/ready states from a `state: ConnectState` prop.

- [ ] **Step 1: Add i18n keys**

In `src/lib/i18n.ts`, add these keys alongside the existing `settings.online.*` block (after `"settings.online.connect"`):

```ts
  "settings.online.setup": "Set up payments",
  "settings.online.finishSetup": "Finish setup",
  "settings.online.pending": "Verification pending — finish setup in Stripe to accept payments.",
  "settings.online.ready": "Ready to accept payments ✓",
  "settings.online.connectPending": "Almost there — finish verification in Stripe to accept payments.",
```

- [ ] **Step 2: Pass state into the card from the settings page**

In `src/app/dashboard/settings/page.tsx`, add the import:

```ts
import { deriveConnectState } from "@/lib/connect";
```

Replace the `<OnlinePaymentsCard ... />` usage with:

```tsx
        <OnlinePaymentsCard
          state={deriveConnectState(shop)}
          onlineEnabled={(shop.payment_modes ?? []).includes("online")}
        />
```

- [ ] **Step 3: Rewrite the card for three states**

Replace the props and the `!connected` conditional in `src/components/dashboard/online-payments-card.tsx`. Change the component signature to:

```tsx
import type { ConnectState } from "@/lib/connect"

export function OnlinePaymentsCard({
  state,
  onlineEnabled,
}: {
  state: ConnectState
  onlineEnabled: boolean
}) {
```

Replace the render branch (the `{!connected ? (...) : (...)}` block) with:

```tsx
      {state === "none" ? (
        <a
          href="/api/stripe/connect/start"
          className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          {t("settings.online.setup")}
        </a>
      ) : state === "pending" ? (
        <div className="flex flex-col gap-3">
          <span className="text-sm text-muted-foreground">{t("settings.online.pending")}</span>
          <a
            href="/api/stripe/connect/start"
            className="inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            {t("settings.online.finishSetup")}
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-(--status-ready)">
            {t("settings.online.ready")}
          </span>
          <div className="flex items-center justify-between">
            <span id="accept-online-label" className="text-sm">
              {t("settings.online.accept")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-labelledby="accept-online-label"
              disabled={toggling}
              onClick={toggle}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
                enabled ? "bg-(--status-ready) text-white" : "bg-muted text-foreground"
              )}
            >
              {t(enabled ? "settings.online.on" : "settings.online.off")}
            </button>
          </div>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="self-start text-sm text-muted-foreground underline"
          >
            {t("settings.online.disconnect")}
          </button>
        </div>
      )}
```

Leave the `toggle`, `disconnect`, `enabled`, `busy`, `toggling` hooks and the outer `<section>`/heading unchanged.

- [ ] **Step 4: Add the pending case to ConnectToast**

In `src/components/dashboard/connect-toast.tsx`, add a `pending` branch to the `useEffect` chain. Change:

```tsx
    if (status === "success") toast.success(t("settings.online.connectSuccess"))
    else if (status === "cancelled") toast(t("settings.online.connectCancelled"))
    else if (status === "error") toast.error(t("settings.online.connectError"))
```

to:

```tsx
    if (status === "success") toast.success(t("settings.online.connectSuccess"))
    else if (status === "pending") toast(t("settings.online.connectPending"))
    else if (status === "cancelled") toast(t("settings.online.connectCancelled"))
    else if (status === "error") toast.error(t("settings.online.connectError"))
```

- [ ] **Step 5: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS — no type errors, production build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/online-payments-card.tsx src/app/dashboard/settings/page.tsx src/lib/i18n.ts src/components/dashboard/connect-toast.tsx
git commit -m "feat(connect): three-state onboarding card + pending toast"
```

---

### Task 7: Deploy, wire the webhook event, and live run-through

**Files:** none (deploy + Stripe dashboard + manual verification).

- [ ] **Step 1: Push and deploy**

Run: `git push origin master`
Expected: Vercel auto-deploys `ordernook` to production; deployment reaches **Ready**.

- [ ] **Step 2: Add `account.updated` to the Connect webhook**

In the Stripe Dashboard (account `acct_1U0RkqDeO3cMpMIL`, **live**): open the existing **Connected accounts** event destination pointed at `https://ordernook.uk/api/stripe/connect-webhook` and add the event **`account.updated`** (keep `checkout.session.completed`).

- [ ] **Step 3: Live run-through**

On `https://ordernook.uk`, in a shop dashboard:
1. Settings → **Set up payments** → complete Stripe hosted onboarding with a real (live) Standard account.
2. On return, confirm the card shows **Ready** (or **Verification pending** if Stripe still needs info — finish it, then it flips to Ready, driven by the `account.updated` webhook).
3. Toggle **online payments on** (should succeed only in the Ready state).
4. As a customer, place an order → pay with a real card → confirm the order flips to `new`.
5. As the shop, **reject** the paid order → confirm the auto-refund fires.

Expected: onboarding completes, "Ready" appears, a live payment succeeds and reaches Stripe's card page (no more `/oauth/v2/authorize` error), and reject → refund works.

- [ ] **Step 4: Confirm no runtime errors**

Check Vercel runtime logs for `/api/stripe/connect/*` and `/api/stripe/connect-webhook` — no `error` level entries during the run-through.

---

## Notes for the implementer

- If `stripe.accounts.create({ type: "standard" })` is rejected by the account's default API version (`2026-07-29.dahlia`) in favour of controller properties, use the Standard-equivalent controller block instead: `controller: { stripe_dashboard: { type: "full" }, fees: { payer: "account" }, losses: { payments: "stripe" }, requirement_collection: "stripe" }` (drop `type`). Everything else stays the same.
- The `corner-grind` shop's stale test account auto-heals on its next "Set up payments" (Task 3's retrieve-then-recreate), so no manual DB edit is needed.
