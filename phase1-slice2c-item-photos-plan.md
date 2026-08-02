# Slice 2c — Item Photos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a shop owner attach one photo per menu item; show it as a thumbnail on the customer card and a hero in the item detail sheet.

**Architecture:** UI + one storage migration. `menu_items.photo_url` already exists. A new public `menu-photos` bucket (RLS mirrors `shop-logos`) plus a sharp upload route (`/api/menu/photo` → 800px WebP → `{shop_id}/{item_id}.webp`). Upload is folded into the existing item form and deferred to Save (upsert the item first, then POST the file), so cancelling a new item leaves no orphaned file. Display reads `item.photo_url`.

**Tech Stack:** Next.js App Router (route handlers + client components), `sharp`, Supabase Storage + JS client, shadcn/ui, vitest (node env).

## Global Constraints

- **No column migration** — `menu_items.photo_url text` already exists. One **storage** migration only.
- **No service-role key.** The route uses the session client (`@/lib/supabase/server`); storage RLS enforces staff-of-folder. `create_order` untouched.
- **Bucket:** public `menu-photos`; object path is **`{shop_id}/{item_id}.webp`**; write policies guarded by `public.is_staff_of(((storage.foldername(name))[1])::uuid)`.
- **Processing:** `sharp(input).rotate().resize(800, 800, { fit: "cover", position: "centre" }).webp({ quality: 80 })`. Input cap **`MAX_BYTES = 10 * 1024 * 1024`**.
- **Images:** plain `<img>` with `// eslint-disable-next-line @next/next/no-img-element` (project has no `next/image`); `object-cover`. Cache-bust re-uploads by storing the URL with a `?v=<timestamp>` query in `photo_url`.
- **All strings via `t()`** (`@/lib/i18n`). Dashboard theme Travo; customer theme Latte. Money/other conventions unchanged.
- After each code step run `npm run build` and `npm run lint`; both must be clean (a pre-existing `sw.js` lint warning and `dashboard-shell.tsx`/`order/[token]` issues are unrelated — ignore those, but introduce no new ones).

---

### Task 1: Storage migration — `menu-photos` bucket + RLS

**Files:**
- Create: `supabase/migrations/20260802000000_menu_photos_storage.sql`

**Interfaces:**
- Produces: a public `menu-photos` bucket with public-read + staff-scoped insert/update/delete policies (path folder = `shop_id`).

- [ ] **Step 1: Write the migration** (mirrors `20260726130000_shop_logos_storage.sql`)

```sql
-- Phase 1 Slice 2c: public bucket for menu item photos, staff-write-scoped.
insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do nothing;

-- Public read (photos are shown to anonymous customers).
create policy "menu_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'menu-photos');

-- Staff may write ONLY under their own shop's folder: path = "{shop_id}/...".
create policy "menu_photos_staff_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-photos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  );

create policy "menu_photos_staff_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-photos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'menu-photos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  );

create policy "menu_photos_staff_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-photos'
    and public.is_staff_of(((storage.foldername(name))[1])::uuid)
  );
```

- [ ] **Step 2: Apply it to the remote project**

Run: `supabase db push`
Expected: applies `20260802000000_menu_photos_storage.sql` with no error.
If the CLI isn't linked in this environment, paste the SQL above into the Supabase dashboard → SQL editor for project `iryavyogljedwgllaoit` and run it (the Zizwe-org project isn't reachable via the Supabase MCP).

- [ ] **Step 3: Verify the bucket exists**

Run: `supabase storage ls ss://menu-photos` (or check Storage in the dashboard).
Expected: the bucket exists and is empty. (Full RLS behaviour is asserted in Task 5.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260802000000_menu_photos_storage.sql
git commit -m "$(cat <<'EOF'
feat(storage): menu-photos bucket + staff-scoped RLS

Public read; staff may write only under their own shop's folder
({shop_id}/...), mirroring shop-logos. For per-item photos (Slice 2c).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Upload route `POST /api/menu/photo`

**Files:**
- Create: `src/app/api/menu/photo/route.ts`

**Interfaces:**
- Consumes: `menu-photos` bucket (Task 1).
- Produces: `POST /api/menu/photo` — `multipart/form-data` with `file` + `item_id`; on success returns `{ photo_url: string }` and sets `menu_items.photo_url`. Errors: 400 `no_file`/`no_item`/`not_image`/`too_large`/`invalid_image`, 401 `unauthorized`, 403 `forbidden`, 404 `no_item`, 500 `upload_failed`/`save_failed`.

- [ ] **Step 1: Write the route** (mirrors `src/app/api/branding/logo/route.ts`)

```ts
import { NextResponse } from "next/server"
import sharp from "sharp"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const form = await request.formData()
  const file = form.get("file")
  const itemId = form.get("item_id")
  if (!(file instanceof File))
    return NextResponse.json({ error: "no_file" }, { status: 400 })
  if (typeof itemId !== "string")
    return NextResponse.json({ error: "no_item" }, { status: 400 })
  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "not_image" }, { status: 400 })
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "too_large" }, { status: 400 })

  // Resolve the item's shop and verify the caller staffs it — the client
  // never dictates the shop folder.
  const { data: item } = await supabase
    .from("menu_items")
    .select("shop_id")
    .eq("id", itemId)
    .single()
  if (!item) return NextResponse.json({ error: "no_item" }, { status: 404 })
  const { data: staff } = await supabase
    .from("staff_users")
    .select("shop_id")
    .eq("auth_user_id", user.id)
    .eq("shop_id", item.shop_id)
    .maybeSingle()
  if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const input = Buffer.from(await file.arrayBuffer())
  let webp: Buffer
  try {
    webp = await sharp(input)
      .rotate() // honour EXIF orientation
      .resize(800, 800, { fit: "cover", position: "centre" })
      .webp({ quality: 80 })
      .toBuffer()
  } catch {
    // sharp couldn't decode (corrupt/unsupported image past the MIME check).
    return NextResponse.json({ error: "invalid_image" }, { status: 400 })
  }

  const path = `${item.shop_id}/${itemId}.webp`
  const { error: upErr } = await supabase.storage
    .from("menu-photos")
    .upload(path, webp, { contentType: "image/webp", upsert: true })
  if (upErr)
    return NextResponse.json({ error: "upload_failed" }, { status: 500 })

  const {
    data: { publicUrl },
  } = supabase.storage.from("menu-photos").getPublicUrl(path)
  // Re-uploads reuse the same path, so version the stored URL to bust caches
  // everywhere (customers included).
  const photo_url = `${publicUrl}?v=${Date.now()}`
  const { error: saveErr } = await supabase
    .from("menu_items")
    .update({ photo_url })
    .eq("id", itemId)
  if (saveErr)
    return NextResponse.json({ error: "save_failed" }, { status: 500 })

  return NextResponse.json({ photo_url })
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build` then `npm run lint`
Expected: both clean. (Route behaviour is exercised end-to-end in Task 3.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/menu/photo/route.ts
git commit -m "$(cat <<'EOF'
feat(api): item photo upload route (sharp -> 800px webp)

POST /api/menu/photo: verifies the caller staffs the item's shop, processes
to an 800px cover WebP, stores at menu-photos/{shop_id}/{item_id}.webp, sets
menu_items.photo_url (versioned URL to bust caches). Session client + storage RLS.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Photo field + item-form upload/remove + dashboard fetch/thumbnail

Fold the photo into the existing item form: pick → local preview → on Save, upsert the item then POST the file (or delete on remove). Also thread `photo_url` through the dashboard fetch + types and show a row thumbnail.

**Files:**
- Create: `src/components/dashboard/item-photo-field.tsx`
- Modify: `src/components/dashboard/item-form-sheet.tsx` (type + photo state + `save()`)
- Modify: `src/components/dashboard/menu-types.ts` (add `photo_url` to the item type)
- Modify: `src/app/dashboard/menu/page.tsx` (add `photo_url` to the select)
- Modify: `src/components/dashboard/menu-editor.tsx` (row thumbnail)
- Modify: `src/lib/i18n.ts` (strings)

**Interfaces:**
- Consumes: `POST /api/menu/photo` (Task 2); `EditorItem` from `item-form-sheet`.
- Produces: `ItemPhotoField({ previewUrl: string | null; onChoose: (file: File) => void; onRemove: () => void })`; `EditorItem` now includes `photo_url: string | null`.

- [ ] **Step 1: Add i18n keys**

In `src/lib/i18n.ts`, add before the closing `} as const` (with the other `editor.*` keys):

```ts
  "editor.photo": "Photo",
  "editor.choosePhoto": "Add photo",
  "editor.changePhoto": "Change photo",
  "editor.removePhoto": "Remove",
  "editor.photoTooLarge": "That image is too large (max 10 MB).",
  "editor.photoFailed": "Couldn't upload the photo — try again.",
```

- [ ] **Step 2: Create the photo field component**

Create `src/components/dashboard/item-photo-field.tsx`:

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { t } from "@/lib/i18n"

export function ItemPhotoField({
  previewUrl,
  onChoose,
  onRemove,
}: {
  previewUrl: string | null
  onChoose: (file: File) => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{t("editor.photo")}</Label>
      {previewUrl && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className="size-20 rounded-2xl border border-border object-cover"
          />
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-full px-4 text-sm text-destructive"
            onClick={onRemove}
          >
            {t("editor.removePhoto")}
          </Button>
        </div>
      )}
      <label className="inline-flex h-10 w-fit cursor-pointer items-center rounded-full bg-secondary px-4 text-sm font-medium text-secondary-foreground">
        {previewUrl ? t("editor.changePhoto") : t("editor.choosePhoto")}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onChoose(f)
            e.target.value = "" // allow re-choosing the same file
          }}
        />
      </label>
    </div>
  )
}
```

- [ ] **Step 3: Add `photo_url` to the editor item type**

In `src/components/dashboard/item-form-sheet.tsx`, add to the `EditorItem` type:

```ts
export type EditorItem = {
  id: string
  name: string
  description: string | null
  price_minor: number
  currency: string
  is_available: boolean
  sort_order: number
  category_id: string
  allergens: string[]
  photo_url: string | null
}
```

(`menu-types.ts` re-exports `EditorItem` and defines `EditorMenuItem = EditorItem & { option_groups: EditorGroup[] }`, so it inherits `photo_url` automatically — no change needed there beyond confirming it re-exports `EditorItem`.)

- [ ] **Step 4: Wire photo state + upload/remove into the item form**

In `src/components/dashboard/item-form-sheet.tsx`:

Add imports:
```ts
import { toast } from "sonner"
import { ItemPhotoField } from "@/components/dashboard/item-photo-field"
```
(`toast` is already imported — keep one import.)

Add state near the other `useState` calls:
```ts
  const [photoPreview, setPhotoPreview] = useState<string | null>(item?.photo_url ?? null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)

  const choosePhoto = (file: File) => {
    if (file.size > 10 * 1024 * 1024) return toast.error(t("editor.photoTooLarge"))
    setPhotoFile(file)
    setPhotoRemoved(false)
    setPhotoPreview(URL.createObjectURL(file))
  }
  const removePhoto = () => {
    setPhotoFile(null)
    setPhotoRemoved(true)
    setPhotoPreview(null)
  }
```

Replace the body of `save()` from `setSaving(true)` through the mutation with a version that captures the item id and then handles the photo:

```ts
    setSaving(true)
    const fields = {
      name: trimmed,
      description: description.trim() || null,
      price_minor,
      category_id: categoryId,
      allergens: [...allergens],
    }

    let itemId = item?.id
    if (item) {
      const { error } = await supabase.from("menu_items").update(fields).eq("id", item.id)
      if (error) {
        setSaving(false)
        return toast.error(t("editor.saveFailed"))
      }
    } else {
      const { data, error } = await supabase
        .from("menu_items")
        .insert({ ...fields, shop_id: shopId, currency, is_available: true, sort_order: nextSortOrder })
        .select("id")
        .single()
      if (error || !data) {
        setSaving(false)
        return toast.error(t("editor.saveFailed"))
      }
      itemId = data.id
    }

    if (photoFile && itemId) {
      const body = new FormData()
      body.append("file", photoFile)
      body.append("item_id", itemId)
      const res = await fetch("/api/menu/photo", { method: "POST", body })
      if (!res.ok) {
        setSaving(false)
        return toast.error(t("editor.photoFailed"))
      }
    } else if (photoRemoved && item?.photo_url && itemId) {
      await supabase.storage.from("menu-photos").remove([`${shopId}/${itemId}.webp`])
      await supabase.from("menu_items").update({ photo_url: null }).eq("id", itemId)
    }

    setSaving(false)
    toast.success(t("editor.saved"))
    onOpenChange(false)
    router.refresh()
```

Mount the field inside the form body (place it after the allergens block, before the Save `Button`):

```tsx
          <ItemPhotoField
            previewUrl={photoPreview}
            onChoose={choosePhoto}
            onRemove={removePhoto}
          />
```

- [ ] **Step 5: Add `photo_url` to the dashboard fetch**

In `src/app/dashboard/menu/page.tsx`, add `photo_url` to the `menu_items(...)` column list (it's column-explicit today):

```ts
      "id, name, sort_order, menu_items(id, name, description, price_minor, currency, is_available, sort_order, category_id, allergens, photo_url, option_groups(id, name, type, required, sort_order, options(id, name, price_delta_minor, sort_order)))"
```

- [ ] **Step 6: Add a row thumbnail in the menu editor**

In `src/components/dashboard/menu-editor.tsx`, inside the item `<li>`, add as the first child (before the name `<span>`):

```tsx
                  {it.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.photo_url}
                      alt=""
                      className="size-9 shrink-0 rounded-lg object-cover"
                    />
                  )}
```

- [ ] **Step 7: Build, lint, browser-verify**

Run: `npm run build` then `npm run lint` — Expected: both clean (no NEW issues).

Then run the dev server and verify as `owner@cornergrind.test` (dashboard login; password in local `.env.test`). **Important — this is a PWA on a OneDrive path: after any dev restart, unregister the service worker + clear caches in the browser console or stale JS masks your changes** (`navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())); caches.keys().then(ks=>ks.forEach(k=>caches.delete(k)))`, then hard-reload). Verify:
- Edit an item → Add photo → pick an image → local preview shows → Save → reopen the item: the photo persists; a thumbnail shows on the item's dashboard row.
- Add a **new** item with a photo in one step → it saves with the photo.
- Remove on an item with a photo → Save → photo gone from the row; the storage object is deleted.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/item-photo-field.tsx src/components/dashboard/item-form-sheet.tsx src/app/dashboard/menu/page.tsx src/components/dashboard/menu-editor.tsx src/lib/i18n.ts
git commit -m "$(cat <<'EOF'
feat(editor): item photo upload in the item form

Adds an ItemPhotoField (pick + local preview + remove). On save the form
upserts the item then POSTs the file to /api/menu/photo (deferred upload =
no orphaned files); remove deletes the object + clears photo_url. Threads
photo_url through the dashboard fetch/types and shows a row thumbnail.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Customer display — card thumbnail + item-sheet hero

**Files:**
- Modify: `src/components/shop/menu-page.tsx` (`ItemCard` thumbnail)
- Modify: `src/components/shop/item-sheet.tsx` (sheet hero)

**Interfaces:**
- Consumes: `item.photo_url` on `MenuItemWithGroups` (already part of `Tables<"menu_items">`; the customer fetch uses `menu_items(*)`, so it's populated — no fetch change).
- Produces: nothing new.

- [ ] **Step 1: Card thumbnail**

In `src/components/shop/menu-page.tsx`, in `ItemCard`, add as the first child inside the `<button>` (before the text `<span>`):

```tsx
      {item.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.photo_url}
          alt=""
          className="size-16 shrink-0 rounded-2xl object-cover"
        />
      )}
```

- [ ] **Step 2: Item-sheet hero**

In `src/components/shop/item-sheet.tsx`, in `ItemSheetBody`, add as the very first element of the returned fragment (before `<SheetHeader>`):

```tsx
      {item.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.photo_url}
          alt=""
          className="h-40 w-full rounded-t-3xl object-cover"
        />
      )}
```

- [ ] **Step 3: Build, lint, browser-verify (customer side)**

Run: `npm run build` then `npm run lint` — Expected: clean.

In the browser (SW cleared per Task 3 note), open `/corner-grind`:
- An item that has a photo shows a thumbnail on its menu card and a full-width hero at the top of its detail sheet.
- An item with **no** photo renders cleanly — no broken image, card and sheet look intact.
- Take a screenshot of the menu (proof) once an item has a photo.

- [ ] **Step 4: Commit**

```bash
git add src/components/shop/menu-page.tsx src/components/shop/item-sheet.tsx
git commit -m "$(cat <<'EOF'
feat(shop): show item photos on the customer menu

Thumbnail on each menu card and a full-width hero at the top of the item
detail sheet when photo_url is set; text-only items render unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Storage RLS test — `menu-photos` cross-tenant

**Files:**
- Modify: `tests/storage-rls.test.ts` (add a `menu-photos` describe block)

**Interfaces:**
- Consumes: the `menu-photos` bucket (Task 1); `a`, `b` signed-in clients and `ownShopId` helper already in the file.

**Precondition:** Task 1 applied to the remote project (the bucket must exist).

- [ ] **Step 1: Add the test block**

Append a new `describe` inside `tests/storage-rls.test.ts` (after the existing `shop-logos` describe). Reuse the file's existing `signedIn`, `ownShopId`, and `PNG` (storage RLS checks the path, not the bytes — an actual WebP isn't needed):

```ts
describe("Storage RLS: menu-photos", () => {
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
    await a.storage.from("menu-photos").remove([`${aShop}/rls-test.webp`])
  })

  it("A can upload under its own shop folder", async () => {
    const { error } = await a.storage
      .from("menu-photos")
      .upload(`${aShop}/rls-test.webp`, PNG, {
        contentType: "image/webp",
        upsert: true,
      })
    expect(error).toBeNull()
  })

  it("A CANNOT upload under B's shop folder", async () => {
    const { error } = await a.storage
      .from("menu-photos")
      .upload(`${bShop}/hack.webp`, PNG, {
        contentType: "image/webp",
        upsert: true,
      })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run the full suite**

Run: `npm run test`
Expected: PASS — all existing tests plus the two new `menu-photos` cases. (The positive-control upload cleans itself up in `afterAll`.)

- [ ] **Step 3: Commit**

```bash
git add tests/storage-rls.test.ts
git commit -m "$(cat <<'EOF'
test(storage): menu-photos cross-tenant write is blocked

A can upload under its own shop folder; A cannot upload under B's folder
(storage RLS via foldername[1] = shop_id).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Bucket + RLS (spec §3 Storage) → Task 1. ✓
- Upload route, sharp 800px WebP, 10 MB cap, shop verification, invalid_image (spec §3 route) → Task 2. ✓
- Photo picker, local preview, deferred upload on save, remove (spec §3 Upload UX) → Task 3. ✓
- Customer card thumbnail + item-sheet hero, no-photo clean (spec §3 Display) → Task 4; dashboard row thumbnail + fetch/type → Task 3. ✓
- Acceptance criteria: AC1/2/3 → Task 3 Step 7; AC4 (large/rotated/non-image) → route (Task 2) exercised in Task 3; AC5 (cross-tenant) → Task 5; AC6 (no-photo clean) → Task 4 Step 3. ✓
- Testing (browser + storage RLS) → Tasks 3/4 browser + Task 5. ✓

**Placeholder scan:** No TBD/TODO; every code step is complete. The migration timestamp `20260802000000` is a concrete filename (adjust only if it collides with an existing migration). ✓

**Type consistency:** `photo_url: string | null` added once to `EditorItem` (Task 3) and inherited by `EditorMenuItem`; `ItemPhotoField` props match its call site; the route's `{ photo_url }` response shape matches the form's `res.ok` check (form reads no body — just status). `item.photo_url` on the customer side comes from `Tables<"menu_items">` (no new type). Storage path `${shopId}/${itemId}.webp` is identical in the route (upload), the form (remove), and the RLS test. ✓
