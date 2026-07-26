"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BellRingIcon, Volume2Icon, VolumeXIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { OrderCard } from "@/components/dashboard/order-card"
import { RejectDialog } from "@/components/dashboard/reject-dialog"
import { useChime } from "@/components/dashboard/use-chime"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { Tables } from "@/lib/database.types"
import type { DashboardOrder, OrderRow, OrderStatus } from "@/lib/types"

const MUTE_KEY = "oa-dash-muted"

type TabId = "all" | "new" | "inProgress" | "ready" | "done"

function tabOf(status: OrderStatus): Exclude<TabId, "all"> {
  if (status === "new" || status === "pending_payment") return "new"
  if (status === "accepted" || status === "preparing") return "inProgress"
  if (status === "ready") return "ready"
  return "done"
}

/** Queue order: new first (oldest at top), then in progress, ready, done last. */
function queueSort(a: DashboardOrder, b: DashboardOrder): number {
  const weight: Record<Exclude<TabId, "all">, number> = {
    new: 0,
    inProgress: 1,
    ready: 2,
    done: 3,
  }
  const wa = weight[tabOf(a.status)]
  const wb = weight[tabOf(b.status)]
  if (wa !== wb) return wa - wb
  const ta = new Date(a.placed_at).getTime()
  const tb = new Date(b.placed_at).getTime()
  // Active queue: oldest first (serve in order). Done pile: newest first.
  return wa === 3 ? tb - ta : ta - tb
}

export function DashboardShell({ shop }: { shop: Tables<"shops"> }) {
  const supabase = useMemo(() => createClient(), [])
  const { play, unlocked, unlock } = useChime()

  const [orders, setOrders] = useState<DashboardOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [tab, setTab] = useState<TabId>("all")
  const [rejectTarget, setRejectTarget] = useState<DashboardOrder | null>(null)
  const [muted, setMuted] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  // Realtime handlers close over state, so keep the mute flag in a ref.
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  // Load mute preference after mount (localStorage isn't available in SSR).
  useEffect(() => {
    setMuted(window.localStorage.getItem(MUTE_KEY) === "1")
  }, [])

  const toggleMute = () => {
    setMuted((previous) => {
      window.localStorage.setItem(MUTE_KEY, previous ? "0" : "1")
      return !previous
    })
  }

  // Tick every 30s so "Xm ago" labels stay fresh.
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const upsertOrder = useCallback((row: OrderRow, items?: Tables<"order_items">[]) => {
    setOrders((previous) => {
      const existing = previous.find((order) => order.id === row.id)
      if (existing) {
        // UPDATE payloads don't include items — keep the ones we have.
        return previous.map((order) =>
          order.id === row.id
            ? { ...row, order_items: items ?? order.order_items }
            : order
        )
      }
      return [{ ...row, order_items: items ?? [] }, ...previous]
    })
  }, [])

  // Initial fetch + realtime subscription.
  useEffect(() => {
    let cancelled = false

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const fetchItems = async (orderId: string) => {
      const { data } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)
      return data ?? []
    }

    const init = async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("shop_id", shop.id)
        .gte("placed_at", startOfToday.toISOString())
        .order("placed_at", { ascending: false })
      if (cancelled) return
      setOrders(data ?? [])
      setLoading(false)

      // postgres_changes respects RLS, so the websocket must carry the staff
      // user's JWT — set it explicitly before subscribing.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) supabase.realtime.setAuth(session.access_token)
    }

    const channel = supabase
      .channel(`orders-${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `shop_id=eq.${shop.id}`,
        },
        async (payload) => {
          const row = payload.new as OrderRow
          if (!mutedRef.current) play()
          // The realtime payload has no order_items — fetch the snapshots.
          const items = await fetchItems(row.id)
          if (!cancelled) upsertOrder(row, items)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `shop_id=eq.${shop.id}`,
        },
        (payload) => {
          if (!cancelled) upsertOrder(payload.new as OrderRow)
        }
      )

    init().then(() => {
      if (!cancelled) {
        channel.subscribe((status) => setLive(status === "SUBSCRIBED"))
      }
    })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [supabase, shop.id, play, upsertOrder])

  const advance = async (
    order: DashboardOrder,
    status: OrderStatus,
    extra?: { reject_reason: string }
  ) => {
    // Optimistic update; the realtime UPDATE event confirms it.
    setOrders((previous) =>
      previous.map((o) => (o.id === order.id ? { ...o, status, ...extra } : o))
    )
    // Only the status (and reject_reason) is written from here — the DB
    // trigger stamps ready_at/collected_at and writes the audit log.
    const { error } = await supabase
      .from("orders")
      .update({ status, ...extra })
      .eq("id", order.id)
    if (error) {
      setOrders((previous) =>
        previous.map((o) =>
          o.id === order.id
            ? { ...o, status: order.status, reject_reason: order.reject_reason }
            : o
        )
      )
      toast.error(t("dash.updateFailed"))
      return
    }
    if (status === "ready") {
      // Fire-and-forget: web push "your order is ready" to the customer.
      fetch("/api/notify-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id }),
      }).catch(() => {})
    }
  }

  const sorted = [...orders].sort(queueSort)
  const visible =
    tab === "all" ? sorted : sorted.filter((order) => tabOf(order.status) === tab)

  const counts: Record<TabId, number> = {
    all: orders.length,
    new: 0,
    inProgress: 0,
    ready: 0,
    done: 0,
  }
  for (const order of orders) counts[tabOf(order.status)] += 1

  const tabs: { id: TabId; label: string }[] = [
    { id: "all", label: t("dash.tab.all") },
    { id: "new", label: t("dash.tab.new") },
    { id: "inProgress", label: t("dash.tab.inProgress") },
    { id: "ready", label: t("dash.tab.ready") },
    { id: "done", label: t("dash.tab.done") },
  ]

  return (
    <div className="theme-travo flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <DashboardNav shop={shop} active="orders" />
      <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-1 px-4 pt-2">
        <span className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-2 rounded-full",
              live ? "animate-pulse bg-(--status-ready)" : "bg-border"
            )}
          />
          {live ? t("dash.live") : t("dash.connecting")}
        </span>
        <Button
          variant="ghost"
          className="h-11 rounded-full px-3"
          onClick={toggleMute}
          aria-pressed={muted}
        >
          {muted ? <VolumeXIcon /> : <Volume2Icon />}
          <span className="hidden sm:inline">
            {muted ? t("dash.soundOff") : t("dash.soundOn")}
          </span>
        </Button>
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4">
        {!unlocked && !muted && (
          <button
            type="button"
            onClick={unlock}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-secondary text-sm font-medium text-secondary-foreground"
          >
            <BellRingIcon className="size-4" />
            {t("dash.enableSound")}
          </button>
        )}

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)}>
          <TabsList className="w-full overflow-x-auto">
            {tabs.map(({ id, label }) => (
              <TabsTrigger key={id} value={id} className="min-h-9 gap-1.5">
                {label}
                {counts[id] > 0 && (
                  <span className="rounded-full bg-secondary px-1.5 text-xs font-semibold text-secondary-foreground tabular-nums">
                    {counts[id]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-36 w-full rounded-2xl" />
            <Skeleton className="h-36 w-full rounded-2xl" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            {t("dash.empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-3 pb-8">
            {visible.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                nowMs={nowMs}
                onAdvance={advance}
                onReject={setRejectTarget}
              />
            ))}
          </div>
        )}
      </main>

      <RejectDialog
        order={rejectTarget}
        onConfirm={(order, reason) =>
          advance(order, "rejected", { reject_reason: reason })
        }
        onClose={() => setRejectTarget(null)}
      />
    </div>
  )
}
