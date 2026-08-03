import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

// Service-role client for the Stripe webhook (no user session; must bypass RLS
// to write billing fields). Server-only — never import into client components.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
