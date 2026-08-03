import type { Tables } from "@/lib/database.types"

// Mirrors the SQL public.is_entitled(): active, or still within trial.
export function isEntitled(
  shop: Pick<Tables<"shops">, "subscription_status" | "trial_ends_at">
): boolean {
  if (shop.subscription_status === "active") return true
  if (shop.subscription_status === "trialing" && shop.trial_ends_at) {
    return new Date(shop.trial_ends_at).getTime() > Date.now()
  }
  return false
}
