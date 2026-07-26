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
    const r1 = await supabase.from("menu_categories").update({ sort_order: b.sort_order }).eq("id", a.id)
    const r2 = await supabase.from("menu_categories").update({ sort_order: a.sort_order }).eq("id", b.id)
    if (r1.error || r2.error) fail()
    refresh()
  }

  const swapItem = async (a: EditorItem, b: EditorItem) => {
    const r1 = await supabase.from("menu_items").update({ sort_order: b.sort_order }).eq("id", a.id)
    const r2 = await supabase.from("menu_items").update({ sort_order: a.sort_order }).eq("id", b.id)
    if (r1.error || r2.error) fail()
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
