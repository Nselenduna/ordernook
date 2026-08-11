-- protect_shop_billing_columns() and protect_order_terminal_status() are
-- BEFORE UPDATE trigger functions only — they read OLD/NEW, which are only
-- bound inside trigger execution, so a direct RPC call would just error out.
-- Flagged by the Supabase security advisor as anon/authenticated-callable
-- SECURITY DEFINER functions since they live in the public schema with no
-- explicit grants; revoking public EXECUTE closes the unintended API surface
-- without touching the triggers themselves (trigger firing doesn't require
-- EXECUTE grants to the role that caused the update).

revoke execute on function public.protect_shop_billing_columns() from public, anon, authenticated;
revoke execute on function public.protect_order_terminal_status() from public, anon, authenticated;
