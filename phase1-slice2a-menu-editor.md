# OrderNook — Phase 1, Slice 2a: Menu Editor (Items & Categories) — design spec

**Date:** 26 July 2026 · **Status:** Approved, ready for implementation plan
**Depends on:** Phase 0, Slice 1 (Go-Live Kit), Slice 3 (Branding). **Strategy:** lean pilot-first.

> Slice 2 (full menu editor) is decomposed into: **2a items+categories (this)**, 2b option groups/options, 2c item photos. Each ships on its own.

## 1. Goal
Let a shop owner build and maintain their own menu from the dashboard — add/edit/delete/reorder items and categories, set price + allergens — removing the last thing Lloyd does by hand per pilot (seeding the menu).

## 2. Key context (why it's small)
The backend already supports this: `menu_categories` / `menu_items` have staff CRUD RLS (insert/update/delete, `is_staff_of`-scoped, from Phase 0 + advisor_hardening). `menu_items.allergens` (Slice 1) and `menu_items.photo_url` already exist. `order_items` store snapshots, so editing/deleting a menu item never corrupts past orders. So this slice is **dashboard UI only — no migration, no new RPCs.**

## 3. Scope
Expand the existing `/dashboard/menu` (currently read-only + sold-out toggle) into a full editor.

**Items:** add / edit / delete / reorder. Fields: name, description, **price in £** (stored `price_minor`), category, **allergens (14 UK-regulated checkboxes)**, sold-out (existing toggle, kept).
**Categories:** add / rename / delete (blocked while non-empty) / reorder.

**Decided UX:**
- Add/edit item via a bottom **Sheet form**.
- **Reorder** via up/down arrows swapping `sort_order` with the neighbour (no drag-drop lib).
- **Delete item** = confirm → hard delete (snapshots protect history). **Delete category** = only when empty (DB cascades category→items, so guard it).
- After any mutation, `router.refresh()` re-reads the server fetch (simple, robust sync); the sold-out toggle stays optimistic.
- **Currency** fixed to GBP (UK-only pilot; per-item currency not user-editable).
- **Allergens** stored as lowercase canonical keys in `allergens text[]` (e.g. `["gluten","milk"]`), consistent with Slice 1's customer badge display.

## 4. Data model
No migration. Editor reads `menu_categories` + nested `menu_items` (all editable fields). Writes via the anon client under existing staff RLS.

## 5. Files
- New `src/lib/allergens.ts` — the 14 UK allergens `[{key,label}]`.
- New `src/components/dashboard/item-form-sheet.tsx` — add/edit item form.
- Rework `src/components/dashboard/menu-availability.tsx` → `menu-editor.tsx` (full list + controls; keeps sold-out toggle).
- Edit `src/app/dashboard/menu/page.tsx` (fuller fetch; pass `shopId` + currency), `src/lib/i18n.ts`.

## 6. Security / conventions
- No service-role key; all writes via anon client under `items_staff_*` / `categories_staff_*` RLS. Client supplies `shop_id` on insert (RLS `with check is_staff_of(shop_id)` enforces isolation).
- `create_order` untouched. All strings via `t()`. Dashboard theme Travo. Money integer minor units.

## 7. Acceptance criteria
1. Owner adds a category, then adds an item to it (name, price £, description, allergens) → appears on the customer `/[slug]` menu with correct price + allergen badges.
2. Owner edits an item's name/price/allergens → reflected on the customer page.
3. Owner reorders items and categories (up/down) → order reflected for customers.
4. Owner deletes an item (confirm) → gone from the menu; a past order that included it still shows it (snapshot intact).
5. Deleting a category is blocked while it has items; allowed once empty.
6. Sold-out toggle still works (regression).
7. Cross-tenant: a shop's staff cannot insert into or delete another shop's menu (RLS).

## 8. Testing
- Manual browser for criteria 1–6.
- Extend `tests/rls.test.ts`: staff A cannot INSERT a `menu_items` row for shop B, nor DELETE shop B's item (existing test already covers cross-tenant UPDATE).

## 9. Out of scope
Option groups/options (2b), item photos (2c), drag-drop reorder, bulk/CSV import, multi-currency.

## 10. Open questions
None.
