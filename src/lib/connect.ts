export type ConnectState = "none" | "pending" | "ready"

// UI state for a shop's Stripe onboarding. An account can exist before Stripe
// onboarding finishes, so "ready" requires charges to actually be enabled.
export function deriveConnectState(shop: {
  stripe_account_id: string | null
  stripe_charges_enabled: boolean | null
}): ConnectState {
  if (!shop.stripe_account_id) return "none"
  return shop.stripe_charges_enabled ? "ready" : "pending"
}

// DB patch for a charges-status change. When charges are disabled, 'online' must
// be removed from payment_modes so customers aren't offered online pay on an
// account that can't charge.
export function chargesSyncUpdate(
  chargesEnabled: boolean,
  paymentModes: string[]
): { stripe_charges_enabled: boolean; payment_modes: string[] } {
  return {
    stripe_charges_enabled: chargesEnabled,
    payment_modes: chargesEnabled ? paymentModes : paymentModes.filter((m) => m !== "online"),
  }
}
