-- Postgres grants EXECUTE to PUBLIC at function creation, so revoking only from
-- anon/authenticated leaves that standing grant in place. Same hardening already
-- applied to is_staff_of (20260711144354) and attach_staff_push_device (20260811140000).
revoke execute on function public.notify_new_order() from public, anon, authenticated;
