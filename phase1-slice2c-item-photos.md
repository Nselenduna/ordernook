# OrderNook — Phase 1, Slice 2c: Item Photos — design spec

**Date:** 2 August 2026 · **Status:** Approved, ready for implementation plan
**Depends on:** Phase 0, Slice 2a (Menu Editor), Slice 3 (Branding — reuses its Storage + sharp pipeline). **Strategy:** lean pilot-first.

> Slice 2 (full menu editor) decomposed into: 2a items+categories (shipped), 2b option groups/options (shipped), **2c item photos (this)**. Final piece of Slice 2.

## 1. Goal
Let a shop owner add one photo per menu item. Show it as a thumbnail on the customer menu card and a full-width hero at the top of the item detail sheet. Items without a photo still render cleanly (text-only card, no hero).

## 2. Key context (why it's small)
- `menu_items.photo_url text` **already exists** (Phase 0 schema) — no column migration.
- Slice 3 already built a working **sharp → Supabase Storage → staff-scoped RLS** pipeline (`/api/branding/logo` + `shop-logos` bucket). This slice mirrors it for item photos.
- `order_items` store snapshots, so changing/removing a photo never affects past orders.
- So this slice is: **one migration** (new `menu-photos` bucket + RLS) + one upload route + upload UI in the existing item form + display on the customer menu/sheet + a dashboard thumbnail.

## 3. Scope

**Storage & processing** (mirrors Slice 3):
- New **public** bucket `menu-photos`. RLS copied from `shop-logos`: public read; staff may write/update/delete only under their own shop's folder — path is `{shop_id}/...`, guarded by `public.is_staff_of(((storage.foldername(name))[1])::uuid)`.
- New route **`POST /api/menu/photo`** (`runtime = "nodejs"`): auth via session; body is `multipart/form-data` with `file` + `item_id`. The route looks up the item's `shop_id` server-side (`menu_items` join) and verifies `is_staff_of(shop_id)` — the client never dictates the shop. Processes with **sharp**: `rotate()` (honour EXIF orientation), `resize(800, 800, { fit: "cover", position: "centre" })`, `.webp({ quality: 80 })`. Uploads to `menu-photos/{shop_id}/{item_id}.webp` with `upsert: true`. Returns `{ photo_url }` (public URL).
- **Max input ~10 MB** (`MAX_BYTES = 10 * 1024 * 1024`) — phone photos are large and sharp downscales anyway (more forgiving than the logo route's 4 MB). Reject non-images by `Content-Type` and catch sharp decode failures → `invalid_image`.

**Upload UX — folded into the existing item form** (`item-form-sheet.tsx`):
- A photo picker block: current photo (or a placeholder), "Choose photo" (`<input type="file" accept="image/*">`) and "Remove".
- Picking a file shows an instant **local preview** (`URL.createObjectURL`) before save — no upload yet.
- **Upload is deferred to Save** (avoids orphaned files if the owner cancels a new item): the form holds the chosen `File` in state; on save → upsert the item (existing 2a logic, get its `id`) → **if a new file was chosen**, `POST` it with `item_id` to `/api/menu/photo` → set `photo_url` on the item to the returned URL (a follow-up `update`). Then `router.refresh()`.
- **Remove** = clear the preview/photo in the form; on save, set `photo_url = null` and delete the stored object (`supabase.storage.from("menu-photos").remove(["{shop_id}/{item_id}.webp"])`, allowed by the staff delete policy). Client knows `shopId` (prop) and `item.id`.

**Display:**
- **Customer card** (`menu-page.tsx` `ItemCard`): when `item.photo_url` is set, a left-aligned rounded thumbnail (~60px, `object-cover`) before the name/description; price stays right. No photo → current text-only layout unchanged.
- **Customer item sheet** (`item-sheet.tsx`): when `item.photo_url` is set, a full-width hero image at the very top of the sheet (rounded top corners, `object-cover`, fixed height ~160px). No photo → current header unchanged.
- **Dashboard menu editor** (`menu-editor.tsx`): a small thumbnail (~36px) on each item row when a photo exists — at-a-glance which items have one.

## 4. Data model
No column migration (`photo_url` exists). One **storage** migration: create the `menu-photos` bucket + the four RLS policies (public read; staff insert/update/delete scoped by `is_staff_of(foldername[1])`). Add it as `supabase/migrations/2026080200XXXX_menu_photos_storage.sql`.

## 5. Files
- **New** `supabase/migrations/2026080200XXXX_menu_photos_storage.sql` — bucket + RLS (mirror `20260726130000_shop_logos_storage.sql`).
- **New** `src/app/api/menu/photo/route.ts` — upload/process route (mirror `src/app/api/branding/logo/route.ts`).
- **New** `src/components/dashboard/item-photo-field.tsx` — the picker (preview / choose / remove) used inside the item form. Exposes its chosen-`File`-or-`remove` state to the parent form so the parent orchestrates upload on save.
- **Edit** `src/components/dashboard/item-form-sheet.tsx` — mount the photo field; extend `save()` to upload the file (post-item-upsert) or delete on remove; carry `photo_url` on `EditorItem`.
- **Edit** `src/components/dashboard/menu-editor.tsx` — item-row thumbnail; add `photo_url` to the `EditorItem`/`EditorMenuItem` type in `menu-types.ts` so the row and form carry it.
- **Edit** `src/app/dashboard/menu/page.tsx` — **add `photo_url`** to the `menu_items(...)` select (this fetch is column-explicit and omits it today; the customer fetch in `app/[slug]/page.tsx` already gets it via `menu_items(*)`, so no change there).
- **Edit** `src/components/shop/menu-page.tsx` — `ItemCard` thumbnail.
- **Edit** `src/components/shop/item-sheet.tsx` — hero image.
- **Edit** `src/lib/i18n.ts` — new `t()` strings (choose/remove/uploading/too-large/failed/alt text).

## 6. Security / conventions
- No service-role key. The route uses the **session** Supabase client; the storage insert/update/delete policies enforce that the caller staffs `{shop_id}`. The route additionally verifies `is_staff_of` for the item's shop before building the path — the client cannot target another shop's folder.
- `create_order` untouched. All strings via `t()`. Dashboard theme Travo; customer theme Latte. Images use `object-cover`; use `<img>` with `eslint-disable-next-line @next/next/no-img-element` to match the existing logo/customer-header pattern (no `next/image` in this project).
- Photo is content-addressed per item (`{item_id}.webp`, `upsert: true`); after re-upload, **cache-bust** the displayed `<img>` with `?t=${Date.now()}` (same trick as the logo in `shop-profile.tsx`).

## 7. Acceptance criteria
1. Owner edits an item, chooses a photo, saves → thumbnail appears on the customer card and a hero at the top of the item sheet.
2. Owner adds a photo while **creating a new item** (one step) → item saves with the photo; cancelling the add before save leaves **no** file in storage.
3. Remove clears the photo from the card and sheet and deletes the stored object; re-uploading a different photo replaces it (no stale cached image).
4. A large phone photo (~8 MB, portrait) is accepted, EXIF-rotated upright, and downscaled to an 800px WebP (not rejected); a non-image file is rejected with a clear message.
5. Cross-tenant: shop A's staff cannot upload into shop B's `menu-photos/{B}/...` folder (storage RLS blocks it).
6. An item with no photo renders cleanly on the customer card and sheet (no broken image, layout intact) and shows no thumbnail on the dashboard row.

## 8. Testing
- Manual browser for criteria 1–4/6 (edit as `owner@cornergrind.test`; verify on `/[slug]`). Clean up any test photo afterward.
- Extend `tests/rls.test.ts` (or the storage test file): staff A cannot INSERT a `storage.objects` row under `menu-photos/{bShopId}/...`; a control that A *can* write under its own folder. Mirror the Slice 3 `storage-rls` test shape.

## 9. Out of scope
Multiple photos per item, in-app cropping/rotation UI (beyond auto EXIF-rotate), drag-reorder of images, AI/stock imagery, `next/image` optimization, per-photo alt-text editing (alt falls back to the item name).

## 10. Open questions
None.
