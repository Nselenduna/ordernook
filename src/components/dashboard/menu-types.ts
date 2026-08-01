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
