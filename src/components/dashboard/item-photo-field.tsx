"use client"

import { CameraIcon, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { t } from "@/lib/i18n"

export function ItemPhotoField({
  previewUrl,
  onChoose,
  onRemove,
}: {
  previewUrl: string | null
  onChoose: (file: File) => void
  onRemove: () => void
}) {
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onChoose(f)
    e.target.value = "" // allow re-picking the same file
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{t("editor.photo")}</Label>
      {previewUrl && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className="size-20 rounded-2xl border border-border object-cover"
          />
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-full px-4 text-sm text-destructive"
            onClick={onRemove}
          >
            {t("editor.removePhoto")}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {/* Take photo: capture="environment" opens the rear camera directly on phones. */}
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-secondary px-4 text-sm font-medium text-secondary-foreground">
          <CameraIcon className="size-4" />
          {t("editor.takePhoto")}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={pick}
          />
        </label>
        {/* Choose from the photo library. */}
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-secondary px-4 text-sm font-medium text-secondary-foreground">
          <ImageIcon className="size-4" />
          {previewUrl ? t("editor.changePhoto") : t("editor.choosePhoto")}
          <input type="file" accept="image/*" className="hidden" onChange={pick} />
        </label>
      </div>
    </div>
  )
}
