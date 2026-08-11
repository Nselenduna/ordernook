-- Fix a cross-shop device-hijack hole in attach_staff_push_device.
--
-- The original body only gated on is_staff_of(p_shop_id) — staff of the
-- TARGET shop. Nothing checked the caller's relationship to a row that
-- already exists for that endpoint (owned by a DIFFERENT shop). Because the
-- function is SECURITY DEFINER, that write bypasses staff_push_devices_self
-- RLS entirely, so the table policy gave no protection on the conflict path.
--
-- Failure scenario this closes: staff of shop B obtains an endpoint already
-- enrolled to shop A (handed-down device, leaked ticket, former job) and
-- calls attach_staff_push_device(p_shop_id => B, p_subscription => {endpoint:
-- <A's endpoint>, ...}). is_staff_of(B) passed, the ON CONFLICT branch fired
-- unconditionally, and the row's shop_id/auth_user_id were silently
-- reassigned to B — A lost alerts on that device with no error, and the
-- device started receiving B's order alerts instead.
--
-- The real rule this function enforces: a caller may attach an endpoint to
-- shop_id = p_shop_id only if either (a) no row for that endpoint exists yet,
-- or (b) the EXISTING row's shop is one the caller also staffs. That permits
-- same-shop handover between staff, and cross-shop moves only by someone who
-- staffs both shops, while rejecting the hijack above.
create or replace function public.attach_staff_push_device(
  p_shop_id uuid,
  p_subscription jsonb,
  p_label text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_endpoint text := p_subscription->>'endpoint';
  v_rows     integer;
begin
  if not public.is_staff_of(p_shop_id) then
    raise exception 'not staff of shop %', p_shop_id;
  end if;

  if v_endpoint is null or v_endpoint = '' then
    raise exception 'subscription missing endpoint';
  end if;

  -- The WHERE on the conflict branch (checked against the EXISTING row's
  -- shop_id, not excluded's) plus the row-count check below make this
  -- atomic: no separate SELECT-then-decide, so no TOCTOU window between
  -- checking ownership and reassigning the row.
  insert into public.staff_push_devices
    (shop_id, auth_user_id, endpoint, subscription, label)
  values
    (p_shop_id, auth.uid(), v_endpoint, p_subscription, p_label)
  on conflict (endpoint) do update
    set shop_id      = excluded.shop_id,
        auth_user_id = excluded.auth_user_id,
        subscription = excluded.subscription,
        label        = coalesce(excluded.label, staff_push_devices.label)
    where public.is_staff_of(staff_push_devices.shop_id);

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'device already enrolled to another shop';
  end if;
end;
$$;

-- Hardened grant form, matching is_staff_of as it exists today (see
-- 20260711144354_advisor_hardening.sql): revoking anon alone leaves
-- Postgres's default PUBLIC execute grant from function creation in place.
revoke execute on function public.attach_staff_push_device(uuid, jsonb, text) from public, anon;
grant  execute on function public.attach_staff_push_device(uuid, jsonb, text) to authenticated;
