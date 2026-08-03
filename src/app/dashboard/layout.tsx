import type { ReactNode } from "react"
import { getStaffShopOrNull } from "@/lib/dashboard"
import { isEntitled } from "@/lib/entitlement"
import { LockScreen } from "@/components/dashboard/lock-screen"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const shop = await getStaffShopOrNull()
  // Unauthenticated visitors (login page) have no staff shop → render normally.
  // A linked-but-unentitled shop is locked behind the LockScreen.
  if (shop && !isEntitled(shop)) {
    return <LockScreen hasCustomer={!!shop.stripe_customer_id} />
  }
  return <>{children}</>
}
