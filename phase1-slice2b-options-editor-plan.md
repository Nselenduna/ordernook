# Slice 2b — Option Groups & Options Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a shop owner add/edit/delete/reorder per-item option groups (Size/Milk/Extras) and their options with price deltas, from the dashboard menu editor.

**Architecture:** Dashboard-UI-only slice. The backend (tables `option_groups`/`options`, split staff RLS via the `menu_items.shop_id` join, `create_order` validation) already exists and is untouched. A new `OptionsSheet` bottom sheet, opened per item from the existing `menu-editor.tsx`, does inline CRUD via the anon Supabase client and calls `router.refresh()` after every mutation. The open sheet reads its item from the server-fetched props by id, so a refresh re-renders it with fresh data.

**Tech Stack:** Next.js App Router (client components), Supabase JS anon client, shadcn/ui (Sheet, Dialog, Input, Button), lucide-react icons, Tailwind, vitest (node env).

## Global Constraints

- **No migration, no new RPC.** Backend is complete; `create_order` is untouched.
- **No service-role key.** All writes use the anon client (`@/lib/supabase/client`) under existing `option_groups_staff_*` / `options_staff_*` RLS.
- **Tenant isolation is via the join** up to `menu_items.shop_id` — these tables have no `shop_id`. On insert supply only the parent FK (`item_id` for a group, `group_id` for an option).
- **All user-facing strings via `t()`** (`@/lib/i18n`) — add keys to `dict`, never hardcode.
- **Dashboard theme is Travo** — sheet/dialog content carries `className="theme-travo ..."`.
- **Money is integer minor units** everywhere; format/parse only at the UI edge.
- **Group `type` values are the DB enum literals** `"single"` / `"multi"`.
- **Reorder = up/down arrows swapping `sort_order`** with the neighbour (no drag-drop lib).
- **Save model = immediate per action** + `router.refresh()` (mirrors 2a category management). Text/price edits commit on blur; toggles/reorder on click.
- **Currency fixed to GBP** (UK-only pilot).
- After each code step run `npm run build` and `npm run lint` before committing; both must be clean.

---

### Task 1: Price-delta parser (`parsePriceDeltaToMinor`)

A pure helper to parse a user-entered option surcharge in pounds into integer minor units. Unlike an item price, a delta may be **zero or negative** (a discount), so it needs its own parser (the item form's regex rejects a leading `-`).

**Files:**
- Modify: `src/lib/money.ts` (append the function)
- Test: `tests/money.test.ts` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: `parsePriceDeltaToMinor(raw: string): number | null` — minor units, or `null` when `raw` doesn't match `-?digits(.dd)`.

- [ ] **Step 1: Write the failing test**

Create `tests/money.test.ts`. Import via a **relative path** — the vitest config has no `@/` alias and the existing `tests/rls.test.ts` never imports app code, so `@/lib/...` will not resolve here.

```ts
import { describe, expect, it } from "vitest"
import { parsePriceDeltaToMinor } from "../src/lib/money"

describe("parsePriceDeltaToMinor", () => {
  it("parses zero", () => expect(parsePriceDeltaToMinor("0")).toBe(0))
  it("parses pounds and pence", () => expect(parsePriceDeltaToMinor("0.60")).toBe(60))
  it("parses whole pounds", () => expect(parsePriceDeltaToMinor("1")).toBe(100))
  it("parses a single decimal place", () => expect(parsePriceDeltaToMinor("0.5")).toBe(50))
  it("parses a negative delta (discount)", () => expect(parsePriceDeltaToMinor("-0.10")).toBe(-10))
  it("trims surrounding whitespace", () => expect(parsePriceDeltaToMinor("  0.5 ")).toBe(50))
  it("rejects empty", () => expect(parsePriceDeltaToMinor("")).toBeNull())
  it("rejects non-numeric", () => expect(parsePriceDeltaToMinor("abc")).toBeNull())
  it("rejects more than two decimals", () => expect(parsePriceDeltaToMinor("1.234")).toBeNull())
  it("rejects scientific notation", () => expect(parsePriceDeltaToMinor("1e3")).toBeNull())
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- money`
Expected: FAIL — `parsePriceDeltaToMinor` is not exported from `../src/lib/money`.

- [ ] **Step 3: Implement the helper**

Append to `src/lib/money.ts`:

```ts
/**
 * Parse a user-entered price DELTA (an option surcharge) in major units into
 * integer minor units. Unlike an item price, a delta may be zero or negative
 * (a discount). Returns null for anything not matching -?digits(.dd) — mirrors
 * the strict parse in the item form (rejects "", "1e3", "1.234").
 */
export function parsePriceDeltaToMinor(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const minor = Math.round(Number.parseFloat(trimmed) * 100)
  if (Math.abs(minor) > 100_000_000) return null // > £1,000,000 guard
  return minor
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- money`
Expected: PASS (all 10 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts tests/money.test.ts
git commit -m "$(cat <<'EOF'
feat(money): parsePriceDeltaToMinor for option surcharges

Allows zero and negative deltas (discounts); rejects empty, >2dp, and
scientific notation like the item price parse.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Nest options in the menu fetch + editor types

Extend the server fetch so each item carries its `option_groups(options())`, and add the editor types in a **types-only** module (avoids a client-component import cycle between `menu-editor` and `options-sheet`).

**Files:**
- Create: `src/components/dashboard/menu-types.ts`
- Modify: `src/app/dashboard/menu/page.tsx:15-21` (the `.select(...)` string)
- Modify: `src/components/dashboard/menu-editor.tsx:26-38` (import types; `Category.menu_items` type)

**Interfaces:**
- Consumes: `EditorItem` from `@/components/dashboard/item-form-sheet`.
- Produces: `EditorOption`, `EditorGroup`, `EditorMenuItem` from `@/components/dashboard/menu-types`; the menu page now returns items whose shape includes `option_groups`.

- [ ] **Step 1: Create the types module**

Create `src/components/dashboard/menu-types.ts`:

```ts
import type { EditorItem } from "@/components/dashboard/item-form-sheet"

export type { EditorItem }

export type EditorOption = {
  id: string
  name: string
  price_delta_minor: number
  sort_order: number
}

export type EditorGroup = {
  id: string
  name: string
  type: "single" | "multi"
  required: boolean
  sort_order: number
  options: EditorOption[]
}

export type EditorMenuItem = EditorItem & { option_groups: EditorGroup[] }
```

- [ ] **Step 2: Extend the server fetch**

In `src/app/dashboard/menu/page.tsx`, replace the `.select(...)` argument (currently ending `...allergens)`) with the nested version:

```ts
    .select(
      "id, name, sort_order, menu_items(id, name, description, price_minor, currency, is_available, sort_order, category_id, allergens, option_groups(id, name, type, required, sort_order, options(id, name, price_delta_minor, sort_order)))"
    )
```

- [ ] **Step 3: Point the editor's item type at `EditorMenuItem`**

In `src/components/dashboard/menu-editor.tsx`:

Change the import line
```ts
import { ItemFormSheet, type EditorItem } from "@/components/dashboard/item-form-sheet"
```
to
```ts
import { ItemFormSheet } from "@/components/dashboard/item-form-sheet"
import type { EditorItem, EditorMenuItem } from "@/components/dashboard/menu-types"
```

Change the local `Category` type's items field:
```ts
type Category = {
  id: string
  name: string
  sort_order: number
  menu_items: EditorMenuItem[]
}
```
(Leave the rest of the file unchanged. `EditorItem` is still used by `editItem`/`setEditItem` and `ItemFormSheet`; `EditorMenuItem` extends it, so existing `openEdit(it)` / `setDeleteTarget(it)` calls still type-check.)

- [ ] **Step 4: Verify types compile against the real fetch shape**

Run: `npm run build`
Expected: PASS (no TS errors). This proves the nested `.select()` result matches `EditorMenuItem[]` end-to-end — including the `type` enum resolving to `"single" | "multi"`.
Then run: `npm run lint` — Expected: clean.

> If the build reports the group `type` as widened to `string`, cast at the prop boundary in `page.tsx`: `categories={(categories ?? []) as unknown as Category[]}` is **not** wanted — instead confirm `database.types.ts` types `option_group_type` as the literal union (it does); a widening error means the select string has a typo. Fix the select, don't cast.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/menu-types.ts src/app/dashboard/menu/page.tsx src/components/dashboard/menu-editor.tsx
git commit -m "$(cat <<'EOF'
feat(menu): nest option_groups(options) in editor fetch + types

Adds EditorGroup/EditorOption/EditorMenuItem in a types-only module and
extends the dashboard menu fetch to carry each item's option groups.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `OptionsSheet` component + per-item Options button

The core of the slice: a bottom sheet per item that lists its option groups and options with full inline CRUD and reorder. Also extracts the shared `IconBtn` into its own file so the sheet and the menu editor reuse it (no duplication, no cycle).

**Files:**
- Create: `src/components/dashboard/icon-btn.tsx`
- Create: `src/components/dashboard/options-sheet.tsx`
- Modify: `src/components/dashboard/menu-editor.tsx` (use shared `IconBtn`; add Options button + sheet)
- Modify: `src/lib/i18n.ts` (add keys before the closing `} as const`)

**Interfaces:**
- Consumes: `EditorGroup`, `EditorMenuItem`, `EditorOption` from `menu-types`; `parsePriceDeltaToMinor` from `@/lib/money`; `IconBtn` from `./icon-btn`.
- Produces: `OptionsSheet({ item: EditorMenuItem; currency: string; open: boolean; onOpenChange: (o: boolean) => void })`.

- [ ] **Step 1: Add i18n keys**

In `src/lib/i18n.ts`, add these entries just before the closing `} as const` (after `"editor.confirmDelete": "Delete",`):

```ts
  "editor.options": "Options",
  "editor.optionsTitle": "Options — {name}",
  "editor.optionsHint": "Add choices like size, milk or extras. Changes save as you go.",
  "editor.noGroups": "No option groups yet. Add one for size, milk or extras.",
  "editor.addGroup": "Add option group",
  "editor.newGroupName": "New group",
  "editor.groupName": "Group name",
  "editor.typeSingle": "Choose one",
  "editor.typeMulti": "Choose any",
  "editor.groupRequired": "Required",
  "editor.groupOptional": "Optional",
  "editor.deleteGroup": "Delete option group",
  "editor.deleteGroupTitle": "Delete this option group?",
  "editor.deleteGroupBody": "\"{name}\" and its options will be removed. Past orders keep their record.",
  "editor.addOption": "Add option",
  "editor.newOptionName": "New option",
  "editor.optionName": "Option name",
  "editor.optionDelta": "Price change (£)",
  "editor.deleteOption": "Delete option",
```

(Task 4 adds one more key, `editor.requiredNoOptions`.)

- [ ] **Step 2: Extract the shared `IconBtn`**

Create `src/components/dashboard/icon-btn.tsx` (moved verbatim from `menu-editor.tsx`, now exported):

```tsx
import type { ReactNode } from "react"

export function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30"
    >
      {children}
    </button>
  )
}
```

In `menu-editor.tsx`: delete the local `IconBtn` function (and its now-unused `import type { ReactNode }`) and add `import { IconBtn } from "@/components/dashboard/icon-btn"`.

- [ ] **Step 3: Write the `OptionsSheet` component**

Create `src/components/dashboard/options-sheet.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { IconBtn } from "@/components/dashboard/icon-btn"
import type {
  EditorGroup,
  EditorMenuItem,
  EditorOption,
} from "@/components/dashboard/menu-types"
import { t } from "@/lib/i18n"
import { parsePriceDeltaToMinor } from "@/lib/money"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export function OptionsSheet({
  item,
  currency,
  open,
  onOpenChange,
}: {
  item: EditorMenuItem
  currency: string
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<EditorGroup | null>(null)

  const groups = [...item.option_groups].sort((a, b) => a.sort_order - b.sort_order)
  const refresh = () => router.refresh()
  const fail = () => toast.error(t("editor.saveFailed"))

  // ---- group ops
  const addGroup = async () => {
    const nextSort = Math.max(0, ...groups.map((g) => g.sort_order)) + 1
    const { error } = await supabase.from("option_groups").insert({
      item_id: item.id,
      name: t("editor.newGroupName"),
      type: "single",
      required: false,
      sort_order: nextSort,
    })
    if (error) return fail()
    refresh()
  }
  const renameGroup = async (g: EditorGroup, value: string) => {
    const name = value.trim()
    if (!name || name === g.name) return
    const { error } = await supabase.from("option_groups").update({ name }).eq("id", g.id)
    if (error) return fail()
    refresh()
  }
  const setGroupType = async (g: EditorGroup, type: "single" | "multi") => {
    if (type === g.type) return
    const { error } = await supabase.from("option_groups").update({ type }).eq("id", g.id)
    if (error) return fail()
    refresh()
  }
  const setGroupRequired = async (g: EditorGroup, required: boolean) => {
    const { error } = await supabase.from("option_groups").update({ required }).eq("id", g.id)
    if (error) return fail()
    refresh()
  }
  const swapGroup = async (a: EditorGroup, b: EditorGroup) => {
    const r1 = await supabase.from("option_groups").update({ sort_order: b.sort_order }).eq("id", a.id)
    const r2 = await supabase.from("option_groups").update({ sort_order: a.sort_order }).eq("id", b.id)
    if (r1.error || r2.error) fail()
    refresh()
  }
  const confirmDeleteGroup = async () => {
    if (!deleteGroupTarget) return
    const { error } = await supabase.from("option_groups").delete().eq("id", deleteGroupTarget.id)
    setDeleteGroupTarget(null)
    if (error) return fail()
    refresh()
  }

  // ---- option ops
  const addOption = async (g: EditorGroup) => {
    const nextSort = Math.max(0, ...g.options.map((o) => o.sort_order)) + 1
    const { error } = await supabase.from("options").insert({
      group_id: g.id,
      name: t("editor.newOptionName"),
      price_delta_minor: 0,
      sort_order: nextSort,
    })
    if (error) return fail()
    refresh()
  }
  const renameOption = async (o: EditorOption, value: string) => {
    const name = value.trim()
    if (!name || name === o.name) return
    const { error } = await supabase.from("options").update({ name }).eq("id", o.id)
    if (error) return fail()
    refresh()
  }
  const setOptionDelta = async (o: EditorOption, value: string) => {
    const minor = parsePriceDeltaToMinor(value)
    if (minor === null) return toast.error(t("editor.priceInvalid"))
    if (minor === o.price_delta_minor) return
    const { error } = await supabase.from("options").update({ price_delta_minor: minor }).eq("id", o.id)
    if (error) return fail()
    refresh()
  }
  const deleteOption = async (o: EditorOption) => {
    const { error } = await supabase.from("options").delete().eq("id", o.id)
    if (error) return fail()
    refresh()
  }
  const swapOption = async (a: EditorOption, b: EditorOption) => {
    const r1 = await supabase.from("options").update({ sort_order: b.sort_order }).eq("id", a.id)
    const r2 = await supabase.from("options").update({ sort_order: a.sort_order }).eq("id", b.id)
    if (r1.error || r2.error) fail()
    refresh()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="theme-travo max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl bg-background text-foreground"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="font-heading text-2xl">
            {t("editor.optionsTitle", { name: item.name })}
          </SheetTitle>
          <SheetDescription>{t("editor.optionsHint")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          {groups.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">{t("editor.noGroups")}</p>
          )}

          {groups.map((group, gi) => {
            const options = [...group.options].sort((a, b) => a.sort_order - b.sort_order)
            return (
              <section key={group.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center gap-1">
                  <input
                    defaultValue={group.name}
                    onBlur={(e) => renameGroup(group, e.target.value)}
                    aria-label={t("editor.groupName")}
                    className="min-w-0 flex-1 rounded-lg bg-transparent px-1 font-heading text-base font-semibold outline-none focus:bg-secondary"
                  />
                  <IconBtn label={t("editor.moveUp")} disabled={gi === 0} onClick={() => swapGroup(group, groups[gi - 1])}>
                    <ChevronUpIcon className="size-4" />
                  </IconBtn>
                  <IconBtn label={t("editor.moveDown")} disabled={gi === groups.length - 1} onClick={() => swapGroup(group, groups[gi + 1])}>
                    <ChevronDownIcon className="size-4" />
                  </IconBtn>
                  <IconBtn label={t("editor.deleteGroup")} onClick={() => setDeleteGroupTarget(group)}>
                    <Trash2Icon className="size-4" />
                  </IconBtn>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex rounded-full border border-border p-0.5">
                    {(["single", "multi"] as const).map((ty) => (
                      <button
                        key={ty}
                        type="button"
                        onClick={() => setGroupType(group, ty)}
                        className={cn(
                          "h-7 rounded-full px-3 text-xs font-medium",
                          group.type === ty ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                        )}
                      >
                        {ty === "single" ? t("editor.typeSingle") : t("editor.typeMulti")}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={group.required}
                    onClick={() => setGroupRequired(group, !group.required)}
                    className={cn(
                      "h-7 rounded-full px-3 text-xs font-medium",
                      group.required ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
                    )}
                  >
                    {group.required ? t("editor.groupRequired") : t("editor.groupOptional")}
                  </button>
                </div>

                <ul className="flex flex-col gap-1.5">
                  {options.map((o, oi) => (
                    <li key={o.id} className="flex items-center gap-1 rounded-xl border border-border bg-background p-2">
                      <input
                        defaultValue={o.name}
                        onBlur={(e) => renameOption(o, e.target.value)}
                        aria-label={t("editor.optionName")}
                        className="min-w-0 flex-1 rounded-lg bg-transparent px-1 outline-none focus:bg-secondary"
                      />
                      <span className="text-sm text-muted-foreground">£</span>
                      <Input
                        defaultValue={(o.price_delta_minor / 100).toFixed(2)}
                        onBlur={(e) => setOptionDelta(o, e.target.value)}
                        inputMode="decimal"
                        aria-label={t("editor.optionDelta")}
                        className="h-9 w-20 rounded-lg tabular-nums"
                      />
                      <IconBtn label={t("editor.moveUp")} disabled={oi === 0} onClick={() => swapOption(o, options[oi - 1])}>
                        <ChevronUpIcon className="size-4" />
                      </IconBtn>
                      <IconBtn label={t("editor.moveDown")} disabled={oi === options.length - 1} onClick={() => swapOption(o, options[oi + 1])}>
                        <ChevronDownIcon className="size-4" />
                      </IconBtn>
                      <IconBtn label={t("editor.deleteOption")} onClick={() => deleteOption(o)}>
                        <Trash2Icon className="size-4" />
                      </IconBtn>
                    </li>
                  ))}
                </ul>

                <Button type="button" variant="ghost" className="h-10 w-fit rounded-full px-3 text-sm" onClick={() => addOption(group)}>
                  <PlusIcon className="size-4" /> {t("editor.addOption")}
                </Button>
              </section>
            )
          })}

          <Button type="button" className="h-11 w-fit rounded-full px-5" onClick={addGroup}>
            <PlusIcon className="size-4" /> {t("editor.addGroup")}
          </Button>
        </div>

        <Dialog open={deleteGroupTarget !== null} onOpenChange={(o) => !o && setDeleteGroupTarget(null)}>
          <DialogContent className="theme-travo">
            <DialogHeader>
              <DialogTitle>{t("editor.deleteGroupTitle")}</DialogTitle>
              <DialogDescription>
                {t("editor.deleteGroupBody", { name: deleteGroupTarget?.name ?? "" })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteGroupTarget(null)}>
                {t("editor.cancel")}
              </Button>
              <Button className="bg-destructive text-white" onClick={confirmDeleteGroup}>
                {t("editor.confirmDelete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  )
}
```

> `currency` is accepted for signature stability and future formatted previews; it is not read yet. If `npm run lint` flags it as unused, prefix the destructured name with `_` (`currency: _currency`) rather than removing it from the props type.

- [ ] **Step 4: Wire the Options button into `menu-editor.tsx`**

In `src/components/dashboard/menu-editor.tsx`:

Add to the lucide-react import list: `SlidersHorizontalIcon`. Add `import { OptionsSheet } from "@/components/dashboard/options-sheet"`.

Replace the `deleteTarget` state region by adding an id-based selection for the options sheet (id, not the object, so a `router.refresh()` re-reads the open sheet's data fresh from props):

```ts
  const [optionsItemId, setOptionsItemId] = useState<string | null>(null)
```

After the existing `cats` line, derive the live item:

```ts
  const optionsItem = optionsItemId
    ? cats.flatMap((c) => c.menu_items).find((i) => i.id === optionsItemId) ?? null
    : null
```

In the item row, add an Options button immediately before the edit (`PencilIcon`) `IconBtn`:

```tsx
                  <IconBtn label={t("editor.options")} onClick={() => setOptionsItemId(it.id)}>
                    <SlidersHorizontalIcon className="size-4" />
                  </IconBtn>
```

Render the sheet just before the delete `Dialog` at the bottom of the returned JSX:

```tsx
      {optionsItem && (
        <OptionsSheet
          key={optionsItem.id}
          item={optionsItem}
          currency={currency}
          open={optionsItem !== null}
          onOpenChange={(o) => !o && setOptionsItemId(null)}
        />
      )}
```

- [ ] **Step 5: Build, lint, and browser-verify**

Run: `npm run build` then `npm run lint` — Expected: both clean.

Then start the dev server (`npm run dev`) and verify as `owner@cornergrind.test` (dashboard login; current password in local `.env.test`):
- AC 1: On an item, add a "Size" group → set **Choose one** + **Required** → add "Small" (£0.00) and "Large" (£0.60). Open `/corner-grind` as a customer → the item sheet shows Size as **radios**; selecting Large adds 60p.
- AC 2: Add an "Extras" group → **Choose any** + **Optional** → add two options with deltas. Customer sheet shows **checkboxes**; selecting both stacks the deltas.
- AC 3: Toggle the group **Choose one ↔ Choose any** → customer control flips radio↔checkbox; toggle **Required ↔ Optional** → the customer badge and add-to-order enforcement flip.
- AC 4: Reorder groups and options with the up/down arrows → order matches on the customer page.
- AC 5: Delete an option (immediate) → gone. Delete a group (confirm dialog) → group and its options gone. A past order that used them still displays them on its status page (snapshot intact).

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/icon-btn.tsx src/components/dashboard/options-sheet.tsx src/components/dashboard/menu-editor.tsx src/lib/i18n.ts
git commit -m "$(cat <<'EOF'
feat(editor): per-item option groups & options editor

OptionsSheet with inline CRUD + up/down reorder for option groups
(single/multi, required) and their options (£ delta). Opens per item from
the menu editor; immediate saves via anon client under staff RLS. Extracts
shared IconBtn.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Required-group-with-no-options warning

A `required` group with zero options soft-locks the item on the customer side (the `requiredMet` check in `item-sheet.tsx` can never pass). Surface an inline warning in the editor. Soft nudge — no hard block.

**Files:**
- Modify: `src/components/dashboard/options-sheet.tsx` (one conditional line)
- Modify: `src/lib/i18n.ts` (one key)

**Interfaces:**
- Consumes: `EditorGroup` (already in scope).
- Produces: nothing new.

- [ ] **Step 1: Add the i18n key**

In `src/lib/i18n.ts`, add before `} as const` (with the other `editor.*` keys):

```ts
  "editor.requiredNoOptions": "Add at least one option, or customers can't order this item.",
```

- [ ] **Step 2: Render the warning**

In `options-sheet.tsx`, inside the group `<section>`, immediately after the closing `</div>` of the type/required toggle row and before the `<ul>` of options, add:

```tsx
                {group.required && options.length === 0 && (
                  <p className="text-xs font-medium text-destructive">
                    {t("editor.requiredNoOptions")}
                  </p>
                )}
```

- [ ] **Step 3: Build, lint, browser-verify (AC 6)**

Run: `npm run build` then `npm run lint` — Expected: clean.
In the browser: create a group, set it **Required**, add no options → the red warning shows. Add an option → the warning disappears.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/options-sheet.tsx src/lib/i18n.ts
git commit -m "$(cat <<'EOF'
feat(editor): warn on required option group with no options

A required group with zero options soft-locks the item for customers;
show an inline warning until an option is added.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: RLS cross-tenant tests for option groups & options

Prove the join-based staff RLS blocks a shop from writing another shop's option groups/options, and that its own writes still succeed (policy isn't deny-all). Complements 2a's `menu_items` cross-tenant tests.

**Files:**
- Modify: `tests/rls.test.ts` (add `it` cases inside the existing `describe`)

**Interfaces:**
- Consumes: the existing `a`, `b`, `aShopId`, `bShopId` from `beforeAll`.
- Produces: nothing.

**Precondition:** shop A (`corner-grind`) has at least one option group from the seed (the Latte's Size/Milk/Extras) — the "own group" lookups rely on it. Shop B (`pilot-test`) needs at least one menu item (it does).

- [ ] **Step 1: Add the failing/again-passing tests**

Append these inside the `describe("RLS cross-tenant isolation", ...)` block in `tests/rls.test.ts`, after the last existing `it(...)`:

```ts
  it("A CANNOT create an option group on B's item", async () => {
    const { data: item } = await b
      .from("menu_items")
      .select("id")
      .eq("shop_id", bShopId)
      .limit(1)
      .single()
    const { error } = await a.from("option_groups").insert({
      item_id: item!.id,
      name: "rls-hack",
      type: "single",
      required: false,
      sort_order: 999,
    })
    expect(error).not.toBeNull() // RLS with-check rejects via item→shop join
  })

  it("B CANNOT add an option to A's group", async () => {
    const { data: group } = await a
      .from("option_groups")
      .select("id, menu_items!inner(shop_id)")
      .eq("menu_items.shop_id", aShopId)
      .limit(1)
      .single()
    const { error } = await b.from("options").insert({
      group_id: (group as { id: string }).id,
      name: "rls-hack",
      price_delta_minor: 1,
      sort_order: 999,
    })
    expect(error).not.toBeNull() // RLS with-check rejects via group→item→shop join
  })

  it("B CANNOT delete A's option group", async () => {
    const { data: group } = await a
      .from("option_groups")
      .select("id, menu_items!inner(shop_id)")
      .eq("menu_items.shop_id", aShopId)
      .limit(1)
      .single()
    const gid = (group as { id: string }).id
    await b.from("option_groups").delete().eq("id", gid)
    const { data: still } = await a
      .from("option_groups")
      .select("id")
      .eq("id", gid)
      .maybeSingle()
    expect(still).not.toBeNull() // still there → delete was blocked
  })

  it("A CAN add then remove an option on its own group (policy isn't deny-all)", async () => {
    const { data: group } = await a
      .from("option_groups")
      .select("id, menu_items!inner(shop_id)")
      .eq("menu_items.shop_id", aShopId)
      .limit(1)
      .single()
    const gid = (group as { id: string }).id
    const { data: inserted, error } = await a
      .from("options")
      .insert({ group_id: gid, name: "rls-selftest", price_delta_minor: 0, sort_order: 9999 })
      .select("id")
      .single()
    expect(error).toBeNull()
    if (inserted) await a.from("options").delete().eq("id", (inserted as { id: string }).id) // cleanup
  })
```

- [ ] **Step 2: Run the full suite**

Run: `npm run test`
Expected: PASS — all existing cases plus the four new ones. (The three isolation cases pass because the policies already exist; the positive-control insert proves the staff path works and cleans up after itself.)

- [ ] **Step 3: Commit**

```bash
git add tests/rls.test.ts
git commit -m "$(cat <<'EOF'
test(rls): cross-tenant option group/option writes are blocked

Asserts the join-based staff RLS on option_groups/options: A can't create
a group on B's item, B can't add/delete under A's group, and A's own option
write succeeds (not deny-all).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Scope: entry-point Options button (Task 3 Step 4); group add/rename/type/required/delete/reorder (Task 3); option add/edit-name/edit-£/delete/reorder (Task 3); £ delta parse allowing 0/negative (Task 1); immediate save + `router.refresh()` (Task 3 handlers); soft warning (Task 4). ✓
- Files: `options-sheet.tsx` (T3), `menu-editor.tsx` (T2+T3), `menu/page.tsx` (T2), `i18n.ts` (T3+T4). Plan adds `menu-types.ts` and `icon-btn.tsx` — noted deviations that avoid a client import cycle and `IconBtn` duplication. ✓
- Security: anon client + staff RLS, parent-FK-only inserts, `create_order` untouched (Global Constraints; verified by Task 5). ✓
- Acceptance criteria 1–7: AC 1–5 (T3 Step 5), AC 6 (T4 Step 3), AC 7 (T5). ✓
- Testing: manual browser (T3/T4) + RLS extension (T5); unit test for the one pure helper (T1). ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. The one non-obvious runtime note (unused `currency`, enum widening) is given explicit handling, not left vague. ✓

**Type consistency:** `EditorGroup`/`EditorOption`/`EditorMenuItem` defined once in `menu-types.ts` (T2) and imported everywhere; `parsePriceDeltaToMinor` signature matches T1; `type: "single" | "multi"` literals consistent across fetch, types, handlers, and toggle. `OptionsSheet` props match its call site in `menu-editor.tsx`. ✓
