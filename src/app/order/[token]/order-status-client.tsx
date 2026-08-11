"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PushCard } from "@/components/order/push-card";
import { StatusStepper } from "@/components/order/status-stepper";
import { brandingVars } from "@/lib/branding";
import { t, type I18nKey } from "@/lib/i18n";
import { formatMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import type { OrderStatus, OrderView } from "@/lib/types";

const POLL_MS = 8000;

const STATUS_MESSAGE: Partial<Record<OrderStatus, I18nKey>> = {
  pending_payment: "order.status.pending_payment",
  new: "order.status.new",
  accepted: "order.status.accepted",
  preparing: "order.status.preparing",
  ready: "order.status.ready",
  collected: "order.status.collected",
};

function isFinalStatus(status: OrderStatus): boolean {
  return (
    status === "collected" || status === "rejected" || status === "refunded"
  );
}

function etaTime(order: OrderView): string {
  const readyBy = new Date(
    new Date(order.placed_at).getTime() + order.shop.prep_minutes * 60_000
  );
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(readyBy);
}

function lineTotalMinor(line: OrderView["items"][number]): number {
  // unit_price_minor already includes option deltas (set by create_order).
  return line.snapshot.unit_price_minor * line.qty;
}

// Server component `page.tsx` handles reconcile-on-return (session_id) before
// this mounts; this owns the live status view + polling, keyed by `token`
// (the order's access_token, passed down from the route param).
export function OrderStatusClient({ token }: { token: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [order, setOrder] = useState<OrderView | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "notFound">(
    "loading"
  );

  // One effect owns fetching: initial load, then — while the order is still
  // moving — an 8s poll plus a refetch when the customer switches back to
  // this tab (they'll do that when the push notification arrives).
  const active = order !== null && !isFinalStatus(order.status);
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase.rpc("get_order_by_token", {
        p_token: token,
      });
      if (cancelled) return;
      // A malformed token raises a uuid cast error; an unknown one returns null.
      if (error || !data) {
        setPhase("notFound");
        return;
      }
      setOrder(data as unknown as OrderView);
      setPhase("ready");
    };

    load();
    if (!active) {
      return () => {
        cancelled = true;
      };
    }
    const interval = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [supabase, token, active]);

  useEffect(() => {
    if (order) {
      document.title = `${t("order.number", { number: order.order_number })} · ${order.shop.name}`;
    }
  }, [order]);

  const vars = brandingVars(order?.shop.branding ?? {});

  if (phase === "notFound") {
    return (
      <main className="theme-latte flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
        <h1 className="font-heading text-3xl font-semibold">
          {t("order.notFound.title")}
        </h1>
        <p className="max-w-sm text-muted-foreground">
          {t("order.notFound.body")}
        </p>
      </main>
    );
  }

  if (phase === "loading" || !order) {
    return (
      <main
        className="theme-latte flex flex-1 flex-col gap-4 bg-background px-4 pt-16 text-foreground"
        style={vars}
      >
        <p className="text-center text-muted-foreground">
          {t("order.loading")}
        </p>
        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
          <Skeleton className="h-28 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
      </main>
    );
  }

  // "rejected" and "refunded" are both final, no-order-coming outcomes —
  // they share the same card layout but show different copy.
  const showFinalCard =
    order.status === "rejected" || order.status === "refunded";
  const showEta =
    order.status === "new" ||
    order.status === "accepted" ||
    order.status === "preparing";

  return (
    <main
      className="theme-latte flex flex-1 flex-col bg-background text-foreground"
      style={vars}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <header className="text-center">
          <p className="text-sm text-muted-foreground">{order.shop.name}</p>
          <h1 className="font-heading text-5xl font-semibold tabular-nums">
            #{order.order_number}
          </h1>
        </header>

        {showFinalCard ? (
          <div className="flex flex-col gap-1 rounded-3xl bg-destructive/10 p-5 text-center">
            <p className="font-heading text-xl font-semibold text-destructive">
              {t(
                order.status === "refunded"
                  ? "order.refunded.title"
                  : "order.rejected.title"
              )}
            </p>
            <p className="text-sm">
              {t(
                order.status === "refunded"
                  ? "order.refunded.body"
                  : "order.rejected.body"
              )}
            </p>
            {order.reject_reason && (
              <p className="text-sm text-muted-foreground">
                {t("order.rejected.reason", { reason: order.reject_reason })}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-[0_8px_30px_var(--shadow-brand,rgba(111,78,55,.12))] backdrop-blur-md">
            <StatusStepper status={order.status} />
            <p className="text-center font-medium">
              {t(STATUS_MESSAGE[order.status] ?? "order.status.new")}
            </p>
            {showEta && (
              <p className="text-center text-sm text-muted-foreground">
                {t("order.eta", { time: etaTime(order) })}
              </p>
            )}
            {order.payment_mode === "in_store" &&
              order.status !== "collected" && (
                <p className="rounded-2xl bg-secondary px-4 py-2.5 text-center text-sm font-medium">
                  {t("order.payAtCounter")}
                </p>
              )}
          </div>
        )}

        {!isFinalStatus(order.status) && <PushCard token={token} />}

        <section className="flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-[0_8px_30px_var(--shadow-brand,rgba(111,78,55,.12))] backdrop-blur-md">
          <h2 className="font-heading text-lg font-medium">
            {t("order.items")}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {order.items.map((line, index) => (
              <li key={index} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {line.qty}× {line.snapshot.name}
                  </p>
                  {line.snapshot.options.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {line.snapshot.options
                        .map((option) => option.name)
                        .join(", ")}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {formatMinor(lineTotalMinor(line), order.currency)}
                </p>
              </li>
            ))}
          </ul>
          <Separator />
          <div className="flex items-center justify-between font-semibold">
            <span>{t("order.total")}</span>
            <span className="tabular-nums">
              {formatMinor(order.total_minor, order.currency)}
            </span>
          </div>
        </section>

        <Link
          href={`/${order.shop.slug}`}
          className="mx-auto flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("order.backToMenu")}
        </Link>
      </div>
    </main>
  );
}
