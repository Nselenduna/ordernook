import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

/**
 * Resolve the shop for the logged-in staff member. Redirects to the login
 * page if there's no session; returns null if the user isn't linked to a shop
 * (caller renders a "not linked" message). RLS scopes staff_users to self.
 */
export async function getStaffShop(): Promise<Tables<"shops"> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/dashboard/login");

  const { data: staff } = await supabase
    .from("staff_users")
    .select("shops(*)")
    .eq("auth_user_id", user.id)
    .limit(1)
    .maybeSingle();

  return (staff?.shops as Tables<"shops"> | undefined) ?? null;
}

/**
 * Same lookup, but returns null (never redirects) when there's no session.
 * For the dashboard layout, which wraps the login page — the proxy already
 * gates auth, so the layout must not redirect (that would loop on /login).
 */
export async function getStaffShopOrNull(): Promise<Tables<"shops"> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff_users")
    .select("shops(*)")
    .eq("auth_user_id", user.id)
    .limit(1)
    .maybeSingle();

  return (staff?.shops as Tables<"shops"> | undefined) ?? null;
}
