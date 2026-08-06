"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import { t, type I18nKey } from "@/lib/i18n"
import { formatMinor } from "@/lib/money"
import { parseSnapshot } from "@/lib/types"
import { cn } from "@/lib/utils"
import type { DashboardOrder, OrderStatus } from "@/lib/types"

// Status colours come from the .theme-travo CSS variables (DESIGN.md).
const STATUS_BADGE: Record<OrderStatus, { label: I18nKey; className: string }> =
  {
    new: {
      label: "dash.status.new",
      className: "bg-(--status-new)/12 text-(--status-new)",
    },
    accepted: {
      label: "dash.status.accepted",
      className: "bg-(--status-active)/12 text-(--status-active)",
    },
    preparing: {
      label: "dash.status.preparing",
      className: "bg-(--status-active)/12 text-(--status-active)",
    },
    ready: {
      label: "dash.status.ready",
      className: "bg-(--status-ready)/12 text-(--status-ready)",
    },
    collected: {
      label: "dash.status.collected",
      className: "bg-(--status-done)/15 text-(--status-done)",
    },
    rejected: {
      label: "dash.status.rejected",
      className: "bg-(--status-rejected)/10 text-(--status-rejected)",
    },
    pending_payment: {
      label: "dash.status.pending_payment",
      className: "bg-muted text-muted-foreground",
    },
    refunded: {
      label: "dash.status.refunded",
      className: "bg-muted text-muted-foreground",
    },
  }

function timeAgo(iso: string, nowMs: number): string {
  const mins = Math.floor((nowMs - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return t("dash.justNow")
  if (mins < 60) return t("dash.minAgo", { m: mins })
  return t("dash.hourAgo", { h: Math.floor(mins / 60), m: mins % 60 })
}

export function OrderCard({
  order,
  nowMs,
  onAdvance,
  onReject,
}: {
  order: DashboardOrder
  nowMs: number
  /** Move the order to the next status (Accept / Start preparing / Ready / Collected). */
  onAdvance: (order: DashboardOrder, status: OrderStatus) => void
  onReject: (order: DashboardOrder) => void
}) {
  const badge = STATUS_BADGE[order.status]

  return (
    <Card className="shadow-[0_4px_16px_rgba(123,97,255,.10)] ring-0">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="font-heading text-2xl font-bold tabular-nums">
            #{order.order_number}
          </span>
          <div className="flex flex-col">
            <span className="font-medium">{order.customer_name}</span>
            <span className="text-xs text-muted-foreground">
              {timeAgo(order.placed_at, nowMs)}
            </span>
          </div>
        </div>
        <Badge
          variant="secondary"
          className={cn("border-transparent", badge.className)}
        >
          {t(badge.label)}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        <ul className="flex flex-col gap-1">
          {order.order_items.map((item) => {
            const snapshot = parseSnapshot(item.item_snapshot)
            return (
              <li key={item.id} className="text-sm">
                <span className="font-medium">
                  {item.qty}× {snapshot.name}
                </span>
                {snapshot.options.length > 0 && (
                  <span className="text-muted-foreground">
                    {" — "}
                    {snapshot.options.map((option) => option.name).join(", ")}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            {order.payment_mode === "in_store"
              ? t("dash.payAtCounter")
              : t("dash.paidOnline")}
          </Badge>
          <span className="font-semibold tabular-nums">
            {formatMinor(order.total_minor, order.currency)}
          </span>
        </div>
        {order.status === "rejected" && order.reject_reason && (
          <p className="text-sm text-(--status-rejected)">
            {order.reject_reason}
          </p>
        )}
      </CardContent>

      {(order.status === "new" ||
        order.status === "accepted" ||
        order.status === "preparing" ||
        order.status === "ready") && (
        <CardFooter className="gap-2">
          {order.status === "new" && (
            <>
              <Button
                className="h-11 flex-1 rounded-full"
                onClick={() => onAdvance(order, "accepted")}
              >
                {t("dash.accept")}
              </Button>
              <Button
                variant="destructive"
                className="h-11 flex-1 rounded-full"
                onClick={() => onReject(order)}
              >
                {t("dash.reject")}
              </Button>
            </>
          )}
          {order.status === "accepted" && (
            <Button
              className="h-11 flex-1 rounded-full"
              onClick={() => onAdvance(order, "preparing")}
            >
              {t("dash.startPreparing")}
            </Button>
          )}
          {order.status === "preparing" && (
            <Button
              className="h-11 flex-1 rounded-full"
              onClick={() => onAdvance(order, "ready")}
            >
              {t("dash.markReady")}
            </Button>
          )}
          {order.status === "ready" && (
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-full"
              onClick={() => onAdvance(order, "collected")}
            >
              {t("dash.markCollected")}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
