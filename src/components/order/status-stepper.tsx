"use client"

import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { OrderStatus } from "@/lib/types"

const STEPS = [
  { status: "new", label: () => t("order.step.placed") },
  { status: "accepted", label: () => t("order.step.accepted") },
  { status: "preparing", label: () => t("order.step.preparing") },
  { status: "ready", label: () => t("order.step.ready") },
  { status: "collected", label: () => t("order.step.collected") },
] as const

function stepIndex(status: OrderStatus): number {
  const index = STEPS.findIndex((step) => step.status === status)
  // pending_payment maps to step 0; rejected/refunded never render this.
  return index === -1 ? 0 : index
}

/** Placed → Accepted → Preparing → Ready → Collected progress dots. */
export function StatusStepper({ status }: { status: OrderStatus }) {
  const current = stepIndex(status)

  return (
    <ol className="flex items-start justify-between gap-1">
      {STEPS.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <li
            key={step.status}
            className="flex flex-1 flex-col items-center gap-1.5"
            aria-current={active ? "step" : undefined}
          >
            <span className="flex w-full items-center">
              <span
                className={cn(
                  "h-0.5 flex-1",
                  index === 0
                    ? "bg-transparent"
                    : done || active
                      ? "bg-primary"
                      : "bg-border"
                )}
              />
              <span
                className={cn(
                  "size-3.5 shrink-0 rounded-full transition-colors",
                  done && "bg-primary",
                  active && "bg-primary ring-4 ring-primary/25",
                  !done && !active && "bg-border"
                )}
              />
              <span
                className={cn(
                  "h-0.5 flex-1",
                  index === STEPS.length - 1
                    ? "bg-transparent"
                    : done
                      ? "bg-primary"
                      : "bg-border"
                )}
              />
            </span>
            <span
              className={cn(
                "text-[11px] leading-tight",
                active ? "font-semibold" : "text-muted-foreground"
              )}
            >
              {step.label()}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
