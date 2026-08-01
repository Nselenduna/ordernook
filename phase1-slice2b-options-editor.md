# OrderNook — Phase 1, Slice 2b: Option Groups & Options Editor — design spec

**Date:** 1 August 2026 · **Status:** Approved, ready for implementation plan
**Depends on:** Phase 0, Slice 1 (Go-Live Kit), Slice 2a (Menu Editor — items & categories). **Strategy:** lean pilot-first.

> Slice 2 (full menu editor) is decomposed into: 2a items+categories (shipped), **2b option groups/options (this)**, 2c item photos. Each ships on its own.

## 1. Goal
Let a shop owner build and maintain per-item customisations (e.g. Size, Milk, Extras) from the dashboard — add/edit/delete/reorder option groups and their options, set the price delta per option — removing the last part of a menu that Lloyd still seeds by hand.

## 2. Key context (why it's small)
The backend already supports this fully — **no migration, no new RPC.**
- Tables `option_groups` (`item_id`, `name`, `type` enum `single|multi`, `required`, `sort_order`) and `options` (`group_id`, `name`, `price_delta_minor`, `sort_order`) exist from Phase 0, with `on delete cascade` group→options and item→groups.
- Split staff RLS (`option_groups_staff_insert/update/delete`, `options_staff_insert/update/delete`) from advisor_hardening scopes every write via the `is_staff_of(menu_items.shop_id)` join. Public read policies already expose them to customers.
- Indexes `option_groups_item_idx`, `options_group_idx` exist.
- `create_order` already validates option selections server-side (required-group satisfied, options belong to the item, single-group at most one) and recomputes price from `price_delta_minor`. It is **untouched** by this slice.
- Customer `src/components/shop/item-sheet.tsx` already renders groups as radios (`single`) / checkboxes (`multi`), honours `required`, and applies `price_delta_minor`. `order_items` store snapshots, so editing/deleting an option never corrupts past orders.

So this slice is **dashboard UI only.**

## 3. Scope
Add per-item option management, opened from each item row in the existing `/dashboard/menu` editor.

**Entry point:** a "sliders" icon button on each item row in `menu-editor.tsx` (between the availability toggle and the edit pencil) opens a new `OptionsSheet` bottom sheet (Travo theme) scoped to that item.

**Groups (per item):** add / rename / delete (confirm; cascades to its options) / reorder. Fields: name, **type** (single/multi toggle), **required** (toggle).
**Options (per group):** add / edit / delete / reorder. Fields: name, **price delta in £** (stored `price_delta_minor`; may be 0 or negative).

**Decided UX:**
- **Save model: immediate per action** (mirrors 2a category management), not a submit-the-whole-form model. Name/price edits commit on blur; type/required toggles and reorder commit on click; after any mutation `router.refresh()` re-reads the server fetch.
- **Reorder** via up/down arrows swapping `sort_order` with the neighbour (no drag-drop lib), same helper shape as 2a's `swapCat`/`swapItem`.
- **Delete group** = confirm → hard delete (DB cascades group→options; snapshots protect order history). **Delete option** = hard delete (with a light confirm or inline, matching 2a item delete rhythm).
- **Price delta** entered in £ with the same parse/format helpers as 2a item price (reject scientific-notation / malformed input); stored as integer minor units; negatives allowed (e.g. "Decaf −£0.10" style discounts are possible though rarely used).
- **Guard (soft):** a `required` group with **zero options** soft-locks the item on the customer side (the customer can never satisfy the requirement, so "Add to order" stays disabled). The sheet shows an inline warning on any required group with no options. Not a hard block.
- **Currency** fixed to GBP (UK-only pilot), consistent with 2a.

## 4. Data model
No migration. `OptionsSheet` reads the item's `option_groups(*, options(*))` (nested), sorted by `sort_order`. Writes via the anon client under existing staff RLS.

## 5. Files
- **New** `src/components/dashboard/options-sheet.tsx` — the groups + options editor sheet (all inline CRUD + reorder for one item).
- **Edit** `src/components/dashboard/menu-editor.tsx` — add the per-item Options icon button and sheet wiring; extend the editor item type to carry `option_groups` (with nested `options`).
- **Edit** `src/app/dashboard/menu/page.tsx` — nest `option_groups(*, options(*))` in the existing server fetch (keep ordering).
- **Edit** `src/lib/i18n.ts` — new `t()` strings (group/option labels, type single/multi, required, add/delete/confirm, required-empty warning).

## 6. Security / conventions
- No service-role key. All writes via the anon client under `option_groups_staff_*` / `options_staff_*` RLS.
- These tables carry **no `shop_id`** — tenant isolation is enforced by RLS's join up to `menu_items.shop_id` via `is_staff_of`. On insert the client supplies the parent FK only (`item_id` for a group, `group_id` for an option); RLS rejects any FK that doesn't resolve to a shop the caller staffs.
- `create_order` untouched. All strings via `t()`. Dashboard theme Travo. Money as integer minor units; `type` values are the DB enum literals `single` / `multi`.

## 7. Acceptance criteria
1. Owner opens an item → adds a "Size" group (single, required) → adds Small (+£0) and Large (+£0.60) → both appear on the customer item sheet as radios with the deltas; selecting Large adds 60p to the unit total.
2. Owner adds an "Extras" group (multi, optional) with options → renders as checkboxes on the customer sheet; selecting two stacks both deltas.
3. Toggling a group single↔multi flips the customer control (radio↔checkbox); toggling required flips the badge and the add-to-order enforcement.
4. Owner reorders groups and options (up/down) → order reflected on the customer page.
5. Owner deletes an option → gone; owner deletes a group (confirm) → group and its options gone; a past order that used them still displays them (snapshot intact).
6. A required group with no options shows the inline warning in the editor.
7. Cross-tenant: shop A's staff cannot insert / update / delete an option group or option under shop B's item (RLS blocks via the join).

## 8. Testing
- Manual browser for criteria 1–6 (edit in dashboard as `owner@cornergrind.test`, verify on the customer `/[slug]` page).
- Extend `tests/rls.test.ts`: staff A cannot INSERT an `option_groups` row for shop B's item, nor INSERT/DELETE an `options` row under shop B's group (asserts the join-based policy, complementing 2a's menu_items cross-tenant tests).

## 9. Out of scope
Item photos (2c), drag-drop reorder, per-option availability/sold-out, option-level allergens, min/max selection counts on multi groups, bulk import, multi-currency.

## 10. Open questions
None.
