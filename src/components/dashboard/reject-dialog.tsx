"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { t } from "@/lib/i18n"
import type { DashboardOrder } from "@/lib/types"

/** Keyed on order.id by the parent, so each order starts with a blank reason. */
function RejectForm({
  order,
  onConfirm,
  onClose,
}: {
  order: DashboardOrder
  onConfirm: (order: DashboardOrder, reason: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState("")

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t("dash.reject.title", { number: order.order_number })}
        </DialogTitle>
        <DialogDescription>{order.customer_name}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reject-reason">{t("dash.reject.reasonLabel")}</Label>
        <Textarea
          id="reject-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t("dash.reject.placeholder")}
          rows={3}
        />
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          className="h-11 rounded-full"
          onClick={onClose}
        >
          {t("dash.cancel")}
        </Button>
        <Button
          variant="destructive"
          className="h-11 rounded-full"
          onClick={() => {
            onConfirm(order, reason.trim())
            onClose()
          }}
        >
          {t("dash.reject.confirm")}
        </Button>
      </DialogFooter>
    </>
  )
}

export function RejectDialog({
  order,
  onConfirm,
  onClose,
}: {
  order: DashboardOrder | null
  onConfirm: (order: DashboardOrder, reason: string) => void
  onClose: () => void
}) {
  return (
    <Dialog open={order !== null} onOpenChange={(open) => !open && onClose()}>
      {/* Dialogs portal to <body>, so re-apply the dashboard theme class. */}
      <DialogContent className="theme-travo bg-popover text-popover-foreground">
        {order && (
          <RejectForm
            key={order.id}
            order={order}
            onConfirm={onConfirm}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
