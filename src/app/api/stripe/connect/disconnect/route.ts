import { NextResponse } from "next/server"
import { getStaffShop } from "@/lib/dashboard"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function POST() {
  const shop = await getStaffShop()
  if (!shop) return NextResponse.json({ error: "no_shop" }, { status: 401 })

  const admin = createAdminClient()
  const modes = (shop.payment_modes ?? []).filter((m) => m !== "online")
  await admin
    .from("shops")
    .update({ stripe_account_id: null, payment_modes: modes })
    .eq("id", shop.id)
  return NextResponse.json({ ok: true })
}
