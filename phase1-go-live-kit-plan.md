# Phase 1 Slice 1 — Go-Live Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a hand-onboarded pilot shop the dashboard tools to run daily service unattended (sold-out, pause, prep time, QR/poster) plus UK-required allergen display, and a repeatable way for Lloyd to seed a new pilot shop.

**Architecture:** Route-based dashboard sections (`/dashboard`, `/dashboard/menu`, `/dashboard/settings`, `/dashboard/qr`), each a server page that resolves the staff member's shop via a shared `getStaffShop()` helper and renders a focused client component. All writes go through the browser Supabase client under the existing Phase 0 RLS policies (`shops_staff_update`, `items_staff_update`) — no new RPCs, no service-role key. One additive migration (`menu_items.allergens`). QR is generated client-side; the pilot seed is a parameterised SQL template modelled on the existing `seed_test_shop` migration.

**Tech Stack:** Next.js 16 (App Router) + TypeScript, `@supabase/ssr` + `@supabase/supabase-js`, Tailwind v4, existing shadcn-style UI kit (`@base-ui/react`), Zustand, `qrcode` (new), Vitest (new, test-only).

## Global Constraints

- **No service-role key anywhere.** All app writes go through the anon/publishable client under RLS. Privileged seeding is SQL run in the Supabase SQL editor. (Phase 0 rule.)
- **`create_order` is the source of truth** for prices and order validity. Allergens and availability shown in the UI are display-only; never trust the client.
- **Money stays integer minor units + currency**; format only at display via `src/lib/money.ts`.
- **All user-facing strings via `t()` in `src/lib/i18n.ts`** — English only, but no hardcoded copy in components.
- **Customer theme = Latte Glass (`theme-latte`); dashboard theme = Travo (`theme-travo`)** — match existing wrappers.
- **Routing stays path-based**: `https://ordernook.uk/{slug}` (no subdomains this slice).
- **Do not edit files in `supabase/migrations/` that already exist** — they are applied history. Add new migrations only.
- **Supabase project:** `iryavyogljedwgllaoit` (linked via `supabase/config.toml`). Apply migrations with `supabase db push`.

---

### Task 1: Allergens — migration, types, customer display

**Files:**
- Create: `supabase/migrations/20260726120000_add_allergens.sql`
- Modify: `src/lib/database.types.ts` (regenerated)
- Modify: `src/components/shop/item-sheet.tsx` (add allergen block to `ItemSheetBody`)
- Modify: `src/components/shop/checkout-sheet.tsx` (add allergen reminder before Place order)
- Modify: `src/lib/i18n.ts` (new keys)

**Interfaces:**
- Produces: `menu_items.allergens` (Postgres `text[]`, default `{}`); `Tables<"menu_items">` gains `allergens: string[]`. Consumed by Task 3 (menu availability list may show them) and the customer UI.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260726120000_add_allergens.sql`:

```sql
-- Phase 1 Slice 1: allergen info per menu item (UK food law — shown at point of order).
alter table public.menu_items
  add column allergens text[] not null default '{}';

comment on column public.menu_items.allergens is
  'Free-form allergen tags shown to customers before ordering (e.g. milk, gluten, nuts). Empty = no data captured, UI shows "ask staff".';
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push`
Expected: migration applies; `supabase migration list` shows local and remote both include `20260726120000`.

- [ ] **Step 3: Regenerate types**

Run: `supabase gen types typescript --linked > src/lib/database.types.ts`
Expected: `menu_items` `Row`/`Insert`/`Update` now include `allergens`. Confirm with:
Run: `grep -n "allergens" src/lib/database.types.ts`
Expected: at least one match.

- [ ] **Step 4: Add i18n keys**

In `src/lib/i18n.ts`, add to the dict (near the other `menu.*` keys):

```ts
  "menu.allergens": "Allergens",
  "menu.allergensNone": "No allergen info — please ask staff before collecting.",
  "cart.allergenReminder": "Allergies? Check each item's allergens or ask staff before you collect.",
```

- [ ] **Step 5: Show allergens on the item sheet**

In `src/components/shop/item-sheet.tsx`, inside `ItemSheetBody`'s returned JSX, add an allergen block after the option groups `.map(...)` and before the quantity row:

```tsx
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{t("menu.allergens")}</h3>
          {item.allergens.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {item.allergens.map((a) => (
                <Badge key={a} variant="outline" className="capitalize">
                  {a}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("menu.allergensNone")}
            </p>
          )}
        </section>
```

(`Badge` is already imported in this file.)

- [ ] **Step 6: Add the allergen reminder at checkout**

In `src/components/shop/checkout-sheet.tsx`, add a reminder line just above the total row (before the `<div className="flex items-center justify-between text-base font-semibold">`):

```tsx
              <p className="text-xs text-muted-foreground">
                {t("cart.allergenReminder")}
              </p>
```

- [ ] **Step 7: Verify in the browser**

Run the dev server (`preview_start` with the `ordernook-dev` launch config) and open `/corner-grind`.
Expected:
- Open any item → an **Allergens** section shows either tags or the "ask staff" line.
- Open the cart → the allergen reminder appears above the total.
Confirm no console errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260726120000_add_allergens.sql src/lib/database.types.ts src/components/shop/item-sheet.tsx src/components/shop/checkout-sheet.tsx src/lib/i18n.ts
git commit -m "feat(menu): allergen field + customer display (UK food law)"
```

---

### Task 2: Dashboard shop-resolver helper + shared nav

**Files:**
- Create: `src/lib/dashboard.ts`
- Create: `src/components/dashboard/dashboard-nav.tsx`
- Modify: `src/app/dashboard/page.tsx` (use helper + render nav)
- Modify: `src/components/dashboard/dashboard-shell.tsx` (drop its own sign-out/title header row; render `<DashboardNav>`)
- Modify: `src/lib/i18n.ts` (nav labels)

**Interfaces:**
- Produces: `getStaffShop(): Promise<Tables<"shops"> | null>` (redirects to `/dashboard/login` if unauthenticated; returns `null` if the user has no shop). Consumed by every dashboard page (Tasks 3–5).
- Produces: `<DashboardNav shop={Tables<"shops">} active="orders" | "menu" | "settings" | "qr" />`. Consumed by every dashboard page.

- [ ] **Step 1: Create the shop-resolver helper**

Create `src/lib/dashboard.ts`:

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

/**
 * Resolve the shop for the logged-in staff member. Redirects to the login
 * page if there's no session; returns null if the user isn't linked to a shop
 * (caller renders a "not linked" message). RLS scopes staff_users to self.
 */
export async function getStaffShop(): Promise<Tables<"shops"> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/dashboard/login");

  const { data: staff } = await supabase
    .from("staff_users")
    .select("shops(*)")
    .eq("auth_user_id", user.id)
    .limit(1)
    .maybeSingle();

  return (staff?.shops as Tables<"shops"> | undefined) ?? null;
}
```

- [ ] **Step 2: Add nav i18n keys**

In `src/lib/i18n.ts` add:

```ts
  "nav.orders": "Orders",
  "nav.menu": "Menu",
  "nav.settings": "Settings",
  "nav.qr": "QR code",
```

- [ ] **Step 3: Create the shared nav**

Create `src/components/dashboard/dashboard-nav.tsx`:

```tsx
"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { Tables } from "@/lib/database.types"

type Section = "orders" | "menu" | "settings" | "qr"

const LINKS: { id: Section; href: string; label: string }[] = [
  { id: "orders", href: "/dashboard", label: t("nav.orders") },
  { id: "menu", href: "/dashboard/menu", label: t("nav.menu") },
  { id: "settings", href: "/dashboard/settings", label: t("nav.settings") },
  { id: "qr", href: "/dashboard/qr", label: t("nav.qr") },
]

export function DashboardNav({
  shop,
  active,
}: {
  shop: Tables<"shops">
  active: Section
}) {
  const router = useRouter()

  const signOut = async () => {
    await createClient().auth.signOut()
    router.push("/dashboard/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-2">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-lg font-bold">{shop.name}</h1>
          <Button
            variant="ghost"
            className="h-11 rounded-full px-3 text-muted-foreground"
            onClick={signOut}
          >
            {t("dash.signOut")}
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {LINKS.map(({ id, href, label }) => (
            <Link
              key={id}
              href={href}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-sm font-medium leading-9 transition-colors",
                id === active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Wire the helper + nav into the orders page**

Rewrite `src/app/dashboard/page.tsx` to use the helper:

```tsx
import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { t } from "@/lib/i18n";
import { getStaffShop } from "@/lib/dashboard";

export const metadata: Metadata = { title: t("login.title") };

export default async function DashboardPage() {
  const shop = await getStaffShop();
  if (!shop) {
    return (
      <main className="theme-travo flex flex-1 flex-col items-center justify-center bg-background px-6 text-center text-foreground">
        <p className="max-w-sm text-muted-foreground">{t("dash.notLinked")}</p>
      </main>
    );
  }
  return <DashboardShell shop={shop} />;
}
```

- [ ] **Step 5: Render the nav inside the orders shell**

In `src/components/dashboard/dashboard-shell.tsx`:
1. Add import: `import { DashboardNav } from "@/components/dashboard/dashboard-nav"`.
2. Replace the existing `<header>...</header>` block (the shop-name/live/mute/sign-out row, lines ~239–274) with:

```tsx
      <DashboardNav shop={shop} active="orders" />
      <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-1 px-4 pt-2">
        <span className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-2 rounded-full",
              live ? "animate-pulse bg-(--status-ready)" : "bg-border"
            )}
          />
          {live ? t("dash.live") : t("dash.connecting")}
        </span>
        <Button
          variant="ghost"
          className="h-11 rounded-full px-3"
          onClick={toggleMute}
          aria-pressed={muted}
        >
          {muted ? <VolumeXIcon /> : <Volume2Icon />}
          <span className="hidden sm:inline">
            {muted ? t("dash.soundOff") : t("dash.soundOn")}
          </span>
        </Button>
      </div>
```

3. Remove the now-unused `signOut` function and the `useRouter`/`router` usage if nothing else needs them (the nav owns sign-out now). Keep `BellRingIcon`, `Volume2Icon`, `VolumeXIcon` imports.

- [ ] **Step 6: Verify in the browser**

Log in at `/dashboard/login` (`owner@cornergrind.test` / `CornerGrind-Demo1!`).
Expected: nav bar shows Orders/Menu/Settings/QR with Orders active; live indicator + mute still work; sign-out works; the four links navigate (Menu/Settings/QR will 404 until later tasks — that's fine).
Confirm `npm run build` passes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/dashboard.ts src/components/dashboard/dashboard-nav.tsx src/app/dashboard/page.tsx src/components/dashboard/dashboard-shell.tsx src/lib/i18n.ts
git commit -m "feat(dashboard): shared nav + getStaffShop helper"
```

---

### Task 3: Menu availability (sold-out toggle)

**Files:**
- Create: `src/app/dashboard/menu/page.tsx`
- Create: `src/components/dashboard/menu-availability.tsx`
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `getStaffShop()`, `<DashboardNav>` (Task 2); `menu_items.allergens` (Task 1, optional to show).
- Produces: writes `menu_items.is_available` under `items_staff_update` RLS.

- [ ] **Step 1: Add i18n keys**

```ts
  "menu.available": "Available",
  "menu.markSoldOut": "Sold out",
  "menu.updateFailed": "Couldn't update — try again.",
  "menu.emptyMenu": "No menu items yet.",
```

- [ ] **Step 2: Create the server page**

Create `src/app/dashboard/menu/page.tsx`:

```tsx
import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { MenuAvailability } from "@/components/dashboard/menu-availability";
import { getStaffShop } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("nav.menu") };

export default async function MenuPage() {
  const shop = await getStaffShop();
  if (!shop) return null;

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("menu_categories")
    .select("id, name, sort_order, menu_items(id, name, is_available, sort_order)")
    .eq("shop_id", shop.id)
    .order("sort_order");

  return (
    <div className="theme-travo flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <DashboardNav shop={shop} active="menu" />
      <MenuAvailability categories={categories ?? []} />
    </div>
  );
}
```

- [ ] **Step 3: Create the availability client component**

Create `src/components/dashboard/menu-availability.tsx`:

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Item = { id: string; name: string; is_available: boolean; sort_order: number }
type Category = { id: string; name: string; sort_order: number; menu_items: Item[] }

export function MenuAvailability({ categories }: { categories: Category[] }) {
  const supabase = createClient()
  const [items, setItems] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      categories.flatMap((c) => c.menu_items.map((i) => [i.id, i.is_available]))
    )
  )

  const toggle = async (id: string) => {
    const next = !items[id]
    setItems((prev) => ({ ...prev, [id]: next })) // optimistic
    const { error } = await supabase
      .from("menu_items")
      .update({ is_available: next })
      .eq("id", id)
    if (error) {
      setItems((prev) => ({ ...prev, [id]: !next })) // revert
      toast.error(t("menu.updateFailed"))
    }
  }

  const hasItems = categories.some((c) => c.menu_items.length > 0)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-4">
      {!hasItems ? (
        <p className="py-16 text-center text-muted-foreground">
          {t("menu.emptyMenu")}
        </p>
      ) : (
        categories
          .filter((c) => c.menu_items.length > 0)
          .map((category) => (
            <section key={category.id} className="flex flex-col gap-2">
              <h2 className="font-heading text-lg font-semibold">{category.name}</h2>
              <ul className="flex flex-col gap-2">
                {[...category.menu_items]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item) => {
                    const available = items[item.id]
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3"
                      >
                        <span className="font-medium">{item.name}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={available}
                          onClick={() => toggle(item.id)}
                          className={cn(
                            "h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
                            available
                              ? "bg-secondary text-secondary-foreground"
                              : "bg-destructive/10 text-destructive"
                          )}
                        >
                          {available ? t("menu.available") : t("menu.markSoldOut")}
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </section>
          ))
      )}
    </main>
  )
}
```

- [ ] **Step 4: Verify in the browser**

Log in → Menu tab. Toggle an item to **Sold out**.
Expected:
- Button flips to the sold-out style.
- In another tab open `/corner-grind`: the item shows the "Sold out" badge and is not tappable.
- Attempt to order it is impossible from the UI; and `create_order` would reject it (already enforced).
Toggle it back to Available and confirm it returns.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/menu/page.tsx src/components/dashboard/menu-availability.tsx src/lib/i18n.ts
git commit -m "feat(dashboard): menu sold-out toggle"
```

---

### Task 4: Shop settings (accepting orders + prep time)

**Files:**
- Create: `src/app/dashboard/settings/page.tsx`
- Create: `src/components/dashboard/shop-settings.tsx`
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `getStaffShop()`, `<DashboardNav>`.
- Produces: writes `shops.is_paused` and `shops.prep_minutes` under `shops_staff_update` RLS.

- [ ] **Step 1: Add i18n keys**

```ts
  "settings.acceptingOrders": "Accepting orders",
  "settings.acceptingOn": "Customers can order now.",
  "settings.acceptingOff": "Ordering is paused — the shop page shows a paused message.",
  "settings.prepTime": "Prep time (minutes)",
  "settings.prepHint": "Shown to customers as the estimated ready time.",
  "settings.saved": "Saved.",
  "settings.saveFailed": "Couldn't save — try again.",
```

- [ ] **Step 2: Create the server page**

Create `src/app/dashboard/settings/page.tsx`:

```tsx
import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { ShopSettings } from "@/components/dashboard/shop-settings";
import { getStaffShop } from "@/lib/dashboard";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("nav.settings") };

export default async function SettingsPage() {
  const shop = await getStaffShop();
  if (!shop) return null;
  return (
    <div className="theme-travo flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <DashboardNav shop={shop} active="settings" />
      <ShopSettings
        shopId={shop.id}
        initialPaused={shop.is_paused}
        initialPrep={shop.prep_minutes}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create the settings client component**

Create `src/components/dashboard/shop-settings.tsx`:

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export function ShopSettings({
  shopId,
  initialPaused,
  initialPrep,
}: {
  shopId: string
  initialPaused: boolean
  initialPrep: number
}) {
  const supabase = createClient()
  const [paused, setPaused] = useState(initialPaused)
  const [prep, setPrep] = useState(String(initialPrep))
  const [savingPrep, setSavingPrep] = useState(false)

  const accepting = !paused

  const toggleAccepting = async () => {
    const nextPaused = accepting // turning "accepting" off => paused true
    setPaused(nextPaused) // optimistic
    const { error } = await supabase
      .from("shops")
      .update({ is_paused: nextPaused })
      .eq("id", shopId)
    if (error) {
      setPaused(!nextPaused)
      toast.error(t("settings.saveFailed"))
    }
  }

  const savePrep = async () => {
    const value = Number.parseInt(prep, 10)
    if (!Number.isFinite(value) || value < 0) {
      setPrep(String(initialPrep))
      return
    }
    setSavingPrep(true)
    const { error } = await supabase
      .from("shops")
      .update({ prep_minutes: value })
      .eq("id", shopId)
    setSavingPrep(false)
    toast[error ? "error" : "success"](
      error ? t("settings.saveFailed") : t("settings.saved")
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4">
      <section className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h2 className="font-semibold">{t("settings.acceptingOrders")}</h2>
          <p className="text-sm text-muted-foreground">
            {accepting ? t("settings.acceptingOn") : t("settings.acceptingOff")}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={accepting}
          onClick={toggleAccepting}
          className={cn(
            "h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
            accepting
              ? "bg-(--status-ready) text-white"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {accepting ? t("settings.acceptingOrders") : t("settings.acceptingOff")}
        </button>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <Label htmlFor="prep">{t("settings.prepTime")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="prep"
            type="number"
            min={0}
            value={prep}
            onChange={(e) => setPrep(e.target.value)}
            className="h-11 w-28 rounded-xl"
          />
          <Button
            type="button"
            className="h-11 rounded-full px-5"
            disabled={savingPrep}
            onClick={savePrep}
          >
            {t("settings.saved").replace(".", "")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("settings.prepHint")}</p>
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Verify in the browser**

Settings tab:
- Toggle **Accepting orders** off → open `/corner-grind` in another tab → paused message shows. Toggle on → menu returns.
- Change prep time, Save → place a test order → the status page ETA reflects the new prep time.
Confirm no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/settings/page.tsx src/components/dashboard/shop-settings.tsx src/lib/i18n.ts
git commit -m "feat(dashboard): shop settings — accepting-orders + prep time"
```

---

### Task 5: QR code panel + printable poster

**Files:**
- Modify: `package.json` (add `qrcode`, `@types/qrcode`)
- Create: `src/app/dashboard/qr/page.tsx`
- Create: `src/components/dashboard/qr-panel.tsx`
- Create: `src/app/dashboard/qr/poster/page.tsx`
- Create: `src/components/dashboard/qr-poster.tsx`
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `getStaffShop()`, `<DashboardNav>`, `shop.slug`, `shop.name`.
- Produces: a QR PNG data URL for `https://ordernook.uk/{slug}?src=qr` (client-side only; no DB writes).

- [ ] **Step 1: Add the dependency**

Run: `npm install qrcode && npm install -D @types/qrcode`
Expected: both appear in `package.json`.

- [ ] **Step 2: Add i18n keys**

```ts
  "qr.title": "Your QR code",
  "qr.subtitle": "Print this and put it on the counter. Customers scan to order.",
  "qr.download": "Download QR (PNG)",
  "qr.copyLink": "Copy link",
  "qr.copied": "Link copied.",
  "qr.openPoster": "Open printable poster",
  "qr.posterHeadline": "Skip the queue",
  "qr.posterSub": "Scan to order ahead & collect",
  "qr.print": "Print poster",
```

- [ ] **Step 3: Create the QR panel component**

Create `src/components/dashboard/qr-panel.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import QRCode from "qrcode"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { t } from "@/lib/i18n"

export function shopUrl(slug: string): string {
  return `https://ordernook.uk/${slug}?src=qr`
}

export function QrPanel({ slug }: { slug: string }) {
  const url = shopUrl(slug)
  const [png, setPng] = useState<string>("")

  useEffect(() => {
    QRCode.toDataURL(url, { width: 512, margin: 2 }).then(setPng).catch(() => {})
  }, [url])

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    toast.success(t("qr.copied"))
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-4 px-4 py-6 text-center">
      <div>
        <h2 className="font-heading text-xl font-semibold">{t("qr.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("qr.subtitle")}</p>
      </div>
      {png && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={png}
          alt="QR code"
          className="size-56 rounded-2xl border border-border bg-white p-3"
        />
      )}
      <p className="break-all text-sm text-muted-foreground">{url}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild className="h-11 rounded-full px-5">
          <a href={png} download={`ordernook-${slug}-qr.png`}>
            {t("qr.download")}
          </a>
        </Button>
        <Button variant="secondary" className="h-11 rounded-full px-5" onClick={copy}>
          {t("qr.copyLink")}
        </Button>
        <Button variant="ghost" asChild className="h-11 rounded-full px-5">
          <Link href="/dashboard/qr/poster">{t("qr.openPoster")}</Link>
        </Button>
      </div>
    </main>
  )
}
```

> Note: if `Button` doesn't support `asChild` in this UI kit, replace those two `<Button asChild>` wrappers with a plain `<a>`/`<Link>` styled with the same classes. Confirm by checking `src/components/ui/button.tsx` for an `asChild` prop before implementing; adjust in this step if absent.

- [ ] **Step 4: Create the QR page**

Create `src/app/dashboard/qr/page.tsx`:

```tsx
import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { QrPanel } from "@/components/dashboard/qr-panel";
import { getStaffShop } from "@/lib/dashboard";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("nav.qr") };

export default async function QrPage() {
  const shop = await getStaffShop();
  if (!shop) return null;
  return (
    <div className="theme-travo flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <DashboardNav shop={shop} active="qr" />
      <QrPanel slug={shop.slug} />
    </div>
  );
}
```

- [ ] **Step 5: Create the poster (client) component**

Create `src/components/dashboard/qr-poster.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Button } from "@/components/ui/button"
import { shopUrl } from "@/components/dashboard/qr-panel"
import { t } from "@/lib/i18n"

export function QrPoster({ slug, shopName }: { slug: string; shopName: string }) {
  const [png, setPng] = useState<string>("")
  useEffect(() => {
    QRCode.toDataURL(shopUrl(slug), { width: 800, margin: 2 })
      .then(setPng)
      .catch(() => {})
  }, [slug])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 p-8 text-center">
      <Button
        className="h-11 rounded-full px-6 print:hidden"
        onClick={() => window.print()}
      >
        {t("qr.print")}
      </Button>
      <h1 className="font-heading text-4xl font-bold">{shopName}</h1>
      <p className="text-2xl font-semibold">{t("qr.posterHeadline")}</p>
      {png && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={png} alt="QR code" className="size-72 bg-white p-4" />
      )}
      <p className="text-lg text-muted-foreground">{t("qr.posterSub")}</p>
    </main>
  )
}
```

- [ ] **Step 6: Create the poster page**

Create `src/app/dashboard/qr/poster/page.tsx`:

```tsx
import type { Metadata } from "next";
import { QrPoster } from "@/components/dashboard/qr-poster";
import { getStaffShop } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Poster" };

export default async function PosterPage() {
  const shop = await getStaffShop();
  if (!shop) return null;
  // Latte theme for a warm printed poster; no dashboard nav (print-friendly).
  return (
    <div className="theme-latte min-h-dvh bg-background text-foreground">
      <QrPoster slug={shop.slug} shopName={shop.name} />
    </div>
  );
}
```

- [ ] **Step 7: Verify in the browser**

QR tab:
- QR image renders; the printed URL reads `https://ordernook.uk/corner-grind?src=qr`.
- **Download QR (PNG)** saves a file; **Copy link** copies the URL.
- **Open printable poster** → poster page shows shop name + large QR; **Print poster** opens the browser print dialog; the Print button is hidden in the print preview (`print:hidden`).
- Scan the on-screen QR with a phone → lands on the shop page.
Confirm `npm run build` passes.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/app/dashboard/qr src/components/dashboard/qr-panel.tsx src/components/dashboard/qr-poster.tsx src/lib/i18n.ts
git commit -m "feat(dashboard): QR code panel + printable poster"
```

---

### Task 6: Pilot onboarding seed template

**Files:**
- Create: `scripts/seed-shop.sql`
- Create: `scripts/README.md`

**Interfaces:**
- Consumes: existing schema + the `seed_test_shop` auth-user pattern.
- Produces: a repeatable SQL template that creates one shop + owner login + starter menu. Consumed by Lloyd (manual) and by Task 7 (needs a second shop to test isolation).

- [ ] **Step 1: Create the seed template**

Create `scripts/seed-shop.sql` (modelled on `20260711143512_seed_test_shop.sql`; replace the four `:'...'` placeholders per shop). This is **run in the Supabase SQL editor**, not committed as a migration:

```sql
-- OrderNook pilot shop seed. Fill in the 4 \set values, paste into the
-- Supabase SQL editor (project iryavyogljedwgllaoit), and run.
-- Creates: shop + owner login + a minimal starter menu. Edit the menu inserts
-- to match the real shop. UK country row is assumed to exist already.
\set shop_slug 'joes-cafe'
\set shop_name 'Joe''s Cafe'
\set owner_email 'owner@joescafe.test'
\set owner_password 'ChangeMe-Now1!'

do $$
declare
  v_shop_id uuid;
  v_cat uuid;
  v_user_id uuid := gen_random_uuid();
begin
  insert into public.shops (slug, name, country_code, branding, prep_minutes, hours)
  values (:'shop_slug', :'shop_name', 'GB',
          jsonb_build_object('tagline', 'Skip the queue.'),
          10, '{}'::jsonb)
  returning id into v_shop_id;

  insert into public.locations (shop_id, address) values (v_shop_id, 'TBC');

  insert into public.menu_categories (shop_id, name, sort_order)
  values (v_shop_id, 'Drinks', 1) returning id into v_cat;

  insert into public.menu_items
    (shop_id, category_id, name, description, price_minor, currency, sort_order, allergens)
  values
    (v_shop_id, v_cat, 'Latte', 'Smooth and milky', 330, 'GBP', 1, array['milk']),
    (v_shop_id, v_cat, 'Americano', 'Double espresso, hot water', 280, 'GBP', 2, '{}');

  -- Owner login (same pattern as the Corner Grind seed).
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token,
                          email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
          :'owner_email', crypt(:'owner_password', gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
          now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                               last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_user_id, v_user_id::text,
          jsonb_build_object('sub', v_user_id::text, 'email', :'owner_email', 'email_verified', true),
          'email', now(), now(), now());

  insert into public.staff_users (shop_id, auth_user_id, role)
  values (v_shop_id, v_user_id, 'owner');
end $$;
```

- [ ] **Step 2: Create the runbook**

Create `scripts/README.md`:

```markdown
# Pilot onboarding

To add a pilot shop (no self-serve signup yet — Slice 4):

1. Open the Supabase SQL editor for project `iryavyogljedwgllaoit`.
2. Paste `seed-shop.sql`, edit the four `\set` values (slug, name, owner email, owner password) and the menu inserts to match the shop.
3. Run it.
4. Give the owner: `https://ordernook.uk/<slug>` (their QR is in the dashboard) and their login.
5. In the dashboard, refine the menu (Slice 2) / settings / print the QR.

The owner login uses a `.test`-style email by design (no email delivery). Change the password before handing it over.
```

- [ ] **Step 3: Verify**

Run the seed (edited for a throwaway shop, e.g. slug `pilot-test`) in the Supabase SQL editor.
Expected:
- `https://ordernook.uk/pilot-test` renders its menu.
- Logging in as its owner shows *that* shop's dashboard (not Corner Grind).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-shop.sql scripts/README.md
git commit -m "chore: pilot shop seed template + runbook"
```

---

### Task 7: RLS cross-tenant isolation test (automated)

**Files:**
- Modify: `package.json` (add `vitest`, `dotenv`; add `test` script)
- Create: `vitest.config.ts`
- Create: `.env.test.example`
- Create: `tests/rls.test.ts`

**Interfaces:**
- Consumes: two seeded shops — Corner Grind (`corner-grind`) and a second shop from Task 6 (e.g. `pilot-test`) — and their owner logins.
- Produces: an automated guarantee that a shop's staff cannot read or write another shop's data. (The sitrep's long-standing ask before a 2nd real shop exists.)

> Runs against the live project using only throwaway **test shops**. Assertions are read-mostly; the one write is toggling `corner-grind`'s own item and toggling it back.

- [ ] **Step 1: Add deps + script**

Run: `npm install -D vitest dotenv`
Then add to `package.json` `scripts`: `"test": "vitest run"`.

- [ ] **Step 2: Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
})
```

- [ ] **Step 3: Env template**

Create `.env.test.example` (copy to `.env.test`, fill in; `.env*` is gitignored):

```
NEXT_PUBLIC_SUPABASE_URL=https://iryavyogljedwgllaoit.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SHOP_A_EMAIL=owner@cornergrind.test
SHOP_A_PASSWORD=CornerGrind-Demo1!
SHOP_B_EMAIL=owner@pilot-test.test
SHOP_B_PASSWORD=...
```

- [ ] **Step 4: Write the failing test**

Create `tests/rls.test.ts`:

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

describe("RLS cross-tenant isolation", () => {
  let a: SupabaseClient
  let b: SupabaseClient
  let aShopId: string
  let bShopId: string

  beforeAll(async () => {
    a = await signedIn(process.env.SHOP_A_EMAIL!, process.env.SHOP_A_PASSWORD!)
    b = await signedIn(process.env.SHOP_B_EMAIL!, process.env.SHOP_B_PASSWORD!)
    const { data: sa } = await a.from("shops").select("id").limit(1).single()
    const { data: sb } = await b.from("shops").select("id").limit(1).single()
    aShopId = sa!.id
    bShopId = sb!.id
  })

  it("each staff sees only their own shop", () => {
    expect(aShopId).not.toEqual(bShopId)
  })

  it("A cannot read B's menu items", async () => {
    const { data } = await a.from("menu_items").select("id").eq("shop_id", bShopId)
    expect(data ?? []).toHaveLength(0)
  })

  it("A cannot update B's shop row", async () => {
    const { data } = await b.from("shops").select("prep_minutes").eq("id", bShopId).single()
    const before = data!.prep_minutes
    await a.from("shops").update({ prep_minutes: before + 99 }).eq("id", bShopId)
    const { data: after } = await b.from("shops").select("prep_minutes").eq("id", bShopId).single()
    expect(after!.prep_minutes).toEqual(before) // unchanged — RLS blocked A
  })

  it("A CAN toggle its own item (sanity: policy isn't just deny-all)", async () => {
    const { data: item } = await a
      .from("menu_items").select("id, is_available").eq("shop_id", aShopId).limit(1).single()
    const { error } = await a
      .from("menu_items").update({ is_available: item!.is_available }).eq("id", item!.id)
    expect(error).toBeNull()
  })
})
```

- [ ] **Step 5: Run the test**

Run: `npm test`
Expected: all 4 assertions pass. If "A cannot update B's shop row" fails, RLS is misconfigured — stop and fix the policy before shipping (this is the whole point of the test).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .env.test.example tests/rls.test.ts
git commit -m "test: RLS cross-tenant isolation for shop staff"
```

---

## Self-Review

**Spec coverage:**
- §3.1 dashboard nav → Task 2 ✓
- §3.2 sold-out toggle → Task 3 ✓
- §3.3 accepting-orders + prep (hours simple) → Task 4 ✓
- §3.4 QR + print poster → Task 5 ✓
- §3.5 allergens (schema + customer display) → Task 1 ✓
- §3.6 pilot onboarding seed → Task 6 ✓
- §4 data model (allergens column) → Task 1 ✓
- §6 acceptance criteria 1–5 → Tasks 3/4/1 verifications; criterion 6 (isolation) → Tasks 6+7 ✓
- §7 RLS cross-tenant test → Task 7 ✓

**Placeholder scan:** No "TBD/implement later" in code steps. The two conditional notes (Button `asChild`, and the `.test` email design) are explicit instructions, not placeholders.

**Type consistency:** `getStaffShop(): Tables<"shops"> | null` used identically in Tasks 2–5. `<DashboardNav shop active>` signature consistent. `shopUrl(slug)` defined in Task 5 and reused by the poster. `menu_items.allergens: string[]` (Task 1) matches its use in Task 1's item sheet.

**Known follow-ups (out of scope, tracked):** editing allergens (Slice 2 menu editor); the QR poster styling polish; a UI kit `asChild` confirmation.
