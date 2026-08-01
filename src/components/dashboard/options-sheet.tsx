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

                {group.required && options.length === 0 && (
                  <p className="text-xs font-medium text-destructive">
                    {t("editor.requiredNoOptions")}
                  </p>
                )}

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
                        // Re-key on the saved value so the uncontrolled input
                        // re-initialises after a save/refresh instead of Base UI
                        // warning about a changed defaultValue.
                        key={o.price_delta_minor}
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
