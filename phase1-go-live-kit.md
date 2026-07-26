# OrderNook — Phase 1, Slice 1: Go-Live Kit (design spec)

**Date:** 26 July 2026 · **Status:** Approved, ready for implementation plan
**Depends on:** Phase 0 (complete). **Strategy:** lean pilot-first (Lloyd onboards 2–3 pilot shops by hand; this slice gives each shop the tools to run daily service unattended).

---

## 1. Goal

Make a hand-onboarded pilot shop **operationally self-sufficient for daily service** without Lloyd touching the database. A shop owner can, from the dashboard: mark items sold out, pause/resume ordering, set their prep-time estimate, and print a QR/link to put on the counter. Customers see allergen info before ordering (UK food law).

Explicitly NOT in this slice: building/editing the menu itself (Lloyd seeds each pilot's menu), branding, self-serve registration. Those are later Phase 1 slices.

## 2. Key context (why this slice is small)

The Phase 0 backend already supports most of this:
- `shops.is_paused`, `shops.prep_minutes`, `shops.hours` (jsonb), `menu_items.is_available` all exist.
- `create_order` already **enforces** `is_paused` (raises `shop_paused`) and `is_available` (raises `item_unavailable`).
- RLS policies `shops_staff_update` and `items_staff_update` already let a shop's staff update those rows.
- The customer PWA already renders a "ordering is paused" state.

So this slice is **mostly dashboard UI** over an existing backend, plus one small schema addition (allergens) and a QR generator. No new RPCs; no service-role key (keeps the Phase 0 security model).

## 3. Scope

### 3.1 Dashboard shell / navigation
- Add a nav to the dashboard with sections: **Orders** (existing live queue), **Menu**, **Settings**, **QR**.
- Refactor `src/components/dashboard/dashboard-shell.tsx` minimally to host the nav + route between sections. Auth guard unchanged (existing Supabase Auth login).

### 3.2 Menu availability (sold-out toggle)
- New screen listing the shop's `menu_items` grouped by category (read from Supabase, scoped by the staff member's `shop_id` via RLS).
- Each item has a **Sold out / Available** switch that updates `menu_items.is_available`.
- Optimistic UI; on error, revert and toast. No add/edit/delete of items in this slice.

### 3.3 Settings
- **Accepting orders** toggle → `shops.is_paused` (inverted for display: "Accepting orders" ON = `is_paused` false). This single control covers both "we're closed" and "we're slammed, pause". Prominent, with clear on/off state.
- **Prep time** (minutes) → `shops.prep_minutes` (numeric input; drives the customer ETA "ready around HH:MM").
- **Hours kept simple for the pilot:** NO 7-day schedule editor. `shops.hours` column stays untouched (default `{}`) for a future slice.

### 3.4 QR / link
- Show the shop's public URL: `https://ordernook.uk/{slug}?src=qr`.
- **Download QR (PNG)** generated client-side (`qrcode` npm).
- **Print poster**: a print-styled page (shop name + QR + "Skip the queue — scan to order") that the owner prints via the browser (`window.print()` → PDF/paper). No server-side PDF service in this slice.
- The `?src=qr` param is for attribution (already in the SPEC).

### 3.5 Allergens (UK food law)
- **Schema:** add `menu_items.allergens text[]` (one migration; nullable/empty default). Optional free-text `allergen_note` deferred.
- **Customer side:** display allergens on the item detail sheet and again in the cart/before "Place order". If an item has no allergen data, show a neutral "Ask staff about allergens" line so we never imply "allergen-free".
- **Editing** allergens is part of the full menu editor (Slice 2). For the pilot, Lloyd seeds allergen values with the menu.

### 3.6 Pilot onboarding (Lloyd-facing)
- A repeatable **seed script** (SQL or a small Node script) that creates: a `shops` row (slug, name, country UK, prep time), an owner auth user + `staff_users` mapping, and a starter menu (categories, items, options, allergens). Generalise the existing Corner Grind seed so a new pilot = fill in values + run.
- Not a UI. Documented in the repo so it's re-runnable per pilot.

## 4. Data model changes
- `alter table menu_items add column allergens text[] not null default '{}';` (single migration, committed to `supabase/migrations/`).
- No other schema changes. Confirm `shops_staff_update` / `items_staff_update` RLS actually permit the specific column updates during the plan (spot-check with an anon/staff test).

## 5. Security / conventions (unchanged from Phase 0)
- All writes via Supabase client under existing RLS; **no service-role key**, no new RPCs for toggles/settings.
- Staff can only read/update rows for their own `shop_id` (RLS enforced).
- Prices/allergens are display-only on the customer side; `create_order` remains the source of truth for validation.

## 6. Acceptance criteria
1. Logged-in shop owner can flip an item to **sold out**; a customer immediately cannot add it and `create_order` rejects it.
2. Owner can toggle **Accepting orders off**; customer PWA shows paused state and `create_order` rejects new orders. Toggling back on restores ordering.
3. Owner can change **prep time**; the customer status page ETA reflects the new value on the next order.
4. Owner can **download a QR PNG** and **print a poster** that resolves to `ordernook.uk/{slug}?src=qr`.
5. **Allergens** entered (seeded) on an item are visible on the customer item sheet and before checkout; items without data show the neutral "ask staff" line.
6. A second pilot shop can be created from the **seed script** and is fully independent (RLS isolation holds — staff of shop A cannot see/update shop B).

## 7. Testing
- Manual end-to-end on the deployed site (as in Phase 0) for each acceptance criterion.
- One automated **RLS cross-tenant test** (staff of shop A cannot read/update shop B's items/settings) — the spec's long-standing ask; cheap to add now with a second seeded shop.
- Verify sold-out / paused enforcement at the `create_order` layer, not just the UI.

## 8. Out of scope (later Phase 1 slices)
- Slice 2: full menu editor (CRUD items/categories/options, photos, allergen editing).
- Slice 3: per-shop branding + dynamic per-tenant manifest.
- Slice 4: self-serve registration + onboarding wizard.
- Also later: 7-day hours schedule, subdomain routing (stay path-based until a Pro plan enables wildcard `*.ordernook.uk`), multi-country config, payments (Phase 2 — reuse BookOnTheMap's Connect onboarding/subscription scaffolding but with **direct charges** per the SPEC, not destination charges).

## 9. Open questions
- None blocking. Poster design detail (copy/branding) can be decided during implementation; default to plain, on-brand (Latte Glass) styling.
