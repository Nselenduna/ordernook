# OrderNook — Phase 1, Slice 3: Shop Profile & Branding (design spec)

**Date:** 26 July 2026 · **Status:** Approved, ready for implementation plan
**Depends on:** Phase 0, Slice 1 (Go-Live Kit). **Strategy:** lean pilot-first.

> Note: Slice 2 (full menu editor) is deliberately being done AFTER this. Slice numbering follows the plan; order of build is the user's call.

---

## 1. Goal

Let a shop owner control their own identity from the dashboard — **name, tagline, logo, and one brand colour** — and have it flow to (a) the customer PWA and (b) the *installed* home-screen app (icon, name, theme colour). This is what makes each shop's installed PWA feel like *their* app, not OrderNook's.

## 2. Scope

- A dashboard **Profile** tab (5th nav item): edit shop **name**, **tagline**, **brand colour** (picker + contrast guard), **logo** (upload + live preview).
- **Logo auto-processing**: any uploaded image → square, opaque PNG at 512 / 192 / 180 px.
- **Dynamic per-shop manifest** + `apple-touch-icon` + `theme-color`, so installing the shop's page yields the shop's icon/name/colour.
- **Supabase Storage** for logos (public bucket, RLS-scoped writes, no service-role key).

## 3. Branding model (decided)

- The shop picks **ONE brand colour**. It drives `--brand-primary` (buttons, prices, headings, active states) via the existing `brandingVars()`. Background stays Latte cream (`--brand-bg`); `--brand-accent` is derived from / set equal to the brand colour. All other Latte Glass tokens unchanged.
- **Contrast guard (decided):** a native colour `<input type="color">` picker with a **live WCAG check**. White button text sits on the brand colour, so the chosen colour must have **≥ 4.5:1 contrast against white**. If it fails, show a clear inline warning and **block save** (with a hint to pick a darker shade). This is how "one colour" stays safe/readable.
- `shops.branding` (jsonb) stores `{ tagline, accent, logo_url }`. `shops.name` is a real column. **No table migration** — only the Storage migration in §5.

## 4. Logo pipeline

1. Profile screen sends the raw file to a Next.js **route handler** `POST /api/branding/logo` (Node runtime).
2. Handler: authenticate via the server Supabase client (cookies → session); resolve the caller's `shop_id` via `staff_users` (RLS). Validate: image mime type, ≤ 4 MB.
3. **sharp**: center-crop to square → flatten onto an opaque background (white) → output PNG at **512, 192, 180**.
4. Upload the three PNGs to Storage as the signed-in user (RLS applies) at `shop-logos/{shop_id}/icon-512.png` / `icon-192.png` / `icon-180.png` (upsert, so re-upload replaces).
5. Save the public URL of `icon-512.png` into `shops.branding.logo_url` (via the same authed client).
6. Return the URLs to the client for immediate preview.

**sharp runs inside the Next app on Vercel (Node runtime)** — decided; not offloaded to an Edge Function.

## 5. Supabase Storage (one migration)

`supabase/migrations/<ts>_shop_logos_storage.sql`:
- Create bucket `shop-logos` as **public** (public read for logos/icons).
- RLS on `storage.objects`:
  - **read**: allow when `bucket_id = 'shop-logos'` (public), OR rely on the bucket's public flag.
  - **insert/update/delete**: allow when `bucket_id = 'shop-logos'` AND `public.is_staff_of( ((storage.foldername(name))[1])::uuid )` — i.e. the path's first folder is the caller's own `shop_id`. Reuses the existing `is_staff_of(uuid)` SECURITY DEFINER function. No service-role key.

## 6. Profile UI

- New route `src/app/dashboard/profile/page.tsx` (server: `getStaffShop()`, render `<ShopProfile>`), and `src/components/dashboard/shop-profile.tsx` (client).
- Fields: **name** (text), **tagline** (text), **brand colour** (`<input type=color>` + hex, live contrast readout + block-on-fail), **logo** (file input + preview of current/new logo).
- Name/tagline/colour save via the existing anon client under `shops_staff_update` RLS (no new RPC). Logo goes through the `/api/branding/logo` route (§4).
- Add **Profile** to `DashboardNav` (`active="profile"`).

## 7. Customer + installed-app render

- `src/components/shop/menu-page.tsx`: render the logo (rounded, above the name) when `branding.logo_url` is set; fall back to name-only when not.
- `src/app/[slug]/page.tsx`: `generateMetadata` overrides `manifest` → `/{slug}/manifest.webmanifest`, sets `icons.apple` → the 180 icon; `generateViewport` sets `themeColor` → the shop's brand colour.
- New `src/app/[slug]/manifest.webmanifest/route.ts`: returns per-shop manifest JSON — `name`, `short_name`, `description` (tagline), `start_url=/{slug}?src=pwa`, `scope=/{slug}`, `display=standalone`, `theme_color`=brand colour, `background_color`=Latte cream, `icons`=[192, 512]. Falls back to defaults when the shop has no logo yet.
- Root `layout.tsx` keeps its generic manifest/theme for non-shop routes (unchanged).

## 8. Security / conventions
- **No service-role key.** The logo route uses the caller's session; Storage RLS enforces per-shop write isolation. Name/branding writes go through `shops_staff_update` RLS.
- Validate upload type + size server-side (never trust the client). Processed output is always opaque PNG (prevents iOS black-box on transparent logos).
- `create_order` remains untouched (this slice is presentation/identity only).

## 9. Acceptance criteria
1. Owner edits **name** + **tagline** in Profile → persists → reflected on the customer `[slug]` header and the page `<title>`.
2. Owner picks a **brand colour** → customer PWA re-skins (buttons/prices/headings). A colour with < 4.5:1 contrast vs white is **blocked** with an inline warning.
3. Owner uploads a **logo** → stored as opaque square PNGs (512/192/180); shows in the Profile preview and the customer header.
4. **Installing** the shop's page to the home screen uses the **shop's logo** as the icon and the shop **name + brand colour** (dynamic manifest + apple-touch-icon + theme-color). Verify on a real iPhone + Android.
5. **Storage isolation**: a shop's staff can upload only under their own `{shop_id}/` folder, not another shop's; logos are publicly readable.
6. Non-shop routes still use the generic OrderNook manifest/icon.

## 10. Testing
- Manual: criteria 1–4, 6 on the deployed site (incl. a real-device install to confirm the icon + theme).
- Automated: extend `tests/rls.test.ts` (or a sibling) — signed-in staff A can upload to `shop-logos/{A}/…` but a write to `shop-logos/{B}/…` is rejected; public read works unauthenticated.

## 11. Out of scope (later)
Full three-colour theming, cover/hero photos, image galleries, custom domains, cropping UI (we auto-center-crop for now), light/dark logo variants.

## 12. Open questions
None blocking.
