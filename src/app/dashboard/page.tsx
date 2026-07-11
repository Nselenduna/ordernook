import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("login.title") };

export default async function DashboardPage() {
  const supabase = await createClient();

  // The proxy already gates /dashboard, but belt-and-braces here too.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/dashboard/login");

  // RLS on staff_users lets a user read only their own row; the shops join
  // resolves which shop this dashboard shows.
  const { data: staff } = await supabase
    .from("staff_users")
    .select("role, shops(*)")
    .eq("auth_user_id", user.id)
    .limit(1)
    .maybeSingle();

  const shop = staff?.shops ?? null;
  if (!shop) {
    return (
      <main className="theme-travo flex flex-1 flex-col items-center justify-center bg-background px-6 text-center text-foreground">
        <p className="max-w-sm text-muted-foreground">{t("dash.notLinked")}</p>
      </main>
    );
  }

  return <DashboardShell shop={shop} />;
}
