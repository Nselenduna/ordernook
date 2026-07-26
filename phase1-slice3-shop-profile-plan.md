# Phase 1 Slice 3 — Shop Profile & Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let a shop owner set their name, tagline, brand colour, and logo from a dashboard Profile tab, and have it flow to the customer PWA and the installed home-screen app (dynamic manifest + icon + theme colour).

**Architecture:** Reuse the existing `shops.name` column + `shops.branding` jsonb (add `logo_url`); no table migration. One Storage migration (public `shop-logos` bucket + RLS scoped by `is_staff_of`). Logos are auto-processed (sharp → opaque square PNG 512/192/180) in a Node route handler that uploads as the signed-in user. A new `[slug]` manifest route + per-shop `generateMetadata`/`generateViewport` deliver the branded install.

**Tech Stack:** Next.js 16 (App Router, Node route handlers), `@supabase/ssr`, Supabase Storage, `sharp` (new), Tailwind v4, existing shadcn-style UI kit.

## Global Constraints

- **No service-role key.** The logo route uses the caller's cookie session (`@/lib/supabase/server`); Storage RLS enforces per-shop write isolation. Name/branding writes go through the anon client under `shops_staff_update`.
- **`create_order` is untouched** — this slice is identity/presentation only.
- **All user-facing strings via `t()`** in `src/lib/i18n.ts`.
- **Brand colour drives `--brand-primary`** (via existing `brandingVars()`); background stays Latte cream. A chosen colour MUST have **≥ 4.5:1 contrast vs white** (white button text) or save is blocked.
- Customer theme Latte, dashboard theme Travo. Money integer minor units (unchanged).
- Do NOT edit existing `supabase/migrations/` files — add the new migration only.
- Supabase project `iryavyogljedwgllaoit` (linked). Apply migrations with `supabase db push`.
- Branding jsonb writes must **merge**, never clobber sibling keys (`tagline`/`accent`/`logo_url` coexist).

---

### Task 1: Storage bucket + branding type

**Files:**
- Create: `supabase/migrations/20260726130000_shop_logos_storage.sql`
- Modify: `src/lib/types.ts` (add `logo_url` to `Branding`)
- Modify: `src/lib/branding.ts` (parse `logo_url`)

**Interfaces:**
- Produces: public Storage bucket `shop-logos` with RLS; `Branding.logo_url?: string`. Consumed by Tasks 2–6.

- [ ] **Step 1: Write the Storage migration**

Create `supabase/migrations/20260726130000_shop_logos_storage.sql`:

```sql
-- Phase 1 Slice 3: public bucket for shop logos/PWA icons, staff-write-scoped.
insert into storage.buckets (id, name, public)
values ('shop-logos', 'shop-logos', true)
on conflict (id) do nothing;

-- Public read (logos are shown to anonymous customers + used as PWA icons).
create policy "shop_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'shop-logos');

-- Staff may write ONLY under their own shop's folder: path = "{shop_id}/...".
-- storage.foldername(name)[1] is the first path segment (the shop_id).
create policy "shop_logos_staff_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-logos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  );

create policy "shop_logos_staff_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'shop-logos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'shop-logos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  );

create policy "shop_logos_staff_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shop-logos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  );
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push`
Expected: applies; `supabase migration list` shows `20260726130000` local + remote.

- [ ] **Step 3: Verify the bucket + policies exist**

Run: `supabase db push` output shows success; confirm no error. (The controller will separately confirm RLS behaviour in Task 6's test.)

- [ ] **Step 4: Add `logo_url` to the Branding type**

In `src/lib/types.ts`, extend the `Branding` type:

```ts
export type Branding = {
  primary?: string
  accent?: string
  background?: string
  tagline?: string
  logo_url?: string
}
```

- [ ] **Step 5: Parse `logo_url` in `parseBranding`**

In `src/lib/branding.ts`, inside `parseBranding`'s returned object, add the field:

```ts
    logo_url: str(raw.logo_url),
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: compiles cleanly.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260726130000_shop_logos_storage.sql src/lib/types.ts src/lib/branding.ts
git commit -m "feat(branding): shop-logos storage bucket + logo_url in Branding"
```

---

### Task 2: Logo processing + upload route

**Files:**
- Modify: `package.json` (add `sharp`)
- Modify: `next.config.ts` (mark `sharp` external for server)
- Create: `src/app/api/branding/logo/route.ts`

**Interfaces:**
- Consumes: `shop-logos` bucket + `Branding.logo_url` (Task 1); `createClient` from `@/lib/supabase/server`.
- Produces: `POST /api/branding/logo` (multipart form field `logo`) → uploads `{shop_id}/icon-{512,192,180}.png`, merges `logo_url` into `shops.branding`, returns `{ logo_url }`. Consumed by Task 3.

- [ ] **Step 1: Add sharp**

Run: `npm install sharp`

- [ ] **Step 2: Mark sharp external**

In `next.config.ts`, add to the config object:

```ts
  serverExternalPackages: ["sharp"],
```

- [ ] **Step 3: Write the route handler**

Create `src/app/api/branding/logo/route.ts`:

```ts
import { NextResponse } from "next/server"
import sharp from "sharp"
import { createClient } from "@/lib/supabase/server"
import { parseBranding } from "@/lib/branding"

export const runtime = "nodejs"

const SIZES = [512, 192, 180] as const
const MAX_BYTES = 4 * 1024 * 1024

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: staff } = await supabase
    .from("staff_users")
    .select("shop_id")
    .single()
  const shopId = staff?.shop_id
  if (!shopId) return NextResponse.json({ error: "no_shop" }, { status: 403 })

  const form = await request.formData()
  const file = form.get("logo")
  if (!(file instanceof File))
    return NextResponse.json({ error: "no_file" }, { status: 400 })
  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "not_image" }, { status: 400 })
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "too_large" }, { status: 400 })

  const input = Buffer.from(await file.arrayBuffer())
  // Flatten alpha onto white (prevents iOS black-box on transparent PNGs).
  const base = sharp(input).flatten({ background: "#ffffff" })

  for (const size of SIZES) {
    const png = await base
      .clone()
      .resize(size, size, { fit: "cover", position: "centre" })
      .png()
      .toBuffer()
    const { error } = await supabase.storage
      .from("shop-logos")
      .upload(`${shopId}/icon-${size}.png`, png, {
        contentType: "image/png",
        upsert: true,
      })
    if (error)
      return NextResponse.json(
        { error: "upload_failed", detail: error.message },
        { status: 500 }
      )
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("shop-logos").getPublicUrl(`${shopId}/icon-512.png`)

  // Merge logo_url into existing branding jsonb (don't clobber tagline/accent).
  const { data: shop } = await supabase
    .from("shops")
    .select("branding")
    .eq("id", shopId)
    .single()
  const nextBranding = { ...parseBranding(shop?.branding), logo_url: publicUrl }
  const { error: upErr } = await supabase
    .from("shops")
    .update({ branding: nextBranding })
    .eq("id", shopId)
  if (upErr)
    return NextResponse.json({ error: "save_failed" }, { status: 500 })

  return NextResponse.json({ logo_url: publicUrl })
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compiles; `/api/branding/logo` appears in the route list as a function.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json next.config.ts src/app/api/branding/logo/route.ts
git commit -m "feat(branding): logo upload+process route (sharp, RLS-scoped storage)"
```

---

### Task 3: Profile UI + nav tab

**Files:**
- Create: `src/app/dashboard/profile/page.tsx`
- Create: `src/components/dashboard/shop-profile.tsx`
- Modify: `src/components/dashboard/dashboard-nav.tsx` (add Profile tab)
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `getStaffShop()`, `<DashboardNav active="profile">`, `parseBranding`, `POST /api/branding/logo`.
- Produces: writes `shops.name` + merged `shops.branding` (tagline, accent) via anon client under `shops_staff_update`.

- [ ] **Step 1: Add Profile to the nav**

In `src/components/dashboard/dashboard-nav.tsx`: change the `Section` type and `LINKS`:

```ts
type Section = "orders" | "menu" | "settings" | "qr" | "profile"

const LINKS: { id: Section; href: string; label: string }[] = [
  { id: "orders", href: "/dashboard", label: t("nav.orders") },
  { id: "menu", href: "/dashboard/menu", label: t("nav.menu") },
  { id: "settings", href: "/dashboard/settings", label: t("nav.settings") },
  { id: "qr", href: "/dashboard/qr", label: t("nav.qr") },
  { id: "profile", href: "/dashboard/profile", label: t("nav.profile") },
]
```

- [ ] **Step 2: Add i18n keys**

In `src/lib/i18n.ts` add:

```ts
  "nav.profile": "Profile",
  "profile.title": "Shop profile",
  "profile.name": "Shop name",
  "profile.tagline": "Tagline",
  "profile.taglinePlaceholder": "e.g. Skip the queue.",
  "profile.brandColour": "Brand colour",
  "profile.brandColourHint": "Used for buttons and highlights on your customer page.",
  "profile.contrastWarning": "Too light — white button text won't be readable. Pick a darker shade.",
  "profile.logo": "Logo",
  "profile.logoHint": "Square works best. Shown on your page and as your app icon.",
  "profile.uploadLogo": "Upload logo",
  "profile.uploading": "Uploading…",
  "profile.save": "Save",
  "profile.saved": "Saved.",
  "profile.saveFailed": "Couldn't save — try again.",
  "profile.logoTooLarge": "That image is over 4MB — pick a smaller one.",
  "profile.logoFailed": "Logo upload failed — try again.",
```

- [ ] **Step 3: Write the server page**

Create `src/app/dashboard/profile/page.tsx`:

```tsx
import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { ShopProfile } from "@/components/dashboard/shop-profile";
import { getStaffShop } from "@/lib/dashboard";
import { parseBranding } from "@/lib/branding";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("nav.profile") };

export default async function ProfilePage() {
  const shop = await getStaffShop();
  if (!shop) return null;
  const branding = parseBranding(shop.branding);
  return (
    <div className="theme-travo flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <DashboardNav shop={shop} active="profile" />
      <ShopProfile
        shopId={shop.id}
        initialName={shop.name}
        initialTagline={branding.tagline ?? ""}
        initialColour={branding.accent ?? "#6F4E37"}
        initialLogoUrl={branding.logo_url ?? null}
      />
    </div>
  );
}
```

- [ ] **Step 4: Write the profile client component**

Create `src/components/dashboard/shop-profile.tsx`:

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"

/** WCAG contrast ratio of a hex colour against white (button text is white). */
function contrastVsWhite(hex: string): number {
  const c = hex.replace("#", "")
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return 0
  const chan = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  const L = 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2]
  return 1.05 / (L + 0.05) // white luminance = 1.0
}

export function ShopProfile({
  shopId,
  initialName,
  initialTagline,
  initialColour,
  initialLogoUrl,
}: {
  shopId: string
  initialName: string
  initialTagline: string
  initialColour: string
  initialLogoUrl: string | null
}) {
  const supabase = createClient()
  const [name, setName] = useState(initialName)
  const [tagline, setTagline] = useState(initialTagline)
  const [colour, setColour] = useState(initialColour)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const contrastOk = contrastVsWhite(colour) >= 4.5

  const save = async () => {
    if (!name.trim()) return
    if (!contrastOk) {
      toast.error(t("profile.contrastWarning"))
      return
    }
    setSaving(true)
    // Read-merge-write so we don't clobber logo_url the route set.
    const { data: shop } = await supabase
      .from("shops")
      .select("branding")
      .eq("id", shopId)
      .single()
    const current = (shop?.branding as Record<string, unknown>) ?? {}
    const { error } = await supabase
      .from("shops")
      .update({
        name: name.trim(),
        branding: { ...current, tagline: tagline.trim(), accent: colour },
      })
      .eq("id", shopId)
    setSaving(false)
    toast[error ? "error" : "success"](
      error ? t("profile.saveFailed") : t("profile.saved")
    )
  }

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      toast.error(t("profile.logoTooLarge"))
      return
    }
    setUploading(true)
    const body = new FormData()
    body.append("logo", file)
    const res = await fetch("/api/branding/logo", { method: "POST", body })
    setUploading(false)
    if (!res.ok) {
      toast.error(t("profile.logoFailed"))
      return
    }
    const { logo_url } = (await res.json()) as { logo_url: string }
    setLogoUrl(`${logo_url}?t=${Date.now()}`) // bust <img> cache after re-upload
    toast.success(t("profile.saved"))
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shop-name">{t("profile.name")}</Label>
          <Input
            id="shop-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shop-tagline">{t("profile.tagline")}</Label>
          <Input
            id="shop-tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder={t("profile.taglinePlaceholder")}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shop-colour">{t("profile.brandColour")}</Label>
          <div className="flex items-center gap-3">
            <input
              id="shop-colour"
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="h-11 w-16 cursor-pointer rounded-xl border border-input bg-transparent"
            />
            <span className="text-sm tabular-nums text-muted-foreground">
              {colour}
            </span>
          </div>
          {!contrastOk ? (
            <p className="text-xs text-destructive">
              {t("profile.contrastWarning")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("profile.brandColourHint")}
            </p>
          )}
        </div>
        <Button
          type="button"
          className="h-11 w-fit rounded-full px-6"
          disabled={saving || !contrastOk || !name.trim()}
          onClick={save}
        >
          {t("profile.save")}
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <Label>{t("profile.logo")}</Label>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="size-24 rounded-2xl border border-border object-cover"
          />
        )}
        <p className="text-xs text-muted-foreground">{t("profile.logoHint")}</p>
        <label className="inline-flex h-11 w-fit cursor-pointer items-center rounded-full bg-secondary px-5 text-sm font-medium text-secondary-foreground">
          {uploading ? t("profile.uploading") : t("profile.uploadLogo")}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={onLogo}
          />
        </label>
      </section>
    </main>
  )
}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: compiles; `/dashboard/profile` in the route list.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/profile/page.tsx src/components/dashboard/shop-profile.tsx src/components/dashboard/dashboard-nav.tsx src/lib/i18n.ts
git commit -m "feat(dashboard): shop profile tab (name, tagline, brand colour, logo)"
```

---

### Task 4: Render the logo on the customer page

**Files:**
- Modify: `src/components/shop/menu-page.tsx`

**Interfaces:**
- Consumes: `branding.logo_url` (Task 1). `MenuPage` already receives `branding: Branding`.

- [ ] **Step 1: Render the logo in the header**

In `src/components/shop/menu-page.tsx`, replace the `<header>` block (the one with the `<h1>{shop.name}</h1>`) with a version that shows the logo when present:

```tsx
      <header className="flex flex-col items-center px-4 pt-10 pb-4 text-center">
        {branding.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logo_url}
            alt=""
            className="mb-3 size-20 rounded-2xl object-cover shadow-[0_8px_30px_rgba(111,78,55,.15)]"
          />
        )}
        <h1 className="font-heading text-4xl font-semibold">{shop.name}</h1>
        {branding.tagline && (
          <p className="mt-2 text-sm text-muted-foreground">
            {branding.tagline}
          </p>
        )}
      </header>
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/components/shop/menu-page.tsx
git commit -m "feat(shop): show shop logo on the customer menu header"
```

---

### Task 5: Dynamic per-shop manifest + install metadata

**Files:**
- Create: `src/app/[slug]/manifest.webmanifest/route.ts`
- Modify: `src/app/[slug]/page.tsx` (per-shop `generateMetadata` + `generateViewport`)

**Interfaces:**
- Consumes: `parseBranding`, `createClient` (server), shop branding (Task 1).
- Produces: `GET /[slug]/manifest.webmanifest`; per-shop `manifest`/`themeColor`/apple-touch-icon on the shop page.

- [ ] **Step 1: Write the manifest route**

Create `src/app/[slug]/manifest.webmanifest/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server"
import { parseBranding, DEFAULT_BRANDING } from "@/lib/branding"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: shop } = await supabase
    .from("shops")
    .select("name, branding")
    .eq("slug", slug)
    .maybeSingle()

  if (!shop) return new Response("Not found", { status: 404 })

  const b = parseBranding(shop.branding)
  const icons = b.logo_url
    ? [
        {
          src: b.logo_url.replace("icon-512", "icon-192"),
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        { src: b.logo_url, sizes: "512x512", type: "image/png", purpose: "any" },
      ]
    : [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" }]

  const manifest = {
    name: shop.name,
    short_name: shop.name,
    description: b.tagline ?? "Order ahead and skip the queue.",
    start_url: `/${slug}?src=pwa`,
    scope: `/${slug}`,
    display: "standalone",
    theme_color: b.accent ?? DEFAULT_BRANDING.primary,
    background_color: DEFAULT_BRANDING.background,
    icons,
  }

  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  })
}
```

- [ ] **Step 2: Per-shop metadata + viewport on the shop page**

In `src/app/[slug]/page.tsx`:
1. Add `Viewport` to the type import: `import type { Metadata, Viewport } from "next";`
2. In `generateMetadata`, after computing `branding`, extend the returned object with the manifest + apple-touch-icon:

```tsx
  return {
    title: shop.name,
    description: branding.tagline ?? t("app.description"),
    manifest: `/${slug}/manifest.webmanifest`,
    icons: branding.logo_url
      ? { apple: branding.logo_url.replace("icon-512", "icon-180") }
      : undefined,
  };
```

3. Add a `generateViewport` export (per-shop theme colour):

```tsx
export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { slug } = await params;
  const shop = await getShopWithMenu(slug);
  const branding = shop ? parseBranding(shop.branding) : {};
  return { themeColor: branding.accent ?? "#6F4E37" };
}
```

(`getShopWithMenu` is already `cache()`-wrapped, so this adds no extra query.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: compiles; `/[slug]/manifest.webmanifest` route present.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[slug]/manifest.webmanifest/route.ts" "src/app/[slug]/page.tsx"
git commit -m "feat(pwa): dynamic per-shop manifest + install icon/theme"
```

---

### Task 6: Storage RLS isolation test

**Files:**
- Create: `tests/storage-rls.test.ts`

**Interfaces:**
- Consumes: the two seeded shops + `.env.test` creds from Slice 1's test setup (`SHOP_A_*`, `SHOP_B_*`, URL, anon key); the `shop-logos` bucket (Task 1).

- [ ] **Step 1: Write the test**

Create `tests/storage-rls.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.test" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
) // 1x1 png

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anon)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}
async function ownShopId(c: SupabaseClient): Promise<string> {
  const { data } = await c.from("staff_users").select("shop_id").single()
  return (data as { shop_id: string }).shop_id
}

describe("Storage RLS: shop-logos", () => {
  let a: SupabaseClient
  let b: SupabaseClient
  let aShop: string
  let bShop: string

  beforeAll(async () => {
    a = await signedIn(process.env.SHOP_A_EMAIL!, process.env.SHOP_A_PASSWORD!)
    b = await signedIn(process.env.SHOP_B_EMAIL!, process.env.SHOP_B_PASSWORD!)
    aShop = await ownShopId(a)
    bShop = await ownShopId(b)
  })

  afterAll(async () => {
    await a.storage.from("shop-logos").remove([`${aShop}/test.png`])
  })

  it("A can upload under its own shop folder", async () => {
    const { error } = await a.storage
      .from("shop-logos")
      .upload(`${aShop}/test.png`, PNG, { contentType: "image/png", upsert: true })
    expect(error).toBeNull()
  })

  it("A CANNOT upload under B's shop folder", async () => {
    const { error } = await a.storage
      .from("shop-logos")
      .upload(`${bShop}/hack.png`, PNG, { contentType: "image/png", upsert: true })
    expect(error).not.toBeNull()
  })

  it("logos are publicly readable (anon)", async () => {
    const anonClient = createClient(url, anon)
    const { data } = anonClient.storage
      .from("shop-logos")
      .getPublicUrl(`${aShop}/test.png`)
    const res = await fetch(data.publicUrl)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run the tests**

Run: `npm test`
Expected: the storage suite passes (3/3) alongside the existing RLS suite. If "A CANNOT upload under B's folder" fails, Storage RLS is misconfigured — do not weaken the test; report it.

- [ ] **Step 3: Commit**

```bash
git add tests/storage-rls.test.ts
git commit -m "test(storage): shop-logos cross-tenant write isolation + public read"
```

---

## Self-Review

**Spec coverage:** §2 profile fields → Tasks 1/3; §3 brand colour + contrast → Task 3; §4 logo pipeline → Task 2; §5 storage → Task 1; §6 profile UI → Task 3; §7 customer render + dynamic manifest → Tasks 4/5; §9 acceptance criteria → Tasks 3/4/5 (manual) + Task 6 (storage isolation). All covered.

**Placeholder scan:** no TBD/￼vague steps; every code step has complete code.

**Type consistency:** `Branding.logo_url` (Task 1) used identically in Tasks 2–5. `POST /api/branding/logo` returns `{ logo_url }` (Task 2) — consumed exactly in Task 3. `contrastVsWhite` threshold 4.5 consistent between UI guard and spec §3. `<DashboardNav active="profile">` matches the `Section` union extended in Task 3.

**Notes / known trade-offs:**
- Icon-URL derivation uses `.replace("icon-512", "icon-192"/"icon-180")` — relies on the stable filename pattern from Task 2 (documented).
- Storage-object CDN caching may delay a re-uploaded logo; the `<img>` cache-bust (`?t=`) covers the dashboard preview; manifest icons may lag briefly (acceptable, noted in spec §11).
- The `is_staff_of(((storage.foldername(name))[1])::uuid)` cast fails closed (a non-uuid folder → error → write denied), which is the desired behaviour.
