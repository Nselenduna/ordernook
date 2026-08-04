# Phase 2B-1 — Shop Stripe Connect Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a shop connect its own Stripe account (Standard OAuth) so it can receive online payments, and toggle "accept online orders" on/off. No customer payment flow (that's 2B-2).

**Architecture:** Two Next route handlers drive Stripe Standard OAuth (`/api/stripe/connect/start` → Stripe → `/callback`), storing `shops.stripe_account_id` via the service-role admin client (the column is billing-trigger-protected). A `set_online_payments` RPC gates the `online` payment mode on a connected account. A dashboard Settings card ties it together. Zero commission — nothing fee-related is built.

**Tech Stack:** Next.js App Router route handlers (nodejs runtime), Supabase (Postgres RPC, admin client), Stripe Node SDK (OAuth), shadcn/ui, vitest.

## Global Constraints
- **Design:** Travo Purple dashboard; reuse existing Settings card styling (`shop-settings.tsx`), 44px targets.
- **`stripe_account_id` is billing-protected** — written/cleared ONLY via `createAdminClient()` (service role). A `SECURITY DEFINER` RPC canNOT write it (the trigger checks `auth.role()`, still `authenticated` inside DEFINER).
- **`payment_modes`** is NOT protected — writable by the authed shop; the `set_online_payments` RPC is the only writer of `online` and requires `stripe_account_id`.
- **All user-facing strings via `t()`**; Connect account tied to the **authed** shop (not just whoever holds the OAuth `state`).
- Stripe account is OrderNook `acct_1U0RkqDeO3cMpMIL`; env `STRIPE_CONNECT_CLIENT_ID` (`ca_…`), reuse existing `STRIPE_SECRET_KEY`, `getStripe()`, `createAdminClient()`, `getStaffShop()`.

## Prerequisite (manual — needed only for the live OAuth test in Task 4, not for building)
On OrderNook (`acct_1U0Rkq…`, test mode): enable Connect, copy the **test** Client ID (`ca_…`), register redirect URIs `https://ordernook.uk/api/stripe/connect/callback` + `http://localhost:3000/api/stripe/connect/callback`. Set `STRIPE_CONNECT_CLIENT_ID=ca_…` in `.env.local` (+ Vercel prod for deploy). No ID verification required for test-mode building.

## File Structure
- `supabase/migrations/<ts>_set_online_payments.sql` (create) — the RPC.
- `tests/set-online-payments.test.ts` (create) — RPC guard tests.
- `src/app/api/stripe/connect/start/route.ts` (create) — OAuth start.
- `src/app/api/stripe/connect/callback/route.ts` (create) — OAuth callback → store account.
- `src/app/api/stripe/connect/disconnect/route.ts` (create) — clear account + online.
- `src/components/dashboard/online-payments-card.tsx` (create) — Settings UI.
- `src/lib/i18n.ts` (modify) — `settings.online.*` keys.
- `src/app/dashboard/settings/page.tsx` (modify) — render the card, read `?connect=` param.

---

### Task 1: `set_online_payments` RPC + guard tests

**Files:**
- Create: `supabase/migrations/<timestamp>_set_online_payments.sql` (timestamp after `20260804140000`)
- Create: `tests/set-online-payments.test.ts`

**Interfaces:**
- Produces RPC `set_online_payments(p_enabled boolean) returns public.shops`, granted to `authenticated`. Raises `not_authenticated`, `no_shop`, `no_stripe_account`.

- [ ] **Step 1: Write the failing test**

Create `tests/set-online-payments.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.test" })
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(url, anon)
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return c
}

// SHOP_A (corner-grind) is given a fake stripe_account_id by the controller before this
// suite and reset after. SHOP_B (pilot-test) has no account.
describe("set_online_payments", () => {
  let withAcct: SupabaseClient
  let noAcct: SupabaseClient

  beforeAll(async () => {
    withAcct = await signedIn(process.env.SHOP_A_EMAIL!, process.env.SHOP_A_PASSWORD!)
    noAcct = await signedIn(process.env.SHOP_B_EMAIL!, process.env.SHOP_B_PASSWORD!)
  })

  it("enable without a connected account is rejected", async () => {
    const { error } = await noAcct.rpc("set_online_payments", { p_enabled: true })
    expect(error?.message ?? "").toContain("no_stripe_account")
  })

  it("enable with an account adds 'online' (keeps 'in_store')", async () => {
    const { data, error } = await withAcct.rpc("set_online_payments", { p_enabled: true })
    expect(error).toBeNull()
    const modes = (data as { payment_modes: string[] }).payment_modes
    expect(modes).toContain("online")
    expect(modes).toContain("in_store")
  })

  it("disable removes 'online' (keeps 'in_store')", async () => {
    const { data, error } = await withAcct.rpc("set_online_payments", { p_enabled: false })
    expect(error).toBeNull()
    const modes = (data as { payment_modes: string[] }).payment_modes
    expect(modes).not.toContain("online")
    expect(modes).toContain("in_store")
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/set-online-payments.test.ts`
Expected: FAIL — function `set_online_payments` not found. (Controller applies the migration + provisions SHOP_A's account between Steps 4 and 6; do not run this yourself.)

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/<timestamp>_set_online_payments.sql`:

```sql
-- Toggle the 'online' payment mode for the caller's shop. Requires a connected
-- Stripe account before online can be enabled. Only touches payment_modes (not a
-- billing-protected column), so it's safe under the protect_shop_billing trigger.
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
```

- [ ] **Step 4: Commit the migration + test (do NOT run tests — controller provisions infra)**

```bash
git add supabase/migrations/*_set_online_payments.sql tests/set-online-payments.test.ts
git commit -m "feat(connect): set_online_payments RPC + guard tests"
```

Report DONE. The controller applies the migration, sets SHOP_A's `stripe_account_id`, runs the tests, and resets SHOP_A afterward.

---

### Task 2: Stripe Connect OAuth routes

**Files:**
- Create: `src/app/api/stripe/connect/start/route.ts`
- Create: `src/app/api/stripe/connect/callback/route.ts`
- Create: `src/app/api/stripe/connect/disconnect/route.ts`

**Interfaces:**
- Consumes `getStaffShop()` (`@/lib/dashboard`), `getStripe()` (`@/lib/stripe`), `createAdminClient()` (`@/lib/supabase/admin`). Produces three GET/POST endpoints. `callback` sets `shops.stripe_account_id`; `disconnect` clears it + removes `online`.

- [ ] **Step 1: Write `start/route.ts`**

```ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { randomBytes } from "node:crypto"
import { getStaffShop } from "@/lib/dashboard"

export const runtime = "nodejs"

export async function GET() {
  const shop = await getStaffShop() // redirects to login if no session
  if (!shop) return NextResponse.redirect(new URL("/dashboard", site()))

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
  if (!clientId)
    return NextResponse.redirect(new URL("/dashboard/settings?connect=error", site()))

  const state = randomBytes(16).toString("hex")
  const jar = await cookies()
  jar.set("onbd_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
  })

  const url = new URL("https://connect.stripe.com/oauth/authorize")
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("scope", "read_write")
  url.searchParams.set("state", state)
  url.searchParams.set("redirect_uri", `${site()}/api/stripe/connect/callback`)
  return NextResponse.redirect(url)
}

function site() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}
```

- [ ] **Step 2: Write `callback/route.ts`**

```ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getStaffShop } from "@/lib/dashboard"
import { getStripe } from "@/lib/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

function site() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}
const settings = (q: string) =>
  NextResponse.redirect(new URL(`/dashboard/settings?connect=${q}`, site()))

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  if (params.get("error")) return settings("cancelled") // user declined on Stripe

  const code = params.get("code")
  const state = params.get("state")
  const jar = await cookies()
  const cookieState = jar.get("onbd_state")?.value
  jar.delete("onbd_state")
  if (!code || !state || !cookieState || state !== cookieState) return settings("error")

  const shop = await getStaffShop()
  if (!shop) return NextResponse.redirect(new URL("/dashboard", site()))

  try {
    const token = await getStripe().oauth.token({
      grant_type: "authorization_code",
      code,
    })
    const acct = token.stripe_user_id
    if (!acct) return settings("error")
    const admin = createAdminClient()
    await admin.from("shops").update({ stripe_account_id: acct }).eq("id", shop.id)
  } catch {
    return settings("error")
  }
  return settings("success")
}
```

- [ ] **Step 3: Write `disconnect/route.ts`**

```ts
import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function POST() {
  const shop = await getStaffShop()
  if (!shop) return NextResponse.json({ error: "no_shop" }, { status: 401 })

  const admin = createAdminClient()
  const modes = (shop.payment_modes ?? []).filter((m) => m !== "online")
  await admin
    .from("shops")
    .update({ stripe_account_id: null, payment_modes: modes })
    .eq("id", shop.id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Verify build compiles**

Run: `npm run build`
Expected: success; the three `/api/stripe/connect/*` routes appear; no type errors. (Fix any type error minimally, e.g. an `oauth.token` type — cast if the SDK types require.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stripe/connect
git commit -m "feat(connect): Stripe Standard OAuth start/callback/disconnect routes"
```

---

### Task 3: Online payments Settings card

**Files:**
- Create: `src/components/dashboard/online-payments-card.tsx`
- Modify: `src/lib/i18n.ts`
- Modify: `src/app/dashboard/settings/page.tsx`

**Interfaces:**
- Consumes: `set_online_payments` RPC, the disconnect route. Props: `{ connected: boolean; onlineEnabled: boolean }`.

- [ ] **Step 1: Add i18n keys**

In `src/lib/i18n.ts`, add alongside existing `settings.*` keys (match the flat-dict format):

```
settings.online.title = "Online payments"
settings.online.blurb = "Let customers pay by card when they order — money goes straight to your Stripe, zero commission."
settings.online.connect = "Connect Stripe"
settings.online.connected = "Connected ✓"
settings.online.accept = "Accept online orders"
settings.online.needAccount = "Connect Stripe first"
settings.online.disconnect = "Disconnect"
settings.online.disconnectConfirm = "Disconnect Stripe? Customers won't be able to pay online until you reconnect."
settings.online.connectSuccess = "Stripe connected"
settings.online.connectError = "Couldn't connect Stripe. Please try again."
settings.online.connectCancelled = "Stripe connection cancelled"
settings.online.saveFailed = "Couldn't save. Please try again."
```

- [ ] **Step 2: Build the card**

Create `src/components/dashboard/online-payments-card.tsx`:

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"

export function OnlinePaymentsCard({
  connected,
  onlineEnabled,
}: {
  connected: boolean
  onlineEnabled: boolean
}) {
  const supabase = createClient()
  const [enabled, setEnabled] = useState(onlineEnabled)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    const next = !enabled
    setEnabled(next) // optimistic
    const { error } = await supabase.rpc("set_online_payments", { p_enabled: next })
    if (error) {
      setEnabled(!next)
      toast.error(t("settings.online.saveFailed"))
    }
  }

  const disconnect = async () => {
    if (!window.confirm(t("settings.online.disconnectConfirm"))) return
    setBusy(true)
    const res = await fetch("/api/stripe/connect/disconnect", { method: "POST" })
    setBusy(false)
    if (!res.ok) return toast.error(t("settings.online.saveFailed"))
    window.location.reload() // reflect the cleared account from the server
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="font-semibold">{t("settings.online.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.online.blurb")}</p>
      </div>

      {!connected ? (
        <a
          href="/api/stripe/connect/start"
          className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          {t("settings.online.connect")}
        </a>
      ) : (
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-(--status-ready)">
            {t("settings.online.connected")}
          </span>
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("settings.online.accept")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={toggle}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
                enabled ? "bg-(--status-ready) text-white" : "bg-muted text-foreground"
              )}
            >
              {enabled ? "On" : "Off"}
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
    </section>
  )
}
```

- [ ] **Step 3: Wire into the settings page**

In `src/app/dashboard/settings/page.tsx`: import `OnlinePaymentsCard`; after the existing `<PlanCard …/>`, render it, and surface the `?connect=` toast. `searchParams` is already awaited there — extend its type to `{ session_id?: string; connect?: string }`. Add, inside `<main>` after PlanCard:

```tsx
<OnlinePaymentsCard
  connected={shop.stripe_account_id != null}
  onlineEnabled={(shop.payment_modes ?? []).includes("online")}
/>
```

Because toasts are client-side, add a tiny client component `ConnectToast` (or reuse an existing toast-on-mount pattern) that reads the `connect` value and fires the matching `t("settings.online.connect*")` toast once. If no such pattern exists, create `src/components/dashboard/connect-toast.tsx`:

```tsx
"use client"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { t } from "@/lib/i18n"

export function ConnectToast({ status }: { status?: string }) {
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !status) return
    done.current = true
    if (status === "success") toast.success(t("settings.online.connectSuccess"))
    else if (status === "cancelled") toast(t("settings.online.connectCancelled"))
    else if (status === "error") toast.error(t("settings.online.connectError"))
  }, [status])
  return null
}
```

Render `<ConnectToast status={connect} />` in the settings page.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: success, no type errors, `/dashboard/settings` still builds.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/online-payments-card.tsx src/components/dashboard/connect-toast.tsx src/lib/i18n.ts src/app/dashboard/settings/page.tsx
git commit -m "feat(connect): online payments settings card + connect toasts"
```

---

### Task 4: Verification

**Files:** none (verification). Controller-driven; the live OAuth round-trip is gated on `STRIPE_CONNECT_CLIENT_ID`.

- [ ] **Step 1: RPC tests (controller infra)**

Controller: apply the migration to `iryavyogljedwgllaoit`; set SHOP_A's account: `update shops set stripe_account_id='acct_test_connect' where slug='corner-grind'`; run `npm test -- tests/set-online-payments.test.ts` (expect 3/3); then reset: `update shops set stripe_account_id=null, payment_modes='{in_store}' where slug='corner-grind'`.

- [ ] **Step 2: UI render (no client_id needed)**

Dev server: open `/dashboard/settings` as a shop with no account → "Online payments" card shows the **Connect Stripe** button. Temporarily set a fake `stripe_account_id` + `online` on that shop via SQL → reload → card shows "Connected ✓" + the Accept-online toggle (on). Reset after.

- [ ] **Step 3: Live OAuth round-trip (once `STRIPE_CONNECT_CLIENT_ID` is set — may be deferred)**

With the test `ca_…` in `.env.local`: click **Connect Stripe** → Stripe test OAuth → complete a test Standard account (Stripe test data) → returns to `/dashboard/settings?connect=success` → DB shows a real `acct_…` on the shop → toggle Accept-online → `payment_modes` gains `online` → Disconnect → `stripe_account_id` cleared. If the `ca_…` isn't available yet, log this step as deferred and note it in the ledger — it does not block Tasks 1–3.

- [ ] **Step 4: Full suite + build; mark done**

Run `npm test` then `npm run build`; update `state.md`/`roadmap.md`; commit doc updates.

---

## Self-Review

**Spec coverage:** OAuth start/callback → Task 2. Store account via admin client → Task 2 callback. `set_online_payments` gate → Task 1. Disconnect via admin route → Task 2. Settings card (connected/not, toggle, disconnect, toasts) → Task 3. Manual setup prereq → Prerequisite. Tests → Tasks 1 & 4. ✓

**Placeholder scan:** none — real SQL/TS/TSX throughout. `<timestamp>` = a real instruction (value after `20260804140000`).

**Type consistency:** RPC name/params (`set_online_payments(p_enabled boolean)`) and error strings (`no_stripe_account`) match across Task 1 migration, Task 1 test, and Task 3 card. `stripe_account_id` / `payment_modes` field names match the schema and Task 2/3 usage. `getStaffShop`/`getStripe`/`createAdminClient` imports match existing modules.
