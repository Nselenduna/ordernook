# Phase 1 Slice 2a — Menu Editor (Items & Categories) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the read-only `/dashboard/menu` into a full items+categories editor so a shop maintains its own menu (add/edit/delete/reorder items & categories, price in £, 14-allergen checkboxes).

**Architecture:** Dashboard UI only — no migration, no new RPCs. All CRUD goes through the anon browser client under the existing Phase 0 staff RLS (`items_staff_*`, `categories_staff_*`, `is_staff_of`-scoped). After each mutation the client calls `router.refresh()` to re-read the server component's fetch (simple, robust sync). `order_items` snapshots keep past orders intact through edits/deletes.

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr`/anon client, existing shadcn-style UI kit (Sheet, Dialog, Input, Textarea, Label, Button), lucide-react icons, Zustand not needed here.

## Global Constraints
- **No service-role key.** CRUD via the anon client under staff RLS. On INSERT the client supplies `shop_id` (RLS `with check is_staff_of(shop_id)` enforces isolation).
- **No migration, no new RPCs** (schema + RLS already exist; `allergens` from Slice 1).
- **Money = integer minor units.** UI enters price in **£** (e.g. `3.50`) → `price_minor` (350), validated finite & ≥ 0. **Currency fixed to GBP** (UK-only; not user-editable).
- **Allergens** stored as lowercase canonical keys from `UK_ALLERGENS` (Task 1), consistent with Slice 1's customer badge display.
- All user-facing strings via `t()` in `src/lib/i18n.ts`. Dashboard theme **Travo** (`theme-travo`).
- `create_order` untouched. After any mutation, `router.refresh()`.
- Do NOT edit existing `supabase/migrations/` files.

---

### Task 1: Allergens constant + i18n keys

**Files:**
- Create: `src/lib/allergens.ts`
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Produces: `UK_ALLERGENS: { key: string; label: string }[]`. Consumed by Task 2 (item form) — and available to customer display later.

- [ ] **Step 1: Create the allergens constant**

Create `src/lib/allergens.ts`:

```ts
// The 14 UK-regulated food allergens (Food Information Regulations 2014).
// `key` is the canonical lowercase value stored in menu_items.allergens[];
// `label` is shown to shop owners. Customer badges capitalise the key (Slice 1).
export const UK_ALLERGENS: { key: string; label: string }[] = [
  { key: "celery", label: "Celery" },
  { key: "gluten", label: "Cereals containing gluten" },
  { key: "crustaceans", label: "Crustaceans" },
  { key: "eggs", label: "Eggs" },
  { key: "fish", label: "Fish" },
  { key: "lupin", label: "Lupin" },
  { key: "milk", label: "Milk" },
  { key: "molluscs", label: "Molluscs" },
  { key: "mustard", label: "Mustard" },
  { key: "nuts", label: "Tree nuts" },
  { key: "peanuts", label: "Peanuts" },
  { key: "sesame", label: "Sesame" },
  { key: "soya", label: "Soya" },
  { key: "sulphites", label: "Sulphur dioxide / sulphites" },
]
```

- [ ] **Step 2: Add i18n keys**

In `src/lib/i18n.ts` add:

```ts
  "editor.addCategory": "Add category",
  "editor.newCategory": "New category name",
  "editor.noCategories": "No categories yet. Add one to start your menu.",
  "editor.categoryName": "Category name",
  "editor.categoryNotEmpty": "Empty the category before deleting it.",
  "editor.deleteCategory": "Delete category",
  "editor.addItem": "Add item",
  "editor.editItem": "Edit item",
  "editor.deleteItem": "Delete item",
  "editor.itemFormHint": "Set the name, price, category and allergens.",
  "editor.name": "Name",
  "editor.description": "Description",
  "editor.priceLabel": "Price (£)",
  "editor.category": "Category",
  "editor.allergens": "Allergens",
  "editor.save": "Save",
  "editor.saving": "Saving…",
  "editor.saved": "Saved.",
  "editor.saveFailed": "Couldn't save — try again.",
  "editor.nameRequired": "Please enter a name.",
  "editor.priceInvalid": "Enter a valid price (e.g. 3.50).",
  "editor.moveUp": "Move up",
  "editor.moveDown": "Move down",
  "editor.deleteItemTitle": "Delete this item?",
  "editor.deleteItemBody": "\"{name}\" will be removed from your menu. Past orders keep their record.",
  "editor.cancel": "Cancel",
  "editor.confirmDelete": "Delete",
```

- [ ] **Step 3: Build**

Run: `npm run build` — expected clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/allergens.ts src/lib/i18n.ts
git commit -m "feat(editor): UK allergens constant + menu-editor i18n"
```

---

### Task 2: Item form sheet (add/edit)

**Files:**
- Create: `src/components/dashboard/item-form-sheet.tsx`

**Interfaces:**
- Consumes: `UK_ALLERGENS` (Task 1); anon client; Sheet/Input/Textarea/Label/Button UI.
- Produces: `ItemFormSheet` + exported `EditorItem` type. `EditorItem = { id, name, description: string|null, price_minor, currency, is_available, sort_order, category_id, allergens: string[] }`. Consumed by Task 3.

- [ ] **Step 1: Confirm the UI imports exist**

Run: `ls src/components/ui/{sheet,textarea,input,label,button}.tsx`
Expected: all present (they are). If `textarea.tsx` is missing, stop and report.

- [ ] **Step 2: Write the form sheet**

Create `src/components/dashboard/item-form-sheet.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { UK_ALLERGENS } from "@/lib/allergens"

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
}

export function ItemFormSheet({
  open,
  onOpenChange,
  item,
  categories,
  shopId,
  currency,
  defaultCategoryId,
  nextSortOrder,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  item: EditorItem | null // null = add mode
  categories: { id: string; name: string }[]
  shopId: string
  currency: string
  defaultCategoryId: string
  nextSortOrder: number
}) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState(item?.name ?? "")
  const [description, setDescription] = useState(item?.description ?? "")
  const [price, setPrice] = useState(item ? (item.price_minor / 100).toFixed(2) : "")
  const [categoryId, setCategoryId] = useState(item?.category_id ?? defaultCategoryId)
  const [allergens, setAllergens] = useState<Set<string>>(
    new Set(item?.allergens ?? [])
  )
  const [saving, setSaving] = useState(false)

  const toggleAllergen = (key: string) =>
    setAllergens((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return toast.error(t("editor.nameRequired"))
    const pounds = Number.parseFloat(price)
    if (!Number.isFinite(pounds) || pounds < 0)
      return toast.error(t("editor.priceInvalid"))
    const price_minor = Math.round(pounds * 100)

    setSaving(true)
    const fields = {
      name: trimmed,
      description: description.trim() || null,
      price_minor,
      category_id: categoryId,
      allergens: [...allergens],
    }
    const { error } = item
      ? await supabase.from("menu_items").update(fields).eq("id", item.id)
      : await supabase.from("menu_items").insert({
          ...fields,
          shop_id: shopId,
          currency,
          is_available: true,
          sort_order: nextSortOrder,
        })
    setSaving(false)
    if (error) return toast.error(t("editor.saveFailed"))
    toast.success(t("editor.saved"))
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="theme-travo max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl bg-background text-foreground"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="font-heading text-2xl">
            {item ? t("editor.editItem") : t("editor.addItem")}
          </SheetTitle>
          <SheetDescription>{t("editor.itemFormHint")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="it-name">{t("editor.name")}</Label>
            <Input
              id="it-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="it-desc">{t("editor.description")}</Label>
            <Textarea
              id="it-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-xl"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="it-price">{t("editor.priceLabel")}</Label>
              <Input
                id="it-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-11 w-28 rounded-xl"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="it-cat">{t("editor.category")}</Label>
              <select
                id="it-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-11 rounded-xl border border-input bg-transparent px-3"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t("editor.allergens")}</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {UK_ALLERGENS.map(({ key, label }) => {
                const on = allergens.has(key)
                return (
                  <button
                    key={key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleAllergen(key)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm",
                      on
                        ? "border-primary bg-secondary font-medium"
                        : "border-border bg-card"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border text-xs",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      )}
                    >
                      {on ? "✓" : ""}
                    </span>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            className="h-12 w-full rounded-full text-base"
            disabled={saving}
            onClick={save}
          >
            {saving ? t("editor.saving") : t("editor.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Build**

Run: `npm run build` — expected clean (the component is imported in Task 3; an unused-import lint here is fine as it'll be wired next, but the file itself must type-check).

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/item-form-sheet.tsx
git commit -m "feat(editor): add/edit item form sheet with allergen checkboxes"
```

---

### Task 3: Menu editor (rework page + component)

**Files:**
- Modify: `src/app/dashboard/menu/page.tsx` (fuller fetch; pass `shopId` + `currency`)
- Create: `src/components/dashboard/menu-editor.tsx`
- Delete: `src/components/dashboard/menu-availability.tsx` (superseded)

**Interfaces:**
- Consumes: `ItemFormSheet` + `EditorItem` (Task 2); `getStaffShop`, `DashboardNav`; `formatMinor` from `@/lib/money`; Dialog UI.
- Produces: the full `/dashboard/menu` editor.

- [ ] **Step 1: Confirm the Dialog UI exports**

Run: `sed -n '1,40p' src/components/ui/dialog.tsx`
Expected: exports include `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`. If any name differs in this UI kit, use the actual exported names in Step 3 (adjust the import + JSX accordingly) — the confirm dialog is the only consumer.

- [ ] **Step 2: Update the server page**

Replace `src/app/dashboard/menu/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { MenuEditor } from "@/components/dashboard/menu-editor";
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
    .select(
      "id, name, sort_order, menu_items(id, name, description, price_minor, currency, is_available, sort_order, category_id, allergens)"
    )
    .eq("shop_id", shop.id)
    .order("sort_order");

  const currency =
    categories?.flatMap((c) => c.menu_items).find(Boolean)?.currency ?? "GBP";

  return (
    <div className="theme-travo flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <DashboardNav shop={shop} active="menu" />
      <MenuEditor
        categories={categories ?? []}
        shopId={shop.id}
        currency={currency}
      />
    </div>
  );
}
```

- [ ] **Step 3: Write the editor component**

Create `src/components/dashboard/menu-editor.tsx`:

```tsx
"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
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
  ItemFormSheet,
  type EditorItem,
} from "@/components/dashboard/item-form-sheet"
import { t } from "@/lib/i18n"
import { formatMinor } from "@/lib/money"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Category = {
  id: string
  name: string
  sort_order: number
  menu_items: EditorItem[]
}

function IconBtn({
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

export function MenuEditor({
  categories,
  shopId,
  currency,
}: {
  categories: Category[]
  shopId: string
  currency: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [newCat, setNewCat] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<EditorItem | null>(null)
  const [formCategoryId, setFormCategoryId] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<EditorItem | null>(null)

  const cats = [...categories].sort((a, b) => a.sort_order - b.sort_order)
  const catList = cats.map((c) => ({ id: c.id, name: c.name }))
  const refresh = () => router.refresh()
  const fail = () => toast.error(t("editor.saveFailed"))

  const addCategory = async () => {
    const name = newCat.trim()
    if (!name) return
    const nextSort = Math.max(0, ...cats.map((c) => c.sort_order)) + 1
    const { error } = await supabase
      .from("menu_categories")
      .insert({ shop_id: shopId, name, sort_order: nextSort })
    if (error) return fail()
    setNewCat("")
    refresh()
  }

  const renameCategory = async (id: string, value: string, current: string) => {
    const name = value.trim()
    if (!name || name === current) return
    const { error } = await supabase
      .from("menu_categories")
      .update({ name })
      .eq("id", id)
    if (error) return fail()
    refresh()
  }

  const deleteCategory = async (c: Category) => {
    if (c.menu_items.length > 0) return toast.error(t("editor.categoryNotEmpty"))
    const { error } = await supabase
      .from("menu_categories")
      .delete()
      .eq("id", c.id)
    if (error) return fail()
    refresh()
  }

  const swapCat = async (a: Category, b: Category) => {
    await supabase.from("menu_categories").update({ sort_order: b.sort_order }).eq("id", a.id)
    await supabase.from("menu_categories").update({ sort_order: a.sort_order }).eq("id", b.id)
    refresh()
  }

  const swapItem = async (a: EditorItem, b: EditorItem) => {
    await supabase.from("menu_items").update({ sort_order: b.sort_order }).eq("id", a.id)
    await supabase.from("menu_items").update({ sort_order: a.sort_order }).eq("id", b.id)
    refresh()
  }

  const toggleAvailable = async (it: EditorItem) => {
    const { error } = await supabase
      .from("menu_items")
      .update({ is_available: !it.is_available })
      .eq("id", it.id)
    if (error) return fail()
    refresh()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", deleteTarget.id)
    setDeleteTarget(null)
    if (error) return fail()
    refresh()
  }

  const openAdd = (categoryId: string) => {
    setEditItem(null)
    setFormCategoryId(categoryId)
    setFormOpen(true)
  }
  const openEdit = (it: EditorItem) => {
    setEditItem(it)
    setFormCategoryId(it.category_id)
    setFormOpen(true)
  }

  const formCat = cats.find((c) => c.id === (editItem?.category_id ?? formCategoryId))
  const nextSortOrder =
    Math.max(0, ...(formCat?.menu_items.map((i) => i.sort_order) ?? [])) + 1

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-4">
      <div className="flex items-center gap-2">
        <Input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder={t("editor.newCategory")}
          className="h-11 rounded-xl"
        />
        <Button type="button" className="h-11 rounded-full px-5" onClick={addCategory}>
          {t("editor.addCategory")}
        </Button>
      </div>

      {cats.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">
          {t("editor.noCategories")}
        </p>
      )}

      {cats.map((category, ci) => {
        const items = [...category.menu_items].sort((a, b) => a.sort_order - b.sort_order)
        return (
          <section
            key={category.id}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3"
          >
            <div className="flex items-center gap-1">
              <input
                defaultValue={category.name}
                onBlur={(e) => renameCategory(category.id, e.target.value, category.name)}
                aria-label={t("editor.categoryName")}
                className="min-w-0 flex-1 rounded-lg bg-transparent px-1 font-heading text-lg font-semibold outline-none focus:bg-secondary"
              />
              <IconBtn label={t("editor.moveUp")} disabled={ci === 0} onClick={() => swapCat(category, cats[ci - 1])}>
                <ChevronUpIcon className="size-4" />
              </IconBtn>
              <IconBtn label={t("editor.moveDown")} disabled={ci === cats.length - 1} onClick={() => swapCat(category, cats[ci + 1])}>
                <ChevronDownIcon className="size-4" />
              </IconBtn>
              <IconBtn label={t("editor.deleteCategory")} disabled={items.length > 0} onClick={() => deleteCategory(category)}>
                <Trash2Icon className="size-4" />
              </IconBtn>
            </div>

            <ul className="flex flex-col gap-1.5">
              {items.map((it, ii) => (
                <li
                  key={it.id}
                  className="flex items-center gap-1 rounded-xl border border-border bg-background p-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn("font-medium", !it.is_available && "text-muted-foreground line-through")}>
                      {it.name}
                    </span>
                    <span className="ml-2 text-sm text-muted-foreground tabular-nums">
                      {formatMinor(it.price_minor, it.currency)}
                    </span>
                  </span>
                  <IconBtn label={t("editor.moveUp")} disabled={ii === 0} onClick={() => swapItem(it, items[ii - 1])}>
                    <ChevronUpIcon className="size-4" />
                  </IconBtn>
                  <IconBtn label={t("editor.moveDown")} disabled={ii === items.length - 1} onClick={() => swapItem(it, items[ii + 1])}>
                    <ChevronDownIcon className="size-4" />
                  </IconBtn>
                  <button
                    type="button"
                    onClick={() => toggleAvailable(it)}
                    className={cn(
                      "h-8 shrink-0 rounded-full px-3 text-xs font-medium",
                      it.is_available
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {it.is_available ? t("menu.available") : t("menu.markSoldOut")}
                  </button>
                  <IconBtn label={t("editor.editItem")} onClick={() => openEdit(it)}>
                    <PencilIcon className="size-4" />
                  </IconBtn>
                  <IconBtn label={t("editor.deleteItem")} onClick={() => setDeleteTarget(it)}>
                    <Trash2Icon className="size-4" />
                  </IconBtn>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="ghost"
              className="h-10 w-fit rounded-full px-3 text-sm"
              onClick={() => openAdd(category.id)}
            >
              <PlusIcon className="size-4" /> {t("editor.addItem")}
            </Button>
          </section>
        )
      })}

      {formOpen && catList.length > 0 && (
        <ItemFormSheet
          key={editItem?.id ?? "new"}
          open={formOpen}
          onOpenChange={setFormOpen}
          item={editItem}
          categories={catList}
          shopId={shopId}
          currency={currency}
          defaultCategoryId={formCategoryId || catList[0].id}
          nextSortOrder={nextSortOrder}
        />
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="theme-travo">
          <DialogHeader>
            <DialogTitle>{t("editor.deleteItemTitle")}</DialogTitle>
            <DialogDescription>
              {t("editor.deleteItemBody", { name: deleteTarget?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t("editor.cancel")}
            </Button>
            <Button className="bg-destructive text-white" onClick={confirmDelete}>
              {t("editor.confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
```

- [ ] **Step 4: Delete the superseded component**

Run: `git rm src/components/dashboard/menu-availability.tsx`
(The editor replaces it; confirm nothing else imports it: `grep -rn "menu-availability" src` returns nothing.)

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: clean; `/dashboard/menu` still compiles.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/menu/page.tsx src/components/dashboard/menu-editor.tsx
git commit -m "feat(editor): full menu editor — item CRUD, categories, reorder"
```

---

### Task 4: RLS test — cross-tenant insert/delete

**Files:**
- Modify: `tests/rls.test.ts`

**Interfaces:**
- Consumes: the two signed-in clients + `aShopId`/`bShopId` already set up in `tests/rls.test.ts`.

- [ ] **Step 1: Add the two assertions**

In `tests/rls.test.ts`, inside the existing `describe("RLS cross-tenant isolation", …)` block, add:

```ts
  it("A CANNOT insert a menu item into B's shop", async () => {
    const { data: cat } = await b
      .from("menu_categories")
      .select("id")
      .eq("shop_id", bShopId)
      .limit(1)
      .single()
    const { error } = await a.from("menu_items").insert({
      shop_id: bShopId,
      category_id: cat!.id,
      name: "rls-hack",
      price_minor: 1,
      currency: "GBP",
    })
    expect(error).not.toBeNull() // RLS with-check rejects the insert
  })

  it("A CANNOT delete B's menu item", async () => {
    const { data: item } = await b
      .from("menu_items")
      .select("id")
      .eq("shop_id", bShopId)
      .limit(1)
      .single()
    await a.from("menu_items").delete().eq("id", item!.id)
    const { data: still } = await b
      .from("menu_items")
      .select("id")
      .eq("id", item!.id)
      .maybeSingle()
    expect(still).not.toBeNull() // still there → delete was blocked by RLS
  })
```

- [ ] **Step 2: Run the tests**

Run: `npm test`
Expected: full suite green (existing 10 + 2 new = 12). If "A CANNOT insert…" fails (no error) or "A CANNOT delete…" fails (item gone), that's a real RLS hole — do not weaken; report it. (If the insert unexpectedly succeeded, also remove the stray `rls-hack` row it created from shop B.)

- [ ] **Step 3: Commit**

```bash
git add tests/rls.test.ts
git commit -m "test(rls): cross-tenant menu insert/delete are blocked"
```

---

## Self-Review

**Spec coverage:** §3 items CRUD → Tasks 2/3; categories CRUD + guarded delete → Task 3; reorder → Task 3; allergen checkboxes → Tasks 1/2; sold-out regression → Task 3 (kept). §7 AC1–6 → manual on Tasks 2/3; AC7 (cross-tenant insert/delete) → Task 4. §8 testing → Task 4 + manual.

**Placeholder scan:** none — every code step is complete. Two explicit "confirm the UI export" steps (Textarea, Dialog) are guardrails against UI-kit naming differences, mirroring the base-ui `asChild` lesson from Slice 3 — not placeholders.

**Type consistency:** `EditorItem` defined in Task 2, imported by Task 3 and matched by the page's `select(...)` field list (id, name, description, price_minor, currency, is_available, sort_order, category_id, allergens). `ItemFormSheet` prop shape in Task 2 matches its call site in Task 3 (item, categories, shopId, currency, defaultCategoryId, nextSortOrder). `UK_ALLERGENS` shape (Task 1) matches its use in Task 2.

**Known trade-offs (deferred / by design):**
- `router.refresh()` after each mutation (not fine-grained optimistic) — simpler and race-safe for a low-frequency editor; the sold-out toggle path also uses it here (was optimistic in Slice 1 — acceptable regression for consistency).
- Reorder = two sequential `sort_order` updates (not transactional); a mid-failure could leave a duplicate order value, self-heals on next reorder. Acceptable for single-owner editing.
- Category delete guarded in the client (empty-only). The DB still cascades if a delete were issued another way — acceptable; documented.
- `<select>` native element (not the shadcn Select) for the category dropdown — simpler, fewer moving parts.
